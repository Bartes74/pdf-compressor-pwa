export function createLegacyEngine(app) {
  return {
    name: 'legacy',
    async process(file, options, progressCallback) {
      if (!app.pdfProcessor) {
        const { PDFProcessor } = await import('../pdf-processor.js');
        app.pdfProcessor = new PDFProcessor();
      }
      return app.pdfProcessor.processPDF(file, options, progressCallback);
    }
  };
}
