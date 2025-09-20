require('dotenv').config();
const { chromium } = require('playwright');
const fs = require('fs');

async function getDocumentUrls() {
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
    
    // Get documents from workspace
    await page.goto('https://scribehow.com/workspace');
    await page.waitForTimeout(5000);
    
    // Find all document links
    const documents = await page.$$eval('a[href]', elements => 
      elements.map(el => ({
        href: el.href,
        text: el.textContent?.trim() || 'No title',
        innerText: el.innerText?.trim() || '',
      })).filter(doc => 
        doc.href.includes('scribehow.com') && 
        (doc.href.includes('/shared/') || 
         doc.href.includes('/viewer/') || 
         (doc.text.length > 10 && !doc.href.includes('#') && !doc.href.includes('/workspace')))
      )
    );
    
    console.log(`📊 Found ${documents.length} potential documents:`);
    console.log('');
    
    const documentList = [];
    
    documents.forEach((doc, i) => {
      const title = doc.text.length > 50 ? doc.text.substring(0, 50) + '...' : doc.text;
      console.log(`${i + 1}. ${title}`);
      console.log(`   URL: ${doc.href}`);
      console.log('');
      
      documentList.push({
        id: i + 1,
        title: doc.text,
        url: doc.href
      });
    });
    
    // Save to file
    const outputFile = 'document-urls.json';
    fs.writeFileSync(outputFile, JSON.stringify(documentList, null, 2));
    console.log(`📄 Document URLs saved to: ${outputFile}`);
    
    console.log('');
    console.log('🔧 Next steps:');
    console.log('1. Check the URLs in your browser to see which ones are actual documents');
    console.log('2. Look for documents that have Share/Export functionality');
    console.log('3. We can then build a targeted export script for those specific URLs');
    
  } catch (error) {
    console.error('💥 Error:', error);
  } finally {
    await browser.close();
  }
}

getDocumentUrls().catch(console.error);