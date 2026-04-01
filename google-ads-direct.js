const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = 'C:/Users/duper/micro-tools/screenshots';
let sc = 79;

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

  // KEY INSIGHT: The first campaign worked because on the overview page,
  // we clicked FAB -> キャンペーン, which opened the goal page at the RIGHT URL.
  // Then clicking the goal/type worked because the page was at the top.
  //
  // The issue with subsequent attempts:
  // 1. From campaigns list, the + button opens a dropdown
  // 2. The goal selection page has cards with negative Y (scrolled)
  //
  // Solution: Go to overview, click FAB, then handle each step WITHOUT scrolling

  // Campaign 2: Tax Simulator
  for (const campaign of [
    {
      name: 'Tax-Simulator-Search',
      url: 'https://tax-tools-mauve.vercel.app/',
      budget: 300,
      headlines: ['確定申告シミュレーター｜無料', '手取り計算が30秒で完了', 'インボイス計算ツール'],
      descriptions: [
        '確定申告の税金をシミュレーション。所得税・住民税・手取り額が瞬時にわかる。',
        'フリーランス・副業の確定申告に。手取り計算が全部無料。',
      ],
    },
    {
      name: 'Personality-Quiz-Search',
      url: 'https://shindan-site-one.vercel.app/tools/personality-16types/',
      budget: 300,
      headlines: ['性格診断｜16タイプ無料テスト', 'あなたの性格タイプは？', 'MBTI風・無料性格診断'],
      descriptions: [
        '16タイプ性格診断を完全無料。性格タイプ、強み、相性が3分でわかる。',
        '科学的な性格診断テスト。AI鑑定レポートも人気。',
      ],
    },
  ]) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Campaign: ${campaign.name}`);
    console.log(`${'='.repeat(50)}`);

    // 1. Go to OVERVIEW (not campaigns list)
    await page.goto('https://ads.google.com/aw/overview?ocid=7472909166&authuser=0&__u=8599148613&__c=2087511934', {
      waitUntil: 'load', timeout: 30000
    });
    await page.waitForTimeout(6000);

    // 2. Click FAB -> キャンペーン
    console.log('Step 1: FAB -> キャンペーン');
    await page.click('material-fab[aria-label="作成"]');
    await page.waitForTimeout(2000);
    const menuClicked = await page.$('[aria-label="キャンペーン"][role="menuitem"]');
    if (menuClicked) {
      await menuClicked.click();
    } else {
      console.log('Menu item not found!');
      continue;
    }
    await page.waitForTimeout(6000);

    if (!page.url().includes('campaigns/new')) {
      console.log('NOT on campaign creation page:', page.url());
      continue;
    }

    // 3. Select goal - DON'T scroll, the page should show goals at the top
    console.log('Step 2: Selecting ウェブサイトのトラフィック');

    // First, scroll to TOP to make sure all cards are visible
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    // Now use mouse click on the ウェブサイトのトラフィック card
    // Based on the first successful run, the cards are in a 3-column grid
    // Row 1: 販売促進 (col1), 見込み顧客 (col2), ウェブサイトのトラフィック (col3)
    const webTrafficRect = await page.evaluate(() => {
      const headings = document.querySelectorAll('[role="heading"]');
      for (const h of headings) {
        if (h.textContent?.trim() === 'ウェブサイトのトラフィック') {
          const rect = h.getBoundingClientRect();
          if (rect.top > 0 && rect.top < 1000) { // visible on screen
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          }
        }
      }
      return null;
    });
    console.log('Web traffic card rect:', webTrafficRect);

    if (webTrafficRect) {
      await page.mouse.click(webTrafficRect.x + webTrafficRect.width / 2, webTrafficRect.y + webTrafficRect.height / 2);
      console.log('Clicked by coordinates');
    } else {
      // Fallback: try evaluate click
      await page.evaluate(() => {
        const headings = document.querySelectorAll('[role="heading"]');
        for (const h of headings) {
          if (h.textContent?.trim() === 'ウェブサイトのトラフィック') {
            // Scroll into view first
            h.scrollIntoView({ behavior: 'instant', block: 'center' });
            setTimeout(() => h.click(), 200);
            return;
          }
        }
      });
      await page.waitForTimeout(500);
    }

    await page.waitForTimeout(2000);

    // Verify goal was selected
    const goalSelected = await page.evaluate(() => {
      return document.body.innerText.includes('キャンペーン タイプを選択してください');
    });
    console.log('Goal selected:', goalSelected);

    if (!goalSelected) {
      console.log('Retrying goal selection...');
      // Scroll to the goal cards and try again
      await page.evaluate(() => {
        const headings = document.querySelectorAll('[role="heading"]');
        for (const h of headings) {
          if (h.textContent?.trim() === 'ウェブサイトのトラフィック') {
            h.scrollIntoView({ behavior: 'instant', block: 'center' });
            break;
          }
        }
      });
      await page.waitForTimeout(500);

      // Now the card should be visible
      const newRect = await page.evaluate(() => {
        const headings = document.querySelectorAll('[role="heading"]');
        for (const h of headings) {
          if (h.textContent?.trim() === 'ウェブサイトのトラフィック') {
            const rect = h.getBoundingClientRect();
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          }
        }
        return null;
      });
      console.log('New rect:', newRect);

      if (newRect && newRect.y > 0 && newRect.y < 1000) {
        await page.mouse.click(newRect.x + newRect.width / 2, newRect.y + newRect.height / 2);
        await page.waitForTimeout(2000);
      }

      const goalNow = await page.evaluate(() => {
        return document.body.innerText.includes('キャンペーン タイプを選択してください');
      });
      console.log('Goal selected after retry:', goalNow);
      if (!goalNow) {
        console.log('FAILED to select goal');
        await ss(page, `${campaign.name}-goal-fail`);
        continue;
      }
    }

    // 4. Scroll down to campaign types and select 検索
    console.log('Step 3: Selecting 検索 type');
    await page.evaluate(() => {
      const headings = document.querySelectorAll('[role="heading"]');
      for (const h of headings) {
        if (h.textContent?.trim() === '検索') {
          h.scrollIntoView({ behavior: 'instant', block: 'center' });
          break;
        }
      }
    });
    await page.waitForTimeout(500);

    const searchRect = await page.evaluate(() => {
      const headings = document.querySelectorAll('[role="heading"]');
      for (const h of headings) {
        if (h.textContent?.trim() === '検索') {
          const rect = h.getBoundingClientRect();
          if (rect.top > 0 && rect.top < 1000) {
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          }
        }
      }
      return null;
    });

    if (searchRect) {
      await page.mouse.click(searchRect.x + searchRect.width / 2, searchRect.y + searchRect.height / 2);
      console.log('Clicked Search type');
    }
    await page.waitForTimeout(2000);

    // 5. Scroll to URL and name fields
    console.log('Step 4: Filling URL and name');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);

    // Fill campaign name
    const nameInput = await page.$('input[aria-label="キャンペーン名"]');
    if (nameInput) {
      await nameInput.click({ clickCount: 3 });
      await nameInput.fill(campaign.name);
      console.log('Name:', campaign.name);
    } else {
      console.log('Name input NOT FOUND');
    }

    // Fill URL - find the unlabeled input
    const urlInput = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[type="text"]');
      for (const input of inputs) {
        const label = input.getAttribute('aria-label') || '';
        if (!label || (!label.includes('キャンペーン') && !label.includes('検索') && !label.includes('ページ'))) {
          // Check it's near the URL label
          const closestLabel = input.closest('label')?.textContent || '';
          const prevEl = input.parentElement?.previousElementSibling?.textContent || '';
          if (closestLabel.includes('ウェブサイト') || prevEl.includes('link') || !label) {
            return { found: true, label, value: input.value };
          }
        }
      }
      return { found: false };
    });
    console.log('URL input:', urlInput);

    if (urlInput.found) {
      // Use playwright fill
      const inputs = await page.$$('input[type="text"]');
      for (const input of inputs) {
        const label = await input.getAttribute('aria-label');
        const val = await input.inputValue();
        if ((!label || !label.includes('キャンペーン') && !label.includes('検索') && !label.includes('ページ')) && val !== campaign.name) {
          await input.click();
          await input.fill(campaign.url);
          await page.keyboard.press('Tab');
          console.log('URL filled:', campaign.url);
          break;
        }
      }
    }

    await page.waitForTimeout(2000);
    await ss(page, `${campaign.name}-ready`);

    // 6. Click 続行
    console.log('Step 5: Clicking 続行');

    // Scroll to make sure 続行 is visible
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    const contBtn = await page.evaluate(() => {
      const btns = document.querySelectorAll('button, material-button');
      for (const btn of btns) {
        if (btn.textContent?.trim() === '続行' && btn.offsetParent !== null) {
          const rect = btn.getBoundingClientRect();
          return { x: rect.x + rect.width/2, y: rect.y + rect.height/2, text: btn.textContent?.trim() };
        }
      }
      return null;
    });
    console.log('Continue button:', contBtn);

    if (contBtn) {
      await page.mouse.click(contBtn.x, contBtn.y);
    }
    await page.waitForTimeout(10000);

    const newUrl = page.url();
    console.log('URL after continue:', newUrl);

    if (newUrl.includes('draft')) {
      console.log('SUCCESS - In wizard!');

      // === Complete wizard ===
      // Bidding
      console.log('Setting bidding to clicks...');
      await page.evaluate(() => {
        document.querySelectorAll('*').forEach(el => {
          if (el.textContent?.includes('コンバージョン') && el.textContent?.includes('arrow_drop_down') && el.offsetParent && el.textContent.trim().length < 100) el.click();
        });
      });
      await page.waitForTimeout(1500);
      await page.evaluate(() => {
        document.querySelectorAll('[role="option"], li').forEach(opt => {
          if (opt.textContent?.includes('クリック数') && opt.offsetParent) opt.click();
        });
      });
      await page.waitForTimeout(1000);

      // Click Next through remaining steps (5 steps)
      for (let step = 1; step <= 5; step++) {
        console.log(`Clicking 次へ (step ${step})...`);
        await page.evaluate(() => {
          const btns = document.querySelectorAll('button, material-button');
          for (const btn of btns) {
            if (btn.textContent?.trim() === '次へ' && btn.offsetParent) { btn.click(); break; }
          }
        });
        await page.waitForTimeout(5000);
        console.log(`  URL:`, page.url());
        if (page.url().includes('review')) {
          console.log('  On review page!');
          break;
        }
      }

      await ss(page, `${campaign.name}-review`);

      // Check review content
      const reviewText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
      if (reviewText.includes('キャンペーン名')) {
        console.log('Review page content shows campaign details');
      }

      // Try to publish
      const pubClicked = await page.evaluate(() => {
        const btns = document.querySelectorAll('button, material-button');
        for (const btn of btns) {
          const text = btn.textContent?.trim();
          if (text?.includes('公開') && btn.offsetParent) { btn.click(); return text; }
        }
        return null;
      });
      console.log('Publish:', pubClicked || 'saved as draft');

      await page.waitForTimeout(5000);

      // Handle verification
      const pages = context.pages();
      if (pages.length > 1) {
        const lastPage = pages[pages.length - 1];
        if (lastPage.url().includes('accounts.google.com')) {
          console.log('Closing verification tab');
          await lastPage.close();
        }
      }
    } else {
      console.log('FAILED to enter wizard');
      await ss(page, `${campaign.name}-fail`);
    }
  }

  // Final status
  console.log('\n=== FINAL STATUS ===');
  await page.goto('https://ads.google.com/aw/campaigns?ocid=7472909166&authuser=0&__u=8599148613&__c=2087511934', {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await page.waitForTimeout(5000);
  await ss(page, 'final');

  const campaigns = await page.evaluate(() => {
    const rows = document.querySelectorAll('tr, [role="row"]');
    return Array.from(rows).map(r => r.textContent?.trim().substring(0, 200)).filter(t => t && t.length > 10).slice(0, 10);
  });
  console.log('Campaign rows:', campaigns);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
