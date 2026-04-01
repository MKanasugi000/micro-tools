const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = 'C:/Users/duper/micro-tools/screenshots';
let sc = 47;

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

  // Wait for the error check to complete
  console.log('Waiting for error check...');
  await page.waitForTimeout(10000);
  await ss(page, 'after-wait');

  // Get full page content
  const text = await page.evaluate(() => document.body.innerText);
  console.log('Full page text:\n', text.substring(0, 4000));

  // Scroll down to see more
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2000);
  await ss(page, 'scrolled');

  // Look for any remaining buttons at the bottom
  const btns = await page.evaluate(() => {
    const els = document.querySelectorAll('button, material-button, [role="button"]');
    return Array.from(els).filter(el => el.offsetParent !== null).map(el => ({
      text: el.textContent?.trim().substring(0, 100),
      rect: JSON.stringify(el.getBoundingClientRect()),
    }));
  });
  console.log('\nAll visible buttons:', btns.map(b => b.text));

  // Check if there's a "キャンペーンを公開" button
  const publishBtn = await page.evaluate(() => {
    const els = document.querySelectorAll('*');
    for (const el of els) {
      const text = el.textContent?.trim();
      if (text === 'キャンペーンを公開' && el.offsetParent !== null) {
        return { tag: el.tagName, text };
      }
    }
    return null;
  });
  console.log('Publish button:', publishBtn);

  // The review page had stepper dots (radio_button_unchecked) - it may need data to be refilled
  // since the draft lost some settings
  // Let's check the stepper state
  const stepperState = await page.evaluate(() => {
    const steps = document.querySelectorAll('[class*="step"], [class*="stepper"] *');
    return Array.from(steps).slice(0, 20).map(el => ({
      text: el.textContent?.trim().substring(0, 50),
      class: el.className?.substring(0, 50),
    }));
  });
  console.log('Stepper:', stepperState);

  // Try to navigate through all steps to fill in missing data
  // First let's go to the bidding step
  console.log('\n--- Navigating through steps ---');
  const stepLinks = await page.evaluate(() => {
    const links = document.querySelectorAll('[class*="nav"] a, [class*="step"] a, [role="tab"]');
    return Array.from(links).map(el => ({
      text: el.textContent?.trim().substring(0, 50),
      href: el.getAttribute('href'),
    }));
  });
  console.log('Step links:', stepLinks);

  // Try clicking on the first unchecked step
  const firstStep = await page.evaluate(() => {
    const circles = document.querySelectorAll('[class*="unchecked"], [aria-selected="false"]');
    if (circles.length > 0) {
      circles[0].click();
      return circles[0].textContent?.trim();
    }
    // Try clicking on stepper indicators
    const pageview = document.querySelectorAll('material-icon');
    for (const icon of pageview) {
      if (icon.textContent?.trim() === 'radio_button_unchecked') {
        icon.click();
        return 'clicked first unchecked';
      }
    }
    return null;
  });
  console.log('First step clicked:', firstStep);

  await page.waitForTimeout(3000);
  await ss(page, 'step-clicked');

  const newText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('After step click:\n', newText.substring(0, 1000));
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
