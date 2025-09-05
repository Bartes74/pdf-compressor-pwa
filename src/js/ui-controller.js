// ui-controller.js - Manages the user interface for the PDF Compressor PWA
// Implements singleton pattern for UI management

/**
 * UIController - Singleton class for managing the user interface
 * Handles all UI interactions, animations, and state management
 */
export class UIController {
  /**
   * Constructor - Initialize UIController as singleton
   */
  constructor() {
    // Ensure only one instance exists
    if (UIController.instance) {
      return UIController.instance;
    }
    
    // DOM element cache
    this.elements = {};
    
    // Reference to main app
    this.app = null;
    
    // State management
    this.state = {
      isDragging: false,
      isProcessing: false,
      isMobile: window.innerWidth <= 768,
      darkMode: this.detectSystemTheme() === 'dark',
      currentTheme: this.detectSystemTheme()
    };
    
    // Animation frame references
    this.animationFrame = null;
    
    // Initialize the UI controller
    this.init();
    
    // Set instance for singleton pattern
    UIController.instance = this;
  }

  /**
   * Initialize the UI controller
   */
  init() {
    console.log('[UIController] Initializing UI controller');
    
    // Cache DOM elements
    this.cacheElements();
    
    // Bind event handlers
    this.bindEvents();
    
    // Setup observers
    this.setupObservers();
    
    // Apply initial theme
    this.applyTheme();
    
    // Handle initial responsive state
    this.handleResize();

    // Initialize processing options based on the active tab
    const activeTab = Array.from(this.elements.tabs || []).find(t => t.classList.contains('active'));
    if (activeTab) {
      this.applyActiveTabOptions(activeTab.getAttribute('data-tab'));
    }
  }

  /**
   * Cache frequently used DOM elements
   */
  cacheElements() {
    console.log('[UIController] Caching DOM elements');
    
    // Upload area elements
    this.elements.dropArea = document.getElementById('dropArea');
    this.elements.fileInput = document.getElementById('fileInput');
    this.elements.browseBtn = document.getElementById('browseBtn');
    this.elements.fileInfoPanel = document.getElementById('fileInfoPanel');
    this.elements.fileName = document.getElementById('fileName');
    this.elements.fileSize = document.getElementById('fileSize');
    this.elements.pageCount = document.getElementById('pageCount');
    this.elements.imageCount = document.getElementById('imageCount');
    
    // Option panel elements
    this.elements.tabs = document.querySelectorAll('.tab');
    this.elements.tabPanes = document.querySelectorAll('.tab-pane');
    this.elements.qualitySlider = document.getElementById('qualitySlider');
    this.elements.qualityValue = document.getElementById('qualityValue');
    this.elements.splitByPages = document.getElementById('splitByPages');
    this.elements.splitBySize = document.getElementById('splitBySize');
    this.elements.pageRange = document.getElementById('pageRange');
    this.elements.fileSizeLimit = document.getElementById('fileSizeLimit');
    this.elements.pagesInput = document.getElementById('pagesInput');
    this.elements.sizeInput = document.getElementById('sizeInput');
    
    // Action buttons
    this.elements.resetBtn = document.getElementById('resetBtn');
    this.elements.processBtn = document.getElementById('processBtn');
    
    // Progress elements
    this.elements.progressSection = document.getElementById('progressSection');
    this.elements.progressFill = document.getElementById('progressFill');
    this.elements.progressText = document.getElementById('progressText');
    
    // Results elements
    this.elements.resultsSection = document.getElementById('resultsSection');
    this.elements.originalSize = document.getElementById('originalSize');
    this.elements.compressedSize = document.getElementById('compressedSize');
    this.elements.savings = document.getElementById('savings');
    this.elements.originalDownload = document.getElementById('originalDownload');
    this.elements.compressedDownload = document.getElementById('compressedDownload');
    
    // Notification elements
    this.elements.installBanner = document.getElementById('installBanner');
    this.elements.offlineNotification = document.getElementById('offlineNotification');
    this.elements.installBtn = document.getElementById('installBtn');
    this.elements.closeInstallBanner = document.getElementById('closeInstallBanner');
    
    // Mobile menu elements
    this.elements.mobileMenuToggle = document.getElementById('mobileMenuToggle');
    this.elements.mobileMenu = document.getElementById('mobileMenu');
  }

