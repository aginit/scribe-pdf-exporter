require('dotenv').config();
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Configuration for 200+ documents
const COMPREHENSIVE_CONFIG = {
  minDelayMs: parseInt(process.env.MIN_DELAY_MS) || 2000, // Faster for 200 docs
  maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
  randomFactor: 0.3, // Less randomness for efficiency
  occasionalLongPause: 0.05, // Fewer long pauses
  longPauseMultiplier: 2,
  progressReportInterval: 10, // Report every 10 documents
  maxConcurrentDownloads: 1, // Keep it simple for now
  folderExploreTimeout: 10000,
  documentTimeout: 30000
};

class ProgressTracker {
  constructor(totalDocs) {
    this.totalDocs = totalDocs;
    this.successful = 0;
    this.failed = 0;
    this.current = 0;
    this.startTime = Date.now();
    this.failedDocs = [];
  }

  reportProgress(docTitle, success, error = null) {
    this.current++;
    if (success) {
      this.successful++;
    } else {
      this.failed++;
      this.failedDocs.push({ title: docTitle, error: error?.message });
    }

    const percentage = Math.round((this.current / this.totalDocs) * 100);
    const elapsed = (Date.now() - this.startTime) / 1000 / 60; // minutes
    const rate = this.current / elapsed;
    const eta = ((this.totalDocs - this.current) / rate).toFixed(1);

    if (this.current % COMPREHENSIVE_CONFIG.progressReportInterval === 0 || this.current === this.totalDocs) {
      console.log(`\n📊 Progress Report:`);
      console.log(`   📈 ${percentage}% Complete (${this.current}/${this.totalDocs})`);
      console.log(`   ✅ Success: ${this.successful} | ❌ Failed: ${this.failed}`);
      console.log(`   ⏱️  Elapsed: ${elapsed.toFixed(1)}min | ETA: ${eta}min`);
      console.log(`   🚀 Rate: ${rate.toFixed(1)} docs/min`);
    }
  }

  getFinalReport() {
    const totalTime = (Date.now() - this.startTime) / 1000 / 60;
    return {
      total: this.totalDocs,
      successful: this.successful,
      failed: this.failed,
      totalTime: totalTime.toFixed(1),
      avgRate: (this.current / totalTime).toFixed(1),
      failedDocs: this.failedDocs
    };
  }
}

class RateLimiter {
  constructor(config) {
    this.config = config;
    this.lastRequestTime = 0;
  }

  async waitForNextSlot() {
    const now = Date.now();
    let baseDelay = this.config.minDelayMs;
    
    if (Math.random() < this.config.occasionalLongPause) {
      baseDelay *= this.config.longPauseMultiplier;
      console.log(`   🤔 Taking a longer pause...`);
    }
    
    const randomFactor = this.config.randomFactor;
    const minDelay = baseDelay * (1 - randomFactor);
    const maxDelay = baseDelay * (1 + randomFactor);
    const randomizedDelay = minDelay + Math.random() * (maxDelay - minDelay);
    
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < randomizedDelay) {
      const waitTime = randomizedDelay - timeSinceLastRequest;
      console.log(`   ⏱️  ${(waitTime / 1000).toFixed(1)}s wait`);
      await this.sleep(waitTime);
    }

