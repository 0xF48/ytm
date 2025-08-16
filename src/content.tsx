import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Download, X, Music, FolderOpen, Play, CheckCircle, AlertCircle } from 'lucide-react';
import './styles.css';

interface LogEntry {
  timestamp: Date;
  level: 'info' | 'success' | 'error' | 'progress' | 'extraction' | 'conversion';
  message: string;
}

interface DownloadStatus {
  songName: string;
  status: 'downloading' | 'extracting' | 'converting' | 'complete' | 'error';
  filePath: string;
}

const YouTubeDownloadButton: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState(0);
  const [isAlreadyDownloaded, setIsAlreadyDownloaded] = useState(false);
  const [isCheckingFile, setIsCheckingFile] = useState(true);
  const [hasMissingDependencies, setHasMissingDependencies] = useState(false);
  const [missingDeps, setMissingDeps] = useState<string[]>([]);
  const [installCommand, setInstallCommand] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>({
    songName: '',
    status: 'downloading',
    filePath: ''
  });
  const logsContainerRef = useRef<HTMLDivElement>(null);

  const addLog = (level: LogEntry['level'], message: string) => {
    setLogs(prev => [...prev, {
      timestamp: new Date(),
      level,
      message
    }]);
  };

  // Auto-scroll logs to bottom when new logs are added
  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Track URL changes and reset state when navigating to new videos
  useEffect(() => {
    let currentUrl = window.location.href;
    
    const checkUrlChange = () => {
      const newUrl = window.location.href;
      if (newUrl !== currentUrl) {
        currentUrl = newUrl;
        // Reset all state when URL changes
        setIsExpanded(false);
        setIsDownloading(false);
        setLogs([]);
        setProgress(0);
        setIsAlreadyDownloaded(false);
        setIsCheckingFile(true);
        setHasMissingDependencies(false);
        setMissingDeps([]);
        setInstallCommand('');
        setVideoTitle('');
        setDownloadStatus({
          songName: '',
          status: 'downloading',
          filePath: ''
        });
        
        // Check new video info after a brief delay to let YouTube load
        setTimeout(checkIfDownloaded, 1000);
      }
    };

    const checkDependencies = async () => {
      try {
        const response = await new Promise<{success: boolean, missing: string[], install_command: string}>((resolve) => {
          chrome.runtime.sendMessage({
            action: 'checkDependencies'
          }, resolve);
        });

        if (response && !response.success && response.missing && response.missing.length > 0) {
          setHasMissingDependencies(true);
          setMissingDeps(response.missing);
          setInstallCommand(response.install_command || '');
          console.log('YTM Extension: Missing dependencies:', response.missing);
          return false;
        } else {
          setHasMissingDependencies(false);
          setMissingDeps([]);
          setInstallCommand('');
          console.log('YTM Extension: All dependencies found');
          return true;
        }
      } catch (error) {
        console.error('YTM Extension: Error checking dependencies:', error);
        setHasMissingDependencies(true);
        setMissingDeps(['yt-dlp', 'ffmpeg']);
        setInstallCommand('');
        return false;
      }
    };

    const checkIfDownloaded = async () => {
      setIsCheckingFile(true);
      
      // First check dependencies
      const depsOk = await checkDependencies();
      if (!depsOk) {
        setIsCheckingFile(false);
        return;
      }
      
      // Get video title from YouTube page with multiple selector attempts
      let titleElement = document.querySelector('h1.ytd-video-primary-info-renderer yt-formatted-string') ||
                        document.querySelector('h1.ytd-watch-metadata yt-formatted-string') ||
                        document.querySelector('h1[data-title]') ||
                        document.querySelector('h1 yt-formatted-string') ||
                        document.querySelector('.ytd-video-primary-info-renderer h1') ||
                        document.querySelector('.ytd-watch-metadata h1') ||
                        document.querySelector('#title h1') ||
                        document.querySelector('ytd-video-primary-info-renderer h1') ||
                        document.querySelector('ytd-watch-metadata h1');
      
      console.log('YTM Extension: Looking for title element...', {
        found: !!titleElement,
        url: window.location.href,
        pathname: window.location.pathname
      });
      
      if (titleElement) {
        const title = titleElement.textContent?.trim() || '';
        console.log('YTM Extension: Found title:', title);
        setVideoTitle(title);
        
        if (title) {
          // Check if file already exists by querying the native host
          try {
            const response = await new Promise<{success: boolean, exists: boolean}>((resolve) => {
              chrome.runtime.sendMessage({
                action: 'checkFileExists',
                videoTitle: title,
                url: window.location.href
              }, resolve);
            });

            if (response && response.success) {
              setIsAlreadyDownloaded(response.exists);
              console.log('YTM Extension: File exists check result:', response.exists);
            } else {
              setIsAlreadyDownloaded(false);
              console.log('YTM Extension: File exists check failed:', response);
            }
          } catch (error) {
            console.error('YTM Extension: Error checking if file exists:', error);
            setIsAlreadyDownloaded(false);
          }
        }
      } else {
        console.log('YTM Extension: No title element found, retrying in 2 seconds...');
        // Retry after a longer delay if title not found
        setTimeout(checkIfDownloaded, 2000);
        return;
      }
      
      setIsCheckingFile(false);
    };
    
    // Initial check
    checkIfDownloaded();
    
    // Watch for URL changes
    const observer = new MutationObserver(checkUrlChange);
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Also listen to popstate events (back/forward navigation)
    window.addEventListener('popstate', checkUrlChange);
    
    // Cleanup
    return () => {
      observer.disconnect();
      window.removeEventListener('popstate', checkUrlChange);
    };
  }, []);

  // Listen for progress updates from background script
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.type === 'progress') {
        setProgress(message.percentage);
        setDownloadStatus(prev => ({ ...prev, status: 'downloading' }));
        addLog('progress', `${message.percentage}% - ${message.message}`);
      } else if (message.type === 'log') {
        const msg = message.message;
        
        // Extract song name from yt-dlp output
        if (msg.includes('[youtube]') && msg.includes('Extracting URL')) {
          setDownloadStatus(prev => ({ ...prev, status: 'downloading' }));
        }
        
        // Detect extraction phase
        if (msg.includes('[ExtractAudio]') || msg.includes('Destination:')) {
          setDownloadStatus(prev => ({ ...prev, status: 'extracting' }));
          if (msg.includes('Destination:')) {
            const pathMatch = msg.match(/Destination: (.+\.m4a)/);
            if (pathMatch) {
              const fullPath = pathMatch[1];
              const fileName = fullPath.split('/').pop()?.replace('.m4a', '') || '';
              setDownloadStatus(prev => ({ 
                ...prev, 
                songName: fileName,
                filePath: fullPath 
              }));
            }
          }
        }
        
        // Detect conversion/metadata phase
        if (msg.includes('[Metadata]') || msg.includes('[ThumbnailsConvertor]') || msg.includes('[EmbedThumbnail]')) {
          setDownloadStatus(prev => ({ ...prev, status: 'converting' }));
        }
        
        addLog('info', message.message);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  const handleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const handleStartDownload = async () => {
    setIsDownloading(true);
    setLogs([]);
    setProgress(0);
    setDownloadStatus({
      songName: '',
      status: 'downloading',
      filePath: ''
    });
    
    const currentUrl = window.location.href;
    addLog('info', `[START] ${currentUrl}`);
    
    try {
      const response = await new Promise<{success: boolean, message: string}>((resolve) => {
        chrome.runtime.sendMessage({
          action: 'downloadVideo',
          url: currentUrl
        }, resolve);
      });

      if (response.success) {
        setProgress(100);
        setIsAlreadyDownloaded(true);
        setDownloadStatus(prev => ({ ...prev, status: 'complete' }));
        addLog('success', '[COMPLETE] Download finished');
        addLog('success', '[MUSIC] Opened with Apple Music');
      } else {
        setDownloadStatus(prev => ({ ...prev, status: 'error' }));
        addLog('error', `[FAILED] ${response.message}`);
      }
    } catch (error) {
      setDownloadStatus(prev => ({ ...prev, status: 'error' }));
      addLog('error', `[ERROR] ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleOpenFolder = () => {
    chrome.runtime.sendMessage({
      action: 'openFolder',
      path: 'music_directory'  // Will be resolved by the native host
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const getStatusIcon = () => {
    switch (downloadStatus.status) {
      case 'downloading': return <Download className="w-4 h-4" />;
      case 'extracting': return <Play className="w-4 h-4" />;
      case 'converting': return <Music className="w-4 h-4" />;
      case 'complete': return <CheckCircle className="w-4 h-4" />;
      case 'error': return <AlertCircle className="w-4 h-4" />;
      default: return <Download className="w-4 h-4" />;
    }
  };

  const getStatusText = () => {
    switch (downloadStatus.status) {
      case 'downloading': return 'DOWNLOADING';
      case 'extracting': return 'EXTRACTING AUDIO';
      case 'converting': return 'ADDING METADATA';
      case 'complete': return 'COMPLETE';
      case 'error': return 'ERROR';
      default: return 'READY';
    }
  };

  return (
    <div className="fixed bottom-5 left-5 z-[99999]" style={{ fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace' }}>
      {/* Main Button */}
      <button
        onClick={handleExpand}
        disabled={isDownloading || isCheckingFile}
        className={`
          w-16 h-16 transition-all duration-200 flex items-center justify-center text-xl
          ${isDownloading 
            ? 'bg-orange-600 cursor-not-allowed' 
            : hasMissingDependencies
            ? 'bg-red-700 hover:bg-red-600'
            : isCheckingFile
            ? 'bg-yellow-700 hover:bg-yellow-600'
            : isAlreadyDownloaded
            ? 'bg-blue-700 hover:bg-blue-600'
            : 'bg-green-700 hover:bg-green-600'
          }
          text-white border-2 
          ${isDownloading ? 'border-orange-400' : hasMissingDependencies ? 'border-red-400' : isCheckingFile ? 'border-yellow-400' : isAlreadyDownloaded ? 'border-blue-400' : 'border-green-400'} 
          rounded-sm
        `}
        title={isExpanded ? "CLOSE" : isDownloading ? "DOWNLOADING..." : hasMissingDependencies ? "MISSING DEPENDENCIES" : isCheckingFile ? "CHECKING..." : isAlreadyDownloaded ? "DOWNLOADED" : "DOWNLOAD"}
      >
        {isDownloading ? <Download className="w-6 h-6 animate-pulse" /> : 
         isExpanded ? <X className="w-6 h-6" /> : 
         hasMissingDependencies ? <AlertCircle className="w-6 h-6" /> :
         isCheckingFile ? <Music className="w-6 h-6 animate-pulse" /> :
         isAlreadyDownloaded ? <CheckCircle className="w-6 h-6" /> :
         <Music className="w-6 h-6" />}
      </button>

      {/* Expandable Panel */}
      {isExpanded && (
        <div className={`absolute bottom-20 left-0 w-[700px] border-2 rounded-sm text-xl
          ${isDownloading
            ? 'bg-orange-900 border-orange-400'
            : hasMissingDependencies
            ? 'bg-red-900 border-red-400'
            : isCheckingFile 
            ? 'bg-yellow-900 border-yellow-400' 
            : isAlreadyDownloaded 
            ? 'bg-blue-900 border-blue-400' 
            : 'bg-green-900 border-green-400'
          }`}>
          {/* Header */}
          <div className={`p-5 border-b
            ${isDownloading
              ? 'bg-orange-800 text-orange-100 border-orange-400'
              : hasMissingDependencies
              ? 'bg-red-800 text-red-100 border-red-400'
              : isCheckingFile 
              ? 'bg-yellow-800 text-yellow-100 border-yellow-400' 
              : isAlreadyDownloaded 
              ? 'bg-blue-800 text-blue-100 border-blue-400' 
              : 'bg-green-800 text-green-100 border-green-400'
            }`}>
            <div className="text-2xl font-bold flex items-center gap-3">
              <Music className="w-7 h-7" />
              YOUTUBE-TO-MUSIC
            </div>
            <div className="text-lg opacity-90 mt-1">
              {isDownloading ? 'DOWNLOADING...' : hasMissingDependencies ? 'MISSING DEPENDENCIES' : isCheckingFile ? 'CHECKING FILE STATUS...' : isAlreadyDownloaded ? 'ALREADY DOWNLOADED' : 'READY TO DOWNLOAD'}
            </div>
          </div>

          {/* Video Info / Dependencies Info */}
          <div className={`p-5 border-b
            ${isDownloading
              ? 'border-orange-400 bg-orange-800'
              : hasMissingDependencies
              ? 'border-red-400 bg-red-800'
              : isCheckingFile 
              ? 'border-yellow-400 bg-yellow-800' 
              : isAlreadyDownloaded 
              ? 'border-blue-400 bg-blue-800' 
              : 'border-green-400 bg-green-800'
            }`}>
            {hasMissingDependencies ? (
              <div className="text-red-100">
                <div className="flex items-center gap-4 mb-4">
                  <AlertCircle className="w-7 h-7 text-red-400" />
                  <div className="flex-1">
                    <div className="text-lg font-semibold">
                      Missing Dependencies
                    </div>
                    <div className="text-base opacity-75 mt-1">
                      {missingDeps.join(', ')} not found
                    </div>
                  </div>
                </div>
                <div className="bg-red-700 p-4 rounded border border-red-500">
                  <div className="text-lg font-semibold mb-2">Installation Required:</div>
                  <div className="text-base font-mono bg-red-900 p-3 rounded border border-red-600">
                    {installCommand || `Please install: ${missingDeps.join(', ')}`}
                  </div>
                  <div className="text-sm opacity-75 mt-2">
                    Run the command above in your terminal, then reload this page.
                  </div>
                </div>
              </div>
            ) : (
              <div className={`flex items-center gap-4
                ${isDownloading
                  ? 'text-orange-100'
                  : isCheckingFile 
                  ? 'text-yellow-100' 
                  : isAlreadyDownloaded 
                  ? 'text-blue-100' 
                  : 'text-green-100'
                }`}>
                {isCheckingFile ? <Music className="w-7 h-7 animate-pulse" /> :
                 isAlreadyDownloaded ? <CheckCircle className="w-7 h-7 text-blue-400" /> : 
                 <Music className="w-7 h-7" />}
                <div className="flex-1">
                  <div className="text-lg font-semibold">
                    {isCheckingFile ? 'Checking file status...' : videoTitle || 'Loading video info...'}
                  </div>
                  <div className="text-base opacity-75 mt-1">
                    Music/ytm/
                  </div>
                </div>
                {isCheckingFile ? null :
                 isAlreadyDownloaded ? (
                  <button
                    onClick={handleOpenFolder}
                    className="px-5 py-3 bg-blue-700 hover:bg-blue-600 rounded border border-blue-400 transition-colors flex items-center gap-2 text-base font-semibold"
                    title="Open folder"
                  >
                    <FolderOpen className="w-5 h-5" />
                    OPEN FOLDER
                  </button>
                ) : (
                  <button
                    onClick={handleStartDownload}
                    disabled={isDownloading || hasMissingDependencies}
                    className="px-5 py-3 bg-green-700 hover:bg-green-600 disabled:bg-gray-600 rounded border border-green-400 transition-colors flex items-center gap-2 text-base font-semibold"
                    title="Start download"
                  >
                    <Download className="w-5 h-5" />
                    START DOWNLOAD
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Song Info & Status - Only when downloading */}
          {(downloadStatus.songName && isDownloading) && (
            <div className="p-5 border-b border-orange-400 bg-orange-800">
              <div className="flex items-center gap-4 text-orange-100">
                {getStatusIcon()}
                <div className="flex-1">
                  <div className="text-lg font-semibold">
                    {downloadStatus.songName}
                  </div>
                  <div className="text-base opacity-75 mt-1">
                    Extracting audio...
                  </div>
                </div>
                <div className="text-base font-bold text-orange-300">
                  {getStatusText()}
                </div>
              </div>
            </div>
          )}

          {/* Progress Bar */}
          {isDownloading && (
            <div className="p-5 border-b border-orange-400 bg-orange-800">
              <div className="w-full bg-orange-700 h-3 mb-4 rounded">
                <div 
                  className="bg-orange-300 h-3 rounded transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-orange-100 text-lg font-semibold">
                [{progress.toFixed(1)}%] {getStatusText()}
              </div>
            </div>
          )}

          {/* Logs - Only when downloading or if there are logs */}
          {(isDownloading || logs.length > 0) && (
            <div 
              ref={logsContainerRef}
              className="p-5 max-h-80 overflow-y-auto text-lg scroll-smooth"
            >
              {logs.length === 0 ? (
                <div className="text-green-400">WAITING FOR LOGS...</div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log, index) => (
                    <div key={index} className="text-green-100">
                      <span className="text-green-400 text-base">
                        {formatTime(log.timestamp)}
                      </span>
                      <span className="ml-4">
                        {log.message}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className={`px-5 py-4 border-t text-base
            ${isDownloading
              ? 'bg-orange-800 text-orange-300 border-orange-400'
              : hasMissingDependencies
              ? 'bg-red-800 text-red-300 border-red-400'
              : isCheckingFile 
              ? 'bg-yellow-800 text-yellow-300 border-yellow-400' 
              : isAlreadyDownloaded 
              ? 'bg-blue-800 text-blue-300 border-blue-400' 
              : 'bg-green-800 text-green-300 border-green-400'
            }`}>
            {isDownloading ?
              'DOWNLOADING AND CONVERTING AUDIO...' :
              hasMissingDependencies ?
              'INSTALL DEPENDENCIES TO CONTINUE' :
              isCheckingFile ? 
              'CHECKING IF FILE EXISTS...' :
              isAlreadyDownloaded ? 
              'CLICK BUTTON TO CLOSE • FILE AVAILABLE IN MUSIC/YTM' :
              'CLICK BUTTON TO CLOSE • FILES SAVED TO MUSIC/YTM'
            }
          </div>
        </div>
      )}
    </div>
  );
};

// Inject the component into YouTube pages
function injectDownloadButton() {
  // Remove existing button if present
  const existingContainer = document.getElementById('ytm-download-container');
  if (existingContainer) {
    existingContainer.remove();
  }

  // Only show on video pages
  if (window.location.pathname === '/watch') {
    const container = document.createElement('div');
    container.id = 'ytm-download-container';
    document.body.appendChild(container);

    const root = createRoot(container);
    root.render(<YouTubeDownloadButton />);
  }
}

// Handle YouTube's SPA navigation more robustly
let currentUrl = window.location.href;
let injectionTimeout: NodeJS.Timeout | null = null;

const handleNavigation = () => {
  const newUrl = window.location.href;
  if (newUrl !== currentUrl) {
    currentUrl = newUrl;
    
    // Clear any pending injection
    if (injectionTimeout) {
      clearTimeout(injectionTimeout);
    }
    
    // Inject after YouTube has had time to update the page
    injectionTimeout = setTimeout(() => {
      injectDownloadButton();
    }, 1000);
  }
};

// Watch for navigation changes
const navigationObserver = new MutationObserver(handleNavigation);
navigationObserver.observe(document.body, {
  childList: true,
  subtree: true
});

// Also listen to browser navigation events
window.addEventListener('popstate', handleNavigation);
window.addEventListener('pushstate', handleNavigation);
window.addEventListener('replacestate', handleNavigation);

// Override pushState and replaceState to catch programmatic navigation
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function(...args) {
  originalPushState.apply(history, args);
  setTimeout(handleNavigation, 100);
};

history.replaceState = function(...args) {
  originalReplaceState.apply(history, args);
  setTimeout(handleNavigation, 100);
};

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectDownloadButton);
} else {
  injectDownloadButton();
}