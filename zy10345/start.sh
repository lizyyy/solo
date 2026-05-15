#!/bin/bash
# 设备命令确认 API 启动脚本
# 功能：自动下载 Maven、编译项目、启动服务

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
MAVEN_VERSION="3.8.8"
MAVEN_DIR="$PROJECT_DIR/.maven"
MAVEN_HOME="$MAVEN_DIR/apache-maven-$MAVEN_VERSION"
MAVEN_TAR="$MAVEN_DIR/apache-maven-$MAVEN_VERSION-bin.tar.gz"
MAVEN_URL="https://archive.apache.org/dist/maven/maven-3/$MAVEN_VERSION/binaries/apache-maven-$MAVEN_VERSION-bin.tar.gz"

echo "========================================"
echo "设备命令确认 API - 启动脚本"
echo "========================================"

# 检查 Java 版本
echo ""
echo "[1/5] 检查 Java 环境..."
if ! command -v java &> /dev/null; then
    echo "错误: 未找到 Java，请先安装 JDK 8 或更高版本"
    exit 1
fi
JAVA_VERSION=$(java -version 2>&1 | head -n 1 | awk -F'"' '{print $2}' | cut -d'.' -f1-2)
echo "检测到 Java 版本: $JAVA_VERSION"

# 下载 Maven（如果不存在）
echo ""
echo "[2/5] 检查 Maven 环境..."
if [ ! -d "$MAVEN_HOME" ]; then
    echo "正在下载 Maven $MAVEN_VERSION..."
    mkdir -p "$MAVEN_DIR"
    curl -L -o "$MAVEN_TAR" "$MAVEN_URL" --progress-bar || wget -O "$MAVEN_TAR" "$MAVEN_URL"
    echo "解压 Maven..."
    tar -xzf "$MAVEN_TAR" -C "$MAVEN_DIR"
    rm "$MAVEN_TAR"
fi
export MAVEN_HOME
export PATH="$MAVEN_HOME/bin:$PATH"
echo "Maven 已就绪: $($MAVEN_HOME/bin/mvn -version | head -n 1)"

# 清理之前的编译
echo ""
echo "[3/5] 清理并编译项目..."
cd "$PROJECT_DIR"
rm -rf target data

# 编译项目
"$MAVEN_HOME/bin/mvn" clean package -DskipTests -q

if [ ! -f "target/device-command-confirmation-api-1.0.0.jar" ]; then
    echo "错误: JAR 包生成失败"
    exit 1
fi
echo "编译成功，JAR 包已生成"

# 创建数据目录
mkdir -p data

# 启动服务
echo ""
echo "[4/5] 启动 API 服务..."
echo "服务端口: 8080"
echo "H2 控制台: http://localhost:8080/h2-console"
echo "API 文档: 请参考 README.md"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""
echo "========================================"

java -jar target/device-command-confirmation-api-1.0.0.jar
