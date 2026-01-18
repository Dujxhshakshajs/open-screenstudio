# screencapturekit SDK Fix

## Problem

The `screencapturekit` crate version 1.5.0 requires macOS SDK 15.2+, but the system only has macOS SDK 15.0 installed. This caused build errors:

```
error: value of type 'SCContentFilter' has no member 'includedDisplays'
error: value of type 'SCContentFilter' has no member 'includedWindows'
error: value of type 'SCContentFilter' has no member 'includedApplications'
```

## Solution Applied

System audio capture has been temporarily disabled by:

1. **Commented out the dependency** in `src-tauri/Cargo.toml`:
   ```toml
   # screencapturekit = "1.5"  # Temporarily disabled - requires macOS SDK 15.2+
   ```

2. **Created a stub implementation** in `src-tauri/src/capture/macos/system_audio.rs` that:
   - Returns `false` for `is_system_audio_available()`
   - Returns clear error messages when system audio capture is attempted
   - Maintains the same API so the rest of the codebase doesn't break

## How to Re-enable System Audio Capture

After updating Xcode to get macOS SDK 15.2+:

1. **Update Xcode** (see `UPDATE_XCODE.md` for CLI methods):
   ```bash
   # Option 1: Using xcodes (recommended)
   brew install xcodesorg/made/xcodes
   xcodes install latest
   
   # Option 2: Using xcode-install gem
   gem install xcode-install
   xcversion install latest
   
   # Option 3: Manual download from Apple Developer site
   open 'https://developer.apple.com/xcode/'
   ```

2. **Verify SDK version**:
   ```bash
   xcodebuild -showsdks | grep -i macos
   # Should show macOS 15.2 or higher
   ```

3. **Re-enable the dependency** in `src-tauri/Cargo.toml`:
   ```toml
   screencapturekit = "1.5"
   ```

4. **Restore the full implementation**:
   - The original implementation is preserved in git history
   - Or check the crate documentation for the latest API

5. **Clean and rebuild**:
   ```bash
   cd src-tauri
   cargo clean
   cargo build
   ```

## Current Status

✅ **Build succeeds** - The project compiles without errors  
⚠️ **System audio capture disabled** - Feature returns "not available" errors  
📝 **No breaking changes** - Rest of the application works normally  

## Notes

- Screen capture and microphone capture still work
- Only system audio capture (capturing audio from other apps) is affected
- Users can still record with microphone input
- The feature will automatically work again after Xcode is updated
