require('dotenv').config();
const { chromium } = require('playwright');

async function testSingleDocument() {
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
    
    // Test with first document
    const testUrl = 'https://scribehow.com/viewer/Create_Temporary_Self-Destructing_Login_Credentials__jpwOl94AS0ukWHxz5wUwLA?referrer=workspace';
    console.log('📄 Testing document:', testUrl);
    
    await page.goto(testUrl);
    await page.waitForTimeout(5000);
    
    console.log('✅ Document loaded');
    console.log('Current URL:', page.url());
    
    await page.screenshot({ path: 'test-document.png' });
    console.log('📸 Document screenshot: test-document.png');
    
    // Look for all buttons
    const buttons = await page.$$eval('button, [role="button"], .btn, [class*="button"]', elements => 
      elements.map(el => ({
        text: el.textContent?.trim(),
        className: el.className,
        ariaLabel: el.getAttribute('aria-label'),
        title: el.title,
        visible: el.offsetParent !== null
      })).filter(btn => btn.visible && btn.text && btn.text.length > 0)
    );
    
    console.log(`\n🔘 Found ${buttons.length} visible buttons:`);
    buttons.forEach((btn, i) => {
      if (btn.text.length < 100) { // Only show short button texts
        console.log(`  ${i+1}. "${btn.text}" ${btn.ariaLabel ? `(aria: ${btn.ariaLabel})` : ''}`);
      }
    });
    
    // Look for export/share specific buttons
    const exportButtons = buttons.filter(btn => {
      const text = btn.text.toLowerCase();
      return text.includes('share') || 
             text.includes('export') || 
             text.includes('download') || 
             text.includes('pdf') ||
             btn.ariaLabel?.toLowerCase().includes('share') ||
             btn.ariaLabel?.toLowerCase().includes('export');
    });
    
    console.log(`\n📤 Found ${exportButtons.length} export/share buttons:`);
    exportButtons.forEach((btn, i) => {
      console.log(`  ${i+1}. "${btn.text}" ${btn.ariaLabel ? `(aria: ${btn.ariaLabel})` : ''}`);
    });
    
    // Try clicking a share button if found
    if (exportButtons.length > 0) {
      console.log(`\n👆 Trying to click: "${exportButtons[0].text}"`);
      
      try {
        // Try different ways to click the share button
        const shareSelectors = [
          `button:has-text("${exportButtons[0].text}")`,
          `[role="button"]:has-text("${exportButtons[0].text}")`,
          `button[aria-label="${exportButtons[0].ariaLabel}"]`
        ];
        
        let clicked = false;
        for (const selector of shareSelectors) {
          try {
            await page.click(selector, { timeout: 3000 });
            clicked = true;
            console.log(`✅ Clicked with selector: ${selector}`);
            break;
          } catch (e) {
            continue;
          }
        }
        
        if (clicked) {
          await page.waitForTimeout(2000);
          await page.screenshot({ path: 'after-share-click.png' });
          console.log('📸 After click screenshot: after-share-click.png');
          
          // Look for modal/popup content
          const modalButtons = await page.$$eval('button, [role="button"]', elements => 
            elements.map(el => ({
              text: el.textContent?.trim(),
              visible: el.offsetParent !== null && el.offsetWidth > 0 && el.offsetHeight > 0
            })).filter(btn => btn.visible && btn.text && btn.text.length > 0)
          );
          
          console.log('\n🔘 Buttons after clicking share:');
          modalButtons.forEach((btn, i) => {
            if (btn.text.length < 100) {
              console.log(`  ${i+1}. "${btn.text}"`);
            }
          });
          
          // Look for export options
          const exportOptions = modalButtons.filter(btn => 
            btn.text.toLowerCase().includes('export') ||
            btn.text.toLowerCase().includes('pdf') ||
            btn.text.toLowerCase().includes('download')
          );
          
          if (exportOptions.length > 0) {
            console.log('\n📄 Export options found:');
            exportOptions.forEach((opt, i) => {
              console.log(`  ${i+1}. "${opt.text}"`);
            });
            
            // Try to export as PDF
            try {
              console.log('\n👆 Attempting PDF export...');
              
              // Set up download listener
              const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
              
              // Try clicking export
              await page.click('button:has-text("Export"), button:has-text("PDF")', { timeout: 5000 });
              
              const download = await downloadPromise;
              const filename = `test-export-${Date.now()}.pdf`;
              await download.saveAs(`./downloads/${filename}`);
              
              console.log(`✅ Successfully downloaded: ${filename}`);
              
            } catch (exportError) {
              console.log(`❌ Export failed: ${exportError.message}`);
            }
          }
        }
        
      } catch (error) {
        console.log(`❌ Failed to click share button: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('💥 Error:', error);
    await page.screenshot({ path: 'test-error.png' });
  } finally {
    await browser.close();
  }
}

testSingleDocument().catch(console.error);