const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

let rl;

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  requestsPerMinute: 10,
  minDelayMs: 3000,
  maxDelayMs: 30000,
  backoffMultiplier: 1.5,
  maxRetries: 3,
  randomFactor: 0.5,
  occasionalLongPause: 0.1,
  longPauseMultiplier: 3
};

// Rate limiter class (same as before)
class RateLimiter {
  constructor(config) {
    this.config = config;
    this.requestTimes = [];
    this.currentDelay = config.minDelayMs;
    this.consecutiveErrors = 0;
    this.lastRequestTime = 0;
  }

  async waitForNextSlot() {
    const now = Date.now();

    // Clean up old request times
    this.requestTimes = this.requestTimes.filter(time => now - time < 60000);

    // Check rate limit
    if (this.requestTimes.length >= this.config.requestsPerMinute) {
      const oldestRequest = this.requestTimes[0];
      const waitTime = Math.max(0, 60000 - (now - oldestRequest));
      if (waitTime > 0) {
        console.log(`⏳ Rate limit reached. Waiting ${Math.round(waitTime / 1000)}s...`);
        await this.sleep(waitTime);
      }
    }

    // Apply human-like randomized delay
    let baseDelay = this.currentDelay;
    
    if (Math.random() < this.config.occasionalLongPause) {
      baseDelay *= this.config.longPauseMultiplier;
      console.log(`🤔 Taking a longer pause (simulating human behavior)...`);
    }
    
    const randomFactor = this.config.randomFactor;
    const minDelay = baseDelay * (1 - randomFactor);
    const maxDelay = baseDelay * (1 + randomFactor);
    const randomizedDelay = minDelay + Math.random() * (maxDelay - minDelay);
    
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < randomizedDelay) {
      const waitTime = randomizedDelay - timeSinceLastRequest;
      console.log(`⏱️  Waiting ${(waitTime / 1000).toFixed(1)}s before next request (human-like timing)...`);
      await this.sleep(waitTime);
    }

