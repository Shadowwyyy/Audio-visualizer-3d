/**
 * Main Application Entry Point
 * Initializes and connects all components.
 */

class App {
    constructor() {
        this.visualizer = null;
        this.audioInput = null;
        this.ui = null;
        this.isInitialized = false;
    }

    async init() {
        console.log('Initializing Audio Visualizer...');
        
        try {
            const container = document.getElementById('visualizer-container');
            if (!container) throw new Error('Visualizer container not found');
            
            this.visualizer = new Visualizer(container);
            this.audioInput = new AudioInput();
            this.ui = new UIController(this);
            
            this.visualizer.start();
            this._startMainLoop();
            
            this.isInitialized = true;
            this.ui.setStatus('Ready - select audio source');
            console.log('Initialization complete');
            
        } catch (error) {
            console.error('Initialization failed:', error);
            this.ui?.setStatus('Error: ' + error.message, 'error');
        }
    }

    _startMainLoop() {
        const loop = () => {
            requestAnimationFrame(loop);
            
            if (this.audioInput.isActive) {
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

document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
    window.app.init();
});

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