const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = 'C:/Users/duper/micro-tools/screenshots';
let sc = 91;

async function ss(page, name) {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const fp = path.join(SCREENSHOT_DIR, `${String(sc++).padStart(2,'0')}-${name}.png`);
  await page.screenshot({ path: fp, fullPage: false });
  console.log(`SS: ${fp}`);
}

async function createCampaign(page, config) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Campaign: ${config.name}`);

  // 1. Go to overview
  await page.goto('https://ads.google.com/aw/overview?ocid=7472909166&authuser=0&__u=8599148613&__c=2087511934', {
    waitUntil: 'load', timeout: 30000
  });
  await page.waitForTimeout(6000);

  // 2. FAB -> キャンペーン
  await page.click('material-fab[aria-label="作成"]');
  await page.waitForTimeout(2000);
  await page.click('[aria-label="キャンペーン"][role="menuitem"]');
  await page.waitForTimeout(6000);

  // 3. Select goal
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  const goalRect = await page.evaluate(() => {
    const h = Array.from(document.querySelectorAll('[role="heading"]'))
      .find(el => el.textContent?.trim() === 'ウェブサイトのトラフィック' && el.getBoundingClientRect().top > 0);
    if (h) { const r = h.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 }; }
    return null;
  });
  if (goalRect) await page.mouse.click(goalRect.x, goalRect.y);
  console.log('Goal clicked');
  await page.waitForTimeout(2000);

  // 4. Click 続行 (FIRST time - to advance to campaign type selection)
  console.log('First 続行...');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  const contRect1 = await page.evaluate(() => {
    const btns = document.querySelectorAll('button, material-button');
    for (const b of btns) {
      if (b.textContent?.trim() === '続行' && b.offsetParent) {
        const r = b.getBoundingClientRect();
        if (r.top > 0) return { x: r.x + r.width/2, y: r.y + r.height/2 };
      }
    }
    return null;
  });
  if (contRect1) await page.mouse.click(contRect1.x, contRect1.y);
  await page.waitForTimeout(5000);

  // 5. NOW campaign types should be visible - scroll to find them
  console.log('Looking for campaign types...');

  // Scroll down to campaign type section
  await page.evaluate(() => {
    const heading = Array.from(document.querySelectorAll('[role="heading"]'))
      .find(el => el.textContent?.trim() === 'キャンペーン タイプを選択してください');
    if (heading) heading.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(1000);
  await ss(page, `${config.name}-types`);

  // 6. Click 検索 type
  const searchRect = await page.evaluate(() => {
    const h = Array.from(document.querySelectorAll('[role="heading"]'))
      .find(el => el.textContent?.trim() === '検索' && el.getBoundingClientRect().top > 0);
    if (h) { const r = h.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 }; }
    return null;
  });
  if (searchRect) {
    await page.mouse.click(searchRect.x, searchRect.y);
    console.log('Search type clicked');
  } else {
    console.log('Search type NOT found');
    return false;
  }
  await page.waitForTimeout(2000);

  // 7. Scroll down to URL and name fields
  console.log('Filling URL and name...');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);
  await ss(page, `${config.name}-form`);

  // Fill URL
  const urlInputs = await page.$$('input[type="text"]');
  for (const input of urlInputs) {
    const label = await input.getAttribute('aria-label');
    if (!label || label === '') {
      if (await input.isVisible()) {
        await input.click();
        await input.fill(config.url);
        await page.keyboard.press('Tab');
        console.log('URL:', config.url);
        break;
      }
    }
  }

  // Fill name
  const nameInput = await page.$('input[aria-label="キャンペーン名"]');
  if (nameInput && await nameInput.isVisible()) {
    await nameInput.click({ clickCount: 3 });
    await nameInput.fill(config.name);
    console.log('Name:', config.name);
  }

  await page.waitForTimeout(2000);
  await ss(page, `${config.name}-ready`);

  // 8. Click 続行 (SECOND time - to enter wizard)
  console.log('Second 続行...');
  const contRect2 = await page.evaluate(() => {
    const btns = document.querySelectorAll('button, material-button');
    for (const b of btns) {
      if (b.textContent?.trim() === '続行' && b.offsetParent) {
        const r = b.getBoundingClientRect();
        if (r.top > 0) return { x: r.x + r.width/2, y: r.y + r.height/2 };
      }
    }
    return null;
  });
  if (contRect2) await page.mouse.click(contRect2.x, contRect2.y);
  await page.waitForTimeout(10000);

  console.log('URL:', page.url());
  const inDraft = page.url().includes('draft');
  console.log('In draft:', inDraft);

  if (inDraft) {
    console.log('SUCCESS!');

    // Bidding
    await page.evaluate(() => {
      document.querySelectorAll('*').forEach(el => {
        const t = el.textContent?.trim();
        if (t?.includes('コンバージョン') && t?.includes('arrow_drop_down') && el.offsetParent && t.length < 80) el.click();
      });
    });
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      document.querySelectorAll('[role="option"], li').forEach(o => {
        if (o.textContent?.includes('クリック数') && o.offsetParent) o.click();
      });
    });
    await page.waitForTimeout(1000);

    // Next through all steps (5 times)
    for (let i = 0; i < 5; i++) {
      console.log(`  Next ${i+1}/5`);
      await page.evaluate(() => {
        document.querySelectorAll('button, material-button').forEach(b => {
          if (b.textContent?.trim() === '次へ' && b.offsetParent) b.click();
        });
      });
      await page.waitForTimeout(5000);

      // Fill ads if on ads page
      const hasAds = await page.evaluate(() => document.body.innerText.includes('広告見出し'));
      if (hasAds) {
        const inputs = await page.$$('input');
        let hc = 0;
        for (const inp of inputs) {
          const lbl = await inp.getAttribute('aria-label');
          if (lbl?.includes('広告見出し') && hc < config.headlines.length) {
            await inp.fill(config.headlines[hc++]);
          }
        }
        const tas = await page.$$('textarea');
        let dc = 0;
        for (const ta of tas) {
          const lbl = await ta.getAttribute('aria-label');
          if (lbl?.includes('説明文') && dc < config.descriptions.length) {
            await ta.fill(config.descriptions[dc++]);
          }
        }
        console.log(`  Filled ${hc}h, ${dc}d`);
      }
    }

    await ss(page, `${config.name}-review`);

    // Publish
    await page.evaluate(() => {
      document.querySelectorAll('button, material-button').forEach(b => {
        if (b.textContent?.trim()?.includes('公開') && b.offsetParent) b.click();
      });
    });
    await page.waitForTimeout(5000);

    // Close auth tabs
    for (const p of context.pages()) {
      if (p !== page && p.url().includes('accounts.google.com')) await p.close();
    }

    console.log(`Campaign ${config.name} DONE`);
    return true;
  }

  await ss(page, `${config.name}-fail`);
  return false;
}

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const page = context.pages()[0];

  const r1 = await createCampaign(page, {
    name: 'Tax-Simulator-Search',
    url: 'https://tax-tools-mauve.vercel.app/',
    headlines: ['確定申告シミュレーター｜無料', '手取り計算が30秒で完了', 'インボイス計算ツール'],
    descriptions: ['確定申告の税金をシミュレーション。所得税・住民税が瞬時にわかる。', 'フリーランスの確定申告に。手取り計算が全部無料。'],
  });
  console.log('Tax:', r1);

  const r2 = await createCampaign(page, {
    name: 'Personality-Quiz-Search',
    url: 'https://shindan-site-one.vercel.app/tools/personality-16types/',
    headlines: ['性格診断｜16タイプ無料テスト', 'あなたの性格タイプは？', 'MBTI風・無料性格診断'],
    descriptions: ['16タイプ性格診断を完全無料。性格タイプ、強み、相性が3分でわかる。', '科学的な性格診断テスト。AI鑑定レポートも人気。'],
  });
  console.log('Quiz:', r2);

  await page.goto('https://ads.google.com/aw/campaigns?ocid=7472909166&authuser=0&__u=8599148613&__c=2087511934', {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await page.waitForTimeout(5000);
  await ss(page, 'FINAL');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
