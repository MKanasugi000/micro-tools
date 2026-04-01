const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = 'C:/Users/duper/micro-tools/screenshots';
let sc = 21;

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

  // The page should show campaign types. Need to click 検索 (Search) instead of P-MAX
  // First scroll up to see the campaign type options
  console.log('\n--- Selecting 検索 (Search) campaign type ---');

  // Click on 検索 specifically (Search campaign type)
  const searchTypeClicked = await page.evaluate(() => {
    // Find all elements that might be campaign type selectors
    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
      const text = el.textContent?.trim();
      // Look for the exact "検索" campaign type card - it should have specific text about text ads
      if (text && text.startsWith('検索') && text.includes('テキスト広告') && el.offsetParent !== null) {
        el.click();
        return `Found and clicked: ${text.substring(0, 80)}`;
      }
    }
    // Try looking for more specific selectors
    const cards = document.querySelectorAll('[class*="card"], [class*="type"], [class*="option"]');
    for (const card of cards) {
      if (card.textContent?.includes('検索') && card.textContent?.includes('テキスト広告')) {
        card.click();
        return `Found card: ${card.textContent.substring(0, 80)}`;
      }
    }
    return null;
  });
  console.log('Search type result:', searchTypeClicked);

  // If that didn't work, try a different approach
  if (!searchTypeClicked) {
    // Scroll up to see campaign types
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1000);

    // Try to find by looking at the structure
    const types = await page.evaluate(() => {
      const items = document.querySelectorAll('[role="listitem"] [role="heading"], h3, h4');
      return Array.from(items).map((el, i) => ({
        i, text: el.textContent?.trim().substring(0, 80),
        tag: el.tagName, parentText: el.parentElement?.textContent?.trim().substring(0, 80)
      }));
    });
    console.log('Type items:', types);
  }

  await page.waitForTimeout(2000);
  await ss(page, 'search-type-selected');

  // Now we need to: 1) Enter URL, 2) Set campaign name
  console.log('\n--- Checking current state ---');
  const state = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input, textarea');
    return Array.from(inputs).map(el => ({
      type: el.type,
      ariaLabel: el.getAttribute('aria-label'),
      value: el.value,
      placeholder: el.placeholder,
      name: el.name,
      visible: el.offsetParent !== null,
    })).filter(i => i.visible);
  });
  console.log('Visible inputs:', state);

  // Fill URL field
  const urlFilled = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input');
    for (const input of inputs) {
      const label = input.getAttribute('aria-label') || '';
      if (label.includes('URL') || label.includes('ウェブサイト') || label.includes('ページ')) {
        // Skip search input
        if (label.includes('検索')) continue;
        input.value = '';
        input.focus();
        return label;
      }
    }
    return null;
  });
  console.log('URL input found:', urlFilled);

  if (urlFilled) {
    // Type the URL
    await page.keyboard.type('https://pdf-tools-sigma-drab.vercel.app/');
    console.log('Typed URL');
    await page.keyboard.press('Tab');
  }

  await page.waitForTimeout(1000);

  // Fill campaign name
  const nameInput = await page.$('input[aria-label="キャンペーン名"]');
  if (nameInput) {
    await nameInput.click({ clickCount: 3 }); // select all
    await nameInput.fill('PDF-Tools-Search');
    console.log('Set campaign name');
  }

  await page.waitForTimeout(1000);
  await ss(page, 'form-filled');

  // Click 続行 (Continue)
  console.log('\n--- Clicking 続行 ---');

  // Find the 続行 button at the bottom
  const continueClicked = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button, material-button');
    for (const btn of buttons) {
      if (btn.textContent?.trim() === '続行' || btn.getAttribute('aria-label') === '続行') {
        btn.click();
        return true;
      }
    }
    // Also try the specific button
    const submitBtns = document.querySelectorAll('[aria-label="保存して次のステップに進む"]');
    for (const btn of submitBtns) {
      btn.click();
      return 'submit';
    }
    return false;
  });
  console.log('Continue clicked:', continueClicked);

  await page.waitForTimeout(8000);
  console.log('URL after continue:', page.url());
  await ss(page, 'after-continue');

  // Check new page state
  const newState = await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, [role="heading"]'))
      .map(el => el.textContent?.trim()).filter(t => t && t.length > 1 && t.length < 100);
    const text = document.body.innerText.substring(0, 3000);
    return { headings, text };
  });
  console.log('New headings:', newState.headings);
  console.log('Page text (first 2000):', newState.text.substring(0, 2000));

  await ss(page, 'next-step');
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
