const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = 'C:/Users/duper/micro-tools/screenshots';
let sc = 99;

async function ss(page, name) {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const fp = path.join(SCREENSHOT_DIR, `${String(sc++).padStart(2,'0')}-${name}.png`);
  await page.screenshot({ path: fp, fullPage: false });
  console.log(`SS: ${fp}`);
}

async function dismissModals(page) {
  // Dismiss "このアカウントを削除しますか？" - click 保持する
  const dismissed = await page.evaluate(() => {
    const btns = document.querySelectorAll('button, material-button, [role="button"]');
    let found = [];
    for (const btn of btns) {
      const text = btn.textContent?.trim();
      if (text === '保持する' || text === '閉じる' || text === '続行' || text === 'close') {
        found.push(text);
      }
    }
    // Click 保持する first (keep account)
    for (const btn of btns) {
      if (btn.textContent?.trim() === '保持する' && btn.offsetParent !== null) {
        btn.click();
        return '保持する clicked';
      }
    }
    // Also close any "接続が切断されました" dialog
    for (const btn of btns) {
      if (btn.textContent?.trim() === '閉じる' && btn.offsetParent !== null) {
        btn.click();
        return '閉じる clicked';
      }
    }
    return `Found buttons: ${found.join(', ')}`;
  });
  console.log('Dismiss result:', dismissed);
  await page.waitForTimeout(2000);

  // Try again for any remaining modals
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button, material-button, [role="button"]');
    for (const btn of btns) {
      const text = btn.textContent?.trim();
      if ((text === '保持する' || text === '閉じる') && btn.offsetParent !== null) {
        btn.click();
      }
    }
  });
  await page.waitForTimeout(1000);
}

async function createCampaign(page, config) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Campaign: ${config.name}`);

  await page.goto('https://ads.google.com/aw/overview?ocid=7472909166&authuser=0&__u=8599148613&__c=2087511934', {
    waitUntil: 'load', timeout: 30000
  });
  await page.waitForTimeout(6000);
  await dismissModals(page);

  // FAB -> Campaign
  await page.click('material-fab[aria-label="作成"]');
  await page.waitForTimeout(2000);
  await page.click('[aria-label="キャンペーン"][role="menuitem"]');
  await page.waitForTimeout(6000);
  await dismissModals(page);

  // Select goal
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

  // First 続行
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    document.querySelectorAll('button, material-button').forEach(b => {
      if (b.textContent?.trim() === '続行' && b.offsetParent) b.click();
    });
  });
  await page.waitForTimeout(5000);
  await dismissModals(page);

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

  // Now look for URL and name fields
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);
  await ss(page, `${config.name}-form`);

  // Check for inputs
  const inputInfo = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input, textarea'))
      .filter(el => el.offsetParent)
      .map(el => ({
        tag: el.tagName,
        type: el.type,
        ariaLabel: el.getAttribute('aria-label'),
        value: el.value,
        visible: el.getBoundingClientRect().y > 0,
      }));
  });
  console.log('Inputs:', JSON.stringify(inputInfo));

  // Fill URL
  for (const input of await page.$$('input[type="text"]')) {
    const label = await input.getAttribute('aria-label');
    if (!label || label === '') {
      if (await input.isVisible()) {
        await input.click();
        await input.fill(config.url);
        await page.keyboard.press('Tab');
        console.log('URL set');
        break;
      }
    }
  }

  // Fill name
  const nameInput = await page.$('input[aria-label="キャンペーン名"]');
  if (nameInput && await nameInput.isVisible()) {
    await nameInput.click({ clickCount: 3 });
    await nameInput.fill(config.name);
    console.log('Name set');
  }

  await page.waitForTimeout(2000);

  // Second 続行
  console.log('Second 続行...');
  await page.evaluate(() => {
    document.querySelectorAll('button, material-button').forEach(b => {
      if (b.textContent?.trim() === '続行' && b.offsetParent) b.click();
    });
  });
  await page.waitForTimeout(15000);
  console.log('URL:', page.url());

  if (page.url().includes('draft')) {
    console.log('IN WIZARD!');

    await dismissModals(page);

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

    for (let i = 0; i < 5; i++) {
      console.log(`  Next ${i+1}`);
      await page.evaluate(() => {
        document.querySelectorAll('button, material-button').forEach(b => {
          if (b.textContent?.trim() === '次へ' && b.offsetParent) b.click();
        });
      });
      await page.waitForTimeout(5000);
      await dismissModals(page);

      const hasAds = await page.evaluate(() => document.body.innerText.includes('広告見出し'));
      if (hasAds) {
        const inputs = await page.$$('input');
        let hc = 0;
        for (const inp of inputs) {
          const lbl = await inp.getAttribute('aria-label');
          if (lbl?.includes('広告見出し') && hc < config.headlines.length) await inp.fill(config.headlines[hc++]);
        }
        const tas = await page.$$('textarea');
        let dc = 0;
        for (const ta of tas) {
          const lbl = await ta.getAttribute('aria-label');
          if (lbl?.includes('説明文') && dc < config.descriptions.length) await ta.fill(config.descriptions[dc++]);
        }
        console.log(`  Ads: ${hc}h, ${dc}d`);
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
    for (const p of page.context().pages()) {
      if (p !== page && p.url().includes('accounts.google.com')) await p.close();
    }
    return true;
  }

  console.log('FAILED');
  await ss(page, `${config.name}-fail`);
  return false;
}

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const page = context.pages()[0];

  // First, go to ads and dismiss all modals
  await page.goto('https://ads.google.com/aw/overview?ocid=7472909166&authuser=0&__u=8599148613&__c=2087511934', {
    waitUntil: 'load', timeout: 30000
  });
  await page.waitForTimeout(6000);
  await dismissModals(page);
  await page.waitForTimeout(2000);
  await dismissModals(page);
  await ss(page, 'clean-state');

  const r1 = await createCampaign(page, {
    name: 'Tax-Simulator-Search',
    url: 'https://tax-tools-mauve.vercel.app/',
    headlines: ['確定申告シミュレーター｜無料', '手取り計算が30秒で完了', 'インボイス計算ツール'],
    descriptions: ['確定申告の税金をシミュレーション。所得税・住民税が瞬時にわかる。', 'フリーランスの確定申告に。手取り計算が全部無料。'],
  });
  console.log('Tax:', r1);

  if (r1) {
    const r2 = await createCampaign(page, {
      name: 'Personality-Quiz-Search',
      url: 'https://shindan-site-one.vercel.app/tools/personality-16types/',
      headlines: ['性格診断｜16タイプ無料テスト', 'あなたの性格タイプは？', 'MBTI風・無料性格診断'],
      descriptions: ['16タイプ性格診断を完全無料。性格タイプ、強み、相性が3分でわかる。', '科学的な性格診断テスト。AI鑑定レポートも人気。'],
    });
    console.log('Quiz:', r2);
  }

  await page.goto('https://ads.google.com/aw/campaigns?ocid=7472909166&authuser=0&__u=8599148613&__c=2087511934', {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await page.waitForTimeout(5000);
  await ss(page, 'FINAL');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
