// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Processing Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should process PDF with default options', async ({ page }) => {
    // Upload a test file
    const testFile = Buffer.from('%PDF-1.4 test content');
    await page.setInputFiles('#fileInput', {
      name: 'test.pdf',
      mimeType: 'application/pdf',
      buffer: testFile
    });
    
    // Click process button
    await page.click('#processBtn');
    
    // Verify progress is shown
    await expect(page.locator('#progressSection')).toBeVisible();
    
    // Wait for processing to complete (mocked in this case)
    await page.waitForSelector('#resultsSection', { state: 'visible' });
    
    // Verify results are displayed
    await expect(page.locator('#resultsSection')).toBeVisible();
    await expect(page.locator('#originalSize')).toBeVisible();
    await expect(page.locator('#compressedSize')).toBeVisible();
  });

  test('should process PDF with compression options', async ({ page }) => {
    // Upload a test file
    const testFile = Buffer.from('%PDF-1.4 test content');
    await page.setInputFiles('#fileInput', {
      name: 'test.pdf',
      mimeType: 'application/pdf',
      buffer: testFile
    });
    
    // Enable image compression
    await page.check('#imageCompressionToggle');
    
    // Adjust quality
    await page.fill('#qualitySlider', '50');
    
    // Click process button
    await page.click('#processBtn');
    
    // Verify processing completes
    await page.waitForSelector('#resultsSection', { state: 'visible' });
    await expect(page.locator('#resultsSection')).toBeVisible();
  });

  test('should process PDF with image removal', async ({ page }) => {
    // Upload a test file
    const testFile = Buffer.from('%PDF-1.4 test content');
    await page.setInputFiles('#fileInput', {
      name: 'test.pdf',
      mimeType: 'application/pdf',
      buffer: testFile
    });
    
    // Enable image removal
    await page.check('#removeImagesToggle');
    
    // Click process button
    await page.click('#processBtn');
    
    // Verify processing completes
    await page.waitForSelector('#resultsSection', { state: 'visible' });
    await expect(page.locator('#resultsSection')).toBeVisible();
  });
});