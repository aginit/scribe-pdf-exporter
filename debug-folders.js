require('dotenv').config();
const { chromium } = require('playwright');

async function debugFolders() {
  if (!process.env.SCRIBE_EMAIL || !process.env.SCRIBE_PASSWORD) {
    console.error('❌ Missing credentials!');
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
    
    // Navigate to All Documents
    await page.goto('https://scribehow.com/workspace');
    await page.waitForTimeout(3000);
    await page.click('text=All Documents');
    await page.waitForTimeout(3000);
    
    // Take a screenshot of the folder structure
    await page.screenshot({ path: 'folder-structure-debug.png', fullPage: true });
    console.log('📸 Full folder structure saved: folder-structure-debug.png');
    
    // Get detailed info about the sidebar structure
    console.log('\n🔍 Analyzing sidebar structure...');
    
    const sidebarElements = await page.$$eval('nav, aside, [class*="sidebar"], [class*="nav"]', 
      elements => {
        return elements.map((el, index) => {
          const allLinks = el.querySelectorAll('a, button, [role="button"]');
          return {
            index,
            className: el.className,
            linksCount: allLinks.length,
            links: Array.from(allLinks).map(link => ({
              text: link.textContent?.trim(),
              href: link.href || 'no-href',
              className: link.className,
              hasArrow: !!link.querySelector('svg, [class*="arrow"], [class*="expand"]'),
              isNested: link.style.paddingLeft !== '' || link.className.includes('nested') || link.className.includes('child')
            })).filter(link => link.text && link.text.length > 0 && link.text.length < 50)
          };
        });
      }
    );
    
    console.log(`\n📋 Found ${sidebarElements.length} sidebar-like elements:`);
    sidebarElements.forEach((sidebar, i) => {
      console.log(`\nSidebar ${i + 1} (${sidebar.linksCount} links):`);
      sidebar.links.forEach(link => {
        const indicators = [];
        if (link.hasArrow) indicators.push('📁');
        if (link.isNested) indicators.push('  └─');
        console.log(`  ${indicators.join('')} "${link.text}" ${link.hasArrow ? '(expandable)' : ''}`);
      });
    });
    
    // Check specific folders for subfolders
    const testFolders = ['Microsoft', 'Network', 'General IT', 'Keeper'];
    
    for (const folderName of testFolders) {
      console.log(`\n🔍 Testing folder: ${folderName}`);
      
      try {
        // Click the folder
        await page.click(`text=${folderName}`, { timeout: 3000 });
        await page.waitForTimeout(2000);
        
        // Count documents
        const docCount = await page.$$eval('a[href*="/viewer/"], a[href*="/shared/"]', 
          elements => elements.filter(el => 
            el.href.includes('scribehow.com') && el.textContent?.trim().length > 0
          ).length
        );
        
        console.log(`   📄 ${docCount} documents`);
        
        // Take a screenshot of this folder view
        await page.screenshot({ path: `folder-${folderName.replace(/\s+/g, '-').toLowerCase()}-debug.png` });
        console.log(`   📸 Screenshot: folder-${folderName.replace(/\s+/g, '-').toLowerCase()}-debug.png`);
        
        // Check if there are any expandable elements or nested structure
        const hasSubstructure = await page.$$eval('*', elements => {
          return elements.some(el => {
            const text = el.textContent?.trim();
            const hasExpandIcon = !!el.querySelector('svg[class*="expand"], svg[class*="arrow"], svg[class*="chevron"]');
            const isNestedItem = el.style.paddingLeft !== '' || el.className.includes('nested');
            const isSubfolder = text && text.length > 0 && text.length < 30 && 
                               !text.includes('Document') && !text.includes('Step') && 
                               (hasExpandIcon || isNestedItem);
            return isSubfolder;
          });
        });
        
        if (hasSubstructure) {
          console.log(`   📁 May have subfolders or nested structure`);
        }
        
      } catch (e) {
        console.log(`   ❌ Could not access ${folderName}: ${e.message}`);
      }
    }
    
  } catch (error) {
    console.error('💥 Debug error:', error);
    await page.screenshot({ path: 'debug-error-folders.png' });
  } finally {
    await browser.close();
  }
}

debugFolders().catch(console.error);