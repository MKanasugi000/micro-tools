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

  // First, let's try to switch to expert mode
  // The expert mode campaign creation URL pattern
  console.log('Navigating to expert mode campaign creation...');

  // Try to go to the overview first, then use the proper creation flow
  await page.goto('https://ads.google.com/aw/overview?ocid=7472909166&authuser=0&__u=8599148613&__c=2087511934', {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await page.waitForTimeout(4000);

  // Click the blue + FAB button (作成)
  console.log('Looking for 作成 (Create) FAB button...');
  const createFab = await page.$('material-fab[aria-label="作成"]');
  if (createFab) {
    await createFab.click();
    console.log('Clicked FAB');
    await page.waitForTimeout(2000);
    await screenshot(page, '09-fab-menu');

    // Now look for "キャンペーン" in the dropdown
    const menuItems = await page.evaluate(() => {
      const items = document.querySelectorAll('[role="menuitem"], [role="option"], .fab-menu-item, [class*="menu"] [class*="item"], material-list-item');
      return Array.from(items).map(el => ({
        text: el.textContent?.trim().substring(0, 100),
        ariaLabel: el.getAttribute('aria-label'),
      }));
    });
    console.log('Menu items:', menuItems);

    // Click on キャンペーン (Campaign)
    const campaignItem = await page.locator('text=キャンペーン').first();
    if (await campaignItem.isVisible()) {
      await campaignItem.click();
      console.log('Clicked キャンペーン menu item');
    }
  } else {
    console.log('FAB not found, trying direct URL for expert mode...');
    // Navigate to expert mode campaign creation
    await page.goto('https://ads.google.com/aw/campaigns/new?ocid=7472909166&authuser=0&__u=8599148613&__c=2087511934&step=1', {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
  }

  await page.waitForTimeout(5000);
  console.log('URL after action:', page.url());
  await screenshot(page, '10-after-campaign-click');

  // Check if we're on the goal selection page
  // Look for "エキスパートモード" (Expert mode) link
  const expertLink = await page.locator('text=エキスパート モード').first();
  try {
    if (await expertLink.isVisible({ timeout: 3000 })) {
      console.log('Found Expert Mode link, clicking...');
      await expertLink.click();
      await page.waitForTimeout(5000);
      console.log('URL after expert mode:', page.url());
      await screenshot(page, '11-expert-mode');
    }
  } catch (e) {
    console.log('Expert mode link not found, checking if already in expert mode');
  }

  // Get page state
  const pageState = await page.evaluate(() => {
    const allText = document.body.innerText.substring(0, 3000);
    return allText;
  });
  console.log('\nPage text (first 3000 chars):\n', pageState);

  // Look for all clickable items that might be goals
  const goals = await page.evaluate(() => {
    const items = document.querySelectorAll('[role="radio"], [role="checkbox"], [role="option"], [role="listbox"] > *, label input[type="radio"]');
    return Array.from(items).slice(0, 20).map(el => ({
      text: el.textContent?.trim().substring(0, 200),
      role: el.getAttribute('role'),
      checked: el.getAttribute('aria-checked'),
    }));
  });
  console.log('\nGoal/radio items:', goals);

  await screenshot(page, '12-current-state');
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
