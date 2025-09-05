// Loading indicators
window.showLoadingLibraries = function() {
  const loader = document.getElementById('library-loader');
  if (loader) loader.style.display = 'block';
};

window.hideLoadingLibraries = function() {
  const loader = document.getElementById('library-loader');
  if (loader) loader.style.display = 'none';
};

import { UIController } from './ui-controller.js';
import { createEngine } from './engine/index.js';
// Remove static imports of PDFProcessor and StorageManager since we'll load them dynamically
// import { PDFProcessor } from './pdf-processor.js';
// import { StorageManager } from './storage-manager.js';

// We'll initialize storage manager dynamically
let storageManager = null;

/**
 * PDF Compressor PWA - Main Application Class
 * Handles initialization, file processing, state management, and PWA features
 */
class PDFCompressorApp {
  /**
   * Constructor - Initialize app properties and start initialization
   */
  constructor() {
    // Core components
    this.pdfProcessor = null;
    this.storageManager = null;
    this.uiController = null;
    this.worker = null;
    this.engine = null;
    
    // Application state
    this.state = {
      currentFile: null,
      pdfDocument: null,
      processingOptions: {
        imageCompression: true,
        imageQuality: 70,
        removeImages: false,
        splitPDF: false,
        splitMethod: 'pages',
        pageRange: '',
        fileSizeLimit: 10
      },
      processingQueue: [],
      isOnline: navigator.onLine,
      isProcessing: false,
      isVisible: true
    };
    
    // PDF libraries loading state
    this.pdfLibrariesLoaded = false;
    
    // Performance tracking
    this.performance = {
      startTime: null,
      endTime: null,
      memoryUsage: null
    };
    
    // PWA features
    this.deferredPrompt = null;
    this.serviceWorkerRegistration = null;
    
    // Initialize the application
    this.initializeApp();
  }

  /**
   * Initialize the entire application
   * Checks API support, loads libraries, initializes components
   */
  async initializeApp() {
    try {
      console.log('[PDFCompressor] Initializing application...');
      
      // Check for required API support
      if (!this.checkAPISupport()) {
        throw new Error('Required APIs not supported in this browser');
      }
      
      // Setup basic UI first
      this.setupBasicUI();
      
      // Register service worker for PWA functionality
      await this.registerServiceWorker();
      
      // Setup PWA features
      this.setupPWAFeatures();
      
      // Handle file sharing if launched from share target
      this.handleShareTarget();
      
      // Handle file opening if launched from file handler
      this.handleFileHandler();
      
      // Setup lazy loading for PDF libraries
      this.setupLazyLoading();
      
      console.log('[PDFCompressor] Application initialized successfully');
    } catch (error) {
      console.error('[PDFCompressor] Initialization error:', error);
      this.showErrorMessage('Failed to initialize application: ' + error.message);
    }
  }

