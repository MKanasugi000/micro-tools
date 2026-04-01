const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = 'C:/Users/duper/micro-tools/screenshots';
let sc = 97;

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

  // Check for ad blocker warnings
  console.log('Checking ad blocker status...');
  const adBlockerMessages = await page.evaluate(() => {
    const all = document.querySelectorAll('*');
    const matches = [];
    for (const el of all) {
      if (el.textContent?.includes('ad blocker') && el.offsetParent && el.getBoundingClientRect().height > 0) {
        matches.push({
          tag: el.tagName,
          text: el.textContent?.trim().substring(0, 200),
          rect: JSON.stringify(el.getBoundingClientRect()),
          class: el.className?.substring(0, 80),
          zIndex: window.getComputedStyle(el).zIndex,
          position: window.getComputedStyle(el).position,
        });
      }
    }
    return matches;
  });
  console.log('Ad blocker elements:', JSON.stringify(adBlockerMessages.slice(0, 5), null, 2));

  // Try to dismiss ad blocker warning
  await page.evaluate(() => {
    // Hide all ad blocker warning elements
    document.querySelectorAll('*').forEach(el => {
      if (el.textContent?.includes('ad blocker') || el.textContent?.includes('Ad blocker')) {
        if (el.tagName !== 'BODY' && el.tagName !== 'HTML') {
          el.style.display = 'none';
        }
      }
    });
  });

  // Now navigate to campaign creation
  console.log('Going to overview...');
  await page.goto('https://ads.google.com/aw/overview?ocid=7472909166&authuser=0&__u=8599148613&__c=2087511934', {
    waitUntil: 'load', timeout: 30000
  });
  await page.waitForTimeout(6000);

  // Hide ad blocker warnings
  await page.evaluate(() => {
    document.querySelectorAll('*').forEach(el => {
      if (el.textContent?.includes('ad blocker')) {
        if (el.tagName !== 'BODY' && el.tagName !== 'HTML') el.style.display = 'none';
      }
    });
  });

  // FAB -> Campaign
  await page.click('material-fab[aria-label="作成"]');
  await page.waitForTimeout(2000);
  await page.click('[aria-label="キャンペーン"][role="menuitem"]');
  await page.waitForTimeout(6000);

  // Hide ad blocker warnings again
  await page.evaluate(() => {
    document.querySelectorAll('*').forEach(el => {
      if (el.textContent?.includes('ad blocker')) {
        if (el.tagName !== 'BODY' && el.tagName !== 'HTML') el.style.display = 'none';
      }
    });
  });

  // Select goal
  const goalRect = await page.evaluate(() => {
    const h = Array.from(document.querySelectorAll('[role="heading"]'))
      .find(el => el.textContent?.trim() === 'ウェブサイトのトラフィック' && el.getBoundingClientRect().top > 0);
    if (h) { const r = h.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 }; }
    return null;
  });
  if (goalRect) await page.mouse.click(goalRect.x, goalRect.y);
  await page.waitForTimeout(2000);

  // First 続行
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    document.querySelectorAll('button, material-button').forEach(b => {
      if (b.textContent?.trim() === '続行' && b.offsetParent) b.click();
    });
  });
  await page.waitForTimeout(5000);

  // Select search type
  await page.evaluate(() => {
    const heading = Array.from(document.querySelectorAll('[role="heading"]'))
      .find(el => el.textContent?.includes('キャンペーン タイプ'));
    if (heading) heading.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(1000);

  await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      const text = el.textContent?.trim();
      if (text?.startsWith('検索') && text?.includes('テキスト広告') && el.offsetParent && el.getBoundingClientRect().top > 0 && el.getBoundingClientRect().height < 300) {
        el.click();
        break;
      }
    }
  });
  await page.waitForTimeout(2000);
  console.log('Search selected');

  // Scroll to bottom for URL/name
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);

  // Get ALL visible inputs to understand form structure
  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input, textarea')).filter(el => el.offsetParent).map(el => ({
      tag: el.tagName,
      type: el.type,
      ariaLabel: el.getAttribute('aria-label'),
      value: el.value,
      placeholder: el.placeholder,
      name: el.name,
      y: el.getBoundingClientRect().y,
    }));
  });
  console.log('All visible inputs:', JSON.stringify(inputs, null, 2));

  // Fill URL
  for (const input of await page.$$('input[type="text"]')) {
    const label = await input.getAttribute('aria-label');
    if (!label || label === '') {
      if (await input.isVisible()) {
        await input.click();
        await input.fill('https://tax-tools-mauve.vercel.app/');
        await page.keyboard.press('Tab');
        console.log('URL set');
        break;
      }
    }
  }

  // Fill name if visible
  const nameInput = await page.$('input[aria-label="キャンペーン名"]');
  if (nameInput && await nameInput.isVisible()) {
    await nameInput.click({ clickCount: 3 });
    await nameInput.fill('Tax-Simulator-Search');
    console.log('Name set');
  } else {
    console.log('Name input NOT FOUND or not visible');
  }

  await page.waitForTimeout(2000);
  await ss(page, 'before-continue');

  // Second 続行
  await page.evaluate(() => {
    document.querySelectorAll('button, material-button').forEach(b => {
      if (b.textContent?.trim() === '続行' && b.offsetParent) b.click();
    });
  });

  // Wait longer this time
  await page.waitForTimeout(15000);
  console.log('URL after 続行:', page.url());
  await ss(page, 'after-continue');

  // Check what happened
  const text = await page.evaluate(() => document.body.innerText.substring(0, 1000));
  console.log('Page text:', text.substring(0, 500));

  // Check if there's an error or validation message
  const errors = await page.evaluate(() => {
    const errEls = document.querySelectorAll('[class*="error"], [class*="warning"], [class*="invalid"]');
    return Array.from(errEls).filter(el => el.offsetParent).map(el => el.textContent?.trim().substring(0, 100));
  });
  console.log('Errors:', errors);

  // Check if there's a popup/modal blocking
  const modals = await page.evaluate(() => {
    const els = document.querySelectorAll('[role="dialog"], [role="alertdialog"], [class*="modal"], [class*="overlay"]');
    return Array.from(els).filter(el => el.offsetParent).map(el => ({
      text: el.textContent?.trim().substring(0, 200),
      class: el.className?.substring(0, 80),
    }));
  });
  console.log('Modals:', modals);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
