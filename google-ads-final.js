const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = 'C:/Users/duper/micro-tools/screenshots';
let sc = 82;

async function ss(page, name) {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const fp = path.join(SCREENSHOT_DIR, `${String(sc++).padStart(2,'0')}-${name}.png`);
  await page.screenshot({ path: fp, fullPage: false });
  console.log(`SS: ${fp}`);
}

async function createCampaignFromOverview(page, config) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Campaign: ${config.name}`);
  console.log(`${'='.repeat(50)}`);

  // 1. Go to overview
  await page.goto('https://ads.google.com/aw/overview?ocid=7472909166&authuser=0&__u=8599148613&__c=2087511934', {
    waitUntil: 'load', timeout: 30000
  });
  await page.waitForTimeout(6000);

  // 2. Click FAB -> キャンペーン
  await page.click('material-fab[aria-label="作成"]');
  await page.waitForTimeout(2000);
  await page.click('[aria-label="キャンペーン"][role="menuitem"]');
  await page.waitForTimeout(6000);

  if (!page.url().includes('campaigns/new')) {
    console.log('Failed to open campaign creation');
    return false;
  }

  // 3. Select ウェブサイトのトラフィック - click the heading
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);

  // Click the card at visible coordinates
  const rect = await page.evaluate(() => {
    const headings = document.querySelectorAll('[role="heading"]');
    for (const h of headings) {
      if (h.textContent?.trim() === 'ウェブサイトのトラフィック') {
        const r = h.getBoundingClientRect();
        if (r.top > 0 && r.top < 1000) return { x: r.x + r.width/2, y: r.y + r.height/2 };
      }
    }
    return null;
  });

  if (rect) {
    await page.mouse.click(rect.x, rect.y);
    console.log('Clicked goal at', rect.x, rect.y);
  }
  await page.waitForTimeout(2000);

  // 4. SCROLL DOWN to see campaign types (they are below the fold!)
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(1000);

  // 5. Now look for and click the 検索 type
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
    console.log('Clicked Search at', searchRect.x, searchRect.y);
  } else {
    // scroll into view
    await page.evaluate(() => {
      const headings = document.querySelectorAll('[role="heading"]');
      for (const h of headings) {
        if (h.textContent?.trim() === '検索') {
          h.scrollIntoView({ block: 'center' });
          break;
        }
      }
    });
    await page.waitForTimeout(500);
    const searchRect2 = await page.evaluate(() => {
      const headings = document.querySelectorAll('[role="heading"]');
      for (const h of headings) {
        if (h.textContent?.trim() === '検索') {
          const r = h.getBoundingClientRect();
          return { x: r.x + r.width/2, y: r.y + r.height/2 };
        }
      }
      return null;
    });
    if (searchRect2) await page.mouse.click(searchRect2.x, searchRect2.y);
  }
  await page.waitForTimeout(2000);

  // 6. Scroll to bottom for URL and name fields
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);
  await ss(page, `${config.name}-bottom`);

  // 7. Fill campaign name
  const nameInput = await page.$('input[aria-label="キャンペーン名"]');
  if (nameInput) {
    await nameInput.click({ clickCount: 3 });
    await nameInput.fill(config.name);
    console.log('Name set');
  }

  // 8. Fill URL field - the unlabeled input
  const allInputs = await page.$$('input[type="text"]');
  for (const input of allInputs) {
    const ariaLabel = await input.getAttribute('aria-label');
    const val = await input.inputValue();
    if (!ariaLabel && !val) {
      await input.click();
      await input.fill(config.url);
      await page.keyboard.press('Tab');
      console.log('URL set:', config.url);
      break;
    } else if (!ariaLabel && val !== config.name) {
      await input.click({ clickCount: 3 });
      await input.fill(config.url);
      await page.keyboard.press('Tab');
      console.log('URL replaced:', config.url);
      break;
    }
  }

  await page.waitForTimeout(2000);

  // 9. Click 続行 button
  console.log('Clicking 続行...');
  const contRect = await page.evaluate(() => {
    const btns = document.querySelectorAll('button, material-button');
    for (const btn of btns) {
      if (btn.textContent?.trim() === '続行' && btn.offsetParent !== null) {
        const r = btn.getBoundingClientRect();
        return { x: r.x + r.width/2, y: r.y + r.height/2 };
      }
    }
    return null;
  });
  if (contRect) {
    await page.mouse.click(contRect.x, contRect.y);
    console.log('Clicked at', contRect.x, contRect.y);
  }

  await page.waitForTimeout(10000);
  console.log('URL:', page.url());

  if (page.url().includes('draft')) {
    console.log('IN WIZARD!');
    await ss(page, `${config.name}-wizard`);

    // Bidding - change to clicks
    await page.evaluate(() => {
      const els = document.querySelectorAll('*');
      for (const el of els) {
        const t = el.textContent?.trim();
        if (t && t.includes('コンバージョン') && t.includes('arrow_drop_down') && el.offsetParent && t.length < 80) {
          el.click(); break;
        }
      }
    });
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      document.querySelectorAll('[role="option"], li').forEach(o => {
        if (o.textContent?.includes('クリック数') && o.offsetParent) o.click();
      });
    });
    await page.waitForTimeout(1000);

    // Click Next for each remaining step
    for (let i = 1; i <= 5; i++) {
      console.log(`次へ (${i}/5)...`);
      await page.evaluate(() => {
        const btns = document.querySelectorAll('button, material-button');
        for (const btn of btns) {
          if (btn.textContent?.trim() === '次へ' && btn.offsetParent) { btn.click(); break; }
        }
      });
      await page.waitForTimeout(5000);

      // On keywords/ads page, fill in headlines and descriptions
      const pageText = await page.evaluate(() => document.body.innerText.substring(0, 500));
      if (pageText.includes('広告見出し')) {
        console.log('On ads page, filling...');
        const headInputs = await page.$$('input');
        let hc = 0;
        for (const inp of headInputs) {
          const label = await inp.getAttribute('aria-label');
          if (label?.includes('広告見出し') && hc < config.headlines.length) {
            await inp.fill(config.headlines[hc++]);
          }
        }
        console.log(`Filled ${hc} headlines`);

        const descInputs = await page.$$('textarea');
        let dc = 0;
        for (const inp of descInputs) {
          const label = await inp.getAttribute('aria-label');
          if (label?.includes('説明文') && dc < config.descriptions.length) {
            await inp.fill(config.descriptions[dc++]);
          }
        }
        console.log(`Filled ${dc} descriptions`);
      }
    }

    await ss(page, `${config.name}-review`);

    // Try publish
    const pub = await page.evaluate(() => {
      const btns = document.querySelectorAll('button, material-button');
      for (const btn of btns) {
        const t = btn.textContent?.trim();
        if (t?.includes('公開') && btn.offsetParent) { btn.click(); return t; }
      }
      return null;
    });
    console.log('Publish:', pub || 'saved as draft');

    await page.waitForTimeout(5000);

    // Close any auth tabs
    const allPages = context.pages();
    for (const p of allPages) {
      if (p !== page && p.url().includes('accounts.google.com')) {
        await p.close();
        console.log('Closed auth tab');
      }
    }

    await ss(page, `${config.name}-done`);
    return true;
  } else {
    console.log('FAILED to enter wizard');
    await ss(page, `${config.name}-fail`);

    // Debug: check what's on the page
    const text = await page.evaluate(() => document.body.innerText.substring(0, 500));
    console.log('Page text:', text.substring(0, 300));
    return false;
  }
}

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const page = context.pages()[0];

  const r1 = await createCampaignFromOverview(page, {
    name: 'Tax-Simulator-Search',
    url: 'https://tax-tools-mauve.vercel.app/',
    budget: 300,
    headlines: ['確定申告シミュレーター｜無料', '手取り計算が30秒で完了', 'インボイス計算ツール'],
    descriptions: [
      '確定申告の税金をシミュレーション。所得税・住民税・手取り額が瞬時にわかる。',
      'フリーランス・副業の確定申告に。手取り計算が全部無料。',
    ],
  });

  if (r1) {
    const r2 = await createCampaignFromOverview(page, {
      name: 'Personality-Quiz-Search',
      url: 'https://shindan-site-one.vercel.app/tools/personality-16types/',
      budget: 300,
      headlines: ['性格診断｜16タイプ無料テスト', 'あなたの性格タイプは？', 'MBTI風・無料性格診断'],
      descriptions: [
        '16タイプ性格診断を完全無料。性格タイプ、強み、相性が3分でわかる。',
        '科学的な性格診断テスト。AI鑑定レポートも人気。',
      ],
    });
  }

  // Final screenshot
  await page.goto('https://ads.google.com/aw/campaigns?ocid=7472909166&authuser=0&__u=8599148613&__c=2087511934', {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await page.waitForTimeout(5000);
  await ss(page, 'final-campaigns');
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
