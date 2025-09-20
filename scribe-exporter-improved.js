const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function downloadAllScribes() {
  // Create downloads directory
  const downloadsDir = path.join(__dirname, 'downloads');
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir);
  }

  const browser = await chromium.launch({ 
    headless: false, // Start non-headless for login
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    acceptDownloads: true,
    downloadPath: downloadsDir
  });
  
  const page = await context.newPage();
  
  try {
    console.log('🚀 Starting Scribe bulk export...');
    console.log('📁 Downloads will be saved to:', downloadsDir);
    
    // Step 1: Login interactively
    console.log('\n🔐 Logging in to Scribe...');
    await interactiveLogin(page);
    
    // Step 2: Switch to headless mode after login
    console.log('🔄 Switching to headless mode...');
    await browser.close();
    
    // Restart in headless mode with the authentication
    const headlessBrowser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const headlessContext = await headlessBrowser.newContext({
      acceptDownloads: true,
      downloadPath: downloadsDir,
      storageState: './auth-state.json' // Load saved auth state
    });
    
    const headlessPage = await headlessContext.newPage();
    
    // Step 3: Navigate to documents page
    console.log('🔍 Navigating to documents...');
    await headlessPage.goto('https://scribehow.com/workspace/documents');
    await headlessPage.waitForLoadState('networkidle');
    
    // Step 4: Collect all document links
    console.log('🔍 Finding all documents...');
    const documents = await collectAllDocuments(headlessPage);
    console.log(`📊 Found ${documents.length} documents to export`);
    
    if (documents.length === 0) {
      console.log('❌ No documents found. Please check your login and try again.');
      return;
    }
    
    // Step 5: Export each document
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      console.log(`\n📄 Exporting ${i + 1}/${documents.length}: ${doc.title}`);
      
      try {
        await exportDocument(headlessPage, doc, downloadsDir);
        successCount++;
        console.log(`✅ Successfully exported: ${doc.title}`);
      } catch (error) {
        errorCount++;
        console.log(`❌ Failed to export: ${doc.title} - ${error.message}`);
      }
      
      // Rate limiting - be respectful to their servers
      await headlessPage.waitForTimeout(3000);
    }
    
    console.log(`\n🎉 Export complete!`);
    console.log(`✅ Successfully exported: ${successCount} documents`);
    console.log(`❌ Failed exports: ${errorCount} documents`);
    console.log(`📁 Files saved to: ${downloadsDir}`);
    
    await headlessBrowser.close();
    
  } catch (error) {
    console.error('💥 Script error:', error);
  } finally {
    rl.close();
  }
}

async function interactiveLogin(page) {
  console.log('\n🌐 Opening browser for login...');
  await page.goto('https://scribehow.com/login');
  
  console.log('📋 Please complete these steps in the opened browser:');
  console.log('1. Login to your Scribe account');
  console.log('2. Navigate to your documents page');
  console.log('3. Verify you can see your documents');
  
  await askQuestion('\n✅ Press Enter when you have successfully logged in and can see your documents: ');
  
  // Save authentication state for headless use
  await page.context().storageState({ path: './auth-state.json' });
  console.log('💾 Authentication state saved!');
}

// Alternative: Direct credential login (handles two-step process)
async function directLogin(page, email, password) {
  console.log('🔐 Logging in with credentials...');
  
  await page.goto('https://scribehow.com/login');
  await page.waitForLoadState('networkidle');
  
  // Step 1: Enter email/username
  console.log('📧 Entering email...');
  await page.fill('input[type="email"], input[name="email"], input[name="username"], #email, #username', email);
  
  // Click continue/next button to proceed to password step
  await page.click('button[type="submit"], button:has-text("Continue"), button:has-text("Next"), button:has-text("Log in")');
  
  // Wait for password field to appear
  await page.waitForSelector('input[type="password"], input[name="password"], #password', { timeout: 5000 });
  
  // Step 2: Enter password
  console.log('🔐 Entering password...');
  await page.fill('input[type="password"], input[name="password"], #password', password);
  
  // Click login button
  await page.click('button[type="submit"], button:has-text("Log in"), button:has-text("Sign in")');
  
  // Wait for redirect to dashboard
  await page.waitForURL('**/workspace**', { timeout: 15000 });
  
  console.log('✅ Successfully logged in!');
  
  // Save authentication state
  await page.context().storageState({ path: './auth-state.json' });
}

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
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
    
  } catch (error) {
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