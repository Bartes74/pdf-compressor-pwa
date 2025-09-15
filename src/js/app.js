// Loading indicators
window.showLoadingLibraries = function () {
  const loader = document.getElementById('library-loader');
  if (loader) loader.style.display = 'block';
};

window.hideLoadingLibraries = function () {
  const loader = document.getElementById('library-loader');
  if (loader) loader.style.display = 'none';
};

import { UIController } from './ui-controller.js';
import { createEngine } from './engine/index.js';
// Remove static imports of PDFProcessor and StorageManager since we'll load them dynamically
// import { PDFProcessor } from './pdf-processor.js';
// import { StorageManager } from './storage-manager.js';

// We'll initialize storage manager dynamically
const storageManager = null; // kept as let for late dynamic init across modules

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
        fileSizeLimit: 10,
      },
      processingQueue: [],
      isOnline: navigator.onLine,
      isProcessing: false,
      isVisible: true,
    };

    // PDF libraries loading state
    this.pdfLibrariesLoaded = false;

    // Performance tracking
    this.performance = {
      startTime: null,
      endTime: null,
      memoryUsage: null,
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

      // Initialize storage early so IndexedDB is ready before any operations
      try {
        await this.getStorageManager();
      } catch (e) {
        console.warn('[PDFCompressor] Storage manager init warning:', e);
      }

      console.log('[PDFCompressor] Application initialized successfully');
    } catch (error) {
      console.error('[PDFCompressor] Initialization error:', error);
      this.showErrorMessage(
        'Failed to initialize application: ' + error.message
      );
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

    // Wire optional remove-images option in UI if present
    this.setupRemoveImagesOption();

    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Wire UI option to toggle removing images
   */
  setupRemoveImagesOption() {
    try {
      const removeToggle = document.getElementById('removeToggle');
      const removeOption = document.getElementById('removeOption');
      if (removeToggle && removeOption) {
        removeOption.addEventListener('click', () => {
          const next = !this.state.processingOptions.removeImages;
          this.updateProcessingOptions({
            removeImages: next,
            imageCompression: next
              ? false
              : this.state.processingOptions.imageCompression,
          });
          removeToggle.classList.toggle('active');
          const compressToggle = document.getElementById('compressToggle');
          if (next && compressToggle) compressToggle.classList.remove('active');
        });
      }
    } catch (e) {
      // Ignore if elements are not present
    }
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
        imageCount: 'Analyzing...',
      });
      // Enable Process button now that we have a valid file
      const processBtn = document.getElementById('processBtn');
      if (processBtn) processBtn.disabled = false;

      // Ensure PDF libraries are loaded (with graceful error)
      try {
        await this.ensurePDFLibrariesLoaded();
      } catch (e) {
        this.showErrorMessage(
          e.message || 'Nie można załadować bibliotek PDF.'
        );
        return;
      }

      // Load PDF document and update detailed metadata + estimate images
      const result = await this.pdfProcessor.loadPDF(file);
      this.state.pdfDocument = result.pdfDoc;
      // Estimate images asynchronously and update UI when ready
      let imageCount = '0';
      try {
        imageCount = String(
          await this.pdfProcessor.estimateTotalImages(result.pdfDoc)
        );
      } catch (e) {
        /* noop: image estimation is best-effort */
      }
      this.uiController.showFileInfo({ ...result.metadata, imageCount });
      // Keep Process button enabled after metadata is loaded
      if (processBtn) processBtn.disabled = false;

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
    const isPdf =
      file.type === 'application/pdf' ||
      (file.name && file.name.toLowerCase().endsWith('.pdf'));
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
      this.showErrorMessage(
        'Plik jest zbyt duży. Maksymalny rozmiar to 500 MB.'
      );
      return false;
    }
    return true;
  }

  /**
   * Ensure PDF libraries are loaded
   */
  async ensurePDFLibrariesLoaded() {
    if (!this.pdfLibrariesLoaded) {
      // Desktop: użyj lokalnych modułów zamiast CDN
      if (typeof window !== 'undefined' && window.desktop) {
        const pdfLibModule = await import('pdf-lib');
        // Wyrównaj do formatu używanego w reszcie aplikacji
        window.PDFLib = pdfLibModule;
        this.pdfLibrariesLoaded = true;
        const { PDFProcessor } = await import('./pdf-processor.js');
        this.pdfProcessor = new PDFProcessor();
        return;
      }
      // Przeglądarka: CDN loader
      this.pdfLibrariesLoaded = await window.loadPDFLibraries();
      if (!this.pdfLibrariesLoaded) {
        throw new Error(
          'Nie można załadować bibliotek PDF. Sprawdź połączenie internetowe.'
        );
      }
      const { PDFProcessor } = await import('./pdf-processor.js');
      this.pdfProcessor = new PDFProcessor();
    }
  }

  /**
   * Process the current PDF with selected options
   */
  async processPDF() {
    try {
      console.log(
        '[PDFCompressor] processPDF() called with options:',
        this.state.processingOptions,
        'file:',
        this.state.currentFile?.name
      );
      // Ensure there is a file selected
      if (!this.state.currentFile) {
        this.showErrorMessage('No PDF file selected');
        return;
      }
      // Ensure at least one processing option
      const opts = this.state.processingOptions;
      if (!opts.removeImages && !opts.imageCompression && !opts.splitPDF) {
        this.showError('Please select at least one processing option');
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
      const progressCallback = p => {
        const percent =
          typeof p === 'number' ? p : (p && (p.percentage ?? p.percent)) || 0;
        const message = (p && p.message) || `Processing... ${percent}%`;
        this.uiController.updateProgress(percent, message);
      };

      // If removal is selected, use dedicated removal flow (keeps text, removes images)
      if (this.state.processingOptions.removeImages) {
        this.uiController.updateProgress(10, 'Preparing to remove images...');
        const removal = await this.pdfProcessor.removeImages(
          this.state.currentFile,
          {},
          progressCallback
        );
        const processedFile = new File([removal.pdfBytes], removal.fileName, {
          type: 'application/pdf',
        });
        const files = {
          originalFile: this.state.currentFile,
          processedFile,
          savings: this.pdfProcessor.estimateCompression(
            this.state.currentFile.size,
            removal.pdfBytes.length
          ),
        };
        // Prefer custom results list UI if present; otherwise use existing UIController view
        const resultsList = document.getElementById('resultsList');
        if (resultsList) {
          this.showResults([
            {
              name: removal.fileName,
              data: removal.pdfBytes,
              size: removal.pdfBytes.length,
              stats: removal.stats,
            },
          ]);
        } else {
          const storageManager = await this.getStorageManager();
          await storageManager.saveResult(files);
          this.uiController.showResults(files);
        }
        this.endPerformanceTracking();
        this.state.isProcessing = false;
        return;
      }

      // Process PDF via engine
      const result = await this.engine.process(
        this.state.currentFile,
        this.state.processingOptions,
        progressCallback
      );

      // Validate result
      if (!result || (!result.processedFile && !result.files)) {
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

      // If multiple files (split), show list; otherwise single result
      if (
        result.files &&
        Array.isArray(result.files) &&
        result.files.length > 0
      ) {
        const list = result.files.map(f => ({
          name: f.name,
          data: f,
          size: f.size,
        }));
        // Render simple list under results section
        const container = document.getElementById('resultsSection');
        if (container) {
          container.style.display = 'block';
          // clear existing
          container.innerHTML = '<h3>Split Complete</h3>';
          const wrap = document.createElement('div');
          wrap.className = 'split-results-list';
          list.forEach(item => {
            const row = document.createElement('div');
            row.className = 'split-result-item';
            const left = document.createElement('div');
            const nameEl = document.createElement('span');
            nameEl.className = 'split-result-name';
            nameEl.textContent = item.name;
            const sizeEl = document.createElement('span');
            sizeEl.className = 'split-result-size';
            sizeEl.textContent = `(${this.formatFileSize(item.size)})`;
            left.appendChild(nameEl);
            left.appendChild(sizeEl);
            const actions = document.createElement('div');
            actions.className = 'split-result-actions';
            if (
              window.desktop &&
              typeof window.desktop.chooseDirectory === 'function'
            ) {
              const btn = document.createElement('button');
              btn.className = 'button-download';
              btn.textContent = 'Save';
              btn.addEventListener('click', async () => {
                const dir = await window.desktop.chooseDirectory();
                if (!dir) return;
                await window.desktop.saveFiles(dir, [
                  { name: item.name, data: await item.data.arrayBuffer() },
                ]);
              });
              actions.appendChild(btn);
            } else {
              const a = document.createElement('a');
              a.className = 'button-download';
              const url = URL.createObjectURL(item.data);
              a.href = url;
              a.download = item.name;
              a.textContent = 'Download';
              actions.appendChild(a);
            }
            row.appendChild(left);
            row.appendChild(actions);
            wrap.appendChild(row);
          });
          if (
            window.desktop &&
            typeof window.desktop.chooseDirectory === 'function'
          ) {
            const bulk = document.createElement('div');
            bulk.style.textAlign = 'right';
            const btnAll = document.createElement('button');
            btnAll.className = 'button-download';
            btnAll.textContent = 'Save All';
            btnAll.addEventListener('click', async () => {
              const dir = await window.desktop.chooseDirectory();
              if (!dir) return;
              const files = await Promise.all(
                list.map(async it => ({
                  name: it.name,
                  data: await it.data.arrayBuffer(),
                }))
              );
              await window.desktop.saveFiles(dir, files);
            });
            bulk.appendChild(btnAll);
            container.appendChild(bulk);
          }
          container.appendChild(wrap);
        }
      } else {
        // Save single result to storage
        await storageManager.saveResult(result);
        // Show results in UI
        this.uiController.showResults(result);
      }

      this.state.isProcessing = false;
    } catch (error) {
      this.state.isProcessing = false;
      console.error('[PDFCompressor] Error processing PDF:', error);
      // Hide progress if visible
      try {
        this.uiController.hideProgress();
      } catch (e) {
        /* noop */
      }
      // Show localized message
      // Pokaż modal błędu (centrowany, z OK)
      try {
        this.uiController.showErrorModal(error?.message || 'Wystąpił błąd');
      } catch (e) {
        this.showErrorMessage(
          'Błąd przetwarzania PDF: ' + (error?.message || error)
        );
      }
    }
  }

  // Lightweight helpers used by alternative upload UI if present
  async handleFileSelect(event) {
    const file = event?.target?.files?.[0];
    if (
      file &&
      (file.type === 'application/pdf' ||
        file.name?.toLowerCase().endsWith('.pdf'))
    ) {
      await this.handleFile(file);
    } else if (file) {
      this.showError('Please select a valid PDF file');
    }
  }

  async handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    const uploadArea = document.getElementById('uploadArea');
    if (uploadArea) uploadArea.classList.remove('dragover');
    const file = event.dataTransfer?.files?.[0];
    if (
      file &&
      (file.type === 'application/pdf' ||
        file.name?.toLowerCase().endsWith('.pdf'))
    ) {
      await this.handleFile(file);
    } else if (file) {
      this.showError('Please drop a valid PDF file');
    }
  }

  async handleFile(file) {
    try {
      if (file.size > 500 * 1024 * 1024) {
        this.showError('File size exceeds 500 MB limit');
        return;
      }
      this.state.currentFile = file;
      this.updateFileInfo(file);
      const processBtn = document.getElementById('processBtn');
      if (processBtn) processBtn.disabled = false;
      console.log(
        'File loaded:',
        file.name,
        'Size:',
        (file.size / 1024 / 1024).toFixed(2) + ' MB'
      );
    } catch (error) {
      console.error('Error handling file:', error);
      this.showError('Error loading file: ' + error.message);
    }
  }

  updateFileInfo(file) {
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    if (fileInfo) fileInfo.classList.add('active');
    if (fileName) fileName.textContent = file.name;
    if (fileSize) fileSize.textContent = this.formatFileSize(file.size);
    const pageCount = document.getElementById('pageCount');
    const imageCount = document.getElementById('imageCount');
    if (pageCount) pageCount.textContent = 'Analyzing...';
    if (imageCount) imageCount.textContent = 'Analyzing...';
  }

  showError(message) {
    console.error('Error:', message);
    const notification = document.createElement('div');
    notification.className = 'error-notification';
    notification.innerHTML = `
      <div class="error-content">
        <span>⚠️ ${message}</span>
      </div>
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 5000);
  }

  handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    const uploadArea = document.getElementById('uploadArea');
    if (uploadArea) uploadArea.classList.add('dragover');
  }

  handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    const uploadArea = document.getElementById('uploadArea');
    if (uploadArea) uploadArea.classList.remove('dragover');
  }

  resetApp() {
    this.state.currentFile = null;
    this.state.processingOptions = {
      ...this.state.processingOptions,
      removeImages: false,
      imageCompression: false,
      splitPDF: false,
    };
    const fileInfo = document.getElementById('fileInfo');
    if (fileInfo) fileInfo.classList.remove('active');
    const resultsSection = document.getElementById('resultsSection');
    if (resultsSection) resultsSection.classList.remove('active');
    const processBtn = document.getElementById('processBtn');
    if (processBtn) processBtn.disabled = true;
    document
      .querySelectorAll('.option-toggle')
      ?.forEach(t => t.classList.remove('active'));
    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.value = '';
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
      if (
        typeof window.PDFLib !== 'undefined' &&
        typeof window.pdfjsLib !== 'undefined'
      ) {
        console.log('[PDFCompressor] PDF libraries already loaded from CDN');
        return {
          PDFDocument: window.PDFLib.PDFDocument,
          rgb: window.PDFLib.rgb,
          pdfjsLib: window.pdfjsLib,
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
      'caches',
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
    // Skip SW in desktop (Electron)
    if (typeof window !== 'undefined' && window.desktop) {
      console.log('[PDFCompressor] Desktop mode – skipping Service Worker');
      return;
    }
    if ('serviceWorker' in navigator) {
      try {
        this.serviceWorkerRegistration = await navigator.serviceWorker.register(
          './service-worker.js'
        );
        console.log(
          '[PDFCompressor] Service Worker registered:',
          this.serviceWorkerRegistration
        );

        // Listen for updates
        this.serviceWorkerRegistration.addEventListener('updatefound', () => {
          console.log('[PDFCompressor] Service Worker update found');
          this.showUpdateNotification();
        });
      } catch (error) {
        console.error(
          '[PDFCompressor] Service Worker registration failed:',
          error
        );
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

    // File input and upload area bindings
    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea');
    if (fileInput) {
      fileInput.addEventListener('change', e => this.handleFileSelect(e));
    }
    if (uploadArea) {
      uploadArea.addEventListener('click', () => fileInput?.click());
      uploadArea.addEventListener('dragover', e => this.handleDragOver(e));
      uploadArea.addEventListener('dragleave', e => this.handleDragLeave(e));
      uploadArea.addEventListener('drop', e => this.handleDrop(e));
    }

    const processBtn = document.getElementById('processBtn');
    if (processBtn) {
      processBtn.addEventListener('click', () => this.processPDF());
    }
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetApp());
    }

    this.setupOptionToggles();

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
    window.addEventListener(
      'resize',
      this.debounce(() => {
        console.log('[PDFCompressor] Window resized');
        // Trigger UI updates if needed
      }, 250)
    );

    // Visibility change for pause/resume
    document.addEventListener('visibilitychange', () => {
      this.state.isVisible = !document.hidden;
      console.log(
        `[PDFCompressor] Visibility changed: ${this.state.isVisible ? 'visible' : 'hidden'}`
      );

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

  setupOptionToggles() {
    const removeToggle = document.getElementById('removeToggle');
    const removeOption = document.getElementById('removeOption');
    if (removeToggle && removeOption) {
      const toggleHandler = () => {
        const next = !this.state.processingOptions.removeImages;
        this.updateProcessingOptions({
          removeImages: next,
          imageCompression: next
            ? false
            : this.state.processingOptions.imageCompression,
        });
        removeToggle.classList.toggle('active');
        console.log('Remove images option:', next);
      };
      removeOption.addEventListener('click', toggleHandler);
      removeToggle.addEventListener('click', e => {
        e.stopPropagation();
        toggleHandler();
      });
    }
  }

  /**
/**
   * Setup PWA features
   */
  setupPWAFeatures() {
    // Disable install prompt banner
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      this.deferredPrompt = null;
      try {
        this.uiController.hideInstallPrompt();
      } catch (e) {
        /* noop: banner may not exist */
      }
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
    performance.measure(
      'processing-duration',
      'processing-start',
      'processing-end'
    );

    const duration = this.performance.endTime - this.performance.startTime;
    console.log(
      `[PDFCompressor] Processing completed in ${duration.toFixed(2)}ms`
    );
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
    try {
      if (
        this.uiController &&
        typeof this.uiController.showNotification === 'function'
      ) {
        this.uiController.showNotification(message, 'error');
      } else {
        // Fallback toast when UI not ready
        const notification = document.createElement('div');
        notification.className = 'notification notification-error';
        notification.textContent = String(message || 'Error');
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '\u00d7';
        closeBtn.className = 'notification-close';
        closeBtn.addEventListener('click', () => notification.remove());
        notification.appendChild(closeBtn);
        (document.body || document.documentElement).appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
      }
    } catch (_) {
      // Last resort: console only
    }
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
    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
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
    return function (...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }

  /**
   * Update processing options
   * @param {Object} options - New options
   */
  updateProcessingOptions(options) {
    this.state.processingOptions = {
      ...this.state.processingOptions,
      ...options,
    };
    console.log(
      '[PDFCompressor] Processing options updated:',
      this.state.processingOptions
    );
  }

  /**
   * Add task to processing queue
   * @param {Object} task - Task to add
   */
  addToQueue(task) {
    this.state.processingQueue.push(task);
    console.log(
      `[PDFCompressor] Task added to queue. Queue length: ${this.state.processingQueue.length}`
    );
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
function __initPdfCompressorApp() {
  try {
    console.log('[PDFCompressor] Initializing app instance...');
    window.pdfCompressorApp = new PDFCompressorApp();
    console.log('[PDFCompressor] App initialized:', window.pdfCompressorApp);
  } catch (e) {
    console.error('[PDFCompressor] Failed to initialize app:', e);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', __initPdfCompressorApp, {
    once: true,
  });
} else {
  __initPdfCompressorApp();
}

// Export for potential use in other modules
export { PDFCompressorApp };
