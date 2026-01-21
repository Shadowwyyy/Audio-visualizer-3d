// Three.js scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ 
    canvas: document.getElementById('canvas'),
    antialias: true,
    alpha: true 
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

// Color variables
let selectedMeshColor = '#00ff88';
let baseColorRGB = hexToRgb(selectedMeshColor);
let complementaryColorRGB = getComplementaryColor(baseColorRGB);

// Mesh variables
let currentGeometry;
let mesh;
let material;
let originalVertices;
let previousDisplacements = [];
const smoothingFactor = 0.3;

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255
    } : null;
}

function getComplementaryColor(rgb) {
    const max = Math.max(rgb.r, rgb.g, rgb.b);
    const min = Math.min(rgb.r, rgb.g, rgb.b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case rgb.r: h = ((rgb.g - rgb.b) / d + (rgb.g < rgb.b ? 6 : 0)) / 6; break;
            case rgb.g: h = ((rgb.b - rgb.r) / d + 2) / 6; break;
            case rgb.b: h = ((rgb.r - rgb.g) / d + 4) / 6; break;
        }
    }

    h = (h + 0.5) % 1;

    if (s === 0) {
        return { r: l, g: l, b: l };
    }
    
    const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return {
        r: hue2rgb(p, q, h + 1/3),
        g: hue2rgb(p, q, h),
        b: hue2rgb(p, q, h - 1/3)
    };
}

function createGeometry(type) {
    switch(type) {
        case 'sphere':
            return new THREE.SphereGeometry(2, 128, 128);
        case 'torus':
            return new THREE.TorusGeometry(1.5, 0.6, 64, 128);
        case 'torusKnot':
            return new THREE.TorusKnotGeometry(1.3, 0.5, 128, 32);
        case 'cube':
            return new THREE.BoxGeometry(2.5, 2.5, 2.5, 32, 32, 32);
        case 'icosahedron':
            return new THREE.IcosahedronGeometry(2, 5);
        case 'octahedron':
            return new THREE.OctahedronGeometry(2, 5);
        case 'dodecahedron':
            return new THREE.DodecahedronGeometry(2, 5);
        case 'tetrahedron':
            return new THREE.TetrahedronGeometry(2, 5);
        case 'cylinder':
            return new THREE.CylinderGeometry(1.5, 1.5, 3, 64, 32);
        case 'cone':
            return new THREE.ConeGeometry(2, 3, 64, 32);
        case 'ring':
            return new THREE.RingGeometry(1, 2, 64, 32);
        case 'plane':
            return new THREE.PlaneGeometry(4, 4, 64, 64);
        case 'circle':
            return new THREE.CircleGeometry(2, 64);
        case 'capsule':
            return new THREE.CylinderGeometry(1, 1, 2, 32, 32);
        case 'pyramid':
            return new THREE.ConeGeometry(2, 3, 4, 32);
        case 'star':
            const starShape = new THREE.Shape();
            const outerRadius = 2;
            const innerRadius = 1;
            const spikes = 5;
            for (let i = 0; i < spikes * 2; i++) {
                const angle = (i / (spikes * 2)) * Math.PI * 2;
                const radius = i % 2 === 0 ? outerRadius : innerRadius;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                if (i === 0) starShape.moveTo(x, y);
                else starShape.lineTo(x, y);
            }
            return new THREE.ShapeGeometry(starShape, 32);
        case 'heart':
            const heartShape = new THREE.Shape();
            heartShape.moveTo(0, -1);
            heartShape.bezierCurveTo(0, -2.5, -2, -2.5, -2, -1);
            heartShape.bezierCurveTo(-2, 0, -2, 1, 0, 2);
            heartShape.bezierCurveTo(2, 1, 2, 0, 2, -1);
            heartShape.bezierCurveTo(2, -2.5, 0, -2.5, 0, -1);
            return new THREE.ShapeGeometry(heartShape, 32);
        case 'diamond':
            return new THREE.OctahedronGeometry(2, 0);
        case 'hexagon':
            return new THREE.CylinderGeometry(2, 2, 0.5, 6, 1, false);
        case 'spiral':
            const spiralGeometry = new THREE.BufferGeometry();
            const vertices = [];
            const spiralTurns = 5;
            const points = 500;
            for (let i = 0; i <= points; i++) {
                const t = (i / points) * spiralTurns * Math.PI * 2;
                const radius = 0.1 + (i / points) * 2;
                vertices.push(
                    Math.cos(t) * radius,
                    (i / points) * 3 - 1.5,
                    Math.sin(t) * radius
                );
            }
            spiralGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            return spiralGeometry;
        default:
            return new THREE.SphereGeometry(2, 128, 128);
    }
}

function initMesh(type = 'sphere') {
    if (mesh) {
        scene.remove(mesh);
        currentGeometry.dispose();
    }

    currentGeometry = createGeometry(type);
    
    const colors = new Float32Array(currentGeometry.attributes.position.count * 3);
    currentGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    material = new THREE.MeshPhongMaterial({
        color: selectedMeshColor,
        wireframe: true,
        emissive: selectedMeshColor,
        emissiveIntensity: 0.2,
        transparent: true,
        opacity: 0.8,
        vertexColors: true
    });
    
    mesh = new THREE.Mesh(currentGeometry, material);
    scene.add(mesh);

    originalVertices = currentGeometry.attributes.position.array.slice();
    previousDisplacements = new Array(originalVertices.length / 3).fill(1);
}

