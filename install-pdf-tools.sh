#!/bin/bash

# PDF Image Extraction Tools Installation Script
# This script installs the necessary tools for PDF to image conversion

echo "🚀 Installing PDF Image Extraction Tools..."
echo "=========================================="

# Update package list
echo "📦 Updating package list..."
sudo apt update

# Install Ghostscript (recommended - most reliable)
echo "👻 Installing Ghostscript..."
sudo apt install -y ghostscript

# Install Poppler utilities (alternative method)
echo "📄 Installing Poppler utilities..."
sudo apt install -y poppler-utils

# Install ImageMagick (another alternative)
echo "🎨 Installing ImageMagick..."
sudo apt install -y imagemagick

# Install GraphicsMagick (used by pdf2pic)
echo "🔧 Installing GraphicsMagick..."
sudo apt install -y graphicsmagick

# Verify installations
echo ""
echo "✅ Verifying installations..."
echo "=============================="

echo -n "Ghostscript: "
if command -v gs &> /dev/null; then
    echo "✅ Installed ($(gs --version))"
else
    echo "❌ Not found"
fi

echo -n "pdftoppm: "
if command -v pdftoppm &> /dev/null; then
    echo "✅ Installed ($(pdftoppm -v 2>&1 | head -1))"
else
    echo "❌ Not found"
fi

echo -n "ImageMagick convert: "
if command -v convert &> /dev/null; then
    echo "✅ Installed ($(convert --version | head -1))"
else
    echo "❌ Not found"
fi

echo -n "GraphicsMagick: "
if command -v gm &> /dev/null; then
    echo "✅ Installed ($(gm version | head -1))"
else
    echo "❌ Not found"
fi

echo ""
echo "🎉 Installation complete!"
echo "========================="
echo ""
echo "You can now run any of these PDF converters:"
echo "• node working-pdf-converter.js <pdf-file> <output-dir>     (tries all methods)"
echo "• node comprehensive-pdf-converter.js <pdf-file> <output-dir>  (uses pdf2pic)"
echo "• node final-pdf-converter.js <pdf-file> <output-dir>       (uses pdf-poppler)"
echo ""
echo "Test with:"
echo "node working-pdf-converter.js \"downloads/example.pdf\" \"downloads/\""