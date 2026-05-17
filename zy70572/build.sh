#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC_DIR="$SCRIPT_DIR/src/main/java"
CLASSES_DIR="$SCRIPT_DIR/classes"
TARGET_DIR="$SCRIPT_DIR/target"
JAR_FILE="$TARGET_DIR/dependency-conflict-cli-1.0.0.jar"
MAIN_CLASS="com.maven.dependency.cli.ConflictAnalyzerCommand"

echo "========================================"
echo "  Maven Dependency Conflict CLI - Build"
echo "========================================"
echo ""

# Check Java
if ! command -v javac &> /dev/null; then
    echo "Error: javac not found. Please install Java JDK 11 or higher."
    exit 1
fi

JAVA_VERSION=$(javac -version 2>&1 | cut -d' ' -f2 | cut -d'.' -f1)
echo "Java version: $JAVA_VERSION"
echo ""

# Clean previous build
echo "[1/4 Cleaning previous build..."
rm -rf "$CLASSES_DIR"
mkdir -p "$CLASSES_DIR"

# Compile
echo "[2/4] Compiling Java sources..."
JAVA_FILES=$(find "$SRC_DIR" -name "*.java" | sort)
if [ -z "$JAVA_FILES" ]; then
    echo "Error: No Java source files found in $SRC_DIR"
    exit 1
fi

FILE_COUNT=$(echo "$JAVA_FILES" | wc -l | tr -d ' ')
echo "Found $FILE_COUNT source files"

# Compile
echo "$JAVA_FILES" | xargs javac -d "$CLASSES_DIR" -sourcepath "$SRC_DIR" -encoding UTF-8
echo "Compilation successful!"
echo ""

# Create manifest for jar..."
mkdir -p "$TARGET_DIR"
cd "$CLASSES_DIR"
echo "Main-Class: $MAIN_CLASS" > MANIFEST.MF

# Try to create jar (optional, only if jar is needed
if command -v jar &> /dev/null; then
    echo "[3/4] Creating JAR file..."
    jar cfm "$JAR_FILE" MANIFEST.MF $(find . -name "*.class")
    echo "JAR created: $JAR_FILE"
else
    echo "[3/4] Skipping JAR creation (jar command not found) - classes mode will be used"
fi
rm -f MANIFEST.MF

echo ""
echo "[4/4] Build complete!"
echo ""
echo "========================================"
echo "  Usage:"
echo "========================================"
echo ""
echo "  ./run.sh --help"
echo "  ./run.sh sample-dependency-tree.txt"
echo ""
if [ -f "$JAR_FILE" ]; then
    echo "  java -jar target/dependency-conflict-cli-1.0.0.jar sample-dependency-tree.txt"
fi
echo ""
