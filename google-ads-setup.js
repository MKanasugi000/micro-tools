const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = 'C:/Users/duper/micro-tools/screenshots';

async function screenshot(page, name) {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const fp = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: fp, fullPage: false });
  console.log(`Screenshot: ${fp}`);
  return fp;
}

async function main() {
  console.log('Connecting to Chrome via CDP...');
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  console.log('Connected!');

  const contexts = browser.contexts();
  console.log(`Found ${contexts.length} context(s)`);

  const context = contexts[0];
  const pages = context.pages();
  console.log(`Found ${pages.length} page(s)`);

  let page = pages[0];

  // Navigate to Google Ads
  console.log('Current URL:', page.url());
  await page.goto('https://ads.google.com/aw/overview', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);
  console.log('After navigation URL:', page.url());

  await screenshot(page, '01-ads-landing');

  // Check if we're logged in
  const url = page.url();
  if (url.includes('accounts.google.com') || url.includes('signin')) {
    console.log('NOT LOGGED IN - need to sign in first');
    await screenshot(page, '01-login-required');
    await browser.close();
    return;
  }

  console.log('Appears to be logged in. Taking overview screenshot...');
  await screenshot(page, '02-ads-overview');

  // Now let's start creating Campaign 1: PDF Tools
  console.log('\n=== Creating Campaign 1: PDF Tools ===');

  // Click the + button or "New campaign" button
  // Try clicking the + Campaign button
  try {
    // Look for the "New campaign" or + button
    await page.waitForTimeout(3000);

    // Try the blue + button first
    const newCampaignBtn = await page.$('button[aria-label="New campaign"], [data-test-id="new-campaign-button"], .new-campaign-button');
    if (newCampaignBtn) {
      console.log('Found new campaign button, clicking...');
      await newCampaignBtn.click();
    } else {
      // Try the + button in the header
      console.log('Looking for + button...');
      const plusBtn = await page.$('[aria-label="Create"], [aria-label="作成"]');
      if (plusBtn) {
        console.log('Found Create/作成 button');
        await plusBtn.click();
      } else {
        // Navigate directly to campaign creation
        console.log('Navigating directly to campaign creation URL...');
        await page.goto('https://ads.google.com/aw/campaigns/new', { waitUntil: 'domcontentloaded', timeout: 30000 });
      }
    }

    await page.waitForTimeout(5000);
    await screenshot(page, '03-campaign-creation-start');
    console.log('URL after campaign creation attempt:', page.url());

  } catch (e) {
    console.log('Error finding campaign button:', e.message);
    await screenshot(page, '03-error');
  }

  // Let's get the page content to understand the current state
  try {
    const bodyText = await page.evaluate(() => {
      const elements = document.querySelectorAll('button, a, [role="button"], [role="menuitem"]');
      return Array.from(elements).slice(0, 50).map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim().substring(0, 100),
        ariaLabel: el.getAttribute('aria-label'),
        href: el.getAttribute('href'),
      }));
    });
    console.log('\nVisible clickable elements:');
    bodyText.forEach((el, i) => {
      if (el.text || el.ariaLabel) {
        console.log(`  ${i}: [${el.tag}] text="${el.text}" aria="${el.ariaLabel}" href="${el.href}"`);
      }
    });
  } catch (e) {
    console.log('Error getting elements:', e.message);
  }

  await screenshot(page, '04-current-state');

  console.log('\nDone with initial exploration. Browser stays open.');
  // Don't close browser - keep it open for further interaction
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
