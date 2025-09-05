// StorageManager.js - Comprehensive storage management for PDF Compressor PWA

/**
 * StorageManager - Singleton class for managing all storage operations
 * Handles IndexedDB, Cache API, settings, quota management, and data synchronization
 */
export class StorageManager {
  /**
   * Constructor - Initialize StorageManager as singleton
   */
  constructor() {
    // Ensure only one instance exists (singleton pattern)
    if (StorageManager.instance) {
      return StorageManager.instance;
    }
    
    // Database configuration
    this.dbName = 'PDFCompressorDB';
    this.dbVersion = 1;
    this.db = null;
    
    // Cache configuration
    this.cacheName = 'pdf-compressor-cache-v1';
    
    // Session storage prefix
    this.sessionPrefix = 'pdf-compressor-';
    
    // Storage quota monitoring
    this.storageQuota = null;
    this.storageUsage = null;
    
    // Set instance for singleton pattern
    StorageManager.instance = this;
  }
  
  /**
   * Initialize the storage manager
   * @returns {Promise<void>}
   */
  async init() {
    try {
      await this.initDB();
      await this.initCache();
      this.setupEventListeners();
      console.log('[StorageManager] Initialized successfully');
    } catch (error) {
      console.error('[StorageManager] Initialization error:', error);
      throw new Error(`Storage initialization failed: ${error.message}`);
    }
  }
  
