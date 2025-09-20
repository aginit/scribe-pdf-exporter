const { chromium } = require('playwright');

async function debugSignin() {
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log('🌐 Loading https://scribehow.com/signin...');
    
    // Monitor network requests
    page.on('response', response => {
      console.log(`📡 ${response.status()} ${response.url()}`);
    });
    
    page.on('console', msg => {
      console.log(`🖥️  Console: ${msg.text()}`);
    });
    
    // Go to signin page
    const response = await page.goto('https://scribehow.com/signin', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    console.log('✅ Page loaded successfully');
    console.log('📊 Response status:', response.status());
    console.log('🌐 Final URL:', page.url());
    console.log('📄 Page title:', await page.title());
    
    // Check what we actually got
    const bodyText = await page.textContent('body');
    console.log('📝 Page contains text (first 500 chars):');
    console.log(bodyText.substring(0, 500));
    console.log('...\n');
    
    // Look for form elements
    const emailInputs = await page.$$('input[type="email"], input[name="email"], input[name="username"]');
    console.log(`📧 Found ${emailInputs.length} email input fields`);
    
    const passwordInputs = await page.$$('input[type="password"], input[name="password"]');
    console.log(`🔐 Found ${passwordInputs.length} password input fields`);
    
    const buttons = await page.$$('button, input[type="submit"]');
    console.log(`🔘 Found ${buttons.length} buttons/submit inputs`);
    
    // Get all form elements info
    const forms = await page.$$eval('form', forms => 
      forms.map(form => ({
        action: form.action,
        method: form.method,
        inputs: Array.from(form.querySelectorAll('input')).map(input => ({
          name: input.name,
          type: input.type,
          placeholder: input.placeholder
        }))
      }))
    );
    
    console.log('📋 Forms found:', JSON.stringify(forms, null, 2));
    
    // Take a screenshot
    await page.screenshot({ path: 'signin-debug.png' });
    console.log('📸 Screenshot saved: signin-debug.png');
    
    // Try to wait for network to be idle
    console.log('⏳ Waiting for network to be idle...');
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    console.log('✅ Network is idle');
    
    // Check again after network idle
    const finalBodyText = await page.textContent('body');
    console.log('📝 Final page text (first 500 chars):');
    console.log(finalBodyText.substring(0, 500));
    
  } catch (error) {
    console.error('💥 Error:', error);
    
    // Try to get some info even on error
    try {
      console.log('🌐 Current URL on error:', page.url());
      console.log('📄 Current title on error:', await page.title());
      await page.screenshot({ path: 'signin-error.png' });
      console.log('📸 Error screenshot saved: signin-error.png');
    } catch (e) {
      console.log('Could not get error info:', e.message);
    }
  } finally {
    await browser.close();
  }
}

debugSignin().catch(console.error);