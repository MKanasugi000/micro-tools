const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = 'C:/Users/duper/micro-tools/screenshots';
let sc = 60;

async function ss(page, name) {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const fp = path.join(SCREENSHOT_DIR, `${String(sc++).padStart(2,'0')}-${name}.png`);
  await page.screenshot({ path: fp, fullPage: false });
  console.log(`SS: ${fp}`);
}

async function createSearchCampaign(page, config) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Creating: ${config.name}`);
  console.log(`${'='.repeat(50)}`);

  // 1. Navigate to overview first (clean state)
  await page.goto('https://ads.google.com/aw/overview?ocid=7472909166&authuser=0&__u=8599148613&__c=2087511934', {
    waitUntil: 'load', timeout: 30000
  });
  await page.waitForTimeout(5000);

  // 2. Click FAB -> キャンペーン
  console.log('Step 1: Opening campaign creation...');
  await page.click('material-fab[aria-label="作成"]');
  await page.waitForTimeout(2000);

  const menuItem = await page.$('[aria-label="キャンペーン"][role="menuitem"]');
  if (menuItem) {
    await menuItem.click();
  } else {
    console.log('Menu item not found!');
    return false;
  }
  await page.waitForTimeout(6000);
  console.log('URL:', page.url());

  // 3. Wait for goal selection page
  if (!page.url().includes('campaigns/new')) {
    console.log('Not on campaign creation page!');
    return false;
  }

  // 4. Select ウェブサイトのトラフィック
  console.log('Step 2: Selecting website traffic goal...');
  await page.evaluate(() => {
    const cards = document.querySelectorAll('*');
    for (const el of cards) {
      const t = el.textContent?.trim();
      if (t?.startsWith('ウェブサイトのトラフィック') && t?.includes('適切なユーザー') && el.offsetParent !== null) {
        el.click();
        return;
      }
    }
  });
  await page.waitForTimeout(2000);

  // 5. Click 続行
  console.log('Step 3: Clicking continue...');
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button, material-button');
    for (const btn of btns) {
      if (btn.textContent?.trim() === '続行') { btn.click(); return; }
    }
  });
  await page.waitForTimeout(3000);

  // 6. Select 検索 type
  console.log('Step 4: Selecting search type...');
  await page.evaluate(() => {
    const cards = document.querySelectorAll('*');
    for (const el of cards) {
      const t = el.textContent?.trim();
      if (t?.startsWith('検索') && t?.includes('テキスト広告') && el.offsetParent !== null) {
        el.click();
        return;
      }
    }
  });
  await page.waitForTimeout(2000);

  // 7. Set campaign name
  console.log('Step 5: Setting campaign name...');
  const nameInput = await page.$('input[aria-label="キャンペーン名"]');
  if (nameInput) {
    await nameInput.click({ clickCount: 3 });
    await nameInput.fill(config.name);
  }

  // 8. Set URL
  console.log('Step 6: Setting URL...');
  const allInputs = await page.$$('input[type="text"]');
  for (const input of allInputs) {
    const label = await input.getAttribute('aria-label');
    const val = await input.inputValue();
    if (label !== 'キャンペーン名' && !label?.includes('検索') && !label?.includes('ページ') && val !== config.name) {
      await input.click();
      await input.fill(config.url);
      console.log('URL filled');
      break;
    }
  }
  await page.waitForTimeout(1000);

  // 9. Click 続行 to enter the wizard
  console.log('Step 7: Entering campaign wizard...');
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button, material-button');
    for (const btn of btns) {
      const text = btn.textContent?.trim();
      const label = btn.getAttribute('aria-label') || '';
      if (text === '続行' || label === '保存して次のステップに進む') {
        btn.click();
        return;
      }
    }
  });
  await page.waitForTimeout(8000);
  console.log('URL after entering wizard:', page.url());

  // Check if we got into the wizard
  if (!page.url().includes('draft')) {
    console.log('DID NOT enter wizard. Trying again...');
    await ss(page, `${config.name}-stuck`);
    const pageText = await page.evaluate(() => document.body.innerText.substring(0, 500));
    console.log('Page text:', pageText);
    return false;
  }

  // === In the wizard now ===
  console.log('In wizard! Setting bidding...');

  // Bidding: click dropdown and select clicks
  await page.evaluate(() => {
    const els = document.querySelectorAll('*');
    for (const el of els) {
      if (el.textContent?.includes('コンバージョン') && el.textContent?.includes('arrow_drop_down') && el.offsetParent !== null && el.tagName !== 'BODY') {
        el.click();
        return;
      }
    }
  });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const opts = document.querySelectorAll('[role="option"], [role="menuitem"], [role="listitem"], li');
    for (const opt of opts) {
      if (opt.textContent?.includes('クリック数') && opt.offsetParent !== null) {
        opt.click();
        return;
      }
    }
  });
  await page.waitForTimeout(1000);
  console.log('Bidding set to clicks');

  // Click 次へ
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button, material-button');
    for (const btn of btns) { if (btn.textContent?.trim() === '次へ' && btn.offsetParent !== null) { btn.click(); return; } }
  });
  await page.waitForTimeout(5000);

  // Campaign settings - select Japan
  console.log('Setting location to Japan...');
  await page.evaluate(() => {
    const els = document.querySelectorAll('*');
    for (const el of els) {
      if (el.textContent?.trim() === '日本' && el.previousElementSibling?.textContent?.includes('radio_button') && el.offsetParent !== null) {
        el.click();
        return;
      }
    }
  });
  await page.waitForTimeout(500);

  // EU question - No
  await page.evaluate(() => {
    const els = document.querySelectorAll('*');
    for (const el of els) {
      if (el.textContent?.trim()?.startsWith('いいえ') && el.textContent?.includes('政治広告') && el.offsetParent !== null) {
        el.click();
        return;
      }
    }
  });
  await page.waitForTimeout(500);

  // Click 次へ
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button, material-button');
    for (const btn of btns) { if (btn.textContent?.trim() === '次へ' && btn.offsetParent !== null) { btn.click(); return; } }
  });
  await page.waitForTimeout(5000);
  console.log('Passed settings');

  // AI optimization - just click 次へ
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button, material-button');
    for (const btn of btns) { if (btn.textContent?.trim() === '次へ' && btn.offsetParent !== null) { btn.click(); return; } }
  });
  await page.waitForTimeout(5000);
  console.log('Passed AI optimization');

  // Keywords & Ads page
  console.log('On keywords & ads page...');
  await ss(page, `${config.name}-kw-page`);

  // Try to enter keywords by finding the textarea in the keyword section
  // First get the page structure
  const kwInputInfo = await page.evaluate(() => {
    const textareas = document.querySelectorAll('textarea');
    const result = [];
    for (const ta of textareas) {
      result.push({
        ariaLabel: ta.getAttribute('aria-label'),
        placeholder: ta.placeholder,
        visible: ta.offsetParent !== null,
        value: ta.value,
      });
    }
    // Also check for input fields
    const inputs = document.querySelectorAll('input[type="text"]');
    for (const inp of inputs) {
      result.push({
        ariaLabel: inp.getAttribute('aria-label'),
        placeholder: inp.placeholder,
        visible: inp.offsetParent !== null,
        value: inp.value,
        tag: 'INPUT',
      });
    }
    return result;
  });
  console.log('Keyword input info:', JSON.stringify(kwInputInfo, null, 2));

  // Scroll down to find the keyword section
  await page.evaluate(() => window.scrollBy(0, 1000));
  await page.waitForTimeout(1000);

  // Try to find keyword entry area - look for text that says "キーワードの入力" or similar
  // and then find the nearest textarea/input
  const kwEntered = await page.evaluate((keywords) => {
    // Find ALL textareas and try the ones that aren't description fields
    const textareas = document.querySelectorAll('textarea');
    for (const ta of textareas) {
      const label = ta.getAttribute('aria-label') || '';
      if (label.includes('説明文') || label.includes('Description')) continue;
      if (ta.offsetParent !== null && !ta.value) {
        ta.focus();
        // Use native input event
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        nativeInputValueSetter.call(ta, keywords);
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.dispatchEvent(new Event('change', { bubbles: true }));
        return 'textarea filled';
      }
    }
    return null;
  }, config.keywords.join('\n'));
  console.log('Keywords entered:', kwEntered);

  // Fill headlines
  console.log('Filling headlines...');
  const headlineInputs = await page.$$('input');
  let hc = 0;
  for (const input of headlineInputs) {
    const label = await input.getAttribute('aria-label');
    if (label?.includes('広告見出し') && hc < config.headlines.length) {
      await input.fill(config.headlines[hc]);
      console.log(`  H${hc+1}: ${config.headlines[hc]}`);
      hc++;
    }
  }

  // Fill descriptions
  console.log('Filling descriptions...');
  const descInputs = await page.$$('textarea');
  let dc = 0;
  for (const input of descInputs) {
    const label = await input.getAttribute('aria-label');
    if (label?.includes('説明文') && dc < config.descriptions.length) {
      await input.fill(config.descriptions[dc]);
      console.log(`  D${dc+1}: ${config.descriptions[dc].substring(0, 40)}...`);
      dc++;
    }
  }

  await page.waitForTimeout(2000);
  await ss(page, `${config.name}-filled`);

  // Click 次へ
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button, material-button');
    for (const btn of btns) { if (btn.textContent?.trim() === '次へ' && btn.offsetParent !== null) { btn.click(); return; } }
  });
  await page.waitForTimeout(5000);
  console.log('Passed keywords/ads');

  // Budget page
  console.log('Setting budget...');
  // The budget page often has predefined options and a custom option
  // Try setting custom budget
  const budgetSet = await page.evaluate((budget) => {
    const inputs = document.querySelectorAll('input');
    for (const input of inputs) {
      const label = input.getAttribute('aria-label') || '';
      const type = input.type;
      // Look for currency/budget input
      if (type === 'text' || type === 'number') {
        const parent = input.closest('[class*="budget"]') || input.closest('[class*="currency"]');
        if (parent || label.includes('予算') || label.includes('budget') || label.includes('カスタム')) {
          input.focus();
          input.value = '';
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          nativeSetter.call(input, String(budget));
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          return `set via ${label || 'unlabeled'} input`;
        }
      }
    }
    return null;
  }, config.budget);
  console.log('Budget:', budgetSet);

  await page.waitForTimeout(2000);
  await ss(page, `${config.name}-budget-set`);

  // Click 次へ to go to review
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button, material-button');
    for (const btn of btns) { if (btn.textContent?.trim() === '次へ' && btn.offsetParent !== null) { btn.click(); return; } }
  });
  await page.waitForTimeout(5000);

  // Review page
  console.log('On review page');
  await ss(page, `${config.name}-review`);

  const reviewText = await page.evaluate(() => document.body.innerText.substring(0, 2000));

  // Try to publish
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
  console.log('Publish:', published || 'saved as draft');

  await page.waitForTimeout(3000);
  console.log(`Campaign ${config.name} done. URL: ${page.url()}`);

  // Check if it needs verification again
  if (page.url().includes('accounts.google.com')) {
    console.log('Needs verification - closing auth tab');
    const allPages = page.context().pages();
    if (allPages.length > 1) {
      await allPages[allPages.length - 1].close();
    }
  }

  return true;
}

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const page = context.pages()[0];

  // First, let's check what drafts we already have
  console.log('=== Checking existing drafts ===');
  await page.goto('https://ads.google.com/aw/campaigns?ocid=7472909166&authuser=0&__u=8599148613&__c=2087511934', {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await page.waitForTimeout(5000);
  await ss(page, 'campaigns-overview');

  // Click on "下書き" tab
  try {
    await page.evaluate(() => {
      const tabs = document.querySelectorAll('[role="tab"], a');
      for (const tab of tabs) {
        if (tab.textContent?.trim() === '下書き' || tab.textContent?.includes('下書き')) {
          tab.click();
          return;
        }
      }
    });
    await page.waitForTimeout(3000);
    await ss(page, 'drafts-list');

    const draftsText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
    console.log('Drafts page:\n', draftsText.substring(0, 1500));
  } catch (e) {
    console.log('Could not find drafts tab');
  }

  // Create Campaign 2
  await createSearchCampaign(page, {
    name: 'Tax-Simulator-Search',
    url: 'https://tax-tools-mauve.vercel.app/',
    budget: 300,
    keywords: [
      '確定申告 シミュレーター',
      '手取り計算',
      'インボイス 計算',
      '所得税 計算',
      '税金 計算 ツール',
      'フリーランス 税金',
    ],
    headlines: [
      '確定申告シミュレーター｜無料',
      '手取り計算が30秒で完了',
      'インボイス計算ツール',
    ],
    descriptions: [
      '確定申告の税金をシミュレーション。所得税・住民税・手取り額が瞬時にわかる無料ツール。',
      'フリーランス・副業の確定申告に。手取り計算、所得税シミュレーションが全部無料。',
    ],
  });

  // Create Campaign 3
  await createSearchCampaign(page, {
    name: 'Personality-Quiz-Search',
    url: 'https://shindan-site-one.vercel.app/tools/personality-16types/',
    budget: 300,
    keywords: [
      '性格診断 無料',
      '16タイプ 診断',
      'MBTI 診断 無料',
      '性格テスト',
      '相性診断',
    ],
    headlines: [
      '性格診断｜16タイプ無料テスト',
      'あなたの性格タイプは？',
      'MBTI風・無料性格診断',
    ],
    descriptions: [
      '16タイプ性格診断を完全無料で。あなたの性格タイプ、強み、相性が3分でわかる。',
      '科学的な性格診断テスト。16タイプ分類で自分を深く知る。AI鑑定レポートも人気。',
    ],
  });

  // Final check
  console.log('\n=== Final Campaign List ===');
  await page.goto('https://ads.google.com/aw/campaigns?ocid=7472909166&authuser=0&__u=8599148613&__c=2087511934', {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await page.waitForTimeout(5000);
  await ss(page, 'final-campaigns');

  const finalText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('Final campaigns:\n', finalText.substring(0, 2000));
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
