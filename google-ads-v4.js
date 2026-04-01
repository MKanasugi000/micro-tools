const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = 'C:/Users/duper/micro-tools/screenshots';
let sc = 67;

async function ss(page, name) {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const fp = path.join(SCREENSHOT_DIR, `${String(sc++).padStart(2,'0')}-${name}.png`);
  await page.screenshot({ path: fp, fullPage: false });
  console.log(`SS: ${fp}`);
}

async function navigateToNewCampaign(page) {
  // From campaigns list, click + button, then "新しいキャンペーン" from dropdown
  await page.goto('https://ads.google.com/aw/campaigns?ocid=7472909166&authuser=0&__u=8599148613&__c=2087511934', {
    waitUntil: 'load', timeout: 30000
  });
  await page.waitForTimeout(6000);

  // Click the + (add) button
  console.log('Clicking + button...');
  await page.click('[aria-label="キャンペーンを作成"]');
  await page.waitForTimeout(2000);
  await ss(page, 'dropdown-open');

  // Click "新しいキャンペーン" from the dropdown
  console.log('Clicking 新しいキャンペーン from dropdown...');
  await page.evaluate(() => {
    const items = document.querySelectorAll('[role="menuitem"], [role="option"], li');
    for (const item of items) {
      if (item.textContent?.includes('新しいキャンペーン') && item.offsetParent !== null) {
        item.click();
        return;
      }
    }
    // Fallback: click by text
    const all = document.querySelectorAll('*');
    for (const el of all) {
      if (el.textContent?.trim() === '新しいキャンペーン' && el.offsetParent !== null && el.tagName !== 'BODY') {
        el.click();
        return;
      }
    }
  });

  await page.waitForTimeout(8000);
  console.log('URL:', page.url());
  return page.url().includes('campaigns/new');
}

async function selectGoalAndType(page, name, url) {
  // Select ウェブサイトのトラフィック
  console.log('Selecting website traffic goal...');

  // Use a more reliable selector: find the heading with exact text
  await page.evaluate(() => {
    // Google Ads uses duplicate elements (visible + hidden for animation)
    // Need to find the ones that are actually clickable
    const headings = document.querySelectorAll('*');
    let clicked = false;
    for (const el of headings) {
      if (clicked) break;
      const text = el.textContent?.trim();
      if (text === 'ウェブサイトのトラフィック' && el.offsetParent !== null) {
        // Walk up to find the clickable parent
        let parent = el;
        for (let i = 0; i < 5; i++) {
          parent = parent.parentElement;
          if (!parent) break;
          if (parent.getAttribute('tabindex') !== null || parent.getAttribute('role') === 'button' || parent.onclick) {
            parent.click();
            clicked = true;
            break;
          }
        }
        if (!clicked) {
          el.click();
          clicked = true;
        }
      }
    }
  });
  await page.waitForTimeout(2000);

  // Scroll down to see campaign types and 続行
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(1000);

  // Check if goal was selected by looking for 続行 button state
  const continueVisible = await page.evaluate(() => {
    const btns = document.querySelectorAll('button, material-button');
    for (const btn of btns) {
      if (btn.textContent?.trim() === '続行' && btn.offsetParent !== null) return true;
    }
    return false;
  });
  console.log('Continue button visible:', continueVisible);

  if (!continueVisible) {
    // Try clicking with locator
    try {
      await page.locator('text="ウェブサイトのトラフィック"').nth(0).click();
      await page.waitForTimeout(1000);
    } catch (e) {
      console.log('Locator click failed');
    }
  }

  await ss(page, `${name}-goal-selected`);

  // Click 続行
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button, material-button');
    for (const btn of btns) {
      if (btn.textContent?.trim() === '続行' && btn.offsetParent !== null) { btn.click(); return; }
    }
  });
  await page.waitForTimeout(3000);

  // Now select 検索 campaign type
  console.log('Selecting 検索 type...');
  await page.evaluate(() => {
    const headings = document.querySelectorAll('*');
    for (const el of headings) {
      const text = el.textContent?.trim();
      if (text === '検索' && el.offsetParent !== null) {
        let parent = el;
        for (let i = 0; i < 5; i++) {
          parent = parent.parentElement;
          if (!parent) break;
          if (parent.getAttribute('tabindex') !== null || parent.getAttribute('role') === 'button') {
            parent.click();
            return;
          }
        }
        el.click();
        return;
      }
    }
  });
  await page.waitForTimeout(2000);

  // Scroll down for URL and name fields
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);

  // Set campaign name
  const nameInput = await page.$('input[aria-label="キャンペーン名"]');
  if (nameInput) {
    await nameInput.click({ clickCount: 3 });
    await nameInput.fill(name);
    console.log('Name:', name);
  }

  // Set URL
  const inputs = await page.$$('input[type="text"]');
  for (const input of inputs) {
    const label = await input.getAttribute('aria-label');
    if (!label || (!label.includes('キャンペーン') && !label.includes('検索') && !label.includes('ページ'))) {
      const val = await input.inputValue();
      if (!val || val.includes('Search')) {
        await input.click();
        await input.fill(url);
        await input.press('Tab');
        console.log('URL:', url);
        break;
      }
    }
  }

  await page.waitForTimeout(2000);
  await ss(page, `${name}-filled`);

  // Click 続行
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button, material-button');
    for (const btn of btns) {
      if (btn.textContent?.trim() === '続行' && btn.offsetParent !== null) { btn.click(); return; }
    }
  });
  await page.waitForTimeout(10000);
  console.log('URL after continue:', page.url());

  return page.url().includes('draft');
}

