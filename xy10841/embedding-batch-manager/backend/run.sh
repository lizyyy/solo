#!/bin/bash

cd "$(dirname "$0")"

if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate

echo "Installing dependencies..."
pip install -r requirements.txt

echo "Starting server..."
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
