#!/bin/bash

export SERVER_PORT=8080
export DB_PATH=prescription.db
export DEFAULT_VALIDITY_HOURS=48

echo "Starting Prescription Timeline API Server..."
echo "Server will run on port: $SERVER_PORT"
echo "Database path: $DB_PATH"

go run main.go
