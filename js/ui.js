// UI Controls
const controls = document.getElementById('controls');
const dragHandle = document.getElementById('dragHandle');
const resizeHandle = document.getElementById('resizeHandle');
const toggleUIBtn = document.getElementById('toggleUIBtn');
const shapeSelect = document.getElementById('shapeSelect');

// Shape selector
shapeSelect.addEventListener('change', (e) => {
    initMesh(e.target.value);
});

// Dragging functionality
let isDragging = false;
let isResizing = false;
let startX = 0;
let startY = 0;
let startLeft = 0;
let startTop = 0;
let startWidth = 0;

function initializePosition() {
    const rect = controls.getBoundingClientRect();
    controls.style.left = rect.left + 'px';
    controls.style.top = rect.top + 'px';
    controls.style.transform = 'none';
    controls.style.bottom = 'auto';
}

setTimeout(initializePosition, 100);

dragHandle.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = controls.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
    controls.classList.add('dragging');
    e.preventDefault();
});

resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = controls.offsetWidth;
    e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
    if (isDragging) {
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        let newLeft = startLeft + deltaX;
        let newTop = startTop + deltaY;
        
        const rect = controls.getBoundingClientRect();
        newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - rect.width));
        newTop = Math.max(0, Math.min(newTop, window.innerHeight - rect.height));
        
        controls.style.left = newLeft + 'px';
        controls.style.top = newTop + 'px';
    }
    
    if (isResizing) {
        const deltaX = e.clientX - startX;
        const newWidth = Math.max(600, Math.min(window.innerWidth - 50, startWidth + deltaX));
        controls.style.minWidth = newWidth + 'px';
    }
});

document.addEventListener('mouseup', () => {
    isDragging = false;
    isResizing = false;
    controls.classList.remove('dragging');
});

// Toggle UI visibility
let uiVisible = true;

function toggleUI() {
    uiVisible = !uiVisible;
    if (uiVisible) {
        controls.classList.remove('hidden');
        toggleUIBtn.classList.remove('controls-hidden');
        toggleUIBtn.innerHTML = '🎛️';
    } else {
        controls.classList.add('hidden');
        toggleUIBtn.classList.add('controls-hidden');
        toggleUIBtn.innerHTML = '👁️';
    }
}

toggleUIBtn.addEventListener('click', toggleUI);

document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'h' && !e.target.matches('input')) {
        toggleUI();
    }
});

// Color palettes
const colorOptions = [
    { name: 'Neon Green', hex: '#00ff88' },
    { name: 'Electric Blue', hex: '#00d4ff' },
    { name: 'Hot Pink', hex: '#ff0084' },
    { name: 'Purple', hex: '#9d00ff' },
    { name: 'Orange', hex: '#ff6b00' },
    { name: 'Cyan', hex: '#00ffff' },
    { name: 'Magenta', hex: '#ff00ff' },
    { name: 'Yellow', hex: '#ffff00' },
    { name: 'Red', hex: '#ff0040' },
    { name: 'Lime', hex: '#88ff00' },
    { name: 'Violet', hex: '#7f00ff' },
    { name: 'Coral', hex: '#ff7f50' },
    { name: 'Gold', hex: '#ffd700' },
    { name: 'Teal', hex: '#00b3b3' },
    { name: 'Rose', hex: '#ff66cc' },
    { name: 'Indigo', hex: '#4b0082' },
    { name: 'Mint', hex: '#00ff99' },
    { name: 'Sunset', hex: '#ff5e3a' },
    { name: 'Sky Blue', hex: '#87ceeb' },
    { name: 'White', hex: '#ffffff' }
];

