#!/bin/bash

# 资源标签继承 API 打包脚本

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================"
echo "  资源标签继承 API - 打包脚本"
echo "========================================"
echo ""

# 确保 mvnw 存在
if [ ! -f "mvnw" ]; then
    echo "📦 正在设置 Maven Wrapper..."
    mkdir -p .mvn/wrapper
    cat > .mvn/wrapper/maven-wrapper.properties << 'EOF'
distributionUrl=https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.2.0/maven-wrapper-3.2.0.jar
EOF
    cat > mvnw << 'MVNEOF'
#!/bin/sh
set -e
if command -v mvn &> /dev/null; then
    exec mvn "$@"
fi
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WRAPPER_JAR="$SCRIPT_DIR/.mvn/wrapper/maven-wrapper.jar"
if [ ! -f "$WRAPPER_JAR" ]; then
    echo "Downloading Maven Wrapper..."
    mkdir -p "$(dirname "$WRAPPER_JAR")"
    curl -s -o "$WRAPPER_JAR" "https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.2.0/maven-wrapper-3.2.0.jar"
fi
exec java -jar "$WRAPPER_JAR" "$@"
MVNEOF
    chmod +x mvnw
fi

echo ""
echo "🔨 正在编译打包..."
echo ""

./mvnw clean package -DskipTests

echo ""
echo "✅ 打包完成！"
echo ""
echo "Jar 文件位置: target/tag-inheritance-api-1.0.0.jar"
echo ""
echo "运行方式: java -jar target/tag-inheritance-api-1.0.0.jar"
