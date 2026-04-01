const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = 'C:/Users/duper/micro-tools/screenshots';

async function screenshot(page, name) {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const fp = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: fp, fullPage: false });
  console.log(`Screenshot: ${fp}`);
}

async function main() {
  console.log('Connecting to Chrome via CDP...');
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const page = context.pages()[0];

  // Go to overview
  await page.goto('https://ads.google.com/aw/overview?ocid=7472909166&authuser=0&__u=8599148613&__c=2087511934', {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await page.waitForTimeout(4000);

  // Click the FAB button
  console.log('Clicking FAB (作成) button...');
  await page.click('material-fab[aria-label="作成"]');
  await page.waitForTimeout(2000);

  // Now click the キャンペーン item from the FAB menu specifically
  // The FAB menu items have aria-label attributes
  console.log('Looking for キャンペーン menu item with aria-label...');
  const campMenuItem = await page.$('[aria-label="キャンペーン"][role="menuitem"], [aria-label="キャンペーン"][role="option"]');
  if (campMenuItem) {
    console.log('Found キャンペーン menu item, clicking...');
    await campMenuItem.click();
  } else {
    // Try a different approach - look at the FAB menu structure
    console.log('Trying to find FAB menu items...');
    const fabMenuItems = await page.$$('material-fab ~ * [role="menuitem"], material-fab ~ * [aria-label="キャンペーン"]');
    console.log(`Found ${fabMenuItems.length} fab menu items`);

    // Let's get the specific structure
    const menuStructure = await page.evaluate(() => {
      // Look for the floating menu that appeared
      const items = document.querySelectorAll('[aria-label="キャンペーン"]');
      return Array.from(items).map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim().substring(0, 100),
        role: el.getAttribute('role'),
        ariaLabel: el.getAttribute('aria-label'),
        className: el.className?.substring(0, 100),
        parentTag: el.parentElement?.tagName,
        parentClass: el.parentElement?.className?.substring(0, 100),
      }));
    });
    console.log('Elements with aria-label キャンペーン:', JSON.stringify(menuStructure, null, 2));

    // Click the one that's a menu item
    for (const item of menuStructure) {
      if (item.tag === 'MATERIAL-LIST-ITEM' || item.role === 'menuitem' || item.role === 'option') {
        const el = await page.$(`${item.tag}[aria-label="キャンペーン"]`);
        if (el) {
          await el.click();
          console.log('Clicked', item.tag);
          break;
        }
      }
    }

    // If still not found, just click the first menu-like item
    if (menuStructure.length > 0) {
      const firstItem = menuStructure[0];
      console.log('Clicking first キャンペーン element:', firstItem.tag);
      const el = await page.locator('[aria-label="キャンペーン"]').first();
      await el.click();
    }
  }

  await page.waitForTimeout(8000);
  console.log('URL after clicking キャンペーン:', page.url());
  await screenshot(page, '13-after-campaign-menu');

  // Check for expert mode switch or goal selection
  const pageContent = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('\nPage content:\n', pageContent);

  // Look for radio buttons or goal selectors
  const selectors = await page.evaluate(() => {
    const radios = document.querySelectorAll('input[type="radio"], [role="radio"], [role="radiogroup"], material-radio-button, material-ripple');
    return Array.from(radios).slice(0, 20).map(el => ({
      tag: el.tagName,
      text: el.textContent?.trim().substring(0, 200),
      checked: el.getAttribute('aria-checked') || el.checked,
    }));
  });
  console.log('\nRadio/selectors:', selectors);

  await screenshot(page, '14-goal-page');
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
