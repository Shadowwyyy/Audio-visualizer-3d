/**
 * Spotify Visualizer Integration
 * Connects SpotifyClient, PlaybackSync, BeatScheduler to your Three.js visualizer.
 */

class SpotifyVisualizer {
    constructor(visualizer) {
        // Your existing visualizer instance
        this.visualizer = visualizer;
        
        // Spotify components
        this.client = new SpotifyClient();
        this.sync = new PlaybackSync(this.client);
        this.scheduler = new BeatScheduler();
        
        // State
        this.isActive = false;
        this.currentAnalysis = null;
        
        // Bind callbacks
        this._setupCallbacks();
    }

    _setupCallbacks() {
        // Auth state changes
        this.client.onAuthChange = (isAuthenticated) => {
            console.log('Auth state:', isAuthenticated);
            if (isAuthenticated) {
                this.start();
            } else {
                this.stop();
            }
        };

        // Track changes - fetch new analysis
        this.sync.onTrackChange = async (track) => {
            console.log('Track changed:', track.name, '-', track.artist);
            await this._loadTrackAnalysis(track.id);
            this._updateTrackUI(track);
        };

        // Play state changes
        this.sync.onPlayStateChange = (isPlaying) => {
            console.log('Play state:', isPlaying);
            if (!isPlaying) {
                // Could dim visuals or pause animations
            }
        };

        // Beat events - pulse the visuals
        this.scheduler.onBeat = (beat, index) => {
            const intensity = beat.confidence;
            this._onBeat(intensity);
        };

        // Segment events - change colors/shapes
        this.scheduler.onSegment = (segment, index) => {
            this._onSegment(segment);
        };

        // Section events - major transitions
        this.scheduler.onSection = (section, index) => {
            this._onSection(section);
        };
    }

    /**
     * Initialize - try to restore session or show login.
     */
    async init() {
        if (this.client.restoreSession()) {
            console.log('Session restored');
            this.start();
        } else if (window.location.search.includes('access_token')) {
            // Handle OAuth callback
            this.client.handleCallback();
        } else {
            console.log('Not authenticated - showing login');
            this._showLoginUI();
        }
    }

    /**
     * Start the Spotify integration.
     */
    start() {
        if (this.isActive) return;
        
        this.isActive = true;
        this.sync.start(3000); // Poll every 3 seconds
        this._startRenderLoop();
        this._hideLoginUI();
        
        console.log('Spotify visualizer started');
    }

    /**
     * Stop the integration.
     */
    stop() {
        this.isActive = false;
        this.sync.stop();
        this.scheduler.clear();
        
        console.log('Spotify visualizer stopped');
    }

    /**
     * Login to Spotify.
     */
    login() {
        this.client.login();
    }

    /**
     * Logout.
     */
    async logout() {
        this.stop();
        await this.client.logout();
        this._showLoginUI();
    }

    /**
     * Main render loop - call scheduler update every frame.
     */
    _startRenderLoop() {
        const loop = () => {
            if (!this.isActive) return;
            
            // Get interpolated position
            const position = this.sync.getPosition();
            
            // Update scheduler - fires beat/segment/section callbacks
            this.scheduler.update(position);
            
            // Get current segment for continuous visualization
            const segment = this.scheduler.getCurrentSegment(position);
            if (segment) {
                this._updateContinuousVisuals(segment);
            }
            
            requestAnimationFrame(loop);
        };
        
        requestAnimationFrame(loop);
    }

    /**
     * Load analysis for a track.
     */
    async _loadTrackAnalysis(trackId) {
        try {
            const analysis = await this.client.getAnalysis(trackId);
            this.currentAnalysis = analysis;
            this.scheduler.loadAnalysis(analysis);
            console.log('Analysis loaded for track');
        } catch (error) {
            console.error('Failed to load analysis:', error.message);
        }
    }

    // ==========================================
    // Visual Callbacks - Customize these!
    // ==========================================

    /**
     * Called on every beat.
     * @param {number} intensity - Beat confidence (0-1)
     */
    _onBeat(intensity) {
        // Example: pulse geometry scale
        // this.visualizer.pulse(intensity);
        
        // Or if you have specific methods:
        if (this.visualizer.onBeat) {
            this.visualizer.onBeat(intensity);
        }
    }

    /**
     * Called on every segment change.
     * @param {Object} segment - Contains loudness, pitches[12], timbre[12]
     */
    _onSegment(segment) {
        // Map pitches to colors (12 pitches = chromatic scale)
        const dominantPitch = segment.pitches.indexOf(Math.max(...segment.pitches));
        const hue = (dominantPitch / 12) * 360;
        
        // Loudness typically ranges from -60 to 0
        const normalizedLoudness = Math.min(1, Math.max(0, (segment.loudness + 60) / 60));
        
        if (this.visualizer.onSegment) {
            this.visualizer.onSegment({
                hue,
                loudness: normalizedLoudness,
                pitches: segment.pitches,
                timbre: segment.timbre
            });
        }
    }

    /**
     * Called on section changes (verse, chorus, etc).
     * @param {Object} section - Contains tempo, key, mode, loudness
     */
    _onSection(section) {
        // Major mode = 1, minor = 0
        const isMajor = section.mode === 1;
        
        if (this.visualizer.onSection) {
            this.visualizer.onSection({
                tempo: section.tempo,
                key: section.key,
                isMajor,
                energy: (section.loudness + 60) / 60
            });
        }
    }

    /**
     * Called every frame with current segment data.
     * Use for smooth interpolated visuals.
     */
    _updateContinuousVisuals(segment) {
        if (this.visualizer.updateFromSegment) {
            this.visualizer.updateFromSegment(segment);
        }
    }

    // ==========================================
    // UI Helpers
    // ==========================================

    _updateTrackUI(track) {
        const el = document.getElementById('spotify-track-info');
        if (el) {
            el.innerHTML = `
                <img src="${track.album_art || ''}" alt="" style="width:50px;height:50px;">
                <div>
                    <div>${this._escapeHtml(track.name)}</div>
                    <div>${this._escapeHtml(track.artist)}</div>
                </div>
            `;
        }
    }

    _showLoginUI() {
        const el = document.getElementById('spotify-login');
        if (el) el.style.display = 'block';
    }

    _hideLoginUI() {
        const el = document.getElementById('spotify-login');
        if (el) el.style.display = 'none';
    }

    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}


// Export
window.SpotifyVisualizer = SpotifyVisualizer;