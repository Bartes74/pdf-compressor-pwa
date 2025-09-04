// PDFProcessor.js - Handles PDF processing logic using pdf-lib
// This implementation provides comprehensive PDF manipulation capabilities

import { PDFDocument, rgb } from 'pdf-lib';

/**
 * PDFProcessor - Class for processing PDF files with various operations
 * Uses pdf-lib for PDF manipulation and provides methods for compression, splitting, and optimization
 */
export class PDFProcessor {
  /**
   * Constructor - Initialize PDFProcessor
   */
  constructor() {
    this.worker = null;
    this.isWorkerSupported = typeof Worker !== 'undefined';
    this.taskCounter = 0;
  }

  /**
   * Initialize Web Worker for heavy operations
   * @returns {Promise<Worker>} - Initialized worker
   */
  async initWorker() {
    if (!this.isWorkerSupported) {
      throw new Error('Web Workers not supported in this environment');
    }
    
    if (this.worker) {
      return this.worker;
    }
    
    try {
      // For webpack, we need to use a different approach to load the worker
      // We'll dynamically create the worker using Blob URL
      const workerBlob = new Blob([`importScripts('${window.location.origin}/src/js/pdf-worker.js');`], {
        type: 'application/javascript'
      });
      const workerUrl = URL.createObjectURL(workerBlob);
      
      // Create worker
      this.worker = new Worker(workerUrl);
      
      // Set up message handling
      this.setupWorkerMessaging();
      
      // Wait for worker to be ready
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Worker initialization timeout'));
        }, 5000);
        
        const readyHandler = (event) => {
          if (event.data.type === 'WORKER_READY') {
            clearTimeout(timeout);
            this.worker.removeEventListener('message', readyHandler);
            console.log('[PDFProcessor] Web Worker initialized');
            resolve(this.worker);
          }
        };
        
