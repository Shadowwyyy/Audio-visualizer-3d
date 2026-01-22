/**
 * Web Audio API handler for microphone and file input.
 * Used as fallback when Spotify isn't connected.
 */

class AudioInput {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.source = null;
        this.stream = null;
        
        // Data arrays
        this.frequencyData = null;
        this.waveformData = null;
        
        // State
        this.isActive = false;
        this.mode = null; // 'mic' or 'file'
        
        // Audio element for file playback
        this.audioElement = null;
    }

    /**
     * Initialize audio context (must be called after user interaction).
     */
    _initContext() {
        if (this.audioContext) return;
        
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create analyser
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.8;
        
        // Create data arrays
        const bufferLength = this.analyser.frequencyBinCount;
        this.frequencyData = new Uint8Array(bufferLength);
        this.waveformData = new Uint8Array(bufferLength);
    }

    /**
     * Start microphone input.
     */
    async startMicrophone() {
        try {
            this._initContext();
            
            // Stop any existing source
            this.stop();
            
            // Request microphone access
            this.stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });
            
            // Create source from stream
            this.source = this.audioContext.createMediaStreamSource(this.stream);
            this.source.connect(this.analyser);
            // Don't connect to destination - we don't want to hear the mic
            
            this.isActive = true;
            this.mode = 'mic';
            
            console.log('Microphone started');
            return true;
            
        } catch (error) {
            console.error('Microphone error:', error.message);
            
            if (error.name === 'NotAllowedError') {
                throw new Error('Microphone access denied. Please allow microphone access.');
            } else if (error.name === 'NotFoundError') {
                throw new Error('No microphone found.');
            }
            throw error;
        }
    }

    /**
     * Start audio file input.
     * @param {HTMLAudioElement} audioElement
     */
    startFile(audioElement) {
        if (!audioElement || !audioElement.src) {
            throw new Error('No audio file loaded');
        }
        
        this._initContext();
        
        // Stop any existing source
        this.stop();
        
        this.audioElement = audioElement;
        
        // Create source from audio element
        // Note: Can only call createMediaElementSource once per element
        if (!audioElement._sourceNode) {
            audioElement._sourceNode = this.audioContext.createMediaElementSource(audioElement);
        }
        
        this.source = audioElement._sourceNode;
        this.source.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
        
        this.isActive = true;
        this.mode = 'file';
        
        console.log('Audio file connected');
        return true;
    }

    /**
     * Stop all audio input.
     */
    stop() {
        // Stop microphone stream
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        // Disconnect source (but don't destroy file source node)
        if (this.source && this.mode === 'mic') {
            this.source.disconnect();
            this.source = null;
        }
        
        this.isActive = false;
        this.mode = null;
        
        console.log('Audio input stopped');
    }

    /**
     * Get current frequency data.
     * @returns {Uint8Array|null}
     */
    getFrequencyData() {
        if (!this.isActive || !this.analyser) return null;
        
        this.analyser.getByteFrequencyData(this.frequencyData);
        return this.frequencyData;
    }

    /**
     * Get current waveform data.
     * @returns {Uint8Array|null}
     */
    getWaveformData() {
        if (!this.isActive || !this.analyser) return null;
        
        this.analyser.getByteTimeDomainData(this.waveformData);
        return this.waveformData;
    }

    /**
     * Update analyser smoothing.
     */
    setSmoothing(value) {
        if (this.analyser) {
            this.analyser.smoothingTimeConstant = Math.max(0, Math.min(0.99, value));
        }
    }

    /**
     * Resume audio context (needed after user interaction).
     */
    async resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }
}

// Export
window.AudioInput = AudioInput;