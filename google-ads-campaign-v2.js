const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = 'C:/Users/duper/micro-tools/screenshots';
let sc = 65;

async function ss(page, name) {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const fp = path.join(SCREENSHOT_DIR, `${String(sc++).padStart(2,'0')}-${name}.png`);
  await page.screenshot({ path: fp, fullPage: false });
  console.log(`SS: ${fp}`);
}

async function createCampaign(page, config) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Creating: ${config.name}`);
  console.log(`${'='.repeat(50)}`);

  // Start fresh from overview
  await page.goto('https://ads.google.com/aw/overview?ocid=7472909166&authuser=0&__u=8599148613&__c=2087511934', {
    waitUntil: 'load', timeout: 30000
  });
  await page.waitForTimeout(6000);

  // Click the + 新しいキャンペーン button (the one in the main content area, not the FAB)
  console.log('Clicking + 新しいキャンペーン...');
  const newBtn = await page.$('button[aria-label="新しいキャンペーン"]');
  if (newBtn) {
    await newBtn.click();
  } else {
    // Use FAB
    await page.click('material-fab[aria-label="作成"]');
    await page.waitForTimeout(1500);
    const item = await page.$('[aria-label="キャンペーン"][role="menuitem"]');
    if (item) await item.click();
  }
  await page.waitForTimeout(6000);
  console.log('URL:', page.url());

  if (!page.url().includes('campaigns/new')) {
    console.log('FAILED to navigate to campaign creation');
    return false;
  }

  // === Goal selection ===
  // The trick: each goal has TWO copies (one visible, one for animation).
  // We need to click the SECOND one which has check_circle.
  // Let's use a more reliable approach: click by position
  console.log('Selecting ウェブサイトのトラフィック...');

  // Find the web_traffic icon and click its parent
  const goalClicked = await page.evaluate(() => {
    // Look for elements with web_traffic text (icon name)
    const icons = document.querySelectorAll('material-icon, [class*="icon"]');
    for (const icon of icons) {
      if (icon.textContent?.trim() === 'web_traffic' && icon.offsetParent !== null) {
        // Click the parent card
        const card = icon.closest('[role="button"], [tabindex], [class*="card"], [class*="objective"]') || icon.parentElement?.parentElement;
        if (card) {
          card.click();
          return 'clicked card via icon';
        }
      }
    }

    // Alternative: look for heading with the text
    const headings = document.querySelectorAll('[role="heading"], h2, h3');
    for (const h of headings) {
      if (h.textContent?.trim() === 'ウェブサイトのトラフィック' && h.offsetParent !== null) {
        const card = h.closest('[role="button"], [tabindex], [class*="card"]') || h.parentElement;
        if (card) {
          card.click();
          return 'clicked card via heading';
        }
      }
    }
    return null;
  });
  console.log('Goal click result:', goalClicked);

  await page.waitForTimeout(2000);
  await ss(page, `${config.name}-goal`);

  // Check if goal is selected by scrolling down to see 続行 button and conversion section
  const hasGoalSection = await page.evaluate(() => {
    return document.body.innerText.includes('コンバージョン目標を使用して');
  });
  console.log('Conversion goals section visible:', hasGoalSection);

  if (!hasGoalSection) {
    // Try clicking using locator with more specific targeting
    console.log('Trying locator approach...');
    try {
      // The "ウェブサイトのトラフィック" card - click the container
      await page.locator('[role="heading"]:has-text("ウェブサイトのトラフィック")').first().click();
      await page.waitForTimeout(2000);
    } catch (e) {
      console.log('Locator failed:', e.message.substring(0, 80));
    }
  }

  // Scroll down to see 続行 button
  await page.evaluate(() => window.scrollTo(0, 1000));
  await page.waitForTimeout(1000);

  // Now we should see campaign type selection
  // Click on 検索
  console.log('Selecting 検索 campaign type...');
  await page.evaluate(() => {
    const headings = document.querySelectorAll('[role="heading"], h2, h3, h4');
    for (const h of headings) {
      if (h.textContent?.trim() === '検索' && h.offsetParent !== null) {
        const card = h.closest('[role="button"], [tabindex], [class*="card"]') || h.parentElement;
        if (card) {
          card.click();
          return;
        }
      }
    }
  });
  await page.waitForTimeout(1000);

  // Scroll to bottom for URL and name fields
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);

  // Set campaign name
  const nameInput = await page.$('input[aria-label="キャンペーン名"]');
  if (nameInput) {
    await nameInput.click({ clickCount: 3 });
    await nameInput.fill(config.name);
    console.log('Name set:', config.name);
  }

  // Set URL - find the unlabeled input (it's the one next to お店やサービスのウェブサイト)
  const urlSet = await page.evaluate((url) => {
    const inputs = document.querySelectorAll('input[type="text"]');
    for (const input of inputs) {
      const label = input.getAttribute('aria-label') || '';
      if (label === 'キャンペーン名' || label.includes('検索') || label.includes('ページ')) continue;
      if (input.offsetParent !== null && (!input.value || input.value.includes('Search'))) {
        // Use native setter for React/Angular compatibility
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(input, url);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));
        return true;
      }
    }
    return false;
  }, config.url);
  console.log('URL set:', urlSet);

  await page.waitForTimeout(1000);
  await ss(page, `${config.name}-form`);

  // Click 続行
  console.log('Clicking 続行...');
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button, material-button');
    for (const btn of btns) {
      if (btn.textContent?.trim() === '続行' && btn.offsetParent !== null) {
        btn.click();
        return;
      }
    }
  });
  await page.waitForTimeout(10000);
  console.log('URL after 続行:', page.url());

  const inWizard = page.url().includes('draft');
  console.log('In wizard:', inWizard);

  if (!inWizard) {
    // Check for error messages
    const errors = await page.evaluate(() => {
      const errEls = document.querySelectorAll('[class*="error"], .error, [role="alert"]');
      return Array.from(errEls).map(el => el.textContent?.trim().substring(0, 200));
    });
    console.log('Errors:', errors);
    await ss(page, `${config.name}-error`);

    // Maybe the URL field didn't work, try a different approach
    console.log('Trying playwright fill for URL...');
    const inputs = await page.$$('input[type="text"]');
    for (const input of inputs) {
      const label = await input.getAttribute('aria-label');
      const val = await input.inputValue();
      if (label !== 'キャンペーン名' && !label?.includes('検索') && !label?.includes('ページ')) {
        console.log(`Found input: label="${label}" val="${val}"`);
        await input.click();
        await input.fill(config.url);
        await input.press('Tab');
        console.log('Filled URL with playwright fill');
        break;
      }
    }

    await page.waitForTimeout(2000);
    await ss(page, `${config.name}-url-retry`);

    // Try 続行 again
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button, material-button');
      for (const btn of btns) {
        if (btn.textContent?.trim() === '続行' && btn.offsetParent !== null) {
          btn.click();
          return;
        }
      }
    });
    await page.waitForTimeout(10000);
    console.log('URL after retry:', page.url());
  }

  if (page.url().includes('draft')) {
    console.log('SUCCESS - in wizard!');
    // Continue through wizard steps...
    await completeWizard(page, config);
  } else {
    console.log('FAILED to enter wizard');
    await ss(page, `${config.name}-failed`);
  }

  return page.url().includes('draft');
}

async function completeWizard(page, config) {
  // Bidding
  console.log('Setting bidding...');
  await page.evaluate(() => {
    const els = document.querySelectorAll('*');
    for (const el of els) {
      if (el.textContent?.includes('コンバージョン') && el.textContent?.includes('arrow_drop_down') && el.offsetParent !== null && el.tagName !== 'BODY' && el.textContent?.trim().length < 100) {
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

  // Campaign settings - select Japan
  console.log('Settings: selecting Japan...');
  await page.evaluate(() => {
    // Find 日本 radio
    const labels = document.querySelectorAll('label, span, div');
    for (const el of labels) {
      if (el.textContent?.trim() === '日本' && el.offsetParent !== null) {
        el.click();
        return;
      }
    }
  });
  await page.waitForTimeout(500);

  // EU ads - No
  await page.evaluate(() => {
    const els = document.querySelectorAll('*');
    for (const el of els) {
      if (el.textContent?.trim()?.startsWith('いいえ') && el.offsetParent !== null) { el.click(); break; }
    }
  });
  await page.waitForTimeout(500);

  // Next
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
  console.log('Entering keywords & ads...');

  // Headlines
  const headlineInputs = await page.$$('input');
  let hc = 0;
  for (const input of headlineInputs) {
    const label = await input.getAttribute('aria-label');
    if (label?.includes('広告見出し') && hc < config.headlines.length) {
      await input.fill(config.headlines[hc]);
      hc++;
    }
  }
  console.log(`Filled ${hc} headlines`);

  // Descriptions
  const descInputs = await page.$$('textarea');
  let dc = 0;
  for (const input of descInputs) {
    const label = await input.getAttribute('aria-label');
    if (label?.includes('説明文') && dc < config.descriptions.length) {
      await input.fill(config.descriptions[dc]);
      dc++;
    }
  }
  console.log(`Filled ${dc} descriptions`);

  // Next
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button, material-button');
    for (const btn of btns) { if (btn.textContent?.trim() === '次へ' && btn.offsetParent !== null) { btn.click(); break; } }
  });
  await page.waitForTimeout(5000);

  // Budget - try to set custom amount
  console.log(`Setting budget to ¥${config.budget}/day...`);

  // Look for budget input
  const budgetInputs = await page.$$('input');
  for (const input of budgetInputs) {
    const label = await input.getAttribute('aria-label');
    if (label?.includes('カスタム') || label?.includes('予算')) {
      await input.fill(String(config.budget));
      console.log('Budget set');
      break;
    }
  }

  // Next to review
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button, material-button');
    for (const btn of btns) { if (btn.textContent?.trim() === '次へ' && btn.offsetParent !== null) { btn.click(); break; } }
  });
  await page.waitForTimeout(5000);

  // Review page
  console.log('On review page');
  await ss(page, `${config.name}-review`);

  const reviewText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('Review:', reviewText.substring(0, 800));

  // Try to publish
  const published = await page.evaluate(() => {
    const btns = document.querySelectorAll('button, material-button');
    for (const btn of btns) {
      const text = btn.textContent?.trim();
      if ((text?.includes('公開') || text === '確認') && btn.offsetParent !== null) {
        btn.click();
        return text;
      }
    }
    return null;
  });
  console.log('Publish:', published || 'saved as draft');

  await page.waitForTimeout(5000);
  await ss(page, `${config.name}-done`);
}

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const page = context.pages()[0];

  // Create Tax campaign
  const tax = await createCampaign(page, {
    name: 'Tax-Simulator-Search',
    url: 'https://tax-tools-mauve.vercel.app/',
    budget: 300,
    keywords: ['確定申告 シミュレーター', '手取り計算', 'インボイス 計算', '税金 計算'],
    headlines: ['確定申告シミュレーター｜無料', '手取り計算が30秒で完了', 'インボイス計算ツール'],
    descriptions: [
      '確定申告の税金をシミュレーション。所得税・住民税・手取り額が瞬時にわかる。登録不要。',
      'フリーランス・副業の確定申告に。手取り計算、所得税シミュレーションが全部無料。',
    ],
  });
  console.log('Tax campaign result:', tax);

  // Create Quiz campaign
  const quiz = await createCampaign(page, {
    name: 'Personality-Quiz-Search',
    url: 'https://shindan-site-one.vercel.app/tools/personality-16types/',
    budget: 300,
    keywords: ['性格診断 無料', '16タイプ 診断', 'MBTI 診断', '性格テスト'],
    headlines: ['性格診断｜16タイプ無料テスト', 'あなたの性格タイプは？', 'MBTI風・無料性格診断'],
    descriptions: [
      '16タイプ性格診断を完全無料で。性格タイプ、強み、相性が3分でわかる。',
      '科学的な性格診断テスト。16タイプ分類で自分を深く知る。AI鑑定レポートも人気。',
    ],
  });
  console.log('Quiz campaign result:', quiz);

  // Final state
  console.log('\n=== DONE ===');
  await page.goto('https://ads.google.com/aw/campaigns?ocid=7472909166&authuser=0&__u=8599148613&__c=2087511934', {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await page.waitForTimeout(5000);
  await ss(page, 'final-all');

  const text = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log(text.substring(0, 1500));
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
