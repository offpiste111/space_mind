#!/bin/bash

# Activate the virtual environment
source env/bin/activate

# Start the Python backend in the background
python main.py true &

# Start the Vite frontend development server in the background
npm run dev &

# Wait for background processes to keep the script running
wait
