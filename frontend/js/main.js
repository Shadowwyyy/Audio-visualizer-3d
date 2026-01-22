/**
 * Main Application Entry Point
 * Initializes and connects all components.
 */

class App {
    constructor() {
        // Core components
        this.visualizer = null;
        this.audioInput = null;
        this.spotifyViz = null;
        this.ui = null;
        
        // State
        this.isInitialized = false;
    }

    async init() {
        console.log('Initializing Audio Visualizer...');
        
        try {
            // Create visualizer
            const container = document.getElementById('visualizer-container');
            if (!container) {
                throw new Error('Visualizer container not found');
            }
            this.visualizer = new Visualizer(container);
            
            // Create audio input handler
            this.audioInput = new AudioInput();
            
            // Create Spotify integration
            this.spotifyViz = new SpotifyVisualizer(this.visualizer);
            
            // Create UI controller
            this.ui = new UIController(this);
            
            // Set up Spotify callbacks
            this._setupSpotifyCallbacks();
            
            // Initialize Spotify (checks for existing session or callback)
            await this.spotifyViz.init();
            
            // Start visualizer
            this.visualizer.start();
            
            // Start main loop
            this._startMainLoop();
            
            this.isInitialized = true;
            console.log('Initialization complete');
            
        } catch (error) {
            console.error('Initialization failed:', error);
            this.ui?.setStatus('Initialization failed: ' + error.message, 'error');
        }
    }

    _setupSpotifyCallbacks() {
        // Auth state changes
        this.spotifyViz.client.onAuthChange = (isAuthenticated) => {
            if (isAuthenticated) {
                this.ui.hideSpotifyLogin();
                this.ui.setStatus('Connected to Spotify', 'connected');
            } else {
                this.ui.showSpotifyLogin();
                this.ui.clearTrackInfo();
                this.ui.setStatus('Connect to Spotify');
            }
        };

        // Override track change to update UI
        const originalOnTrackChange = this.spotifyViz.sync.onTrackChange;
        this.spotifyViz.sync.onTrackChange = (track) => {
            // Call original handler (loads analysis)
            if (originalOnTrackChange) {
                originalOnTrackChange.call(this.spotifyViz.sync, track);
            }
            // Update UI
            this.ui.showTrackInfo(track);
        };

        // Play state changes
        this.spotifyViz.sync.onPlayStateChange = (isPlaying) => {
            if (isPlaying) {
                this.ui.setStatus('Playing', 'connected');
            } else {
                this.ui.setStatus('Paused');
            }
        };
    }

    _startMainLoop() {
        const loop = () => {
            requestAnimationFrame(loop);
            
            // If using mic/file input, update visualizer from analyser
            const source = this.ui.getCurrentSource();
            
            if (source !== 'spotify' && this.audioInput.isActive) {
                const frequencyData = this.audioInput.getFrequencyData();
                const waveformData = this.audioInput.getWaveformData();
                
                if (frequencyData) {
                    this.visualizer.updateFromAnalyser(frequencyData, waveformData);
                }
            }
        };
        
        requestAnimationFrame(loop);
    }
}

// ==========================================
// Start Application
// ==========================================

// Wait for DOM
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
    window.app.init();
});

// Also expose for debugging
window.App = App;