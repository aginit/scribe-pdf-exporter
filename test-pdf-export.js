require('dotenv').config();
const { chromium } = require('playwright');

async function testPdfExport() {
  if (!process.env.SCRIBE_EMAIL || !process.env.SCRIBE_PASSWORD) {
    console.error('❌ Missing credentials in .env file');
    return;
  }

  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  const context = await browser.newContext({
    acceptDownloads: true,
    downloadPath: './downloads'
  });
  
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
    
    // Test with known document
    const testUrl = 'https://scribehow.com/viewer/Create_Temporary_Self-Destructing_Login_Credentials__jpwOl94AS0ukWHxz5wUwLA?referrer=workspace';
    console.log('📄 Testing PDF export...');
    
    await page.goto(testUrl);
    await page.waitForTimeout(3000);
    
    console.log('👆 Clicking Share button...');
    await page.click('button:has-text("Share")', { timeout: 10000 });
    await page.waitForTimeout(1000);
    
    console.log('👆 Clicking Export tab...');
    await page.click('button:has-text("Export"), [role="tab"]:has-text("Export")', { timeout: 5000 });
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: 'export-interface.png' });
    console.log('📸 Export interface screenshot: export-interface.png');
    
    // Set up download listener
    console.log('📥 Setting up download listener...');
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    
    // Try multiple ways to click the PDF export button
    const selectors = [
      'text=Export to PDF >> .. >> button:has-text("Export")',
      'button:has-text("Export"):near(text="Export to PDF")',
      'div:has(text="Export to PDF") button:has-text("Export")',
      'button:has-text("Export")'
    ];
    
    let clicked = false;
    for (const selector of selectors) {
      try {
        console.log(`👆 Trying selector: ${selector}`);
        await page.click(selector, { timeout: 3000 });
        clicked = true;
        console.log(`✅ Successfully clicked: ${selector}`);
        break;
      } catch (e) {
        console.log(`❌ Failed: ${e.message.split('\n')[0]}`);
        continue;
      }
    }
    
    if (!clicked) {
      console.log('❌ Could not find PDF export button');
      return;
    }
    
    console.log('⏳ Waiting for download...');
    const download = await downloadPromise;
    
    const filename = `test-export-${Date.now()}.pdf`;
    await download.saveAs(`./downloads/${filename}`);
    
    console.log(`🎉 Successfully downloaded: ${filename}`);
    console.log(`📁 File size: ${(await require('fs').promises.stat(`./downloads/${filename}`)).size} bytes`);
    
  } catch (error) {
    console.error('💥 Error:', error);
    await page.screenshot({ path: 'test-error.png' });
    console.log('📸 Error screenshot: test-error.png');
  } finally {
    await browser.close();
  }
}

testPdfExport().catch(console.error);