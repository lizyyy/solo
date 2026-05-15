#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo "========================================"
echo "  边缘节点配置签收 API - 启动脚本"
echo "========================================"
echo ""

# Check Java
if ! command -v java >/dev/null 2>&1; then
    echo "❌ Error: Java not found!"
    echo "Please install Java 8 or higher"
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2 | cut -d'.' -f1-2)
echo "✅ Java version: $JAVA_VERSION"

# Check if target/classes exists and has compiled classes
if [ -d "target/classes" ] && [ "$(ls -A target/classes 2>/dev/null)" ]; then
    echo "✅ Found compiled classes"
fi

# Download Maven if not available
MAVEN_DIR="$PROJECT_DIR/.maven"
MAVEN_HOME="$MAVEN_DIR/apache-maven-3.8.8"
MVN="$MAVEN_HOME/bin/mvn"

if [ ! -f "$MVN" ]; then
    echo ""
    echo "📦 Downloading Maven..."
    mkdir -p "$MAVEN_DIR"
    
    MAVEN_URL="https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.8.8/apache-maven-3.8.8-bin.tar.gz"
    MAVEN_TAR="$MAVEN_DIR/apache-maven-3.8.8-bin.tar.gz"
    
    if command -v curl >/dev/null 2>&1; then
        curl -L -o "$MAVEN_TAR" "$MAVEN_URL"
    elif command -v wget >/dev/null 2>&1; then
        wget -O "$MAVEN_TAR" "$MAVEN_URL"
    else
        echo "❌ Error: Neither curl nor wget found!"
        echo "Please install curl or wget to download Maven"
        exit 1
    fi
    
    echo "📦 Extracting Maven..."
    tar -xzf "$MAVEN_TAR" -C "$MAVEN_DIR"
    rm -f "$MAVEN_TAR"
    chmod +x "$MVN"
    echo "✅ Maven installed at: $MAVEN_HOME"
fi

echo ""
echo "🔨 Building project..."
echo "This may take a while on first run..."
echo ""

"$MVN" clean compile -DskipTests -q

echo ""
echo "🚀 Starting Spring Boot application..."
echo "   Service URL: http://localhost:8080"
echo "   H2 Console:  http://localhost:8080/h2-console"
echo ""
echo "   Press Ctrl+C to stop"
echo "========================================"
echo ""

"$MVN" spring-boot:run -q
