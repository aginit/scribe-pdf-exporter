require('dotenv').config();
const { chromium } = require('playwright');

async function debugAllDocuments() {
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
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', process.env.SCRIBE_EMAIL);
    await page.click('button:has-text("Continue")');
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await page.fill('input[type="password"]', process.env.SCRIBE_PASSWORD);
    await page.click('button:has-text("Sign In"), button[type="submit"]');
    await page.waitForFunction(() => !window.location.href.includes('/signin'), { timeout: 15000 });
    
    console.log('✅ Login successful!');
    
    // Navigate to workspace
    await page.goto('https://scribehow.com/workspace');
    await page.waitForTimeout(3000);
    
    console.log('📂 Current URL:', page.url());
    
    // Try to click "All Documents" 
    console.log('👆 Looking for All Documents link...');
    
    // Take screenshot of workspace
    await page.screenshot({ path: 'workspace-debug.png' });
    console.log('📸 Workspace screenshot: workspace-debug.png');
    
    // Look for "All Documents" in different ways
    const allDocsSelectors = [
      'text=All Documents',
      'a:has-text("All Documents")',
      'button:has-text("All Documents")',
      '[data-testid*="documents"]',
      '[href*="documents"]'
    ];
    
    let allDocsFound = false;
    for (const selector of allDocsSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          console.log(`✅ Found All Documents with: ${selector}`);
          await page.click(selector);
          await page.waitForTimeout(3000);
          allDocsFound = true;
          break;
        }
      } catch (e) {
        console.log(`❌ Failed with selector: ${selector} - ${e.message}`);
      }
    }
    
    if (!allDocsFound) {
      console.log('⚠️  Could not find All Documents link, analyzing current page...');
    }
    
    console.log('📂 Current URL after All Documents:', page.url());
    
    // Take screenshot after clicking All Documents
    await page.screenshot({ path: 'all-documents-view.png' });
    console.log('📸 All Documents view: all-documents-view.png');
    
    // Look for any clickable text that might be folders
    console.log('🔍 Analyzing page for potential folders...');
    
    const clickableElements = await page.$$eval(
      'a, button, [role="button"], [class*="clickable"], [class*="folder"]',
      elements => {
        return elements.map((el, index) => {
          const text = el.textContent?.trim() || '';
          const className = el.className || '';
          const href = el.href || '';
          const role = el.getAttribute('role') || '';
          
          return {
            index,
            text: text.substring(0, 100), // Limit text length
            className: className.substring(0, 100),
            href: href.substring(0, 100),
            role,
            tagName: el.tagName,
            visible: el.offsetParent !== null
          };
        }).filter(el => 
          el.visible && 
          el.text && 
          el.text.length > 0 && 
          el.text.length < 50 &&
          !el.text.includes('http') &&
          !el.text.includes('@')
        ).slice(0, 30); // Show first 30 elements
      }
    );
    
    console.log(`\n🔘 Found ${clickableElements.length} clickable elements:`);
    clickableElements.forEach((el, i) => {
      console.log(`  ${i+1}. "${el.text}" (${el.tagName}, role: ${el.role})`);
    });
    
    // Look specifically for folder-like names
    const folderLikeElements = clickableElements.filter(el => {
      const text = el.text.toLowerCase();
      const folderKeywords = ['3cx', 'altaro', 'azure', 'microsoft', 'general', 'keeper', 'network', 'dell', 'client'];
      return folderKeywords.some(keyword => text.includes(keyword));
    });
    
    console.log(`\n📁 Potential folder elements:`);
    folderLikeElements.forEach((el, i) => {
      console.log(`  ${i+1}. "${el.text}" (${el.tagName})`);
    });
    
    // Try clicking on a potential folder
    if (folderLikeElements.length > 0) {
      const testFolder = folderLikeElements[0];
      console.log(`\n👆 Testing click on: "${testFolder.text}"`);
      
      try {
        await page.click(`text=${testFolder.text}`, { timeout: 5000 });
        await page.waitForTimeout(3000);
        
        await page.screenshot({ path: 'after-folder-click.png' });
        console.log('📸 After folder click: after-folder-click.png');
        
        // Look for documents in the main area
        const documents = await page.$$eval('a[href*="/viewer/"], a[href*="/shared/"]', elements => 
          elements.map(el => ({
            href: el.href,
            text: el.textContent?.trim()
          })).filter(doc => doc.href.includes('scribehow.com'))
        );
        
        console.log(`📄 Found ${documents.length} documents in folder:`);
        documents.slice(0, 5).forEach((doc, i) => {
          console.log(`  ${i+1}. ${doc.text?.substring(0, 60)}...`);
        });
        
      } catch (clickError) {
        console.log(`❌ Could not click folder: ${clickError.message}`);
      }
    }
    
  } catch (error) {
    console.error('💥 Debug error:', error);
    await page.screenshot({ path: 'debug-error-all-docs.png' });
  } finally {
    await browser.close();
  }
}

debugAllDocuments().catch(console.error);