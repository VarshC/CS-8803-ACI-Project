// Declare selectedMetrics and data arrays
let selectedMetrics = [];
let csvData = [];
let timeData = [];

// Initialize Wavesurfer.js in the #waveform container
const wavesurfer = WaveSurfer.create({
    container: '#waveform',
    waveColor: 'violet',
    progressColor: 'purple',
    height: 80
});

// Get modal elements for file upload
const modal = document.getElementById("uploadModal");
const uploadBtn = document.getElementById("uploadBtn");
const closeModalBtn = document.querySelector(".close");
const uploadFilesBtn = document.getElementById("uploadFilesBtn");

let uploadedVideoReady = false;
let audioReady = false;
let animationReady = false;

function checkAllMediaReady() {
    if (uploadedVideoReady && audioReady && animationReady) {
        loadingModal.style.display = "none";  // Close the loading modal when all media are ready
    }
}

// Open and close modal events
uploadBtn.addEventListener("click", () => modal.style.display = "flex");
closeModalBtn.addEventListener("click", () => modal.style.display = "none");
window.addEventListener("click", event => {
    if (event.target === modal) modal.style.display = "none";
});

// Variables for animation frames and canvas context
let animationFrames = [];
let currentFrameIndex = 0;
const animationCanvas = document.getElementById('acceleration-canvas');
const canvasContext = animationCanvas.getContext('2d');
animationCanvas.width = 640;
animationCanvas.height = 480;

// Load and display a specific frame on the canvas
function loadAndDrawFrame(frameIndex) {
    if (frameIndex < animationFrames.length) {
        const img = new Image();
        img.src = animationFrames[frameIndex];
        img.onload = () => {
            canvasContext.clearRect(0, 0, animationCanvas.width, animationCanvas.height);
            canvasContext.drawImage(img, 0, 0, animationCanvas.width, animationCanvas.height);
        };
    } else {
        console.error("Frame index out of bounds:", frameIndex);
    }
}

function syncAnimationWithVideo(videoPlayer) {
    const currentTime = videoPlayer.currentTime;
    const frameRate = animationFrames.length / videoPlayer.duration;
    const frameIndex = Math.floor(currentTime * frameRate);
    if (frameIndex !== currentFrameIndex && frameIndex < animationFrames.length) {
        currentFrameIndex = frameIndex;
        loadAndDrawFrame(frameIndex);
    }
}

// Parse the CSV data
function parseCSV(csvText) {
    const rows = csvText.split('\n').map(row => row.split(','));
    const headers = rows[0];
    
    // Store time column (assumed to be in 'Millis')
    timeData = rows.slice(1).map(row => parseFloat(row[headers.indexOf('Millis')]));

    // Store selected columns for each row
    csvData = rows.slice(1).map(row => {
        const data = {};
        selectedMetrics.forEach(metric => {
            if (headers.includes(metric)) {
                data[metric] = parseFloat(row[headers.indexOf(metric)]);
            }
        });
        return data;
    });
}

// Create real-time display elements for selected metrics
function createRealTimeValueElements() {
    const container = document.getElementById('selected-values');
    container.innerHTML = ''; // Clear any previous values

    selectedMetrics.forEach(metric => {
        const metricDisplay = document.createElement('div');
        metricDisplay.classList.add('metric-display');
        
        // Add a special class if the metric is "Pressure"
        if (metric === 'Pressure') {
            metricDisplay.classList.add('wide-label');
        }

        const labelElement = document.createElement('span');
        labelElement.id = `label-${metric}`;
        labelElement.innerText = `${metric}:`;
        metricDisplay.appendChild(labelElement);

        const valueElement = document.createElement('span');
        valueElement.id = `value-${metric}`;
        valueElement.innerText = '0.00'; // Initialize with two decimal places
        metricDisplay.appendChild(valueElement);

        container.appendChild(metricDisplay);
    });
}



