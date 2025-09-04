import { PDFProcessor } from '../js/pdf-processor.js';

// Mock pdf-lib
jest.mock('pdf-lib', () => ({
  PDFDocument: {
    load: jest.fn().mockResolvedValue({
      getPageCount: jest.fn().mockReturnValue(5),
      getPages: jest.fn().mockReturnValue([
        { 
          // Mock page object
        },
        { 
          // Mock page object
        },
        { 
          // Mock page object
        },
        { 
          // Mock page object
        },
        { 
          // Mock page object
        }
      ]),
      getTitle: jest.fn().mockReturnValue('Test PDF'),
      getAuthor: jest.fn().mockReturnValue('Test Author'),
      getSubject: jest.fn().mockReturnValue('Test Subject'),
      getKeywords: jest.fn().mockReturnValue('test, pdf'),
      getCreator: jest.fn().mockReturnValue('Test Creator'),
      getProducer: jest.fn().mockReturnValue('Test Producer'),
      getCreationDate: jest.fn().mockReturnValue(new Date()),
      getModificationDate: jest.fn().mockReturnValue(new Date())
    }),
    create: jest.fn().mockResolvedValue({
      addPage: jest.fn(),
      copyPages: jest.fn().mockResolvedValue([{}]),
      getPageCount: jest.fn().mockReturnValue(0),
      save: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4]))
    })
  }
}));

// Mock File API
global.File = class MockFile {
  constructor(bits, name, options = {}) {
    this.name = name;
    this.size = bits ? bits.reduce((acc, bit) => acc + (typeof bit === 'string' ? bit.length : bit.byteLength || 0), 0) : 0;
    this.type = options.type || 'application/pdf';
  }
};

describe('PDFProcessor', () => {
  let pdfProcessor;

  beforeEach(() => {
    pdfProcessor = new PDFProcessor();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('loadPDF', () => {
    it('should load a valid PDF file', async () => {
      const mockFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      
      const result = await pdfProcessor.loadPDF(mockFile);
      
      expect(result).toHaveProperty('pdfDoc');
      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('arrayBuffer');
      expect(result.metadata.title).toBe('Test PDF');
    });

    it('should reject invalid PDF files', async () => {
      const invalidFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
      
      await expect(pdfProcessor.loadPDF(invalidFile)).rejects.toThrow('Invalid PDF file');
    });
  });

  describe('compressImages', () => {
    it('should compress images in a PDF document', async () => {
      const mockPdfDoc = {
        getPages: jest.fn().mockReturnValue([
          {}, {}, {}
        ])
      };
      
      const progressCallback = jest.fn();
      
      const result = await pdfProcessor.compressImages(mockPdfDoc, 70, progressCallback);
      
      expect(result).toBe(mockPdfDoc);
      expect(progressCallback).toHaveBeenCalledTimes(3);
    });

    it('should handle compression errors', async () => {
      const mockPdfDoc = {
        getPages: jest.fn().mockImplementation(() => {
          throw new Error('Compression failed');
        })
      };
      
      await expect(pdfProcessor.compressImages(mockPdfDoc, 70)).rejects.toThrow('Failed to compress images');
    });
  });

  describe('removeImages', () => {
    it('should remove images from a PDF document', async () => {
      const mockPdfDoc = {
        getPages: jest.fn().mockReturnValue([
          {}, {}, {}
        ])
      };
      
      const result = await pdfProcessor.removeImages(mockPdfDoc);
      
      expect(result).toBe(mockPdfDoc);
    });

    it('should handle image removal errors', async () => {
      const mockPdfDoc = {
        getPages: jest.fn().mockImplementation(() => {
          throw new Error('Image removal failed');
        })
      };
      
      await expect(pdfProcessor.removeImages(mockPdfDoc)).rejects.toThrow('Failed to remove images');
    });
  });

  describe('splitByPages', () => {
    it('should split a PDF by page range', async () => {
      const mockPdfDoc = {
        getPageCount: jest.fn().mockReturnValue(10),
        copyPages: jest.fn().mockResolvedValue([{}])
      };
      
      const result = await pdfProcessor.splitByPages(mockPdfDoc, 2, 5);
      
      expect(result.getPageCount()).toBe(0); // Mocked value
      expect(mockPdfDoc.copyPages).toHaveBeenCalledWith(mockPdfDoc, [1]); // 0-based index
    });

    it('should reject invalid page ranges', async () => {
      const mockPdfDoc = {
        getPageCount: jest.fn().mockReturnValue(5)
      };
      
      await expect(pdfProcessor.splitByPages(mockPdfDoc, 10, 15)).rejects.toThrow('Invalid page range');
    });
  });

  describe('splitBySize', () => {
    it('should split a PDF by file size', async () => {
      const mockPdfDoc = {
        getPageCount: jest.fn().mockReturnValue(20),
        copyPages: jest.fn().mockResolvedValue([{}])
      };
      
      const progressCallback = jest.fn();
      
      const result = await pdfProcessor.splitBySize(mockPdfDoc, 10, progressCallback);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('optimizePDF', () => {
    it('should optimize a PDF for web viewing', async () => {
      const mockPdfDoc = {}; // Mock PDF document
      
      const result = await pdfProcessor.optimizePDF(mockPdfDoc);
      
      expect(result).toBe(mockPdfDoc);
    });
  });

  describe('processPDF', () => {
    it('should process a PDF with all options', async () => {
      // Create a mock file
      const mockFile = new File([new ArrayBuffer(1000)], 'test.pdf', { type: 'application/pdf' });
      
      // Mock all the processing methods
      pdfProcessor.loadPDF = jest.fn().mockResolvedValue({
        pdfDoc: {},
        metadata: { title: 'Test PDF', pageCount: 5 }
      });
      
      pdfProcessor.compressImages = jest.fn().mockResolvedValue({});
      pdfProcessor.removeImages = jest.fn().mockResolvedValue({});
      pdfProcessor.splitByPages = jest.fn().mockResolvedValue({});
      pdfProcessor.optimizePDF = jest.fn().mockResolvedValue({});
      
      const options = {
        imageCompression: true,
        imageQuality: 70,
        removeImages: true,
        splitPDF: true,
        splitMethod: 'pages',
        pageRange: '1-3'
      };
      
      const result = await pdfProcessor.processPDF(mockFile, options);
      
      expect(result).toHaveProperty('originalFile');
      expect(result).toHaveProperty('processedFile');
      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('savings');
    });
  });

  describe('Performance', () => {
    it('should process PDFs within acceptable time limits', async () => {
      const mockFile = new File([new ArrayBuffer(1000)], 'test.pdf', { type: 'application/pdf' });
      
      pdfProcessor.loadPDF = jest.fn().mockResolvedValue({
        pdfDoc: {},
        metadata: { title: 'Test PDF', pageCount: 5 }
      });
      
      pdfProcessor.compressImages = jest.fn().mockResolvedValue({});
      pdfProcessor.removeImages = jest.fn().mockResolvedValue({});
      pdfProcessor.optimizePDF = jest.fn().mockResolvedValue({});
      
      const options = {
        imageCompression: true,
        imageQuality: 70,
        removeImages: false,
        splitPDF: false
      };
      
      const startTime = performance.now();
      await pdfProcessor.processPDF(mockFile, options);
      const endTime = performance.now();
      
      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});