#!/opt/homebrew/bin/python3
"""
Native messaging host for YouTube to Music Chrome extension.
Executes the ytm shell function to download videos.
"""

import json
import sys
import struct
import subprocess
import os
import re

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

def execute_ytm(url):
    """Execute the ytm shell function with the given URL."""
    try:
        # Source .zshrc and execute ytm function
        cmd = f'source ~/.zshrc && ytm "{url}"'
        process = subprocess.Popen(
            cmd,
            shell=True,
            executable='/bin/zsh',
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=0,  # Unbuffered
            universal_newlines=True
        )
        
        output_lines = []
        
        # Read output line by line and send progress updates
        for line in iter(process.stdout.readline, ''):
            if not line:
                break
                
            output_lines.append(line.strip())
            clean_line = line.strip()
            
            # Send ALL lines as logs for debugging
            send_message({
                'type': 'log',
                'message': f'[DEBUG] {clean_line}'
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
        
        process.wait()
        full_output = '\n'.join(output_lines)
        
        if process.returncode == 0:
            return {
                'success': True,
                'message': 'Download completed successfully',
                'output': full_output
            }
        else:
            return {
                'success': False,
                'message': f'Download failed (exit code {process.returncode})',
                'output': full_output
            }
            
    except subprocess.TimeoutExpired:
        return {
            'success': False,
            'message': 'Download timed out after 5 minutes'
        }
    except Exception as e:
        return {
            'success': False,
            'message': f'Error executing ytm: {str(e)}'
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
    """Check if a file with the given video title exists in ~/Music/ytm/."""
    try:
        music_dir = os.path.expanduser('~/Music/ytm')
        
        # Clean the video title to match how yt-dlp would save it
        # Remove or replace characters that would be problematic in filenames
        safe_title = re.sub(r'[<>:"/\\|?*]', '_', video_title)
        safe_title = safe_title.strip()
        
        # Check for .m4a file with the title
        target_file = os.path.join(music_dir, f'{safe_title}.m4a')
        
        if os.path.exists(target_file):
            return {
                'success': True,
                'exists': True,
                'message': f'File exists: {target_file}'
            }
        
        # Also check for similar files (in case title has slight differences)
        if os.path.exists(music_dir):
            for filename in os.listdir(music_dir):
                if filename.endswith('.m4a'):
                    # Remove extension and compare (case insensitive)
                    file_title = filename[:-4]
                    if file_title.lower() == safe_title.lower():
                        return {
                            'success': True,
                            'exists': True,
                            'message': f'File exists: {os.path.join(music_dir, filename)}'
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

def main():
    """Main message loop."""
    try:
        message = read_message()
        
        if message.get('command') == 'download':
            url = message.get('url')
            if url:
                # Send initial acknowledgment
                send_message({
                    'type': 'log',
                    'message': f'[INIT] Starting download for {url}'
                })
                
                response = execute_ytm(url)
                send_message(response)
            else:
                send_message({
                    'success': False,
                    'message': 'No URL provided'
                })
        elif message.get('command') == 'openFolder':
            path = message.get('path')
            if path:
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