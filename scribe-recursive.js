require('dotenv').config();
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  minDelayMs: 2000,
  maxRetries: 3,
  documentTimeout: 30000,
  progressReportInterval: 10
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
    this.folderStructure = {};
  }

  setTotal(total) {
    this.totalDocs = total;
  }

  reportProgress(docTitle, success, error = null, folderPath = null) {
    this.current++;
    if (success) {
      this.successful++;
    } else {
      this.failed++;
      this.failedDocs.push({ title: docTitle, error: error?.message, folder: folderPath });
    }

    if (this.current % CONFIG.progressReportInterval === 0 || this.current === this.totalDocs) {
      const percentage = this.totalDocs > 0 ? Math.round((this.current / this.totalDocs) * 100) : 0;
      const elapsed = (Date.now() - this.startTime) / 1000 / 60;
      const rate = elapsed > 0 ? (this.current / elapsed).toFixed(1) : 0;
      
      console.log(`\n📊 Progress: ${percentage}% (${this.current}/${this.totalDocs})`);
      console.log(`   ✅ Success: ${this.successful} | ❌ Failed: ${this.failed}`);
      console.log(`   ⏱️  ${elapsed.toFixed(1)}min elapsed | ${rate} docs/min`);
    }
  }

  getFinalReport() {
    const totalTime = (Date.now() - this.startTime) / 1000 / 60;
    return {
      total: this.totalDocs,
      successful: this.successful,
      failed: this.failed,
      totalTime: totalTime.toFixed(1),
      avgRate: totalTime > 0 ? (this.current / totalTime).toFixed(1) : 0,
      failedDocs: this.failedDocs,
      folderStructure: this.folderStructure
    };
  }
}

