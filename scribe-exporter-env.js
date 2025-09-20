require('dotenv').config();
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Rate limiting configuration (can be overridden by .env)
const RATE_LIMIT_CONFIG = {
  requestsPerMinute: parseInt(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE) || 10,
  minDelayMs: parseInt(process.env.MIN_DELAY_MS) || 3000,
  maxDelayMs: 30000,
  backoffMultiplier: 1.5,
  maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
  burstSize: 3,
  cooldownPeriod: 60000,
  // Human-like behavior settings
  randomFactor: 0.5,  // Randomize delays by +/- 50%
  occasionalLongPause: 0.1,  // 10% chance of a longer pause
  longPauseMultiplier: 3  // Long pauses are 3x normal delay
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

    // Apply human-like randomized delay between requests
    let baseDelay = this.currentDelay;
    
    // Occasional longer pause (simulates human reading/thinking)
    if (Math.random() < this.config.occasionalLongPause) {
      baseDelay *= this.config.longPauseMultiplier;
      console.log(`🤔 Taking a longer pause (simulating human behavior)...`);
    }
    
    // Add random variation (+/- randomFactor)
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

    // Record this request
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
  // Validate environment variables
  if (!process.env.SCRIBE_EMAIL || !process.env.SCRIBE_PASSWORD) {
    console.error('❌ Missing credentials!');
    console.error('Please set SCRIBE_EMAIL and SCRIBE_PASSWORD in your .env file');
    console.error('Example:');
    console.error('SCRIBE_EMAIL=your-email@example.com');
    console.error('SCRIBE_PASSWORD=your-password');
    return;
  }

  // Create downloads directory
  const downloadsDir = path.join(__dirname, 'downloads');
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir);
  }

  console.log('🚀 Starting Scribe bulk export with environment credentials...');
  console.log('📁 Downloads will be saved to:', downloadsDir);

  const browser = await chromium.launch({ 
    headless: true, // Start headless since we're in WSL
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  const context = await browser.newContext({
    acceptDownloads: true,
    downloadPath: downloadsDir
  });
  
  const page = await context.newPage();
  
  try {
    // Login with credentials from .env
    console.log('🔐 Logging in with credentials from .env file...');
    await directLogin(page, process.env.SCRIBE_EMAIL, process.env.SCRIBE_PASSWORD);
    
    // Save auth state for future use
    await page.context().storageState({ path: './auth-state.json' });
    
    // Continue with the same browser (already headless)
    console.log('✅ Login successful, continuing with document export...');
    
    // Navigate to documents page
    console.log('🔍 Navigating to documents...');
    await page.goto('https://scribehow.com/workspace/documents');
    await page.waitForLoadState('networkidle');
    
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
    
    await browser.close();
    
  } catch (error) {
    console.error('💥 Script error:', error);
    console.log('\n🔧 If login failed, check your credentials in the .env file');
  }
}

// Direct credential login with two-step process
async function directLogin(page, email, password) {
  console.log('🔐 Logging in with credentials...');
  
  // Go directly to the signin page
  console.log('🌐 Going to signin page...');
  await page.goto('https://scribehow.com/signin');
  await page.waitForLoadState('networkidle');
  
  // Wait for login form to appear
  console.log('⏳ Waiting for login form...');
  await page.waitForSelector('input[type="email"], input[name="email"], input[name="username"], #email, #username', { timeout: 10000 });
  
  try {
    // Step 1: Enter email/username
    console.log('📧 Entering email...');
    await page.waitForSelector('input[type="email"], input[name="email"], input[name="username"], #email, #username', { timeout: 5000 });
    await page.fill('input[type="email"], input[name="email"], input[name="username"], #email, #username', email);
    
    // Click continue/next button to proceed to password step
    console.log('👆 Clicking continue...');
    await page.click('button[type="submit"], button:has-text("Continue"), button:has-text("Next"), button:has-text("Log in")');
    
    // Wait for password field to appear
    console.log('⏳ Waiting for password field...');
    await page.waitForSelector('input[type="password"], input[name="password"], #password', { timeout: 10000 });
    
    // Step 2: Enter password
    console.log('🔐 Entering password...');
    await page.fill('input[type="password"], input[name="password"], #password', password);
    
    // Click login button
    console.log('👆 Clicking login...');
    await page.click('button[type="submit"], button:has-text("Log in"), button:has-text("Sign in")');
    
    // Wait for redirect to dashboard or documents page
    console.log('⏳ Waiting for login success...');
    await page.waitForFunction(
      () => window.location.href.includes('/workspace') || window.location.href.includes('/documents'),
      { timeout: 15000 }
    );
    
    console.log('✅ Successfully logged in!');
    
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    console.log('\n🔧 Debug info:');
    console.log('Current URL:', page.url());
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'login-debug.png' });
    console.log('📸 Debug screenshot saved as login-debug.png');
    
    throw new Error('Login failed - check your credentials in .env file');
  }
}

async function collectAllDocuments(page) {
  // Wait for the page to load
  await page.waitForTimeout(3000);
  
  // Scroll to load all documents
  await autoScroll(page);
  
  // Try multiple strategies to find documents
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