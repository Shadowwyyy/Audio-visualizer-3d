# Audio Visualizer 3D

A real-time 3D audio visualizer built with Three.js and the Web Audio API. Upload any audio file and watch reactive visuals respond to frequency data.

![Demo](assets/demo.gif)

## Features

- 20 different 3D shapes (sphere, torus, torus knot, icosahedron, etc.)
- Real-time vertex displacement based on audio frequency
- Customizable mesh and background colors
- Draggable and resizable control panel
- Seek bar with time display
- Keyboard shortcut (H) to toggle UI

## Tech Stack

- Three.js for WebGL rendering
- Web Audio API for frequency analysis
- Vanilla JavaScript (no frameworks)

## How It Works

1. Audio is loaded and connected to an AnalyserNode
2. On each frame, frequency data is extracted using getByteFrequencyData()
3. Each vertex of the 3D mesh is displaced based on its mapped frequency bin
4. Vertex colors shift from cool to warm based on displacement intensity
5. Smoothing is applied to prevent jittery movement

## Run Locally

```bash
# Clone the repo
git clone https://github.com/Shadowwyyy/audio-visualizer-3d.git

# Open index.html in your browser
# Or use a local server:
npx serve .
```

## Usage

1. Click "Upload" to select an audio file
2. Press Play
3. Use the shape dropdown to switch geometries
4. Customize colors with the Mesh and BG buttons
5. Press H to hide/show controls

## License

MIT
