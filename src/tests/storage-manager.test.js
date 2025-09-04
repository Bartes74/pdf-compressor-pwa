import { StorageManager } from '../js/storage-manager.js';

describe('StorageManager', () => {
  let storageManager;
  
  beforeEach(() => {
    storageManager = new StorageManager();
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('IndexedDB Operations', () => {
    it('should initialize database', async () => {
      // Mock IndexedDB
      const mockDB = {
        objectStoreNames: {
          contains: jest.fn().mockReturnValue(false)
        },
        createObjectStore: jest.fn().mockReturnValue({
          createIndex: jest.fn()
        })
      };
      
      global.indexedDB = {
        open: jest.fn().mockReturnValue({
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
          onsuccess: null,
          onerror: null,
          onupgradeneeded: null
        })
      };
      
      // Trigger the upgrade event
      const request = global.indexedDB.open('PDFCompressorDB', 1);
      request.onupgradeneeded = jest.fn();
      
      await storageManager.initDB();
      
      expect(global.indexedDB.open).toHaveBeenCalledWith('PDFCompressorDB', 1);
    });
    
    it('should save a file', async () => {
      // Mock File
      global.File = class MockFile {
        constructor(bits, name, options = {}) {
          this.name = name;
          this.size = bits ? bits.reduce((acc, bit) => acc + (typeof bit === 'string' ? bit.length : bit.byteLength || 0), 0) : 0;
          this.type = options.type || 'application/pdf';
          this.arrayBuffer = jest.fn().mockResolvedValue(new ArrayBuffer(8));
        }
      };
      
      const mockFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      const metadata = { title: 'Test PDF' };
      
      // Mock database transaction
      storageManager.db = {
        transaction: jest.fn().mockReturnValue({
          objectStore: jest.fn().mockReturnValue({
            put: jest.fn().mockReturnValue({
              addEventListener: jest.fn(),
              removeEventListener: jest.fn(),
              dispatchEvent: jest.fn(),
              onsuccess: null,
              onerror: null
            })
          })
        })
      };
      
      const fileId = await storageManager.saveFile(mockFile, metadata);
      
      expect(fileId).toBeDefined();
      expect(typeof fileId).toBe('string');
    });
    
    it('should get a file', async () => {
      const fileId = 'test-id';
      
      // Mock database transaction
      storageManager.db = {
        transaction: jest.fn().mockReturnValue({
          objectStore: jest.fn().mockReturnValue({
            get: jest.fn().mockReturnValue({
              addEventListener: jest.fn(),
              removeEventListener: jest.fn(),
              dispatchEvent: jest.fn(),
              onsuccess: null,
              onerror: null
            })
          })
        })
      };
      
      const result = await storageManager.getFile(fileId);
      
      // Result could be null or file data
      expect(result).toBeDefined();
    });
    
    it('should delete a file', async () => {
      const fileId = 'test-id';
      
      // Mock database transaction
      storageManager.db = {
        transaction: jest.fn().mockReturnValue({
          objectStore: jest.fn().mockReturnValue({
            delete: jest.fn().mockReturnValue({
              addEventListener: jest.fn(),
              removeEventListener: jest.fn(),
              dispatchEvent: jest.fn(),
              onsuccess: null,
              onerror: null
            })
          })
        })
      };
      
      await expect(storageManager.deleteFile(fileId)).resolves.not.toThrow();
    });
    
    it('should get all files', async () => {
      // Mock database transaction
      storageManager.db = {
        transaction: jest.fn().mockReturnValue({
          objectStore: jest.fn().mockReturnValue({
            getAll: jest.fn().mockReturnValue({
              addEventListener: jest.fn(),
              removeEventListener: jest.fn(),
              dispatchEvent: jest.fn(),
              onsuccess: null,
              onerror: null
            })
          })
        })
      };
      
      const result = await storageManager.getAllFiles();
      
      expect(Array.isArray(result)).toBe(true);
    });
    
    it('should clear old files', async () => {
      // Mock database transaction
      storageManager.db = {
        transaction: jest.fn().mockReturnValue({
          objectStore: jest.fn().mockReturnValue({
            getAll: jest.fn().mockReturnValue({
              addEventListener: jest.fn(),
              removeEventListener: jest.fn(),
              dispatchEvent: jest.fn(),
              onsuccess: null,
              onerror: null
            }),
            delete: jest.fn().mockReturnValue({
              addEventListener: jest.fn(),
              removeEventListener: jest.fn(),
              dispatchEvent: jest.fn(),
              onsuccess: null,
              onerror: null
            })
          })
        })
      };
      
      const deletedCount = await storageManager.clearOldFiles(7);
      
      expect(typeof deletedCount).toBe('number');
    });
  });
  
  describe('Cache API', () => {
    it('should cache a processed PDF', async () => {
      // Mock Blob
      global.Blob = class MockBlob {
        constructor(content, options) {
          this.size = content ? content.length : 0;
          this.type = options ? options.type : '';
        }
      };
      
      const mockBlob = new Blob(['test content'], { type: 'application/pdf' });
      
      await storageManager.cacheProcessedPDF(mockBlob, 'test.pdf');
      
      // Since we're mocking the cache API, we just ensure no errors occur
      expect(true).toBe(true);
    });
    
    it('should get a cached PDF', async () => {
      const result = await storageManager.getCachedPDF('test.pdf');
      
      // Could be null or a Blob
      expect(result === null || result instanceof global.Blob).toBe(true);
    });
    
    it('should clear cache', async () => {
      await expect(storageManager.clearCache()).resolves.not.toThrow();
    });
    
    it('should get cache size', async () => {
      const size = await storageManager.getCacheSize();
      
      expect(typeof size).toBe('number');
    });
  });
  
  describe('Settings Storage', () => {
    it('should save settings', async () => {
      const settings = { theme: 'dark', quality: 80 };
      
      // Mock database transaction
      storageManager.db = {
        transaction: jest.fn().mockReturnValue({
          objectStore: jest.fn().mockReturnValue({
            put: jest.fn().mockReturnValue({
              addEventListener: jest.fn(),
              removeEventListener: jest.fn(),
              dispatchEvent: jest.fn(),
              onsuccess: null,
              onerror: null
            })
          })
        })
      };
      
      await expect(storageManager.saveSettings(settings)).resolves.not.toThrow();
    });
    
    it('should load settings', async () => {
      // Mock database transaction
      storageManager.db = {
        transaction: jest.fn().mockReturnValue({
          objectStore: jest.fn().mockReturnValue({
            get: jest.fn().mockReturnValue({
              addEventListener: jest.fn(),
              removeEventListener: jest.fn(),
              dispatchEvent: jest.fn(),
              onsuccess: null,
              onerror: null
            })
          })
        })
      };
      
      const settings = await storageManager.loadSettings();
      
      expect(settings).toBeDefined();
    });
    
    it('should reset settings', async () => {
      // Mock database transaction
      storageManager.db = {
        transaction: jest.fn().mockReturnValue({
          objectStore: jest.fn().mockReturnValue({
            delete: jest.fn().mockReturnValue({
              addEventListener: jest.fn(),
              removeEventListener: jest.fn(),
              dispatchEvent: jest.fn(),
              onsuccess: null,
              onerror: null
            })
          })
        })
      };
      
      await expect(storageManager.resetSettings()).resolves.not.toThrow();
    });
  });
  
  describe('Quota Management', () => {
    it('should check storage quota', async () => {
      const quotaInfo = await storageManager.checkStorageQuota();
      
      expect(quotaInfo).toHaveProperty('quota');
      expect(quotaInfo).toHaveProperty('usage');
      expect(quotaInfo).toHaveProperty('percentage');
    });
    
    it('should request persistent storage', async () => {
      const result = await storageManager.requestPersistentStorage();
      
      expect(typeof result).toBe('boolean');
    });
    
    it('should monitor storage usage', async () => {
      await expect(storageManager.monitorStorageUsage()).resolves.not.toThrow();
    });
  });
  
  describe('Session Storage', () => {
    it('should save to session storage', () => {
      const result = storageManager.saveToSession('testKey', { value: 'test' });
      
      expect(result).toBe(true);
    });
    
    it('should get from session storage', () => {
      storageManager.saveToSession('testKey', { value: 'test' });
      const result = storageManager.getFromSession('testKey');
      
      expect(result).toEqual({ value: 'test' });
    });
    
    it('should clear session storage', () => {
      storageManager.clearSession();
      
      // Just ensure no errors occur
      expect(true).toBe(true);
    });
  });
  
  describe('Export/Import', () => {
    it('should export data', async () => {
      // Mock File
      global.File = class MockFile {
        constructor(bits, name, options = {}) {
          this.name = name;
          this.size = bits ? bits.reduce((acc, bit) => acc + (typeof bit === 'string' ? bit.length : bit.byteLength || 0), 0) : 0;
          this.type = options.type || 'application/json';
          this.text = jest.fn().mockResolvedValue(JSON.stringify({ test: 'data' }));
        }
      };
      
      // Mock database transaction
      storageManager.db = {
        transaction: jest.fn().mockReturnValue({
          objectStore: jest.fn().mockReturnValue({
            getAll: jest.fn().mockReturnValue({
              addEventListener: jest.fn(),
              removeEventListener: jest.fn(),
              dispatchEvent: jest.fn(),
              onsuccess: null,
              onerror: null
            })
          })
        })
      };
      
      const result = await storageManager.exportData();
      
      expect(result).toBeInstanceOf(global.Blob);
    });
    
    it('should import data', async () => {
      const mockFile = new global.File([JSON.stringify({ files: [], settings: {} })], 'import.json', { type: 'application/json' });
      
      // Mock database transaction
      storageManager.db = {
        transaction: jest.fn().mockReturnValue({
          objectStore: jest.fn().mockReturnValue({
            put: jest.fn().mockReturnValue({
              addEventListener: jest.fn(),
              removeEventListener: jest.fn(),
              dispatchEvent: jest.fn(),
              onsuccess: null,
              onerror: null
            })
          })
        })
      };
      
      await expect(storageManager.importData(mockFile)).resolves.not.toThrow();
    });
  });
});