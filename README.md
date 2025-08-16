# YouTube to Music Chrome Extension

A cross-platform Chrome extension that downloads YouTube videos as audio files and integrates with your system's music app.

## Features

- Download YouTube videos as high-quality audio (M4A format)
- Cross-platform support (macOS, Windows, Linux)
- Automatic integration with default music app (Apple Music on macOS)
- Real-time download progress tracking
- Color-coded UI status system
- File existence checking to avoid duplicate downloads
- Modern React-based UI with Tailwind CSS
- Direct yt-dlp and ffmpeg execution (no shell script dependency)

## Prerequisites

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - YouTube video downloader
- [ffmpeg](https://ffmpeg.org/) - Audio processing
- Python 3.6+ - For the native messaging host

### Installation of Prerequisites

**macOS (with Homebrew):**
```bash
brew install yt-dlp ffmpeg python
```

**Windows:**
```bash
# Using winget
winget install yt-dlp.yt-dlp
winget install Gyan.FFmpeg
winget install Python.Python.3

# Or using chocolatey
choco install yt-dlp ffmpeg python
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install python3 python3-pip ffmpeg
pip3 install yt-dlp
```

## Setup

1. Clone and build the extension:
   ```bash
   git clone git@github.com:0xF48/ytm.git
   cd ytm
   npm install
   npm run build
   ```

2. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the project directory

3. Set up native messaging:
   - Copy the native messaging host to Chrome's directory:
     ```bash
     # macOS/Linux
     mkdir -p ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/
     cp ytm-host.py ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/
     cp com.ytm.downloader.json ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/
     
     # Windows
     # Copy to %LOCALAPPDATA%\Google\Chrome\User Data\NativeMessagingHosts\
     ```

## Usage

1. Navigate to any YouTube video
2. The extension button will appear in the bottom-left corner
3. Button colors indicate status:
   - **Red**: Missing dependencies (yt-dlp/ffmpeg not found)
   - **Yellow**: Checking if file already exists
   - **Green**: Ready to download
   - **Orange**: Downloading/converting
   - **Blue**: Already downloaded
4. Click to expand the interface and start download
5. Watch real-time progress with detailed logs
6. Files are saved to `~/Music/ytm/` and opened with your default music app

## Color Status System

- 🔴 **Red**: Missing dependencies (shows installation instructions)
- 🟡 **Yellow**: Checking file existence
- 🟢 **Green**: Ready to download  
- 🟠 **Orange**: Actively downloading/converting
- 🔵 **Blue**: File already downloaded

## Development

```bash
# Development mode with auto-rebuild
npm run dev

# Production build
npm run build

# Clean build artifacts
npm run clean
```

## Architecture

- **React + TypeScript**: Modern frontend with type safety
- **Tailwind CSS**: Utility-first styling
- **Chrome Native Messaging**: Secure communication with system
- **Python Host**: Direct yt-dlp/ffmpeg execution
- **Cross-platform**: Automatic OS detection and appropriate music app integration

## Troubleshooting

1. **Extension not loading**: Make sure all dependencies are installed and built
2. **Download fails**: Check that yt-dlp and ffmpeg are in PATH or common locations
3. **Native messaging errors**: Verify the host files are copied to the correct Chrome directory
4. **Permission errors**: Make sure the Python host script is executable
5. **Music app not opening**: Check that your system has a default music app configured

## Example
navigate to "https://www.youtube.com/watch?v=9HuO63khusE&list=OLAK5uy_neG2_ovDao0kWPpgaRiGJol8R8VSMeCzc&index=1" and then click bottom left green button