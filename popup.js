document.addEventListener('DOMContentLoaded', () => {
  const setupBtn = document.getElementById('setupBtn');
  
  setupBtn.addEventListener('click', () => {
    const setupInstructions = `
Setup Instructions:

1. Install the native messaging host:
   cp ~/Documents/ytm/com.ytm.downloader.json ~/Library/Application\\ Support/Google/Chrome/NativeMessagingHosts/

2. Make sure yt-dlp is installed:
   brew install yt-dlp

3. Load the extension in Chrome:
   - Go to chrome://extensions/
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the ~/Documents/ytm folder

4. The extension is ready to use!
`;
    
    alert(setupInstructions);
  });
});