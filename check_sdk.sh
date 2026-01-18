#!/bin/bash
echo "Checking macOS SDK versions..."
xcodebuild -showsdks | grep -i macos
echo ""
echo "Current Xcode version:"
xcodebuild -version
echo ""
echo "If you see macOS 15.2+ SDK, the build should work!"
