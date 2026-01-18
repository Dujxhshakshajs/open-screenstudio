#!/bin/bash
# Script to update Xcode via CLI

set -e

echo "=== Xcode Update Script ==="
echo ""

# Method 1: Check if Xcode is installed via App Store (can use mas)
if mas list 2>/dev/null | grep -q "Xcode"; then
    echo "✓ Xcode found in App Store. Updating via mas..."
    mas upgrade 497799835
    echo "✓ Update complete!"
    exit 0
fi

# Method 2: Check for system updates (Xcode updates sometimes appear here)
echo "Checking for system software updates..."
if softwareupdate --list 2>&1 | grep -qi "xcode"; then
    echo "✓ Xcode update found in system updates"
    read -p "Install Xcode update? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        softwareupdate --install --all
    fi
    exit 0
fi

# Method 3: Direct download from Apple Developer (requires Apple ID)
echo ""
echo "Xcode is not installed via App Store."
echo ""
echo "To update Xcode via CLI, you have these options:"
echo ""
echo "1. Download latest Xcode from Apple Developer:"
echo "   Visit: https://developer.apple.com/xcode/"
echo "   Or use: open 'https://developer.apple.com/xcode/'"
echo ""
echo "2. Use xcode-install gem (if installed):"
echo "   gem install xcode-install"
echo "   xcversion update"
echo ""
echo "3. Manual download and install:"
echo "   - Download Xcode.xip from Apple Developer"
echo "   - Extract: xip -x ~/Downloads/Xcode.xip"
echo "   - Move: sudo mv Xcode.app /Applications/"
echo "   - Accept license: sudo xcodebuild -license accept"
echo ""
echo "Current Xcode version:"
xcodebuild -version
echo ""
echo "Available SDKs:"
xcodebuild -showsdks | grep -i macos
