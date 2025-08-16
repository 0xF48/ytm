// Content script for YouTube pages
function createFloatingButton() {
  console.log('Creating floating button...');
  
  const button = document.createElement('button');
  button.id = 'ytm-floating-btn';
  button.textContent = '🎵';
  button.className = 'ytm-floating-button';
  button.title = 'Download this video as audio and add to Apple Music';
  
  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('Button clicked!');
    
    const currentUrl = window.location.href;
    
    // Show loading state
    button.textContent = '⏳';
    button.disabled = true;
    
    // Send message to background script
    chrome.runtime.sendMessage({
      action: 'downloadVideo',
      url: currentUrl
    }, (response) => {
      if (response && response.success) {
        button.textContent = '✅';
        setTimeout(() => {
          button.textContent = '🎵';
          button.disabled = false;
        }, 3000);
      } else {
        button.textContent = '❌';
        console.error('Download failed:', response);
        setTimeout(() => {
          button.textContent = '🎵';
          button.disabled = false;
        }, 3000);
      }
    });
  });
  
  return button;
}

function insertFloatingButton() {
  console.log('Inserting floating button...');
  
  // Remove existing button if present
  const existingButton = document.getElementById('ytm-floating-btn');
  if (existingButton) {
    existingButton.remove();
  }
  
  // Add button to page
  const floatingButton = createFloatingButton();
  document.body.appendChild(floatingButton);
  
  console.log('Button added to page');
}

// Initialize immediately
console.log('Content script loaded');

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', insertFloatingButton);
} else {
  insertFloatingButton();
}