    this.requestTimes.push(Date.now());
    this.lastRequestTime = Date.now();
  }

  handleSuccess() {
    this.currentDelay = this.config.minDelayMs;
    this.consecutiveErrors = 0;
  }

  handleError() {
    this.consecutiveErrors++;
    this.currentDelay = Math.min(
      this.currentDelay * this.config.backoffMultiplier,
      this.config.maxDelayMs
    );
    console.log(`⚠️  Error detected. Increasing delay to ${Math.round(this.currentDelay / 1000)}s`);
  }

  async applyCooldown() {
    console.log(`🧊 Applying cooldown period of ${this.config.cooldownPeriod / 1000}s...`);
    await this.sleep(this.config.cooldownPeriod);
    this.reset();
  }

  reset() {
    this.requestTimes = [];
    this.currentDelay = this.config.minDelayMs;
    this.consecutiveErrors = 0;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

const rateLimiter = new RateLimiter(RATE_LIMIT_CONFIG);

async function downloadAllScribes() {
  // Initialize readline interface
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const downloadsDir = path.join(__dirname, 'downloads');
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir);
  }

  console.log('🚀 Starting Scribe bulk export (Cookie Method)...');
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
    console.log('\n🍪 Cookie-based Authentication Setup');
    console.log('=====================================');
    console.log('1. Open your regular browser (Chrome, Firefox, etc.)');
    console.log('2. Go to: https://scribehow.com/signin');
    console.log('3. Login to your Scribe account');
    console.log('4. After successful login, press F12 to open Developer Tools');
    console.log('5. Go to Application tab > Storage > Cookies > https://scribehow.com');
    console.log('6. Look for cookies like:');
    console.log('   - session');
    console.log('   - auth_token');
    console.log('   - _scribe_session');
    console.log('   - access_token');
    console.log('7. Copy the VALUE of the main session cookie');
    
    const sessionCookie = await askQuestion('\n🔑 Paste your session cookie value here: ');
    
    // Set multiple possible cookie names
    const cookieNames = ['session', 'auth_token', '_scribe_session', 'access_token', 'authToken'];
    
    for (const cookieName of cookieNames) {
      await page.context().addCookies([{
        name: cookieName,
        value: sessionCookie,
        domain: 'scribehow.com',
        path: '/'
      }]);
    }
    
    console.log('🍪 Authentication cookies set!');
    
    // Test authentication by going to workspace
    console.log('🔍 Testing authentication...');
    await page.goto('https://scribehow.com/workspace/documents');
    await page.waitForTimeout(5000); // Allow time for redirect
    
    const currentUrl = page.url();
    console.log('Current URL after cookie auth:', currentUrl);
    
    if (currentUrl.includes('/signin') || currentUrl.includes('/login')) {
      console.log('❌ Authentication failed. The cookie may be invalid or expired.');
      console.log('Please try again with a fresh cookie from your browser.');
      return;
    }
    
    console.log('✅ Authentication successful!');
    
    // Find all documents
    console.log('🔍 Finding all documents...');
    const documents = await collectAllDocuments(page);
    console.log(`📊 Found ${documents.length} documents to export`);
    
    if (documents.length === 0) {
      console.log('❌ No documents found. Trying alternative document page URLs...');
      
      // Try alternative URLs
      const alternativeUrls = [
        'https://scribehow.com/workspace',
        'https://scribehow.com/dashboard',
        'https://scribehow.com/documents'
      ];
      
      for (const altUrl of alternativeUrls) {
        console.log(`🔍 Trying: ${altUrl}`);
        await page.goto(altUrl);
        await page.waitForTimeout(3000);
        
        const altDocuments = await collectAllDocuments(page);
        if (altDocuments.length > 0) {
          documents.push(...altDocuments);
          console.log(`📊 Found ${altDocuments.length} documents at ${altUrl}`);
          break;
        }
      }
    }
    
    if (documents.length === 0) {
      console.log('❌ Still no documents found. Taking a screenshot for debugging...');
      await page.screenshot({ path: 'no-documents-debug.png' });
      console.log('📸 Debug screenshot saved: no-documents-debug.png');
      return;
    }
    
    // Export documents with rate limiting
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      console.log(`\n📄 Processing ${i + 1}/${documents.length}: ${doc.title}`);
      
      await rateLimiter.waitForNextSlot();
      
      let retries = 0;
      let exported = false;
      
      while (retries < RATE_LIMIT_CONFIG.maxRetries && !exported) {
        try {
          if (retries > 0) {
            console.log(`🔄 Retry attempt ${retries}/${RATE_LIMIT_CONFIG.maxRetries} for: ${doc.title}`);
          }
          
          await exportDocument(page, doc, downloadsDir);
          successCount++;
          exported = true;
          rateLimiter.handleSuccess();
          console.log(`✅ Successfully exported: ${doc.title}`);
        } catch (error) {
          retries++;
          rateLimiter.handleError();
          
          if (error.message.includes('429') || error.message.includes('rate limit')) {
            console.log(`🚫 Rate limit hit! Applying cooldown...`);
            await rateLimiter.applyCooldown();
            retries--;
          } else if (retries < RATE_LIMIT_CONFIG.maxRetries) {
            console.log(`⚠️  Failed attempt ${retries}: ${error.message}`);
            await rateLimiter.waitForNextSlot();
          } else {
            errorCount++;
            console.log(`❌ Failed to export after ${RATE_LIMIT_CONFIG.maxRetries} retries: ${doc.title}`);
          }
        }
      }
      
      if ((i + 1) % 10 === 0 || i === documents.length - 1) {
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
    console.log('\n🔧 If you continue having issues:');
    console.log('1. Make sure you copied the complete cookie value');
    console.log('2. Try refreshing your browser session and getting a new cookie');
    console.log('3. Check if your Scribe account has access to documents');
  } finally {
    await browser.close();
    if (rl) {
      rl.close();
    }
  }
}

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function collectAllDocuments(page) {
  await page.waitForTimeout(3000);
  await autoScroll(page);
  
  const strategies = [
    async () => {
      return await page.$$eval('a[href*="/shared/"], a[href*="/viewer/"]', elements => 
        elements.map(el => ({
          href: el.href,
          title: el.textContent?.trim() || el.getAttribute('title') || 'Untitled'
        }))
      );
    },
    
    async () => {
      return await page.$$eval('[data-testid*="document"], .document-item, .document-card', elements => 
        elements.map(el => {
          const link = el.querySelector('a') || el;
          return {
            href: link.href,
            title: el.textContent?.trim() || link.getAttribute('title') || 'Untitled'
          };
        }).filter(doc => doc.href && doc.href.includes('scribehow.com'))
      );
    },
    
    async () => {
      return await page.$$eval('a[href*="scribe"]', elements => 
        elements.map(el => ({
          href: el.href,
          title: el.textContent?.trim() || 'Untitled'
        }))
      );
    }
  ];
  
  let allDocuments = [];
  for (const strategy of strategies) {
    try {
      const docs = await strategy();
      if (docs && docs.length > 0) {
        allDocuments = docs;
        console.log(`📋 Found ${docs.length} documents using detection strategy`);
        break;
      }
    } catch (e) {
      console.log('⚠️  Strategy failed, trying next...');
    }
  }
  
  const uniqueDocuments = allDocuments
    .filter(doc => doc.href && doc.href.includes('scribehow.com'))
    .filter((doc, index, self) => 
      index === self.findIndex(d => d.href === doc.href)
    );
  
  return uniqueDocuments;
}

