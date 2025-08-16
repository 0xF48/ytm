// Background script for handling native messaging
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background script received message:', request);
  
  if (request.action === 'downloadVideo') {
    console.log('Attempting to connect to native host...');
    
    try {
      // Send message to native host
      const port = chrome.runtime.connectNative('com.ytm.downloader');
      console.log('Connected to native host');
      
      port.postMessage({
        command: 'download',
        url: request.url
      });
      console.log('Message sent to native host:', request.url);
      
      port.onMessage.addListener((response) => {
        console.log('Native host response:', response);
        
        // Forward progress and log messages to content script
        if (response.type === 'progress' || response.type === 'log') {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
              chrome.tabs.sendMessage(tabs[0].id, response);
            }
          });
        } else {
          // Final response
          sendResponse({
            success: response.success,
            message: response.message,
            output: response.output
          });
        }
      });
      
      port.onDisconnect.addListener(() => {
        if (chrome.runtime.lastError) {
          console.error('Native host disconnect error:', chrome.runtime.lastError);
          sendResponse({
            success: false,
            message: `Failed to connect to native host: ${chrome.runtime.lastError.message}`
          });
        }
      });
      
    } catch (error) {
      console.error('Error connecting to native host:', error);
      sendResponse({
        success: false,
        message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
    
    // Return true to indicate we'll send response asynchronously
    return true;
  }
  
  if (request.action === 'openFolder') {
    console.log('Opening folder:', request.path);
    
    try {
      // Send message to native host to open folder
      const port = chrome.runtime.connectNative('com.ytm.downloader');
      
      port.postMessage({
        command: 'openFolder',
        path: request.path
      });
      
      port.onMessage.addListener((response) => {
        console.log('Open folder response:', response);
        sendResponse({
          success: response.success || true,
          message: response.message || 'Folder opened'
        });
      });
      
      port.onDisconnect.addListener(() => {
        if (chrome.runtime.lastError) {
          console.error('Native host disconnect error:', chrome.runtime.lastError);
        }
      });
      
    } catch (error) {
      console.error('Error opening folder:', error);
      sendResponse({
        success: false,
        message: `Error opening folder: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
    
    // Return true to indicate we'll send response asynchronously
    return true;
  }
  
  if (request.action === 'checkFileExists') {
    console.log('Checking if file exists for:', request.videoTitle);
    
    try {
      // Send message to native host to check if file exists
      const port = chrome.runtime.connectNative('com.ytm.downloader');
      
      port.postMessage({
        command: 'checkExists',
        videoTitle: request.videoTitle,
        url: request.url
      });
      
      port.onMessage.addListener((response) => {
        console.log('Check exists response:', response);
        sendResponse({
          success: response.success || true,
          exists: response.exists || false,
          message: response.message || 'Check completed'
        });
      });
      
      port.onDisconnect.addListener(() => {
        if (chrome.runtime.lastError) {
          console.error('Native host disconnect error:', chrome.runtime.lastError);
          sendResponse({
            success: false,
            exists: false,
            message: 'Failed to connect to native host'
          });
        }
      });
      
    } catch (error) {
      console.error('Error checking file exists:', error);
      sendResponse({
        success: false,
        exists: false,
        message: `Error checking file: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
    
    // Return true to indicate we'll send response asynchronously
    return true;
  }
  
  if (request.action === 'checkDependencies') {
    console.log('Checking dependencies...');
    
    try {
      const port = chrome.runtime.connectNative('com.ytm.downloader');
      
      port.postMessage({
        command: 'checkDependencies'
      });
      
      port.onMessage.addListener((response) => {
        console.log('Check dependencies response:', response);
        sendResponse({
          success: response.success || false,
          missing: response.missing || [],
          install_command: response.install_command || '',
          message: response.message || 'Check completed'
        });
      });
      
      port.onDisconnect.addListener(() => {
        if (chrome.runtime.lastError) {
          console.error('Native host disconnect error:', chrome.runtime.lastError);
          sendResponse({
            success: false,
            missing: ['yt-dlp', 'ffmpeg'],
            message: 'Failed to connect to native host'
          });
        }
      });
      
    } catch (error) {
      console.error('Error checking dependencies:', error);
      sendResponse({
        success: false,
        missing: ['yt-dlp', 'ffmpeg'],
        message: `Error checking dependencies: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
    
    // Return true to indicate we'll send response asynchronously
    return true;
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  if (tab.url && (tab.url.includes('youtube.com') || tab.url.includes('youtu.be'))) {
    // Inject content script if not already present
    chrome.scripting.executeScript({
      target: { tabId: tab.id! },
      files: ['dist/content.js']
    });
  }
});