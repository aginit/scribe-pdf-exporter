require('dotenv').config();
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Configuration for folder-based navigation
const FOLDER_CONFIG = {
  minDelayMs: parseInt(process.env.MIN_DELAY_MS) || 2000,
  maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
  randomFactor: 0.3,
  occasionalLongPause: 0.05,
  longPauseMultiplier: 2,
  progressReportInterval: 10,
  folderTimeout: 10000,
  documentTimeout: 30000,
  maxFoldersToProcess: 100 // Safety limit
};

class ProgressTracker {
  constructor() {
    this.totalDocs = 0;
    this.successful = 0;
    this.failed = 0;
    this.current = 0;
    this.startTime = Date.now();
    this.failedDocs = [];
    this.processedFolders = [];
  }

  setTotal(total) {
    this.totalDocs = total;
  }

  reportProgress(docTitle, success, error = null, folderName = null) {
    this.current++;
    if (success) {
      this.successful++;
    } else {
      this.failed++;
      this.failedDocs.push({ title: docTitle, error: error?.message, folder: folderName });
    }

    const percentage = this.totalDocs > 0 ? Math.round((this.current / this.totalDocs) * 100) : 0;
    const elapsed = (Date.now() - this.startTime) / 1000 / 60;
    const rate = this.current / elapsed;

    if (this.current % FOLDER_CONFIG.progressReportInterval === 0 || percentage >= 100) {
      console.log(`\n📊 Progress Report:`);
      console.log(`   📈 ${percentage}% Complete (${this.current}/${this.totalDocs})`);
      console.log(`   ✅ Success: ${this.successful} | ❌ Failed: ${this.failed}`);
      console.log(`   ⏱️  Elapsed: ${elapsed.toFixed(1)}min | Rate: ${rate.toFixed(1)} docs/min`);
      console.log(`   📁 Folders processed: ${this.processedFolders.length}`);
    }
  }

  addFolder(folderName) {
    this.processedFolders.push(folderName);
  }

