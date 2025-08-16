#!/opt/homebrew/bin/python3
"""
Native messaging host for YouTube to Music Chrome extension.
Downloads YouTube videos directly using yt-dlp and ffmpeg.
"""

import json
import sys
import struct
import subprocess
import os
import re
import platform
import shutil
from pathlib import Path

def read_message():
    """Read a message from Chrome extension."""
    try:
        raw_length = sys.stdin.buffer.read(4)
        if len(raw_length) == 0:
            sys.exit(0)
        message_length = struct.unpack('@I', raw_length)[0]
        message = sys.stdin.buffer.read(message_length).decode('utf-8')
        return json.loads(message)
    except Exception as e:
        # For testing without Chrome's binary format
        if sys.stdin.isatty():
            line = sys.stdin.readline()
            return json.loads(line)
        raise e

def send_message(message):
    """Send a message to Chrome extension."""
    encoded_message = json.dumps(message).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('@I', len(encoded_message)))
    sys.stdout.buffer.write(encoded_message)
    sys.stdout.buffer.flush()
    sys.stdout.flush()  # Ensure immediate output

def find_executable(name):
    """Find executable in common locations."""
    # Try which command first
    try:
        result = subprocess.run(['which', name], capture_output=True, text=True)
        if result.returncode == 0:
            return result.stdout.strip()
    except:
        pass
    
    # Common paths for different systems
    common_paths = [
        f'/opt/homebrew/bin/{name}',  # Homebrew on Apple Silicon
        f'/usr/local/bin/{name}',     # Homebrew on Intel Mac
        f'/usr/bin/{name}',           # System binaries
        f'/bin/{name}',               # Basic system binaries
    ]
    
    for path in common_paths:
        if os.path.isfile(path) and os.access(path, os.X_OK):
            return path
    
    # Try shutil.which as fallback
    return shutil.which(name)

def get_music_directory():
    """Get the appropriate music directory for the OS."""
    home = Path.home()
    if platform.system() == 'Darwin':  # macOS
        return home / 'Music' / 'ytm'
    elif platform.system() == 'Windows':
        return home / 'Music' / 'ytm'
    else:  # Linux and others
        return home / 'Music' / 'ytm'

def open_with_music_app(file_path):
    """Open the downloaded file with the appropriate music app."""
    if platform.system() == 'Darwin':  # macOS
        try:
            # Use 'open' command to open with default music app (usually Music.app)
            subprocess.run(['open', file_path], check=True)
            return True, f"Opened with Music app: {file_path}"
        except subprocess.CalledProcessError as e:
            return False, f"Failed to open with Music app: {str(e)}"
    elif platform.system() == 'Windows':
        try:
            # Use start command on Windows
            subprocess.run(['start', '', file_path], shell=True, check=True)
            return True, f"Opened with default music app: {file_path}"
        except subprocess.CalledProcessError as e:
            return False, f"Failed to open with music app: {str(e)}"
    else:  # Linux
        try:
            # Try xdg-open on Linux
            subprocess.run(['xdg-open', file_path], check=True)
            return True, f"Opened with default music app: {file_path}"
        except subprocess.CalledProcessError as e:
            return False, f"Failed to open with music app: {str(e)}"

def download_video(url):
    """Download YouTube video directly using yt-dlp and ffmpeg."""
    try:
        # Find executables
        yt_dlp_path = find_executable('yt-dlp')
        ffmpeg_path = find_executable('ffmpeg')
        
        if not yt_dlp_path:
            return {
                'success': False,
                'message': 'yt-dlp not found. Please install it first.'
            }
        
        if not ffmpeg_path:
            return {
                'success': False,
                'message': 'ffmpeg not found. Please install it first.'
            }
        
        # Create music directory
        music_dir = get_music_directory()
        music_dir.mkdir(parents=True, exist_ok=True)
        
        # Build yt-dlp command
        output_template = str(music_dir / '%(title)s.%(ext)s')
        
        cmd = [
            yt_dlp_path,
            '--no-playlist',
            '--extract-audio',
            '--audio-format', 'm4a',
            '--audio-quality', '0',
            '--embed-metadata',
            '--embed-thumbnail',
            '--ffmpeg-location', ffmpeg_path,
            '--output', output_template,
            url
        ]
        
        send_message({
            'type': 'log',
            'message': f'[INIT] Starting download: {url}'
        })
        
        send_message({
            'type': 'log',
            'message': f'[CMD] {" ".join(cmd)}'
        })
        
        # Execute yt-dlp
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=0,  # Unbuffered
            universal_newlines=True
        )
        
        output_lines = []
        downloaded_file = None
        
        # Read output line by line and send progress updates
        for line in iter(process.stdout.readline, ''):
            if not line:
                break
                
            output_lines.append(line.strip())
            clean_line = line.strip()
            
            # Send ALL lines as logs for debugging
            send_message({
                'type': 'log',
                'message': clean_line
            })
            
            # Send progress updates for download progress
            if '[download]' in clean_line and '%' in clean_line:
                try:
                    # Extract percentage from yt-dlp output
                    percentage_match = re.search(r'(\d+\.?\d*)%', clean_line)
                    if percentage_match:
                        percentage = float(percentage_match.group(1))
                        send_message({
                            'type': 'progress',
                            'percentage': percentage,
                            'message': f'[{percentage:.1f}%] Downloading...'
                        })
                except Exception as e:
                    send_message({
                        'type': 'log',
                        'message': f'[ERROR] Progress parsing failed: {str(e)}'
                    })
            
            # Capture downloaded file path
            if 'Destination:' in clean_line:
                try:
                    dest_match = re.search(r'Destination: (.+\.m4a)', clean_line)
                    if dest_match:
                        downloaded_file = dest_match.group(1)
                except Exception as e:
                    send_message({
                        'type': 'log',
                        'message': f'[ERROR] Failed to parse destination: {str(e)}'
                    })
        
        process.wait()
        full_output = '\n'.join(output_lines)
        
        if process.returncode == 0:
            # Try to find the downloaded file if not captured from output
            if not downloaded_file or not os.path.exists(downloaded_file):
                # Find the most recently created .m4a file in the music directory
                m4a_files = list(music_dir.glob('*.m4a'))
                if m4a_files:
                    downloaded_file = str(max(m4a_files, key=os.path.getmtime))
            
            # Open with music app if file exists
            if downloaded_file and os.path.exists(downloaded_file):
                success, message = open_with_music_app(downloaded_file)
                send_message({
                    'type': 'log',
                    'message': f'[MUSIC] {message}'
                })
            
            return {
                'success': True,
                'message': 'Download completed successfully',
                'output': full_output,
                'file_path': downloaded_file
            }
        else:
            return {
                'success': False,
                'message': f'Download failed (exit code {process.returncode})',
                'output': full_output
            }
            
    except Exception as e:
        return {
            'success': False,
            'message': f'Error downloading video: {str(e)}'
        }

