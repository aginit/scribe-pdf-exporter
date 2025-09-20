#!/bin/bash

echo "🔧 Installing Scribe Exporter Dependencies"
echo "=========================================="

# Update package list
echo "📦 Updating package list..."
sudo apt update

# Install Playwright system dependencies
echo "🎭 Installing Playwright dependencies..."
sudo apt-get install -y \
    libatk1.0-0t64 \
    libatk-bridge2.0-0t64 \
    libcups2t64 \
    libatspi2.0-0t64 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libcairo2 \
    libpango-1.0-0 \
    libasound2t64 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libglib2.0-0 \
    libxkbcommon0

# Alternative: Use Playwright's built-in installer
echo "🎭 Running Playwright dependency installer..."
npx playwright install-deps

# Verify installation
echo "✅ Verifying installation..."
echo "Node.js version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "Playwright installed: $(ls node_modules/ | grep playwright || echo "Not found")"

# Test browser launch
echo "🧪 Testing browser launch..."
node -e "
const { chromium } = require('playwright');
(async () => {
  try {
    console.log('Launching browser...');
    const browser = await chromium.launch({ headless: true });
    console.log('✅ Browser launched successfully!');
    await browser.close();
    console.log('✅ Browser closed successfully!');
  } catch (error) {
    console.log('❌ Browser test failed:', error.message);
  }
})();
" 2>/dev/null || echo "❌ Browser test failed - dependencies may be incomplete"

echo ""
echo "🎉 Installation complete!"
echo ""
echo "📋 Next steps:"
echo "1. Run: node scribe-exporter-credentials.js"
echo "2. Or run: node scribe-exporter-improved.js"
echo "3. Or run: node scribe-exporter.js"
echo ""
echo "💡 If you still get errors, try:"
echo "   sudo apt-get install chromium-browser"