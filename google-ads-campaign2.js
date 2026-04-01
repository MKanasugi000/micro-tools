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

  // Navigate directly to campaign creation URL
  console.log('Navigating to campaign creation wizard...');
  await page.goto('https://ads.google.com/aw/campaigns/new/express?ocid=7472909166&authuser=0&__u=8599148613&__c=2087511934', {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await page.waitForTimeout(5000);
  console.log('URL:', page.url());
  await screenshot(page, '07-campaign-wizard-attempt1');

  // If that didn't work, try the standard path
  if (!page.url().includes('campaigns/new')) {
    console.log('Trying standard campaign creation URL...');
    await page.goto('https://ads.google.com/aw/campaigns/new?ocid=7472909166&authuser=0&__u=8599148613&__c=2087511934', {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await page.waitForTimeout(5000);
    console.log('URL:', page.url());
    await screenshot(page, '07-campaign-wizard-attempt2');
  }

  // Check what we have
  const texts = await page.evaluate(() => {
    const els = document.querySelectorAll('h1, h2, h3, [role="heading"], [role="radio"], [role="radiogroup"] label, [class*="objective"], [class*="goal"]');
    return Array.from(els).slice(0, 40).map(el => ({
      tag: el.tagName,
      text: el.textContent?.trim().substring(0, 200),
      role: el.getAttribute('role'),
    }));
  });
  console.log('\nHeadings and options:');
  texts.forEach((t, i) => console.log(`  ${i}: [${t.tag}] role="${t.role}" "${t.text}"`));

  // Also get all buttons
  const buttons = await page.evaluate(() => {
    const els = document.querySelectorAll('button, [role="button"], material-button');
    return Array.from(els).slice(0, 30).map(el => ({
      text: el.textContent?.trim().substring(0, 100),
      ariaLabel: el.getAttribute('aria-label'),
    }));
  });
  console.log('\nButtons:');
  buttons.forEach((b, i) => {
    if (b.text || b.ariaLabel) console.log(`  ${i}: text="${b.text}" aria="${b.ariaLabel}"`);
  });

  await screenshot(page, '08-wizard-state');
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
