import os
import pandas as pd
import matplotlib.pyplot as plt
from http.server import BaseHTTPRequestHandler, HTTPServer
import cgi
import numpy as np
import json
import shutil
from matplotlib.animation import FuncAnimation
 
# Configuration
UPLOAD_FOLDER = 'uploads'
ANIMATION_FOLDER = 'animations'
HTML_FOLDER = '.'  # The current directory, assuming animal.html is in the same folder
PORT = 8000
 
# Ensure the upload and animation directories exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(ANIMATION_FOLDER, exist_ok=True)
 
# Custom HTTP handler class to handle file uploads and serve files
class MyHTTPRequestHandler(BaseHTTPRequestHandler):
 
    def do_GET(self):
        # Serve the main page or favicon
        if self.path == '/':
            self.path = '/animal.html'
        elif self.path == '/favicon.ico':
            self.send_response(204)  # No Content for favicon
            self.end_headers()
            return
       
        # Check if the path starts with /frames/
        if self.path.startswith('/frames/'):
            # Adjust the path to point to the frames directory
            file_path = '.' + self.path  # Use the current directory
        else:
            # For all other requests (including animal.html)
            file_path = HTML_FOLDER + self.path  # Serve from the HTML folder
 
        print(f"Requested path: {file_path}")  # Log the requested path
       
        try:
            # Check if the requested file exists
            if os.path.exists(file_path):
                # Serve the requested file
                self.send_response(200)
                if file_path.endswith('.html'):
                    self.send_header('Content-type', 'text/html')
                elif file_path.endswith('.css'):
                    self.send_header('Content-type', 'text/css')
                elif file_path.endswith('.js'):
                    self.send_header('Content-type', 'application/javascript')
                elif file_path.endswith('.png'):  # Ensure PNG files are served correctly
                    self.send_header('Content-type', 'image/png')
                self.end_headers()
               
                with open(file_path, 'rb') as file:
                    self.wfile.write(file.read())
            else:
                self.send_error(404, 'File Not Found: %s' % self.path)
        except Exception as e:
            self.send_error(500, 'Internal Server Error: %s' % str(e))
 
    def do_POST(self):
        if self.path == '/upload':
            # Handle CSV file upload
            ctype, pdict = cgi.parse_header(self.headers['Content-Type'])
            if ctype == 'multipart/form-data':
                print("Receiving file upload request...")
               
                # Parse the uploaded file
                form = cgi.FieldStorage(fp=self.rfile, headers=self.headers, environ={'REQUEST_METHOD': 'POST'})
                csv_file = form['csvFile']
                if csv_file.filename:
                    print(f"CSV file '{csv_file.filename}' received.")
                    file_path = os.path.join(UPLOAD_FOLDER, csv_file.filename)
                    with open(file_path, 'wb') as output_file:
                        output_file.write(csv_file.file.read())
                    print(f"CSV file saved to '{file_path}'.")
 
                    # Process the CSV and generate animation frames as PNGs
                    print("Starting CSV processing and animation generation...")
                    animation_file_paths = create_frames(file_path)
 
                    # Return the animation file paths as a JSON response
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    response = {'success': True, 'animationFiles': animation_file_paths}
                    self.wfile.write(bytes(json.dumps(response), "utf-8"))
                    print("JSON response with animation file paths sent to client.")
                else:
                    self.send_error(400, "No file uploaded")
 
# Utility function to clear a directory if it exists.
def clear_directory(dir_path):
    if os.path.exists(dir_path):
        shutil.rmtree(dir_path)  # Remove the entire directory and its contents
    os.makedirs(dir_path)  # Recreate the directory
 
def create_frames(csv_path, columns_to_display=['Pressure']):
    # Clear or create 'frames' directory
    clear_directory('frames')
 
    # Load the data from the CSV file
    df = pd.read_csv(csv_path)
 
    # Normalize Millis to start from 0 and convert to seconds
    time_seconds = (df['Millis'] - df['Millis'].min()) / 1000  # Convert to seconds
 
    # Create figure and axis
    fig, ax = plt.subplots()
 
    # Plot the selected columns
    for column in columns_to_display:
        if column in df.columns:
            ax.plot(time_seconds, df[column], label=column)
 
    plt.legend()
 
    # Set plot labels and title
    ax.set_xlabel('Time (s)')
    ax.set_ylabel('Values')
    ax.set_title(f'Values over Time: {", ".join(columns_to_display)}')
 
    # Vertical line initialization
    line = ax.axvline(x=0, color='r', linewidth=2)  # Initial line at time=0
 
    # Create frames as a sequence of time values for the animation
    frames = np.linspace(time_seconds.min(), time_seconds.max(), num=int(time_seconds.max())*5 + 1)  # 1 frame per second
 
    # Log frames to debug
    print(f"Generated frames: {frames}")  # Debug log
 
    # Function to update the line position in the animation
    def update(frame):
        # Log the frame being processed
        print(f"Updating frame: {frame}")  # Debug log
 
        # Set xdata to the current frame wrapped in a list
        line.set_xdata([frame])  # Wrap frame in a list
 
        # Save each frame as an image in the 'frames' folder
        plt.savefig(f'frames/frame_{int(frame * 1000)}.png')  # Save with a unique name
        return line,
 
    # Create animation (frames only, no video saving)
    ani = FuncAnimation(fig, update, frames=frames, blit=True, repeat=False)
 
    # Save frames and close the figure after processing
    for i, frame in enumerate(frames):
        update(frame)  # Update line position for the frame
        plt.savefig(f'frames/frame_{i:04d}.png')  # Save each frame with a unique name (padded)
 
    plt.close(fig)  # Close the figure when done
 
    # Return the correct paths for the generated frames
    return [f'/frames/frame_{i:04d}.png' for i in range(len(frames))]
 
# Start the server
def run(server_class=HTTPServer, handler_class=MyHTTPRequestHandler):
    server_address = ('', PORT)
    httpd = server_class(server_address, handler_class)
    print(f'Serving on port {PORT}...')
    httpd.serve_forever()
 
if __name__ == '__main__':
    run()
 
 
