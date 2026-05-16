#!/bin/bash

echo "Installing dependencies..."
pip install -r requirements.txt

echo ""
echo "Starting Migration Guardrail API Server..."
echo "API Documentation will be available at: http://localhost:8000/docs"
echo ""

python main.py