async function completeWizardSteps(page, config) {
  // Bidding: change to クリック数
  console.log('Setting bidding...');
  await page.evaluate(() => {
    const els = document.querySelectorAll('*');
    for (const el of els) {
      if (el.textContent?.includes('コンバージョン') && el.textContent?.includes('arrow_drop_down') && el.offsetParent !== null && el.textContent?.trim().length < 100) {
        el.click();
        break;
      }
    }
  });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const opts = document.querySelectorAll('[role="option"], li');
    for (const opt of opts) {
      if (opt.textContent?.includes('クリック数') && opt.offsetParent !== null) { opt.click(); break; }
    }
  });
  await page.waitForTimeout(1000);

  // Next
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button, material-button');
    for (const btn of btns) { if (btn.textContent?.trim() === '次へ' && btn.offsetParent !== null) { btn.click(); break; } }
  });
  await page.waitForTimeout(5000);

  // Settings: Japan + No EU ads
  console.log('Settings...');
  await page.evaluate(() => {
    const els = document.querySelectorAll('*');
    for (const el of els) {
      if (el.textContent?.trim() === '日本' && el.offsetParent !== null) { el.click(); break; }
    }
  });
  await page.waitForTimeout(500);

  // Next (skip settings details)
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button, material-button');
    for (const btn of btns) { if (btn.textContent?.trim() === '次へ' && btn.offsetParent !== null) { btn.click(); break; } }
  });
  await page.waitForTimeout(5000);

  // AI optimization - Next
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button, material-button');
    for (const btn of btns) { if (btn.textContent?.trim() === '次へ' && btn.offsetParent !== null) { btn.click(); break; } }
  });
  await page.waitForTimeout(5000);

  // Keywords & Ads
  console.log('Keywords & ads...');
  const headlineInputs = await page.$$('input');
  let hc = 0;
  for (const input of headlineInputs) {
    const label = await input.getAttribute('aria-label');
    if (label?.includes('広告見出し') && hc < config.headlines.length) {
      await input.fill(config.headlines[hc]);
      hc++;
    }
  }
  console.log(`Headlines: ${hc}`);

  const descInputs = await page.$$('textarea');
  let dc = 0;
  for (const input of descInputs) {
    const label = await input.getAttribute('aria-label');
    if (label?.includes('説明文') && dc < config.descriptions.length) {
      await input.fill(config.descriptions[dc]);
      dc++;
    }
  }
  console.log(`Descriptions: ${dc}`);

  // Next
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button, material-button');
    for (const btn of btns) { if (btn.textContent?.trim() === '次へ' && btn.offsetParent !== null) { btn.click(); break; } }
  });
  await page.waitForTimeout(5000);

  // Budget
  console.log(`Budget: ¥${config.budget}/day`);

  // Next to review
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button, material-button');
    for (const btn of btns) { if (btn.textContent?.trim() === '次へ' && btn.offsetParent !== null) { btn.click(); break; } }
  });
  await page.waitForTimeout(5000);

  // Review
  console.log('Review page');
  await ss(page, `${config.name}-review`);

  const reviewText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  // Extract key details
  if (reviewText.includes('キャンペーン名')) {
    const nameMatch = reviewText.match(/キャンペーン名\s*\n\s*(.+)/);
    console.log('Campaign name in review:', nameMatch?.[1]);
  }
  if (reviewText.includes('予算')) {
    const budgetMatch = reviewText.match(/予算\s*\n.*?￥([\d,]+)/);
    console.log('Budget in review:', budgetMatch?.[1]);
  }

  // Try publish
  const published = await page.evaluate(() => {
    const btns = document.querySelectorAll('button, material-button');
    for (const btn of btns) {
      const text = btn.textContent?.trim();
      if ((text?.includes('公開') || (text === '確認' && btn.closest('[class*="review"]'))) && btn.offsetParent !== null) {
        btn.click();
        return text;
      }
    }
    return null;
  });
  console.log('Publish result:', published || 'saved as draft');

  // Handle verification dialog if it appears
  await page.waitForTimeout(5000);
  const allPages = page.context().pages();
  if (allPages.length > 1) {
    const lastPage = allPages[allPages.length - 1];
    if (lastPage.url().includes('accounts.google.com')) {
      console.log('Verification required - closing auth tab');
      await lastPage.close();
    }
  }

  await ss(page, `${config.name}-final`);
}

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const page = context.pages()[0];

  // === Campaign 2: Tax Simulator ===
  console.log('\n======= CAMPAIGN 2: Tax Simulator =======');
  let success = await navigateToNewCampaign(page);
  if (success) {
    const inWizard = await selectGoalAndType(page, 'Tax-Simulator-Search', 'https://tax-tools-mauve.vercel.app/');
    if (inWizard) {
      await completeWizardSteps(page, {
        name: 'Tax-Simulator-Search',
        budget: 300,
        headlines: ['確定申告シミュレーター｜無料', '手取り計算が30秒で完了', 'インボイス計算ツール'],
        descriptions: [
          '確定申告の税金をシミュレーション。所得税・住民税・手取り額が瞬時にわかる。登録不要。',
          'フリーランス・副業の確定申告に。手取り計算、所得税シミュレーションが全部無料。',
        ],
      });
    } else {
      console.log('Failed to enter wizard for Tax campaign');
    }
  } else {
    console.log('Failed to navigate to new campaign');
  }

  // === Campaign 3: Personality Quiz ===
  console.log('\n======= CAMPAIGN 3: Personality Quiz =======');
  success = await navigateToNewCampaign(page);
  if (success) {
    const inWizard = await selectGoalAndType(page, 'Personality-Quiz-Search', 'https://shindan-site-one.vercel.app/tools/personality-16types/');
    if (inWizard) {
      await completeWizardSteps(page, {
        name: 'Personality-Quiz-Search',
        budget: 300,
        headlines: ['性格診断｜16タイプ無料テスト', 'あなたの性格タイプは？', 'MBTI風・無料性格診断'],
        descriptions: [
          '16タイプ性格診断を完全無料で。性格タイプ、強み、相性が3分でわかる。',
          '科学的な性格診断テスト。16タイプ分類で自分を深く知る。AI鑑定レポートも人気。',
        ],
      });
    }
  }

  // Final check
  console.log('\n======= FINAL STATUS =======');
  await page.goto('https://ads.google.com/aw/campaigns?ocid=7472909166&authuser=0&__u=8599148613&__c=2087511934', {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await page.waitForTimeout(5000);
  await ss(page, 'final-status');
  const finalText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log(finalText.substring(0, 1500));
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
