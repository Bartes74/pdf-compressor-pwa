// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Upload Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display upload area', async ({ page }) => {
    await expect(page.locator('#dropArea')).toBeVisible();
    await expect(page.locator('#browseBtn')).toBeVisible();
    await expect(page.locator('#fileInput')).toBeHidden();
  });

  test('should allow file selection via browse button', async ({ page }) => {
    // Create a test file
    const testFile = Buffer.from('%PDF-1.4 test content');
    
    // Mock the file input
    await page.setInputFiles('#fileInput', {
      name: 'test.pdf',
      mimeType: 'application/pdf',
      buffer: testFile
    });
    
    // Click browse button
    await page.click('#browseBtn');
    
    // Verify file info is displayed
    await expect(page.locator('#fileInfoPanel')).toBeVisible();
    await expect(page.locator('#fileName')).toHaveText('test.pdf');
  });

  test('should allow drag and drop', async ({ page }) => {
    // Create a test file
    const testFile = Buffer.from('%PDF-1.4 test content');
    
    // Drag and drop file
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.dispatchEvent('#dropArea', 'drop', {
        dataTransfer: {
          files: [{
            name: 'test.pdf',
            type: 'application/pdf',
            buffer: testFile
          }]
        }
      })
    ]);
    
    // Verify file info is displayed
    await expect(page.locator('#fileInfoPanel')).toBeVisible();
  });
});