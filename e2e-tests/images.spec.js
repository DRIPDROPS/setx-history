const { test, expect } = require('@playwright/test');

test.describe('Historical Gallery Images', () => {
  test('should load and be visible', async ({ page }) => {
    // Navigate to the page
    page.on('console', msg => console.log(msg.text()));
    await page.goto('http://localhost:3002/');

    // Wait for the gallery to be present
    await page.waitForSelector('.historical-gallery');

    // Get all image locators within the gallery
    const images = page.locator('.historical-gallery img');

    // Expect there to be 4 images
    await expect(images).toHaveCount(4);

    // Check each image
    for (let i = 0; i < 4; i++) {
      const image = images.nth(i);

      // 1. Check that the image element is visible
      await expect(image).toBeVisible();

      // 2. Check that the src attribute is not empty
      const src = await image.getAttribute('src');
      expect(src).not.toBe('');

      // 3. Check the HTTP response of the image URL
      const response = await page.request.get(`http://localhost:3002${src}`);
      expect(response.status()).toBe(200);
    }
  });
});
