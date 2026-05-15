#!/bin/bash

echo "=== API Dependency Admission Check Service ==="
echo ""
echo "Installing dependencies..."
go mod tidy

echo ""
echo "Running tests..."
go test ./... -v

echo ""
echo "Starting server on :8080..."
go run cmd/server/main.go
