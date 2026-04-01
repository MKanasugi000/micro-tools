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

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('Connecting to Chrome via CDP...');
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const page = context.pages()[0];

  console.log('Current URL:', page.url());

  // Step 1: Click "+ 新しいキャンペーン" button
  console.log('\n=== Step 1: Click New Campaign button ===');
  const newCampaignBtn = await page.$('button[aria-label="新しいキャンペーン"]');
  if (newCampaignBtn) {
    await newCampaignBtn.click();
    console.log('Clicked "新しいキャンペーン" button');
  } else {
    // Try text-based selector
    const btn = await page.locator('button:has-text("新しいキャンペーン")').first();
    await btn.click();
    console.log('Clicked via text selector');
  }

  await sleep(5000);
  await screenshot(page, '05-new-campaign-clicked');
  console.log('URL:', page.url());

  // Check what's on screen now
  const bodyText = await page.evaluate(() => {
    // Get all visible text content
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const texts = [];
    let node;
    while (node = walker.nextNode()) {
      const t = node.textContent.trim();
      if (t && t.length > 2 && t.length < 200) texts.push(t);
    }
    return [...new Set(texts)].slice(0, 100);
  });
  console.log('\nVisible texts:', bodyText.join('\n'));

  // Look for goal selection options
  const clickableElements = await page.evaluate(() => {
    const elements = document.querySelectorAll('[role="radio"], [role="option"], [role="listitem"], label, [class*="goal"], [class*="objective"]');
    return Array.from(elements).slice(0, 30).map(el => ({
      tag: el.tagName,
      text: el.textContent?.trim().substring(0, 150),
      role: el.getAttribute('role'),
      ariaLabel: el.getAttribute('aria-label'),
    }));
  });
  console.log('\nSelectable elements:');
  clickableElements.forEach((el, i) => {
    if (el.text) console.log(`  ${i}: [${el.tag}] role="${el.role}" text="${el.text}"`);
  });

  await screenshot(page, '06-goal-selection');
  console.log('\nDone exploring campaign creation flow');
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
