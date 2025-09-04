// Setup tests for Jest
require('jest-canvas-mock');

// Add TextEncoder and TextDecoder to global scope
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

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

// Mock IndexedDB
const mockIndexedDB = {
  open: jest.fn().mockReturnValue({
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
    onsuccess: jest.fn(),
    onerror: jest.fn(),
    onupgradeneeded: jest.fn()
  }),
  deleteDatabase: jest.fn().mockReturnValue({
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn()
  }),
  cmp: jest.fn(),
  databases: jest.fn().mockResolvedValue([])
};

Object.defineProperty(window, 'indexedDB', {
  writable: true,
  value: mockIndexedDB
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