fn main() {
    // Link Swift runtime libraries for screencapturekit crate
    #[cfg(target_os = "macos")]
    {
        // Find Xcode's Swift library path
        let output = std::process::Command::new("xcrun")
            .args(["--show-sdk-path"])
            .output()
            .expect("Failed to run xcrun");
        
        let sdk_path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        
        // Get the toolchain lib path for Swift runtime
        let toolchain_output = std::process::Command::new("xcrun")
            .args(["--find", "swiftc"])
            .output()
            .expect("Failed to find swiftc");
        
        let swiftc_path = String::from_utf8_lossy(&toolchain_output.stdout).trim().to_string();
        if let Some(toolchain_path) = std::path::Path::new(&swiftc_path)
            .parent()
            .and_then(|p| p.parent())
        {
            let swift_lib_path = toolchain_path.join("lib/swift/macosx");
            println!("cargo:rustc-link-search=native={}", swift_lib_path.display());
        }
        
        // Also add the SDK's usr/lib/swift path
        println!("cargo:rustc-link-search=native={}/usr/lib/swift", sdk_path);
        
        // Link against the Swift concurrency library
        println!("cargo:rustc-link-lib=dylib=swiftCore");
    }
    
    tauri_build::build()
}
