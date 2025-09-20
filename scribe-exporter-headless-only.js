const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  requestsPerMinute: 10,  // Maximum requests per minute
  minDelayMs: 3000,       // Minimum delay between requests (3 seconds)
  maxDelayMs: 30000,      // Maximum delay for backoff (30 seconds)
  backoffMultiplier: 1.5, // Exponential backoff multiplier
  maxRetries: 3,          // Maximum retries for failed requests
  burstSize: 3,           // Allow burst of requests before enforcing rate limit
  cooldownPeriod: 60000   // Cooldown period after hitting rate limit (1 minute)
};

// Rate limiter class
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

    // Clean up old request times (older than 1 minute)
    this.requestTimes = this.requestTimes.filter(time => now - time < 60000);

    // Check if we're within rate limit
    if (this.requestTimes.length >= this.config.requestsPerMinute) {
      const oldestRequest = this.requestTimes[0];
      const waitTime = Math.max(0, 60000 - (now - oldestRequest));
      if (waitTime > 0) {
        console.log(`⏳ Rate limit reached. Waiting ${Math.round(waitTime / 1000)}s...`);
        await this.sleep(waitTime);
      }
    }

    // Apply minimum delay between requests
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.currentDelay) {
      const waitTime = this.currentDelay - timeSinceLastRequest;
      console.log(`⏱️  Waiting ${Math.round(waitTime / 1000)}s before next request...`);
      await this.sleep(waitTime);
    }

    // Record this request
    this.requestTimes.push(Date.now());
    this.lastRequestTime = Date.now();
  }

  handleSuccess() {
    // Reset delay on success
    this.currentDelay = this.config.minDelayMs;
    this.consecutiveErrors = 0;
  }

  handleError() {
    // Implement exponential backoff
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
  // Create downloads directory
  const downloadsDir = path.join(__dirname, 'downloads');
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir);
  }

  console.log('🚀 Starting Scribe bulk export (headless mode)...');
  console.log('📁 Downloads will be saved to:', downloadsDir);

  // Try to use existing auth state first
  let storageState = undefined;
  if (fs.existsSync('./auth-state.json')) {
    console.log('🔄 Found existing auth state, trying to reuse...');
    storageState = './auth-state.json';
  }

  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  const context = await browser.newContext({
    acceptDownloads: true,
    downloadPath: downloadsDir,
    storageState: storageState
  });
  
  const page = await context.newPage();
  
  try {
    // Check if we're already logged in
    await page.goto('https://scribehow.com/workspace/documents');
    await page.waitForTimeout(3000);
    
    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/signin')) {
      console.log('❌ Not logged in. Please use one of these options:');
      console.log('1. Install browser dependencies: sudo npx playwright install-deps');
      console.log('2. Run interactive version: node scribe-exporter-improved.js');
      console.log('3. Use cookie method: node scribe-exporter.js');
      return;
    }

    console.log('✅ Already logged in!');
    
    // Collect all document links
    console.log('🔍 Finding all documents...');
    const documents = await collectAllDocuments(page);
    console.log(`📊 Found ${documents.length} documents to export`);
    
    if (documents.length === 0) {
      console.log('❌ No documents found. Please check your login and try again.');
      return;
    }
    
    // Export each document with rate limiting
    let successCount = 0;
    let errorCount = 0;
    let skipCount = 0;

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      console.log(`\n📄 Processing ${i + 1}/${documents.length}: ${doc.title}`);

      // Apply rate limiting before each request
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

          // Check for rate limit errors
          if (error.message.includes('429') || error.message.includes('rate limit') ||
              error.message.includes('too many requests')) {
            console.log(`🚫 Rate limit hit! Applying cooldown...`);
            await rateLimiter.applyCooldown();
            retries--; // Don't count rate limit as a retry
          } else if (retries < RATE_LIMIT_CONFIG.maxRetries) {
            console.log(`⚠️  Failed attempt ${retries}: ${error.message}`);
            await rateLimiter.waitForNextSlot();
          } else {
            errorCount++;
            console.log(`❌ Failed to export after ${RATE_LIMIT_CONFIG.maxRetries} retries: ${doc.title}`);
          }
        }
      }

      // Progress update every 10 documents
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
    console.log('\n🔧 To fix browser issues, run: sudo npx playwright install-deps');
  } finally {
    await browser.close();
    rl.close();
  }
}

async function collectAllDocuments(page) {
  const documents = [];
  
  // Wait for the page to load
  await page.waitForTimeout(3000);
  
  // Scroll to load all documents (in case of lazy loading)
  await autoScroll(page);
  
  // Try multiple strategies to find documents
  const strategies = [
    // Strategy 1: Look for specific document links
    async () => {
      return await page.$$eval('a[href*="/shared/"], a[href*="/viewer/"]', elements => 
        elements.map(el => ({
          href: el.href,
          title: el.textContent?.trim() || el.getAttribute('title') || 'Untitled'
        }))
      );
    },
    
    // Strategy 2: Look for document cards
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
    
    // Strategy 3: Look for any clickable items that might be documents
    async () => {
      return await page.$$eval('a, [role="button"], .clickable', elements => 
        elements
          .filter(el => {
            const href = el.href || '';
            const onclick = el.getAttribute('onclick') || '';
            return (href.includes('/shared/') || href.includes('/viewer/') || 
                   onclick.includes('document') || onclick.includes('scribe'));
          })
          .map(el => ({
            href: el.href || window.location.origin + '/' + el.getAttribute('data-id'),
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
  
  // Remove duplicates and invalid entries
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
    // Navigate to the document
    await page.goto(document.href);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Look for share button
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
      // Try clicking anywhere that might open a share menu
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
    
    // Click on Export tab
    await page.click('text=Export', { timeout: 5000 });
    await page.waitForTimeout(1000);
    
    // Set up download promise before clicking export
    const downloadPromise = page.waitForDownload({ timeout: 30000 });
    
    // Click Export to PDF button
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
    
    // Wait for download to complete
    const download = await downloadPromise;
    
    // Save with a clean filename
    const cleanTitle = document.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `${cleanTitle}.pdf`;
    await download.saveAs(path.join(downloadsDir, filename));

    const exportTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`   ⏱️  Export completed in ${exportTime}s`);

  } catch (error) {
    // Check for specific error types
    if (page.url().includes('/login') || page.url().includes('/signin')) {
      throw new Error('Session expired - need to re-login');
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

// Run the script
downloadAllScribes().catch(console.error);