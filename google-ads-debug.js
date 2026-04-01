const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = 'C:/Users/duper/micro-tools/screenshots';
let sc = 88;

async function ss(page, name) {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const fp = path.join(SCREENSHOT_DIR, `${String(sc++).padStart(2,'0')}-${name}.png`);
  await page.screenshot({ path: fp, fullPage: true });
  console.log(`SS: ${fp}`);
}

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const page = context.pages()[0];

  // Go to overview and start campaign creation
  await page.goto('https://ads.google.com/aw/overview?ocid=7472909166&authuser=0&__u=8599148613&__c=2087511934', {
    waitUntil: 'load', timeout: 30000
  });
  await page.waitForTimeout(6000);

  await page.click('material-fab[aria-label="作成"]');
  await page.waitForTimeout(2000);
  await page.click('[aria-label="キャンペーン"][role="menuitem"]');
  await page.waitForTimeout(6000);

  // Take FULL PAGE screenshot to see entire form
  console.log('Taking full page screenshot...');
  await ss(page, 'full-page');

  // Get all headings with their positions
  const allHeadings = await page.evaluate(() => {
    const hs = document.querySelectorAll('[role="heading"], h1, h2, h3, h4');
    return Array.from(hs).map(h => ({
      text: h.textContent?.trim().substring(0, 80),
      top: h.getBoundingClientRect().top,
      visible: h.offsetParent !== null,
    })).filter(h => h.visible);
  });
  console.log('All headings:', JSON.stringify(allHeadings, null, 2));

  // Select goal by clicking
  console.log('\nClicking ウェブサイトのトラフィック...');
  const goalRect = await page.evaluate(() => {
    const h = Array.from(document.querySelectorAll('[role="heading"]'))
      .find(el => el.textContent?.trim() === 'ウェブサイトのトラフィック' && el.getBoundingClientRect().top > 0);
    if (!h) return null;
    const r = h.getBoundingClientRect();
    return { x: r.x + r.width/2, y: r.y + r.height/2 };
  });
  if (goalRect) await page.mouse.click(goalRect.x, goalRect.y);
  await page.waitForTimeout(3000);

  // Take another full page screenshot after goal selection
  await ss(page, 'after-goal-full');

  // Get all headings again to see if campaign types appeared
  const headingsAfter = await page.evaluate(() => {
    const hs = document.querySelectorAll('[role="heading"], h1, h2, h3, h4');
    return Array.from(hs).map(h => ({
      text: h.textContent?.trim().substring(0, 80),
      top: h.getBoundingClientRect().top,
      visible: h.offsetParent !== null,
    })).filter(h => h.visible);
  });
  console.log('\nHeadings after goal click:', JSON.stringify(headingsAfter, null, 2));

  // Now click 続行 to see what happens
  console.log('\nClicking 続行...');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    document.querySelectorAll('button, material-button').forEach(b => {
      if (b.textContent?.trim() === '続行' && b.offsetParent) b.click();
    });
  });
  await page.waitForTimeout(5000);

  console.log('URL after 続行:', page.url());
  await ss(page, 'after-continue-full');

  // Check headings again
  const headingsAfterContinue = await page.evaluate(() => {
    const hs = document.querySelectorAll('[role="heading"], h1, h2, h3, h4');
    return Array.from(hs).map(h => ({
      text: h.textContent?.trim().substring(0, 80),
      top: h.getBoundingClientRect().top,
      visible: h.offsetParent !== null,
    })).filter(h => h.visible).slice(0, 30);
  });
  console.log('\nHeadings after 続行:', JSON.stringify(headingsAfterContinue, null, 2));
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
