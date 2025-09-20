require('dotenv').config();
const { chromium } = require('playwright');

async function simpleDebug() {
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log('🌐 Testing Scribe website access...');
    
    // Try to reach the main website
    await page.goto('https://scribehow.com');
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    
    console.log('✅ Main website accessible');
    console.log('Current URL:', page.url());
    console.log('Page title:', await page.title());
    
    // Take screenshot
    await page.screenshot({ path: 'debug-main-page.png' });
    console.log('📸 Screenshot saved: debug-main-page.png');
    
    // Try signin page
    await page.goto('https://scribehow.com/signin');
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    
    console.log('✅ Signin page accessible');
    console.log('Current URL:', page.url());
    console.log('Page title:', await page.title());
    
    // Check for login form
    const emailField = await page.$('input[type="email"], input[name="email"], input[name="username"], #email, #username');
    if (emailField) {
      console.log('✅ Email field found on signin page');
    } else {
      console.log('❌ No email field found');
    }
    
    await page.screenshot({ path: 'debug-signin-page.png' });
    console.log('📸 Screenshot saved: debug-signin-page.png');
    
  } catch (error) {
    console.error('💥 Debug error:', error);
    await page.screenshot({ path: 'debug-error.png' });
    console.log('📸 Error screenshot saved: debug-error.png');
  } finally {
    await browser.close();
  }
}

simpleDebug().catch(console.error);