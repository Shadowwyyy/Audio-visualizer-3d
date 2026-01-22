/**
 * Three.js Audio Visualizer - Dynamic & Interactive
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
        
        // Mouse control
        this.mouse = { x: 0, y: 0 };
        this.targetRotation = { x: 0, y: 0 };
        this.currentRotation = { x: 0, y: 0 };
        this.isDragging = false;
        this.lastMouse = { x: 0, y: 0 };
        this.autoRotate = true;
        
        // Audio reactive state
        this.energy = { current: 0, target: 0 };
        this.bass = { current: 0, target: 0 };
        this.mid = { current: 0, target: 0 };
        this.high = { current: 0, target: 0 };
        this.hue = { current: 200, target: 200 };
        
        // Settings
        this.settings = {
            sensitivity: 1.5,
            smoothing: 0.85,
            colorMode: 'pitch',
            shape: 'sphere',
            backgroundColor: '#000011',
            particleCount: 1500,
            reactivity: 1.0
        };
        
        // FPS
        this.fps = 0;
        this.frameCount = 0;
        this.lastFpsUpdate = 0;
        
        this._init();
        this._setupMouseControls();
    }

    _init() {
        this.scene = new THREE.Scene();
        this._updateBackgroundColor();

        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 2000);
        this.camera.position.z = 120;

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.container.appendChild(this.renderer.domElement);

        this._createParticles();
        this._createCenterMesh();
        this._createRings();
        this._createGlow();
        this._createLights();

        window.addEventListener('resize', () => this._onResize());
    }

    _setupMouseControls() {
        const canvas = this.renderer.domElement;
        
        canvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.autoRotate = false;
            this.lastMouse.x = e.clientX;
            this.lastMouse.y = e.clientY;
        });
        
        canvas.addEventListener('mousemove', (e) => {
            // Track mouse for ambient effect
            this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            
            if (this.isDragging) {
                const deltaX = e.clientX - this.lastMouse.x;
                const deltaY = e.clientY - this.lastMouse.y;
                
                this.targetRotation.y += deltaX * 0.005;
                this.targetRotation.x += deltaY * 0.005;
                
                // Clamp vertical rotation
                this.targetRotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.targetRotation.x));
                
                this.lastMouse.x = e.clientX;
                this.lastMouse.y = e.clientY;
            }
        });
        
        canvas.addEventListener('mouseup', () => {
            this.isDragging = false;
            // Resume auto-rotate after 3 seconds of no interaction
            setTimeout(() => {
                if (!this.isDragging) this.autoRotate = true;
            }, 3000);
        });
        
        canvas.addEventListener('mouseleave', () => {
            this.isDragging = false;
        });
        
        // Touch support
        canvas.addEventListener('touchstart', (e) => {
            this.isDragging = true;
            this.autoRotate = false;
            this.lastMouse.x = e.touches[0].clientX;
            this.lastMouse.y = e.touches[0].clientY;
        });
        
        canvas.addEventListener('touchmove', (e) => {
            if (this.isDragging && e.touches.length === 1) {
                const deltaX = e.touches[0].clientX - this.lastMouse.x;
                const deltaY = e.touches[0].clientY - this.lastMouse.y;
                
                this.targetRotation.y += deltaX * 0.005;
                this.targetRotation.x += deltaY * 0.005;
                this.targetRotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.targetRotation.x));
                
                this.lastMouse.x = e.touches[0].clientX;
                this.lastMouse.y = e.touches[0].clientY;
            }
        });
        
        canvas.addEventListener('touchend', () => {
            this.isDragging = false;
            setTimeout(() => {
                if (!this.isDragging) this.autoRotate = true;
            }, 3000);
        });
        
        // Scroll to zoom
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.camera.position.z += e.deltaY * 0.1;
            this.camera.position.z = Math.max(50, Math.min(250, this.camera.position.z));
        }, { passive: false });
    }

    _createParticles() {
        if (this.particles) {
            this.scene.remove(this.particles);
            this.particles.geometry.dispose();
            this.particles.material.dispose();
        }
        
        const count = this.settings.particleCount;
        const geometry = new THREE.BufferGeometry();
        
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        const phases = new Float32Array(count);
        
        for (let i = 0; i < count; i++) {
            const radius = 35 + Math.pow(Math.random(), 0.6) * 130;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = radius * Math.cos(phi);
            
            colors[i * 3] = 0.4;
            colors[i * 3 + 1] = 0.7;
            colors[i * 3 + 2] = 1.0;
            
            sizes[i] = 0.5 + Math.random() * 2;
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
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true
        });
        
        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    }

    _createCenterMesh() {
        if (this.centerMesh) {
            this.scene.remove(this.centerMesh);
            this.centerMesh.geometry.dispose();
            this.centerMesh.material.dispose();
        }
        
        let geometry;
        switch (this.settings.shape) {
            case 'cube':
                geometry = new THREE.BoxGeometry(20, 20, 20, 8, 8, 8);
                break;
            case 'torus':
                geometry = new THREE.TorusGeometry(12, 5, 16, 50);
                break;
            case 'octahedron':
                geometry = new THREE.OctahedronGeometry(15, 2);
                break;
            case 'torusKnot':
                geometry = new THREE.TorusKnotGeometry(10, 3, 100, 16);
                break;
            case 'icosahedron':
                geometry = new THREE.IcosahedronGeometry(14, 1);
                break;
            case 'sphere':
            default:
                geometry = new THREE.IcosahedronGeometry(14, 3);
                break;
        }
        
        const material = new THREE.MeshPhongMaterial({
            color: 0x4488ff,
            emissive: 0x112244,
            wireframe: true,
            transparent: true,
            opacity: 0.9
        });
        
        this.centerMesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.centerMesh);
        
        this.centerOriginalPositions = geometry.attributes.position.array.slice();
    }

    _createRings() {
        // Clear existing rings
        this.rings.forEach(ring => {
            this.scene.remove(ring);
            ring.geometry.dispose();
            ring.material.dispose();
        });
        this.rings = [];
        
        const ringCount = 5;
        
        for (let i = 0; i < ringCount; i++) {
            const radius = 18 + i * 10;
            const geometry = new THREE.TorusGeometry(radius, 0.2, 16, 100);
            const material = new THREE.MeshBasicMaterial({
                color: 0x4488ff,
                transparent: true,
                opacity: 0.25,
                blending: THREE.AdditiveBlending
            });
            
            const ring = new THREE.Mesh(geometry, material);
            ring.rotation.x = Math.PI / 2;
            ring.userData = { 
                baseRadius: radius, 
                index: i,
                rotationSpeed: 0.2 + i * 0.1,
                phase: i * Math.PI / 3
            };
            
            this.rings.push(ring);
            this.scene.add(ring);
        }
    }

    _createGlow() {
        if (this.glowMesh) {
            this.scene.remove(this.glowMesh);
            this.glowMesh.geometry.dispose();
            this.glowMesh.material.dispose();
        }
        
        const geometry = new THREE.SphereGeometry(22, 32, 32);
        const material = new THREE.MeshBasicMaterial({
            color: 0x4488ff,
            transparent: true,
            opacity: 0.08,
            blending: THREE.AdditiveBlending
        });
        
        this.glowMesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.glowMesh);
    }

    _createLights() {
        // Remove existing lights
        this.scene.children
            .filter(c => c.isLight)
            .forEach(l => this.scene.remove(l));
        
        const ambient = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambient);
        
        const point1 = new THREE.PointLight(0x4488ff, 1.2, 300);
        point1.position.set(60, 60, 60);
        this.scene.add(point1);
        this.mainLight = point1;
        
        const point2 = new THREE.PointLight(0xff4488, 0.6, 250);
        point2.position.set(-60, -40, 60);
        this.scene.add(point2);
        this.secondLight = point2;
    }

    _updateBackgroundColor() {
        const color = new THREE.Color(this.settings.backgroundColor);
        this.scene.background = color;
        this.scene.fog = new THREE.FogExp2(color, 0.006);
    }

    _onResize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }

    // ==========================================
    // Public API
    // ==========================================

    setShape(shape) {
        this.settings.shape = shape;
        this._createCenterMesh();
    }

    setBackgroundColor(color) {
        this.settings.backgroundColor = color;
        this._updateBackgroundColor();
    }

    setParticleCount(count) {
        this.settings.particleCount = count;
        this._createParticles();
    }

    setReactivity(value) {
        this.settings.reactivity = value;
    }

    onBeat(intensity) {
        this.bass.target = Math.min(1.5, this.bass.target + intensity * 0.8 * this.settings.reactivity);
    }

    onSegment(data) {
        this.hue.target = data.hue;
        this.energy.target = data.loudness * this.settings.reactivity;
    }

    onSection(data) {}

    updateFromSegment(segment) {
        if (!segment) return;
        const loudness = Math.min(1, Math.max(0, (segment.loudness + 60) / 60));
        this.energy.target = loudness * this.settings.sensitivity * this.settings.reactivity;
        
        if (segment.pitches && segment.pitches.length === 12) {
            const maxPitch = Math.max(...segment.pitches);
            const pitchIndex = segment.pitches.indexOf(maxPitch);
            this.hue.target = (pitchIndex / 12) * 360;
        }
    }

    updateFromAnalyser(frequencyData, waveformData) {
        if (!frequencyData || !frequencyData.length) return;
        
        const len = frequencyData.length;
        const bassEnd = Math.floor(len * 0.1);
        const midEnd = Math.floor(len * 0.5);
        
        let bassSum = 0, midSum = 0, highSum = 0;
        
        for (let i = 0; i < len; i++) {
            const val = frequencyData[i] / 255;
            if (i < bassEnd) bassSum += val;
            else if (i < midEnd) midSum += val;
            else highSum += val;
        }
        
        const r = this.settings.reactivity;
        this.bass.target = (bassSum / bassEnd) * this.settings.sensitivity * r;
        this.mid.target = (midSum / (midEnd - bassEnd)) * this.settings.sensitivity * r;
        this.high.target = (highSum / (len - midEnd)) * this.settings.sensitivity * r;
        
        this.energy.target = (this.bass.target * 0.5 + this.mid.target * 0.35 + this.high.target * 0.15);
        this.hue.target = this.mid.target * 360;
    }

    updateSettings(settings) {
        const prevShape = this.settings.shape;
        const prevBg = this.settings.backgroundColor;
        
        Object.assign(this.settings, settings);
        
        if (settings.shape && settings.shape !== prevShape) {
            this._createCenterMesh();
        }
        if (settings.backgroundColor && settings.backgroundColor !== prevBg) {
            this._updateBackgroundColor();
        }
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

    _lerp(current, target, factor) {
        return current + (target - current) * factor;
    }

    _animate() {
        if (!this.isRunning) return;
        this.frameId = requestAnimationFrame(() => this._animate());
        
        const elapsed = this.clock.getElapsedTime();
        const lerpFactor = 1 - this.settings.smoothing;
        
        // Smooth values
        this.energy.current = this._lerp(this.energy.current, this.energy.target, lerpFactor);
        this.bass.current = this._lerp(this.bass.current, this.bass.target, lerpFactor);
        this.mid.current = this._lerp(this.mid.current, this.mid.target, lerpFactor);
        this.high.current = this._lerp(this.high.current, this.high.target, lerpFactor);
        this.hue.current = this._lerp(this.hue.current, this.hue.target, lerpFactor * 0.5);
        
        // Decay targets
        this.bass.target *= 0.92;
        this.energy.target *= 0.95;
        
        // Auto rotation
        if (this.autoRotate) {
            this.targetRotation.y += 0.003;
        }
        
        // Smooth rotation
        this.currentRotation.x = this._lerp(this.currentRotation.x, this.targetRotation.x, 0.08);
        this.currentRotation.y = this._lerp(this.currentRotation.y, this.targetRotation.y, 0.08);
        
        // Update everything
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
        const mid = this.mid.current;
        
        for (let i = 0; i < positions.length / 3; i++) {
            const i3 = i * 3;
            const ox = original[i3];
            const oy = original[i3 + 1];
            const oz = original[i3 + 2];
            
            const dist = Math.sqrt(ox * ox + oy * oy + oz * oz);
            const phase = phases[i];
            
            // More dynamic movement
            const breathe = Math.sin(elapsed * 0.8 + phase) * 0.05;
            const expansion = 1 + energy * 0.25 + bass * 0.2;
            const wave = Math.sin(elapsed * 1.2 + dist * 0.03 + phase) * (energy * 6 + 2);
            const spiral = Math.sin(elapsed * 0.5 + phase * 2) * mid * 4;
            
            const scale = expansion + breathe;
            const nx = ox / dist;
            const ny = oy / dist;
            const nz = oz / dist;
            
            positions[i3] = ox * scale + nx * wave + ny * spiral;
            positions[i3 + 1] = oy * scale + ny * wave + nz * spiral;
            positions[i3 + 2] = oz * scale + nz * wave + nx * spiral;
        }
        
        this.particles.geometry.attributes.position.needsUpdate = true;
        
        // Apply user rotation
        this.particles.rotation.x = this.currentRotation.x;
        this.particles.rotation.y = this.currentRotation.y + elapsed * 0.05;
    }

    _updateCenterMesh(elapsed) {
        if (!this.centerMesh) return;
        
        const positions = this.centerMesh.geometry.attributes.position.array;
        const original = this.centerOriginalPositions;
        
        const energy = this.energy.current;
        const bass = this.bass.current;
        const high = this.high.current;
        
        for (let i = 0; i < positions.length; i += 3) {
            const ox = original[i];
            const oy = original[i + 1];
            const oz = original[i + 2];
            
            const dist = Math.sqrt(ox * ox + oy * oy + oz * oz);
            
            // Dynamic morphing
            const morph = Math.sin(elapsed * 3 + i * 0.15) * energy * 3;
            const spike = Math.sin(elapsed * 5 + i * 0.3) * high * 2;
            const pulse = 1 + bass * 0.35 + energy * 0.15;
            
            positions[i] = ox * pulse + (ox / dist) * (morph + spike);
            positions[i + 1] = oy * pulse + (oy / dist) * (morph + spike);
            positions[i + 2] = oz * pulse + (oz / dist) * (morph + spike);
        }
        
        this.centerMesh.geometry.attributes.position.needsUpdate = true;
        
        // Apply user rotation + own rotation
        this.centerMesh.rotation.x = this.currentRotation.x + elapsed * 0.2;
        this.centerMesh.rotation.y = this.currentRotation.y + elapsed * 0.3;
    }

    _updateRings(elapsed) {
        const energy = this.energy.current;
        const bass = this.bass.current;
        
        this.rings.forEach((ring, i) => {
            const data = ring.userData;
            
            // Pulse and scale
            const pulse = 1 + bass * 0.2 + energy * 0.1;
            const wave = Math.sin(elapsed * 2 + data.phase) * energy * 0.1;
            ring.scale.set(pulse + wave, pulse + wave, 1);
            
            // Dynamic rotation
            ring.rotation.z = elapsed * data.rotationSpeed * (i % 2 === 0 ? 1 : -1);
            
            // Tilt with user control
            const baseTilt = Math.sin(elapsed * 0.7 + data.phase) * 0.3;
            const energyTilt = energy * 0.2;
            ring.rotation.x = Math.PI / 2 + baseTilt + energyTilt + this.currentRotation.x * 0.3;
            ring.rotation.y = this.currentRotation.y * 0.3 + Math.cos(elapsed * 0.5 + data.phase) * 0.2;
            
            // Opacity
            ring.material.opacity = 0.15 + energy * 0.35 + bass * 0.1;
        });
    }

    _updateGlow(elapsed) {
        if (!this.glowMesh) return;
        
        const energy = this.energy.current;
        const bass = this.bass.current;
        
        const scale = 1 + energy * 0.4 + bass * 0.3;
        const pulse = Math.sin(elapsed * 2) * 0.05 * energy;
        this.glowMesh.scale.set(scale + pulse, scale + pulse, scale + pulse);
        this.glowMesh.material.opacity = 0.05 + energy * 0.15;
        
        this.glowMesh.rotation.x = this.currentRotation.x;
        this.glowMesh.rotation.y = this.currentRotation.y;
    }

    _updateColors() {
        const hue = this.hue.current / 360;
        const energy = this.energy.current;
        const bass = this.bass.current;
        
        const mainColor = new THREE.Color();
        mainColor.setHSL(hue, 0.7, 0.45 + energy * 0.25);
        
        const secColor = new THREE.Color();
        secColor.setHSL((hue + 0.35) % 1, 0.6, 0.4 + bass * 0.2);
        
        // Center mesh
        if (this.centerMesh) {
            this.centerMesh.material.color.lerp(mainColor, 0.15);
            this.centerMesh.material.emissive.setHSL(hue, 0.4, 0.08 + energy * 0.12);
        }
        
        // Rings
        this.rings.forEach((ring, i) => {
            const ringHue = (hue + i * 0.06) % 1;
            const ringColor = new THREE.Color();
            ringColor.setHSL(ringHue, 0.6, 0.5 + energy * 0.2);
            ring.material.color.lerp(ringColor, 0.15);
        });
        
        // Glow
        if (this.glowMesh) {
            this.glowMesh.material.color.lerp(mainColor, 0.1);
        }
        
        // Particles
        if (this.particles) {
            const colors = this.particles.geometry.attributes.color.array;
            for (let i = 0; i < colors.length; i += 3) {
                const particleHue = (hue + (i / colors.length) * 0.2) % 1;
                const c = new THREE.Color();
                c.setHSL(particleHue, 0.6 + energy * 0.3, 0.5 + energy * 0.3);
                
                colors[i] += (c.r - colors[i]) * 0.08;
                colors[i + 1] += (c.g - colors[i + 1]) * 0.08;
                colors[i + 2] += (c.b - colors[i + 2]) * 0.08;
            }
            this.particles.geometry.attributes.color.needsUpdate = true;
        }
        
        // Lights
        if (this.mainLight) this.mainLight.color.lerp(mainColor, 0.1);
        if (this.secondLight) this.secondLight.color.lerp(secColor, 0.1);
    }

    _updateCamera(elapsed) {
        // Subtle breathing + mouse influence
        const breathe = Math.sin(elapsed * 0.3) * 3;
        const mouseInfluence = this.isDragging ? 0 : 0.3;
        
        this.camera.position.x = this.mouse.x * 10 * mouseInfluence;
        this.camera.position.y = this.mouse.y * 8 * mouseInfluence + breathe;
        
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