    this.lastRequestTime = Date.now();
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

const rateLimiter = new RateLimiter(COMPREHENSIVE_CONFIG);

async function downloadAllScribes() {
  if (!process.env.SCRIBE_EMAIL || !process.env.SCRIBE_PASSWORD) {
    console.error('❌ Missing credentials!');
    return;
  }

  const downloadsDir = path.join(__dirname, 'downloads');
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir);
  }

  console.log('🚀 Starting Comprehensive Scribe Export (200+ documents)...');
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
    
    // Comprehensive document discovery
    console.log('🔍 Exploring all folders and documents...');
    const allDocuments = await exploreAllDocuments(page);
    console.log(`📊 Found ${allDocuments.length} total documents across all folders`);
    
    if (allDocuments.length === 0) {
      console.log('❌ No documents found.');
      return;
    }

    // Initialize progress tracker
    const progress = new ProgressTracker(allDocuments.length);
    
    console.log(`\n🎯 Starting export of ${allDocuments.length} documents...`);
    
    // Export each document
    for (let i = 0; i < allDocuments.length; i++) {
      const doc = allDocuments[i];
      const shortTitle = doc.title.length > 60 ? doc.title.substring(0, 60) + '...' : doc.title;
      
      console.log(`\n📄 [${i + 1}/${allDocuments.length}] ${shortTitle}`);
      console.log(`   📂 Folder: ${doc.folder || 'Root'}`);
      
      await rateLimiter.waitForNextSlot();
      
      let success = false;
      let lastError = null;
      
      for (let retry = 0; retry < COMPREHENSIVE_CONFIG.maxRetries; retry++) {
        try {
          if (retry > 0) {
            console.log(`   🔄 Retry ${retry}/${COMPREHENSIVE_CONFIG.maxRetries}`);
          }
          
          await exportDocument(page, doc, downloadsDir);
          success = true;
          console.log(`   ✅ Exported successfully`);
          break;
        } catch (error) {
          lastError = error;
          if (retry < COMPREHENSIVE_CONFIG.maxRetries - 1) {
            console.log(`   ⚠️  Attempt ${retry + 1} failed: ${error.message}`);
            await rateLimiter.waitForNextSlot();
          }
        }
      }
      
      if (!success) {
        console.log(`   ❌ Failed after ${COMPREHENSIVE_CONFIG.maxRetries} retries: ${lastError?.message}`);
      }
      
      progress.reportProgress(doc.title, success, lastError);
      
      // Save progress to file periodically
      if ((i + 1) % 25 === 0) {
        await saveProgress(progress, allDocuments, i + 1);
      }
    }
    
    // Final report
    const finalReport = progress.getFinalReport();
    console.log(`\n🎉 Comprehensive Export Complete!`);
    console.log(`📊 Final Results:`);
    console.log(`   ✅ Successfully exported: ${finalReport.successful} documents`);
    console.log(`   ❌ Failed exports: ${finalReport.failed} documents`);
    console.log(`   ⏱️  Total time: ${finalReport.totalTime} minutes`);
    console.log(`   🚀 Average rate: ${finalReport.avgRate} docs/min`);
    console.log(`   📁 Files saved to: ${downloadsDir}`);
    
    // Save final report
    await saveFinalReport(finalReport, downloadsDir);
    
    if (finalReport.failedDocs.length > 0) {
      console.log(`\n❌ Failed Documents:`);
      finalReport.failedDocs.forEach((doc, i) => {
        console.log(`   ${i + 1}. ${doc.title} - ${doc.error}`);
      });
    }
    
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

async function exploreAllDocuments(page) {
  const allDocuments = [];
  
  // Start from workspace
  await page.goto('https://scribehow.com/workspace');
  await page.waitForTimeout(3000);
  
  console.log('📂 Exploring root workspace...');
  
  // Get documents from main workspace
  const rootDocs = await getDocumentsFromCurrentView(page, 'Root');
  allDocuments.push(...rootDocs);
  console.log(`   📄 Found ${rootDocs.length} documents in root`);
  
  // Look for folders to explore
  const folders = await getFoldersFromCurrentView(page);
  console.log(`   📁 Found ${folders.length} folders to explore`);
  
  // Explore each folder
  for (let i = 0; i < folders.length; i++) {
    const folder = folders[i];
    console.log(`📂 Exploring folder: ${folder.name}`);
    
    try {
      // Click on folder
      await page.click(folder.selector, { timeout: COMPREHENSIVE_CONFIG.folderExploreTimeout });
      await page.waitForTimeout(2000);
      
      // Get documents from this folder
      const folderDocs = await getDocumentsFromCurrentView(page, folder.name);
      allDocuments.push(...folderDocs);
      console.log(`   📄 Found ${folderDocs.length} documents in ${folder.name}`);
      
      // Look for subfolders
      const subfolders = await getFoldersFromCurrentView(page);
      for (const subfolder of subfolders) {
        console.log(`📂 Exploring subfolder: ${folder.name}/${subfolder.name}`);
        
        try {
          await page.click(subfolder.selector, { timeout: COMPREHENSIVE_CONFIG.folderExploreTimeout });
          await page.waitForTimeout(2000);
          
          const subfolderDocs = await getDocumentsFromCurrentView(page, `${folder.name}/${subfolder.name}`);
          allDocuments.push(...subfolderDocs);
          console.log(`   📄 Found ${subfolderDocs.length} documents in ${subfolder.name}`);
          
          // Go back to parent folder
          await page.goBack();
          await page.waitForTimeout(1000);
        } catch (subfolderError) {
          console.log(`   ⚠️  Could not explore subfolder ${subfolder.name}: ${subfolderError.message}`);
        }
      }
      
      // Go back to main workspace
      await page.goto('https://scribehow.com/workspace');
      await page.waitForTimeout(2000);
      
    } catch (folderError) {
      console.log(`   ⚠️  Could not explore folder ${folder.name}: ${folderError.message}`);
    }
  }
  
  // Remove duplicates
  const uniqueDocuments = allDocuments.filter((doc, index, self) => 
    index === self.findIndex(d => d.href === doc.href)
  );
  
  console.log(`🎯 Total unique documents found: ${uniqueDocuments.length}`);
  return uniqueDocuments;
}

