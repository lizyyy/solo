#!/bin/bash

PORT_INSPECTOR_HOME=$(cd "$(dirname "$0")" && pwd)

cd "$PORT_INSPECTOR_HOME"

if [ ! -d "target/classes" ] || [ -z "$(ls -A target/classes 2>/dev/null)" ]; then
    echo "Building project first..."
    bash build.sh
fi

CLASSPATH="target/classes:target/dependency/picocli/*:target/dependency/jackson/*:target/dependency/poi/*"

java -cp "$CLASSPATH" com.portinspector.PortInspectorMain "$@"
