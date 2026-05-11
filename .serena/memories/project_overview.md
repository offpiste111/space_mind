
## Project Purpose

This project is a desktop application for visualizing and interacting with 3D mind maps or network graphs. It uses a hybrid architecture with a Python backend and a web-based frontend.

## Tech Stack

- **Backend**: Python, Eel (for Python/JS communication), Bottle (as a web server for Eel).
- **Frontend**: React, TypeScript, Vite, Three.js (for 3D rendering), D3.js (for force-directed graph physics).
- **Packaging**: PyInstaller is used to package the application into a standalone executable.

## Codebase Structure

- `main.py`: The main backend entry point. It handles application startup, file I/O (open/save dialogs), and, crucially, dynamically generates images for graph nodes from HTML/CSS templates.
- `web_src/`: Contains the source code for the frontend React/TypeScript application.
- `web_src/MindMapGraph.tsx`: The core frontend component. It manages the graph state, user interactions (clicks, drags), 3D rendering via `react-force-graph-3d`, layout algorithms, and undo/redo functionality.
- `web_src/App.tsx`: The main entry point for the React application. It is intended to host the `MindMapGraph.tsx` component and bridge communication with the Python backend. It currently contains placeholder code.
- `py_src/`: Contains helper Python modules used by `main.py`.
- `dist_vite/`: The output directory for the built frontend assets, used when running in production mode.