const bgColorOptions = [
    { name: 'Purple Dream', hex: '#667eea', hex2: '#764ba2' },
    { name: 'Ocean', hex: '#0077be', hex2: '#00a8cc' },
    { name: 'Sunset', hex: '#ff6b6b', hex2: '#ffd93d' },
    { name: 'Forest', hex: '#134e4a', hex2: '#14b8a6' },
    { name: 'Space', hex: '#000428', hex2: '#004e92' },
    { name: 'Fire', hex: '#ff512f', hex2: '#dd2476' },
    { name: 'Aurora', hex: '#00c6ff', hex2: '#0072ff' },
    { name: 'Peach', hex: '#ffeaa7', hex2: '#fdcb6e' },
    { name: 'Mint', hex: '#00b09b', hex2: '#96c93d' },
    { name: 'Lavender', hex: '#a8c0ff', hex2: '#3f2b96' },
    { name: 'Cherry', hex: '#eb3349', hex2: '#f45c43' },
    { name: 'Emerald', hex: '#11998e', hex2: '#38ef7d' },
    { name: 'Royal', hex: '#536976', hex2: '#292e49' },
    { name: 'Coral', hex: '#ff9966', hex2: '#ff5e62' },
    { name: 'Deep Sea', hex: '#2e3192', hex2: '#1bffff' },
    { name: 'Grape', hex: '#8e2de2', hex2: '#4a00e0' },
    { name: 'Rose Gold', hex: '#f953c6', hex2: '#b91d73' },
    { name: 'Arctic', hex: '#e0e0e0', hex2: '#ffffff' },
    { name: 'Midnight', hex: '#0f0c29', hex2: '#302b63' },
    { name: 'Black', hex: '#000000', hex2: '#222222' }
];

// Setup color pickers
function setupColorPicker(options, paletteId, indicatorId, btnId, gridId, hexInputId, hexApplyId, isBg = false) {
    const palette = document.getElementById(paletteId);
    const indicator = document.getElementById(indicatorId);
    const btn = document.getElementById(btnId);
    const grid = document.getElementById(gridId);
    const hexInput = document.getElementById(hexInputId);
    const hexApply = document.getElementById(hexApplyId);

    options.forEach((color, index) => {
        const colorOption = document.createElement('div');
        colorOption.className = 'color-option';
        if (index === 0) colorOption.classList.add('selected');
        
        if (isBg) {
            colorOption.style.background = `linear-gradient(135deg, ${color.hex}, ${color.hex2})`;
        } else {
            colorOption.style.background = color.hex;
        }
        
        colorOption.addEventListener('click', () => {
            document.querySelectorAll(`#${gridId} .color-option`).forEach(opt => {
                opt.classList.remove('selected');
            });
            colorOption.classList.add('selected');

            if (isBg) {
                document.body.style.background = `linear-gradient(135deg, ${color.hex} 0%, ${color.hex2} 100%)`;
                indicator.style.background = `linear-gradient(135deg, ${color.hex}, ${color.hex2})`;
                hexInput.value = color.hex;
            } else {
                updateMeshColor(color.hex);
                indicator.style.background = color.hex;
                hexInput.value = color.hex;
            }

            setTimeout(() => palette.classList.remove('active'), 200);
        });
        
        grid.appendChild(colorOption);
    });

    hexApply.addEventListener('click', () => {
        const hex = hexInput.value.trim();
        const validHex = /^#?[0-9A-Fa-f]{6}$/.test(hex);
        
        if (validHex) {
            const color = hex.startsWith('#') ? hex : '#' + hex;
            
            if (isBg) {
                document.body.style.background = color;
                indicator.style.background = color;
            } else {
                updateMeshColor(color);
                indicator.style.background = color;
            }
            
            setTimeout(() => palette.classList.remove('active'), 200);
        }
    });

    hexInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            hexApply.click();
        }
    });

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        palette.classList.toggle('active');
        document.querySelectorAll('.picker-palette').forEach(p => {
            if (p !== palette) p.classList.remove('active');
        });
    });
}

setupColorPicker(colorOptions, 'meshColorPalette', 'meshColorIndicator', 'meshColorBtn', 
                'meshColorGrid', 'meshHexInput', 'meshHexApply', false);
setupColorPicker(bgColorOptions, 'bgColorPalette', 'bgColorIndicator', 'bgColorBtn', 
                'bgColorGrid', 'bgHexInput', 'bgHexApply', true);

document.addEventListener('click', (e) => {
    if (!e.target.closest('.picker-container')) {
        document.querySelectorAll('.picker-palette').forEach(p => {
            p.classList.remove('active');
        });
    }
});