def open_folder(path):
    """Open a folder in Finder."""
    try:
        subprocess.run(['open', path], check=True)
        return {
            'success': True,
            'message': f'Opened folder: {path}'
        }
    except subprocess.CalledProcessError as e:
        return {
            'success': False,
            'message': f'Failed to open folder: {str(e)}'
        }
    except Exception as e:
        return {
            'success': False,
            'message': f'Error opening folder: {str(e)}'
        }

def check_file_exists(video_title):
    """Check if a file with the given video title exists in the music directory."""
    try:
        music_dir = get_music_directory()
        
        # Clean the video title to match how yt-dlp would save it
        # Remove or replace characters that would be problematic in filenames
        safe_title = re.sub(r'[<>:"/\\|?*]', '_', video_title)
        safe_title = safe_title.strip()
        
        # Check for .m4a file with the title
        target_file = music_dir / f'{safe_title}.m4a'
        
        if target_file.exists():
            return {
                'success': True,
                'exists': True,
                'message': f'File exists: {target_file}'
            }
        
        # Also check for similar files (in case title has slight differences)
        if music_dir.exists():
            for file_path in music_dir.glob('*.m4a'):
                # Remove extension and compare (case insensitive)
                file_title = file_path.stem
                if file_title.lower() == safe_title.lower():
                    return {
                        'success': True,
                        'exists': True,
                        'message': f'File exists: {file_path}'
                    }
        
        return {
            'success': True,
            'exists': False,
            'message': 'File does not exist'
        }
        
    except Exception as e:
        return {
            'success': False,
            'exists': False,
            'message': f'Error checking file: {str(e)}'
        }

def check_dependencies():
    """Check if yt-dlp and ffmpeg are available."""
    try:
        yt_dlp_path = find_executable('yt-dlp')
        ffmpeg_path = find_executable('ffmpeg')
        
        missing = []
        if not yt_dlp_path:
            missing.append('yt-dlp')
        if not ffmpeg_path:
            missing.append('ffmpeg')
        
        if missing:
            # Generate installation instructions based on OS
            os_name = platform.system()
            if os_name == 'Darwin':  # macOS
                install_cmd = f"brew install {' '.join(missing)}"
            elif os_name == 'Windows':
                install_cmd = f"winget install yt-dlp.yt-dlp Gyan.FFmpeg"
            else:  # Linux
                if 'yt-dlp' in missing and 'ffmpeg' in missing:
                    install_cmd = "sudo apt install python3-pip ffmpeg && pip3 install yt-dlp"
                elif 'yt-dlp' in missing:
                    install_cmd = "pip3 install yt-dlp"
                else:
                    install_cmd = "sudo apt install ffmpeg"
            
            return {
                'success': False,
                'missing': missing,
                'install_command': install_cmd,
                'message': f'Missing dependencies: {", ".join(missing)}'
            }
        
        return {
            'success': True,
            'yt_dlp_path': yt_dlp_path,
            'ffmpeg_path': ffmpeg_path,
            'message': 'All dependencies found'
        }
        
    except Exception as e:
        return {
            'success': False,
            'missing': ['unknown'],
            'message': f'Error checking dependencies: {str(e)}'
        }

def main():
    """Main message loop."""
    try:
        message = read_message()
        
        if message.get('command') == 'download':
            url = message.get('url')
            if url:
                response = download_video(url)
                send_message(response)
            else:
                send_message({
                    'success': False,
                    'message': 'No URL provided'
                })
        elif message.get('command') == 'openFolder':
            path = message.get('path')
            if path == 'music_directory':
                # Use the cross-platform music directory
                music_dir = get_music_directory()
                response = open_folder(str(music_dir))
                send_message(response)
            elif path:
                response = open_folder(path)
                send_message(response)
            else:
                send_message({
                    'success': False,
                    'message': 'No path provided'
                })
        elif message.get('command') == 'checkExists':
            video_title = message.get('videoTitle')
            if video_title:
                response = check_file_exists(video_title)
                send_message(response)
            else:
                send_message({
                    'success': False,
                    'exists': False,
                    'message': 'No video title provided'
                })
        elif message.get('command') == 'checkDependencies':
            response = check_dependencies()
            send_message(response)
        else:
            send_message({
                'success': False,
                'message': 'Unknown command'
            })
            
    except Exception as e:
        send_message({
            'success': False,
            'message': f'Host error: {str(e)}'
        })

if __name__ == '__main__':
    main()