async function downloadAllScribes() {
  if (!process.env.SCRIBE_EMAIL || !process.env.SCRIBE_PASSWORD) {
    console.error('❌ Missing credentials!');
    return;
  }

  const downloadsDir = path.join(__dirname, 'downloads');
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir);
  }

  console.log('🚀 Starting Complete Scribe Export with Nested Folder Support...');
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
    
    // Navigate to All Documents
    await page.goto('https://scribehow.com/workspace');
    await page.waitForTimeout(2000);
    await page.click('text=All Documents');
    await page.waitForTimeout(3000);
    
    console.log('🔍 Discovering all folders and documents (including nested folders)...');
    
    const allDocuments = [];
    const progress = new ProgressTracker();
    
    // Recursive function to explore folders
    async function exploreFolderRecursive(folderName, parentPath = '') {
      const fullPath = parentPath ? `${parentPath} > ${folderName}` : folderName;
      console.log(`\n📂 Exploring: ${fullPath}`);
      
      try {
        // Click on the folder
        const folderClicked = await clickFolder(page, folderName);
        if (!folderClicked) {
          console.log(`   ⚠️  Could not click folder ${folderName}`);
          return;
        }
        
        await page.waitForTimeout(2000);
        
        // Get documents in this folder
        const folderDocs = await page.$$eval('a[href*="/viewer/"], a[href*="/shared/"]', 
          (elements, folderPath) => {
            return elements.map(el => ({
              href: el.href,
              title: el.textContent?.trim() || 'Untitled',
              folder: folderPath
            })).filter(doc => 
              doc.href.includes('scribehow.com') && 
              doc.title.length > 0 &&
              !doc.title.includes('All Documents') // Exclude navigation links
            );
          }, fullPath
        );
        
        if (folderDocs.length > 0) {
          allDocuments.push(...folderDocs);
          console.log(`   📄 Found ${folderDocs.length} documents`);
        }
        
        // Check for subfolders - look for any clickable folder-like elements
        const subfolders = await findSubfolders(page);
        
        if (subfolders.length > 0) {
          console.log(`   📁 Found ${subfolders.length} subfolders: ${subfolders.join(', ')}`);
          
          // Recursively explore each subfolder
          for (const subfolder of subfolders) {
            await exploreFolderRecursive(subfolder, fullPath);
            
            // Navigate back to parent folder
            await navigateBackToFolder(page, folderName, parentPath);
          }
        }
        
        // Record folder structure
        if (!progress.folderStructure[fullPath]) {
          progress.folderStructure[fullPath] = {
            documents: folderDocs.length,
            subfolders: subfolders
          };
        }
        
        progress.processedFolders.push(fullPath);
        
      } catch (folderError) {
        console.log(`   ⚠️  Error in folder ${fullPath}: ${folderError.message}`);
      }
    }
    
    // Helper function to click a folder
    async function clickFolder(page, folderName) {
      const selectors = [
        `text="${folderName}"`,
        `a:has-text("${folderName}")`,
        `button:has-text("${folderName}")`,
        `[aria-label*="${folderName}"]`,
        `div:has-text("${folderName}")`
      ];
      
      for (const selector of selectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            const boundingBox = await element.boundingBox();
            if (boundingBox) {
              await page.click(selector, { timeout: 3000 });
              return true;
            }
          }
        } catch (e) {
          // Continue trying other selectors
        }
      }
      return false;
    }
    
    // Helper function to find subfolders
    async function findSubfolders(page) {
      try {
        // Look for folder indicators (adjust selectors based on Scribe's UI)
        const folders = await page.$$eval(
          'a, button, [role="button"], [class*="folder"], [class*="directory"]',
          elements => {
            return elements
              .map(el => el.textContent?.trim())
              .filter(text => 
                text && 
                text.length > 0 && 
                text.length < 50 &&
                !text.includes('http') &&
                !text.includes('@') &&
                !text.includes('Document') &&
                !text.includes('Export') &&
                !text.includes('Share')
              );
          }
        );
        
        // Filter out main navigation and already processed folders
        const uniqueFolders = [...new Set(folders)];
        return uniqueFolders.slice(0, 10); // Limit to prevent infinite loops
        
      } catch (e) {
        return [];
      }
    }
    
    // Helper function to navigate back to a folder
    async function navigateBackToFolder(page, folderName, parentPath) {
      try {
        // Try to click back to All Documents first
        await page.click('text=All Documents', { timeout: 2000 });
        await page.waitForTimeout(1500);
        
        // If there's a parent path, navigate through it
        if (parentPath) {
          const pathParts = parentPath.split(' > ');
          for (const part of pathParts) {
            await clickFolder(page, part);
            await page.waitForTimeout(1000);
          }
        }
        
        // Click the target folder
        if (folderName !== 'All Documents') {
          await clickFolder(page, folderName);
          await page.waitForTimeout(1000);
        }
      } catch (e) {
        console.log(`   ⚠️  Navigation back failed, trying alternative method`);
        await page.goto('https://scribehow.com/workspace');
        await page.waitForTimeout(2000);
        await page.click('text=All Documents');
        await page.waitForTimeout(2000);
      }
    }
    
    // Start with main folders
    const mainFolders = [
      'Unsorted', '3CX', 'Altaro', 'AutoElevate', 'Blue Iris', 'Breach Secure Now',
      'Client Software', 'Clockify', 'ControlMap', 'Dell', 'DropSuite', 
      'File Cloud', 'General IT', 'Keeper', 'Microsoft', 'Network', 
      'OpenVPN', 'Pax8', 'Playbooks'
    ];
    
    // First, check documents in "All Documents" root level
    console.log('\n📂 Checking root level (All Documents)...');
    const rootDocs = await page.$$eval('a[href*="/viewer/"], a[href*="/shared/"]', 
      elements => {
        return elements.map(el => ({
          href: el.href,
          title: el.textContent?.trim() || 'Untitled',
          folder: 'Root'
        })).filter(doc => 
          doc.href.includes('scribehow.com') && doc.title.length > 0
        );
      }
    );
    
    if (rootDocs.length > 0) {
      allDocuments.push(...rootDocs);
      console.log(`   📄 Found ${rootDocs.length} documents at root level`);
    }
    
    // Process each main folder recursively
    for (let i = 0; i < mainFolders.length; i++) {
      const folderName = mainFolders[i];
      console.log(`\n📁 [${i + 1}/${mainFolders.length}] Main Folder: ${folderName}`);
      
      // Navigate back to All Documents before each main folder
      await page.click('text=All Documents', { timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(2000);
      
      await exploreFolderRecursive(folderName);
    }
    
    // Remove duplicates
    const uniqueDocuments = allDocuments.filter((doc, index, self) => 
      index === self.findIndex(d => d.href === doc.href)
    );
    
    console.log(`\n🎯 Found ${uniqueDocuments.length} unique documents`);
    console.log(`📁 Processed ${progress.processedFolders.length} folders (including subfolders)`);
    progress.setTotal(uniqueDocuments.length);
    
    if (uniqueDocuments.length === 0) {
      console.log('❌ No documents found.');
      return;
    }

    console.log(`\n🎯 Starting export of all documents...`);
    
    // Export each document
    for (let i = 0; i < uniqueDocuments.length; i++) {
      const doc = uniqueDocuments[i];
      const shortTitle = doc.title.length > 50 ? doc.title.substring(0, 50) + '...' : doc.title;
      
      console.log(`\n📄 [${i + 1}/${uniqueDocuments.length}] ${shortTitle}`);
      console.log(`   📂 ${doc.folder}`);
      
      // Rate limiting delay
      if (i > 0) {
        const delay = CONFIG.minDelayMs + Math.random() * 1000;
        console.log(`   ⏱️  ${(delay / 1000).toFixed(1)}s wait`);
        await sleep(delay);
      }
      
      let success = false;
      let lastError = null;
      
      for (let retry = 0; retry < CONFIG.maxRetries; retry++) {
        try {
          if (retry > 0) {
            console.log(`   🔄 Retry ${retry}/${CONFIG.maxRetries}`);
          }
          
          await exportDocument(page, doc, downloadsDir);
          success = true;
          console.log(`   ✅ Success`);
          break;
        } catch (error) {
          lastError = error;
          if (retry < CONFIG.maxRetries - 1) {
            console.log(`   ⚠️  Failed: ${error.message.substring(0, 100)}`);
            await sleep(2000);
          }
        }
      }
      
      if (!success) {
        console.log(`   ❌ Failed after ${CONFIG.maxRetries} retries`);
      }
      
      progress.reportProgress(doc.title, success, lastError, doc.folder);
      
      // Save progress periodically
      if ((i + 1) % 25 === 0) {
        await saveProgress(progress, uniqueDocuments, i + 1);
      }
    }
    
    // Final report
    const finalReport = progress.getFinalReport();
    console.log(`\n🎉 Export Complete!`);
    console.log(`📊 Results:`);
    console.log(`   ✅ Success: ${finalReport.successful}/${finalReport.total}`);
    console.log(`   ❌ Failed: ${finalReport.failed}/${finalReport.total}`);
    console.log(`   ⏱️  Total time: ${finalReport.totalTime}min`);
    console.log(`   🚀 Rate: ${finalReport.avgRate} docs/min`);
    console.log(`   📁 Saved to: ${downloadsDir}`);
    
    // Show folder structure
    console.log(`\n📁 Folder Structure Explored:`);
    Object.entries(finalReport.folderStructure).forEach(([folder, info]) => {
      console.log(`   ${folder}: ${info.documents} docs`);
      if (info.subfolders && info.subfolders.length > 0) {
        console.log(`      └─ Subfolders: ${info.subfolders.join(', ')}`);
      }
    });
    
    // Save final report
    fs.writeFileSync(path.join(downloadsDir, 'export-report.json'), 
                     JSON.stringify(finalReport, null, 2));
    
    if (finalReport.failedDocs.length > 0) {
      console.log(`\n❌ Failed Documents (${finalReport.failedDocs.length}):`);
      finalReport.failedDocs.slice(0, 10).forEach((doc, i) => {
        console.log(`   ${i + 1}. ${doc.title.substring(0, 60)} (${doc.folder})`);
      });
      if (finalReport.failedDocs.length > 10) {
        console.log(`   ... and ${finalReport.failedDocs.length - 10} more (see export-report.json)`);
      }
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

async function exportDocument(page, document, downloadsDir) {
  const startTime = Date.now();

  try {
    await page.goto(document.href);
    await page.waitForTimeout(3000);
    
    await page.click('button:has-text("Share")', { timeout: 10000 });
    await page.waitForTimeout(1000);
    
    await page.click('button:has-text("Export"), [role="tab"]:has-text("Export")', { timeout: 5000 });
    await page.waitForTimeout(1000);
    
    const downloadPromise = page.waitForEvent('download', { timeout: CONFIG.documentTimeout });
    
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
      throw new Error('PDF Export button not found');
    }
    
    await page.click(`button >> nth=${pdfExportButtons[0].index}`);
    
    const download = await downloadPromise;
    
    // Create filename with folder path (replace > with _)
    const folderPrefix = document.folder ? 
      `${document.folder.replace(/[^a-z0-9]/gi, '_')}_` : '';
    const cleanTitle = document.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const timestamp = Date.now();
    const filename = `${folderPrefix}${cleanTitle}_${timestamp}.pdf`;
    
    await download.saveAs(path.join(downloadsDir, filename));

    const exportTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`   ⏱️  ${exportTime}s -> ${filename.substring(0, 60)}...`);

  } catch (error) {
    if (page.url().includes('/signin')) {
      throw new Error('Session expired');
    }
    throw new Error(`Export failed: ${error.message}`);
  }
}

async function saveProgress(progress, allDocuments, currentIndex) {
  const progressData = {
    timestamp: new Date().toISOString(),
    completed: currentIndex,
    total: allDocuments.length,
    successful: progress.successful,
    failed: progress.failed,
    folderStructure: progress.folderStructure,
    remaining: allDocuments.slice(currentIndex).map(doc => ({
      title: doc.title,
      href: doc.href,
      folder: doc.folder
    }))
  };
  
  fs.writeFileSync('./progress.json', JSON.stringify(progressData, null, 2));
  console.log(`   💾 Progress saved`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

downloadAllScribes().catch(console.error);