async function exportDocument(page, document, downloadsDir) {
  const startTime = Date.now();

  try {
    await page.goto(document.href);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    const shareSelectors = [
      'button:has-text("Share")',
      '[data-testid="share-button"]',
      'button[aria-label*="Share"]',
      '.share-button',
      '[title*="Share"]'
    ];
    
    let shareClicked = false;
    for (const selector of shareSelectors) {
      try {
        await page.click(selector, { timeout: 3000 });
        shareClicked = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (!shareClicked) {
      const menuSelectors = ['[data-testid*="menu"]', '.menu-button', 'button[aria-expanded]'];
      for (const selector of menuSelectors) {
        try {
          await page.click(selector, { timeout: 2000 });
          await page.waitForTimeout(1000);
          await page.click('text=Share', { timeout: 2000 });
          shareClicked = true;
          break;
        } catch (e) {
          continue;
        }
      }
    }
    
    if (!shareClicked) {
      throw new Error('Could not find Share button');
    }
    
    await page.waitForTimeout(1000);
    await page.click('text=Export', { timeout: 5000 });
    await page.waitForTimeout(1000);
    
    const downloadPromise = page.waitForDownload({ timeout: 30000 });
    
    const pdfExportSelectors = [
      'text=Export to PDF >> .. >> button:has-text("Export")',
      'button:has-text("Export"):near(:text("PDF"))',
      '.pdf-export button:has-text("Export")'
    ];
    
    let exported = false;
    for (const selector of pdfExportSelectors) {
      try {
        await page.click(selector, { timeout: 3000 });
        exported = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (!exported) {
      throw new Error('Could not find PDF Export button');
    }
    
    const download = await downloadPromise;
    const cleanTitle = document.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `${cleanTitle}.pdf`;
    await download.saveAs(path.join(downloadsDir, filename));

    const exportTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`   ⏱️  Export completed in ${exportTime}s`);

  } catch (error) {
    if (page.url().includes('/login') || page.url().includes('/signin')) {
      throw new Error('Session expired - need fresh cookie');
    }
    if (error.message.includes('timeout')) {
      throw new Error(`Export timeout - document may be too large`);
    }
    throw new Error(`Export failed: ${error.message}`);
  }
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if(totalHeight >= scrollHeight){
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}

downloadAllScribes().catch(console.error);