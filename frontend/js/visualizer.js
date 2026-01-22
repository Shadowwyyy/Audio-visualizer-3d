/**
 * Three.js Audio Visualizer - Smooth & Polished Version
 */

class Visualizer {
    constructor(container) {
        this.container = container;
        
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        
        // Visual elements
        this.particles = null;
        this.centerMesh = null;
        this.rings = [];
        this.glowMesh = null;
        
        // Animation
        this.isRunning = false;
        this.frameId = null;
        this.clock = new THREE.Clock();
        
        // Audio reactive state - using lerped values for smoothness
        this.energy = { current: 0, target: 0 };
        this.bass = { current: 0, target: 0 };
        this.mid = { current: 0, target: 0 };
        this.high = { current: 0, target: 0 };
        this.hue = { current: 200, target: 200 };
        
        // Settings
        this.settings = {
            sensitivity: 1.5,
            smoothing: 0.92,
            colorMode: 'pitch'
        };
        
        // FPS
        this.fps = 0;
        this.frameCount = 0;
        this.lastFpsUpdate = 0;
        
        this._init();
    }

    _init() {
        // Scene with gradient background feel
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x000011, 0.0008);

        // Camera
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 2000);
        this.camera.position.z = 120;

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true 
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.container.appendChild(this.renderer.domElement);

        // Create elements
        this._createParticles();
        this._createCenterMesh();
        this._createRings();
        this._createGlow();
        this._createLights();

        window.addEventListener('resize', () => this._onResize());
    }

    _createParticles() {
        const count = 1500;
        const geometry = new THREE.BufferGeometry();
        
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        const phases = new Float32Array(count); // For individual animation timing
        
        for (let i = 0; i < count; i++) {
            // Distribute in a sphere with varying density
            const radius = 40 + Math.pow(Math.random(), 0.5) * 120;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = radius * Math.cos(phi);
            
            // Soft blue-cyan initial colors
            colors[i * 3] = 0.4 + Math.random() * 0.2;
            colors[i * 3 + 1] = 0.6 + Math.random() * 0.3;
            colors[i * 3 + 2] = 0.9 + Math.random() * 0.1;
            
            sizes[i] = 0.5 + Math.random() * 1.5;
            phases[i] = Math.random() * Math.PI * 2;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        this.particlePhases = phases;
        this.particleOriginalPositions = positions.slice();
        
        const material = new THREE.PointsMaterial({
            size: 2,
            vertexColors: true,
            transparent: true,
            opacity: 0.7,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true
        });
        
        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    }

    _createCenterMesh() {
        // Smoother sphere with more segments
        const geometry = new THREE.IcosahedronGeometry(12, 3);
        const material = new THREE.MeshPhongMaterial({
            color: 0x4488ff,
            emissive: 0x112244,
            wireframe: true,
            transparent: true,
            opacity: 0.8
        });
        
        this.centerMesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.centerMesh);
        
        this.centerOriginalPositions = geometry.attributes.position.array.slice();
    }

    _createRings() {
        const ringCount = 4;
        
        for (let i = 0; i < ringCount; i++) {
            const radius = 20 + i * 12;
            // Thinner, smoother rings
            const geometry = new THREE.TorusGeometry(radius, 0.15, 16, 128);
            const material = new THREE.MeshBasicMaterial({
                color: 0x4488ff,
                transparent: true,
                opacity: 0.2,
                blending: THREE.AdditiveBlending
            });
            
            const ring = new THREE.Mesh(geometry, material);
            ring.rotation.x = Math.PI / 2;
            ring.userData = { 
                baseRadius: radius, 
                index: i,
                rotationSpeed: 0.1 + i * 0.05,
                phase: i * Math.PI / 4
            };
            
            this.rings.push(ring);
            this.scene.add(ring);
        }
    }

    _createGlow() {
        // Central glow sphere
        const geometry = new THREE.SphereGeometry(18, 32, 32);
        const material = new THREE.MeshBasicMaterial({
            color: 0x4488ff,
            transparent: true,
            opacity: 0.1,
            blending: THREE.AdditiveBlending
        });
        
        this.glowMesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.glowMesh);
    }

    _createLights() {
        const ambient = new THREE.AmbientLight(0x334455, 0.5);
        this.scene.add(ambient);
        
        const point1 = new THREE.PointLight(0x4488ff, 1, 300);
        point1.position.set(50, 50, 50);
        this.scene.add(point1);
        this.mainLight = point1;
        
        const point2 = new THREE.PointLight(0x8844ff, 0.5, 200);
        point2.position.set(-50, -30, 50);
        this.scene.add(point2);
        this.secondLight = point2;
    }

    _onResize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }

    // ==========================================
    // Audio Input Methods
    // ==========================================

    onBeat(intensity) {
        // Soft beat response
        this.bass.target = Math.min(1, this.bass.target + intensity * 0.5);
    }

    onSegment(data) {
        this.hue.target = data.hue;
        this.energy.target = data.loudness;
    }

    onSection(data) {
        // Gentle section transitions
    }

    updateFromSegment(segment) {
        if (!segment) return;
        
        const loudness = Math.min(1, Math.max(0, (segment.loudness + 60) / 60));
        this.energy.target = loudness * this.settings.sensitivity;
        
        if (segment.pitches && segment.pitches.length === 12) {
            const maxPitch = Math.max(...segment.pitches);
            const pitchIndex = segment.pitches.indexOf(maxPitch);
            this.hue.target = (pitchIndex / 12) * 360;
        }
    }

    updateFromAnalyser(frequencyData, waveformData) {
        if (!frequencyData || !frequencyData.length) return;
        
        const len = frequencyData.length;
        
        // Split into frequency bands
        const bassEnd = Math.floor(len * 0.1);
        const midEnd = Math.floor(len * 0.5);
        
        let bassSum = 0, midSum = 0, highSum = 0;
        
        for (let i = 0; i < len; i++) {
            const val = frequencyData[i] / 255;
            if (i < bassEnd) bassSum += val;
            else if (i < midEnd) midSum += val;
            else highSum += val;
        }
        
        this.bass.target = (bassSum / bassEnd) * this.settings.sensitivity;
        this.mid.target = (midSum / (midEnd - bassEnd)) * this.settings.sensitivity;
        this.high.target = (highSum / (len - midEnd)) * this.settings.sensitivity;
        
        // Overall energy
        this.energy.target = (this.bass.target * 0.5 + this.mid.target * 0.3 + this.high.target * 0.2);
        
        // Color from mid frequencies
        this.hue.target = this.mid.target * 360;
    }

    updateSettings(settings) {
        Object.assign(this.settings, settings);
    }

    // ==========================================
    // Animation
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

    _lerp(current, target, smoothing) {
        return current + (target - current) * (1 - smoothing);
    }

    _animate() {
        if (!this.isRunning) return;
        
        this.frameId = requestAnimationFrame(() => this._animate());
        
        const elapsed = this.clock.getElapsedTime();
        const smoothing = this.settings.smoothing;
        
        // Smooth all values
        this.energy.current = this._lerp(this.energy.current, this.energy.target, smoothing);
        this.bass.current = this._lerp(this.bass.current, this.bass.target, smoothing);
        this.mid.current = this._lerp(this.mid.current, this.mid.target, smoothing);
        this.high.current = this._lerp(this.high.current, this.high.target, smoothing);
        this.hue.current = this._lerp(this.hue.current, this.hue.target, smoothing);
        
        // Decay targets
        this.bass.target *= 0.95;
        this.energy.target *= 0.98;
        
        // Update visuals
        this._updateParticles(elapsed);
        this._updateCenterMesh(elapsed);
        this._updateRings(elapsed);
        this._updateGlow(elapsed);
        this._updateColors();
        this._updateCamera(elapsed);
        
        this.renderer.render(this.scene, this.camera);
        this._updateFps();
    }

    _updateParticles(elapsed) {
        if (!this.particles) return;
        
        const positions = this.particles.geometry.attributes.position.array;
        const original = this.particleOriginalPositions;
        const phases = this.particlePhases;
        
        const energy = this.energy.current;
        const bass = this.bass.current;
        
        for (let i = 0; i < positions.length / 3; i++) {
            const i3 = i * 3;
            const ox = original[i3];
            const oy = original[i3 + 1];
            const oz = original[i3 + 2];
            
            const dist = Math.sqrt(ox * ox + oy * oy + oz * oz);
            const phase = phases[i];
            
            // Gentle breathing motion
            const breathe = Math.sin(elapsed * 0.5 + phase) * 0.02;
            // Energy expansion
            const expansion = 1 + energy * 0.15 + bass * 0.1;
            // Subtle wave
            const wave = Math.sin(elapsed * 0.8 + dist * 0.02 + phase) * energy * 3;
            
            const scale = expansion + breathe;
            const nx = ox / dist;
            const ny = oy / dist;
            const nz = oz / dist;
            
            positions[i3] = ox * scale + nx * wave;
            positions[i3 + 1] = oy * scale + ny * wave;
            positions[i3 + 2] = oz * scale + nz * wave;
        }
        
        this.particles.geometry.attributes.position.needsUpdate = true;
        
        // Slow rotation
        this.particles.rotation.y = elapsed * 0.02;
        this.particles.rotation.x = Math.sin(elapsed * 0.1) * 0.1;
    }

    _updateCenterMesh(elapsed) {
        if (!this.centerMesh) return;
        
        const positions = this.centerMesh.geometry.attributes.position.array;
        const original = this.centerOriginalPositions;
        
        const energy = this.energy.current;
        const bass = this.bass.current;
        
        for (let i = 0; i < positions.length; i += 3) {
            const ox = original[i];
            const oy = original[i + 1];
            const oz = original[i + 2];
            
            const dist = Math.sqrt(ox * ox + oy * oy + oz * oz);
            
            // Gentle morphing
            const morph = Math.sin(elapsed * 2 + i * 0.1) * energy * 1.5;
            // Bass pulse
            const pulse = 1 + bass * 0.2;
            
            const scale = pulse;
            
            positions[i] = ox * scale + (ox / dist) * morph;
            positions[i + 1] = oy * scale + (oy / dist) * morph;
            positions[i + 2] = oz * scale + (oz / dist) * morph;
        }
        
        this.centerMesh.geometry.attributes.position.needsUpdate = true;
        
        // Smooth rotation
        this.centerMesh.rotation.x = elapsed * 0.1;
        this.centerMesh.rotation.y = elapsed * 0.15;
    }

    _updateRings(elapsed) {
        const energy = this.energy.current;
        const bass = this.bass.current;
        
        this.rings.forEach((ring, i) => {
            const data = ring.userData;
            
            // Subtle scale pulse
            const pulse = 1 + bass * 0.1 * (1 - i * 0.2);
            ring.scale.set(pulse, pulse, 1);
            
            // Smooth rotation
            ring.rotation.z = elapsed * data.rotationSpeed * (i % 2 === 0 ? 1 : -1);
            
            // Gentle tilt based on energy
            const tilt = Math.sin(elapsed * 0.5 + data.phase) * energy * 0.15;
            ring.rotation.x = Math.PI / 2 + tilt;
            ring.rotation.y = tilt * 0.5;
            
            // Opacity based on energy
            ring.material.opacity = 0.15 + energy * 0.2;
        });
    }

    _updateGlow(elapsed) {
        if (!this.glowMesh) return;
        
        const energy = this.energy.current;
        const bass = this.bass.current;
        
        // Pulse glow
        const scale = 1 + energy * 0.3 + bass * 0.2;
        this.glowMesh.scale.set(scale, scale, scale);
        this.glowMesh.material.opacity = 0.05 + energy * 0.1;
        
        // Slow rotation
        this.glowMesh.rotation.y = elapsed * 0.05;
    }

    _updateColors() {
        const hue = this.hue.current / 360;
        const energy = this.energy.current;
        
        // Main color
        const mainColor = new THREE.Color();
        mainColor.setHSL(hue, 0.6, 0.5 + energy * 0.2);
        
        // Secondary color (complementary)
        const secColor = new THREE.Color();
        secColor.setHSL((hue + 0.3) % 1, 0.5, 0.4);
        
        // Update center mesh
        if (this.centerMesh) {
            this.centerMesh.material.color.lerp(mainColor, 0.1);
            this.centerMesh.material.emissive.setHSL(hue, 0.3, 0.1 + energy * 0.1);
        }
        
        // Update rings with gradient
        this.rings.forEach((ring, i) => {
            const ringHue = (hue + i * 0.08) % 1;
            const ringColor = new THREE.Color();
            ringColor.setHSL(ringHue, 0.5, 0.5);
            ring.material.color.lerp(ringColor, 0.1);
        });
        
        // Update glow
        if (this.glowMesh) {
            this.glowMesh.material.color.lerp(mainColor, 0.1);
        }
        
        // Update particles with subtle variation
        if (this.particles) {
            const colors = this.particles.geometry.attributes.color.array;
            for (let i = 0; i < colors.length; i += 3) {
                const particleHue = (hue + (i / colors.length) * 0.15) % 1;
                const c = new THREE.Color();
                c.setHSL(particleHue, 0.5 + energy * 0.2, 0.5 + energy * 0.2);
                
                // Smooth color transition
                colors[i] += (c.r - colors[i]) * 0.05;
                colors[i + 1] += (c.g - colors[i + 1]) * 0.05;
                colors[i + 2] += (c.b - colors[i + 2]) * 0.05;
            }
            this.particles.geometry.attributes.color.needsUpdate = true;
        }
        
        // Update lights
        if (this.mainLight) {
            this.mainLight.color.lerp(mainColor, 0.1);
        }
        if (this.secondLight) {
            this.secondLight.color.lerp(secColor, 0.1);
        }
    }

    _updateCamera(elapsed) {
        // Very subtle camera movement
        const radius = 120;
        const speed = 0.05;
        
        this.camera.position.x = Math.sin(elapsed * speed) * 15;
        this.camera.position.y = Math.cos(elapsed * speed * 0.7) * 10;
        this.camera.position.z = radius + Math.sin(elapsed * speed * 0.5) * 10;
        
        this.camera.lookAt(0, 0, 0);
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

window.Visualizer = Visualizer;