// Audio variables
let audioContext;
let analyser;
let dataArray;
let source;
let isPlaying = false;

// DOM elements
const audioFile = document.getElementById('audioFile');
const audioPlayer = document.getElementById('audioPlayer');
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const restartBtn = document.getElementById('restartBtn');
const trackInfo = document.getElementById('trackInfo');
const seekBar = document.getElementById('seekBar');
const seekProgress = document.getElementById('seekProgress');
const seekHandle = document.getElementById('seekHandle');
const timeDisplay = document.getElementById('timeDisplay');

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Seek functionality
let isSeeking = false;

seekBar.addEventListener('mousedown', (e) => {
    if (audioPlayer.src) {
        isSeeking = true;
        updateSeek(e);
    }
});

document.addEventListener('mousemove', (e) => {
    if (isSeeking) {
        updateSeek(e);
    }
});

document.addEventListener('mouseup', () => {
    isSeeking = false;
});

function updateSeek(e) {
    const rect = seekBar.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioPlayer.currentTime = percent * audioPlayer.duration;
}

function updateSeekBar() {
    if (audioPlayer.duration) {
        const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        seekProgress.style.width = percent + '%';
        seekHandle.style.left = percent + '%';
        timeDisplay.textContent = `${formatTime(audioPlayer.currentTime)} / ${formatTime(audioPlayer.duration)}`;
    }
}

audioPlayer.addEventListener('timeupdate', updateSeekBar);
audioPlayer.addEventListener('loadedmetadata', updateSeekBar);

// File upload
audioFile.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const url = URL.createObjectURL(file);
        audioPlayer.src = url;
        trackInfo.textContent = file.name;
        setupAudio();
        
        playBtn.disabled = false;
        pauseBtn.disabled = false;
        stopBtn.disabled = false;
        restartBtn.disabled = false;
    }
});

function setupAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.85;
        
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        
        source = audioContext.createMediaElementSource(audioPlayer);
        source.connect(analyser);
        analyser.connect(audioContext.destination);
    }
}

// Playback controls
playBtn.addEventListener('click', () => {
    if (audioPlayer.src) {
        audioPlayer.play();
    }
});

pauseBtn.addEventListener('click', () => {
    audioPlayer.pause();
});

stopBtn.addEventListener('click', () => {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
});

restartBtn.addEventListener('click', () => {
    audioPlayer.currentTime = 0;
    audioPlayer.play();
});

// Audio state events
audioPlayer.addEventListener('play', () => {
    isPlaying = true;
    playBtn.classList.add('active');
    pauseBtn.classList.remove('active');
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
});

audioPlayer.addEventListener('pause', () => {
    isPlaying = false;
    pauseBtn.classList.add('active');
    playBtn.classList.remove('active');
});

audioPlayer.addEventListener('ended', () => {
    isPlaying = false;
    playBtn.classList.remove('active');
    pauseBtn.classList.remove('active');
});