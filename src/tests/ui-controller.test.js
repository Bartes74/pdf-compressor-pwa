import { UIController } from '../js/ui-controller.js';

// Mock DOM
document.body.innerHTML = `
  <div id="dropArea"></div>
  <input type="file" id="fileInput" />
  <button id="browseBtn">Browse</button>
  <div id="fileInfoPanel" style="display: none;">
    <span id="fileName"></span>
    <span id="fileSize"></span>
    <span id="pageCount"></span>
    <span id="imageCount"></span>
  </div>
  <div class="tab" data-tab="compression">Compression</div>
  <div class="tab" data-tab="split">Split</div>
  <div id="compressionTab" class="tab-pane"></div>
  <div id="splitTab" class="tab-pane"></div>
  <input type="checkbox" id="imageCompressionToggle" />
  <input type="range" id="qualitySlider" />
  <span id="qualityValue">70</span>
  <input type="checkbox" id="removeImagesToggle" />
  <input type="checkbox" id="splitToggle" />
  <input type="radio" name="splitMethod" id="splitByPages" />
  <input type="radio" name="splitMethod" id="splitBySize" />
  <input type="text" id="pageRange" />
  <input type="number" id="fileSizeLimit" />
  <div id="pagesInput" style="display: none;"></div>
  <div id="sizeInput" style="display: none;"></div>
  <button id="resetBtn">Reset</button>
  <button id="processBtn">Process</button>
  <div id="progressSection" style="display: none;">
    <div id="progressFill"></div>
    <span id="progressText"></span>
  </div>
  <div id="resultsSection" style="display: none;">
    <span id="originalSize"></span>
    <span id="compressedSize"></span>
    <span id="savings"></span>
    <a id="originalDownload"></a>
    <a id="compressedDownload"></a>
  </div>
  <div id="installBanner" style="display: none;"></div>
  <div id="offlineNotification" style="display: none;"></div>
  <button id="installBtn">Install</button>
  <button id="closeInstallBanner">Close</button>
  <button id="mobileMenuToggle">Menu</button>
  <div id="mobileMenu"></div>
`;

