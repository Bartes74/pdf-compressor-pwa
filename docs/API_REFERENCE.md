### API Reference

#### App State and Options
`app.state.processingOptions`:
- `imageCompression: boolean`
- `imageQuality: number (10–100)`
- `removeImages: boolean`
- `splitPDF: boolean`
- `splitMethod: 'pages' | 'size'`
- `pageRange: string` — "start-end" or a single number (fixed pages per file)
- `fileSizeLimit: number` — MB

#### Engine
`createEngine(app)` → `{ name, process(file, options, progressCallback) }`
- `process` resolves to:
  - Single file: `{ originalFile, processedFile, metadata, savings, processingTime }`
  - Split: `{ originalFile, processedFile: files[0], files: File[], metadata, savings, processingTime }`

#### PDFProcessor
- `initialize(): Promise<boolean>` — loads libraries (idempotent)
- `validatePDF(file): boolean`
- `loadPDF(file): Promise<{ pdfDoc, metadata, arrayBuffer }>`
- `extractMetadata(pdfDoc, file): { fileName, fileSize, pageCount }`
- `estimateTotalImages(pdfDoc): Promise<number>`
- `estimateTotalImagesDeep(pdfDoc): Promise<number>`
- `removeImages(file, options, progress?): Promise<{ pdfBytes, stats, fileName }>`
- `compressImagesInMainThread(pdfDoc, quality, progress?): Promise<PDFDocument>`
- `splitByPagesFixed(pdfDoc, pagesPerChunk, progress?): Promise<PDFDocument[]>`
- `splitBySize(pdfDoc, maxSizeMB, progress?): Promise<PDFDocument[]>` — throws when minimal single‑page size > limit
- `optimizePDF(pdfDoc): Promise<PDFDocument>`
- `generateFileName(originalName, options): string`
- `estimateCompression(originalSize, compressedSize): { originalSize, compressedSize, savingsBytes, savingsPercentage }`

Notes:
- All save operations use `{ useObjectStreams: true, addDefaultPage: false }` and may set `compress: true`.
- Size split: uses exponential probing + binary search to pack pages within the byte limit; guard throws localized error.

#### UIController
- `applyActiveTabOptions(tabId)` — sync tab → options
- `setupOptionControls()` — hooks sliders/inputs and updates state via `app.updateProcessingOptions`
- `showProgress(), updateProgress(percent, message), hideProgress()`
- `showResults(files)` — shows single file or renders split list
- `showNotification(message, type)` — toast
- `showErrorModal(message)` — centered blocking error dialog

#### StorageManager (optional)
- `init(), saveResult(result)` — store processed outputs (if used)


