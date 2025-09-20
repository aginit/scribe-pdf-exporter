require('dotenv').config();
const { chromium } = require('playwright');

async function debugDocumentsPage() {
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
    
    // Login
    await page.goto('https://scribehow.com/signin');
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[type="email"], input[name="email"], input[name="username"], #email, #username', process.env.SCRIBE_EMAIL);
    await page.click('button[type="submit"], button:has-text("Continue"), button:has-text("Next"), button:has-text("Log in")');
    await page.waitForSelector('input[type="password"], input[name="password"], #password', { timeout: 10000 });
    await page.fill('input[type="password"], input[name="password"], #password', process.env.SCRIBE_PASSWORD);
    await page.click('button[type="submit"], button:has-text("Log in"), button:has-text("Sign in")');
    
    await page.waitForFunction(
      () => window.location.href.includes('/workspace') || window.location.href.includes('/documents'),
      { timeout: 15000 }
    );
    
    console.log('✅ Login successful!');
    console.log('Current URL after login:', page.url());
    
    // Try different document page URLs
    const documentUrls = [
      'https://scribehow.com/workspace/documents',
      'https://scribehow.com/workspace',
      'https://scribehow.com/dashboard',
      'https://app.scribehow.com/workspace/documents',
      'https://app.scribehow.com/workspace',
      'https://app.scribehow.com/dashboard'
    ];
    
    for (const url of documentUrls) {
      try {
        console.log(`\n🔍 Trying documents URL: ${url}`);
        await page.goto(url);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(5000); // Extra wait for dynamic content
        
        const currentUrl = page.url();
        const pageTitle = await page.title();
        console.log(`Current URL: ${currentUrl}`);
        console.log(`Page title: ${pageTitle}`);
        
        // Take a screenshot for debugging
        const urlSafe = url.replace(/[^a-zA-Z0-9]/g, '_');
        await page.screenshot({ path: `debug-${urlSafe}.png` });
        console.log(`📸 Screenshot saved: debug-${urlSafe}.png`);
        
        // Check for various document link patterns
        const strategies = [
          { name: 'Shared/Viewer Links', selector: 'a[href*="/shared/"], a[href*="/viewer/"]' },
          { name: 'Document Cards', selector: '[data-testid*="document"], .document-item, .document-card' },
          { name: 'Document Links', selector: 'a[href*="document"]' },
          { name: 'Scribe Links', selector: 'a[href*="scribe"]' },
          { name: 'All Links', selector: 'a[href]' }
        ];
        
        for (const strategy of strategies) {
          try {
            const elements = await page.$$(strategy.selector);
            console.log(`${strategy.name}: Found ${elements.length} elements`);
            
            if (elements.length > 0 && elements.length < 20) {
              // Show some sample links if reasonable number
              for (let i = 0; i < Math.min(5, elements.length); i++) {
                const href = await elements[i].getAttribute('href');
                const text = await elements[i].textContent();
                console.log(`  - ${href} (${text?.trim().substring(0, 50)}...)`);
              }
            }
          } catch (e) {
            console.log(`${strategy.name}: Error - ${e.message}`);
          }
        }
        
        // Check page content
        const bodyText = await page.textContent('body');
        if (bodyText.includes('document') || bodyText.includes('scribe')) {
          console.log('✅ Page contains document-related content');
        } else {
          console.log('❌ Page does not contain obvious document content');
        }
        
      } catch (error) {
        console.log(`❌ Failed to load ${url}: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('💥 Debug error:', error);
  } finally {
    await browser.close();
  }
}

debugDocumentsPage().catch(console.error);