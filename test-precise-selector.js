require('dotenv').config();
const { chromium } = require('playwright');

async function testPreciseSelector() {
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
    
    await page.goto(testUrl);
    await page.waitForTimeout(3000);
    
    console.log('👆 Clicking Share button...');
    await page.click('button:has-text("Share")', { timeout: 10000 });
    await page.waitForTimeout(1000);
    
    console.log('👆 Clicking Export tab...');
    await page.click('button:has-text("Export"), [role="tab"]:has-text("Export")', { timeout: 5000 });
    await page.waitForTimeout(2000);
    
    // Analyze the export buttons more precisely
    console.log('🔍 Analyzing export buttons...');
    const exportButtons = await page.$$eval('button', buttons => 
      buttons.map((btn, index) => ({
        index,
        text: btn.textContent?.trim(),
        className: btn.className,
        visible: btn.offsetParent !== null,
        previousSiblingText: btn.previousElementSibling?.textContent?.trim(),
        parentText: btn.parentElement?.textContent?.trim(),
        nearbyText: btn.closest('div')?.textContent?.trim()
      })).filter(btn => 
        btn.visible && 
        btn.text === 'Export' &&
        btn.nearbyText?.includes('PDF')
      )
    );
    
    console.log('🔘 PDF Export buttons found:');
    exportButtons.forEach((btn, i) => {
      console.log(`  ${i+1}. Index: ${btn.index}, Parent text: "${btn.parentText?.substring(0, 100)}"`);
    });
    
    if (exportButtons.length > 0) {
      // Set up download listener
      const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
      
      // Click using the button index
      console.log(`👆 Clicking PDF Export button (index ${exportButtons[0].index})...`);
      await page.click(`button >> nth=${exportButtons[0].index}`);
      
      console.log('⏳ Waiting for download...');
      
      try {
        const download = await downloadPromise;
        const filename = `precise-test-${Date.now()}.pdf`;
        await download.saveAs(`./downloads/${filename}`);
        
        console.log(`🎉 Successfully downloaded: ${filename}`);
        
        // Check file size
        const stats = await require('fs').promises.stat(`./downloads/${filename}`);
        console.log(`📁 File size: ${stats.size} bytes`);
        
      } catch (downloadError) {
        console.log('❌ Download timeout, but click was successful');
        console.log('💡 The export might be processing on their servers');
        
        // Take a screenshot after clicking
        await page.screenshot({ path: 'after-pdf-click.png' });
        console.log('📸 After click screenshot: after-pdf-click.png');
      }
      
    } else {
      console.log('❌ No PDF Export button found in the expected format');
      
      // Show all visible Export buttons for debugging
      const allExportButtons = await page.$$eval('button', buttons => 
        buttons.map((btn, index) => ({
          index,
          text: btn.textContent?.trim(),
          visible: btn.offsetParent !== null
        })).filter(btn => btn.visible && btn.text === 'Export')
      );
      
      console.log('\n🔘 All visible Export buttons:');
      allExportButtons.forEach((btn, i) => {
        console.log(`  ${i+1}. Index: ${btn.index}, Text: "${btn.text}"`);
      });
    }
    
  } catch (error) {
    console.error('💥 Error:', error);
    await page.screenshot({ path: 'precise-error.png' });
  } finally {
    await browser.close();
  }
}

testPreciseSelector().catch(console.error);