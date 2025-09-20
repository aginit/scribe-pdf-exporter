require('dotenv').config();
const { chromium } = require('playwright');

async function debugExport() {
  if (!process.env.SCRIBE_EMAIL || !process.env.SCRIBE_PASSWORD) {
    console.error('❌ Missing credentials in .env file');
    return;
  }

  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log('🔐 Logging in...');
    
    // Login (simplified)
    await page.goto('https://scribehow.com/signin');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', process.env.SCRIBE_EMAIL);
    await page.click('button:has-text("Continue")');
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await page.fill('input[type="password"]', process.env.SCRIBE_PASSWORD);
    await page.click('button:has-text("Sign In"), button[type="submit"]');
    await page.waitForFunction(() => !window.location.href.includes('/signin'), { timeout: 15000 });
    
    console.log('✅ Login successful!');
    
    // Go to workspace and get first document
    await page.goto('https://scribehow.com/workspace');
    await page.waitForTimeout(3000);
    
    const firstDocLink = await page.$eval('a[href*="scribe"]', el => el.href);
    console.log('📄 Testing with first document:', firstDocLink);
    
    // Navigate to document
    await page.goto(firstDocLink);
    await page.waitForTimeout(3000);
    
    await page.screenshot({ path: 'document-page.png' });
    console.log('📸 Document page screenshot: document-page.png');
    
    // Look for all buttons and clickable elements
    const buttons = await page.$$eval('button, [role="button"], .btn', elements => 
      elements.map(el => ({
        text: el.textContent?.trim(),
        className: el.className,
        id: el.id
      })).filter(btn => btn.text && btn.text.length > 0)
    );
    
    console.log('🔘 All buttons found:');
    buttons.forEach((btn, i) => {
      console.log(`  ${i+1}. "${btn.text}" (class: ${btn.className})`);
    });
    
    // Look specifically for Share-related buttons
    const shareButtons = buttons.filter(btn => 
      btn.text.toLowerCase().includes('share') ||
      btn.text.toLowerCase().includes('export') ||
      btn.text.toLowerCase().includes('download')
    );
    
    console.log('\n📤 Share/Export related buttons:');
    shareButtons.forEach((btn, i) => {
      console.log(`  ${i+1}. "${btn.text}" (class: ${btn.className})`);
    });
    
    // Try to click on any Share button
    const shareSelectors = [
      'button:has-text("Share")',
      'button:has-text("share")',
      '[role="button"]:has-text("Share")',
      'button[aria-label*="Share"]',
      'button[title*="Share"]'
    ];
    
    let shareFound = false;
    for (const selector of shareSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          console.log(`\n✅ Found share button with selector: ${selector}`);
          await page.click(selector);
          await page.waitForTimeout(2000);
          
          await page.screenshot({ path: 'after-share-click.png' });
          console.log('📸 After share click: after-share-click.png');
          
          // Look for what appeared
          const modalButtons = await page.$$eval('button, [role="button"]', elements => 
            elements.map(el => ({
              text: el.textContent?.trim(),
              visible: el.offsetParent !== null
            })).filter(btn => btn.visible && btn.text && btn.text.length > 0)
          );
          
          console.log('\n🔘 Buttons in modal/popup:');
          modalButtons.forEach((btn, i) => {
            console.log(`  ${i+1}. "${btn.text}"`);
          });
          
          shareFound = true;
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!shareFound) {
      console.log('❌ No Share button found');
      
      // Check if this is a different type of document
      const pageText = await page.textContent('body');
      if (pageText.includes('This scribe is not available') || pageText.includes('404')) {
        console.log('❌ Document not accessible or 404');
      } else {
        console.log('📝 Page seems to be accessible');
        console.log('Sample page text:', pageText.substring(0, 200));
      }
    }
    
  } catch (error) {
    console.error('💥 Debug error:', error);
    await page.screenshot({ path: 'debug-export-error.png' });
  } finally {
    await browser.close();
  }
}

debugExport().catch(console.error);