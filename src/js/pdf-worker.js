// pdf-worker.js - Web Worker for PDF processing operations
// This worker handles heavy PDF processing tasks off the main thread

/**
 * Web Worker for PDF processing
 * 
 * Threading considerations:
 * - Workers run in separate threads from the main UI thread
 * - They have no access to DOM, window, or document objects
 * - Communication is done via postMessage and onmessage
 * - Heavy operations won't block the main thread
 * - Limited access to some Web APIs (no localStorage, sessionStorage)
 * 
 * Worker limitations:
 * - No direct access to IndexedDB (must communicate with main thread)
 * - Cannot access parent or window objects
 * - Cannot load external scripts with import statements (use importScripts)
 * - Limited access to some browser features
 */

// State management
let isProcessing = false;
let currentTaskId = null;
let taskQueue = [];
let workerId = `worker-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

// Performance tracking
let startTime = null;
let processedChunks = 0;
let totalChunks = 0;

// Load required libraries
try {
  // Import pdf-lib - in a worker, we use importScripts instead of import
  // Note: The path needs to be relative to the worker file location
  importScripts('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js');
  console.log('[PDFWorker] pdf-lib loaded successfully');
} catch (error) {
  console.error('[PDFWorker] Failed to load pdf-lib:', error);
  postMessage({
    type: 'ERROR',
    error: 'Failed to load required libraries',
    details: error.message
  });
}

// === MESSAGE HANDLING ===

/**
 * Handle incoming messages from the main thread
 * @param {MessageEvent} event - The message event
 */
self.onmessage = function(event) {
  const { type, payload, taskId } = event.data;
  
  try {
    switch (type) {
      case 'PROCESS_COMPRESS_IMAGES':
        queueTask('compressImagesInWorker', payload, taskId);
        break;
        
      case 'PROCESS_REMOVE_IMAGES':
        queueTask('removeImagesInWorker', payload, taskId);
        break;
        
      case 'PROCESS_SPLIT_PDF':
        queueTask('splitPDFInWorker', payload, taskId);
        break;
        
      case 'PROCESS_OPTIMIZE_PDF':
        queueTask('optimizePDFInWorker', payload, taskId);
        break;
        
      case 'CANCEL_TASK':
        cancelTask(taskId);
        break;
        
      case 'GET_STATUS':
        postMessage({
          type: 'STATUS_UPDATE',
          payload: {
            isProcessing,
            currentTaskId,
            queueLength: taskQueue.length,
            workerId
          }
        });
        break;
        
      default:
        postMessage({
          type: 'ERROR',
          error: `Unknown message type: ${type}`,
          taskId
        });
    }
  } catch (error) {
    handleError(error, taskId, type);
  }
};

// === TASK QUEUE MANAGEMENT ===

/**
 * Add a task to the processing queue
 * @param {string} functionName - Name of the function to call
 * @param {Object} payload - Task data
 * @param {string} taskId - Unique task identifier
 */
function queueTask(functionName, payload, taskId) {
  const task = {
    id: taskId || generateTaskId(),
    function: functionName,
    payload,
    priority: payload.priority || 0, // 0 = normal, 1 = high
    timestamp: Date.now()
  };
  
  // Add to queue based on priority
  if (task.priority > 0) {
    // High priority - add to front of queue
    taskQueue.unshift(task);
  } else {
    // Normal priority - add to end of queue
    taskQueue.push(task);
  }
  
  postMessage({
    type: 'TASK_QUEUED',
    taskId: task.id,
    functionName
  });
  
  // Start processing if not already processing
  if (!isProcessing) {
    processNextTask();
  }
}

/**
 * Process the next task in the queue
 */
async function processNextTask() {
  if (taskQueue.length === 0) {
    return;
  }
  
  // Sort queue by priority and timestamp
  taskQueue.sort((a, b) => {
    if (a.priority !== b.priority) {
      return b.priority - a.priority; // Higher priority first
    }
    return a.timestamp - b.timestamp; // Earlier tasks first
  });
  
  const task = taskQueue.shift();
  currentTaskId = task.id;
  isProcessing = true;
  
  postMessage({
    type: 'PROCESSING_STARTED',
    taskId: task.id,
    functionName: task.function
  });
  
  startTime = performance.now();
  processedChunks = 0;
  totalChunks = task.payload.totalChunks || 1;
  
  try {
    let result;
    
    // Route to appropriate function
    switch (task.function) {
      case 'compressImagesInWorker':
        result = await compressImagesInWorker(task.payload);
        break;
        
      case 'removeImagesInWorker':
        result = await removeImagesInWorker(task.payload);
        break;
        
      case 'splitPDFInWorker':
        result = await splitPDFInWorker(task.payload);
        break;
        
      case 'optimizePDFInWorker':
        result = await optimizePDFInWorker(task.payload);
        break;
        
      default:
        throw new Error(`Unknown function: ${task.function}`);
    }
    
    const endTime = performance.now();
    
    postMessage({
      type: 'PROCESSING_COMPLETED',
      taskId: task.id,
      result,
      performance: {
        duration: endTime - startTime,
        processedChunks,
        totalChunks
      }
    });
    
  } catch (error) {
    handleError(error, task.id, task.function);
  } finally {
    resetProcessingState();
    // Process next task if available
    setTimeout(processNextTask, 0);
  }
}

/**
 * Cancel a specific task
 * @param {string} taskId - Task to cancel
 */
function cancelTask(taskId) {
  // Check if it's the current task
  if (currentTaskId === taskId) {
    // We can't actually stop the current processing in most cases,
    // but we can mark it as cancelled for the main thread
    postMessage({
      type: 'TASK_CANCELLED',
      taskId
    });
    return;
  }
  
  // Remove from queue
  const initialLength = taskQueue.length;
  taskQueue = taskQueue.filter(task => task.id !== taskId);
  
  if (taskQueue.length < initialLength) {
    postMessage({
      type: 'TASK_CANCELLED',
      taskId
    });
  } else {
    postMessage({
      type: 'TASK_NOT_FOUND',
      taskId
    });
  }
}

// === PROCESSING FUNCTIONS ===

/**
 * Compress images in a PDF document
 * @param {Object} data - Processing data
 * @returns {Promise<Object>} - Processing result
 */
async function compressImagesInWorker(data) {
  try {
    const { pdfBytes, quality, taskId } = data;
    
    // Load PDF document
    reportProgress(taskId, 0, 'Loading PDF document');
    const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes, { 
      updateMetadata: false,
      parseSpeed: 'fast'
    });
    
    // Get all pages
    const pages = pdfDoc.getPages();
    totalChunks = pages.length;
    
    // Process each page
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      
      // In a real implementation, we would:
      // 1. Identify XObjects (images) on the page
      // 2. Extract images
      // 3. Compress using Canvas API
      // 4. Re-embed compressed images
      
      // For demonstration, we'll simulate the process
      reportProgress(taskId, ((i + 1) / pages.length) * 100, 
                    `Processing page ${i + 1} of ${pages.length}`);
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 50));
      
      processedChunks = i + 1;
    }
    
    // Save the modified PDF
    reportProgress(taskId, 90, 'Saving compressed PDF');
    const compressedBytes = await pdfDoc.save();
    
    // Return result using transferable objects for better performance
    return {
      pdfBytes: compressedBytes,
      originalSize: pdfBytes.byteLength,
      compressedSize: compressedBytes.byteLength,
      savings: pdfBytes.byteLength - compressedBytes.byteLength
    };
  } catch (error) {
    throw new Error(`Image compression failed: ${error.message}`);
  }
}

/**
 * Remove images from a PDF document
 * @param {Object} data - Processing data
 * @returns {Promise<Object>} - Processing result
 */
async function removeImagesInWorker(data) {
  try {
    const { pdfBytes, taskId } = data;
    
    // Load PDF document
    reportProgress(taskId, 0, 'Loading PDF document');
    const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
    
    // Get all pages
    const pages = pdfDoc.getPages();
    totalChunks = pages.length;
    
    // Process each page
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      
      // In a real implementation, we would:
      // 1. Identify XObject references (images)
      // 2. Remove image references from page content
      // 3. Clean up unused objects
      
      // For demonstration, we'll simulate the process
      reportProgress(taskId, ((i + 1) / pages.length) * 100, 
                    `Removing images from page ${i + 1} of ${pages.length}`);
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 30));
      
      processedChunks = i + 1;
    }
    
    // Clean up unused objects
    // pdfDoc.flush();
    
    // Save the modified PDF
    reportProgress(taskId, 90, 'Saving modified PDF');
    const modifiedBytes = await pdfDoc.save();
    
    return {
      pdfBytes: modifiedBytes,
      originalSize: pdfBytes.byteLength,
      modifiedSize: modifiedBytes.byteLength,
      savings: pdfBytes.byteLength - modifiedBytes.byteLength
    };
  } catch (error) {
    throw new Error(`Image removal failed: ${error.message}`);
  }
}

/**
 * Split PDF by page range
 * @param {Object} data - Processing data
 * @returns {Promise<Object>} - Processing result
 */
async function splitPDFInWorker(data) {
  try {
    const { pdfBytes, startPage, endPage, taskId } = data;
    
    // Load PDF document
    reportProgress(taskId, 0, 'Loading PDF document');
    const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
    
    // Validate page range
    const pageCount = pdfDoc.getPageCount();
    if (startPage < 1 || endPage > pageCount || startPage > endPage) {
      throw new Error(`Invalid page range. PDF has ${pageCount} pages.`);
    }
    
    // Create new PDF document
    reportProgress(taskId, 20, 'Creating new PDF document');
    const newPdfDoc = await PDFLib.PDFDocument.create();
    
    // Copy pages to new document
    for (let i = startPage; i <= endPage; i++) {
      reportProgress(taskId, 20 + ((i - startPage + 1) / (endPage - startPage + 1)) * 60,
                    `Copying page ${i} of ${pageCount}`);
      
      // Copy page (1-based index to 0-based)
      const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [i - 1]);
      newPdfDoc.addPage(copiedPage);
      
      processedChunks = i - startPage + 1;
      totalChunks = endPage - startPage + 1;
    }
    
    // Save the new PDF
    reportProgress(taskId, 90, 'Saving split PDF');
    const splitBytes = await newPdfDoc.save();
    
    return {
      pdfBytes: splitBytes,
      originalSize: pdfBytes.byteLength,
      splitSize: splitBytes.byteLength
    };
  } catch (error) {
    throw new Error(`PDF splitting failed: ${error.message}`);
  }
}

/**
 * Optimize PDF for web viewing
 * @param {Object} data - Processing data
 * @returns {Promise<Object>} - Processing result
 */
async function optimizePDFInWorker(data) {
  try {
    const { pdfBytes, taskId } = data;
    
    // Load PDF document
    reportProgress(taskId, 0, 'Loading PDF document');
    const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
    
    // In a real implementation, we would:
    // 1. Remove duplicate objects
    // 2. Compress streams
    // 3. Subset fonts
    // 4. Linearize for fast web view
    
    // For demonstration, we'll simulate the process
    reportProgress(taskId, 30, 'Optimizing PDF structure');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    reportProgress(taskId, 70, 'Compressing streams');
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Save the optimized PDF
    reportProgress(taskId, 90, 'Saving optimized PDF');
    const optimizedBytes = await pdfDoc.save();
    
    return {
      pdfBytes: optimizedBytes,
      originalSize: pdfBytes.byteLength,
      optimizedSize: optimizedBytes.byteLength,
      savings: pdfBytes.byteLength - optimizedBytes.byteLength
    };
  } catch (error) {
    throw new Error(`PDF optimization failed: ${error.message}`);
  }
}

// === PROGRESS REPORTING ===

/**
 * Report progress to the main thread
 * @param {string} taskId - Task identifier
 * @param {number} percentage - Progress percentage
 * @param {string} message - Progress message
 */
function reportProgress(taskId, percentage, message) {
  postMessage({
    type: 'PROGRESS_UPDATE',
    taskId,
    percentage: Math.min(100, Math.max(0, percentage)),
    message
  });
}

// === ERROR HANDLING ===

/**
 * Handle errors and report to main thread
 * @param {Error} error - The error that occurred
 * @param {string} taskId - Task identifier
 * @param {string} operation - Operation that failed
 */
function handleError(error, taskId, operation) {
  console.error(`[PDFWorker] Error in ${operation}:`, error);
  
  postMessage({
    type: 'ERROR',
    taskId,
    error: error.message,
    operation,
    stack: error.stack
  });
  
  resetProcessingState();
}

// === MEMORY MANAGEMENT ===

/**
 * Reset processing state and clean up
 */
function resetProcessingState() {
  isProcessing = false;
  currentTaskId = null;
  startTime = null;
  processedChunks = 0;
  totalChunks = 0;
  
  // Force garbage collection if available (not available in all browsers)
  if (self.gc) {
    self.gc();
  }
}

/**
 * Clean up resources
 */
function cleanup() {
  // Clear task queue
  taskQueue = [];
  
  // Reset state
  resetProcessingState();
  
  postMessage({
    type: 'WORKER_CLEANUP_COMPLETED'
  });
}

// === UTILITY FUNCTIONS ===

/**
 * Generate unique task ID
 * @returns {string} - Unique task ID
 */
function generateTaskId() {
  return `task-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

// Handle worker termination
self.onclose = function() {
  cleanup();
};

// Initial ready message
postMessage({
  type: 'WORKER_READY',
  workerId
});

console.log('[PDFWorker] Worker initialized and ready');