  /**
   * Initialize IndexedDB database
   * @returns {Promise<void>}
   */
  async initDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB is not supported in this browser'));
        return;
      }
      
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = (event) => {
        console.error('[StorageManager] Database error:', event.target.error);
        reject(event.target.error);
      };
      
      request.onsuccess = (event) => {
        this.db = event.target.result;
        console.log('[StorageManager] Database initialized successfully');
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        this.db = event.target.result;
        
        // Create object stores
        if (!this.db.objectStoreNames.contains('files')) {
          const fileStore = this.db.createObjectStore('files', { keyPath: 'id' });
          fileStore.createIndex('fileName', 'fileName', { unique: false });
          fileStore.createIndex('dateAdded', 'dateAdded', { unique: false });
        }
        
        if (!this.db.objectStoreNames.contains('results')) {
          const resultsStore = this.db.createObjectStore('results', { keyPath: 'id' });
          resultsStore.createIndex('originalFileId', 'originalFileId', { unique: false });
          resultsStore.createIndex('dateProcessed', 'dateProcessed', { unique: false });
        }
        
        if (!this.db.objectStoreNames.contains('settings')) {
          const settingsStore = this.db.createObjectStore('settings', { keyPath: 'key' });
        }
        
        console.log('[StorageManager] Database upgraded');
      };
    });
  }
  
  /**
   * Initialize Cache API
   * @returns {Promise<void>}
   */
  async initCache() {
    if ('caches' in window) {
      try {
        await caches.open(this.cacheName);
        console.log('[StorageManager] Cache initialized successfully');
      } catch (error) {
        console.error('[StorageManager] Cache initialization error:', error);
      }
    }
  }
  
  /**
   * Setup event listeners for storage changes
   */
  setupEventListeners() {
    // Listen for storage changes
    window.addEventListener('storage', this.handleStorageChange.bind(this));
    
    // Periodically monitor storage usage
    setInterval(() => {
      this.monitorStorageUsage();
    }, 300000); // Every 5 minutes
  }
  
  // === FILE METHODS ===
  
  /**
   * Save a file to IndexedDB
   * @param {File} file - The file to save
   * @param {Object} metadata - File metadata
   * @returns {Promise<string>} - File ID
   */
  async saveFile(file, metadata) {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }
      // Convert file to ArrayBuffer BEFORE opening a transaction to avoid auto-commit
      const arrayBuffer = await file.arrayBuffer();
      
      const transaction = this.db.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');
      
      const fileData = {
        id: this.generateId(),
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        data: arrayBuffer,
        metadata: metadata,
        dateAdded: new Date()
      };
      
      try {
        await this.putInStore(store, fileData);
      } catch (e) {
        // Retry once if transaction might have auto-closed
        if (e && (e.name === 'InvalidStateError' || /transaction has finished/i.test(e.message))) {
          const retryTx = this.db.transaction(['files'], 'readwrite');
          const retryStore = retryTx.objectStore('files');
          await this.putInStore(retryStore, fileData);
        } else {
          throw e;
        }
      }
      console.log(`[StorageManager] File saved: ${file.name}`);
      return fileData.id;
    } catch (error) {
      console.error('[StorageManager] Error saving file:', error);
      this.handleStorageError(error, 'saveFile');
      throw error;
    }
  }
  
  /**
   * Get a file from IndexedDB
   * @param {string} id - File ID
   * @returns {Promise<Object|null>} - File data or null if not found
   */
  async getFile(id) {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }
      
      const transaction = this.db.transaction(['files'], 'readonly');
      const store = transaction.objectStore('files');
      
      const result = await this.getFromStore(store, id);
      
      if (result) {
        // Convert ArrayBuffer back to Blob for use
        const blob = new Blob([result.data], { type: result.fileType });
        return {
          ...result,
          blob: blob
        };
      }
      
      return result;
    } catch (error) {
      console.error('[StorageManager] Error getting file:', error);
      throw error;
    }
  }
  
  /**
   * Delete a file from IndexedDB
   * @param {string} id - File ID
   * @returns {Promise<void>}
   */
  async deleteFile(id) {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }
      
      const transaction = this.db.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');
      
      await this.deleteFromStore(store, id);
      console.log(`[StorageManager] File deleted: ${id}`);
    } catch (error) {
      console.error('[StorageManager] Error deleting file:', error);
      throw error;
    }
  }
  
  /**
   * Get all files from IndexedDB
   * @returns {Promise<Array>} - Array of files
   */
  async getAllFiles() {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }
      
      const transaction = this.db.transaction(['files'], 'readonly');
      const store = transaction.objectStore('files');
      
      const files = await this.getAllFromStore(store);
      
      // Convert ArrayBuffers back to Blobs
      return files.map(file => ({
        ...file,
        blob: new Blob([file.data], { type: file.fileType })
      }));
    } catch (error) {
      console.error('[StorageManager] Error getting all files:', error);
      throw error;
    }
  }
  
  /**
   * Clear old files from IndexedDB
   * @param {number} daysOld - Files older than this will be deleted
   * @returns {Promise<number>} - Number of files deleted
   */
  async clearOldFiles(daysOld) {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      const transaction = this.db.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');
      
      // Get all files
      const allFiles = await this.getAllFromStore(store);
      
      // Filter old files
      const oldFiles = allFiles.filter(file => new Date(file.dateAdded) < cutoffDate);
      
      // Delete old files
      let deletedCount = 0;
      for (const file of oldFiles) {
        await this.deleteFromStore(store, file.id);
        deletedCount++;
      }
      
      console.log(`[StorageManager] Cleared ${deletedCount} old files`);
      return deletedCount;
    } catch (error) {
      console.error('[StorageManager] Error clearing old files:', error);
      throw error;
    }
  }
  
  // === RESULTS METHODS ===
  
  /**
   * Save processing result to IndexedDB
   * @param {Object} result - Processing result data
   * @returns {Promise<string>} - Result ID
   */
  async saveResult(result) {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }
      // Convert files to ArrayBuffer BEFORE opening a transaction to avoid auto-commit
      const originalArrayBuffer = await result.originalFile.arrayBuffer();
      const processedArrayBuffer = await result.processedFile.arrayBuffer();
      
      const transaction = this.db.transaction(['results'], 'readwrite');
      const store = transaction.objectStore('results');
      
      const resultData = {
        id: this.generateId(),
        originalFile: {
          name: result.originalFile.name,
          type: result.originalFile.type,
          size: result.originalFile.size,
          data: originalArrayBuffer
        },
        processedFile: {
          name: result.processedFile.name,
          type: result.processedFile.type,
          size: result.processedFile.size,
          data: processedArrayBuffer
        },
        metadata: result.metadata,
        savings: result.savings,
        processingTime: result.processingTime,
        dateProcessed: new Date()
      };
      
      try {
        await this.putInStore(store, resultData);
      } catch (e) {
        // Retry once if transaction might have auto-closed
        if (e && (e.name === 'InvalidStateError' || /transaction has finished/i.test(e.message))) {
          const retryTx = this.db.transaction(['results'], 'readwrite');
          const retryStore = retryTx.objectStore('results');
          await this.putInStore(retryStore, resultData);
        } else {
          throw e;
        }
      }
      console.log('[StorageManager] Result saved');
      return resultData.id;
    } catch (error) {
      console.error('[StorageManager] Error saving result:', error);
      this.handleStorageError(error, 'saveResult');
      throw error;
    }
  }
  
  /**
   * Get a processing result from IndexedDB
   * @param {string} id - Result ID
   * @returns {Promise<Object|null>} - Result data or null if not found
   */
  async getResult(id) {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }
      
      const transaction = this.db.transaction(['results'], 'readonly');
      const store = transaction.objectStore('results');
      
      const result = await this.getFromStore(store, id);
      
      if (result) {
        // Convert ArrayBuffers back to Blobs
        return {
          ...result,
          originalFile: new Blob([result.originalFile.data], { type: result.originalFile.type }),
          processedFile: new Blob([result.processedFile.data], { type: result.processedFile.type })
        };
      }
      
      return result;
    } catch (error) {
      console.error('[StorageManager] Error getting result:', error);
      throw error;
    }
  }
  
  /**
   * Get all processing results from IndexedDB
   * @returns {Promise<Array>} - Array of results
   */
  async getAllResults() {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }
      
      const transaction = this.db.transaction(['results'], 'readonly');
      const store = transaction.objectStore('results');
      
      const results = await this.getAllFromStore(store);
      
      // Convert ArrayBuffers back to Blobs
      return results.map(result => ({
        ...result,
        originalFile: new Blob([result.originalFile.data], { type: result.originalFile.type }),
        processedFile: new Blob([result.processedFile.data], { type: result.processedFile.type })
      }));
    } catch (error) {
      console.error('[StorageManager] Error getting all results:', error);
      throw error;
    }
  }
  
  /**
   * Delete a processing result from IndexedDB
   * @param {string} id - Result ID
   * @returns {Promise<void>}
   */
  async deleteResult(id) {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }
      
      const transaction = this.db.transaction(['results'], 'readwrite');
      const store = transaction.objectStore('results');
      
      await this.deleteFromStore(store, id);
      console.log(`[StorageManager] Result deleted: ${id}`);
    } catch (error) {
      console.error('[StorageManager] Error deleting result:', error);
      throw error;
    }
  }
  
  // === CACHE API METHODS ===
  
  /**
   * Cache a processed PDF
   * @param {Blob} blob - The PDF blob to cache
   * @param {string} filename - The filename to use as cache key
   * @returns {Promise<void>}
   */
  async cacheProcessedPDF(blob, filename) {
    try {
      if ('caches' in window) {
        const cache = await caches.open(this.cacheName);
        const response = new Response(blob);
        await cache.put(filename, response);
        console.log(`[StorageManager] Cached PDF: ${filename}`);
      }
    } catch (error) {
      console.error('[StorageManager] Error caching PDF:', error);
      this.handleStorageError(error, 'cacheProcessedPDF');
    }
  }
  
  /**
   * Get a cached PDF
   * @param {string} filename - The filename to retrieve
   * @returns {Promise<Blob|null>} - The cached PDF blob or null if not found
   */
  async getCachedPDF(filename) {
    try {
      if ('caches' in window) {
        const cache = await caches.open(this.cacheName);
        const response = await cache.match(filename);
        
        if (response) {
          return await response.blob();
        }
      }
      return null;
    } catch (error) {
      console.error('[StorageManager] Error getting cached PDF:', error);
      return null;
    }
  }
  
  /**
   * Clear all cached data
   * @returns {Promise<void>}
   */
  async clearCache() {
    try {
      if ('caches' in window) {
        await caches.delete(this.cacheName);
        await this.initCache(); // Reinitialize cache
        console.log('[StorageManager] Cache cleared');
      }
    } catch (error) {
      console.error('[StorageManager] Error clearing cache:', error);
    }
  }
  
  /**
   * Get cache size
   * @returns {Promise<number>} - Cache size in bytes
   */
  async getCacheSize() {
    try {
      if ('caches' in window) {
        const cache = await caches.open(this.cacheName);
        const keys = await cache.keys();
        let size = 0;
        
        for (const key of keys) {
          const response = await cache.match(key);
          if (response) {
            const blob = await response.blob();
            size += blob.size;
          }
        }
        
        return size;
      }
      return 0;
    } catch (error) {
      console.error('[StorageManager] Error getting cache size:', error);
      return 0;
    }
  }
  
  // === SETTINGS STORAGE ===
  
  /**
   * Save settings to IndexedDB
   * @param {Object} settings - Settings object to save
   * @returns {Promise<void>}
   */
  async saveSettings(settings) {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }
      
      const transaction = this.db.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      
      const settingsData = {
        key: 'userSettings',
        value: settings,
        lastUpdated: new Date()
      };
      
      await this.putInStore(store, settingsData);
      console.log('[StorageManager] Settings saved');
      
      // Also save to localStorage as backup
      this.syncWithLocalStorage(settings);
    } catch (error) {
      console.error('[StorageManager] Error saving settings:', error);
      this.handleStorageError(error, 'saveSettings');
      throw error;
    }
  }
  
  /**
   * Load settings from IndexedDB
   * @returns {Promise<Object>} - Settings object
   */
  async loadSettings() {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }
      
      const transaction = this.db.transaction(['settings'], 'readonly');
      const store = transaction.objectStore('settings');
      
      const result = await this.getFromStore(store, 'userSettings');
      
      if (result) {
        return result.value;
      }
      
      // Fallback to localStorage
      const localStorageSettings = localStorage.getItem(`${this.sessionPrefix}settings`);
      if (localStorageSettings) {
        return JSON.parse(localStorageSettings);
      }
      
      return {};
    } catch (error) {
      console.error('[StorageManager] Error loading settings:', error);
      return {};
    }
  }
  
  /**
   * Reset settings to default
   * @returns {Promise<void>}
   */
  async resetSettings() {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }
      
      const transaction = this.db.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      
      await this.deleteFromStore(store, 'userSettings');
      
      // Also clear localStorage
      localStorage.removeItem(`${this.sessionPrefix}settings`);
      
      console.log('[StorageManager] Settings reset to default');
    } catch (error) {
      console.error('[StorageManager] Error resetting settings:', error);
      throw error;
    }
  }
  
  // === QUOTA MANAGEMENT ===
  
  /**
   * Check storage quota
   * @returns {Promise<Object>} - Storage quota information
   */
  async checkStorageQuota() {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        this.storageQuota = estimate.quota;
        this.storageUsage = estimate.usage;
        
        return {
          quota: estimate.quota,
          usage: estimate.usage,
          percentage: estimate.usage && estimate.quota ? 
            Math.round((estimate.usage / estimate.quota) * 100) : 0
        };
      }
      return { quota: null, usage: null, percentage: 0 };
    } catch (error) {
      console.error('[StorageManager] Error checking storage quota:', error);
      return { quota: null, usage: null, percentage: 0 };
    }
  }
  
  /**
   * Request persistent storage
   * @returns {Promise<boolean>} - Whether persistent storage was granted
   */
  async requestPersistentStorage() {
    try {
      if ('storage' in navigator && 'persist' in navigator.storage) {
        const persistent = await navigator.storage.persist();
        console.log(`[StorageManager] Persistent storage granted: ${persistent}`);
        return persistent;
      }
      return false;
    } catch (error) {
      console.error('[StorageManager] Error requesting persistent storage:', error);
      return false;
    }
  }
  
  /**
   * Monitor storage usage
   * @returns {Promise<void>}
   */
  async monitorStorageUsage() {
    try {
      const quotaInfo = await this.checkStorageQuota();
      
      // Warn if storage is over 80% full
      if (quotaInfo.percentage > 80) {
        console.warn(`[StorageManager] Storage is ${quotaInfo.percentage}% full`);
        // In a real app, this would trigger a UI notification
      }
      
      console.log(`[StorageManager] Storage usage: ${quotaInfo.percentage}%`);
    } catch (error) {
      console.error('[StorageManager] Error monitoring storage usage:', error);
    }
  }
  
  // === TEMPORARY STORAGE ===
  
  /**
   * Save data to session storage
   * @param {string} key - Storage key
   * @param {any} value - Data to store
   * @returns {boolean} - Whether the operation succeeded
   */
  saveToSession(key, value) {
    try {
      const fullKey = `${this.sessionPrefix}${key}`;
      sessionStorage.setItem(fullKey, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('[StorageManager] Error saving to session storage:', error);
      this.handleStorageError(error, 'saveToSession');
      return false;
    }
  }
  
  /**
   * Get data from session storage
   * @param {string} key - Storage key
   * @returns {any} - Stored data or null
   */
  getFromSession(key) {
    try {
      const fullKey = `${this.sessionPrefix}${key}`;
      const item = sessionStorage.getItem(fullKey);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error('[StorageManager] Error getting from session storage:', error);
      return null;
    }
  }
  
  /**
   * Clear session storage
   * @returns {void}
   */
  clearSession() {
    try {
      // Only clear items with our prefix
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith(this.sessionPrefix)) {
          sessionStorage.removeItem(key);
        }
      });
      console.log('[StorageManager] Session storage cleared');
    } catch (error) {
      console.error('[StorageManager] Error clearing session storage:', error);
    }
  }
  
  // === EXPORT/IMPORT ===
  
  /**
   * Export all data as JSON
   * @returns {Promise<Blob>} - JSON blob of all data
   */
  async exportData() {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }
      
      // Get all data from IndexedDB
      const files = await this.getAllFiles();
      const settings = await this.loadSettings();
      
      // Get session storage data
      const sessionData = {};
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith(this.sessionPrefix)) {
          const cleanKey = key.replace(this.sessionPrefix, '');
          sessionData[cleanKey] = this.getFromSession(cleanKey);
        }
      });
      
      const exportData = {
        files: files.map(file => ({
          ...file,
          // Convert ArrayBuffer to base64 for export
          data: this.arrayBufferToBase64(file.data)
        })),
        settings,
        sessionData,
        exportDate: new Date().toISOString()
      };
      
      const json = JSON.stringify(exportData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      
      console.log('[StorageManager] Data exported');
      return blob;
    } catch (error) {
      console.error('[StorageManager] Error exporting data:', error);
      throw error;
    }
  }
  
  /**
   * Import data from JSON file
   * @param {File} file - JSON file to import
   * @returns {Promise<void>}
   */
  async importData(file) {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }
      
      // Read file as text
      const text = await file.text();
      const importData = JSON.parse(text);
      
      // Import files
      if (importData.files && Array.isArray(importData.files)) {
        const transaction = this.db.transaction(['files'], 'readwrite');
        const store = transaction.objectStore('files');
        
        for (const file of importData.files) {
          // Convert base64 back to ArrayBuffer
          file.data = this.base64ToArrayBuffer(file.data);
          await this.putInStore(store, file);
        }
      }
      
      // Import settings
      if (importData.settings) {
        await this.saveSettings(importData.settings);
      }
      
      // Import session data
      if (importData.sessionData) {
        Object.keys(importData.sessionData).forEach(key => {
          this.saveToSession(key, importData.sessionData[key]);
        });
      }
      
      console.log('[StorageManager] Data imported successfully');
    } catch (error) {
      console.error('[StorageManager] Error importing data:', error);
      throw error;
    }
  }
  
  // === SYNCHRONIZATION ===
  
  /**
   * Synchronize settings with localStorage
   * @param {Object} settings - Settings to sync
   * @returns {void}
   */
  syncWithLocalStorage(settings = null) {
    try {
      if (settings) {
        localStorage.setItem(`${this.sessionPrefix}settings`, JSON.stringify(settings));
      } else {
        // Sync from IndexedDB to localStorage
        this.loadSettings().then(settings => {
          if (Object.keys(settings).length > 0) {
            localStorage.setItem(`${this.sessionPrefix}settings`, JSON.stringify(settings));
          }
        });
      }
    } catch (error) {
      console.error('[StorageManager] Error syncing with localStorage:', error);
    }
  }
  
  /**
   * Handle storage change events
   * @param {StorageEvent} event - Storage change event
   * @returns {void}
   */
  handleStorageChange(event) {
    if (event.key && event.key.startsWith(this.sessionPrefix)) {
      console.log(`[StorageManager] Storage changed: ${event.key}`);
      // In a real app, this would trigger appropriate UI updates
    }
  }
  
  // === CLEANUP ===
  
  /**
   * Perform cleanup operations
   * @param {number} daysOld - Files older than this will be deleted
   * @returns {Promise<void>}
   */
  async cleanup(daysOld = 7) {
    try {
      // Clear old files
      await this.clearOldFiles(daysOld);
      
      // Monitor storage usage
      await this.monitorStorageUsage();
      
      console.log('[StorageManager] Cleanup completed');
    } catch (error) {
      console.error('[StorageManager] Error during cleanup:', error);
    }
  }
  
  /**
   * Perform garbage collection
   * @returns {Promise<void>}
   */
  async garbageCollect() {
    try {
      // Close database connection if needed
      if (this.db) {
        this.db.close();
        this.db = null;
      }
      
      // Reinitialize
      await this.initDB();
      
      console.log('[StorageManager] Garbage collection completed');
    } catch (error) {
      console.error('[StorageManager] Error during garbage collection:', error);
    }
  }
  
  // === ERROR HANDLING ===
  
  /**
   * Handle storage errors
   * @param {Error} error - The error that occurred
   * @param {string} operation - The operation that failed
   * @returns {void}
   */
  handleStorageError(error, operation) {
    if (error.name === 'QuotaExceededError') {
      console.error(`[StorageManager] Storage quota exceeded during ${operation}`);
      // In a real app, this would trigger a UI notification
      // and possibly cleanup operations
    } else {
      console.error(`[StorageManager] Storage error during ${operation}:`, error);
    }
    
    // Attempt to use memory storage as fallback
    this.useMemoryStorageFallback();
  }
  
  /**
   * Use memory storage as fallback
   * @returns {void}
   */
  useMemoryStorageFallback() {
    console.warn('[StorageManager] Using memory storage as fallback');
    // In a real implementation, this would switch to
    // storing data in memory when persistent storage fails
  }
  
  // === HELPER METHODS ===
  
  /**
   * Generate unique ID
   * @returns {string} - Unique ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
  
  /**
   * Put data in IndexedDB store
   * @param {IDBObjectStore} store - The object store
   * @param {any} data - Data to store
   * @returns {Promise<void>}
   */
  putInStore(store, data) {
    return new Promise((resolve, reject) => {
      const request = store.put(data);
      
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(event.target.error);
    });
  }
  
  /**
   * Get data from IndexedDB store
   * @param {IDBObjectStore} store - The object store
   * @param {string} key - Key to retrieve
   * @returns {Promise<any>} - Retrieved data
   */
  getFromStore(store, key) {
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      
      request.onsuccess = (event) => resolve(event.target.result || null);
      request.onerror = (event) => reject(event.target.error);
    });
  }
  
  /**
   * Delete data from IndexedDB store
   * @param {IDBObjectStore} store - The object store
   * @param {string} key - Key to delete
   * @returns {Promise<void>}
   */
  deleteFromStore(store, key) {
    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(event.target.error);
    });
  }
  
  /**
   * Get all data from IndexedDB store
   * @param {IDBObjectStore} store - The object store
   * @returns {Promise<Array>} - All data in store
   */
  getAllFromStore(store) {
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      
      request.onsuccess = (event) => resolve(event.target.result || []);
      request.onerror = (event) => reject(event.target.error);
    });
  }
  
  /**
   * Convert ArrayBuffer to base64
   * @param {ArrayBuffer} buffer - Buffer to convert
   * @returns {string} - Base64 string
   */
  arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  
  /**
   * Convert base64 to ArrayBuffer
   * @param {string} base64 - Base64 string to convert
   * @returns {ArrayBuffer} - ArrayBuffer
   */
  base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

// Export singleton instance
const storageManager = new StorageManager();
export { storageManager };