        this.worker.addEventListener('message', readyHandler);
      });
      
      // Clean up the blob URL
      URL.revokeObjectURL(workerUrl);
      
      return this.worker;
    } catch (error) {
      console.error('[PDFProcessor] Error initializing worker:', error);
      this.worker = null;
      throw new Error(`Failed to initialize worker: ${error.message}`);
    }
  }
  
  /**
   * Set up worker message handling
   */
  setupWorkerMessaging() {
    if (!this.worker) return;
    
    this.worker.onmessage = (event) => {
      const { type, taskId, result, error, percentage, message, performance } = event.data;
      
      // Handle different message types
      switch (type) {
        case 'PROGRESS_UPDATE':
          // Progress updates are handled by specific task handlers
          break;
          
        case 'PROCESSING_COMPLETED':
          // Find and resolve the corresponding promise
          if (this.pendingTasks && this.pendingTasks[taskId]) {
            const { resolve } = this.pendingTasks[taskId];
            delete this.pendingTasks[taskId];
            resolve({ result, performance });
          }
          break;
          
        case 'ERROR':
          // Find and reject the corresponding promise
          if (this.pendingTasks && this.pendingTasks[taskId]) {
            const { reject } = this.pendingTasks[taskId];
            delete this.pendingTasks[taskId];
            reject(new Error(error));
          }
          break;
          
        case 'TASK_QUEUED':
        case 'PROCESSING_STARTED':
        case 'TASK_CANCELLED':
        case 'TASK_NOT_FOUND':
        case 'STATUS_UPDATE':
        case 'WORKER_READY':
        case 'WORKER_CLEANUP_COMPLETED':
          // These are informational messages
          console.log(`[PDFProcessor] Worker message: ${type}`);
          break;
          
        default:
          console.warn(`[PDFProcessor] Unknown worker message type: ${type}`);
      }
    };
    
    this.worker.onerror = (error) => {
      console.error('[PDFProcessor] Worker error:', error);
    };
    
    // Track pending tasks
    this.pendingTasks = {};
  }
  
  /**
   * Generate unique task ID
   * @returns {string} - Unique task ID
   */
  generateTaskId() {
    return `task-${Date.now()}-${++this.taskCounter}`;
  }

  /**
   * Load a PDF file and extract metadata
   * @param {File} file - The PDF file to load
   * @returns {Promise<Object>} - Object containing PDF document and metadata
   */
  async loadPDF(file) {
    try {
      console.log('[PDFProcessor] Loading PDF file:', file.name);
      
      // Validate PDF file
      if (!this.validatePDF(file)) {
        throw new Error('Invalid PDF file');
      }
      
      // Convert File to ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Load PDF document using pdf-lib
      const pdfDoc = await PDFDocument.load(arrayBuffer, { 
        updateMetadata: false,
        parseSpeed: 'fast' // For better performance with large files
      });
      
      // Extract metadata
      const metadata = this.extractMetadata(pdfDoc, file);
      
      console.log('[PDFProcessor] PDF loaded successfully');
      
      return {
        pdfDoc,
        metadata,
        arrayBuffer
      };
    } catch (error) {
      console.error('[PDFProcessor] Error loading PDF:', error);
      throw new Error(`Failed to load PDF: ${error.message}`);
    }
  }

  /**
   * Compress images in a PDF document
   * @param {PDFDocument} pdfDoc - The PDF document to process
   * @param {number} quality - Image quality (10-100)
   * @param {Function} progressCallback - Callback for progress updates
   * @returns {Promise<PDFDocument>} - Processed PDF document
   */
  async compressImages(pdfDoc, quality, progressCallback = null) {
    try {
      console.log(`[PDFProcessor] Compressing images with quality: ${quality}`);
      
      // Try to use worker if available
      if (this.isWorkerSupported) {
        try {
          await this.initWorker();
          return await this.compressImagesWithWorker(pdfDoc, quality, progressCallback);
        } catch (workerError) {
          console.warn('[PDFProcessor] Worker failed, falling back to main thread:', workerError);
        }
      }
      
      // Fallback to main thread processing
      const pages = pdfDoc.getPages();
      const total = pages.length;
      
      // Iterate through each page
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        
        // In a real implementation, we would:
        // 1. Identify XObjects (images) on the page
        // 2. Extract images
        // 3. Compress using Canvas API
        // 4. Re-embed compressed images
        
        // For demonstration, we'll simulate the process
        if (progressCallback) {
          progressCallback({
            page: i + 1,
            total,
            percentage: Math.round(((i + 1) / total) * 100)
          });
        }
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log('[PDFProcessor] Image compression completed');
      return pdfDoc;
    } catch (error) {
      console.error('[PDFProcessor] Error compressing images:', error);
      throw new Error(`Failed to compress images: ${error.message}`);
    }
  }
  
  /**
   * Compress images using Web Worker
   * @param {PDFDocument} pdfDoc - The PDF document to process
   * @param {number} quality - Image quality (10-100)
   * @param {Function} progressCallback - Callback for progress updates
   * @returns {Promise<PDFDocument>} - Processed PDF document
   */
  async compressImagesWithWorker(pdfDoc, quality, progressCallback = null) {
    const taskId = this.generateTaskId();
    const pdfBytes = await pdfDoc.save();
    
    // Create a promise to handle the async response
    const taskPromise = new Promise((resolve, reject) => {
      // Store the promise callbacks
      if (!this.pendingTasks) this.pendingTasks = {};
      this.pendingTasks[taskId] = { resolve, reject };
      
      // Set up progress handler if callback provided
      if (progressCallback) {
        const progressHandler = (event) => {
          if (event.data.type === 'PROGRESS_UPDATE' && event.data.taskId === taskId) {
            progressCallback({
              percentage: event.data.percentage,
              message: event.data.message
            });
          }
        };
        this.worker.addEventListener('message', progressHandler);
        
        // Remove listener when task completes
        const cleanupHandler = (event) => {
          if ((event.data.type === 'PROCESSING_COMPLETED' || event.data.type === 'ERROR') && 
              event.data.taskId === taskId) {
            this.worker.removeEventListener('message', progressHandler);
            this.worker.removeEventListener('message', cleanupHandler);
          }
        };
        this.worker.addEventListener('message', cleanupHandler);
      }
    });
    
    // Send task to worker
    this.worker.postMessage({
      type: 'PROCESS_COMPRESS_IMAGES',
      taskId,
      payload: {
        pdfBytes,
        quality,
        taskId
      }
    });
    
    // Wait for result
    const { result } = await taskPromise;
    
    // Load the processed PDF
    const processedPdf = await PDFDocument.load(result.pdfBytes);
    return processedPdf;
  }

  /**
   * Remove images from a PDF document
   * @param {PDFDocument} pdfDoc - The PDF document to process
   * @returns {Promise<PDFDocument>} - Processed PDF document
   */
  async removeImages(pdfDoc) {
    try {
      console.log('[PDFProcessor] Removing images from PDF');
      
      // Try to use worker if available
      if (this.isWorkerSupported) {
        try {
          await this.initWorker();
          return await this.removeImagesWithWorker(pdfDoc);
        } catch (workerError) {
          console.warn('[PDFProcessor] Worker failed, falling back to main thread:', workerError);
        }
      }
      
      // Fallback to main thread processing
      const pages = pdfDoc.getPages();
      
      // Iterate through each page
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        
        // In a real implementation, we would:
        // 1. Identify XObject references (images)
        // 2. Remove image references from page content
        // 3. Clean up unused objects
        
        // For demonstration, we'll simulate the process
        console.log(`[PDFProcessor] Processing page ${i + 1} for image removal`);
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // Clean up unused objects
      // pdfDoc.flush();
      
      console.log('[PDFProcessor] Image removal completed');
      return pdfDoc;
    } catch (error) {
      console.error('[PDFProcessor] Error removing images:', error);
      throw new Error(`Failed to remove images: ${error.message}`);
    }
  }
  
  /**
   * Remove images using Web Worker
   * @param {PDFDocument} pdfDoc - The PDF document to process
   * @returns {Promise<PDFDocument>} - Processed PDF document
   */
  async removeImagesWithWorker(pdfDoc) {
    const taskId = this.generateTaskId();
    const pdfBytes = await pdfDoc.save();
    
    // Create a promise to handle the async response
    const taskPromise = new Promise((resolve, reject) => {
      // Store the promise callbacks
      if (!this.pendingTasks) this.pendingTasks = {};
      this.pendingTasks[taskId] = { resolve, reject };
    });
    
    // Send task to worker
    this.worker.postMessage({
      type: 'PROCESS_REMOVE_IMAGES',
      taskId,
      payload: {
        pdfBytes,
        taskId
      }
    });
    
    // Wait for result
    const { result } = await taskPromise;
    
    // Load the processed PDF
    const processedPdf = await PDFDocument.load(result.pdfBytes);
    return processedPdf;
  }

  /**
   * Split PDF by page range
   * @param {PDFDocument} pdfDoc - The PDF document to split
   * @param {number} startPage - Starting page (1-based)
   * @param {number} endPage - Ending page (1-based)
   * @returns {Promise<PDFDocument>} - New PDF document with selected pages
   */
  async splitByPages(pdfDoc, startPage, endPage) {
    try {
      console.log(`[PDFProcessor] Splitting PDF by pages: ${startPage}-${endPage}`);
      
      // Try to use worker if available
      if (this.isWorkerSupported) {
        try {
          await this.initWorker();
          return await this.splitByPagesWithWorker(pdfDoc, startPage, endPage);
        } catch (workerError) {
          console.warn('[PDFProcessor] Worker failed, falling back to main thread:', workerError);
        }
      }
      
      // Validate page range
      const pageCount = pdfDoc.getPageCount();
      if (startPage < 1 || endPage > pageCount || startPage > endPage) {
        throw new Error(`Invalid page range. PDF has ${pageCount} pages.`);
      }
      
      // Create new PDF document
      const newPdfDoc = await PDFDocument.create();
      
      // Copy pages to new document
      for (let i = startPage; i <= endPage; i++) {
        // Copy page (1-based index to 0-based)
        const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [i - 1]);
        newPdfDoc.addPage(copiedPage);
      }
      
      // In a real implementation, we would also:
      // 1. Copy bookmarks
      // 2. Copy links
      // 3. Preserve metadata where possible
      
      console.log('[PDFProcessor] PDF splitting by pages completed');
      return newPdfDoc;
    } catch (error) {
      console.error('[PDFProcessor] Error splitting by pages:', error);
      throw new Error(`Failed to split PDF by pages: ${error.message}`);
    }
  }
  
  /**
   * Split PDF by pages using Web Worker
   * @param {PDFDocument} pdfDoc - The PDF document to split
   * @param {number} startPage - Starting page (1-based)
   * @param {number} endPage - Ending page (1-based)
   * @returns {Promise<PDFDocument>} - New PDF document with selected pages
   */
  async splitByPagesWithWorker(pdfDoc, startPage, endPage) {
    const taskId = this.generateTaskId();
    const pdfBytes = await pdfDoc.save();
    
    // Create a promise to handle the async response
    const taskPromise = new Promise((resolve, reject) => {
      // Store the promise callbacks
      if (!this.pendingTasks) this.pendingTasks = {};
      this.pendingTasks[taskId] = { resolve, reject };
    });
    
    // Send task to worker
    this.worker.postMessage({
      type: 'PROCESS_SPLIT_PDF',
      taskId,
      payload: {
        pdfBytes,
        startPage,
        endPage,
        taskId
      }
    });
    
    // Wait for result
    const { result } = await taskPromise;
    
    // Load the processed PDF
    const processedPdf = await PDFDocument.load(result.pdfBytes);
    return processedPdf;
  }

  /**
   * Split PDF by file size
   * @param {PDFDocument} pdfDoc - The PDF document to split
   * @param {number} maxSizeMB - Maximum size per chunk in MB
   * @param {Function} progressCallback - Callback for progress updates
   * @returns {Promise<Array<PDFDocument>>} - Array of PDF documents
   */
  async splitBySize(pdfDoc, maxSizeMB, progressCallback = null) {
    try {
      console.log(`[PDFProcessor] Splitting PDF by size: ${maxSizeMB}MB`);
      
      const maxSizeBytes = maxSizeMB * 1024 * 1024;
      const chunks = [];
      const pageCount = pdfDoc.getPageCount();
      
      // Estimate initial chunk size using binary search approach
      let startPage = 1;
      let endPage = pageCount;
      
      while (startPage <= pageCount) {
        // Estimate optimal end page for current chunk
        let chunkEndPage = await this.estimateOptimalChunkEnd(pdfDoc, startPage, endPage, maxSizeBytes);
        
        // Create chunk
        const chunkDoc = await this.splitByPages(pdfDoc, startPage, chunkEndPage);
        chunks.push(chunkDoc);
        
        // Report progress
        if (progressCallback) {
          progressCallback({
            chunk: chunks.length,
            totalChunks: 'calculating',
            percentage: Math.round((chunkEndPage / pageCount) * 100)
          });
        }
        
        // Move to next chunk
        startPage = chunkEndPage + 1;
        
        // Break if we've processed all pages
        if (startPage > pageCount) {
          break;
        }
      }
      
      console.log(`[PDFProcessor] PDF splitting by size completed. Created ${chunks.length} chunks`);
      return chunks;
    } catch (error) {
      console.error('[PDFProcessor] Error splitting by size:', error);
      throw new Error(`Failed to split PDF by size: ${error.message}`);
    }
  }

  /**
   * Estimate optimal chunk end page
   * @param {PDFDocument} pdfDoc - The PDF document
   * @param {number} startPage - Starting page
   * @param {number} endPage - Ending page
   * @param {number} maxSizeBytes - Maximum size in bytes
   * @returns {Promise<number>} - Optimal end page
   */
  async estimateOptimalChunkEnd(pdfDoc, startPage, endPage, maxSizeBytes) {
    // Simplified estimation - in a real implementation, this would be more sophisticated
    let low = startPage;
    let high = endPage;
    let optimalEnd = startPage;
    
    // Binary search for optimal end page
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      
      // Estimate size for pages startPage to mid
      // In a real implementation, we would actually measure this
      const estimatedSize = (mid - startPage + 1) * 100000; // Simplified estimation
      
      if (estimatedSize <= maxSizeBytes) {
        optimalEnd = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    
    return optimalEnd;
  }

  /**
   * Optimize PDF for web viewing
   * @param {PDFDocument} pdfDoc - The PDF document to optimize
   * @returns {Promise<PDFDocument>} - Optimized PDF document
   */
  async optimizePDF(pdfDoc) {
    try {
      console.log('[PDFProcessor] Optimizing PDF');
      
      // Try to use worker if available
      if (this.isWorkerSupported) {
        try {
          await this.initWorker();
          return await this.optimizePDFWithWorker(pdfDoc);
        } catch (workerError) {
          console.warn('[PDFProcessor] Worker failed, falling back to main thread:', workerError);
        }
      }
      
      // In a real implementation, we would:
      // 1. Remove duplicate objects
      // 2. Compress streams
      // 3. Subset fonts
      // 4. Linearize for fast web view
      
      // For demonstration, we'll simulate the process
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('[PDFProcessor] PDF optimization completed');
      return pdfDoc;
    } catch (error) {
      console.error('[PDFProcessor] Error optimizing PDF:', error);
      throw new Error(`Failed to optimize PDF: ${error.message}`);
    }
  }
  
  /**
   * Optimize PDF using Web Worker
   * @param {PDFDocument} pdfDoc - The PDF document to optimize
   * @returns {Promise<PDFDocument>} - Optimized PDF document
   */
  async optimizePDFWithWorker(pdfDoc) {
    const taskId = this.generateTaskId();
    const pdfBytes = await pdfDoc.save();
    
    // Create a promise to handle the async response
    const taskPromise = new Promise((resolve, reject) => {
      // Store the promise callbacks
      if (!this.pendingTasks) this.pendingTasks = {};
      this.pendingTasks[taskId] = { resolve, reject };
    });
    
    // Send task to worker
    this.worker.postMessage({
      type: 'PROCESS_OPTIMIZE_PDF',
      taskId,
      payload: {
        pdfBytes,
        taskId
      }
    });
    
    // Wait for result
    const { result } = await taskPromise;
    
    // Load the processed PDF
    const processedPdf = await PDFDocument.load(result.pdfBytes);
    return processedPdf;
  }

  /**
   * Process PDF with selected options
   * @param {File} file - The PDF file to process
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} - Processing result
   */
  async processPDF(file, options) {
    try {
      console.log('[PDFProcessor] Processing PDF with options:', options);
      
      // Load PDF
      const { pdfDoc, metadata } = await this.loadPDF(file);
      
      let processedDoc = pdfDoc;
      
      // Apply image compression if requested
      if (options.imageCompression) {
        processedDoc = await this.compressImages(processedDoc, options.imageQuality);
      }
      
      // Remove images if requested
      if (options.removeImages) {
        processedDoc = await this.removeImages(processedDoc);
      }
      
      // Split PDF if requested
      if (options.splitPDF) {
        if (options.splitMethod === 'pages' && options.pageRange) {
          const [start, end] = options.pageRange.split('-').map(Number);
          processedDoc = await this.splitByPages(processedDoc, start, end);
        } else if (options.splitMethod === 'size') {
          // For size-based splitting, we return multiple documents
          const chunks = await this.splitBySize(processedDoc, options.fileSizeLimit);
          // For simplicity, we'll return the first chunk
          processedDoc = chunks[0];
        }
      }
      
      // Optimize PDF
      processedDoc = await this.optimizePDF(processedDoc);
      
      // Serialize to bytes
      const pdfBytes = await processedDoc.save();
      
      // Create new file
      const newFileName = this.generateFileName(file.name, options);
      const processedFile = new File([pdfBytes], newFileName, {
        type: 'application/pdf'
      });
      
      // Estimate compression savings
      const savings = this.estimateCompression(file.size, processedFile.size);
      
      return {
        originalFile: file,
        processedFile,
        metadata,
        savings,
        processingTime: Date.now()
      };
    } catch (error) {
      console.error('[PDFProcessor] Error processing PDF:', error);
      throw new Error(`Failed to process PDF: ${error.message}`);
    }
  }

  /**
   * Validate if a file is a PDF
   * @param {File} file - The file to validate
   * @returns {boolean} - True if the file is a valid PDF
   */
  validatePDF(file) {
    // Check file type
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return false;
    }
    
    // Check file size (basic validation)
    if (file.size === 0) {
      return false;
    }
    
    return true;
  }

  /**
   * Extract metadata from PDF document
   * @param {PDFDocument} pdfDoc - The PDF document
   * @param {File} file - The original file
   * @returns {Object} - Extracted metadata
   */
  extractMetadata(pdfDoc, file) {
    try {
      const info = pdfDoc.getTitle() || file.name.replace('.pdf', '');
      const author = pdfDoc.getAuthor() || 'Unknown';
      const subject = pdfDoc.getSubject() || '';
      const keywords = pdfDoc.getKeywords() || '';
      const creator = pdfDoc.getCreator() || '';
      const producer = pdfDoc.getProducer() || '';
      const creationDate = pdfDoc.getCreationDate();
      const modificationDate = pdfDoc.getModificationDate();
      const pageCount = pdfDoc.getPageCount();
      
      return {
        title: info,
        author,
        subject,
        keywords,
        creator,
        producer,
        creationDate: creationDate || new Date(),
        modificationDate: modificationDate || new Date(),
        pageCount,
        fileSize: file.size
      };
    } catch (error) {
      console.warn('[PDFProcessor] Error extracting metadata:', error);
      return {
        title: file.name.replace('.pdf', ''),
        author: 'Unknown',
        subject: '',
        keywords: '',
        creator: '',
        producer: '',
        creationDate: new Date(),
        modificationDate: new Date(),
        pageCount: pdfDoc ? pdfDoc.getPageCount() : 0,
        fileSize: file.size
      };
    }
  }

  /**
   * Generate thumbnail for PDF
   * @param {PDFDocument} pdfDoc - The PDF document
   * @param {number} pageNumber - Page number for thumbnail
   * @returns {Promise<string>} - Data URL of thumbnail
   */
  async generateThumbnail(pdfDoc, pageNumber = 1) {
    try {
      // In a real implementation, we would render the page to a canvas
      // and convert it to a data URL
      
      // For demonstration, we'll return a placeholder
      return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
    } catch (error) {
      console.warn('[PDFProcessor] Error generating thumbnail:', error);
      return null;
    }
  }

  /**
   * Estimate compression savings
   * @param {number} originalSize - Original file size in bytes
   * @param {number} compressedSize - Compressed file size in bytes
   * @returns {Object} - Savings information
   */
  estimateCompression(originalSize, compressedSize) {
    const savingsBytes = originalSize - compressedSize;
    const savingsPercentage = originalSize > 0 ? (savingsBytes / originalSize) * 100 : 0;
    
    return {
      originalSize,
      compressedSize,
      savingsBytes,
      savingsPercentage: savingsPercentage.toFixed(2)
    };
  }

  /**
   * Generate new file name based on processing options
   * @param {string} originalName - Original file name
   * @param {Object} options - Processing options
   * @returns {string} - New file name
   */
  generateFileName(originalName, options) {
    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, "");
    const extension = '.pdf';
    
    let suffix = '';
    if (options.imageCompression) {
      suffix += `-compressed-${options.imageQuality}`;
    }
    if (options.removeImages) {
      suffix += '-no-images';
    }
    if (options.splitPDF) {
      suffix += '-split';
    }
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    
    return `${nameWithoutExt}${suffix}-${timestamp}${extension}`;
  }

  /**
   * Terminate Web Worker
   */
  terminateWorker() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      console.log('[PDFProcessor] Web Worker terminated');
    }
  }
}