const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = 'C:/Users/duper/micro-tools/screenshots';
let sc = 39;

async function ss(page, name) {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const fp = path.join(SCREENSHOT_DIR, `${String(sc++).padStart(2,'0')}-${name}.png`);
  await page.screenshot({ path: fp, fullPage: false });
  console.log(`SS: ${fp}`);
}

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const pages = context.pages();
  let page = pages[0];
  console.log('URL:', page.url());

  // Click 確認 button in the modal
  console.log('\n--- Clicking 確認 in verification modal ---');

  const confirmClicked = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button, material-button, [role="button"]');
    for (const btn of buttons) {
      const text = btn.textContent?.trim();
      if (text === '確認' && btn.offsetParent !== null) {
        btn.click();
        return text;
      }
    }
    return null;
  });
  console.log('Confirm clicked:', confirmClicked);

  await page.waitForTimeout(5000);

  // Check if a new tab was opened for verification
  const allPages = context.pages();
  console.log(`Pages count: ${allPages.length}`);
  for (let i = 0; i < allPages.length; i++) {
    console.log(`  Page ${i}: ${allPages[i].url()}`);
  }

  // If verification opened in current page, screenshot it
  page = allPages[allPages.length - 1]; // use the latest page
  console.log('Current page URL:', page.url());
  await ss(page, 'after-verify');

  // Check page content
  const text = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('Page text:\n', text.substring(0, 1500));

  // If we're still on the review page, try to handle the verification
  if (page.url().includes('campaigns/new')) {
    // Check if there's still a dialog
    const dialogText = await page.evaluate(() => {
      const dialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"], [class*="dialog"], [class*="modal"]');
      return Array.from(dialogs).map(d => d.textContent?.trim().substring(0, 200));
    });
    console.log('Dialogs:', dialogText);

    // Look for errors that need fixing
    const errors = await page.evaluate(() => {
      const errorEls = document.querySelectorAll('[class*="error"], .error, [role="alert"]');
      return Array.from(errorEls).map(el => el.textContent?.trim().substring(0, 200));
    });
    console.log('Errors:', errors);

    // Try to fix the location to Japan instead of all countries
    console.log('\n--- Fixing campaign location to Japan ---');

    // Look for 地域 section and change it
    const locationEdit = await page.evaluate(() => {
      const links = document.querySelectorAll('a, [role="link"], [class*="edit"]');
      for (const link of links) {
        if (link.textContent?.includes('すべての国と地域')) {
          link.click();
          return link.textContent.trim();
        }
      }
      // Try clicking the section header
      const sections = document.querySelectorAll('*');
      for (const el of sections) {
        if (el.textContent?.trim() === '地域' && el.offsetParent !== null) {
          el.click();
          return 'clicked 地域';
        }
      }
      return null;
    });
    console.log('Location edit clicked:', locationEdit);
    await page.waitForTimeout(2000);
    await ss(page, 'location-edit');

    // Fix the budget to ¥400
    console.log('\n--- Fixing budget ---');
    const budgetEdit = await page.evaluate(() => {
      const els = document.querySelectorAll('*');
      for (const el of els) {
        if (el.textContent?.includes('1 日あたり') && el.textContent?.includes('1,000') && el.offsetParent !== null) {
          el.click();
          return el.textContent.trim();
        }
      }
      return null;
    });
    console.log('Budget edit clicked:', budgetEdit);

    // Try to directly publish/submit the campaign as is (we'll fix settings later)
    console.log('\n--- Trying to publish campaign ---');

    // Look for a publish/submit button
    const publishClicked = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button, material-button');
      for (const btn of buttons) {
        const text = btn.textContent?.trim();
        if ((text?.includes('キャンペーンを公開') || text?.includes('公開') || text?.includes('送信') || text?.includes('完了')) && btn.offsetParent !== null) {
          btn.click();
          return text;
        }
      }
      return null;
    });
    console.log('Publish clicked:', publishClicked);

    if (!publishClicked) {
      // The review page might have the publish button with different text
      const allBtns = await page.evaluate(() => {
        const btns = document.querySelectorAll('button, material-button, [role="button"]');
        return Array.from(btns).filter(b => b.offsetParent !== null).map(b => b.textContent?.trim().substring(0, 80));
      });
      console.log('All visible buttons:', allBtns);
    }

    await page.waitForTimeout(3000);
    await ss(page, 'publish-attempt');
  }

  // Final state
  console.log('\n=== Final state ===');
  page = context.pages()[context.pages().length - 1];
  console.log('URL:', page.url());
  const finalText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log(finalText.substring(0, 1500));
  await ss(page, 'final');
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