  /**
   * Setup basic UI components
   */
  setupBasicUI() {
    // Initialize UI controller
    this.uiController = new UIController();
    
    // Set reference to app in UI controller
    this.uiController.setApp(this);
    
    // Initialize processing engine (feature-flagged)
    this.engine = createEngine(this);
    
    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Setup lazy loading for PDF libraries
   */
  setupLazyLoading() {
    // Load libraries when user selects a file or drops a file
    const fileInput = document.getElementById('fileInput');
    const dropArea = document.getElementById('dropArea');
    
    const loadLibrariesOnce = async () => {
      if (!this.pdfLibrariesLoaded) {
        this.pdfLibrariesLoaded = await window.loadPDFLibraries();
        
        if (this.pdfLibrariesLoaded) {
          // Initialize PDF processor after loading libraries
          const { PDFProcessor } = await import('./pdf-processor.js');
          this.pdfProcessor = new PDFProcessor();
        }
      }
    };
    
    fileInput?.addEventListener('change', loadLibrariesOnce, { once: true });
    dropArea?.addEventListener('drop', loadLibrariesOnce, { once: true });
  }

  /**
   * Handle file selection (drag and drop or file input)
   * @param {File} file - The selected file
   */
  async handleFileSelection(file) {
    try {
      // Validate file
      if (!this.validateFile(file)) {
        return;
      }
      
      // Set current file in state and show basic info immediately
      this.state.currentFile = file;
      this.uiController.showFileInfo({
        fileName: file.name,
        fileSize: file.size,
        pageCount: 'Calculating...',
        imageCount: 'Analyzing...'
      });
      
      // Ensure PDF libraries are loaded (with graceful error)
      try {
        await this.ensurePDFLibrariesLoaded();
      } catch (e) {
        this.showErrorMessage(e.message || 'Nie można załadować bibliotek PDF.');
        return;
      }
      
      // Load PDF document and update detailed metadata
      const result = await this.pdfProcessor.loadPDF(file);
      this.state.pdfDocument = result.pdfDoc;
      this.uiController.showFileInfo(result.metadata);
      
      console.log(`[PDFCompressor] File loaded: ${file.name}`);
    } catch (error) {
      console.error('[PDFCompressor] Error handling file:', error);
      this.showErrorMessage('Error loading file: ' + error.message);
    }
  }

  /**
   * Validate selected file
   * @param {File} file
   * @returns {boolean}
   */
  validateFile(file) {
    if (!file) {
      this.showErrorMessage('Nie wybrano pliku.');
      return false;
    }
    // Only PDFs
    const isPdf = file.type === 'application/pdf' || (file.name && file.name.toLowerCase().endsWith('.pdf'));
    if (!isPdf) {
      this.showErrorMessage('Obsługiwane są tylko pliki PDF.');
      return false;
    }
    // Basic size checks (0 < size <= 500MB)
    const maxBytes = 500 * 1024 * 1024;
    if (file.size === 0) {
      this.showErrorMessage('Plik jest pusty (0 B).');
      return false;
    }
    if (file.size > maxBytes) {
      this.showErrorMessage('Plik jest zbyt duży. Maksymalny rozmiar to 500 MB.');
      return false;
    }
    return true;
  }

  /**
   * Ensure PDF libraries are loaded
   */
  async ensurePDFLibrariesLoaded() {
    if (!this.pdfLibrariesLoaded) {
      this.pdfLibrariesLoaded = await window.loadPDFLibraries();
      
      if (!this.pdfLibrariesLoaded) {
        throw new Error('Nie można załadować bibliotek PDF. Sprawdź połączenie internetowe.');
      }
      
      // Dynamically import PDF processor
      const { PDFProcessor } = await import('./pdf-processor.js');
      this.pdfProcessor = new PDFProcessor();
    }
  }

  /**
   * Process the current PDF with selected options
   */
  async processPDF() {
    try {
      // Ensure there is a file selected
      if (!this.state.currentFile) {
        this.showErrorMessage('No PDF file selected');
        return;
      }
      
      // If PDF not yet parsed, load it now
      if (!this.state.pdfDocument) {
        await this.ensurePDFLibrariesLoaded();
        const result = await this.pdfProcessor.loadPDF(this.state.currentFile);
        this.state.pdfDocument = result.pdfDoc;
        // Update UI with detailed metadata (page count, etc.)
        this.uiController.showFileInfo(result.metadata);
      }
      
      // Ensure libraries are loaded (idempotent)
      await this.ensurePDFLibrariesLoaded();
      
      this.state.isProcessing = true;
      
      // Start performance tracking
      this.startPerformanceTracking();
      
      // Show progress UI
      this.uiController.showProgress();
      
      // Hook progress callback
      const progressCallback = (p) => {
        const percent = typeof p === 'number' ? p : (p && p.percentage) || 0;
        const message = (p && p.message) || `Processing... ${percent}%`;
        this.uiController.updateProgress(percent, message);
      };
      
      // Process PDF via engine
      const result = await this.engine.process(
        this.state.currentFile,
        this.state.processingOptions,
        progressCallback
      );
      
      // Validate result
      if (!result || !result.processedFile) {
        throw new Error('PDF processing returned invalid result');
      }
      
      // Validate file sizes
      if (result.processedFile.size === 0) {
        throw new Error('Processed file is empty (0 bytes)');
      }
      
      // End performance tracking
      this.endPerformanceTracking();
      
      // Get storage manager (load dynamically if needed)
      const storageManager = await this.getStorageManager();
      
      // Save result to storage
      await storageManager.saveResult(result);
      
      // Show results in UI
      this.uiController.showResults(result);
      
      this.state.isProcessing = false;
    } catch (error) {
      this.state.isProcessing = false;
      console.error('[PDFCompressor] Error processing PDF:', error);
      this.showErrorMessage('Error processing PDF: ' + error.message);
    }
  }

  /**
   * Dynamic import for storage manager
   */
  async getStorageManager() {
    if (!this.storageManager) {
      const { StorageManager } = await import(
        /* webpackChunkName: "storage" */
        './storage-manager.js'
      );
      this.storageManager = new StorageManager();
      await this.storageManager.init();
    }
    return this.storageManager;
  }

  /**
   * Dynamic import for Web Worker
   */
  async loadWorker() {
    if (!this.worker) {
      const { PDFWorker } = await import(
        /* webpackChunkName: "pdf-worker" */
        './pdf-worker.js'
      );
      this.worker = new PDFWorker();
    }
    return this.worker;
  }

  /**
   * Load PDF libraries dynamically when needed
   */
  async loadPDFLibraries() {
    try {
      console.log('[PDFCompressor] Loading PDF libraries...');
      
      // Check if libraries are already available globally
      if (typeof window.PDFLib !== 'undefined' && typeof window.pdfjsLib !== 'undefined') {
        console.log('[PDFCompressor] PDF libraries already loaded from CDN');
        return { 
          PDFDocument: window.PDFLib.PDFDocument, 
          rgb: window.PDFLib.rgb,
          pdfjsLib: window.pdfjsLib
        };
      }
      
      // If not available, we could load them dynamically
      // But in this case, we're relying on the CDN scripts in index.html
      console.log('[PDFCompressor] PDF libraries should be loaded from CDN');
      return null;
    } catch (error) {
      console.error('[PDFCompressor] Error accessing PDF libraries:', error);
      throw new Error('Failed to access PDF processing libraries');
    }
  }

  /**
   * Check if required APIs are supported
   * @returns {boolean} True if all required APIs are supported
   */
  checkAPISupport() {
    const requiredAPIs = [
      'File',
      'Blob',
      'ArrayBuffer',
      'Worker',
      'indexedDB',
      'caches'
    ];
    
    for (const api of requiredAPIs) {
      if (!(api in window)) {
        console.error(`[PDFCompressor] Required API not supported: ${api}`);
        return false;
      }
    }
    
    // Check for File API specific methods
    if (!window.FileReader || !window.FileList) {
      console.error('[PDFCompressor] File API not fully supported');
      return false;
    }
    
    // Check for Blob API specific methods
    if (!window.Blob || !Blob.prototype.arrayBuffer) {
      console.error('[PDFCompressor] Blob API not fully supported');
      return false;
    }
    
    console.log('[PDFCompressor] All required APIs supported');
    return true;
  }

  /**
   * Register service worker for PWA functionality
   */
  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        this.serviceWorkerRegistration = await navigator.serviceWorker.register('./service-worker.js');
        console.log('[PDFCompressor] Service Worker registered:', this.serviceWorkerRegistration);
        
        // Listen for updates
        this.serviceWorkerRegistration.addEventListener('updatefound', () => {
          console.log('[PDFCompressor] Service Worker update found');
          this.showUpdateNotification();
        });
      } catch (error) {
        console.error('[PDFCompressor] Service Worker registration failed:', error);
      }
    } else {
      console.warn('[PDFCompressor] Service Worker not supported');
    }
  }

  /**
   * Setup event listeners for the application
   */
  setupEventListeners() {
    // DOM Content Loaded
    document.addEventListener('DOMContentLoaded', () => {
      console.log('[PDFCompressor] DOM Content Loaded');
    });
    
    // Online/Offline events
    window.addEventListener('online', () => {
      console.log('[PDFCompressor] Online');
      this.state.isOnline = true;
      this.updateOnlineStatus();
    });
    
    window.addEventListener('offline', () => {
      console.log('[PDFCompressor] Offline');
      this.state.isOnline = false;
      this.updateOnlineStatus();
    });
    
    // Window resize for responsive UI
    window.addEventListener('resize', this.debounce(() => {
      console.log('[PDFCompressor] Window resized');
      // Trigger UI updates if needed
    }, 250));
    
    // Visibility change for pause/resume
    document.addEventListener('visibilitychange', () => {
      this.state.isVisible = !document.hidden;
      console.log(`[PDFCompressor] Visibility changed: ${this.state.isVisible ? 'visible' : 'hidden'}`);
      
      // Pause/resume processing if needed
      if (this.state.isProcessing) {
        if (this.state.isVisible) {
          console.log('[PDFCompressor] Resuming processing');
        } else {
          console.log('[PDFCompressor] Pausing processing');
        }
      }
    });
  }

  /**
/**
   * Setup PWA features
   */
  setupPWAFeatures() {
    // Install prompt handling
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('[PDFCompressor] Install prompt available');
      e.preventDefault();
      this.deferredPrompt = e;
      this.uiController.showInstallPrompt();
    });
    
    // Handle app installed event
    window.addEventListener('appinstalled', () => {
      console.log('[PDFCompressor] App installed');
      this.uiController.hideInstallPrompt();
    });
  }

  /**
   * Handle files shared via Web Share Target API
   */
  handleShareTarget() {
    // Check if launched from share target
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    
    if (action === 'share') {
      console.log('[PDFCompressor] Launched from share target');
      // Handle shared files - would need server-side processing
      // or use the Share Target API with POST requests
    }
  }

  /**
   * Handle files opened via File Handler API
   */
  handleFileHandler() {
    // Check if launched from file handler
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    
    if (action === 'open') {
      console.log('[PDFCompressor] Launched from file handler');
      // Handle opened files - would need server-side processing
    }
  }

  /**
   * Show install prompt for PWA
   */
  showInstallPrompt() {
    this.uiController.showInstallPrompt();
  }

  /**
   * Hide install prompt
   */
  hideInstallPrompt() {
    this.uiController.hideInstallPrompt();
  }

  /**
   * Show update notification
   */
  showUpdateNotification() {
    // In a real implementation, we would show a notification
    // that a new version is available
    this.uiController.showUpdateAvailable();
    console.log('[PDFCompressor] New version available - please refresh');
  }

  /**
   * Update online status UI
   */
  updateOnlineStatus() {
    if (this.state.isOnline) {
      this.uiController.hideOfflineMode();
    } else {
      this.uiController.showOfflineMode();
    }
  }

  /**
   * Start performance tracking
   */
  startPerformanceTracking() {
    this.performance.startTime = performance.now();
    performance.mark('processing-start');
  }

  /**
   * End performance tracking
   */
  endPerformanceTracking() {
    this.performance.endTime = performance.now();
    performance.mark('processing-end');
    performance.measure('processing-duration', 'processing-start', 'processing-end');
    
    const duration = this.performance.endTime - this.performance.startTime;
    console.log(`[PDFCompressor] Processing completed in ${duration.toFixed(2)}ms`);
  }

  /**
   * Show processing results
   * @param {Object} result - Processing result
   */
  showProcessingResults(result) {
    this.uiController.showResults(result);
  }

  /**
   * Show error message to user
   * @param {string} message - Error message to display
   */
  showErrorMessage(message) {
    // Show error in UI
    this.uiController.showNotification(message, 'error');
    console.error('[PDFCompressor] Error:', message);
  }

  /**
   * Format file size for display
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted file size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Generate a new file name based on original and processing options
   * @param {string} originalName - Original file name
   * @param {Object} options - Processing options
   * @returns {string} New file name
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
   * Debounce function to limit rate of function execution
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in milliseconds
   * @returns {Function} Debounced function
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Throttle function to limit rate of function execution
   * @param {Function} func - Function to throttle
   * @param {number} limit - Limit time in milliseconds
   * @returns {Function} Throttled function
   */
  throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Update processing options
   * @param {Object} options - New options
   */
  updateProcessingOptions(options) {
    this.state.processingOptions = { ...this.state.processingOptions, ...options };
    console.log('[PDFCompressor] Processing options updated:', this.state.processingOptions);
  }

  /**
   * Add task to processing queue
   * @param {Object} task - Task to add
   */
  addToQueue(task) {
    this.state.processingQueue.push(task);
    console.log(`[PDFCompressor] Task added to queue. Queue length: ${this.state.processingQueue.length}`);
  }

  /**
   * Process next task in queue
   */
  async processNextInQueue() {
    if (this.state.processingQueue.length > 0) {
      const task = this.state.processingQueue.shift();
      console.log('[PDFCompressor] Processing next task in queue');
      // Process task
    }
  }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('[PDFCompressor] DOM Content Loaded, initializing app...');
  window.pdfCompressorApp = new PDFCompressorApp();
  console.log('[PDFCompressor] App initialized:', window.pdfCompressorApp);
});

// Export for potential use in other modules
export { PDFCompressorApp };