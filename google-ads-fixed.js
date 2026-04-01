const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = 'C:/Users/duper/micro-tools/screenshots';
let sc = 85;

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

  // 3. Select goal: ウェブサイトのトラフィック
  console.log('Selecting goal...');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);

  // Click the card
  let rect = await page.evaluate(() => {
    const h = Array.from(document.querySelectorAll('[role="heading"]'))
      .find(el => el.textContent?.trim() === 'ウェブサイトのトラフィック' && el.getBoundingClientRect().top > 0);
    if (h) { const r = h.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 }; }
    return null;
  });
  if (rect) await page.mouse.click(rect.x, rect.y);
  await page.waitForTimeout(2000);

  // 4. Scroll down INCREMENTALLY to find the campaign type section
  console.log('Looking for campaign type section...');

  // Scroll down to find "キャンペーン タイプを選択してください"
  for (let scroll = 200; scroll <= 2000; scroll += 200) {
    await page.evaluate((s) => window.scrollTo(0, s), scroll);
    await page.waitForTimeout(300);

    const typeHeadingVisible = await page.evaluate(() => {
      const heading = Array.from(document.querySelectorAll('[role="heading"]'))
        .find(el => el.textContent?.trim() === 'キャンペーン タイプを選択してください');
      if (heading) {
        const r = heading.getBoundingClientRect();
        return r.top > 0 && r.top < 800;
      }
      return false;
    });

    if (typeHeadingVisible) {
      console.log(`Found type section at scroll=${scroll}`);
      break;
    }
  }

  // 5. Click 検索 type
  console.log('Clicking 検索...');
  const searchRect = await page.evaluate(() => {
    const headings = document.querySelectorAll('[role="heading"]');
    for (const h of headings) {
      if (h.textContent?.trim() === '検索') {
        const r = h.getBoundingClientRect();
        if (r.top > 0 && r.top < 1000) return { x: r.x + r.width/2, y: r.y + r.height/2 };
      }
    }
    return null;
  });
  if (searchRect) {
    await page.mouse.click(searchRect.x, searchRect.y);
    console.log('Clicked at', searchRect);
  } else {
    console.log('Search type not visible!');
    await ss(page, `${config.name}-no-search`);
    return false;
  }
  await page.waitForTimeout(2000);
  await ss(page, `${config.name}-type-selected`);

  // 6. Scroll down more to find URL and name fields
  console.log('Looking for URL and name fields...');
  for (let scroll = 800; scroll <= 3000; scroll += 200) {
    await page.evaluate((s) => window.scrollTo(0, s), scroll);
    await page.waitForTimeout(200);

    const nameVisible = await page.$('input[aria-label="キャンペーン名"]');
    if (nameVisible) {
      const vis = await nameVisible.isVisible();
      if (vis) {
        console.log(`Name field visible at scroll=${scroll}`);
        break;
      }
    }
  }

  // 7. Fill URL
  const urlInputs = await page.$$('input[type="text"]');
  for (const input of urlInputs) {
    const label = await input.getAttribute('aria-label');
    if (!label || label === '') {
      const vis = await input.isVisible();
      if (vis) {
        await input.click();
        await input.fill(config.url);
        await page.keyboard.press('Tab');
        console.log('URL set:', config.url);
        break;
      }
    }
  }

  // 8. Fill campaign name
  const nameInput = await page.$('input[aria-label="キャンペーン名"]');
  if (nameInput && await nameInput.isVisible()) {
    await nameInput.click({ clickCount: 3 });
    await nameInput.fill(config.name);
    console.log('Name set:', config.name);
  }

  await page.waitForTimeout(2000);
  await ss(page, `${config.name}-form-filled`);

  // 9. Scroll to 続行 and click it
  console.log('Clicking 続行...');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);

  const contRect = await page.evaluate(() => {
    const btns = document.querySelectorAll('button, material-button');
    for (const btn of btns) {
      if (btn.textContent?.trim() === '続行' && btn.offsetParent) {
        const r = btn.getBoundingClientRect();
        if (r.top > 0 && r.top < 1000) return { x: r.x + r.width/2, y: r.y + r.height/2 };
      }
    }
    return null;
  });
  if (contRect) await page.mouse.click(contRect.x, contRect.y);

  await page.waitForTimeout(10000);
  console.log('URL:', page.url());

  if (page.url().includes('draft')) {
    console.log('SUCCESS - IN WIZARD!');

    // === Complete wizard quickly ===
    // Bidding -> clicks
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

    // Click Next through all steps
    for (let i = 0; i < 5; i++) {
      console.log(`  Next (${i+1}/5)...`);
      await page.evaluate(() => {
        document.querySelectorAll('button, material-button').forEach(b => {
          if (b.textContent?.trim() === '次へ' && b.offsetParent) b.click();
        });
      });
      await page.waitForTimeout(5000);

      // On ads page, fill headlines/descriptions
      const hasAds = await page.evaluate(() => document.body.innerText.includes('広告見出し'));
      if (hasAds) {
        console.log('  Filling ads...');
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
        console.log(`  ${hc} headlines, ${dc} descriptions`);
      }
    }

    await ss(page, `${config.name}-review`);

    // Publish
    const pub = await page.evaluate(() => {
      const btns = document.querySelectorAll('button, material-button');
      for (const b of btns) {
        if (b.textContent?.trim()?.includes('公開') && b.offsetParent) { b.click(); return true; }
      }
      return false;
    });
    console.log('Published:', pub);

    await page.waitForTimeout(5000);

    // Close auth tabs
    for (const p of page.context().pages()) {
      if (p !== page && p.url().includes('accounts.google.com')) await p.close();
    }

    await ss(page, `${config.name}-done`);
    return true;
  }

  console.log('FAILED');
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
  console.log('Tax result:', r1);

  const r2 = await createCampaign(page, {
    name: 'Personality-Quiz-Search',
    url: 'https://shindan-site-one.vercel.app/tools/personality-16types/',
    headlines: ['性格診断｜16タイプ無料テスト', 'あなたの性格タイプは？', 'MBTI風・無料性格診断'],
    descriptions: ['16タイプ性格診断を完全無料。性格タイプ、強み、相性が3分でわかる。', '科学的な性格診断テスト。AI鑑定レポートも人気。'],
  });
  console.log('Quiz result:', r2);

  // Final
  await page.goto('https://ads.google.com/aw/campaigns?ocid=7472909166&authuser=0&__u=8599148613&__c=2087511934', {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await page.waitForTimeout(5000);
  await ss(page, 'FINAL');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
