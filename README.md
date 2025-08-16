# YouTube to Music Chrome Extension

A Chrome extension that downloads YouTube videos as audio files and automatically adds them to Apple Music using the `ytm` shell function.

## Features

- 🎵 One-click download from YouTube video pages
- 🍎 Automatic import to Apple Music
- 🎨 Clean, integrated UI button on YouTube
- ⚡ Uses native messaging for shell script execution

## Setup Instructions

### 1. Install the Native Messaging Host

Copy the native messaging host configuration to Chrome's directory:

```bash
mkdir -p ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/
cp ~/Documents/ytm/com.ytm.downloader.json ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/
```

### 2. Install Dependencies

Make sure you have `yt-dlp` installed:

```bash
brew install yt-dlp
```

### 3. Load the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `~/Documents/ytm` folder
5. The extension should now be loaded

### 4. Usage

1. Navigate to any YouTube video
2. Look for the "🎵 Download to Music" button next to the like/dislike buttons
3. Click the button to download the video as audio
4. The file will be automatically added to Apple Music

## Files

- `manifest.json` - Extension configuration
- `content.js` - Content script that adds UI to YouTube pages
- `background.js` - Background script for native messaging
- `ytm-host.py` - Native messaging host that executes the ytm shell function
- `popup.html/js` - Extension popup with instructions
- `styles.css` - Styling for the download button

## Troubleshooting

1. **Button not appearing**: Refresh the YouTube page after loading the extension
2. **Download fails**: Check that the `ytm` function works in your terminal
3. **Permission errors**: Make sure the native host script is executable (`chmod +x ytm-host.py`)
4. **Native messaging errors**: Verify the host configuration is in the correct Chrome directory

## Security Note

This extension uses native messaging to execute shell commands. Only install from trusted sources and review the code before use.