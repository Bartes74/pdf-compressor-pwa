// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Offline Mode', () => {
  test('should display offline page when offline', async ({ page }) => {
    // Go to the app
    await page.goto('/');
    
    // Simulate offline mode
    await page.context().setOffline(true);
    
    // Try to navigate to a page that would require network
    await page.reload();
    
    // Verify offline page is displayed
    await expect(page).toHaveTitle(/offline/i);
    await expect(page.locator('h1')).toHaveText(/offline/i);
    
    // Verify retry button exists
    await expect(page.locator('#retryBtn')).toBeVisible();
  });

  test('should return to app when connection restored', async ({ page }) => {
    // Go to the app
    await page.goto('/');
    
    // Simulate offline mode
    await page.context().setOffline(true);
    
    // Try to navigate to a page that would require network
    await page.reload();
    
    // Verify offline page is displayed
    await expect(page).toHaveTitle(/offline/i);
    
    // Restore connection
    await page.context().setOffline(false);
    
    // Click retry button
    await page.click('#retryBtn');
    
    // Verify we're back to the main app
    await expect(page).not.toHaveTitle(/offline/i);
    await expect(page.locator('#dropArea')).toBeVisible();
  });
});