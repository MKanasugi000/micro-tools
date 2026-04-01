const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = 'C:/Users/duper/micro-tools/screenshots';
let sc = 66;

async function ss(page, name) {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const fp = path.join(SCREENSHOT_DIR, `${String(sc++).padStart(2,'0')}-${name}.png`);
  await page.screenshot({ path: fp, fullPage: false });
  console.log(`SS: ${fp}`);
}

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const page = context.pages()[0];

  // Start from campaigns list
  await page.goto('https://ads.google.com/aw/campaigns?ocid=7472909166&authuser=0&__u=8599148613&__c=2087511934', {
    waitUntil: 'load', timeout: 30000
  });
  await page.waitForTimeout(6000);

  // Use the "add" button (キャンペーンを作成) in the table toolbar
  console.log('Looking for add campaign button in table...');
  const addBtn = await page.$('button[aria-label="キャンペーンを作成"]');
  if (addBtn) {
    console.log('Found キャンペーンを作成 button');
    await addBtn.click();
  } else {
    // Try the blue + circle at bottom of campaign list
    const plusBtn = await page.$('button:has(> material-icon)');
    console.log('Trying + button...');

    // Let me get ALL buttons with their details
    const allBtns = await page.evaluate(() => {
      const btns = document.querySelectorAll('button, [role="button"]');
      return Array.from(btns).filter(b => b.offsetParent !== null).map(b => ({
        text: b.textContent?.trim().substring(0, 60),
        aria: b.getAttribute('aria-label'),
        tag: b.tagName,
        class: b.className?.substring(0, 60),
        rect: JSON.stringify({x: b.getBoundingClientRect().x, y: b.getBoundingClientRect().y}),
      }));
    });

    // Find the "add" / "キャンペーンを作成" button
    const addButton = allBtns.find(b => b.aria === 'キャンペーンを作成' || b.text === 'add');
    console.log('Add button:', addButton);

    if (addButton) {
      await page.click(`[aria-label="${addButton.aria}"]`);
    } else {
      // Click the + button (the teal add button in the table)
      await page.evaluate(() => {
        const btns = document.querySelectorAll('button, [role="button"]');
        for (const btn of btns) {
          if (btn.textContent?.trim() === 'add' && btn.offsetParent !== null) {
            // Check if it's in the main content area (not sidebar)
            const rect = btn.getBoundingClientRect();
            if (rect.x > 200) { // not in sidebar
              btn.click();
              return;
            }
          }
        }
      });
    }
  }

  await page.waitForTimeout(8000);
  console.log('URL after add:', page.url());
  await ss(page, 'after-add');

  // Check if we're on campaign creation
  if (!page.url().includes('campaigns/new')) {
    console.log('Not on campaign creation page. Current page text:');
    const text = await page.evaluate(() => document.body.innerText.substring(0, 500));
    console.log(text);

    // Maybe we need to close a popup or handle something
    // Let's try navigating directly with the URL pattern we know works
    // The first campaign creation used FAB successfully, let's try the exact same approach
    console.log('\nTrying FAB approach...');

    // Close any modals first
    await page.evaluate(() => {
      const closeButtons = document.querySelectorAll('[aria-label="閉じる"], button:has-text("close")');
      closeButtons.forEach(b => b.click());
    });
    await page.waitForTimeout(1000);

    // Click FAB
    const fab = await page.locator('material-fab[aria-label="作成"]');
    if (await fab.isVisible({ timeout: 3000 })) {
      await fab.click();
      console.log('Clicked FAB');
      await page.waitForTimeout(2000);

      // Now look for the popup menu and click キャンペーン
      // The key insight: the menu item has [role="menuitem"] AND aria-label="キャンペーン"
      const menuItems = await page.evaluate(() => {
        const items = document.querySelectorAll('[aria-label="キャンペーン"]');
        return Array.from(items).map(el => ({
          tag: el.tagName,
          role: el.getAttribute('role'),
          visible: el.offsetParent !== null,
          rect: JSON.stringify(el.getBoundingClientRect()),
        }));
      });
      console.log('キャンペーン elements:', menuItems);

      // Click the visible one with role menuitem
      const menuItem = menuItems.find(m => m.visible && m.role === 'menuitem');
      if (menuItem) {
        await page.click('[role="menuitem"][aria-label="キャンペーン"]');
        console.log('Clicked menu item');
      } else if (menuItems.some(m => m.visible)) {
        // Click the first visible one
        await page.evaluate(() => {
          const items = document.querySelectorAll('[aria-label="キャンペーン"]');
          for (const item of items) {
            if (item.offsetParent !== null) {
              item.click();
              return;
            }
          }
        });
        console.log('Clicked first visible キャンペーン');
      }

      await page.waitForTimeout(8000);
      console.log('URL after menu click:', page.url());
    }
  }

  await ss(page, 'campaign-creation');
  console.log('Final URL:', page.url());

  // If we made it to campaign creation, take full page screenshot
  if (page.url().includes('campaigns/new')) {
    console.log('SUCCESS - on campaign creation page!');
    const text = await page.evaluate(() => document.body.innerText.substring(0, 1000));
    console.log('Page text:', text);
  } else {
    console.log('Still not on campaign creation page');
  }
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
