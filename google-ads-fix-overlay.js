const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = 'C:/Users/duper/micro-tools/screenshots';
let sc = 103;

async function ss(page, name) {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const fp = path.join(SCREENSHOT_DIR, `${String(sc++).padStart(2,'0')}-${name}.png`);
  await page.screenshot({ path: fp, fullPage: false });
  console.log(`SS: ${fp}`);
}

async function removeOverlays(page) {
  await page.evaluate(() => {
    // Remove overlay containers
    document.querySelectorAll('.acx-overlay-container, [class*="overlay"], [class*="modal"]').forEach(el => {
      el.remove();
    });
    // Also remove any elements with high z-index that might block clicks
    document.querySelectorAll('[role="dialog"], [role="alertdialog"]').forEach(el => {
      el.remove();
    });
  });
  console.log('Overlays removed');
}

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const page = context.pages()[0];

  // Go to overview
  await page.goto('https://ads.google.com/aw/overview?ocid=7472909166&authuser=0&__u=8599148613&__c=2087511934', {
    waitUntil: 'load', timeout: 30000
  });
  await page.waitForTimeout(8000);

  // First, click 保持する to keep the account
  console.log('Clicking 保持する...');
  const keepClicked = await page.evaluate(() => {
    const btns = document.querySelectorAll('button, material-button, [role="button"]');
    for (const btn of btns) {
      if (btn.textContent?.trim() === '保持する') {
        btn.click();
        return true;
      }
    }
    return false;
  });
  console.log('Keep clicked:', keepClicked);
  await page.waitForTimeout(3000);

  // Also close any other dialogs
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button, material-button, [role="button"]');
    for (const btn of btns) {
      const text = btn.textContent?.trim();
      if (text === '閉じる' || text === 'close') btn.click();
    }
  });
  await page.waitForTimeout(2000);

  // Remove any remaining overlays
  await removeOverlays(page);
  await page.waitForTimeout(1000);

  await ss(page, 'after-dismiss');

  // Now try the campaign creation
  console.log('\n=== Creating Tax Campaign ===');
  await page.click('material-fab[aria-label="作成"]');
  await page.waitForTimeout(2000);
  await page.click('[aria-label="キャンペーン"][role="menuitem"]');
  await page.waitForTimeout(6000);

  // Remove overlays that might have appeared
  await removeOverlays(page);
  await page.waitForTimeout(500);

  // Select goal
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);

  const goalRect = await page.evaluate(() => {
    const h = Array.from(document.querySelectorAll('[role="heading"]'))
      .find(el => el.textContent?.trim() === 'ウェブサイトのトラフィック' && el.getBoundingClientRect().top > 0);
    if (h) { const r = h.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 }; }
    return null;
  });
  console.log('Goal rect:', goalRect);
  if (goalRect) await page.mouse.click(goalRect.x, goalRect.y);
  await page.waitForTimeout(2000);

  // Verify by checking if conversion goals section appeared
  const goalWorked = await page.evaluate(() => {
    return document.body.innerText.includes('コンバージョン目標を使用して');
  });
  console.log('Goal selection worked:', goalWorked);

  if (!goalWorked) {
    // The overlay might still be blocking - force remove it
    await removeOverlays(page);
    await page.waitForTimeout(500);

    // Try again
    if (goalRect) await page.mouse.click(goalRect.x, goalRect.y);
    await page.waitForTimeout(2000);
    const goalWorked2 = await page.evaluate(() => {
      return document.body.innerText.includes('コンバージョン目標を使用して');
    });
    console.log('Goal worked after overlay removal:', goalWorked2);
  }

  // First 続行
  console.log('First 続行...');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    document.querySelectorAll('button, material-button').forEach(b => {
      if (b.textContent?.trim() === '続行' && b.offsetParent) b.click();
    });
  });
  await page.waitForTimeout(5000);
  await removeOverlays(page);

  // Check for campaign types
  const typeSection = await page.evaluate(() => {
    return document.body.innerText.includes('キャンペーン タイプを選択してください');
  });
  console.log('Campaign types visible:', typeSection);

  if (typeSection) {
    // Scroll to see search
    await page.evaluate(() => {
      const heading = Array.from(document.querySelectorAll('[role="heading"]'))
        .find(el => el.textContent?.includes('キャンペーン タイプ'));
      if (heading) heading.scrollIntoView({ block: 'start' });
    });
    await page.waitForTimeout(1000);

    // Click search
    await page.evaluate(() => {
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        const text = el.textContent?.trim();
        if (text?.startsWith('検索') && text?.includes('テキスト広告') && el.offsetParent && el.getBoundingClientRect().top > 0 && el.getBoundingClientRect().height < 300 && el.getBoundingClientRect().height > 20) {
          el.click();
          break;
        }
      }
    });
    await page.waitForTimeout(2000);
    console.log('Search clicked');

    // Scroll down for form fields
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);

    // Check for inputs NOW
    const inputs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input, textarea'))
        .filter(el => el.offsetParent)
        .map(el => ({
          ariaLabel: el.getAttribute('aria-label'),
          value: el.value,
          y: el.getBoundingClientRect().y,
        }));
    });
    console.log('Inputs after search click:', JSON.stringify(inputs));

    // Fill URL
    for (const input of await page.$$('input[type="text"]')) {
      const label = await input.getAttribute('aria-label');
      if (!label || label === '') {
        if (await input.isVisible()) {
          await input.click();
          await input.fill('https://tax-tools-mauve.vercel.app/');
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
      await nameInput.fill('Tax-Simulator-Search');
      console.log('Name set');
    }

    await ss(page, 'form-ready');

    // Second 続行
    await page.evaluate(() => {
      document.querySelectorAll('button, material-button').forEach(b => {
        if (b.textContent?.trim() === '続行' && b.offsetParent) b.click();
      });
    });
    await page.waitForTimeout(15000);
    console.log('After second 続行:', page.url());

    if (page.url().includes('draft')) {
      console.log('SUCCESS!');

      // Quick wizard completion
      await removeOverlays(page);

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

      for (let i = 0; i < 5; i++) {
        await removeOverlays(page);
        await page.evaluate(() => {
          document.querySelectorAll('button, material-button').forEach(b => {
            if (b.textContent?.trim() === '次へ' && b.offsetParent) b.click();
          });
        });
        await page.waitForTimeout(5000);

        const hasAds = await page.evaluate(() => document.body.innerText.includes('広告見出し'));
        if (hasAds) {
          for (const inp of await page.$$('input')) {
            const lbl = await inp.getAttribute('aria-label');
            if (lbl?.includes('広告見出し')) {
              await inp.fill('確定申告シミュレーター｜無料');
              break;
            }
          }
        }
      }

      await ss(page, 'tax-review');
      await page.evaluate(() => {
        document.querySelectorAll('button, material-button').forEach(b => {
          if (b.textContent?.trim()?.includes('公開') && b.offsetParent) b.click();
        });
      });
      console.log('Tax campaign published');
    }
  }

  await ss(page, 'final');
  console.log('Done');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
