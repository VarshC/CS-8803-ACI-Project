// Initialize Wavesurfer.js in the #waveform container
const wavesurfer = WaveSurfer.create({
    container: '#waveform',  // Use the div with id 'waveform' for the waveform display
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

  // Open the modal when upload button is clicked
  uploadBtn.addEventListener("click", function() {
    modal.style.display = "flex";
  });

  // Close the modal when 'x' is clicked
  closeModalBtn.addEventListener("click", function() {
    modal.style.display = "none";
  });

  // Close modal if user clicks outside of it
  window.addEventListener("click", function(event) {
    if (event.target === modal) {
      modal.style.display = "none";
    }
  });

  // Variables to store the animation frames and canvas context
  let animationFrames = [];
  let currentFrameIndex = 0;
  let animationCanvas = document.getElementById('acceleration-canvas');
  let canvasContext = animationCanvas.getContext('2d');

  // Function to load and display a specific frame on the canvas
  animationCanvas.width = 640; // Set this to your image's width
  animationCanvas.height = 480; // Set this to your image's height

  function loadAndDrawFrame(frameIndex) {
      if (frameIndex < animationFrames.length) {
          const img = new Image();
          img.src = animationFrames[frameIndex]; // URL of the frame
          img.onload = () => {
              canvasContext.clearRect(0, 0, animationCanvas.width, animationCanvas.height);
              canvasContext.drawImage(img, 0, 0, animationCanvas.width, animationCanvas.height); // Ensure proper scaling
          };
      } else {
          console.error("Frame index out of bounds:", frameIndex);
      }
  }

  function syncAnimationWithVideo(videoPlayer) {
    const currentTime = videoPlayer.currentTime;
    const frameRate = animationFrames.length / videoPlayer.duration;  // Calculate frame rate
    const frameIndex = Math.floor(currentTime * frameRate);
    
    // Only update if frameIndex has changed and is within bounds
    if (frameIndex !== currentFrameIndex && frameIndex < animationFrames.length) {
        currentFrameIndex = frameIndex;
        loadAndDrawFrame(frameIndex);  // Load the corresponding frame
    }
  }

  // Handle file upload on button click
  uploadFilesBtn.addEventListener("click", function(event) {
    event.preventDefault();

    const videoFile = document.getElementById("videoFile").files[0];
    const audioFile = document.getElementById("audioFile").files[0];
    const csvFile = document.getElementById("csvFile").files[0];
    const metaCsv = document.getElementById("metaCsv").files[0];

    // Gather selected metrics
    const selectedMetrics = [];
    document.querySelectorAll('#checkbox-container input[type="checkbox"]:checked').forEach(checkbox => {
        selectedMetrics.push(checkbox.value);
    });

    if (!videoFile || !audioFile || !csvFile || !metaCsv) {
      alert("Please select all files before uploading.");
      return;
    }

    // Show the loading modal
    loadingModal.style.display = "flex";

    // Close the file upload modal
    modal.style.display = "none";

    console.log("Selected metrics:", selectedMetrics);
    console.log("Video File:", videoFile);
    console.log("Audio File:", audioFile);
    console.log("CSV File:", csvFile);


    // Show the uploaded video in the video player
    const videoPlayer = document.getElementById("video-player");
    const videoURL = URL.createObjectURL(videoFile);
    videoPlayer.src = videoURL;
    videoPlayer.load(); // Reload the video player with the new source

    // Add file upload logic here (e.g., send files to server or process them)
    videoPlayer.addEventListener('loadeddata', () => {
        console.log("Video is ready to play.");
    });

    videoPlayer.addEventListener('canplaythrough', () => {
        console.log("Video can play through. Playing now.");
        uploadedVideoReady = true;  // Mark uploaded video as ready
        checkAllMediaReady();
    });

    // Process Metadata CSV file
    const reader = new FileReader();
    reader.onload = function(e) {
      const text = e.target.result;
      parseCSV(text);
    };
    reader.readAsText(metaCsv);


    // Load the uploaded audio file into Wavesurfer.js for waveform visualization
    const audioURL = URL.createObjectURL(audioFile);
    wavesurfer.load(audioURL); // Load the audio into Wavesurfer

    wavesurfer.on('ready', function() {
      audioReady = true;  // Mark audio as ready
      checkAllMediaReady();
    });

    // Synchronize the waveform with play/pause of video
    videoPlayer.addEventListener('play', function() {
      wavesurfer.play();
    });

    videoPlayer.addEventListener('pause', function() {
      wavesurfer.pause();
    });

    videoPlayer.addEventListener('seeked', function() {
      const percentage = videoPlayer.currentTime / videoPlayer.duration;
      wavesurfer.seekTo(percentage); // Sync waveform position with video scrubbing
    });

    //Process the animation data
    const formData = new FormData();
    formData.append("csvFile", csvFile);
    formData.append("columns_to_display", JSON.stringify(selectedMetrics));

    // Send CSV file to the server
    fetch("/upload", {
      method: "POST",
      body: formData,
    })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        // Load the animation frames into memory
        animationFrames = data.animationFiles;

        // Add event listener to sync animation with the main video
        videoPlayer.addEventListener('timeupdate', () => syncAnimationWithVideo(videoPlayer));

        // Initial display of the first frame
        loadAndDrawFrame(0);

        console.log('Animation frames loaded:', animationFrames);
        animationReady = true;
        checkAllMediaReady();
      } else {
        alert("Failed to generate animation.");
      }
    })
    .catch((error) => {
      console.error("Error:", error);
      loadingModal.style.display = "none";  
    });
  });

  // Function to parse the CSV file and extract Name, Breed, and Age
  function parseCSV(data) {
    const rows = data.split('\n').map(row => row.split(','));
    
    // Assuming the CSV has headers like: "Name,Breed,Age" and data in the following rows
    const headers = rows[0];
    const nameIndex = headers.indexOf('Name');
    const breedIndex = headers.indexOf('Breed');
    const ageIndex = headers.indexOf('Age');

    // Assuming the first row is the header and the second row contains the data
    const animalData = rows[1];

    const name = animalData[nameIndex] || "N/A";
    const breed = animalData[breedIndex] || "N/A";
    const age = animalData[ageIndex] || "N/A";

    // Update the HTML with the extracted data
    document.getElementById('animal-name').innerText = name;
    document.getElementById('animal-breed').innerText = breed;
    document.getElementById('animal-age').innerText = age;
  }
