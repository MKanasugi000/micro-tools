const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = 'C:/Users/duper/micro-tools/screenshots';
let sc = 44;

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
  console.log('URL:', page.url());

  // Click on 下書き (Drafts) tab
  console.log('\n--- Checking drafts ---');
  try {
    await page.click('text=下書き');
    await page.waitForTimeout(3000);
    await ss(page, 'drafts-tab');

    const draftsText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
    console.log('Drafts page text:\n', draftsText.substring(0, 2000));
  } catch (e) {
    console.log('Error clicking drafts:', e.message.substring(0, 100));
  }

  // Try to find and click on the PDF-Tools-Search draft
  console.log('\n--- Looking for PDF-Tools-Search draft ---');
  const draftClicked = await page.evaluate(() => {
    const links = document.querySelectorAll('a, [role="link"], td, tr');
    for (const el of links) {
      if (el.textContent?.includes('PDF-Tools-Search')) {
        el.click();
        return el.textContent.trim().substring(0, 100);
      }
    }
    return null;
  });
  console.log('Draft clicked:', draftClicked);

  await page.waitForTimeout(5000);
  await ss(page, 'draft-opened');
  console.log('URL:', page.url());

  // Check if we can publish from here without re-auth
  // Look for "キャンペーンを公開" button
  const pageText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('Page text:\n', pageText.substring(0, 2000));

  // Try to find a publish button
  const publishBtn = await page.evaluate(() => {
    const btns = document.querySelectorAll('button, material-button, [role="button"]');
    return Array.from(btns).filter(b => b.offsetParent !== null).map(b => ({
      text: b.textContent?.trim().substring(0, 80),
      ariaLabel: b.getAttribute('aria-label'),
    }));
  });
  console.log('\nAll buttons:', publishBtn);

  // Also try clicking the campaign name to open it
  console.log('\n--- Trying to navigate to draft editor ---');
  await page.goto(`https://ads.google.com/aw/campaigns/new/search/draft?campaignId=281498683150060&ocid=7472909166&draftId=10188484977&authuser=0&__u=8599148613&__c=2087511934&currentStep=review`, {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await page.waitForTimeout(5000);
  await ss(page, 'draft-review');

  const reviewText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('Review page:\n', reviewText.substring(0, 1500));

  // Look for publish button
  const publishBtns = await page.evaluate(() => {
    const btns = document.querySelectorAll('button, material-button, [role="button"]');
    return Array.from(btns).filter(b => b.offsetParent !== null).map(b => b.textContent?.trim().substring(0, 60)).filter(t => t && t.length > 0);
  });
  console.log('Buttons on review page:', publishBtns);

  // Try clicking "キャンペーンを公開" or similar
  const pubClicked = await page.evaluate(() => {
    const btns = document.querySelectorAll('button, material-button');
    for (const btn of btns) {
      const text = btn.textContent?.trim();
      if ((text?.includes('公開') || text?.includes('キャンペーンを公開') || text === '確認') && btn.offsetParent !== null) {
        btn.click();
        return text;
      }
    }
    return null;
  });
  console.log('Publish clicked:', pubClicked);

  await page.waitForTimeout(5000);
  await ss(page, 'after-publish');
  console.log('URL:', page.url());

  const finalText = await page.evaluate(() => document.body.innerText.substring(0, 1000));
  console.log('Final text:', finalText.substring(0, 500));
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
