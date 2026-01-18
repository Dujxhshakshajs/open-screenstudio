# How to Update Xcode via CLI

Since Xcode is not installed via the App Store, here are the CLI methods to update it:

## Method 1: Using xcode-install gem (Recommended)

```bash
# Install xcode-install gem
gem install xcode-install

# List available Xcode versions
xcversion list

# Install latest Xcode (requires Apple ID)
xcversion install latest

# Or install specific version
xcversion install "16.1"

# Update to latest
xcversion update
```

**Note**: Requires your Apple Developer account credentials.

## Method 2: Direct Download via curl (Requires Authentication)

```bash
# You'll need to authenticate with your Apple ID first
# Then download the latest Xcode.xip

# Open Apple Developer downloads page
open 'https://developer.apple.com/xcode/'

# Or use direct download (requires authentication token)
# This is complex and not recommended - better to use Method 1 or manual download
```

## Method 3: Using mas (Only if Xcode was installed via App Store)

```bash
# Check if Xcode is in App Store
mas list | grep Xcode

# If found, update it
mas upgrade 497799835
```

## Method 4: Manual Download (Simplest)

```bash
# 1. Download Xcode.xip from Apple Developer website
open 'https://developer.apple.com/xcode/'

# 2. After download, extract it
cd ~/Downloads
xip -x Xcode.xip

# 3. Move to Applications (replace old version)
sudo rm -rf /Applications/Xcode.app
sudo mv Xcode.app /Applications/

# 4. Accept license
sudo xcodebuild -license accept

# 5. Set command line tools
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
```

## Quick Check Script

Run the provided script to check your current setup:

```bash
./update_xcode.sh
```

## Verify Update

After updating, verify you have macOS SDK 15.2+:

```bash
./check_sdk.sh
```

Or manually:

```bash
xcodebuild -showsdks | grep -i macos
```

You should see `macOS 15.2` or higher listed.