  /**
   * Bind event handlers
   */
  bindEvents() {
    console.log('[UIController] Binding event handlers');
    
    // Upload handling events
    if (this.elements.browseBtn) {
      this.elements.browseBtn.addEventListener('click', () => {
        if (this.elements.fileInput) {
          this.elements.fileInput.click();
        }
      });
    }
    
    if (this.elements.fileInput) {
      this.elements.fileInput.addEventListener('change', (e) => {
        this.handleFileSelect(e);
      });
    }
    
    if (this.elements.dropArea) {
      this.elements.dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        this.updateUploadArea(true);
      });
      
      this.elements.dropArea.addEventListener('dragleave', () => {
        this.updateUploadArea(false);
      });
      
      this.elements.dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        this.updateUploadArea(false);
        this.handleDrop(e);
      });
    }
    
    // Tab navigation
    this.setupTabs();
    
    // Option controls
    this.setupOptionControls();
    
    // Action buttons
    if (this.elements.resetBtn) {
      this.elements.resetBtn.addEventListener('click', () => {
        this.resetApp();
      });
    }
    
    if (this.elements.processBtn) {
      this.elements.processBtn.addEventListener('click', () => {
        this.handleProcess();
      });
    }
    
    // Install banner events
    if (this.elements.installBtn) {
      this.elements.installBtn.addEventListener('click', () => {
        this.handleInstall();
      });
    }
    
    if (this.elements.closeInstallBanner) {
      this.elements.closeInstallBanner.addEventListener('click', () => {
        this.hideInstallPrompt();
      });
    }
    
    // Mobile menu
    if (this.elements.mobileMenuToggle) {
      this.elements.mobileMenuToggle.addEventListener('click', () => {
        this.toggleMobileMenu();
      });
    }
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      this.handleKeyboardNavigation(e);
    });
  }

  /**
   * Setup observers (Intersection, Resize)
   */
  setupObservers() {
    console.log('[UIController] Setting up observers');
    
    // Resize observer for responsive design
    window.addEventListener('resize', this.debounce(() => {
      this.handleResize();
    }, 250));
    
    // Intersection observer for animations
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      }, {
        threshold: 0.1
      });
      
      // Observe relevant elements
      const observeElements = document.querySelectorAll('.upload-container, .options-section, .results-section');
      observeElements.forEach(el => observer.observe(el));
    }
  }

  // === UPLOAD HANDLING ===

  /**
   * Update upload area state
   * @param {boolean} isDragging - Whether user is dragging file over drop area
   */
  updateUploadArea(isDragging) {
    if (!this.elements.dropArea) return;
    
    this.state.isDragging = isDragging;
    
    if (isDragging) {
      this.elements.dropArea.classList.add('drag-over');
      this.triggerAnimation('upload-drag-over');
    } else {
      this.elements.dropArea.classList.remove('drag-over');
      this.triggerAnimation('upload-drag-leave');
    }
  }

  /**
   * Show file information
   * @param {Object} metadata - File metadata
   */
  showFileInfo(metadata) {
    if (!this.elements.fileInfoPanel) return;
    
    // Update file info display
    if (this.elements.fileName) {
      this.elements.fileName.textContent = metadata.fileName || 'Unknown';
    }
    
    if (this.elements.fileSize) {
      this.elements.fileSize.textContent = this.formatFileSize(metadata.fileSize || 0);
    }
    
    if (this.elements.pageCount) {
      this.elements.pageCount.textContent = metadata.pageCount || 'Calculating...';
    }
    
    if (this.elements.imageCount) {
      this.elements.imageCount.textContent = metadata.imageCount || 'Analyzing...';
    }
    
    // Show file info panel
    this.elements.fileInfoPanel.style.display = 'block';
    
    // Trigger animation
    this.triggerAnimation('file-info-show');
  }

  /**
   * Reset upload area
   */
  resetUploadArea() {
    // Hide file info panel
    if (this.elements.fileInfoPanel) {
      this.elements.fileInfoPanel.style.display = 'none';
    }
    
    // Reset file input
    if (this.elements.fileInput) {
      this.elements.fileInput.value = '';
    }
    
    // Show drop area
    if (this.elements.dropArea) {
      this.elements.dropArea.style.display = 'block';
    }
    
    // Trigger animation
    this.triggerAnimation('upload-reset');
  }

  /**
   * Handle file selection
   * @param {Event} e - File input change event
   */
  handleFileSelect(e) {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      this.processSelectedFile(file);
    }
  }

  /**
   * Handle file drop
   * @param {Event} e - Drop event
   */
  handleDrop(e) {
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      this.processSelectedFile(file);
    }
  }

  /**
   * Process selected file
   * @param {File} file - Selected file
   */
  processSelectedFile(file) {
    // Call the actual app to process the file
    console.log('[UIController] File selected:', file.name);
    console.log('[UIController] App reference:', this.app);
    
    if (this.app) {
      console.log('[UIController] Calling app.handleFileSelection');
      this.app.handleFileSelection(file);
    } else {
      console.warn('[UIController] No app reference available for file processing');
      // Fallback to mock data if app is not available
      this.showFileInfo({
        fileName: file.name,
        fileSize: file.size,
        pageCount: Math.floor(Math.random() * 100) + 1,
        imageCount: Math.floor(Math.random() * 20) + 1
      });
    }
  }

  // === OPTIONS PANEL ===

  /**
   * Setup tab navigation
   */
  setupTabs() {
    if (!this.elements.tabs || !this.elements.tabPanes) return;
    
    this.elements.tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.switchTab(tab);
        const tabId = tab.getAttribute('data-tab');
        this.applyActiveTabOptions(tabId);
      });
    });
  }

  /**
   * Switch active tab
   * @param {Element} clickedTab - The tab that was clicked
   */
  switchTab(clickedTab) {
    // Remove active class from all tabs and panes
    this.elements.tabs.forEach(t => t.classList.remove('active'));
    this.elements.tabPanes.forEach(p => p.classList.remove('active'));
    
    // Add active class to clicked tab
    clickedTab.classList.add('active');
    
    // Show corresponding pane
    const tabId = clickedTab.getAttribute('data-tab');
    const pane = document.getElementById(`${tabId}Tab`);
    if (pane) {
      pane.classList.add('active');
    }
    
    // Trigger animation
    this.triggerAnimation('tab-switch');
  }

  /**
   * Apply processing options based on active tab
   * @param {string} tabId - 'compression' | 'removal' | 'split'
   */
  applyActiveTabOptions(tabId) {
    if (!this.app) return;
    if (tabId === 'compression') {
      this.app.updateProcessingOptions({
        imageCompression: true,
        removeImages: false,
        splitPDF: false
      });
    } else if (tabId === 'removal') {
      this.app.updateProcessingOptions({
        imageCompression: false,
        removeImages: true,
        splitPDF: false
      });
    } else if (tabId === 'split') {
      let method = 'pages';
      if (this.elements.splitBySize && this.elements.splitBySize.checked) method = 'size';
      if (this.elements.splitByPages && this.elements.splitByPages.checked) method = 'pages';
      this.app.updateProcessingOptions({
        imageCompression: false,
        removeImages: false,
        splitPDF: true,
        splitMethod: method
      });
    }
  }

  /**
   * Setup option controls event listeners
   */
  setupOptionControls() {
    console.log('[UIController] Setting up option controls');
    
    // Quality slider
    if (this.elements.qualitySlider && this.elements.qualityValue) {
      this.elements.qualitySlider.addEventListener('input', (e) => {
        this.elements.qualityValue.textContent = e.target.value;
        if (this.app) {
          const quality = Math.max(10, Math.min(100, Number(e.target.value)));
          this.app.updateProcessingOptions({ imageQuality: quality });
        }
      });
    }
    
    // Split method radio buttons
    if (this.elements.splitByPages) {
      this.elements.splitByPages.addEventListener('change', () => {
        this.showSplitInput('pages');
        if (this.app) {
          this.app.updateProcessingOptions({ splitMethod: 'pages' });
        }
      });
    }
    
    if (this.elements.splitBySize) {
      this.elements.splitBySize.addEventListener('change', () => {
        this.showSplitInput('size');
        if (this.app) {
          this.app.updateProcessingOptions({ splitMethod: 'size' });
        }
      });
    }

    // Page range input
    if (this.elements.pageRange) {
      this.elements.pageRange.addEventListener('input', (e) => {
        if (this.app) {
          this.app.updateProcessingOptions({ pageRange: String(e.target.value || '').trim() });
        }
      });
    }
    
    // File size limit input
    if (this.elements.fileSizeLimit) {
      this.elements.fileSizeLimit.addEventListener('input', (e) => {
        if (this.app) {
          const val = Math.max(1, Math.min(500, Number(e.target.value)));
          this.app.updateProcessingOptions({ fileSizeLimit: val });
        }
      });
    }
  }

  /**
   * Show split input based on selected method
   * @param {string} method - Split method ('pages' or 'size')
   */
  showSplitInput(method) {
    if (!this.elements.pagesInput || !this.elements.sizeInput) return;
    
    if (method === 'pages') {
      this.elements.pagesInput.style.display = 'block';
      this.elements.sizeInput.style.display = 'none';
    } else {
      this.elements.pagesInput.style.display = 'none';
      this.elements.sizeInput.style.display = 'block';
    }
  }

  // === PROGRESS MANAGEMENT ===

  /**
   * Show progress section
   */
  showProgress() {
    if (this.elements.progressSection) {
      this.elements.progressSection.style.display = 'block';
    }
    
    // Hide other sections
    if (this.elements.fileInfoPanel) {
      this.elements.fileInfoPanel.style.display = 'none';
    }
    
    this.state.isProcessing = true;
    
    // Trigger animation
    this.triggerAnimation('progress-show');
  }

  /**
   * Update progress display
   * @param {number} percent - Progress percentage (0-100)
   * @param {string} message - Progress message
   */
  updateProgress(percent, message) {
    if (this.elements.progressFill) {
      this.elements.progressFill.style.width = `${percent}%`;
    }
    
    if (this.elements.progressText) {
      this.elements.progressText.textContent = message || `Processing... ${percent}%`;
    }
    
    // Trigger animation
    this.triggerAnimation('progress-update');
  }

  /**
   * Hide progress section
   */
  hideProgress() {
    if (this.elements.progressSection) {
      this.elements.progressSection.style.display = 'none';
    }
    
    this.state.isProcessing = false;
    
    // Trigger animation
    this.triggerAnimation('progress-hide');
  }

  // === RESULTS DISPLAY ===

  /**
   * Show processing results
   * @param {Object} files - Processed files data
   */
  showResults(files) {
    if (!this.elements.resultsSection) return;
    
    // Hide progress
    this.hideProgress();
    
    // Validate files object
    if (!files || !files.processedFile) {
      console.error('[UIController] Invalid files object for results:', files);
      this.showNotification('Processing failed - invalid result data', 'error');
      return;
    }
    
    // Validate file sizes
    if (files.originalFile && files.processedFile) {
      console.log(`[UIController] File sizes - Original: ${files.originalFile.size}, Processed: ${files.processedFile.size}`);
      
      // Check for potential issues with large files
      if (files.originalFile.size > 100 * 1024 * 1024 && files.processedFile.size < 1024) {
        // Original file is >100MB but processed file is <1KB - likely an error
        console.warn('[UIController] Potential issue: Large original file but very small processed file');
        this.showNotification('Warning: Processed file seems unusually small. There may have been an error during processing.', 'warning');
      }
    }
    
    // Show results section
    this.elements.resultsSection.style.display = 'block';
    
    // Update results display
    if (files.originalFile && this.elements.originalSize) {
      this.elements.originalSize.textContent = this.formatFileSize(files.originalFile.size);
    }
    
    if (files.processedFile && this.elements.compressedSize) {
      this.elements.compressedSize.textContent = this.formatFileSize(files.processedFile.size);
    }
    
    if (files.savings && this.elements.savings) {
      this.elements.savings.textContent = this.formatFileSize(files.savings.savingsBytes) + 
        ` (${files.savings.savingsPercentage}% reduction)`;
    }
    
    // Setup download handlers with error handling
    if (this.elements.originalDownload) {
      // Remove any existing event listeners to prevent duplicates
      const clone = this.elements.originalDownload.cloneNode(true);
      this.elements.originalDownload.parentNode.replaceChild(clone, this.elements.originalDownload);
      this.elements.originalDownload = clone;
      
      this.elements.originalDownload.addEventListener('click', (e) => {
        e.preventDefault();
        try {
          this.handleDownload(files.originalFile);
        } catch (error) {
          console.error('[UIController] Error downloading original file:', error);
          this.showNotification('Failed to download original file: ' + error.message, 'error');
        }
      });
    }
    
    if (this.elements.compressedDownload) {
      // Remove any existing event listeners to prevent duplicates
      const clone = this.elements.compressedDownload.cloneNode(true);
      this.elements.compressedDownload.parentNode.replaceChild(clone, this.elements.compressedDownload);
      this.elements.compressedDownload = clone;
      
      this.elements.compressedDownload.addEventListener('click', (e) => {
        e.preventDefault();
        try {
          this.handleDownload(files.processedFile);
        } catch (error) {
          console.error('[UIController] Error downloading processed file:', error);
          this.showNotification('Failed to download processed file: ' + error.message, 'error');
        }
      });
    }
    
    // Trigger animation
    this.triggerAnimation('results-show');
  }

  /**
   * Create result card for a file
   * @param {File} file - File to create card for
   * @returns {Element} - Result card element
   */
  createResultCard(file) {
    const card = document.createElement('div');
    card.className = 'result-card';
    
    card.innerHTML = `
      <div class="result-card-header">
        <h4>${file.name}</h4>
        <span class="file-size">${this.formatFileSize(file.size)}</span>
      </div>
      <div class="result-card-actions">
        <button class="download-btn" data-file-id="${file.id}">Download</button>
      </div>
    `;
    
    return card;
  }

  /**
   * Handle file download
   * @param {File} file - File to download
   */
  handleDownload(file) {
    if (!file) {
      console.error('[UIController] No file provided for download');
      this.showNotification('No file to download', 'error');
      return;
    }
    
    // Validate file object
    if (!(file instanceof File) && !(file instanceof Blob)) {
      console.error('[UIController] Invalid file object for download:', file);
      this.showNotification('Invalid file object', 'error');
      return;
    }
    
    try {
      // Create download link
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name || 'download.pdf';
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      // Trigger animation
      this.triggerAnimation('file-download');
    } catch (error) {
      console.error('[UIController] Error creating download link:', error);
      this.showNotification('Failed to create download link. File may be corrupted.', 'error');
    }
  }

  /**
   * Clear results display
   */
  clearResults() {
    if (this.elements.resultsSection) {
      this.elements.resultsSection.style.display = 'none';
    }
    
    // Trigger animation
    this.triggerAnimation('results-clear');
  }

  // === NOTIFICATIONS ===

  /**
   * Show notification message
   * @param {string} message - Notification message
   * @param {string} type - Notification type ('info', 'success', 'warning', 'error')
   */
  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.className = 'notification-close';
    closeBtn.addEventListener('click', () => {
      notification.remove();
    });
    
    notification.appendChild(closeBtn);
    
    // Add to document
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);
    
    // Trigger animation
    this.triggerAnimation('notification-show');
  }

  /**
   * Show offline mode notification
   */
  showOfflineMode() {
    if (this.elements.offlineNotification) {
      this.elements.offlineNotification.style.display = 'block';
      this.elements.offlineNotification.classList.add('visible');
    }
    
    // Trigger animation
    this.triggerAnimation('offline-show');
  }

  /**
   * Hide offline mode notification
   */
  hideOfflineMode() {
    if (this.elements.offlineNotification) {
      this.elements.offlineNotification.style.display = 'none';
      this.elements.offlineNotification.classList.remove('visible');
    }
    
    // Trigger animation
    this.triggerAnimation('offline-hide');
  }

  /**
   * Show update available notification
   */
  showUpdateAvailable() {
    this.showNotification('A new version is available. Please refresh to update.', 'info');
    
    // Trigger animation
    this.triggerAnimation('update-show');
  }

  /**
   * Show install prompt
   */
  showInstallPrompt() {
    if (this.elements.installBanner) {
      this.elements.installBanner.style.display = 'flex';
      this.elements.installBanner.classList.add('visible');
    }
    
    // Trigger animation
    this.triggerAnimation('install-show');
  }

  /**
   * Hide install prompt
   */
  hideInstallPrompt() {
    if (this.elements.installBanner) {
      this.elements.installBanner.style.display = 'none';
      this.elements.installBanner.classList.remove('visible');
    }
    
    // Trigger animation
    this.triggerAnimation('install-hide');
  }

  /**
   * Handle install button click
   */
  handleInstall() {
    // In a real implementation, this would trigger the PWA install prompt
    console.log('[UIController] Install button clicked');
    
    // For now, we'll just hide the banner
    this.hideInstallPrompt();
    
    // Trigger animation
    this.triggerAnimation('install-handle');
  }

  // === RESPONSIVENESS ===

  /**
   * Handle window resize
   */
  handleResize() {
    this.state.isMobile = window.innerWidth <= 768;
    
    // Adapt layout
    this.adaptLayout();
    
    // Trigger animation
    this.triggerAnimation('resize');
  }

  /**
   * Toggle mobile menu
   */
  toggleMobileMenu() {
    if (this.elements.mobileMenu) {
      const isOpen = this.elements.mobileMenu.classList.contains('open');
      if (isOpen) {
        this.elements.mobileMenu.classList.remove('open');
      } else {
        this.elements.mobileMenu.classList.add('open');
      }
    }
    
    // Trigger animation
    this.triggerAnimation('mobile-menu-toggle');
  }

  /**
   * Adapt layout for current screen size
   */
  adaptLayout() {
    // Adjust layout based on screen size
    const container = document.querySelector('.upload-container');
    if (container) {
      if (this.state.isMobile) {
        container.classList.add('mobile-layout');
      } else {
        container.classList.remove('mobile-layout');
      }
    }
    
    // Trigger animation
    this.triggerAnimation('layout-adapt');
  }

  // === ACCESSIBILITY ===

  /**
   * Handle keyboard navigation
   * @param {Event} e - Keyboard event
   */
  handleKeyboardNavigation(e) {
    // Handle Escape key
    if (e.key === 'Escape') {
      // Close modals, menus, etc.
      this.hideInstallPrompt();
      
      // Trigger animation
      this.triggerAnimation('escape-key');
    }
    
    // Handle Tab key for focus management
    if (e.key === 'Tab') {
      this.manageFocus(e);
    }
  }

  /**
   * Manage focus for accessibility
   * @param {Event} e - Keyboard event
   */
  manageFocus(e) {
    // In a real implementation, this would manage focus traps and keyboard navigation
    console.log('[UIController] Managing focus');
  }

  /**
   * Update ARIA attributes
   * @param {Element} element - Element to update
   * @param {string} attribute - ARIA attribute to update
   * @param {string} value - New value
   */
  updateAria(element, attribute, value) {
    if (element) {
      element.setAttribute(attribute, value);
    }
  }

  /**
   * Announce message to screen readers
   * @param {string} message - Message to announce
   */
  announceToScreenReader(message) {
    // Create aria-live region if it doesn't exist
    let liveRegion = document.getElementById('screen-reader-announcements');
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'screen-reader-announcements';
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.style.position = 'absolute';
      liveRegion.style.left = '-10000px';
      document.body.appendChild(liveRegion);
    }
    
    // Set message
    liveRegion.textContent = message;
  }

  // === ANIMATIONS ===

  /**
   * Trigger animation using requestAnimationFrame
   * @param {string} animationName - Name of animation to trigger
   */
  triggerAnimation(animationName) {
    // Cancel any existing animation frame
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    
    // Trigger animation
    this.animationFrame = requestAnimationFrame(() => {
      console.log(`[UIController] Animation triggered: ${animationName}`);
      // In a real implementation, this would trigger CSS transitions or animations
    });
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

  // === THEME MANAGEMENT ===

  /**
   * Toggle dark mode
   */
  toggleDarkMode() {
    this.state.darkMode = !this.state.darkMode;
    this.applyTheme();
    this.savePreference();
    
    // Trigger animation
    this.triggerAnimation('theme-toggle');
  }

  /**
   * Apply current theme
   */
  applyTheme() {
    if (this.state.darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }

  /**
   * Save theme preference
   */
  savePreference() {
    try {
      localStorage.setItem('pdf-compressor-theme', this.state.darkMode ? 'dark' : 'light');
    } catch (e) {
      console.warn('[UIController] Could not save theme preference:', e);
    }
  }

  /**
   * Detect system theme preference
   * @returns {string} - 'dark' or 'light'
   */
  detectSystemTheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  // === UTILITY METHODS ===

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
   * Handle process button click
   */
  handleProcess() {
    console.log('[UIController] Process button clicked');
    console.log('[UIController] App reference:', this.app);
    
    if (this.app) {
      console.log('[UIController] Calling app.processPDF');
      this.app.processPDF();
    } else {
      console.warn('[UIController] No app reference available for processing');
      // Fallback simulation if app is not available
      this.showProgress();
      
      // Simulate processing
      let progress = 0;
      const interval = setInterval(() => {
        progress += 5;
        this.updateProgress(progress, `Processing... ${progress}%`);
        
        if (progress >= 100) {
          clearInterval(interval);
          // In a real implementation, this would show actual results
          this.showResults({
            originalFile: { size: 1000000, name: 'original.pdf' },
            processedFile: { size: 700000, name: 'compressed.pdf' },
            savings: { savingsBytes: 300000, savingsPercentage: '30.00' }
          });
        }
      }, 100);
    }
  }

  /**
   * Reset application state
   */
  resetApp() {
    console.log('[UIController] Resetting application');
    
    // Reset UI
    this.resetUploadArea();
    this.hideProgress();
    this.clearResults();
    
    // Trigger animation
    this.triggerAnimation('app-reset');
  }

  /**
   * Set reference to main app
   * @param {Object} app - Reference to the main PDFCompressorApp instance
   */
  setApp(app) {
    console.log('[UIController] Setting app reference:', app);
    this.app = app;
  }
}

// Note: The class `UIController` is exported above and instantiated by the app.
// Avoid exporting another symbol named `UIController` to prevent duplicate export errors.
