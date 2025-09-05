### Split Feature Implementation Plan

Goal: Implement two split modes without breaking existing features.

- Pages-per-file split (fixed number of pages per output)
- Size-based split (max Y MB per output)

Checklist
- [ ] K1: Implement splitByPagesFixed(pdfDoc, pagesPerChunk)
- [ ] K1: Wire enhanced-engine to call pages-per-chunk path when input is numeric
- [ ] K1: Show multiple outputs in UI (list of files for download)
- [ ] K1: Progress: pages processed and files created
- [ ] K2: Upgrade splitBySize to build real size-based chunks (measure bytes)
- [ ] K2: Return multiple outputs; UI list reused
- [ ] K3: Regression checks (Compression/Removal unaffected)

Details
- Detection of pages-per-chunk: If split method is "pages" and the input contains a single integer (e.g., "10"), treat it as pagesPerChunk; if "start-end" treat as range (legacy behavior remains).
- Naming: baseName-part-001.pdf, part-002.pdf, ...
- Progress: Update percentage by pages processed; include files count in messages.
- Size-based: Iteratively add pages to a chunk, save and measure bytes; stop before exceeding Y MB, start next chunk.
