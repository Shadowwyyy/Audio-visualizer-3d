/**
 * Three.js Audio Visualizer
 * Reactive 3D geometry that responds to audio input.
 */

class Visualizer {
    constructor(container) {
        this.container = container;
        
        // Three.js components
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        
        // Visualizer objects
        this.particles = null;
        this.centerSphere = null;
        this.rings = [];
        
        // Animation state
        this.isRunning = false;
        this.frameId = null;
        this.clock = new THREE.Clock();
        
        // Audio reactive state
        this.currentHue = 0;
        this.targetHue = 0;
        this.currentEnergy = 0;
        this.targetEnergy = 0;
        this.beatIntensity = 0;
        
        // Settings
        this.settings = {
            sensitivity: 1.5,
            smoothing: 0.8,
            colorMode: 'pitch'
        };
        
        // FPS tracking
        this.fps = 0;
        this.frameCount = 0;
        this.lastFpsUpdate = 0;
        
        this._init();
    }

    _init() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x000000, 0.001);

        // Camera
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 2000);
        this.camera.position.z = 100;

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true 
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.container.appendChild(this.renderer.domElement);

        // Create visual elements
        this._createParticles();
        this._createCenterSphere();
        this._createRings();
        this._createLights();

        // Handle resize
        window.addEventListener('resize', () => this._onResize());
    }

    _createParticles() {
        const count = 2000;
        const geometry = new THREE.BufferGeometry();
        
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        
        for (let i = 0; i < count; i++) {
            // Spherical distribution
            const radius = 50 + Math.random() * 150;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = radius * Math.cos(phi);
            
            colors[i * 3] = 1;
            colors[i * 3 + 1] = 1;
            colors[i * 3 + 2] = 1;
            
            sizes[i] = Math.random() * 2 + 0.5;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        // Store original positions for animation
        this.particleOriginalPositions = positions.slice();
        
        const material = new THREE.PointsMaterial({
            size: 1.5,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        
        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    }

    _createCenterSphere() {
        const geometry = new THREE.IcosahedronGeometry(15, 2);
        const material = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            wireframe: true,
            transparent: true,
            opacity: 0.6
        });
        
        this.centerSphere = new THREE.Mesh(geometry, material);
        this.scene.add(this.centerSphere);
        
        // Store original vertices for morphing
        this.sphereOriginalPositions = geometry.attributes.position.array.slice();
    }

    _createRings() {
        const ringCount = 5;
        
        for (let i = 0; i < ringCount; i++) {
            const radius = 25 + i * 15;
            const geometry = new THREE.TorusGeometry(radius, 0.3, 8, 100);
            const material = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.3
            });
            
            const ring = new THREE.Mesh(geometry, material);
            ring.rotation.x = Math.PI / 2;
            ring.userData.baseRadius = radius;
            ring.userData.index = i;
            
            this.rings.push(ring);
            this.scene.add(ring);
        }
    }

    _createLights() {
        const ambient = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambient);
        
        const point1 = new THREE.PointLight(0xffffff, 1, 200);
        point1.position.set(50, 50, 50);
        this.scene.add(point1);
        
        const point2 = new THREE.PointLight(0xffffff, 0.5, 200);
        point2.position.set(-50, -50, 50);
        this.scene.add(point2);
    }

    _onResize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }

    // ==========================================
    // Public API - Called by SpotifyVisualizer
    // ==========================================

    /**
     * Called on every beat.
     * @param {number} intensity - 0 to 1
     */
    onBeat(intensity) {
        this.beatIntensity = intensity * this.settings.sensitivity;
    }

    /**
     * Called on segment changes.
     * @param {Object} data - { hue, loudness, pitches, timbre }
     */
    onSegment(data) {
        this.targetHue = data.hue;
        this.targetEnergy = data.loudness * this.settings.sensitivity;
    }

    /**
     * Called on section changes.
     * @param {Object} data - { tempo, key, isMajor, energy }
     */
    onSection(data) {
        // Could trigger scene transitions here
    }

    /**
     * Called every frame with current segment (for smooth updates).
     * @param {Object} segment - Raw segment data
     */
    updateFromSegment(segment) {
        if (!segment) return;
        
        // Normalize loudness (-60 to 0 dB range typically)
        const loudness = Math.min(1, Math.max(0, (segment.loudness + 60) / 60));
        this.targetEnergy = loudness * this.settings.sensitivity;
        
        // Get dominant pitch for color
        if (segment.pitches && segment.pitches.length === 12) {
            const maxPitch = Math.max(...segment.pitches);
            const pitchIndex = segment.pitches.indexOf(maxPitch);
            this.targetHue = (pitchIndex / 12) * 360;
        }
    }

    /**
     * Update from Web Audio API analyser (mic/file mode).
     * @param {Uint8Array} frequencyData
     * @param {Uint8Array} waveformData
     */
    updateFromAnalyser(frequencyData, waveformData) {
        if (!frequencyData || !frequencyData.length) return;
        
        // Calculate energy from frequency data
        let sum = 0;
        for (let i = 0; i < frequencyData.length; i++) {
            sum += frequencyData[i];
        }
        const avgFrequency = sum / frequencyData.length / 255;
        this.targetEnergy = avgFrequency * this.settings.sensitivity;
        
        // Bass for beats
        let bassSum = 0;
        const bassEnd = Math.floor(frequencyData.length * 0.1);
        for (let i = 0; i < bassEnd; i++) {
            bassSum += frequencyData[i];
        }
        const bassAvg = bassSum / bassEnd / 255;
        
        if (bassAvg > 0.7) {
            this.beatIntensity = bassAvg;
        }
        
        // Color from mid frequencies
        const midStart = Math.floor(frequencyData.length * 0.2);
        const midEnd = Math.floor(frequencyData.length * 0.6);
        let midSum = 0;
        for (let i = midStart; i < midEnd; i++) {
            midSum += frequencyData[i];
        }
        const midAvg = midSum / (midEnd - midStart) / 255;
        this.targetHue = midAvg * 360;
    }

    /**
     * Update settings.
     */
    updateSettings(settings) {
        Object.assign(this.settings, settings);
    }

    // ==========================================
    // Animation Loop
    // ==========================================

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.clock.start();
        this._animate();
    }

    stop() {
        this.isRunning = false;
        if (this.frameId) {
            cancelAnimationFrame(this.frameId);
            this.frameId = null;
        }
    }

    _animate() {
        if (!this.isRunning) return;
        
        this.frameId = requestAnimationFrame(() => this._animate());
        
        const delta = this.clock.getDelta();
        const elapsed = this.clock.getElapsedTime();
        
        // Smooth transitions
        const smoothing = this.settings.smoothing;
        this.currentHue += (this.targetHue - this.currentHue) * (1 - smoothing);
        this.currentEnergy += (this.targetEnergy - this.currentEnergy) * (1 - smoothing);
        this.beatIntensity *= 0.9; // Decay beat
        
        // Update visuals
        this._updateParticles(elapsed);
        this._updateCenterSphere(elapsed);
        this._updateRings(elapsed);
        this._updateColors();
        
        // Camera subtle movement
        this.camera.position.x = Math.sin(elapsed * 0.1) * 10;
        this.camera.position.y = Math.cos(elapsed * 0.1) * 5;
        this.camera.lookAt(0, 0, 0);
        
        // Render
        this.renderer.render(this.scene, this.camera);
        
        // FPS counter
        this._updateFps();
    }

    _updateParticles(elapsed) {
        if (!this.particles) return;
        
        const positions = this.particles.geometry.attributes.position.array;
        const original = this.particleOriginalPositions;
        const energy = this.currentEnergy;
        const beat = this.beatIntensity;
        
        for (let i = 0; i < positions.length; i += 3) {
            const ox = original[i];
            const oy = original[i + 1];
            const oz = original[i + 2];
            
            // Distance from center
            const dist = Math.sqrt(ox * ox + oy * oy + oz * oz);
            
            // Expand based on energy
            const scale = 1 + energy * 0.3 + beat * 0.5;
            
            // Add wave motion
            const wave = Math.sin(elapsed * 2 + dist * 0.02) * energy * 5;
            
            positions[i] = ox * scale + (ox / dist) * wave;
            positions[i + 1] = oy * scale + (oy / dist) * wave;
            positions[i + 2] = oz * scale + (oz / dist) * wave;
        }
        
        this.particles.geometry.attributes.position.needsUpdate = true;
        this.particles.rotation.y = elapsed * 0.05;
    }

    _updateCenterSphere(elapsed) {
        if (!this.centerSphere) return;
        
        const positions = this.centerSphere.geometry.attributes.position.array;
        const original = this.sphereOriginalPositions;
        const energy = this.currentEnergy;
        const beat = this.beatIntensity;
        
        for (let i = 0; i < positions.length; i += 3) {
            const ox = original[i];
            const oy = original[i + 1];
            const oz = original[i + 2];
            
            const dist = Math.sqrt(ox * ox + oy * oy + oz * oz);
            const noise = Math.sin(elapsed * 3 + i * 0.5) * energy * 2;
            const beatPulse = beat * 3;
            
            const scale = 1 + energy * 0.2 + beatPulse;
            
            positions[i] = ox * scale + (ox / dist) * noise;
            positions[i + 1] = oy * scale + (oy / dist) * noise;
            positions[i + 2] = oz * scale + (oz / dist) * noise;
        }
        
        this.centerSphere.geometry.attributes.position.needsUpdate = true;
        this.centerSphere.rotation.x = elapsed * 0.2;
        this.centerSphere.rotation.y = elapsed * 0.3;
    }

    _updateRings(elapsed) {
        const energy = this.currentEnergy;
        const beat = this.beatIntensity;
        
        this.rings.forEach((ring, i) => {
            const baseRadius = ring.userData.baseRadius;
            const phase = i * 0.5;
            
            // Pulse on beat
            const scale = 1 + beat * 0.3 + Math.sin(elapsed * 2 + phase) * energy * 0.1;
            ring.scale.set(scale, scale, 1);
            
            // Rotate
            ring.rotation.z = elapsed * 0.1 * (i % 2 === 0 ? 1 : -1);
            
            // Tilt based on energy
            ring.rotation.x = Math.PI / 2 + Math.sin(elapsed + phase) * energy * 0.3;
        });
    }

    _updateColors() {
        const hue = this.currentHue;
        const energy = this.currentEnergy;
        
        // Convert HSL to RGB
        const color = new THREE.Color();
        color.setHSL(hue / 360, 0.8, 0.5 + energy * 0.3);
        
        // Update center sphere
        if (this.centerSphere) {
            this.centerSphere.material.color.copy(color);
        }
        
        // Update rings with slight hue variation
        this.rings.forEach((ring, i) => {
            const ringColor = new THREE.Color();
            ringColor.setHSL((hue + i * 30) / 360 % 1, 0.7, 0.5);
            ring.material.color.copy(ringColor);
            ring.material.opacity = 0.2 + energy * 0.4;
        });
        
        // Update particle colors
        if (this.particles) {
            const colors = this.particles.geometry.attributes.color.array;
            for (let i = 0; i < colors.length; i += 3) {
                const particleHue = (hue + (i / colors.length) * 60) / 360 % 1;
                const c = new THREE.Color();
                c.setHSL(particleHue, 0.8, 0.6);
                colors[i] = c.r;
                colors[i + 1] = c.g;
                colors[i + 2] = c.b;
            }
            this.particles.geometry.attributes.color.needsUpdate = true;
        }
    }

    _updateFps() {
        this.frameCount++;
        const now = performance.now();
        
        if (now - this.lastFpsUpdate >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsUpdate = now;
            
            const el = document.getElementById('fps-counter');
            if (el) el.textContent = `${this.fps} FPS`;
        }
    }
}

// Export
window.Visualizer = Visualizer;