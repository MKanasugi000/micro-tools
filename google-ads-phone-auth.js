const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = 'C:/Users/duper/micro-tools/screenshots';
let sc = 43;

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
  console.log(`Pages: ${pages.length}`);

  let page = pages[0];
  console.log('Page URL:', page.url());

  // Check if we're on the auth page
  if (page.url().includes('accounts.google.com')) {
    console.log('On auth page, clicking phone tap method...');

    // Click "スマートフォンまたはタブレットで [はい] をタップしてください"
    const clicked = await page.evaluate(() => {
      const divs = document.querySelectorAll('[data-challengetype="39"]');
      for (const div of divs) {
        div.click();
        return div.textContent.trim();
      }
      return null;
    });
    console.log('Phone method clicked:', clicked);

    await page.waitForTimeout(5000);
    await ss(page, 'phone-prompt');

    const text = await page.evaluate(() => document.body.innerText.substring(0, 1000));
    console.log('Page text:', text);

    // Wait for phone approval - the user needs to tap "Yes" on their phone
    console.log('\nWaiting 30 seconds for phone approval...');
    await page.waitForTimeout(30000);

    await ss(page, 'after-phone-wait');
    console.log('URL after wait:', page.url());

    const text2 = await page.evaluate(() => document.body.innerText.substring(0, 1000));
    console.log('Page text after wait:', text2);

    // Check if we got redirected back to Google Ads
    if (page.url().includes('ads.google.com')) {
      console.log('Successfully authenticated!');
    }
  } else {
    console.log('Not on auth page, navigating to ads...');
    await page.goto('https://ads.google.com/aw/campaigns?ocid=7472909166&authuser=0&__u=8599148613&__c=2087511934', {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await page.waitForTimeout(5000);
  }

  await ss(page, 'current-state');
  console.log('Final URL:', page.url());
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
