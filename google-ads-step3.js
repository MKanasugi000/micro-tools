const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = 'C:/Users/duper/micro-tools/screenshots';
let sc = 25;

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

  // The page should be showing "tactics" selection - let me scroll down to see what options are there
  // and fill in the website URL field

  // First, let's check what's below the fold
  console.log('\n--- Checking tactics section ---');

  // Scroll down to see more content
  await page.evaluate(() => {
    const main = document.querySelector('[class*="content"], [role="main"], main') || document.body;
    main.scrollTop += 500;
    window.scrollBy(0, 500);
  });
  await page.waitForTimeout(1000);
  await ss(page, 'scrolled-down');

  // Check visible text around "目標をどのように達成するか"
  const tacticsSection = await page.evaluate(() => {
    const text = document.body.innerText;
    const idx = text.indexOf('目標をどのように達成');
    if (idx >= 0) {
      return text.substring(idx, idx + 500);
    }
    return text.substring(0, 500);
  });
  console.log('Tactics section:', tacticsSection);

  // Look for the website URL input field
  const allInputs = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input, textarea');
    return Array.from(inputs).map(el => ({
      type: el.type,
      ariaLabel: el.getAttribute('aria-label'),
      value: el.value,
      placeholder: el.placeholder,
      visible: el.offsetParent !== null,
      rect: el.getBoundingClientRect(),
    })).filter(i => i.visible);
  });
  console.log('All visible inputs:', JSON.stringify(allInputs, null, 2));

  // Find and fill the website URL field - it should be labeled something about website/URL
  // From screenshot it shows "お客さまのウェブサイト" with a text field
  // Try clicking on the field next to that label
  const websiteInput = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input[type="text"]');
    for (const input of inputs) {
      const label = input.getAttribute('aria-label') || '';
      const closestLabel = input.closest('label')?.textContent || '';
      const prevText = input.parentElement?.previousElementSibling?.textContent || '';
      // Skip search and campaign name inputs
      if (label === 'キャンペーン名' || label.includes('検索')) continue;
      if (input.value === 'PDF-Tools-Search') continue;

      return {
        label, closestLabel, prevText,
        value: input.value,
        rect: JSON.stringify(input.getBoundingClientRect()),
      };
    }
    return null;
  });
  console.log('Website input candidate:', websiteInput);

  // Let's try to directly find and fill it
  // The field appears to be an unlabeled text input
  const filled = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input[type="text"]');
    for (const input of inputs) {
      const label = input.getAttribute('aria-label') || '';
      if (label === 'キャンペーン名' || label.includes('検索') || label.includes('ページ')) continue;
      if (input.value === 'PDF-Tools-Search') continue;
      if (input.value === '') {
        // This is likely the website URL field
        input.focus();
        input.value = 'https://pdf-tools-sigma-drab.vercel.app/';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }
    return false;
  });
  console.log('URL filled:', filled);

  if (!filled) {
    // Try typing into the focused field using keyboard
    // Click on the text input that's not the campaign name
    const inputs = await page.$$('input[type="text"]');
    for (const input of inputs) {
      const label = await input.getAttribute('aria-label');
      const val = await input.inputValue();
      if (label !== 'キャンペーン名' && !label?.includes('検索') && !label?.includes('ページ') && val !== 'PDF-Tools-Search') {
        await input.click();
        await input.fill('https://pdf-tools-sigma-drab.vercel.app/');
        console.log('Filled via playwright fill()');
        break;
      }
    }
  }

  await page.waitForTimeout(2000);
  await ss(page, 'url-filled');

  // Now click 続行 button
  console.log('\n--- Clicking 続行 ---');
  // Scroll down to find the button
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);

  const continueBtnClicked = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button, material-button');
    for (const btn of buttons) {
      const text = btn.textContent?.trim();
      const label = btn.getAttribute('aria-label') || '';
      if (text === '続行' || label === '保存して次のステップに進む') {
        btn.click();
        return text || label;
      }
    }
    return null;
  });
  console.log('Continue clicked:', continueBtnClicked);

  await page.waitForTimeout(8000);
  console.log('URL:', page.url());
  await ss(page, 'after-continue');

  // Check new page state
  const state = await page.evaluate(() => {
    return document.body.innerText.substring(0, 4000);
  });
  console.log('\nNew page text (first 3000):\n', state.substring(0, 3000));
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
