module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/tests/setupTests.js'],
  collectCoverageFrom: [
    'src/js/**/*.js',
    '!src/js/pdf-worker.js', // Web Workers can't be tested in JSDOM
    '!src/js/**/*.test.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testMatch: ['**/src/tests/**/*.test.js'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/src/tests/__mocks__/fileMock.js'
  },
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  transformIgnorePatterns: [
    '/node_modules/(?!pdf-lib|pdfjs-dist)/'
  ],
  reporters: [
    'default',
    ['jest-html-reporters', {
      'publicPath': './coverage',
      'filename': 'test-report.html',
      'expand': true
    }]
  ],
  testTimeout: 30000
};