#!/bin/bash

JAVA_CMD=${JAVA_HOME:+$JAVA_HOME/bin/}java

if ! command -v "$JAVA_CMD" &> /dev/null; then
    echo "Error: Java not found. Please install Java 11 or higher."
    exit 1
fi

JAR_FILE="target/dependency-conflict-cli-1.0.0.jar"

if [ ! -f "$JAR_FILE" ]; then
    echo "JAR file not found. Please build first with: mvn clean package"
    exit 1
fi

"$JAVA_CMD" -jar "$JAR_FILE" "$@"
