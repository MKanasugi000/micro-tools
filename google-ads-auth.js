const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = 'C:/Users/duper/micro-tools/screenshots';
let sc = 41;

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

  // Find the auth page
  let authPage = null;
  for (const p of pages) {
    if (p.url().includes('accounts.google.com')) {
      authPage = p;
      break;
    }
  }

  if (!authPage) {
    console.log('No auth page found');
    return;
  }

  console.log('Auth page URL:', authPage.url());

  // Click "その他の確認方法"
  console.log('Clicking "その他の確認方法"...');
  try {
    await authPage.click('text=その他の確認方法');
    await authPage.waitForTimeout(3000);
    await ss(authPage, 'other-methods');

    const text = await authPage.evaluate(() => document.body.innerText);
    console.log('Page text:\n', text.substring(0, 1000));
  } catch (e) {
    console.log('Error:', e.message.substring(0, 200));
  }

  // Check for alternative methods
  const methods = await authPage.evaluate(() => {
    const items = document.querySelectorAll('li, [role="option"], [role="radio"], [data-challengetype], button, a');
    return Array.from(items).filter(el => el.offsetParent !== null).map(el => ({
      tag: el.tagName,
      text: el.textContent?.trim().substring(0, 100),
      href: el.getAttribute('href'),
      challengeType: el.getAttribute('data-challengetype'),
    }));
  });
  console.log('\nMethods:', JSON.stringify(methods.slice(0, 20), null, 2));

  await ss(authPage, 'methods-list');

  // Close the auth tab and go back to the campaign page
  // The campaign draft is already saved
  console.log('\n--- Checking campaign draft status ---');
  const campaignPage = pages[0];
  console.log('Campaign page URL:', campaignPage.url());

  // Close auth tab
  await authPage.close();
  await campaignPage.bringToFront();
  await campaignPage.waitForTimeout(2000);

  // Go back to campaigns overview to check if draft was saved
  await campaignPage.goto('https://ads.google.com/aw/campaigns?ocid=7472909166&authuser=0&__u=8599148613&__c=2087511934', {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await campaignPage.waitForTimeout(5000);
  await ss(campaignPage, 'campaigns-list');

  const campaignsList = await campaignPage.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('\nCampaigns page:\n', campaignsList.substring(0, 2000));
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
