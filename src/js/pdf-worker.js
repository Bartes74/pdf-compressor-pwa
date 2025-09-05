/**
 * Web Worker dla przetwarzania PDF
 * Przenosi ciężkie operacje poza główny wątek
 */

// Import bibliotek
self.importScripts('https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js');

// Listener dla wiadomości
self.addEventListener('message', async (event) => {
  const { type, data } = event.data;
  
  try {
    switch (type) {
      case 'REMOVE_IMAGES':
        await handleRemoveImages(data);
        break;
        
      case 'ANALYZE_PDF':
        await handleAnalyzePDF(data);
        break;
        
      default:
        self.postMessage({
          type: 'ERROR',
          error: `Unknown operation: ${type}`
        });
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      error: error.message,
      stack: error.stack
    });
  }
});

/**
 * Obsługa usuwania obrazków w workerze
 */
async function handleRemoveImages(data) {
  const { arrayBuffer } = data;
  
  try {
    // Załaduj PDF
    self.postMessage({
      type: 'PROGRESS',
      percent: 10,
      message: 'Loading PDF in worker...'
    });
    
    const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer, {
      ignoreEncryption: true,
      throwOnInvalidObject: false
    });
    
    // Analiza przed
    const imagesBefore = await countImages(pdfDoc);
    
    self.postMessage({
      type: 'PROGRESS',
      percent: 20,
      message: `Found ${imagesBefore} images to remove...`
    });
    
    // Usuń obrazki
    const pages = pdfDoc.getPages();
    const totalPages = pages.length;
    
    for (let i = 0; i < totalPages; i++) {
      await removeImagesFromPage(pages[i], pdfDoc);
      
      const progress = 20 + Math.round((i / totalPages) * 60);
      self.postMessage({
        type: 'PROGRESS',
        percent: progress,
        message: `Processing page ${i + 1} of ${totalPages}...`
      });
    }
    
    // Zapisz PDF
    self.postMessage({
      type: 'PROGRESS',
      percent: 85,
      message: 'Saving PDF...'
    });
    
    const pdfBytes = await pdfDoc.save({
      useObjectStreams: false,
      addDefaultPage: false,
      updateFieldAppearances: false
    });
    
    // Analiza po
    const imagesAfter = await countImages(pdfDoc);
    
    self.postMessage({
      type: 'PROGRESS',
      percent: 100,
      message: 'Complete!'
    });
    
    // Zwróć wynik
    self.postMessage({
      type: 'RESULT',
      data: {
        pdfBytes: pdfBytes,
        stats: {
          originalSize: arrayBuffer.byteLength,
          newSize: pdfBytes.length,
          imagesRemoved: imagesBefore - imagesAfter,
          pageCount: totalPages
        }
      }
    }, [pdfBytes.buffer]); // Transfer ownership
    
  } catch (error) {
    throw new Error(`Worker processing failed: ${error.message}`);
  }
}

/**
 * Obsługa analizy PDF (liczba obrazków itd.)
 */
async function handleAnalyzePDF(data) {
  const { arrayBuffer } = data;
  const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer, {
    ignoreEncryption: true,
    throwOnInvalidObject: false
  });
  const images = await countImages(pdfDoc);
  self.postMessage({ type: 'RESULT', data: { images } });
}

/**
 * Usuwa obrazki ze strony
 */
async function removeImagesFromPage(page, pdfDoc) {
  try {
    const resources = page.node.normalizedEntries().Resources;
    if (!resources) return;
    
    const xobjects = resources.lookup(PDFLib.PDFName.of('XObject'), PDFLib.PDFDict);
    
    if (xobjects) {
      const newXObjects = {};
      const entries = xobjects.entries();
      
      for (const [name, ref] of entries) {
        const xobject = pdfDoc.context.lookup(ref);
        
        if (xobject && xobject.dict) {
          const subtype = xobject.dict.get(PDFLib.PDFName.of('Subtype'));
          
          // Zachowaj tylko nie-obrazki (Form XObjects itp.)
          if (!subtype || subtype.encodedName !== '/Image') {
            newXObjects[name.encodedName] = ref;
          }
        }
      }
      
      // Ustaw nowe XObjects
      if (Object.keys(newXObjects).length > 0) {
        const newXObjectDict = pdfDoc.context.obj({});
        for (const [name, ref] of Object.entries(newXObjects)) {
          newXObjectDict.set(PDFLib.PDFName.of(name.substring(1)), ref);
        }
        resources.set(PDFLib.PDFName.of('XObject'), newXObjectDict);
      } else {
        resources.delete(PDFLib.PDFName.of('XObject'));
      }
    }
    
    // Usuń również odniesienia ze strumienia zawartości
    await cleanContentStream(page, pdfDoc);
    
  } catch (error) {
    console.error('Error in removeImagesFromPage:', error);
  }
}

/**
 * Czyści strumień zawartości z odniesień do obrazków
 */
async function cleanContentStream(page, pdfDoc) {
  try {
    const contents = page.node.normalizedEntries().Contents;
    if (!contents) return;
    
    let contentStream = '';
    
    if (contents.constructor.name === 'PDFArray') {
      for (let i = 0; i < contents.size(); i++) {
        const stream = contents.lookup(i);
        if (stream && stream.contents) {
          contentStream += new TextDecoder().decode(stream.contents) + '\n';
        }
      }
    } else if (contents.contents) {
      contentStream = new TextDecoder().decode(contents.contents);
    }
    
    // Usuń polecenia Do dla obrazków i inline images
    let cleaned = contentStream;
    
    // Usuń bloki q...Q zawierające obrazki
    cleaned = cleaned.replace(/q[^Q]*?\/\w+\s+Do\s*Q/g, '');
    
    // Usuń inline images
    cleaned = cleaned.replace(/BI\s+.*?\s+ID\s+[\s\S]*?\s+EI/g, '');
    
    if (cleaned !== contentStream) {
      const newContents = pdfDoc.context.stream(new TextEncoder().encode(cleaned));
      page.node.set(PDFLib.PDFName.of('Contents'), newContents);
    }
    
  } catch (error) {
    console.error('Error cleaning content stream:', error);
  }
}

/**
 * Liczy obrazki w PDF
 */
async function countImages(pdfDoc) {
  let count = 0;
  const pages = pdfDoc.getPages();
  
  for (const page of pages) {
    const resources = page.node.normalizedEntries().Resources;
    if (!resources) continue;
    
    const xobjects = resources.lookup(PDFLib.PDFName.of('XObject'), PDFLib.PDFDict);
    
    if (xobjects) {
      const entries = xobjects.entries();
      
      for (const [name, ref] of entries) {
        const xobject = pdfDoc.context.lookup(ref);
        
        if (xobject && xobject.dict) {
          const subtype = xobject.dict.get(PDFLib.PDFName.of('Subtype'));
          
          if (subtype && subtype.encodedName === '/Image') {
            count++;
          }
        }
      }
    }
  }
  
  return count;
}