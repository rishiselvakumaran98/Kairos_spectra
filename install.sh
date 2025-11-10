#!/bin/bash

# KAIROS-SPECTRA Installation Script
# This script sets up the development environment

set -e  # Exit on error

echo "=========================================="
echo "KAIROS-SPECTRA Phase 1 Installation"
echo "=========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the KAIROS-SPECTRA directory"
    exit 1
fi

echo "📦 Step 1: Installing dependencies..."
npm install

echo ""
echo "🔨 Step 2: Building extension..."
npm run build

echo ""
echo "✅ Build complete!"
echo ""
echo "=========================================="
echo "Next Steps:"
echo "=========================================="
echo ""
echo "1. Open Google Chrome"
echo "2. Navigate to: chrome://extensions/"
echo "3. Enable 'Developer mode' (toggle in top-right)"
echo "4. Click 'Load unpacked'"
echo "5. Select this folder:"
echo "   $(pwd)/dist"
echo ""
echo "6. Test the extension:"
echo "   Open: $(pwd)/test-dashboard.html"
echo "   Open DevTools Console (F12)"
echo "   Try the test scenarios in DEVELOPMENT_GUIDE.md"
echo ""
echo "=========================================="
echo "Development Commands:"
echo "=========================================="
echo ""
echo "  npm run dev      - Watch mode (auto-rebuild on changes)"
echo "  npm run build    - Production build"
echo ""
echo "For detailed instructions, see:"
echo "  - README.md"
echo "  - DEVELOPMENT_GUIDE.md"
echo ""
echo "🎉 Installation complete! Happy testing!"
echo ""
