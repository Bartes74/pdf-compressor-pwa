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

      // Removal without rasterizing text
      if (options.removeImages) {
        if (progressCallback) progressCallback({ percentage: 5, message: 'Removing images…' });
        processedDoc = await app.pdfProcessor.removeImagesPreserveText(processedDoc);
      }

      // Compression: for now, keep legacy behavior (no rasterization in enhanced path yet)
      if (options.imageCompression) {
        if (progressCallback) progressCallback({ percentage: 15, message: 'Compressing images…' });
        processedDoc = await app.pdfProcessor.compressImagesInMainThread(processedDoc, options.imageQuality, progressCallback);
      }

      // Split if requested
      if (options.splitPDF) {
        if (options.splitMethod === 'pages' && options.pageRange) {
          const [start, end] = options.pageRange.split('-').map(Number);
          processedDoc = await app.pdfProcessor.splitByPages(processedDoc, start, end);
        } else if (options.splitMethod === 'size') {
          const chunks = await app.pdfProcessor.splitBySize(processedDoc, options.fileSizeLimit, progressCallback);
          processedDoc = chunks[0];
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
