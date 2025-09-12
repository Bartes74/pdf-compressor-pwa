export class PDFProcessor {
  constructor() {
    this.PDFLib = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return true;

    try {
      console.log('Initializing PDFProcessor...');
      
      // Sprawdź czy biblioteki są załadowane
      if (!window.PDFLib) {
        console.log('PDFLib not found, loading libraries...');
        const loaded = await window.loadPDFLibraries();
        if (!loaded) {
          throw new Error('Failed to load PDF libraries');
        }
      }
      
      // Sprawdź ponownie
      if (!window.PDFLib) {
        throw new Error('PDFLib still not available after loading');
      }
      
      this.PDFLib = window.PDFLib;
      this.initialized = true;
      
      // Sprawdź dostępność kluczowych funkcji
      console.log('PDFLib loaded:', {
        PDFDocument: !!this.PDFLib.PDFDocument,
        PDFName: !!this.PDFLib.PDFName,
        PDFDict: !!this.PDFLib.PDFDict,
        load: typeof this.PDFLib.PDFDocument.load
      });
      
      return true;
    } catch (error) {
      console.error('Failed to initialize PDF Processor:', error);
      return false;
    }
  }

  /**
   * Walidacja pliku PDF
   */
  validatePDF(file) {
    if (!file) return false;
    const isPdf = file.type === 'application/pdf' || (file.name && file.name.toLowerCase().endsWith('.pdf'));
    if (!isPdf) return false;
    if (file.size === 0) return false;
    return true;
  }

  /**
   * Załaduj PDF i zwróć metadane
   */
  async loadPDF(file) {
    try {
      if (!this.initialized) {
        const ok = await this.initialize();
        if (!ok) throw new Error('PDF libraries not available');
      }
      if (!this.validatePDF(file)) {
        throw new Error('Invalid PDF file');
      }
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await this.PDFLib.PDFDocument.load(arrayBuffer, { updateMetadata: false });
      const metadata = this.extractMetadata(pdfDoc, file);
      // Normalize object streams setting globally for saves from this document
      try { pdfDoc.context.trailerInfo = { ...(pdfDoc.context.trailerInfo||{}), Encrypt: undefined }; } catch (e) { /* noop */ }
      return { pdfDoc, metadata, arrayBuffer };
    } catch (error) {
      console.error('[PDFProcessor] Error loading PDF:', error);
      throw new Error(`Failed to load PDF: ${error.message}`);
    }
  }

  /**
   * Ekstrakcja podstawowych metadanych
   */
  extractMetadata(pdfDoc, file) {
    try {
      const pageCount = typeof pdfDoc.getPageCount === 'function' ? pdfDoc.getPageCount() : 0;
      return {
        fileName: file.name,
        fileSize: file.size,
        pageCount
      };
    } catch (e) {
    return { 
        fileName: file.name,
        fileSize: file.size,
        pageCount: 0
      };
    }
  }

  /**
   * Prosta estymacja oszczędności
   */
  estimateCompression(originalSize, compressedSize) {
    const savingsBytes = Math.max(0, originalSize - compressedSize);
    const savingsPercentage = originalSize > 0 ? ((savingsBytes / originalSize) * 100).toFixed(2) : '0.00';
    return { originalSize, compressedSize, savingsBytes, savingsPercentage };
  }

  /**
   * Szacuje łączną liczbę obrazów w całym PDF
   */
  async estimateTotalImages(pdfDoc) {
    try {
      const pages = pdfDoc.getPages();
      let total = 0;
      for (let i = 0; i < pages.length; i++) {
        total += await this.countPageImages(pages[i], pdfDoc, i);
      }
      return total;
    } catch (e) {
      console.warn('[PDFProcessor] estimateTotalImages failed:', e);
      return 0;
    }
  }

  // Głębokie liczenie (z Form XObjects)
  async estimateTotalImagesDeep(pdfDoc) {
    try {
      const { PDFName, PDFDict } = this.PDFLib;
      const pageCount = pdfDoc.getPageCount();
      const countImagesInDict = (dict) => {
        if (!dict || typeof dict.lookup !== 'function') return 0;
        let cnt = 0;
        const resources = dict.lookup(PDFName.of('Resources'));
        if (resources && resources instanceof PDFDict) {
          const xobj = resources.lookup(PDFName.of('XObject'));
          if (xobj && xobj instanceof PDFDict) {
            const keys = xobj.keys();
            for (const name of keys) {
              try {
                const obj = xobj.lookup(name);
                const subtype = obj && obj.dict ? obj.dict.get(PDFName.of('Subtype')) : null;
                const subtypeText = subtype && subtype.decodeText ? subtype.decodeText() : String(subtype || '');
                if (/Form$/i.test(subtypeText)) {
                  cnt += countImagesInDict(obj.dict);
                } else if (/Image$/i.test(subtypeText)) {
                  cnt += 1;
                }
              } catch {}
            }
          }
        }
        return cnt;
      };
      let total = 0;
      for (let i = 0; i < pageCount; i++) {
        const page = pdfDoc.getPage(i);
        const pageDict = pdfDoc.context.lookup(page.ref, PDFDict);
        total += countImagesInDict(pageDict);
      }
      return total;
    } catch (e) {
      console.warn('[PDFProcessor] estimateTotalImagesDeep failed:', e);
      return 0;
    }
  }

  /**
   * Split PDF by target size (MB) into multiple documents
   * Heuristic: add pages to a chunk, save and measure; if > limit, back off last page and start new chunk.
   */
  async splitBySize(pdfDoc, maxSizeMB, progressCallback = null) {
    const outputs = [];
    try {
      const limit = Math.max(1, Math.round(Number(maxSizeMB) || 10)) * 1024 * 1024;
      const pageCount = pdfDoc.getPageCount();
      // Guard: if even the smallest single-page chunk exceeds the limit, abort with clear error
      const sampleCount = Math.min(5, pageCount);
      let minSinglePage = Infinity;
      for (let i = 0; i < sampleCount; i++) {
        const probe = await this.PDFLib.PDFDocument.create();
        const [p] = await probe.copyPages(pdfDoc, [i]);
        probe.addPage(p);
        const size = (await probe.save({ useObjectStreams: true, addDefaultPage: false })).length;
        if (size < minSinglePage) minSinglePage = size;
      }
      if (minSinglePage === Infinity) throw new Error('Unable to analyze pages for size-based split');
      if (minSinglePage > limit) {
        const mb = (minSinglePage / 1024 / 1024).toFixed(2);
        const sel = (limit / 1024 / 1024).toFixed(2);
        const msg = 'Minimalny rozmiar części (' + mb + ' MB) przekracza wybrany limit (' + sel + ' MB). Zwiększ limit lub użyj podziału po stronach.';
        if (progressCallback) progressCallback({ percentage: 0, message: msg });
        throw new Error(msg);
      }
      let start = 0;
      let part = 0;
      while (start < pageCount) {
        // Exponential growth to find upper bound, then binary search within [low, high]
        let low = 1;
        let high = 1;
        let bestFitDoc = null;
        let bestFitPages = 0;
        // Find an upper bound that exceeds the limit or end of doc
        while (true) {
          const candidateEnd = Math.min(start + high, pageCount);
          const tmp = await this.PDFLib.PDFDocument.create();
          const indices = [];
          for (let i = start; i < candidateEnd; i++) indices.push(i);
          const pages = await tmp.copyPages(pdfDoc, indices);
          pages.forEach(p => tmp.addPage(p));
          const size = (await tmp.save({ useObjectStreams: true, addDefaultPage: false })).length;
          if (size <= limit && candidateEnd < pageCount) {
            bestFitDoc = tmp;
            bestFitPages = candidateEnd - start;
            low = high + 1;
            high = Math.min(high * 2, pageCount - start);
          } else {
            // Found upper bound (either size>limit or reached end)
            if (size <= limit) {
              bestFitDoc = tmp;
              bestFitPages = candidateEnd - start;
              low = bestFitPages;
            } else {
              // keep tmp for possible binary search highs
            }
            break;
          }
        }
        // Binary search in [low, high] to maximize pages under limit
        let l = Math.max(1, Math.min(low, pageCount - start));
        let r = Math.max(l, Math.min(high, pageCount - start));
        while (l <= r) {
          const mid = Math.floor((l + r) / 2);
          const candidateEnd = start + mid;
          const tmp = await this.PDFLib.PDFDocument.create();
          const indices = [];
          for (let i = start; i < candidateEnd; i++) indices.push(i);
          const pages = await tmp.copyPages(pdfDoc, indices);
          pages.forEach(p => tmp.addPage(p));
          const size = (await tmp.save({ useObjectStreams: true, addDefaultPage: false })).length;
          if (size <= limit) {
            bestFitDoc = tmp;
            bestFitPages = mid;
            l = mid + 1;
          } else {
            r = mid - 1;
          }
          if (progressCallback) {
            const pct = Math.min(95, Math.round(((candidateEnd) / pageCount) * 100));
            progressCallback({ percentage: pct, message: `Packing part ${part + 1}… (${candidateEnd}/${pageCount} pages)` });
          }
        }
        // Edge: if no fit (single page > limit), abort with clear error
        if (!bestFitDoc || bestFitPages === 0) {
          const probe = await this.PDFLib.PDFDocument.create();
          const [p] = await probe.copyPages(pdfDoc, [start]);
          probe.addPage(p);
          const oneSize = (await probe.save({ useObjectStreams: true, addDefaultPage: false })).length;
          const mb = (oneSize / 1024 / 1024).toFixed(2);
          const sel = (limit / 1024 / 1024).toFixed(2);
          const msg = `Strona ${start + 1}: minimalny rozmiar części (${mb} MB) przekracza wybrany limit (${sel} MB). Zwiększ limit lub użyj podziału po stronach.`;
          if (progressCallback) progressCallback({ percentage: 0, message: msg });
          throw new Error(msg);
        } else {
          outputs.push(bestFitDoc);
          start += bestFitPages;
        }
        part += 1;
      }
      return outputs;
    } catch (e) {
      console.error('[PDFProcessor] splitBySize error:', e);
      throw e;
    }
  }

  /**
   * Główna ścieżka przetwarzania (legacy engine)
   */
  async processPDF(file, options, progressCallback = null) {
    if (!file) throw new Error('No file provided');
    const { pdfDoc, metadata } = await this.loadPDF(file);

    // Removal (zachowuje tekst)
    if (options && options.removeImages) {
      const removal = await this.removeImages(file, options, progressCallback);
      const processedFile = new File([removal.pdfBytes], removal.fileName, { type: 'application/pdf' });
      const savings = this.estimateCompression(file.size, removal.pdfBytes.length);
      return { originalFile: file, processedFile, metadata, savings, processingTime: Date.now() };
    }

    // Compression (placeholder: bez zmian zawartości, tylko przepływ i postęp)
    if (options && options.imageCompression) {
      if (progressCallback) progressCallback({ percentage: 10, message: 'Preparing compression…' });
      const processedDoc = await this.compressImagesInMainThread(pdfDoc, options.imageQuality, progressCallback);

      // Rebuild to drop orphaned image objects after replacements
      let targetDoc = processedDoc;
      try {
        const pageCount = processedDoc.getPageCount();
        const rebuilt = await this.PDFLib.PDFDocument.create();
        const copied = await rebuilt.copyPages(processedDoc, Array.from({ length: pageCount }, (_, i) => i));
        copied.forEach(p => rebuilt.addPage(p));
        targetDoc = rebuilt;
      } catch (e) {
        console.warn('[PDFProcessor] Compression rebuild skipped:', e);
      }

      if (progressCallback) progressCallback({ percentage: 90, message: 'Saving PDF…' });
      const pdfBytes = await targetDoc.save({ useObjectStreams: true, addDefaultPage: false, compress: true });
      const fileName = this.generateFileName(file.name, options);
      const processedFile = new File([pdfBytes], fileName, { type: 'application/pdf' });
      const savings = this.estimateCompression(file.size, processedFile.size);
      if (progressCallback) progressCallback({ percentage: 100, message: 'Compression complete' });
      return { originalFile: file, processedFile, metadata, savings, processingTime: Date.now() };
    }

    // Split i inne opcje mogą być obsłużone tutaj w przyszłości
    return { originalFile: file, processedFile: file, metadata, savings: this.estimateCompression(file.size, file.size), processingTime: Date.now() };
  }

  /**
   * Kompresja obrazów (tymczasowo no-op z prog. postępu)
   */
  async compressImagesInMainThread(pdfDoc, quality = 70, progressCallback = null) {
    try {
      const { PDFName, PDFDict, PDFArray } = this.PDFLib;
      const q = Math.max(0.1, Math.min(1, Number(quality) / 100));
      const totalEstimated = await this.estimateTotalImagesDeep(pdfDoc).catch(() => 0) || await this.estimateTotalImages(pdfDoc).catch(() => 0);
      let processedImages = 0;
      let replacedImages = 0;

      const getFilters = (dict) => {
        try {
          const filt = dict.lookup ? dict.lookup(PDFName.of('Filter')) : null;
          if (!filt) return [];
          if (filt instanceof PDFArray) {
            const out = [];
            for (let i = 0; i < filt.size(); i++) {
              const n = filt.get(i);
              out.push(n && n.decodeText ? n.decodeText() : String(n || ''));
            }
            return out;
          }
          return [filt && filt.decodeText ? filt.decodeText() : String(filt || '')];
        } catch { return []; }
      };

      const recompressJpeg = async (obj, name, xobjDict) => {
        try {
          const widthObj = obj.dict.get(PDFName.of('Width'));
          const heightObj = obj.dict.get(PDFName.of('Height'));
          const width = (widthObj && (widthObj.number ?? widthObj.value)) || 0;
          const height = (heightObj && (heightObj.number ?? heightObj.value)) || 0;
          let raw = null;
          try { raw = typeof obj.getContents === 'function' ? obj.getContents() : null; } catch {}
          if (!raw) { try { raw = obj.contents || null; } catch {} }
          if (!raw || !width || !height) return false;

          // Heurystyczny downscale przy niskiej jakości i dużych obrazach
          let scale = 1;
          if (q <= 0.5) scale = 0.75;
          if (q <= 0.3) scale = 0.6;
          const targetW = Math.max(1, Math.floor(width * scale));
          const targetH = Math.max(1, Math.floor(height * scale));

          const origSize = raw.length || 0;
          const origBlob = new Blob([raw]);
          let bmp = null;
          // Spróbuj bez typu, potem z hintami
          try { bmp = await createImageBitmap(origBlob); } catch {}
          if (!bmp) {
            try { bmp = await createImageBitmap(new Blob([raw], { type: 'image/jpeg' })); } catch {}
          }
          if (!bmp) {
            try { bmp = await createImageBitmap(new Blob([raw], { type: 'image/jp2' })); } catch {}
          }
          if (!bmp) {
            try { bmp = await createImageBitmap(new Blob([raw], { type: 'image/jpx' })); } catch {}
          }
          if (!bmp) {
            try { bmp = await createImageBitmap(new Blob([raw], { type: 'image/png' })); } catch {}
          }
          if (!bmp) {
            return false; // nie dekodujemy – zostaw oryginał
          }

          const canvas = document.createElement('canvas');
          canvas.width = targetW || bmp.width || 1;
          canvas.height = targetH || bmp.height || 1;
          const ctx = canvas.getContext('2d', { alpha: false });
          ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
          const newBlob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', q));
          const newBytes = new Uint8Array(await newBlob.arrayBuffer());

          // Jeśli nowy większy, zachowaj oryginał
          if (!newBytes || (origSize && newBytes.length >= origSize)) return false;

          const embedded = await pdfDoc.embedJpg(newBytes);
          // Zachowaj tę samą nazwę XObject w bieżącym słowniku XObject
          xobjDict.set(name, embedded.ref);
          replacedImages += 1;
          return true;
        } catch {
          return false;
        }
      };

      const compressInDict = async (dict, level = 0) => {
        if (!dict || typeof dict.lookup !== 'function') return;
        const resources = dict.lookup(PDFName.of('Resources'));
        if (resources && resources instanceof PDFDict) {
          const xobj = resources.lookup(PDFName.of('XObject'));
          if (xobj && xobj instanceof PDFDict) {
            const keys = xobj.keys();
            for (const name of keys) {
              try {
                const obj = xobj.lookup(name);
                const subtype = obj && obj.dict ? obj.dict.get(PDFName.of('Subtype')) : null;
                const subtypeText = subtype && subtype.decodeText ? subtype.decodeText() : String(subtype || '');
                if (/Form$/i.test(subtypeText)) {
                  // Rekurencja do Form XObject (użyj dict strumienia formularza)
                  await compressInDict(obj.dict, level + 1);
                } else if (/Image$/i.test(subtypeText)) {
                  const filters = getFilters(obj.dict || {});
                  // Spróbuj recompress dla JPEG/JPX/PNG-like (Flate); funkcja sama zdecyduje czy się uda
                  await recompressJpeg(obj, name, xobj);
                  processedImages += 1;
                  if (progressCallback) {
                    const denom = totalEstimated || '?';
                    const pct = totalEstimated ? Math.min(85, 10 + Math.floor((processedImages / totalEstimated) * 70)) : 10;
                    progressCallback({ percentage: pct, message: `Compressing images ${processedImages}/${denom}…` });
                  }
                }
              } catch {
                // ignore this entry
              }
            }
          }
        }
      };

      // Przejdź po wszystkich stronach (z rekurencją do Form XObjects)
      const pageCount = pdfDoc.getPageCount();
      for (let i = 0; i < pageCount; i++) {
        const page = pdfDoc.getPage(i);
        const pageDict = pdfDoc.context.lookup(page.ref, PDFDict);
        await compressInDict(pageDict, 0);
        if (progressCallback) {
          const basePct = totalEstimated ? Math.min(90, 10 + Math.floor(((i + 1) / pageCount) * 70)) : 10 + Math.floor(((i + 1) / pageCount) * 70);
          progressCallback({ percentage: basePct, message: `Scanning page ${i + 1}/${pageCount}… (${processedImages}/${totalEstimated} images)` });
        }
      }

      return pdfDoc;
    } catch (e) {
      console.warn('[PDFProcessor] compressImagesInMainThread fallback:', e);
      return pdfDoc;
    }
  }

  /**
   * Compress to approximate target final size using bounded binary search over JPEG quality.
   * - targetMB: desired size in megabytes
   * Returns { processedDoc, qualityUsed }
   */
  async compressToTargetSize(pdfDoc, targetMB, progressCallback = null) {
    const cloneDoc = async (doc) => {
      const rebuilt = await this.PDFLib.PDFDocument.create();
      const pc = doc.getPageCount();
      const pages = await rebuilt.copyPages(doc, Array.from({ length: pc }, (_, i) => i));
      pages.forEach(p => rebuilt.addPage(p));
      return rebuilt;
    };

    const targetBytes = Math.max(1, Math.round(Number(targetMB) * 1024 * 1024));

    // Quick early exit: if saving now is already <= target, return as-is
    let baselineBytes;
    try { baselineBytes = (await pdfDoc.save({ useObjectStreams: true, addDefaultPage: false, compress: true })).length; } catch { baselineBytes = Infinity; }
    if (baselineBytes <= targetBytes) {
      return { processedDoc: pdfDoc, qualityUsed: 100 };
    }

    let lowQ = 10; // percent
    let highQ = 90; // conservative upper bound
    let best = { bytes: Infinity, quality: lowQ, doc: pdfDoc };

    for (let iter = 0; iter < 6; iter++) { // ~6 iters → 64 steps
      const mid = Math.floor((lowQ + highQ) / 2);
      if (progressCallback) progressCallback({ percentage: 15 + iter * 8, message: `Tuning quality… q=${mid}` });

      // Work on a fresh clone to avoid cumulative degradation across iterations
      let working = await cloneDoc(pdfDoc);
      working = await this.compressImagesInMainThread(working, mid, null);
      const bytes = (await working.save({ useObjectStreams: true, addDefaultPage: false, compress: true })).length;

      // Track best candidate not exceeding target; otherwise smallest overall
      const score = bytes <= targetBytes ? (targetBytes - bytes) : (bytes - targetBytes + 10_000_000);
      if (score < (best.score ?? Number.POSITIVE_INFINITY)) {
        best = { bytes, quality: mid, doc: working, score };
      }

      if (bytes > targetBytes) {
        // too big → lower quality
        highQ = Math.max(lowQ, mid - 1);
      } else {
        // under or equal → try higher quality but keep candidate
        lowQ = Math.min(100, mid + 1);
      }
    }

    if (progressCallback) progressCallback({ percentage: 80, message: `Selected q=${best.quality}` });
    return { processedDoc: best.doc, qualityUsed: best.quality };
  }
  
  /**
   * Prosty optimizer (no-op)
   */
  async optimizePDF(pdfDoc) { return pdfDoc; }

  /**
   * Generowanie nazwy pliku (zgodne z app.js)
   */
  generateFileName(originalName, options = {}) {
    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, "");
    const extension = '.pdf';
    let suffix = '';
    if (options.imageCompression) suffix += `-compressed-${options.imageQuality ?? 70}`;
    if (options.removeImages) suffix += '-no-images';
    if (options.splitPDF) suffix += '-split';
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    return `${nameWithoutExt}${suffix}-${timestamp}${extension}`;
  }

  /**
   * Metoda do usuwania obrazków z PDF
   */
  async removeImages(file, options = {}, progressCallback = null) {
    console.log('removeImages called with:', { 
      fileName: file?.name, 
      fileSize: file?.size,
      fileType: file?.type 
    });

    try {
      // Inicjalizacja
        const initialized = await this.initialize();
        if (!initialized) {
        throw new Error('PDF libraries not initialized');
      }

      // Walidacja pliku
      if (!file) {
        throw new Error('No file provided');
      }

      if (!(file instanceof File) && !(file instanceof Blob)) {
        console.error('Invalid file object:', file);
        throw new Error('Invalid file object');
      }

      // Progress: Loading
      if (progressCallback) {
        progressCallback({
          percent: 10,
          message: 'Loading PDF file...'
        });
      }

      // Konwersja do ArrayBuffer
      console.log('Converting file to ArrayBuffer...');
      let arrayBuffer;
      try {
        arrayBuffer = await file.arrayBuffer();
        console.log('ArrayBuffer created, size:', arrayBuffer.byteLength);
      } catch (error) {
        console.error('Failed to read file:', error);
        throw new Error('Failed to read file: ' + error.message);
      }

      // Ładowanie PDF
      console.log('Loading PDF with PDFLib...');
      let pdfDoc;
      
      try {
        // Upewnij się, że używamy właściwej metody
        if (!this.PDFLib || !this.PDFLib.PDFDocument || !this.PDFLib.PDFDocument.load) {
          console.error('PDFLib structure:', {
            PDFLib: !!this.PDFLib,
            PDFDocument: !!this.PDFLib?.PDFDocument,
            load: !!this.PDFLib?.PDFDocument?.load
          });
          throw new Error('PDFLib.PDFDocument.load is not available');
        }

        // Załaduj PDF
        pdfDoc = await this.PDFLib.PDFDocument.load(arrayBuffer, {
          ignoreEncryption: true,
          throwOnInvalidObject: false,
          updateMetadata: false
        });

        console.log('PDF loaded successfully:', {
          pdfDoc: !!pdfDoc,
          type: typeof pdfDoc,
          constructor: pdfDoc?.constructor?.name
        });

      } catch (loadError) {
        console.error('PDF load error:', loadError);
        throw new Error(`Failed to load PDF: ${loadError.message}`);
      }

      // Sprawdź czy pdfDoc jest prawidłowy
      if (!pdfDoc) {
        throw new Error('pdfDoc is null or undefined');
      }

      // Sprawdź metody
      console.log('Checking pdfDoc methods:', {
        getPages: typeof pdfDoc.getPages,
        getPageCount: typeof pdfDoc.getPageCount,
        save: typeof pdfDoc.save
      });

      if (typeof pdfDoc.getPages !== 'function') {
        console.error('pdfDoc object:', pdfDoc);
        throw new Error('pdfDoc.getPages is not a function');
      }

      // Progress: Analyzing
      if (progressCallback) {
        progressCallback({
          percent: 20,
          message: 'Analyzing PDF structure...'
        });
      }

      // Pobierz strony
      let pages, pageCount;
      try {
        pageCount = pdfDoc.getPageCount();
        pages = pdfDoc.getPages();
        console.log(`PDF has ${pageCount} pages`);
      } catch (error) {
        console.error('Error getting pages:', error);
        throw new Error('Failed to get PDF pages: ' + error.message);
      }

      // Zlicz obrazki
      let totalImages = 0;
      for (let i = 0; i < pages.length; i++) {
        const imageCount = await this.countPageImages(pages[i], pdfDoc, i);
        totalImages += imageCount;
      }
      
      console.log(`Found ${totalImages} total images to remove`);

      // Progress: Removing images
      if (progressCallback) {
        progressCallback({
          percent: 30,
          message: `Removing ${totalImages} images...`
        });
      }

      // Usuń obrazki z każdej strony
      for (let i = 0; i < pages.length; i++) {
        if (progressCallback) {
          const percent = 30 + Math.round((i / pages.length) * 50);
          progressCallback({
            percent,
            message: `Processing page ${i + 1} of ${pages.length}...`
          });
        }

        await this.removeImagesFromPage(pages[i], pdfDoc, i);
      }

      // Progress: Saving
      if (progressCallback) {
        progressCallback({
          percent: 85,
          message: 'Saving PDF...'
        });
      }

      // Opcjonalna rekonstrukcja dokumentu, aby usunąć osierocone obiekty (np. obrazy)
      let targetDoc = pdfDoc;
      try {
        const rebuilt = await this.PDFLib.PDFDocument.create();
        const pageCountAfter = pdfDoc.getPageCount();
        const copied = await rebuilt.copyPages(pdfDoc, Array.from({ length: pageCountAfter }, (_, i) => i));
        copied.forEach(p => rebuilt.addPage(p));
        targetDoc = rebuilt;
      } catch (e) {
        console.warn('[PDFProcessor] Rebuild skipped, using modified document directly:', e);
      }

      // Zapisz PDF (włącz kompresję obiektów)
      console.log('Saving modified PDF...');
      const pdfBytes = await targetDoc.save({
        useObjectStreams: true,
        addDefaultPage: false,
        objectsPerTick: 50,
        updateFieldAppearances: false
      });

      console.log('PDF saved, size:', pdfBytes.length);

      // Statystyki
      const stats = {
        originalSize: file.size,
        newSize: pdfBytes.length,
        reduction: ((1 - pdfBytes.length / file.size) * 100).toFixed(2),
        imagesRemoved: totalImages,
        pageCount: pageCount
      };

      if (progressCallback) {
        progressCallback({
          percent: 100,
          message: `Completed! Removed ${stats.imagesRemoved} images, reduced size by ${stats.reduction}%`
        });
      }

      return {
        pdfBytes,
        stats,
        fileName: file.name.replace('.pdf', '_no_images.pdf')
      };

    } catch (error) {
      console.error('Error in removeImages:', error);
      console.error('Stack trace:', error.stack);
      
      // Re-throw z bardziej szczegółowym komunikatem
      if (error.message.includes('getPages')) {
        throw new Error('PDF document structure error. The file may be corrupted.');
      }
      throw error;
    }
  }

  /**
   * Liczy obrazki na stronie z obsługą błędów
   */
  async countPageImages(page, pdfDoc, pageIndex) {
    let count = 0;
    
    try {
      if (!page || !page.node) {
        console.warn(`Page ${pageIndex} has no node`);
        return 0;
      }

      const pageDict = page.node;
      const entries = pageDict.normalizedEntries ? pageDict.normalizedEntries() : {};
      const resources = entries.Resources;
      
      if (!resources) {
        return 0;
      }

      // Szukaj XObjects
      try {
        const xobjects = resources.lookup ? 
          resources.lookup(this.PDFLib.PDFName.of('XObject'), this.PDFLib.PDFDict) :
          null;
        
        if (xobjects && xobjects.entries) {
          const xobjectEntries = xobjects.entries();
          
          for (const [name, ref] of xobjectEntries) {
            try {
              const xobject = pdfDoc.context.lookup(ref);
              
              if (xobject && xobject.dict) {
                const subtype = xobject.dict.get(this.PDFLib.PDFName.of('Subtype'));
                
                if (subtype && subtype.encodedName === '/Image') {
                  count++;
                  console.log(`  Page ${pageIndex + 1}: Found image ${name.encodedName}`);
                }
              }
            } catch (err) {
              console.warn(`Error checking XObject on page ${pageIndex}:`, err);
            }
          }
        }
      } catch (error) {
        console.warn(`Error accessing XObjects on page ${pageIndex}:`, error);
      }
      
    } catch (error) {
      console.warn(`Error counting images on page ${pageIndex}:`, error);
    }
    
    return count;
  }

  /**
   * Usuwa obrazki ze strony z pełną obsługą błędów
   */
  async removeImagesFromPage(page, pdfDoc, pageIndex) {
    try {
      if (!page || !page.node) {
        console.warn(`Page ${pageIndex} has no node, skipping`);
        return;
      }

      const pageDict = page.node;
      const entries = pageDict.normalizedEntries ? pageDict.normalizedEntries() : {};
      const resources = entries.Resources;
      
      if (!resources) {
        console.log(`Page ${pageIndex + 1}: No resources found`);
        return;
      }

      // Sprawdź XObjects
      try {
        const xobjects = resources.lookup ? 
          resources.lookup(this.PDFLib.PDFName.of('XObject'), this.PDFLib.PDFDict) :
          null;
        
        if (xobjects && xobjects.entries) {
          const newXObjectDict = pdfDoc.context.obj({});
          const xobjectEntries = xobjects.entries();
          let hasNonImages = false;
          let removedCount = 0;
          
          for (const [name, ref] of xobjectEntries) {
            try {
              const xobject = pdfDoc.context.lookup(ref);
              
              if (xobject && xobject.dict) {
                const subtype = xobject.dict.get(this.PDFLib.PDFName.of('Subtype'));
                
                if (subtype && subtype.encodedName === '/Image') {
                  // To jest obrazek - pomijamy
                  removedCount++;
                  console.log(`  Removing image: ${name.encodedName} from page ${pageIndex + 1}`);
                } else {
                  // To nie jest obrazek - zachowujemy
                  newXObjectDict.set(name, ref);
                  hasNonImages = true;
                }
              }
            } catch (err) {
              console.warn(`Error processing XObject ${name.encodedName}:`, err);
            }
          }
          
          // Aktualizuj XObjects
          if (hasNonImages) {
            resources.set(this.PDFLib.PDFName.of('XObject'), newXObjectDict);
          } else if (resources.delete) {
            resources.delete(this.PDFLib.PDFName.of('XObject'));
          }
          
          if (removedCount > 0) {
            console.log(`  Removed ${removedCount} images from page ${pageIndex + 1}`);
          }
        }
      } catch (error) {
        console.warn(`Error modifying XObjects on page ${pageIndex}:`, error);
      }

      // Oczyść content stream
      await this.cleanContentStream(page, pdfDoc, pageIndex);
      
    } catch (error) {
      console.error(`Error removing images from page ${pageIndex}:`, error);
    }
  }

  /**
   * Czyści content stream z odniesień do obrazków
   */
  async cleanContentStream(page, pdfDoc, pageIndex) {
    try {
      if (!page || !page.node) return;

      const pageDict = page.node;
      const entries = pageDict.normalizedEntries ? pageDict.normalizedEntries() : {};
      const contents = entries.Contents;
      
      if (!contents) return;

      let contentStream = '';
      
      // Pobierz content stream
      try {
        if (contents.constructor && contents.constructor.name === 'PDFArray') {
          for (let i = 0; i < contents.size(); i++) {
            const stream = contents.lookup(i);
            if (stream && stream.contents) {
              contentStream += new TextDecoder().decode(stream.contents) + '\n';
            }
          }
        } else if (contents && contents.contents) {
          contentStream = new TextDecoder().decode(contents.contents);
        }
      } catch (error) {
        console.warn(`Error reading content stream on page ${pageIndex}:`, error);
        return;
      }

      // Modyfikuj content
      let modified = contentStream;
      
      // Usuń obrazki
      const originalLength = modified.length;
      modified = modified.replace(/q[^Q]*?\/\w+\s+Do\s*Q/g, '');
      modified = modified.replace(/\/\w+\s+Do/g, '');
      modified = modified.replace(/BI\s+[\s\S]*?\s+ID\s+[\s\S]*?\s+EI/g, '');
      
      // Zapisz jeśli zmieniono
      if (modified !== contentStream && modified.trim()) {
        try {
          // Zapisuj skompresowany strumień, aby uniknąć wzrostu rozmiaru
          const newContents = pdfDoc.context.flateStream(new TextEncoder().encode(modified));
          pageDict.set(this.PDFLib.PDFName.of('Contents'), newContents);
          console.log(`  Cleaned content stream on page ${pageIndex + 1} (${originalLength} -> ${modified.length} bytes)`);
    } catch (error) {
          console.warn(`Error updating content stream on page ${pageIndex}:`, error);
        }
      }
      
    } catch (error) {
      console.warn(`Error cleaning content stream on page ${pageIndex}:`, error);
    }
  }

  /**
   * Split PDF into chunks with a fixed number of pages per output file
   * @param {PDFDocument} pdfDoc
   * @param {number} pagesPerChunk
   * @param {Function} progressCallback
   * @returns {Promise<PDFDocument[]>}
   */
  async splitByPagesFixed(pdfDoc, pagesPerChunk, progressCallback = null) {
    const outputs = [];
    try {
      const pageCount = pdfDoc.getPageCount();
      const chunkSize = Math.max(1, Number(pagesPerChunk) | 0);
      let from = 1;
      let part = 0;
      while (from <= pageCount) {
        const to = Math.min(pageCount, from + chunkSize - 1);
        const partDoc = await this.PDFLib.PDFDocument.create();
        const copied = await partDoc.copyPages(pdfDoc, Array.from({ length: to - from + 1 }, (_, i) => from - 1 + i));
        copied.forEach(p => partDoc.addPage(p));
        outputs.push(partDoc);
        part += 1;
        if (progressCallback) {
          const pct = Math.min(95, Math.round((to / pageCount) * 100));
          progressCallback({ percentage: pct, message: `Splitting pages ${from}-${to} (${part} files)` });
        }
        from = to + 1;
      }
      return outputs;
    } catch (e) {
      console.error('[PDFProcessor] splitByPagesFixed error:', e);
      return outputs;
    }
  }
}

export default PDFProcessor;