describe('UIController', () => {
  let uiController;
  
  beforeEach(() => {
    // Reset DOM before each test
    document.body.innerHTML = `
      <div id="dropArea"></div>
      <input type="file" id="fileInput" />
      <button id="browseBtn">Browse</button>
      <div id="fileInfoPanel" style="display: none;">
        <span id="fileName"></span>
        <span id="fileSize"></span>
        <span id="pageCount"></span>
        <span id="imageCount"></span>
      </div>
      <div class="tab" data-tab="compression">Compression</div>
      <div class="tab" data-tab="split">Split</div>
      <div id="compressionTab" class="tab-pane active"></div>
      <div id="splitTab" class="tab-pane"></div>
      <input type="checkbox" id="imageCompressionToggle" checked />
      <input type="range" id="qualitySlider" min="10" max="100" value="70" />
      <span id="qualityValue">70</span>
      <input type="checkbox" id="removeImagesToggle" />
      <input type="checkbox" id="splitToggle" />
      <input type="radio" name="splitMethod" id="splitByPages" checked />
      <input type="radio" name="splitMethod" id="splitBySize" />
      <input type="text" id="pageRange" />
      <input type="number" id="fileSizeLimit" />
      <div id="pagesInput" style="display: block;"></div>
      <div id="sizeInput" style="display: none;"></div>
      <button id="resetBtn">Reset</button>
      <button id="processBtn">Process</button>
      <div id="progressSection" style="display: none;">
        <div id="progressFill" style="width: 0%;"></div>
        <span id="progressText">0%</span>
      </div>
      <div id="resultsSection" style="display: none;">
        <span id="originalSize">1 MB</span>
        <span id="compressedSize">700 KB</span>
        <span id="savings">300 KB (30%)</span>
        <a id="originalDownload" href="#">Download Original</a>
        <a id="compressedDownload" href="#">Download Compressed</a>
      </div>
      <div id="installBanner" style="display: none;"></div>
      <div id="offlineNotification" style="display: none;"></div>
      <button id="installBtn">Install</button>
      <button id="closeInstallBanner">Close</button>
      <button id="mobileMenuToggle">Menu</button>
      <div id="mobileMenu"></div>
    `;
    
    uiController = new UIController();
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('DOM Element Caching', () => {
    it('should cache all required DOM elements', () => {
      expect(uiController.elements).toHaveProperty('dropArea');
      expect(uiController.elements).toHaveProperty('fileInput');
      expect(uiController.elements).toHaveProperty('browseBtn');
      expect(uiController.elements).toHaveProperty('fileInfoPanel');
      expect(uiController.elements).toHaveProperty('tabs');
      expect(uiController.elements).toHaveProperty('tabPanes');
      expect(uiController.elements).toHaveProperty('processBtn');
      expect(uiController.elements).toHaveProperty('resultsSection');
    });
  });
  
  describe('Upload Handling', () => {
    it('should update upload area state when dragging', () => {
      uiController.updateUploadArea(true);
      
      expect(uiController.state.isDragging).toBe(true);
      expect(uiController.elements.dropArea.classList.contains('drag-over')).toBe(true);
    });
    
    it('should reset upload area state when not dragging', () => {
      uiController.updateUploadArea(false);
      
      expect(uiController.state.isDragging).toBe(false);
      expect(uiController.elements.dropArea.classList.contains('drag-over')).toBe(false);
    });
    
    it('should show file information', () => {
      const metadata = {
        fileName: 'test.pdf',
        fileSize: 1024000,
        pageCount: 10,
        imageCount: 5
      };
      
      uiController.showFileInfo(metadata);
      
      expect(uiController.elements.fileInfoPanel.style.display).toBe('block');
      expect(uiController.elements.fileName.textContent).toBe('test.pdf');
      expect(uiController.elements.fileSize.textContent).toBe('1000 KB');
      expect(uiController.elements.pageCount.textContent).toBe('10');
      expect(uiController.elements.imageCount.textContent).toBe('5');
    });
    
    it('should reset upload area', () => {
      uiController.resetUploadArea();
      
      expect(uiController.elements.fileInfoPanel.style.display).toBe('none');
      expect(uiController.elements.fileInput.value).toBe('');
    });
  });
  
  describe('Options Panel', () => {
    it('should switch tabs', () => {
      const compressionTab = document.querySelector('[data-tab="compression"]');
      const splitTab = document.querySelector('[data-tab="split"]');
      
      // Initially compression tab should be active
      expect(document.getElementById('compressionTab').classList.contains('active')).toBe(true);
      expect(document.getElementById('splitTab').classList.contains('active')).toBe(false);
      
      // Switch to split tab
      uiController.switchTab(splitTab);
      
      expect(compressionTab.classList.contains('active')).toBe(false);
      expect(splitTab.classList.contains('active')).toBe(true);
      expect(document.getElementById('compressionTab').classList.contains('active')).toBe(false);
      expect(document.getElementById('splitTab').classList.contains('active')).toBe(true);
    });
    
    it('should update quality slider value display', () => {
      uiController.updateQualitySlider('85');
      
      expect(uiController.elements.qualityValue.textContent).toBe('85');
    });
    
    it('should toggle split controls visibility', () => {
      const pagesInput = document.getElementById('pagesInput');
      const sizeInput = document.getElementById('sizeInput');
      
      // Initially pages input should be visible
      expect(pagesInput.style.display).toBe('block');
      expect(sizeInput.style.display).toBe('none');
      
      // Switch to size method
      uiController.updateSplitControls('size');
      
      expect(pagesInput.style.display).toBe('none');
      expect(sizeInput.style.display).toBe('block');
      
      // Switch back to pages method
      uiController.updateSplitControls('pages');
      
      expect(pagesInput.style.display).toBe('block');
      expect(sizeInput.style.display).toBe('none');
    });
    
    it('should validate inputs', () => {
      // Test valid page range
      uiController.elements.pageRange.value = '1-5';
      expect(uiController.validateInputs()).toBe(true);
      
      // Test invalid page range
      uiController.elements.pageRange.value = 'invalid';
      expect(uiController.validateInputs()).toBe(false);
      
      // Test valid file size limit
      uiController.elements.fileSizeLimit.value = '10';
      expect(uiController.validateInputs()).toBe(true);
      
      // Test invalid file size limit
      uiController.elements.fileSizeLimit.value = '1000';
      expect(uiController.validateInputs()).toBe(false);
    });
  });
  
  describe('Progress Management', () => {
    it('should show progress section', () => {
      uiController.showProgress();
      
      expect(uiController.elements.progressSection.style.display).toBe('block');
      expect(uiController.state.isProcessing).toBe(true);
    });
    
    it('should update progress display', () => {
      uiController.updateProgress(50, 'Processing... 50%');
      
      expect(uiController.elements.progressFill.style.width).toBe('50%');
      expect(uiController.elements.progressText.textContent).toBe('Processing... 50%');
    });
    
    it('should hide progress section', () => {
      uiController.hideProgress();
      
      expect(uiController.elements.progressSection.style.display).toBe('none');
      expect(uiController.state.isProcessing).toBe(false);
    });
  });
  
  describe('Results Display', () => {
    it('should show processing results', () => {
      const files = {
        originalFile: { size: 1000000 },
        processedFile: { size: 700000 },
        savings: { savingsBytes: 300000, savingsPercentage: '30.00' }
      };
      
      uiController.showResults(files);
      
      expect(uiController.elements.resultsSection.style.display).toBe('block');
      expect(uiController.elements.originalSize.textContent).toBe('1000 KB');
      expect(uiController.elements.compressedSize.textContent).toBe('700 KB');
      expect(uiController.elements.savings.textContent).toContain('300 KB');
    });
    
    it('should clear results display', () => {
      uiController.clearResults();
      
      expect(uiController.elements.resultsSection.style.display).toBe('none');
    });
  });
  
  describe('Notifications', () => {
    it('should show notification message', () => {
      uiController.showNotification('Test message', 'success');
      
      const notification = document.querySelector('.notification');
      expect(notification).not.toBeNull();
      expect(notification.textContent).toContain('Test message');
    });
    
    it('should show offline mode notification', () => {
      uiController.showOfflineMode();
      
      expect(uiController.elements.offlineNotification.style.display).toBe('block');
    });
    
    it('should hide offline mode notification', () => {
      uiController.hideOfflineMode();
      
      expect(uiController.elements.offlineNotification.style.display).toBe('none');
    });
    
    it('should show install prompt', () => {
      uiController.showInstallPrompt();
      
      expect(uiController.elements.installBanner.style.display).toBe('flex');
    });
    
    it('should hide install prompt', () => {
      uiController.hideInstallPrompt();
      
      expect(uiController.elements.installBanner.style.display).toBe('none');
    });
  });
  
  describe('Responsiveness', () => {
    it('should handle window resize', () => {
      // Mock window.innerWidth
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 500 });
      
      uiController.handleResize();
      
      expect(uiController.state.isMobile).toBe(true);
    });
    
    it('should toggle mobile menu', () => {
      const mobileMenu = document.getElementById('mobileMenu');
      
      // Initially menu should be closed
      expect(mobileMenu.classList.contains('open')).toBe(false);
      
      // Toggle menu
      uiController.toggleMobileMenu();
      
      expect(mobileMenu.classList.contains('open')).toBe(true);
      
      // Toggle again
      uiController.toggleMobileMenu();
      
      expect(mobileMenu.classList.contains('open')).toBe(false);
    });
  });
  
  describe('Accessibility', () => {
    it('should update ARIA attributes', () => {
      const element = document.createElement('div');
      uiController.updateAria(element, 'aria-label', 'Test label');
      
      expect(element.getAttribute('aria-label')).toBe('Test label');
    });
    
    it('should announce to screen reader', () => {
      uiController.announceToScreenReader('Test announcement');
      
      const liveRegion = document.getElementById('screen-reader-announcements');
      expect(liveRegion).not.toBeNull();
      expect(liveRegion.textContent).toBe('Test announcement');
    });
  });
  
  describe('Utility Methods', () => {
    it('should format file size correctly', () => {
      expect(uiController.formatFileSize(0)).toBe('0 Bytes');
      expect(uiController.formatFileSize(1024)).toBe('1 KB');
      expect(uiController.formatFileSize(1048576)).toBe('1 MB');
      expect(uiController.formatFileSize(1073741824)).toBe('1 GB');
    });
    
    it('should debounce function calls', () => {
      jest.useFakeTimers();
      
      const mockFn = jest.fn();
      const debouncedFn = uiController.debounce(mockFn, 100);
      
      debouncedFn();
      debouncedFn();
      debouncedFn();
      
      // Fast-forward time
      jest.advanceTimersByTime(100);
      
      expect(mockFn).toHaveBeenCalledTimes(1);
      
      jest.useRealTimers();
    });
  });
});