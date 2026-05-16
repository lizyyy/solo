#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo "========================================"
echo "  边缘节点配置签收 API - 直接启动"
echo "========================================"
echo ""

# Check Java
if ! command -v java >/dev/null 2>&1; then
    echo "❌ Error: Java not found!"
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2 | cut -d'.' -f1-2)
echo "✅ Java version: $JAVA_VERSION"
echo ""

# Maven repository path
M2_REPO="$HOME/.m2/repository"

# Check if dependencies exist, if not download
if [ ! -d "$M2_REPO/org/springframework/boot/spring-boot-starter-web" ]; then
    echo "📦 First run: downloading dependencies..."
    echo "   This may take 3-5 minutes..."
    echo ""
    "$PROJECT_DIR"/mvnw dependency:copy-dependencies -DoutputDirectory=target/dependency -q 2>&1 || true
fi

# Build classpath
CLASSPATH="target/classes"
for jar in target/dependency/*.jar; do
    if [ -f "$jar" ]; then
        CLASSPATH="$CLASSPATH:$jar"
    fi
done

echo "🚀 Starting application..."
echo "   Service URL: http://localhost:8080"
echo "   H2 Console:  http://localhost:8080/h2-console"
echo ""
echo "   Press Ctrl+C to stop"
echo "========================================"
echo ""

exec java -cp "$CLASSPATH" com.edge.config.ack.EdgeConfigAckApplication
