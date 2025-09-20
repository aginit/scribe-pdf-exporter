require('dotenv').config();
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  minDelayMs: parseInt(process.env.MIN_DELAY_MS) || 3000,
  maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
  randomFactor: 0.5,
  occasionalLongPause: 0.1,
  longPauseMultiplier: 2
};

class RateLimiter {
  constructor(config) {
    this.config = config;
    this.lastRequestTime = 0;
  }

  async waitForNextSlot() {
    const now = Date.now();
    let baseDelay = this.config.minDelayMs;
    
    // Occasional longer pause
    if (Math.random() < this.config.occasionalLongPause) {
      baseDelay *= this.config.longPauseMultiplier;
      console.log(`🤔 Taking a longer pause...`);
    }
    
    // Add random variation
    const randomFactor = this.config.randomFactor;
    const minDelay = baseDelay * (1 - randomFactor);
    const maxDelay = baseDelay * (1 + randomFactor);
    const randomizedDelay = minDelay + Math.random() * (maxDelay - minDelay);
    
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < randomizedDelay) {
      const waitTime = randomizedDelay - timeSinceLastRequest;
      console.log(`⏱️  Waiting ${(waitTime / 1000).toFixed(1)}s before next request...`);
      await this.sleep(waitTime);
    }

    this.lastRequestTime = Date.now();
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

const rateLimiter = new RateLimiter(RATE_LIMIT_CONFIG);

async function downloadAllScribes() {
  if (!process.env.SCRIBE_EMAIL || !process.env.SCRIBE_PASSWORD) {
    console.error('❌ Missing credentials!');
    console.error('Please set SCRIBE_EMAIL and SCRIBE_PASSWORD in your .env file');
    return;
  }

  const downloadsDir = path.join(__dirname, 'downloads');
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir);
  }

  console.log('🚀 Starting Scribe bulk export (Final Version)...');
  console.log('📁 Downloads will be saved to:', downloadsDir);

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
    console.log('🔐 Logging in...');
    await directLogin(page, process.env.SCRIBE_EMAIL, process.env.SCRIBE_PASSWORD);
    console.log('✅ Login successful!');
    
    // Get all documents
    console.log('🔍 Finding all documents...');
    const documents = await getAllDocuments(page);
    console.log(`📊 Found ${documents.length} documents to export`);
    
    if (documents.length === 0) {
      console.log('❌ No documents found.');
      return;
    }
    
    // Export each document
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      console.log(`\n📄 Processing ${i + 1}/${documents.length}: ${doc.title.substring(0, 60)}...`);
      
      await rateLimiter.waitForNextSlot();
      
      let retries = 0;
      let exported = false;
      
      while (retries < RATE_LIMIT_CONFIG.maxRetries && !exported) {
        try {
          if (retries > 0) {
            console.log(`🔄 Retry ${retries}/${RATE_LIMIT_CONFIG.maxRetries}`);
          }
          
          await exportDocument(page, doc, downloadsDir);
          successCount++;
          exported = true;
          console.log(`✅ Successfully exported!`);
        } catch (error) {
          retries++;
          
          if (retries < RATE_LIMIT_CONFIG.maxRetries) {
            console.log(`⚠️  Failed attempt ${retries}: ${error.message}`);
            await rateLimiter.waitForNextSlot();
          } else {
            errorCount++;
            console.log(`❌ Failed after ${RATE_LIMIT_CONFIG.maxRetries} retries: ${error.message}`);
          }
        }
      }
      
      // Progress update
      if ((i + 1) % 5 === 0 || i === documents.length - 1) {
        const progress = Math.round(((i + 1) / documents.length) * 100);
        console.log(`\n📊 Progress: ${progress}% (${i + 1}/${documents.length})`);
        console.log(`   ✅ Success: ${successCount} | ❌ Failed: ${errorCount}`);
      }
    }
    
    console.log(`\n🎉 Export complete!`);
    console.log(`✅ Successfully exported: ${successCount} documents`);
    console.log(`❌ Failed exports: ${errorCount} documents`);
    console.log(`📁 Files saved to: ${downloadsDir}`);
    
  } catch (error) {
    console.error('💥 Script error:', error);
  } finally {
    await browser.close();
  }
}

async function directLogin(page, email, password) {
  await page.goto('https://scribehow.com/signin');
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.fill('input[type="email"]', email);
  await page.click('button:has-text("Continue")');
  await page.waitForSelector('input[type="password"]', { timeout: 10000 });
  await page.fill('input[type="password"]', password);
  await page.click('button:has-text("Sign In"), button[type="submit"]');
  await page.waitForFunction(() => !window.location.href.includes('/signin'), { timeout: 15000 });
}

async function getAllDocuments(page) {
  await page.goto('https://scribehow.com/workspace');
  await page.waitForTimeout(3000);
  
  const documents = await page.$$eval('a[href*="/viewer/"]', elements => 
    elements.map(el => ({
      href: el.href,
      title: el.textContent?.trim() || 'Untitled'
    })).filter(doc => doc.href.includes('scribehow.com/viewer/'))
  );
  
  return documents;
}

async function exportDocument(page, document, downloadsDir) {
  const startTime = Date.now();

  try {
    // Navigate to document
    await page.goto(document.href);
    await page.waitForTimeout(3000);
    
    // Click Share button
    await page.click('button:has-text("Share")', { timeout: 10000 });
    await page.waitForTimeout(1000);
    
    // Click Export tab
    await page.click('button:has-text("Export"), [role="tab"]:has-text("Export")', { timeout: 5000 });
    await page.waitForTimeout(1000);
    
    // Set up download listener
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    
    // Find and click the PDF Export button using precise targeting
    console.log('   🔍 Finding PDF Export button...');
    const pdfExportButtons = await page.$$eval('button', buttons => 
      buttons.map((btn, index) => ({
        index,
        text: btn.textContent?.trim(),
        visible: btn.offsetParent !== null,
        nearbyText: btn.closest('div')?.textContent?.trim()
      })).filter(btn => 
        btn.visible && 
        btn.text === 'Export' &&
        btn.nearbyText?.includes('Export to PDF')
      )
    );
    
    if (pdfExportButtons.length === 0) {
      throw new Error('Could not find PDF Export button');
    }
    
    console.log(`   👆 Clicking PDF Export button (index ${pdfExportButtons[0].index})...`);
    await page.click(`button >> nth=${pdfExportButtons[0].index}`);
    console.log(`   ✅ Successfully clicked PDF export button`);
    
    // Wait for download
    const download = await downloadPromise;
    
    // Save with clean filename
    const cleanTitle = document.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const timestamp = Date.now();
    const filename = `${cleanTitle}_${timestamp}.pdf`;
    await download.saveAs(path.join(downloadsDir, filename));

    const exportTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`   ⏱️  Export completed in ${exportTime}s -> ${filename}`);

  } catch (error) {
    if (page.url().includes('/signin')) {
      throw new Error('Session expired - need to re-login');
    }
    throw new Error(`Export failed: ${error.message}`);
  }
}

downloadAllScribes().catch(console.error);