// Lights
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xffffff, 1);
pointLight.position.set(5, 5, 5);
scene.add(pointLight);

camera.position.z = 5;

// Initialize with sphere
initMesh('sphere');

// Smoothing function
function smoothDisplacement(currentDisplacement, previousDisplacement) {
    return previousDisplacement + (currentDisplacement - previousDisplacement) * smoothingFactor;
}

// Update mesh color
function updateMeshColor(color) {
    selectedMeshColor = color;
    baseColorRGB = hexToRgb(selectedMeshColor);
    complementaryColorRGB = getComplementaryColor(baseColorRGB);
    material.color = new THREE.Color(selectedMeshColor);
    material.emissive = new THREE.Color(selectedMeshColor);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    mesh.rotation.x += 0.001;
    mesh.rotation.y += 0.002;

    if (isPlaying && analyser) {
        analyser.getByteFrequencyData(dataArray);
        
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        
        const positions = currentGeometry.attributes.position.array;
        const colors = currentGeometry.attributes.color.array;
        
        for (let i = 0; i < positions.length; i += 3) {
            const vertexIndex = i / 3;
            const vertex = new THREE.Vector3(
                originalVertices[i],
                originalVertices[i + 1],
                originalVertices[i + 2]
            );
            
            const freqIndex = Math.floor(vertexIndex % dataArray.length);
            const frequency = dataArray[freqIndex] / 255;
            
            const targetDisplacement = 1 + frequency * 0.5 + (average / 255) * 0.2;
            const smoothedDisplacement = smoothDisplacement(targetDisplacement, previousDisplacements[vertexIndex]);
            previousDisplacements[vertexIndex] = smoothedDisplacement;
            
            vertex.multiplyScalar(smoothedDisplacement);
            
            positions[i] = vertex.x;
            positions[i + 1] = vertex.y;
            positions[i + 2] = vertex.z;
            
            const intensity = (smoothedDisplacement - 1) / 0.7;
            
            let r, g, b;
            
            if (intensity < 0.25) {
                const t = intensity / 0.25;
                r = complementaryColorRGB.r * t * 0.5;
                g = complementaryColorRGB.g * t * 0.5;
                b = complementaryColorRGB.b * t * 0.5;
            } else if (intensity < 0.5) {
                const t = (intensity - 0.25) / 0.25;
                r = complementaryColorRGB.r * (0.5 + t * 0.3);
                g = complementaryColorRGB.g * (0.5 + t * 0.3);
                b = complementaryColorRGB.b * (0.5 + t * 0.3);
            } else if (intensity < 0.75) {
                const t = (intensity - 0.5) / 0.25;
                r = complementaryColorRGB.r * 0.8 + (1 - complementaryColorRGB.r * 0.8) * t;
                g = complementaryColorRGB.g * 0.8 + (1 - complementaryColorRGB.g * 0.8) * t;
                b = complementaryColorRGB.b * 0.8 + (1 - complementaryColorRGB.b * 0.8) * t;
            } else {
                const t = (intensity - 0.75) / 0.25;
                r = 1;
                g = (1 - t) * 0.5;
                b = (1 - t) * 0.2;
                
                if (intensity > 0.9) {
                    const flash = Math.sin(Date.now() * 0.01) * 0.5 + 0.5;
                    r = 1;
                    g = flash * 0.2;
                    b = flash * 0.1;
                }
            }
            
            colors[i] = r;
            colors[i + 1] = g;
            colors[i + 2] = b;
        }
        
        currentGeometry.attributes.position.needsUpdate = true;
        currentGeometry.attributes.color.needsUpdate = true;
        
        const bass = dataArray.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
        material.emissiveIntensity = 0.1 + (bass / 255) * 0.2;
    } else {
        const positions = currentGeometry.attributes.position.array;
        const colors = currentGeometry.attributes.color.array;
        
        for (let i = 0; i < positions.length; i += 3) {
            const vertexIndex = i / 3;
            
            const targetDisplacement = 1;
            const smoothedDisplacement = smoothDisplacement(targetDisplacement, previousDisplacements[vertexIndex]);
            previousDisplacements[vertexIndex] = smoothedDisplacement;
            
            positions[i] = originalVertices[i] * smoothedDisplacement;
            positions[i + 1] = originalVertices[i + 1] * smoothedDisplacement;
            positions[i + 2] = originalVertices[i + 2] * smoothedDisplacement;
        }
        
        for (let i = 0; i < colors.length; i += 3) {
            colors[i] = complementaryColorRGB.r * 0.5;
            colors[i + 1] = complementaryColorRGB.g * 0.5;
            colors[i + 2] = complementaryColorRGB.b * 0.5;
        }
        
        currentGeometry.attributes.position.needsUpdate = true;
        currentGeometry.attributes.color.needsUpdate = true;
    }

    renderer.render(scene, camera);
}

// Handle resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start animation
animate();