async function getDocumentsFromCurrentView(page, folderName) {
  try {
    await page.waitForTimeout(2000); // Let page settle
    
    const documents = await page.$$eval('a[href*="/viewer/"], a[href*="/shared/"]', (elements, folder) => 
      elements.map(el => ({
        href: el.href,
        title: el.textContent?.trim() || 'Untitled',
        folder: folder
      })).filter(doc => doc.href.includes('scribehow.com'))
    , folderName);
    
    return documents;
  } catch (error) {
    console.log(`   ⚠️  Error getting documents from ${folderName}: ${error.message}`);
    return [];
  }
}

async function getFoldersFromCurrentView(page) {
  try {
    // Look for clickable folder elements (this may need adjustment based on Scribe's UI)
    const folders = await page.$$eval(
      'div[role="button"], button, a, [class*="folder"], [class*="directory"], [data-testid*="folder"]',
      elements => elements.map((el, index) => ({
        name: el.textContent?.trim() || `Folder-${index}`,
        selector: `${el.tagName.toLowerCase()}:nth-child(${Array.from(el.parentNode.children).indexOf(el) + 1})`,
        text: el.textContent?.trim()
      })).filter(folder => 
        folder.text && 
        folder.text.length > 0 && 
        folder.text.length < 100 &&
        !folder.text.includes('http') &&
        !folder.name.includes('Export') &&
        !folder.name.includes('Share')
      ).slice(0, 20) // Limit to prevent too many false positives
    );
    
    return folders;
  } catch (error) {
    console.log(`   ⚠️  Error getting folders: ${error.message}`);
    return [];
  }
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
    const downloadPromise = page.waitForEvent('download', { timeout: COMPREHENSIVE_CONFIG.documentTimeout });
    
    // Find and click PDF Export button
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
    
    await page.click(`button >> nth=${pdfExportButtons[0].index}`);
    
    // Wait for download
    const download = await downloadPromise;
    
    // Save with clean filename including folder info
    const folderPrefix = document.folder && document.folder !== 'Root' ? 
      `${document.folder.replace(/[^a-z0-9]/gi, '_')}_` : '';
    const cleanTitle = document.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const timestamp = Date.now();
    const filename = `${folderPrefix}${cleanTitle}_${timestamp}.pdf`;
    
    await download.saveAs(path.join(downloadsDir, filename));

    const exportTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`   ⏱️  ${exportTime}s -> ${filename}`);

  } catch (error) {
    if (page.url().includes('/signin')) {
      throw new Error('Session expired');
    }
    throw error;
  }
}

async function saveProgress(progress, allDocuments, currentIndex) {
  const progressData = {
    timestamp: new Date().toISOString(),
    completed: currentIndex,
    total: allDocuments.length,
    successful: progress.successful,
    failed: progress.failed,
    remaining: allDocuments.slice(currentIndex).map(doc => ({
      title: doc.title,
      href: doc.href,
      folder: doc.folder
    }))
  };
  
  fs.writeFileSync('./progress.json', JSON.stringify(progressData, null, 2));
  console.log(`   💾 Progress saved to progress.json`);
}

async function saveFinalReport(report, downloadsDir) {
  const reportPath = path.join(downloadsDir, 'export-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📊 Final report saved to: ${reportPath}`);
}

downloadAllScribes().catch(console.error);