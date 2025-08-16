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
        sendResponse({
          success: response.success,
          message: response.message
        });
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
        message: `Connection error: ${error.message}`
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
      target: { tabId: tab.id },
      files: ['content.js']
    });
  }
});