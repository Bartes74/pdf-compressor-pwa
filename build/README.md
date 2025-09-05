Desktop app build resources

Place your platform icons here before building desktop apps:

- macOS application icon: icon.icns
  - Recommended source size: 1024x1024 (square)
  - The .icns file should contain all standard sizes (16→1024 px). You can generate it from a 1024x1024 PNG.

- Windows application icon: icon.ico
  - Multi-size ICO including: 16, 32, 48, 64, 128, 256 px.
  - Generate from a 1024x1024 PNG to ensure crisp downscales.

Optional (macOS DMG background):
- background.tiff (or PNG ~1440x900)

Notes
- The Electron build configuration points to these files automatically.
- You can replace the files at any time and rebuild.

