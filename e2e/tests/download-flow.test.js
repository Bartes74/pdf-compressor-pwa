// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Download Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should download processed PDF', async ({ page }) => {
    // Upload a test file
    const testFile = Buffer.from('%PDF-1.4 test content');
    await page.setInputFiles('#fileInput', {
      name: 'test.pdf',
      mimeType: 'application/pdf',
      buffer: testFile
    });
    
    // Process the file
    await page.click('#processBtn');
    await page.waitForSelector('#resultsSection', { state: 'visible' });
    
    // Click download button
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#compressedDownload')
    ]);
    
    // Verify download
    expect(download.suggestedFilename()).toContain('.pdf');
  });

  test('should download original PDF', async ({ page }) => {
    // Upload a test file
    const testFile = Buffer.from('%PDF-1.4 test content');
    await page.setInputFiles('#fileInput', {
      name: 'test.pdf',
      mimeType: 'application/pdf',
      buffer: testFile
    });
    
    // Process the file
    await page.click('#processBtn');
    await page.waitForSelector('#resultsSection', { state: 'visible' });
    
    // Click download button
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#originalDownload')
    ]);
    
    // Verify download
    expect(download.suggestedFilename()).toContain('.pdf');
  });
});