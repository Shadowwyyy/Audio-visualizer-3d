/**
 * Spotify API client for the visualizer frontend.
 * Handles auth, token management, and API calls.
 */

const API_BASE = 'http://localhost:8000'; // Change in production

class SpotifyClient {
    constructor() {
        this.accessToken = null;
        this.tokenExpiry = null;
        this.onAuthChange = null; // Callback for auth state changes
    }

    // ==========================================
    // Authentication
    // ==========================================

    /**
     * Check if user is authenticated with valid token.
     */
    isAuthenticated() {
        if (!this.accessToken) return false;
        if (this.tokenExpiry && Date.now() >= this.tokenExpiry) {
            this.accessToken = null;
            return false;
        }
        return true;
    }

    /**
     * Redirect to Spotify login.
     */
    login() {
        window.location.href = `${API_BASE}/auth/login`;
    }

    /**
     * Handle OAuth callback - extract token from URL.
     * Call this on your callback page.
     */
    handleCallback() {
        const params = new URLSearchParams(window.location.search);
        
        const error = params.get('error');
        if (error) {
            console.error('Auth error:', error);
            this._notifyAuthChange(false);
            return false;
        }

        const token = params.get('access_token');
        const expiresIn = parseInt(params.get('expires_in'), 10);

        if (!token) {
            console.error('No access token in callback');
            this._notifyAuthChange(false);
            return false;
        }

        this._setToken(token, expiresIn);
        
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);
        
        this._notifyAuthChange(true);
        return true;
    }

    /**
     * Logout - clear local state.
     */
    async logout() {
        try {
            await fetch(`${API_BASE}/auth/logout`, {
                method: 'POST',
                credentials: 'include'
            });
        } catch (e) {
            // Ignore errors - we're clearing local state anyway
        }
        
        this.accessToken = null;
        this.tokenExpiry = null;
        sessionStorage.removeItem('spotify_token');
        sessionStorage.removeItem('spotify_expiry');
        
        this._notifyAuthChange(false);
    }

    /**
     * Try to restore session from storage.
     */
    restoreSession() {
        const token = sessionStorage.getItem('spotify_token');
        const expiry = sessionStorage.getItem('spotify_expiry');

        if (token && expiry) {
            const expiryTime = parseInt(expiry, 10);
            if (Date.now() < expiryTime) {
                this.accessToken = token;
                this.tokenExpiry = expiryTime;
                return true;
            }
        }
        return false;
    }

    _setToken(token, expiresIn) {
        this.accessToken = token;
        // Set expiry 5 minutes early to avoid edge cases
        this.tokenExpiry = Date.now() + (expiresIn - 300) * 1000;
        
        // Store in session (not localStorage - more secure)
        sessionStorage.setItem('spotify_token', token);
        sessionStorage.setItem('spotify_expiry', this.tokenExpiry.toString());
    }

    _notifyAuthChange(isAuthenticated) {
        if (typeof this.onAuthChange === 'function') {
            this.onAuthChange(isAuthenticated);
        }
    }

    // ==========================================
    // API Calls
    // ==========================================

    /**
     * Make authenticated request to our backend.
     */
    async _request(endpoint, options = {}) {
        if (!this.isAuthenticated()) {
            throw new Error('Not authenticated');
        }

        const url = `${API_BASE}${endpoint}`;
        
        const response = await fetch(url, {
            ...options,
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
                ...options.headers
            },
            credentials: 'include'
        });

        if (response.status === 401) {
            // Token expired
            this.accessToken = null;
            this._notifyAuthChange(false);
            throw new Error('Session expired. Please log in again.');
        }

        if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After') || 60;
            throw new Error(`Rate limited. Try again in ${retryAfter} seconds.`);
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || `Request failed: ${response.status}`);
        }

        // Handle 204 No Content
        if (response.status === 204) {
            return null;
        }

        return response.json();
    }

    /**
     * Get current playback state.
     */
    async getPlayback() {
        return this._request('/spotify/playback');
    }

    /**
     * Get audio analysis for a track.
     */
    async getAnalysis(trackId) {
        if (!trackId || !/^[A-Za-z0-9]{22}$/.test(trackId)) {
            throw new Error('Invalid track ID');
        }
        return this._request(`/spotify/analysis/${trackId}`);
    }

    /**
     * Get audio features for a track.
     */
    async getFeatures(trackId) {
        if (!trackId || !/^[A-Za-z0-9]{22}$/.test(trackId)) {
            throw new Error('Invalid track ID');
        }
        return this._request(`/spotify/features/${trackId}`);
    }
}


// ==========================================
// Playback Sync Engine
// ==========================================

class PlaybackSync {
    constructor(spotifyClient) {
        this.client = spotifyClient;
        this.currentTrack = null;
        this.isPlaying = false;
        this.position = 0;
        this.lastSyncTime = 0;
        this.pollInterval = null;
        
        // Callbacks
        this.onTrackChange = null;
        this.onPlayStateChange = null;
    }

    /**
     * Start polling for playback updates.
     */
    start(intervalMs = 3000) {
        if (this.pollInterval) return;
        
        this._poll(); // Initial poll
        this.pollInterval = setInterval(() => this._poll(), intervalMs);
    }

    /**
     * Stop polling.
     */
    stop() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }

    /**
     * Get interpolated playback position.
     * Call this every frame for smooth sync.
     */
    getPosition() {
        if (!this.isPlaying) {
            return this.position;
        }
        
        const elapsed = performance.now() - this.lastSyncTime;
        return this.position + elapsed;
    }

    async _poll() {
        try {
            const playback = await this.client.getPlayback();
            
            if (!playback) {
                // Nothing playing
                if (this.isPlaying) {
                    this.isPlaying = false;
                    this._notifyPlayState(false);
                }
                return;
            }

            // Update position
            this.position = playback.progress_ms;
            this.lastSyncTime = performance.now();

            // Check play state change
            if (this.isPlaying !== playback.is_playing) {
                this.isPlaying = playback.is_playing;
                this._notifyPlayState(this.isPlaying);
            }

            // Check track change
            const track = playback.track;
            if (track && track.id !== this.currentTrack?.id) {
                this.currentTrack = track;
                this._notifyTrackChange(track);
            }

        } catch (error) {
            console.error('Playback sync error:', error.message);
        }
    }

    _notifyTrackChange(track) {
        if (typeof this.onTrackChange === 'function') {
            this.onTrackChange(track);
        }
    }

    _notifyPlayState(isPlaying) {
        if (typeof this.onPlayStateChange === 'function') {
            this.onPlayStateChange(isPlaying);
        }
    }
}


// Export for use
window.SpotifyClient = SpotifyClient;
window.PlaybackSync = PlaybackSync;