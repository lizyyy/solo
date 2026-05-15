#!/bin/bash
# 快速演示脚本 - 仅编译验证，不启动服务

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
MAVEN_VERSION="3.8.8"
MAVEN_DIR="$PROJECT_DIR/.maven"
MAVEN_HOME="$MAVEN_DIR/apache-maven-$MAVEN_VERSION"
MAVEN_TAR="$MAVEN_DIR/apache-maven-$MAVEN_VERSION-bin.tar.gz"
MAVEN_URL="https://archive.apache.org/dist/maven/maven-3/$MAVEN_VERSION/binaries/apache-maven-$MAVEN_VERSION-bin.tar.gz"

echo "========================================"
echo "设备命令确认 API - 快速编译验证"
echo "========================================"

# 检查 Java
echo ""
echo "[1/3] 检查 Java 环境..."
java -version
echo ""

# 下载 Maven
echo "[2/3] 准备 Maven..."
if [ ! -d "$MAVEN_HOME" ]; then
    echo "正在下载 Maven $MAVEN_VERSION..."
    mkdir -p "$MAVEN_DIR"
    curl -s -L -o "$MAVEN_TAR" "$MAVEN_URL"
    echo "解压 Maven..."
    tar -xzf "$MAVEN_TAR" -C "$MAVEN_DIR"
    rm "$MAVEN_TAR"
fi
export PATH="$MAVEN_HOME/bin:$PATH"

# 编译
echo ""
echo "[3/3] 编译项目..."
cd "$PROJECT_DIR"
rm -rf target
"$MAVEN_HOME/bin/mvn" clean package -DskipTests -q

if [ -f "target/device-command-confirmation-api-1.0.0.jar" ]; then
    echo ""
    echo "========================================"
    echo "✅ 编译成功!"
    echo "JAR 包: target/device-command-confirmation-api-1.0.0.jar"
    echo "大小: $(du -h target/device-command-confirmation-api-1.0.0.jar | cut -f1)"
    echo ""
    echo "启动服务: ./start.sh"
    echo "运行测试: ./test-api.sh (服务启动后)"
    echo "========================================"
else
    echo "❌ 编译失败"
    exit 1
fi
