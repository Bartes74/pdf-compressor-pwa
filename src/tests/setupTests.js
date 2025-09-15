/* global global */
// Setup tests for Jest
require('jest-canvas-mock');

// Add TextEncoder and TextDecoder to global scope
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Provide PDF libraries loader and global PDFLib for code paths that expect window.PDFLib
Object.defineProperty(window, 'loadPDFLibraries', {
  writable: true,
  value: jest.fn(async () => {
    try {
      // Use the mocked pdf-lib module when present
      // eslint-disable-next-line global-require
      const mocked = require('pdf-lib');
      window.PDFLib = mocked;
      return true;
    } catch (_) {
      return false;
    }
  })
});

// Mock Fetch API Response used by Cache API paths
class MockResponse {
  constructor(body) {
    this._body = body;
  }
  async blob() {
    if (this._body && typeof this._body.arrayBuffer === 'function') {
      // Blob
      return this._body;
    }
    // Fallback minimal blob
    // eslint-disable-next-line no-undef
    return new Blob([this._body || '']);
  }
}
// eslint-disable-next-line no-undef
global.Response = MockResponse;

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IndexedDB with async event invocation so initDB() resolves
Object.defineProperty(window, 'indexedDB', {
  writable: true,
  value: {
    open: jest.fn().mockImplementation(() => {
      const req = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null
      };
      // Simulate upgrade then success in next ticks
      setTimeout(() => {
        if (typeof req.onupgradeneeded === 'function') {
          req.onupgradeneeded({ target: { result: { objectStoreNames: { contains: () => false }, createObjectStore: () => ({ createIndex: () => {} }) } } });
        }
        if (typeof req.onsuccess === 'function') {
          req.onsuccess({ target: { result: {} } });
        }
      }, 0);
      return req;
    }),
    deleteDatabase: jest.fn().mockReturnValue({
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn()
    }),
    cmp: jest.fn(),
    databases: jest.fn().mockResolvedValue([])
  }
});

// Mock Cache API
const mockCache = {
  match: jest.fn().mockResolvedValue(null),
  put: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue(true),
  keys: jest.fn().mockResolvedValue([]),
  add: jest.fn().mockResolvedValue(undefined),
  addAll: jest.fn().mockResolvedValue(undefined),
  matchAll: jest.fn().mockResolvedValue([])
};

const mockCaches = {
  open: jest.fn().mockResolvedValue(mockCache),
  has: jest.fn().mockResolvedValue(true),
  delete: jest.fn().mockResolvedValue(true),
  keys: jest.fn().mockResolvedValue([])
};

Object.defineProperty(window, 'caches', {
  writable: true,
  value: mockCaches
});

// Mock Storage API
Object.defineProperty(navigator, 'storage', {
  writable: true,
  value: {
    estimate: jest.fn().mockResolvedValue({
      quota: 1000000000,
      usage: 50000000
    }),
    persist: jest.fn().mockResolvedValue(true),
    persisted: jest.fn().mockResolvedValue(true)
  }
});

// Mock Worker
global.Worker = class {
  constructor(stringUrl) {
    this.url = stringUrl;
    this.onmessage = () => {};
  }

  postMessage(msg) {
    this.onmessage({ data: msg });
  }

  terminate() {}
};

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock FileReader
global.FileReader = class FileReader {
  readAsArrayBuffer() {
    setTimeout(() => {
      if (this.onload) {
        this.onload({
          target: {
            result: new ArrayBuffer(8)
          }
        });
      }
    }, 100);
  }
};

// Mock DOM methods
document.createRange = () => {
  return {
    setStart: () => {},
    setEnd: () => {},
    commonAncestorContainer: {
      nodeName: 'BODY',
      ownerDocument: document,
    },
  };
};

global.structuredClone = (val) => JSON.parse(JSON.stringify(val));