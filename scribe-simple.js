const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function downloadAllScribes() {
  const downloadsDir = path.join(__dirname, 'downloads');
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir);
  }

  console.log('🚀 Starting Scribe bulk export (Simple Cookie Method)...');
  console.log('📁 Downloads will be saved to:', downloadsDir);
  console.log('');
  console.log('🔧 MANUAL SETUP REQUIRED:');
  console.log('1. Open your browser and go to: https://scribehow.com/signin');
  console.log('2. Login to your Scribe account');
  console.log('3. Press F12 > Application > Cookies > scribehow.com');
  console.log('4. Find a cookie (session, auth_token, etc.)');
  console.log('5. Copy its VALUE');
  console.log('6. Edit this script and paste the value in COOKIE_VALUE below');
  console.log('');
  
  // ⚠️ PASTE YOUR COOKIE VALUE HERE ⚠️
  const COOKIE_VALUE = 'PASTE_YOUR_COOKIE_VALUE_HERE';
  
  if (COOKIE_VALUE === 'PASTE_YOUR_COOKIE_VALUE_HERE') {
    console.log('❌ Please edit this script and add your cookie value first!');
    console.log('   Find the line: const COOKIE_VALUE = ...');
    console.log('   Replace with your actual cookie value');
    return;
  }
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  const context = await browser.newContext({
    acceptDownloads: true,
    downloadPath: downloadsDir
  });
  
  const page = await context.newPage();
  
  try {
    // Set authentication cookies
    const cookieNames = ['session', 'auth_token', '_scribe_session', 'access_token', 'authToken'];
    
    for (const cookieName of cookieNames) {
      await page.context().addCookies([{
        name: cookieName,
        value: COOKIE_VALUE,
        domain: 'scribehow.com',
        path: '/'
      }]);
    }
    
    console.log('🍪 Authentication cookies set!');
    
    // Test authentication
    console.log('🔍 Testing authentication...');
    await page.goto('https://scribehow.com/workspace/documents');
    await page.waitForTimeout(5000);
    
    const currentUrl = page.url();
    console.log('Current URL after auth:', currentUrl);
    
    if (currentUrl.includes('/signin') || currentUrl.includes('/login')) {
      console.log('❌ Authentication failed. Cookie may be invalid/expired.');
      console.log('Please get a fresh cookie from your browser.');
      return;
    }
    
    console.log('✅ Authentication successful!');
    
    // Take screenshot to see what we have
    await page.screenshot({ path: 'workspace-debug.png' });
    console.log('📸 Workspace screenshot saved: workspace-debug.png');
    
    // Find documents with multiple strategies
    console.log('🔍 Finding all documents...');
    
    // Strategy 1: Look for any links
    const allLinks = await page.$$eval('a[href]', elements => 
      elements.map(el => ({
        href: el.href,
        text: el.textContent?.trim() || 'No text'
      })).filter(link => 
        link.href.includes('scribehow.com') && 
        (link.href.includes('/shared/') || link.href.includes('/viewer/') || link.text.length > 5)
      )
    );
    
    console.log(`📋 Found ${allLinks.length} potential document links`);
    
    // Show first few links for debugging
    allLinks.slice(0, 5).forEach((link, i) => {
      console.log(`  ${i+1}. ${link.href} (${link.text.substring(0, 50)}...)`);
    });
    
    if (allLinks.length === 0) {
      console.log('❌ No document links found. Trying alternative URLs...');
      
      const altUrls = [
        'https://scribehow.com/workspace',
        'https://scribehow.com/dashboard',
        'https://scribehow.com/documents'
      ];
      
      for (const altUrl of altUrls) {
        console.log(`🔍 Trying: ${altUrl}`);
        await page.goto(altUrl);
        await page.waitForTimeout(3000);
        await page.screenshot({ path: `debug-${altUrl.split('/').pop()}.png` });
        
        const altLinks = await page.$$eval('a[href]', elements => 
          elements.map(el => ({
            href: el.href,
            text: el.textContent?.trim()
          })).filter(link => 
            link.href.includes('scribehow.com') && 
            (link.href.includes('/shared/') || link.href.includes('/viewer/'))
          )
        );
        
        if (altLinks.length > 0) {
          console.log(`✅ Found ${altLinks.length} documents at ${altUrl}`);
          allLinks.push(...altLinks);
          break;
        }
      }
    }
    
    if (allLinks.length === 0) {
      console.log('❌ Still no documents found. Please check the debug screenshots.');
      return;
    }
    
    // Export documents (simplified version)
    console.log(`\n📄 Starting export of ${allLinks.length} documents...`);
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < allLinks.length; i++) {
      const doc = allLinks[i];
      console.log(`\n📄 ${i + 1}/${allLinks.length}: ${doc.text}`);
      
      try {
        await page.goto(doc.href);
        await page.waitForTimeout(3000);
        
        // Simple export attempt
        try {
          await page.click('text=Share', { timeout: 5000 });
          await page.waitForTimeout(1000);
          await page.click('text=Export', { timeout: 5000 });
          await page.waitForTimeout(1000);
          
          const downloadPromise = page.waitForDownload({ timeout: 15000 });
          await page.click('button:has-text("Export")', { timeout: 5000 });
          
          const download = await downloadPromise;
          const filename = `document_${i + 1}_${Date.now()}.pdf`;
          await download.saveAs(path.join(downloadsDir, filename));
          
          successCount++;
          console.log(`✅ Exported: ${filename}`);
        } catch (exportError) {
          throw new Error(`Export failed: ${exportError.message}`);
        }
        
      } catch (error) {
        errorCount++;
        console.log(`❌ Failed: ${error.message}`);
      }
      
      // Wait between requests
      await page.waitForTimeout(5000);
    }
    
    console.log(`\n🎉 Export complete!`);
    console.log(`✅ Success: ${successCount} | ❌ Failed: ${errorCount}`);
    console.log(`📁 Files in: ${downloadsDir}`);
    
  } catch (error) {
    console.error('💥 Script error:', error);
  } finally {
    await browser.close();
  }
}

downloadAllScribes().catch(console.error);