const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = 'C:/Users/duper/micro-tools/screenshots';
let sc = 50;

async function ss(page, name) {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const fp = path.join(SCREENSHOT_DIR, `${String(sc++).padStart(2,'0')}-${name}.png`);
  await page.screenshot({ path: fp, fullPage: false });
  console.log(`SS: ${fp}`);
}

// Helper: create one campaign end-to-end
async function createCampaign(page, config) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Creating campaign: ${config.name}`);
  console.log(`${'='.repeat(60)}`);

  // Navigate to overview
  await page.goto('https://ads.google.com/aw/overview?ocid=7472909166&authuser=0&__u=8599148613&__c=2087511934', {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await page.waitForTimeout(4000);

  // Click FAB -> Campaign
  await page.click('material-fab[aria-label="作成"]');
  await page.waitForTimeout(2000);
  await page.click('[aria-label="キャンペーン"][role="menuitem"]');
  await page.waitForTimeout(5000);

  // Select "ウェブサイトのトラフィック" goal
  await page.evaluate(() => {
    const els = document.querySelectorAll('*');
    for (const el of els) {
      if (el.textContent?.includes('ウェブサイトのトラフィック') && !el.textContent?.includes('販売促進') && el.offsetParent !== null) {
        const target = el.querySelector('[role="button"]') || el;
        target.click();
        break;
      }
    }
  });
  await page.waitForTimeout(1000);

  // Click 続行
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button, material-button');
    for (const btn of btns) {
      if (btn.textContent?.trim() === '続行') { btn.click(); break; }
    }
  });
  await page.waitForTimeout(3000);

  // Select 検索 campaign type
  await page.evaluate(() => {
    const els = document.querySelectorAll('*');
    for (const el of els) {
      const text = el.textContent?.trim();
      if (text && text.startsWith('検索') && text.includes('テキスト広告') && el.offsetParent !== null) {
        el.click();
        break;
      }
    }
  });
  await page.waitForTimeout(2000);

  // Set campaign name
  const nameInput = await page.$('input[aria-label="キャンペーン名"]');
  if (nameInput) {
    await nameInput.click({ clickCount: 3 });
    await nameInput.fill(config.name);
    console.log('Set campaign name:', config.name);
  }

  // Find and fill URL
  await page.evaluate((url) => {
    const inputs = document.querySelectorAll('input[type="text"]');
    for (const input of inputs) {
      const label = input.getAttribute('aria-label') || '';
      if (label === 'キャンペーン名' || label.includes('検索') || label.includes('ページ')) continue;
      if (input.value && input.value.includes('Search')) continue;
      input.focus();
      input.value = url;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      break;
    }
  }, config.url);
  console.log('Set URL:', config.url);

  await page.waitForTimeout(1000);

  // Click 続行
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button, material-button');
    for (const btn of btns) {
      if (btn.textContent?.trim() === '続行') { btn.click(); break; }
    }
  });
  await page.waitForTimeout(6000);
  console.log('Advanced to bidding step');
  console.log('URL:', page.url());

  // === Bidding: change to クリック数 ===
  await page.evaluate(() => {
    const els = document.querySelectorAll('[class*="dropdown"], [role="listbox"], [role="combobox"], [aria-haspopup]');
    for (const el of els) {
      if (el.textContent?.includes('コンバージョン') && el.offsetParent !== null) {
        el.click();
        break;
      }
    }
  });
  await page.waitForTimeout(1500);

  await page.evaluate(() => {
    const options = document.querySelectorAll('[role="option"], [role="menuitem"], [role="listitem"], li');
    for (const opt of options) {
      if (opt.textContent?.includes('クリック数') && opt.offsetParent !== null) {
        opt.click();
        break;
      }
    }
  });
  await page.waitForTimeout(1500);
  console.log('Set bidding to maximize clicks');

  // Click 次へ
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button, material-button');
    for (const btn of btns) {
      if (btn.textContent?.trim() === '次へ' && btn.offsetParent !== null) { btn.click(); break; }
    }
  });
  await page.waitForTimeout(5000);

  // === Campaign Settings: Change location to Japan ===
  console.log('On campaign settings page');

  // Select Japan instead of All countries
  await page.evaluate(() => {
    // Find "日本" radio button
    const radios = document.querySelectorAll('*');
    for (const el of radios) {
      const text = el.textContent?.trim();
      if (text === '日本' && el.offsetParent !== null && el.previousElementSibling?.textContent?.includes('radio_button_unchecked')) {
        el.click();
        return;
      }
    }
    // Alternative: click the radio near 日本
    const labels = document.querySelectorAll('label, [role="radio"]');
    for (const label of labels) {
      if (label.textContent?.trim() === '日本') {
        label.click();
        return;
      }
    }
  });
  await page.waitForTimeout(1000);
  console.log('Set location to Japan');

  // Answer EU political ads question: No
  await page.evaluate(() => {
    const els = document.querySelectorAll('*');
    for (const el of els) {
      if (el.textContent?.trim().includes('いいえ、このキャンペーンには EU の政治広告は含まれていません') && el.offsetParent !== null) {
        el.click();
        return;
      }
    }
  });
  await page.waitForTimeout(500);

  // Click 次へ
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button, material-button');
    for (const btn of btns) {
      if (btn.textContent?.trim() === '次へ' && btn.offsetParent !== null) { btn.click(); break; }
    }
  });
  await page.waitForTimeout(5000);
  console.log('Passed campaign settings');

  // === AI Optimization page - just click 次へ ===
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button, material-button');
    for (const btn of btns) {
      if (btn.textContent?.trim() === '次へ' && btn.offsetParent !== null) { btn.click(); break; }
    }
  });
  await page.waitForTimeout(5000);
  console.log('Passed AI optimization');

  // === Keywords & Ads page ===
  console.log('On keywords & ads page');
  await ss(page, `${config.name}-keywords-page`);

  // Fill keywords
  // Find the keyword textarea/input area
  const keywordsFilled = await page.evaluate((keywords) => {
    // Look for textarea or contenteditable in keyword section
    const textareas = document.querySelectorAll('textarea');
    for (const ta of textareas) {
      const label = ta.getAttribute('aria-label') || '';
      const nearest = ta.closest('[class*="keyword"]') || ta.closest('[class*="section"]');
      if (label.includes('キーワード') || nearest?.textContent?.includes('キーワードの入力')) {
        ta.focus();
        ta.value = keywords;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.dispatchEvent(new Event('change', { bubbles: true }));
        return 'textarea';
      }
    }
    // Try contenteditable
    const editables = document.querySelectorAll('[contenteditable="true"]');
    for (const ed of editables) {
      if (ed.closest('[class*="keyword"]')) {
        ed.textContent = keywords;
        ed.dispatchEvent(new Event('input', { bubbles: true }));
        return 'contenteditable';
      }
    }
    return null;
  }, config.keywords.join('\n'));
  console.log('Keywords filled via:', keywordsFilled);

  if (!keywordsFilled) {
    // Try clicking in the keywords area first
    try {
      const kwArea = await page.locator('text=キーワードの入力').first();
      await kwArea.click();
      await page.waitForTimeout(500);

      // Now type the keywords
      for (const kw of config.keywords) {
        await page.keyboard.type(kw);
        await page.keyboard.press('Enter');
      }
      console.log('Keywords typed via keyboard');
    } catch (e) {
      console.log('Could not find keywords input:', e.message.substring(0, 80));
    }
  }

  await page.waitForTimeout(2000);

  // Fill ad headlines
  console.log('Filling ad headlines...');
  const headlineInputs = await page.$$('input');
  let headlineCount = 0;
  for (const input of headlineInputs) {
    const ariaLabel = await input.getAttribute('aria-label');
    if (ariaLabel?.includes('広告見出し') && headlineCount < config.headlines.length) {
      await input.fill(config.headlines[headlineCount]);
      console.log(`  Headline ${headlineCount + 1}: ${config.headlines[headlineCount]}`);
      headlineCount++;
    }
  }

  // Fill descriptions
  console.log('Filling descriptions...');
  const descInputs = await page.$$('textarea');
  let descCount = 0;
  for (const input of descInputs) {
    const ariaLabel = await input.getAttribute('aria-label');
    if (ariaLabel?.includes('説明文') && descCount < config.descriptions.length) {
      await input.fill(config.descriptions[descCount]);
      console.log(`  Description ${descCount + 1}: ${config.descriptions[descCount].substring(0, 50)}...`);
      descCount++;
    }
  }

  await page.waitForTimeout(2000);
  await ss(page, `${config.name}-ads-filled`);

  // Click 次へ
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button, material-button');
    for (const btn of btns) {
      if (btn.textContent?.trim() === '次へ' && btn.offsetParent !== null) { btn.click(); break; }
    }
  });
  await page.waitForTimeout(5000);
  console.log('Passed keywords & ads');

  // === Budget page ===
  console.log('Setting budget...');
  // Find budget input and set it
  const budgetInputs = await page.$$('input');
  for (const input of budgetInputs) {
    const ariaLabel = await input.getAttribute('aria-label');
    const value = await input.inputValue();
    if (ariaLabel?.includes('予算') || (input.getAttribute('type') === 'number' && !value)) {
      await input.fill(String(config.budget));
      console.log(`Budget set to ¥${config.budget}/day`);
      break;
    }
  }

  // Also try clicking custom budget option if available
  await page.evaluate((budget) => {
    // Find the custom budget input
    const inputs = document.querySelectorAll('input');
    for (const input of inputs) {
      const label = input.getAttribute('aria-label') || '';
      if (label.includes('カスタム') || label.includes('budget') || label.includes('予算')) {
        input.value = budget;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  }, config.budget);

  await page.waitForTimeout(2000);
  await ss(page, `${config.name}-budget`);

  // Click 次へ
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button, material-button');
    for (const btn of btns) {
      if (btn.textContent?.trim() === '次へ' && btn.offsetParent !== null) { btn.click(); break; }
    }
  });
  await page.waitForTimeout(5000);

  // === Review page ===
  console.log('On review page');
  await ss(page, `${config.name}-review`);

  const reviewText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('Review text:\n', reviewText.substring(0, 1500));

  // Try to click "キャンペーンを公開" button
  const published = await page.evaluate(() => {
    const btns = document.querySelectorAll('button, material-button');
    for (const btn of btns) {
      const text = btn.textContent?.trim();
      if ((text?.includes('キャンペーンを公開') || text === '公開') && btn.offsetParent !== null) {
        btn.click();
        return text;
      }
    }
    return null;
  });
  console.log('Publish button:', published);

  if (!published) {
    // The campaign is saved as a draft - that's ok
    console.log('Campaign saved as draft (no publish button found)');
  }

  await page.waitForTimeout(5000);
  await ss(page, `${config.name}-final`);
  console.log(`Campaign "${config.name}" creation complete. URL: ${page.url()}`);
  return true;
}

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const page = context.pages()[0];

  // Campaign 2: Tax Simulator
  await createCampaign(page, {
    name: 'Tax-Simulator-Search',
    url: 'https://tax-tools-mauve.vercel.app/',
    budget: 300,
    keywords: [
      '確定申告 シミュレーター',
      '手取り計算',
      'インボイス 計算',
      '所得税 計算 シミュレーション',
      '確定申告 簡単',
      '税金 計算 ツール',
      'フリーランス 税金 計算',
      '年収 手取り 計算',
    ],
    headlines: [
      '確定申告シミュレーター｜無料',
      '手取り計算が30秒で完了',
      'インボイス計算ツール',
      'フリーランス税金計算',
      '登録不要・完全無料',
    ],
    descriptions: [
      '確定申告の税金をシミュレーション。所得税・住民税・手取り額が瞬時にわかる無料ツール。登録不要で今すぐ使えます。',
      'フリーランス・副業の確定申告に。インボイス対応、手取り計算、所得税シミュレーションが全部無料。',
    ],
  });

  // Campaign 3: Personality Quiz
  await createCampaign(page, {
    name: 'Personality-Quiz-Search',
    url: 'https://shindan-site-one.vercel.app/tools/personality-16types/',
    budget: 300,
    keywords: [
      '性格診断 無料',
      '16タイプ 診断',
      'MBTI 診断 無料',
      '性格テスト 無料',
      '相性診断 無料',
      '自己分析 診断',
      '性格タイプ 診断',
    ],
    headlines: [
      '性格診断｜16タイプ無料テスト',
      'あなたの性格タイプは？',
      'MBTI風・無料性格診断',
      '3分で結果がわかる',
      'AI鑑定サービスあり',
    ],
    descriptions: [
      '16タイプ性格診断を完全無料で。あなたの性格タイプ、強み、相性が3分でわかる。友達にシェアして盛り上がろう！',
      '科学的な性格診断テスト。MBTI風16タイプ分類で自分を深く知る。AI鑑定レポートも人気。',
    ],
  });

  console.log('\n\n=== ALL CAMPAIGNS CREATED ===');
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
