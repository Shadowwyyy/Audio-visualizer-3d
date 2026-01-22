/**
 * UI Controller
 * Handles all user interface interactions.
 */

class UIController {
    constructor(app) {
        this.app = app;
        this.currentSource = 'spotify';
        
        this._bindElements();
        this._bindEvents();
    }

    _bindElements() {
        // Spotify
        this.spotifyLogin = document.getElementById('spotify-login');
        this.spotifyConnectBtn = document.getElementById('spotify-connect-btn');
        this.spotifyTrackInfo = document.getElementById('spotify-track-info');
        this.spotifyDisconnectBtn = document.getElementById('spotify-disconnect-btn');
        this.trackAlbumArt = document.getElementById('track-album-art');
        this.trackName = document.getElementById('track-name');
        this.trackArtist = document.getElementById('track-artist');
        
        // Source tabs
        this.sourceTabs = document.querySelectorAll('.source-tab');
        this.micControls = document.getElementById('mic-controls');
        this.fileControls = document.getElementById('file-controls');
        this.micStartBtn = document.getElementById('mic-start-btn');
        this.audioFileInput = document.getElementById('audio-file-input');
        this.fileLabel = document.getElementById('file-label');
        this.audioPlayer = document.getElementById('audio-player');
        
        // Settings
        this.sensitivitySlider = document.getElementById('sensitivity');
        this.smoothingSlider = document.getElementById('smoothing');
        this.reactivitySlider = document.getElementById('reactivity');
        this.shapeSelect = document.getElementById('shape');
        this.colorBtns = document.querySelectorAll('.color-btn');
        
        // Status
        this.statusText = document.getElementById('status-text');
    }

    _bindEvents() {
        // Spotify connect
        if (this.spotifyConnectBtn) {
            this.spotifyConnectBtn.addEventListener('click', () => {
                this.app.spotifyViz.login();
            });
        }
        
        // Spotify disconnect
        if (this.spotifyDisconnectBtn) {
            this.spotifyDisconnectBtn.addEventListener('click', async () => {
                await this.app.spotifyViz.logout();
                this.showSpotifyLogin();
            });
        }
        
        // Source tabs
        this.sourceTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this._switchSource(tab.dataset.source);
            });
        });
        
        // Microphone
        if (this.micStartBtn) {
            this.micStartBtn.addEventListener('click', async () => {
                await this._toggleMicrophone();
            });
        }
        
        // File input
        if (this.audioFileInput) {
            this.audioFileInput.addEventListener('change', (e) => {
                this._handleFileSelect(e);
            });
        }
        
        // Audio player events
        if (this.audioPlayer) {
            this.audioPlayer.addEventListener('play', () => {
                this.app.audioInput.startFile(this.audioPlayer);
                this.setStatus('Playing audio file', 'connected');
            });
            
            this.audioPlayer.addEventListener('pause', () => {
                this.setStatus('Paused');
            });
            
            this.audioPlayer.addEventListener('ended', () => {
                this.setStatus('Ready');
            });
        }
        
        // Settings
        if (this.sensitivitySlider) {
            this.sensitivitySlider.addEventListener('input', (e) => {
                this.app.visualizer.updateSettings({ 
                    sensitivity: parseFloat(e.target.value) 
                });
            });
        }
        
        if (this.smoothingSlider) {
            this.smoothingSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                this.app.visualizer.updateSettings({ smoothing: value });
                this.app.audioInput.setSmoothing(value);
            });
        }
        
        if (this.reactivitySlider) {
            this.reactivitySlider.addEventListener('input', (e) => {
                this.app.visualizer.setReactivity(parseFloat(e.target.value));
            });
        }
        
        if (this.shapeSelect) {
            this.shapeSelect.addEventListener('change', (e) => {
                this.app.visualizer.setShape(e.target.value);
            });
        }
        
        // Background color buttons
        this.colorBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.colorBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.app.visualizer.setBackgroundColor(btn.dataset.color);
            });
        });
    }

    _switchSource(source) {
        this.currentSource = source;
        
        // Update tab styles
        this.sourceTabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.source === source);
        });
        
        // Hide all controls
        if (this.micControls) this.micControls.style.display = 'none';
        if (this.fileControls) this.fileControls.style.display = 'none';
        
        // Stop current audio input
        this.app.audioInput.stop();
        if (this.micStartBtn) {
            this.micStartBtn.textContent = 'Start Microphone';
            this.micStartBtn.classList.remove('active');
        }
        
        // Show relevant controls
        switch (source) {
            case 'spotify':
                // Spotify is handled separately
                this.setStatus(this.app.spotifyViz.isActive ? 'Connected to Spotify' : 'Connect to Spotify');
                break;
                
            case 'mic':
                if (this.micControls) this.micControls.style.display = 'block';
                this.setStatus('Click to start microphone');
                break;
                
            case 'file':
                if (this.fileControls) this.fileControls.style.display = 'block';
                this.setStatus('Select an audio file');
                break;
        }
    }

    async _toggleMicrophone() {
        if (this.app.audioInput.isActive && this.app.audioInput.mode === 'mic') {
            // Stop microphone
            this.app.audioInput.stop();
            this.micStartBtn.textContent = 'Start Microphone';
            this.micStartBtn.classList.remove('active');
            this.setStatus('Microphone stopped');
        } else {
            // Start microphone
            try {
                this.micStartBtn.textContent = 'Starting...';
                await this.app.audioInput.startMicrophone();
                this.micStartBtn.textContent = 'Stop Microphone';
                this.micStartBtn.classList.add('active');
                this.setStatus('Microphone active', 'connected');
            } catch (error) {
                this.micStartBtn.textContent = 'Start Microphone';
                this.setStatus(error.message, 'error');
            }
        }
    }

    _handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Validate file type
        if (!file.type.startsWith('audio/')) {
            this.setStatus('Please select an audio file', 'error');
            return;
        }
        
        // Update label
        this.fileLabel.textContent = file.name;
        
        // Load into audio player
        const url = URL.createObjectURL(file);
        this.audioPlayer.src = url;
        this.audioPlayer.style.display = 'block';
        
        this.setStatus('File loaded - press play');
    }

    // ==========================================
    // Public Methods
    // ==========================================

    showSpotifyLogin() {
        if (this.spotifyLogin) this.spotifyLogin.style.display = 'block';
        if (this.spotifyTrackInfo) this.spotifyTrackInfo.style.display = 'none';
    }

    hideSpotifyLogin() {
        if (this.spotifyLogin) this.spotifyLogin.style.display = 'none';
    }

    showTrackInfo(track) {
        if (!track) return;
        
        this.hideSpotifyLogin();
        
        if (this.spotifyTrackInfo) {
            this.spotifyTrackInfo.style.display = 'flex';
        }
        
        if (this.trackAlbumArt && track.album_art) {
            this.trackAlbumArt.src = track.album_art;
        }
        
        if (this.trackName) {
            this.trackName.textContent = track.name || 'Unknown Track';
        }
        
        if (this.trackArtist) {
            this.trackArtist.textContent = track.artist || 'Unknown Artist';
        }
    }

    clearTrackInfo() {
        if (this.trackName) this.trackName.textContent = 'Not Playing';
        if (this.trackArtist) this.trackArtist.textContent = '';
        if (this.trackAlbumArt) this.trackAlbumArt.src = '';
    }

    setStatus(message, type = '') {
        if (this.statusText) {
            this.statusText.textContent = message;
            this.statusText.className = type;
        }
    }

    getCurrentSource() {
        return this.currentSource;
    }
}

// Export
window.UIController = UIController;