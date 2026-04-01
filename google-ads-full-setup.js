const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = 'C:/Users/duper/micro-tools/screenshots';
let sc = 28;

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
  console.log('URL:', page.url());

  // === STEP: Bidding Strategy ===
  console.log('\n=== Setting Bidding Strategy ===');

  // Change from コンバージョン to クリック数 (maximize clicks for traffic)
  // Click the dropdown that says "コンバージョン"
  const dropdownClicked = await page.evaluate(() => {
    const els = document.querySelectorAll('[class*="dropdown"], [role="listbox"], [role="combobox"], [aria-haspopup]');
    for (const el of els) {
      if (el.textContent?.includes('コンバージョン') && el.offsetParent !== null) {
        el.click();
        return el.textContent.trim().substring(0, 80);
      }
    }
    // Try clicking text "コンバージョン" with arrow
    const arrows = document.querySelectorAll('[class*="arrow"], [class*="drop"]');
    for (const el of arrows) {
      if (el.closest('[class*="bid"]')?.textContent?.includes('コンバージョン')) {
        el.click();
        return 'arrow clicked';
      }
    }
    return null;
  });
  console.log('Dropdown clicked:', dropdownClicked);

  // Try clicking the specific text
  if (!dropdownClicked) {
    try {
      await page.locator('text=コンバージョン >> visible=true').first().click();
      console.log('Clicked コンバージョン text');
    } catch (e) {
      console.log('Could not click dropdown');
    }
  }

  await page.waitForTimeout(2000);
  await ss(page, 'dropdown-opened');

  // Look for "クリック数" option in dropdown
  const clicksSelected = await page.evaluate(() => {
    const options = document.querySelectorAll('[role="option"], [role="menuitem"], [role="listitem"], option, li');
    for (const opt of options) {
      if (opt.textContent?.includes('クリック数') && opt.offsetParent !== null) {
        opt.click();
        return opt.textContent.trim().substring(0, 80);
      }
    }
    // Also check material-select-dropdown-item or similar
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if (el.textContent?.trim() === 'クリック数' && el.offsetParent !== null && el.tagName !== 'BODY') {
        el.click();
        return 'clicked: ' + el.tagName;
      }
    }
    return null;
  });
  console.log('Clicks selected:', clicksSelected);

  await page.waitForTimeout(2000);
  await ss(page, 'bidding-set');

  // Click 次へ (Next)
  console.log('\n--- Clicking 次へ (Next) ---');
  const nextClicked = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button, material-button');
    for (const btn of buttons) {
      const text = btn.textContent?.trim();
      if (text === '次へ' && btn.offsetParent !== null) {
        btn.click();
        return true;
      }
    }
    return false;
  });
  console.log('Next clicked:', nextClicked);

  await page.waitForTimeout(6000);
  await ss(page, 'after-bidding-next');

  // Check what step we're on now
  let pageText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('\nPage text (first 2000):\n', pageText.substring(0, 2000));

  // === STEP: Campaign Settings (location, language, etc.) ===
  console.log('\n=== Campaign Settings Step ===');

  // Check if we need to set location/language
  if (pageText.includes('キャンペーン設定') || pageText.includes('ネットワーク') || pageText.includes('地域')) {
    console.log('On campaign settings page');

    // Check for Japan location (should be default)
    // Click 次へ to continue
    const nextClicked2 = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button, material-button');
      for (const btn of buttons) {
        if (btn.textContent?.trim() === '次へ' && btn.offsetParent !== null) {
          btn.click();
          return true;
        }
      }
      return false;
    });
    console.log('Next clicked:', nextClicked2);
    await page.waitForTimeout(6000);
    await ss(page, 'after-settings-next');

    pageText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
    console.log('\nPage text:\n', pageText.substring(0, 2000));
  }

  // === STEP: Keywords ===
  if (pageText.includes('キーワード') || pageText.includes('広告グループ')) {
    console.log('\n=== Keywords Step ===');

    // Find keyword input area
    const keywordInput = await page.$('textarea, [role="textbox"], input[aria-label*="キーワード"]');
    if (keywordInput) {
      // Enter PDF tool keywords
      const keywords = [
        'PDF 変換 無料',
        '画像 PDF 変換',
        'PDF 結合 無料',
        'PDF 編集 無料',
        'PDF 圧縮 オンライン',
        'PDF ツール 無料',
      ].join('\n');
      await keywordInput.fill(keywords);
      console.log('Keywords entered');
    } else {
      console.log('Keyword input not found directly, looking...');
      const inputs = await page.evaluate(() => {
        const els = document.querySelectorAll('textarea, input, [contenteditable="true"]');
        return Array.from(els).map(el => ({
          tag: el.tagName,
          ariaLabel: el.getAttribute('aria-label'),
          placeholder: el.placeholder,
          visible: el.offsetParent !== null,
          rect: el.getBoundingClientRect(),
        })).filter(i => i.visible);
      });
      console.log('Available inputs:', inputs);
    }

    await page.waitForTimeout(2000);
    await ss(page, 'keywords-entered');

    // Click 次へ
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button, material-button');
      for (const btn of buttons) {
        if (btn.textContent?.trim() === '次へ' && btn.offsetParent !== null) {
          btn.click();
          return true;
        }
      }
    });
    await page.waitForTimeout(6000);
    await ss(page, 'after-keywords-next');

    pageText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
    console.log('\nPage text:\n', pageText.substring(0, 2000));
  }

  // === STEP: Ads ===
  if (pageText.includes('広告') && (pageText.includes('広告見出し') || pageText.includes('説明文'))) {
    console.log('\n=== Ad Creation Step ===');

    // Fill in ad headlines
    const headlines = [
      'PDF変換ツール｜完全無料',
      '画像→PDF変換が簡単',
      'PDF結合・分割・圧縮',
      'オンラインPDFツール',
      '登録不要で今すぐ使える',
    ];

    const headlineInputs = await page.$$('input[aria-label*="広告見出し"], input[aria-label*="Headline"]');
    for (let i = 0; i < Math.min(headlines.length, headlineInputs.length); i++) {
      await headlineInputs[i].fill(headlines[i]);
      console.log(`Headline ${i+1}: ${headlines[i]}`);
    }

    // Fill descriptions
    const descriptions = [
      '画像からPDFへの変換、PDF結合、分割、圧縮がすべて無料。登録不要、ブラウザだけで完結するオンラインツール。',
      'PDFファイルの編集・変換・結合がワンクリック。安全・高速・無料のオンラインPDFツール。',
    ];

    const descInputs = await page.$$('textarea[aria-label*="説明文"], textarea[aria-label*="Description"]');
    for (let i = 0; i < Math.min(descriptions.length, descInputs.length); i++) {
      await descInputs[i].fill(descriptions[i]);
      console.log(`Description ${i+1}: ${descriptions[i].substring(0, 40)}...`);
    }

    await page.waitForTimeout(2000);
    await ss(page, 'ads-filled');

    // Click 次へ
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button, material-button');
      for (const btn of buttons) {
        if (btn.textContent?.trim() === '次へ' && btn.offsetParent !== null) {
          btn.click();
          return true;
        }
      }
    });
    await page.waitForTimeout(6000);
    await ss(page, 'after-ads-next');

    pageText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  }

  // === STEP: Budget ===
  if (pageText.includes('予算') || pageText.includes('budget')) {
    console.log('\n=== Budget Step ===');

    // Enter ¥400/day budget
    const budgetInput = await page.$('input[aria-label*="予算"], input[type="number"]');
    if (budgetInput) {
      await budgetInput.fill('400');
      console.log('Budget set to ¥400/day');
    }

    await page.waitForTimeout(2000);
    await ss(page, 'budget-set');

    // Click 次へ
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button, material-button');
      for (const btn of buttons) {
        if (btn.textContent?.trim() === '次へ' && btn.offsetParent !== null) {
          btn.click();
          return true;
        }
      }
    });
    await page.waitForTimeout(6000);
    await ss(page, 'after-budget-next');
  }

  // === Final State ===
  console.log('\n=== Final State ===');
  console.log('URL:', page.url());
  pageText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('Page text:\n', pageText.substring(0, 2000));
  await ss(page, 'final-state');
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
