import { UIController } from './ui-controller.js';
import { PDFProcessor } from './pdf-processor.js';
import { StorageManager } from './storage-manager.js';

// Initialize storage manager
const storageManager = new StorageManager();

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
      
      // Load external libraries
      await this.loadLibraries();
      
      // Initialize core components
      this.pdfProcessor = new PDFProcessor();
      this.storageManager = storageManager;
      await this.storageManager.init();
      this.uiController = new UIController();
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Register service worker for PWA functionality
      await this.registerServiceWorker();
      
      // Setup PWA features
      this.setupPWAFeatures();
      
      // Handle file sharing if launched from share target
      this.handleShareTarget();
      
      // Handle file opening if launched from file handler
      this.handleFileHandler();
      
      console.log('[PDFCompressor] Application initialized successfully');
    } catch (error) {
      console.error('[PDFCompressor] Initialization error:', error);
      this.showErrorMessage('Failed to initialize application: ' + error.message);
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
   * Load external libraries dynamically
   */
  async loadLibraries() {
    try {
      console.log('[PDFCompressor] Loading external libraries...');
      
      // In a real implementation, we might load libraries dynamically
      // For now, we're relying on the CDN scripts in index.html
      // But we could implement dynamic loading like this:
      /*
      const pdfLibScript = document.createElement('script');
      pdfLibScript.src = 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
      document.head.appendChild(pdfLibScript);
      
      const pdfJsScript = document.createElement('script');
      pdfJsScript.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.4.120/build/pdf.min.js';
      document.head.appendChild(pdfJsScript);
      */
      
      console.log('[PDFCompressor] Libraries loaded');
    } catch (error) {
      console.error('[PDFCompressor] Error loading libraries:', error);
      throw new Error('Failed to load required libraries');
    }
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
   * Handle file selection (drag and drop or file input)
   * @param {File} file - The selected file
   */
  async handleFileSelection(file) {
    try {
      // Validate file
      if (!this.validateFile(file)) {
        return;
      }
      
      // Set current file in state
      this.state.currentFile = file;
      
      // Load PDF document
      const result = await this.pdfProcessor.loadPDF(file);
      this.state.pdfDocument = result.pdfDoc;
      
      // Show file info in UI
      this.uiController.showFileInfo(result.metadata);
      
      console.log(`[PDFCompressor] File loaded: ${file.name}`);
    } catch (error) {
      console.error('[PDFCompressor] Error handling file:', error);
      this.showErrorMessage('Error loading file: ' + error.message);
    }
  }

  /**
   * Validate selected file
   * @param {File} file - The file to validate
   * @returns {boolean} True if file is valid
   */
  validateFile(file) {
    // Check file type
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      this.showErrorMessage('Please select a valid PDF file');
      return false;
    }
    
    // Check file size (max 500MB)
    const maxSize = 500 * 1024 * 1024; // 500MB in bytes
    if (file.size > maxSize) {
      this.showErrorMessage(`File size exceeds 500MB limit. Selected file: ${this.formatFileSize(file.size)}`);
      return false;
    }
    
    return true;
  }

  /**
   * Process the current PDF with selected options
   */
  async processPDF() {
    if (!this.state.currentFile || !this.state.pdfDocument) {
      this.showErrorMessage('No PDF file selected');
      return;
    }
    
    try {
      this.state.isProcessing = true;
      
      // Start performance tracking
      this.startPerformanceTracking();
      
      // Process PDF based on options
      const result = await this.pdfProcessor.processPDF(
        this.state.currentFile,
        this.state.processingOptions
      );
      
      // End performance tracking
      this.endPerformanceTracking();
      
      // Save result to storage
      await this.storageManager.saveResult(result);
      
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
  window.pdfCompressorApp = new PDFCompressorApp();
});

// Export for potential use in other modules
export { PDFCompressorApp };