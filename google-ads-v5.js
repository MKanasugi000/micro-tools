const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = 'C:/Users/duper/micro-tools/screenshots';
let sc = 74;

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

  // The issue is that clicking 続行 doesn't advance to the wizard.
  // Let me try doing it step by step and debug what happens.

  // Navigate to campaign creation via dropdown
  await page.goto('https://ads.google.com/aw/campaigns?ocid=7472909166&authuser=0&__u=8599148613&__c=2087511934', {
    waitUntil: 'load', timeout: 30000
  });
  await page.waitForTimeout(6000);

  // Click + then 新しいキャンペーン
  await page.click('[aria-label="キャンペーンを作成"]');
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    const items = document.querySelectorAll('*');
    for (const item of items) {
      if (item.textContent?.trim() === '新しいキャンペーン' && item.offsetParent !== null && item.tagName !== 'BODY') {
        item.click();
        return;
      }
    }
  });
  await page.waitForTimeout(8000);
  console.log('On campaign creation:', page.url().includes('campaigns/new'));

  // Select ウェブサイトのトラフィック
  // Try clicking with coordinates based on the screenshot layout
  // The cards are arranged: 販売促進, 見込み顧客, ウェブサイトのトラフィック in the first row
  // ウェブサイトのトラフィック is the third card in the first row
  console.log('Selecting goal...');

  // Use nth-child or similar to get the right card
  const goalResult = await page.evaluate(() => {
    // Find all goal cards - they should have check_circle icon
    const cards = document.querySelectorAll('[role="heading"]');
    const targetCards = Array.from(cards).filter(h =>
      h.textContent?.trim() === 'ウェブサイトのトラフィック' && h.offsetParent !== null
    );
    if (targetCards.length > 0) {
      // Click the first visible one
      targetCards[0].click();
      return `Found ${targetCards.length} headings, clicked first`;
    }
    return 'not found';
  });
  console.log('Goal result:', goalResult);
  await page.waitForTimeout(2000);

  // Scroll down to see campaign types
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(1000);

  // Check if campaign types are visible
  const typesVisible = await page.evaluate(() => {
    const text = document.body.innerText;
    return text.includes('キャンペーン タイプを選択してください');
  });
  console.log('Campaign types section visible:', typesVisible);

  if (!typesVisible) {
    console.log('Goal not selected. Trying harder...');
    // Try clicking directly on the card text
    try {
      // Get the 3rd card element (ウェブサイトのトラフィック is the 3rd goal)
      const clicked = await page.evaluate(() => {
        const allText = Array.from(document.querySelectorAll('*')).filter(el => {
          const t = el.textContent?.trim();
          return t === 'ウェブサイトのトラフィック' && el.offsetParent !== null && el.offsetHeight > 0;
        });
        // Try each one
        for (const el of allText) {
          // Check if this element itself or ancestors are clickable
          let target = el;
          while (target && target !== document.body) {
            if (target.onclick || target.getAttribute('tabindex') || target.getAttribute('role')?.includes('button') || target.tagName === 'BUTTON') {
              target.click();
              return `Clicked ${target.tagName} at depth`;
            }
            target = target.parentElement;
          }
          // Just click it
          el.click();
          return `Clicked ${el.tagName} directly`;
        }
        return 'nothing to click';
      });
      console.log('Hard click result:', clicked);
      await page.waitForTimeout(2000);
    } catch (e) {
      console.log('Error:', e.message.substring(0, 100));
    }
  }

  await ss(page, 'after-goal-attempt');

  // Try using keyboard Tab to navigate to the goal and press Enter
  console.log('Trying keyboard navigation...');

  // Click somewhere on the page first to focus it
  await page.click('body');
  await page.waitForTimeout(500);

  // Let me just check all page content and manually click at coordinates
  const goalCards = await page.evaluate(() => {
    const els = document.querySelectorAll('[role="heading"]');
    return Array.from(els).filter(el => el.offsetParent !== null).map(el => ({
      text: el.textContent?.trim(),
      rect: el.getBoundingClientRect(),
    }));
  });
  console.log('Goal cards:', goalCards);

  // Find the ウェブサイトのトラフィック card and click at its center
  const webTrafficCard = goalCards.find(c => c.text === 'ウェブサイトのトラフィック');
  if (webTrafficCard) {
    const { x, y, width, height } = webTrafficCard.rect;
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    console.log(`Clicking at (${centerX}, ${centerY})`);
    await page.mouse.click(centerX, centerY);
    await page.waitForTimeout(2000);
  }

  // Scroll down and check again
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(1000);

  const typesNow = await page.evaluate(() => {
    return document.body.innerText.includes('キャンペーン タイプを選択してください');
  });
  console.log('Types visible after click:', typesNow);

  await ss(page, 'after-mouse-click');

  if (typesNow) {
    console.log('Goal selected! Now selecting Search type...');

    // Click 検索 type card
    const searchCard = await page.evaluate(() => {
      const headings = document.querySelectorAll('[role="heading"]');
      for (const h of headings) {
        if (h.textContent?.trim() === '検索' && h.offsetParent !== null) {
          return h.getBoundingClientRect();
        }
      }
      return null;
    });

    if (searchCard) {
      const { x, y, width, height } = searchCard;
      await page.mouse.click(x + width / 2, y + height / 2);
      console.log('Clicked Search type card');
    }

    await page.waitForTimeout(2000);

    // Scroll to bottom to see campaign name and URL
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    await ss(page, 'form-visible');

    // Set campaign name
    const nameInput = await page.$('input[aria-label="キャンペーン名"]');
    if (nameInput) {
      await nameInput.click({ clickCount: 3 });
      await nameInput.fill('Tax-Simulator-Search');
      console.log('Name set');
    }

    // Set URL
    const inputs = await page.$$('input[type="text"]');
    for (const input of inputs) {
      const label = await input.getAttribute('aria-label');
      const val = await input.inputValue();
      if (!label && !val) {
        await input.click();
        await input.fill('https://tax-tools-mauve.vercel.app/');
        await page.keyboard.press('Tab');
        console.log('URL set');
        break;
      }
    }

    await page.waitForTimeout(2000);
    await ss(page, 'tax-form-ready');

    // Click 続行 using mouse click at the button position
    const continueBtn = await page.evaluate(() => {
      const btns = document.querySelectorAll('button, material-button');
      for (const btn of btns) {
        if (btn.textContent?.trim() === '続行' && btn.offsetParent !== null) {
          return btn.getBoundingClientRect();
        }
      }
      return null;
    });

    if (continueBtn) {
      const { x, y, width, height } = continueBtn;
      console.log(`Clicking 続行 at (${x + width/2}, ${y + height/2})`);
      await page.mouse.click(x + width/2, y + height/2);
    }

    await page.waitForTimeout(10000);
    console.log('URL after 続行:', page.url());
    await ss(page, 'after-continue');

    const inDraft = page.url().includes('draft');
    console.log('In draft wizard:', inDraft);

    if (inDraft) {
      console.log('SUCCESS! Now completing wizard...');
      // Same wizard steps as before
      // Bidding
      await page.evaluate(() => {
        const els = document.querySelectorAll('*');
        for (const el of els) {
          if (el.textContent?.includes('コンバージョン') && el.textContent?.includes('arrow_drop_down') && el.offsetParent !== null && el.textContent?.trim().length < 100) {
            el.click(); break;
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

      // Next through all steps
      for (let step = 0; step < 5; step++) {
        await page.evaluate(() => {
          const btns = document.querySelectorAll('button, material-button');
          for (const btn of btns) {
            if (btn.textContent?.trim() === '次へ' && btn.offsetParent !== null) { btn.click(); break; }
          }
        });
        await page.waitForTimeout(5000);
        console.log(`Step ${step + 1} done. URL:`, page.url());
      }

      await ss(page, 'tax-done');
      console.log('Tax campaign wizard completed');
    } else {
      // Check what happened
      const errText = await page.evaluate(() => document.body.innerText.substring(0, 500));
      console.log('Page text:', errText.substring(0, 400));
    }
  }
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