  getFinalReport() {
    const totalTime = (Date.now() - this.startTime) / 1000 / 60;
    return {
      total: this.totalDocs,
      successful: this.successful,
      failed: this.failed,
      totalTime: totalTime.toFixed(1),
      avgRate: (this.current / totalTime).toFixed(1),
      failedDocs: this.failedDocs,
      foldersProcessed: this.processedFolders
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

const rateLimiter = new RateLimiter(FOLDER_CONFIG);

async function downloadAllScribes() {
  if (!process.env.SCRIBE_EMAIL || !process.env.SCRIBE_PASSWORD) {
    console.error('❌ Missing credentials!');
    return;
  }

  const downloadsDir = path.join(__dirname, 'downloads');
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir);
  }

  console.log('🚀 Starting Folder-Based Scribe Export...');
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
    
    // Navigate to All Documents view
    console.log('📂 Navigating to All Documents...');
    await page.goto('https://scribehow.com/workspace');
    await page.waitForTimeout(3000);
    
    // Click on "All Documents" in sidebar
    await page.click('text=All Documents', { timeout: 10000 });
    await page.waitForTimeout(3000);
    
    console.log('🔍 Discovering all folders...');
    const folders = await discoverAllFolders(page);
    console.log(`📁 Found ${folders.length} folders to explore`);
    
    // Initialize progress tracker
    const progress = new ProgressTracker();
    
    // Process each folder
    let allDocuments = [];
    
    for (let i = 0; i < Math.min(folders.length, FOLDER_CONFIG.maxFoldersToProcess); i++) {
      const folder = folders[i];
      console.log(`\n📂 [${i + 1}/${folders.length}] Exploring folder: ${folder.name}`);
      
      try {
        const folderDocs = await exploreFolder(page, folder);
        allDocuments.push(...folderDocs);
        progress.addFolder(folder.name);
        console.log(`   📄 Found ${folderDocs.length} documents in ${folder.name}`);
        
        // Brief pause between folders
        await rateLimiter.sleep(1000);
        
      } catch (folderError) {
        console.log(`   ⚠️  Could not explore folder ${folder.name}: ${folderError.message}`);
      }
    }
    
    // Remove duplicates
    const uniqueDocuments = allDocuments.filter((doc, index, self) => 
      index === self.findIndex(d => d.href === doc.href)
    );
    
    console.log(`\n🎯 Total unique documents found: ${uniqueDocuments.length}`);
    progress.setTotal(uniqueDocuments.length);
    
    if (uniqueDocuments.length === 0) {
      console.log('❌ No documents found.');
      return;
    }

    console.log(`\n🎯 Starting export of ${uniqueDocuments.length} documents...`);
    
    // Export each document
    for (let i = 0; i < uniqueDocuments.length; i++) {
      const doc = uniqueDocuments[i];
      const shortTitle = doc.title.length > 60 ? doc.title.substring(0, 60) + '...' : doc.title;
      
      console.log(`\n📄 [${i + 1}/${uniqueDocuments.length}] ${shortTitle}`);
      console.log(`   📂 Folder: ${doc.folder}`);
      
      await rateLimiter.waitForNextSlot();
      
      let success = false;
      let lastError = null;
      
      for (let retry = 0; retry < FOLDER_CONFIG.maxRetries; retry++) {
        try {
          if (retry > 0) {
            console.log(`   🔄 Retry ${retry}/${FOLDER_CONFIG.maxRetries}`);
          }
          
          await exportDocument(page, doc, downloadsDir);
          success = true;
          console.log(`   ✅ Exported successfully`);
          break;
        } catch (error) {
          lastError = error;
          if (retry < FOLDER_CONFIG.maxRetries - 1) {
            console.log(`   ⚠️  Attempt ${retry + 1} failed: ${error.message}`);
            await rateLimiter.waitForNextSlot();
          }
        }
      }
      
      if (!success) {
        console.log(`   ❌ Failed after ${FOLDER_CONFIG.maxRetries} retries: ${lastError?.message}`);
      }
      
      progress.reportProgress(doc.title, success, lastError, doc.folder);
      
      // Save progress every 25 documents
      if ((i + 1) % 25 === 0) {
        await saveProgress(progress, uniqueDocuments, i + 1);
      }
    }
    
    // Final report
    const finalReport = progress.getFinalReport();
    console.log(`\n🎉 Folder-Based Export Complete!`);
    console.log(`📊 Final Results:`);
    console.log(`   ✅ Successfully exported: ${finalReport.successful} documents`);
    console.log(`   ❌ Failed exports: ${finalReport.failed} documents`);
    console.log(`   📁 Folders processed: ${finalReport.foldersProcessed.length}`);
    console.log(`   ⏱️  Total time: ${finalReport.totalTime} minutes`);
    console.log(`   🚀 Average rate: ${finalReport.avgRate} docs/min`);
    console.log(`   📂 Files saved to: ${downloadsDir}`);
    
    // Save final report
    await saveFinalReport(finalReport, downloadsDir);
    
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

async function discoverAllFolders(page) {
  try {
    await page.waitForTimeout(2000);
    
    // Look for folder elements in the sidebar
    // Based on the screenshot, folders appear to have folder icons and are clickable
    const folders = await page.$$eval(
      'text=Shared >> .. >> [role="button"], text=Shared >> .. >> a, ' +
      '[data-testid*="folder"], [class*="folder"], ' + 
      'div:has-text("📁"), div:has-text("folder")',
      elements => {
        return elements.map((el, index) => {
          const text = el.textContent?.trim() || '';
          // Skip non-folder elements
          if (!text || text.length > 50 || text.includes('http') || 
              text.includes('Search') || text.includes('Sort') || 
              text.includes('New') || text === 'Shared') {
            return null;
          }
          
          return {
            name: text,
            selector: `text=${text}`,
            index: index
          };
        }).filter(folder => folder !== null);
      }
    );
    
    // Also try to find folders by looking for common folder names from the screenshot
    const commonFolderNames = [
      'Unsorted', '3CX', 'Altaro', 'AutoElevate', 'Blue Iris', 'Breach Secure Now',
      'Client Software', 'Clockify', 'ControlMap', 'Dell', 'DropSuite', 'File Cloud',
      'General IT', 'Keeper', 'Microsoft', 'Network', 'OpenVPN', 'Pax8', 'Playbooks'
    ];
    
    const additionalFolders = [];
    for (const folderName of commonFolderNames) {
      try {
        const element = await page.$(`text=${folderName}`);
        if (element) {
          additionalFolders.push({
            name: folderName,
            selector: `text=${folderName}`,
            index: -1
          });
        }
      } catch (e) {
        // Folder doesn't exist, continue
      }
    }
    
    // Combine and deduplicate
    const allFolders = [...folders, ...additionalFolders];
    const uniqueFolders = allFolders.filter((folder, index, self) => 
      index === self.findIndex(f => f.name === folder.name)
    );
    
    console.log(`   📁 Discovered folders: ${uniqueFolders.map(f => f.name).join(', ')}`);
    
    return uniqueFolders;
    
  } catch (error) {
    console.log(`   ⚠️  Error discovering folders: ${error.message}`);
    return [];
  }
}

async function exploreFolder(page, folder) {
  try {
    // Click on the folder
    await page.click(folder.selector, { timeout: FOLDER_CONFIG.folderTimeout });
    await page.waitForTimeout(2000);
    
    // Get documents from the main content area
    const documents = await page.$$eval(
      'a[href*="/viewer/"], a[href*="/shared/"]',
      (elements, folderName) => {
        return elements.map(el => ({
          href: el.href,
          title: el.textContent?.trim() || 'Untitled',
          folder: folderName
        })).filter(doc => 
          doc.href.includes('scribehow.com') && 
          doc.title && 
          doc.title.length > 0
        );
      }, folder.name
    );
    
    return documents;
    
  } catch (error) {
    console.log(`   ⚠️  Error exploring folder ${folder.name}: ${error.message}`);
    return [];
  }
}

async function exportDocument(page, document, downloadsDir) {
  const startTime = Date.now();

  try {
    await page.goto(document.href);
    await page.waitForTimeout(3000);
    
    await page.click('button:has-text("Share")', { timeout: 10000 });
    await page.waitForTimeout(1000);
    
    await page.click('button:has-text("Export"), [role="tab"]:has-text("Export")', { timeout: 5000 });
    await page.waitForTimeout(1000);
    
    const downloadPromise = page.waitForEvent('download', { timeout: FOLDER_CONFIG.documentTimeout });
    
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
    
    const download = await downloadPromise;
    
    // Create filename with folder prefix
    const folderPrefix = document.folder ? 
      `${document.folder.replace(/[^a-z0-9]/gi, '_')}_` : '';
    const cleanTitle = document.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const timestamp = Date.now();
    const filename = `${folderPrefix}${cleanTitle}_${timestamp}.pdf`;
    
    await download.saveAs(path.join(downloadsDir, filename));

    const exportTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`   ⏱️  ${exportTime}s -> ${filename.substring(0, 80)}...`);

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
    foldersProcessed: progress.processedFolders,
    remaining: allDocuments.slice(currentIndex).map(doc => ({
      title: doc.title,
      href: doc.href,
      folder: doc.folder
    }))
  };
  
  fs.writeFileSync('./progress-folders.json', JSON.stringify(progressData, null, 2));
  console.log(`   💾 Progress saved to progress-folders.json`);
}

async function saveFinalReport(report, downloadsDir) {
  const reportPath = path.join(downloadsDir, 'folder-export-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📊 Final report saved to: ${reportPath}`);
}

downloadAllScribes().catch(console.error);