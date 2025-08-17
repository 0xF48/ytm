import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const Popup: React.FC = () => {
  const handleSetupClick = () => {
    const setupInstructions = `
Setup Instructions:

1. Install the native messaging host:
   cp ~/Documents/ytm/com.ytm.downloader.json ~/Library/Application\\ Support/Google/Chrome/NativeMessagingHosts/

2. Make sure yt-dlp is installed:
   brew install yt-dlp

3. The extension is ready to use!
`;
    
    alert(setupInstructions);
  };

  return (
    <div className="w-80 p-6 bg-white">
      <div className="text-center mb-6">
        <h1 className="text-xl font-bold text-blue-600 mb-2">🎵 YouTube to Music</h1>
        <p className="text-sm text-gray-600">Download YouTube videos and SoundCloud tracks to Apple Music</p>
      </div>
      
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <h3 className="font-semibold text-gray-800 mb-3">How to use:</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
          <li>Navigate to any YouTube video or SoundCloud track</li>
          <li>Click the floating 🎵 button (bottom left)</li>
          <li>Watch the progress in the expandable panel</li>
          <li>The song will be added to Apple Music</li>
        </ol>
      </div>
      
      <div className="text-center text-sm text-gray-500 mb-4">
        Extension ready! Visit YouTube or SoundCloud to start downloading.
      </div>
      
      <button 
        onClick={handleSetupClick}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
      >
        Setup Instructions
      </button>
    </div>
  );
};

// Render the popup
const container = document.getElementById('popup-root');
if (container) {
  const root = createRoot(container);
  root.render(<Popup />);
}