// Update real-time values based on video time
function updateDisplayedValues(currentData) {
    selectedMetrics.forEach(metric => {
        const labelElement = document.getElementById(`label-${metric}`);
        const valueElement = document.getElementById(`value-${metric}`);
        
        if (labelElement && valueElement) {
            const value = currentData[metric] !== undefined ? currentData[metric] : NaN;
            valueElement.innerText = !isNaN(value) ? value.toFixed(2) : 'N/A'; // Display two decimal places
        }
    });
}


// Sync CSV data with video time
document.getElementById("video-player").addEventListener('timeupdate', function() {
    const currentTimeInMillis = this.currentTime * 1000;
    let closestIndex = timeData.findIndex(time => time >= currentTimeInMillis);
    if (closestIndex === -1) closestIndex = timeData.length - 1;
    updateDisplayedValues(csvData[closestIndex]);
});

// Handle file upload and initialize display elements
uploadFilesBtn.addEventListener("click", function(event) {
    event.preventDefault();

    const videoFile = document.getElementById("videoFile").files[0];
    const audioFile = document.getElementById("audioFile").files[0];
    const csvFile = document.getElementById("csvFile").files[0];
    const metaCsv = document.getElementById("metaCsv").files[0];

    selectedMetrics = Array.from(document.querySelectorAll('#checkbox-container input[type="checkbox"]:checked')).map(checkbox => checkbox.value);

    if (!videoFile || !audioFile || !csvFile || !metaCsv) {
        alert("Please select all files before uploading.");
        return;
    }

    // Show the loading modal and close the file upload modal
    loadingModal.style.display = "flex";
    modal.style.display = "none";

    // Display the uploaded video
    const videoPlayer = document.getElementById("video-player");
    const videoURL = URL.createObjectURL(videoFile);
    videoPlayer.src = videoURL;
    videoPlayer.load();

    videoPlayer.addEventListener('canplaythrough', () => {
        uploadedVideoReady = true;
        checkAllMediaReady();
    });

    // Process CSV data and create real-time display elements
    const realTimeReader = new FileReader();
    realTimeReader.onload = function(e) {
        parseCSV(e.target.result);
        createRealTimeValueElements();
    };
    realTimeReader.readAsText(csvFile);

    // Process metadata CSV file
    const metaReader = new FileReader();
    metaReader.onload = function(e) {
        const rows = e.target.result.split('\n').map(row => row.split(','));
        const headers = rows[0];
        const animalData = rows[1];
        document.getElementById('animal-name').innerText = animalData[headers.indexOf('Name')] || 'N/A';
        document.getElementById('animal-breed').innerText = animalData[headers.indexOf('Breed')] || 'N/A';
        document.getElementById('animal-age').innerText = animalData[headers.indexOf('Age')] || 'N/A';
    };
    metaReader.readAsText(metaCsv);

    // Load the uploaded audio file into Wavesurfer.js
    const audioURL = URL.createObjectURL(audioFile);
    wavesurfer.load(audioURL);
    wavesurfer.on('ready', () => {
        audioReady = true;
        checkAllMediaReady();
    });

    // Sync audio waveform with video play/pause
    videoPlayer.addEventListener('play', () => wavesurfer.play());
    videoPlayer.addEventListener('pause', () => wavesurfer.pause());
    videoPlayer.addEventListener('seeked', () => {
        wavesurfer.seekTo(videoPlayer.currentTime / videoPlayer.duration);
    });

    // Send CSV file and selected metrics to the server
    const formData = new FormData();
    formData.append("csvFile", csvFile);
    formData.append("columns_to_display", JSON.stringify(selectedMetrics));

    fetch("/upload", {
        method: "POST",
        body: formData,
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            animationFrames = data.animationFiles;
            videoPlayer.addEventListener('timeupdate', () => syncAnimationWithVideo(videoPlayer));
            loadAndDrawFrame(0);
            animationReady = true;
            checkAllMediaReady();
        } else {
            alert("Failed to generate animation.");
        }
    })
    .catch(error => {
        console.error("Error:", error);
        loadingModal.style.display = "none";
    });
});
