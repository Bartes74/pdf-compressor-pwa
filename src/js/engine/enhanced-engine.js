export function createEnhancedEngine(app) {
  return {
    name: 'enhanced',
    async process(file, options, progressCallback) {
      // Ensure processor and libs
      await app.ensurePDFLibrariesLoaded();
      if (!app.pdfProcessor) {
        const { PDFProcessor } = await import('../pdf-processor.js');
        app.pdfProcessor = new PDFProcessor();
      }

      // Load PDF and metadata
      const { pdfDoc, metadata } = await app.pdfProcessor.loadPDF(file);

      let processedDoc = pdfDoc;

      // Removal without rasterizing text (experimental first-page pass under hidden flag)
      if (options.removeImages) {
        if (progressCallback) progressCallback({ percentage: 5, message: 'Removing images (page 1)…' });
        processedDoc = await app.pdfProcessor.removeImagesOnFirstPageWithoutRasterization(processedDoc);
        if (progressCallback) progressCallback({ percentage: 10, message: 'Analyzing images…' });
        processedDoc = await app.pdfProcessor.removeImagesPreserveText(processedDoc);
      }

      // Compression: keep non-rasterizing placeholder for now
      if (options.imageCompression) {
        if (progressCallback) progressCallback({ percentage: 20, message: 'Compressing images…' });
        processedDoc = await app.pdfProcessor.compressImagesInMainThread(processedDoc, options.imageQuality, progressCallback);
      }

      // Split if requested
      if (options.splitPDF) {
        if (options.splitMethod === 'pages') {
          // Interpret pageRange: either "start-end" (legacy) or a single integer for fixed pages per file
          const txt = String(options.pageRange || '').trim();
          if (/^\d+-\d+$/.test(txt)) {
            const [start, end] = txt.split('-').map(Number);
            processedDoc = await app.pdfProcessor.splitByPages(processedDoc, start, end);
          } else {
            const pagesPerChunk = Math.max(1, Number(txt) || 10);
            const parts = await app.pdfProcessor.splitByPagesFixed(processedDoc, pagesPerChunk, progressCallback);
            // Save all parts to bytes
            const files = [];
            let idx = 1;
            for (const doc of parts) {
              const bytes = await doc.save({ useObjectStreams: true, addDefaultPage: false, compress: true });
              const padded = String(idx).padStart(3, '0');
              const base = (options.baseName || app.pdfProcessor.generateFileName(file.name, options)).replace(/\.pdf$/i, '');
              const name = `${base}-part-${padded}.pdf`;
              files.push(new File([bytes], name, { type: 'application/pdf' }));
              idx += 1;
            }
            return { originalFile: file, processedFile: files[0], files, metadata, savings: app.pdfProcessor.estimateCompression(file.size, files.reduce((s,f)=>s+f.size,0)), processingTime: Date.now() };
          }
        } else if (options.splitMethod === 'size') {
          const chunks = await app.pdfProcessor.splitBySize(processedDoc, options.fileSizeLimit, progressCallback);
          // Save all chunks
          const files = [];
          let idx = 1;
          for (const doc of chunks) {
            const bytes = await doc.save({ useObjectStreams: true, addDefaultPage: false, compress: true });
            const padded = String(idx).padStart(3, '0');
            const base = (options.baseName || app.pdfProcessor.generateFileName(file.name, options)).replace(/\.pdf$/i, '');
            const name = `${base}-part-${padded}.pdf`;
            files.push(new File([bytes], name, { type: 'application/pdf' }));
            idx += 1;
          }
          return { originalFile: file, processedFile: files[0], files, metadata, savings: app.pdfProcessor.estimateCompression(file.size, files.reduce((s,f)=>s+f.size,0)), processingTime: Date.now() };
        }
      }

      // Optimize
      processedDoc = await app.pdfProcessor.optimizePDF(processedDoc);

      // Save
      const pdfBytes = await processedDoc.save();
      if (!pdfBytes || pdfBytes.length === 0) throw new Error('Processed PDF is empty or invalid');

      const newFileName = app.pdfProcessor.generateFileName(file.name, options);
      const processedFile = new File([pdfBytes], newFileName, { type: 'application/pdf' });
      const savings = app.pdfProcessor.estimateCompression(file.size, processedFile.size);

      return { originalFile: file, processedFile, metadata, savings, processingTime: Date.now() };
    }
  };
}
