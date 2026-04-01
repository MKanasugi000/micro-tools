const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = 'C:/Users/duper/micro-tools/screenshots';
let screenshotCount = 15;

async function screenshot(page, name) {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const num = String(screenshotCount++).padStart(2, '0');
  const fp = path.join(SCREENSHOT_DIR, `${num}-${name}.png`);
  await page.screenshot({ path: fp, fullPage: false });
  console.log(`Screenshot: ${fp}`);
}

async function waitAndClick(page, selector, description, timeout = 5000) {
  console.log(`  Waiting for: ${description}...`);
  try {
    await page.waitForSelector(selector, { timeout });
    await page.click(selector);
    console.log(`  Clicked: ${description}`);
    return true;
  } catch (e) {
    console.log(`  Not found: ${description} (${e.message.substring(0, 80)})`);
    return false;
  }
}

async function clickByText(page, text, tag = '*') {
  console.log(`  Clicking text: "${text}"...`);
  try {
    const el = page.locator(`${tag}:has-text("${text}")`).first();
    await el.click({ timeout: 5000 });
    console.log(`  Clicked: "${text}"`);
    return true;
  } catch (e) {
    console.log(`  Failed to click "${text}": ${e.message.substring(0, 80)}`);
    return false;
  }
}

async function getPageState(page) {
  return await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, [role="heading"]'))
      .map(el => el.textContent?.trim())
      .filter(t => t && t.length > 1);
    const buttons = Array.from(document.querySelectorAll('button, [role="button"], material-button'))
      .map(el => el.textContent?.trim().substring(0, 80))
      .filter(t => t && t.length > 1);
    const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="number"], input[type="url"], textarea'))
      .map(el => ({
        placeholder: el.placeholder,
        ariaLabel: el.getAttribute('aria-label'),
        value: el.value,
        name: el.name,
        id: el.id,
      }));
    return { headings, buttons: buttons.slice(0, 20), inputs };
  });
}

async function main() {
  console.log('=== Creating Campaign 1: PDF Tools ===\n');
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const page = context.pages()[0];

  // We should already be on the goal selection page
  console.log('Current URL:', page.url());

  // If not on goal page, navigate there
  if (!page.url().includes('campaigns/new')) {
    console.log('Navigating to campaign creation...');
    await page.goto('https://ads.google.com/aw/overview?ocid=7472909166&authuser=0&__u=8599148613&__c=2087511934', {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await page.waitForTimeout(4000);
    await page.click('material-fab[aria-label="作成"]');
    await page.waitForTimeout(2000);
    await page.click('[aria-label="キャンペーン"][role="menuitem"]');
    await page.waitForTimeout(5000);
  }

  // STEP 1: Select "ウェブサイトのトラフィック" goal
  console.log('\n--- Step 1: Select Website Traffic goal ---');
  // The goal items are clickable divs/cards
  const clicked = await page.evaluate(() => {
    const elements = document.querySelectorAll('[class*="objective"], [class*="goal"], [role="listitem"], li, div');
    for (const el of elements) {
      if (el.textContent?.includes('ウェブサイトのトラフィック') && !el.textContent?.includes('販売促進')) {
        // Find the clickable element
        const clickable = el.querySelector('[role="button"]') || el;
        if (clickable.offsetParent !== null) { // is visible
          clickable.click();
          return el.textContent.substring(0, 100);
        }
      }
    }
    return null;
  });
  console.log('Clicked goal:', clicked);

  if (!clicked) {
    // Try text-based approach
    await clickByText(page, 'ウェブサイトのトラフィック');
  }

  await page.waitForTimeout(2000);
  await screenshot(page, 'goal-selected');

  // Click 続行 (Continue)
  console.log('\n--- Clicking 続行 (Continue) ---');
  await page.waitForTimeout(1000);
  await clickByText(page, '続行', 'button');
  await page.waitForTimeout(5000);
  await screenshot(page, 'after-continue');

  // Check current state
  let state = await getPageState(page);
  console.log('Headings:', state.headings);
  console.log('Buttons:', state.buttons.slice(0, 10));
  console.log('Inputs:', state.inputs);

  // STEP 2: Select campaign type (Search)
  console.log('\n--- Step 2: Select campaign type ---');
  const pageText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('Page text (first 1500):', pageText.substring(0, 1500));

  // Look for Search campaign type
  const searchClicked = await page.evaluate(() => {
    const elements = document.querySelectorAll('div, li, [role="listitem"], [role="option"]');
    for (const el of elements) {
      const text = el.textContent?.trim();
      if (text && text.includes('検索') && text.includes('Google') && text.length < 300) {
        el.click();
        return text.substring(0, 100);
      }
    }
    return null;
  });
  console.log('Search type clicked:', searchClicked);

  if (!searchClicked) {
    // Try clicking text "検索"
    await clickByText(page, '検索');
  }

  await page.waitForTimeout(2000);
  await screenshot(page, 'campaign-type');

  // Check for "ウェブサイトへのアクセス" option
  const accessClicked = await page.evaluate(() => {
    const elements = document.querySelectorAll('div, label, [role="radio"], [role="checkbox"]');
    for (const el of elements) {
      const text = el.textContent?.trim();
      if (text && (text.includes('ウェブサイトへのアクセス') || text.includes('ウェブサイト'))) {
        el.click();
        return text.substring(0, 100);
      }
    }
    return null;
  });
  if (accessClicked) console.log('Clicked website access:', accessClicked);

  // Enter the landing page URL
  console.log('\n--- Entering landing page URL ---');
  await page.waitForTimeout(2000);

  // Look for URL input field
  const urlInput = await page.$('input[type="url"], input[placeholder*="URL"], input[aria-label*="URL"], input[aria-label*="ウェブサイト"]');
  if (urlInput) {
    await urlInput.fill('https://pdf-tools-sigma-drab.vercel.app/');
    console.log('Filled URL input');
  } else {
    // Try to find any text input
    const inputs = await page.$$('input[type="text"]');
    for (const input of inputs) {
      const label = await input.getAttribute('aria-label');
      const placeholder = await input.getAttribute('placeholder');
      console.log(`  Found input: label="${label}" placeholder="${placeholder}"`);
    }
  }

  await page.waitForTimeout(2000);
  await screenshot(page, 'url-entered');

  // Click 続行 (Continue) again
  console.log('\n--- Clicking 続行 ---');
  await clickByText(page, '続行', 'button');
  await page.waitForTimeout(5000);

  state = await getPageState(page);
  console.log('Headings:', state.headings);
  console.log('Buttons:', state.buttons.slice(0, 10));
  await screenshot(page, 'after-type-continue');

  // Continue checking for more steps
  console.log('\nPage text:');
  const text2 = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log(text2.substring(0, 2000));

  await screenshot(page, 'current-state-final');
  console.log('\n=== Done with campaign creation exploration ===');
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
