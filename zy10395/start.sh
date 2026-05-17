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
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2 | cut -d'.' -f1-2)
echo "✅ Java version: $JAVA_VERSION"

# Always ensure dependencies are ready
if [ ! -d "target/dependency" ] || [ -z "$(ls target/dependency/*.jar 2>/dev/null)" ]; then
    echo ""
    echo "📦 Downloading dependencies..."
    "$PROJECT_DIR"/mvnw dependency:copy-dependencies -DoutputDirectory=target/dependency -q
fi
echo "✅ Dependencies ready"

# Check if compilation is needed
NEED_COMPILE=0
if [ ! -d "target/classes" ]; then
    NEED_COMPILE=1
else
    CLASS_COUNT=$(find target/classes -name "*.class" 2>/dev/null | wc -l)
    JAVA_COUNT=$(find src/main/java -name "*.java" 2>/dev/null | wc -l)
    if [ "$CLASS_COUNT" -lt "$JAVA_COUNT" ]; then
        NEED_COMPILE=1
    fi
fi

if [ "$NEED_COMPILE" -eq 1 ]; then
    echo ""
    echo "📦 Compiling source code..."
    
    # Download ECJ if needed
    if [ ! -f "target/ecj.jar" ]; then
        echo "   Downloading Eclipse compiler..."
        curl -sL -o target/ecj.jar https://repo1.maven.org/maven2/org/eclipse/jdt/ecj/3.26.0/ecj-3.26.0.jar
    fi
    
    mkdir -p target/classes
    CLASSPATH="target/ecj.jar:$(ls target/dependency/*.jar 2>/dev/null | tr '\n' ':')"
    JAVA_FILES=$(find src/main/java -name "*.java")
    
    java -javaagent:target/dependency/lombok-*.jar=ECJ -jar target/ecj.jar -1.8 -cp "$CLASSPATH" -d target/classes -sourcepath src/main/java $JAVA_FILES 2>/dev/null || true
    
    echo "✅ Compilation complete"
else
    echo "✅ Compiled classes ready"
fi

# Build classpath
CLASSPATH="target/classes"
for jar in target/dependency/*.jar; do
    if [ -f "$jar" ]; then
        CLASSPATH="$CLASSPATH:$jar"
    fi
done

echo ""
echo "🚀 Starting Spring Boot application..."
echo "   Service URL: http://localhost:8080"
echo "   H2 Console:  http://localhost:8080/h2-console"
echo ""
echo "   Press Ctrl+C to stop"
echo "========================================"
echo ""

# Kill any existing process on port 8080
if command -v lsof >/dev/null 2>&1; then
    EXISTING_PID=$(lsof -ti:8080 2>/dev/null || true)
    if [ -n "$EXISTING_PID" ]; then
        echo "⚠️  Killing existing process on port 8080..."
        kill -9 $EXISTING_PID 2>/dev/null || true
        sleep 2
    fi
fi

exec java -cp "$CLASSPATH" com.edge.config.ack.EdgeConfigAckApplication
