
## Dependency Installation

First, install the necessary dependencies for both the frontend and backend.

- **Frontend (Node.js):**
  ```bash
  npm install
  ```
- **Backend (Python):**
  It is recommended to use a virtual environment.
  ```bash
  python -m venv env
  # Activate the environment (e.g., on Linux/macOS)
  source env/bin/activate
  # Install dependencies
  pip install -r requirements.txt
  ```

## Running in Development Mode

For development, you need to run the Vite frontend server and the Python backend simultaneously. This enables hot-reloading for the frontend.
You can use the provided `start.sh` script to run both servers in the background with the virtual environment activated:

```bash
./start.sh
```

Alternatively, you can run them manually:
- **Terminal 1 (Frontend):**
  ```bash
  npm run dev
  ```
- **Terminal 2 (Backend):**
  ```bash
  source env/bin/activate
  python main.py true
  ```

## Building for Production

To create a production-ready version of the frontend assets, run the following command. This will compile the TypeScript and bundle the files into the `dist_vite/` directory.

```bash
npm run build
```

## Running in Production Mode

After building the frontend, you can run the application in production mode. This will launch the app in a native Chrome/Edge window.

```bash
python main.py
```

## Creating a Distributable Package

To package the entire application into a single executable (e.g., `.exe` on Windows), use the command specified in the `ReadMe.md`. This uses PyInstaller.

```bash
python -m eel main.py dist_vite --onedir --splash splashfile.png --path env/lib/site-packages --noconsole
```
