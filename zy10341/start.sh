#!/bin/bash
# Schema 注册审批 API 独立启动脚本
# 自动下载 Maven（如果需要），然后编译启动项目

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
MAVEN_VERSION="3.8.8"
MAVEN_HOME="$PROJECT_DIR/.maven/apache-maven-$MAVEN_VERSION"
MAVEN_URL="https://archive.apache.org/dist/maven/maven-3/$MAVEN_VERSION/binaries/apache-maven-$MAVEN_VERSION-bin.tar.gz"

echo "============================================"
echo "Schema 注册审批 API 启动脚本"
echo "============================================"

# 检查 Java 版本
echo ""
echo "检查 Java 环境..."
if ! command -v java &> /dev/null; then
    echo "错误: 未找到 Java，请先安装 Java 8 或更高版本"
    exit 1
fi
JAVA_VERSION=$(java -version 2>&1 | awk -F '"' '/version/ {print $2}')
echo "Java 版本: $JAVA_VERSION"

# 检查是否有 Maven
if command -v mvn &> /dev/null; then
    echo "使用系统 Maven: $(mvn -version | head -n 1)"
    MVN_CMD="mvn"
elif [ -f "$PROJECT_DIR/mvnw" ] && [ -f "$PROJECT_DIR/.mvn/wrapper/maven-wrapper.jar" ]; then
    echo "使用 Maven Wrapper"
    MVN_CMD="$PROJECT_DIR/mvnw"
else
    # 自动下载 Maven
    echo ""
    echo "未找到 Maven，正在自动下载..."
    mkdir -p "$PROJECT_DIR/.maven"
    
    if [ ! -d "$MAVEN_HOME" ]; then
        echo "下载 Maven $MAVEN_VERSION..."
        curl -L "$MAVEN_URL" -o "$PROJECT_DIR/.maven/maven.tar.gz"
        tar -xzf "$PROJECT_DIR/.maven/maven.tar.gz" -C "$PROJECT_DIR/.maven"
        rm "$PROJECT_DIR/.maven/maven.tar.gz"
    fi
    
    MVN_CMD="$MAVEN_HOME/bin/mvn"
    echo "Maven 下载完成: $($MVN_CMD -version | head -n 1)"
fi

# 编译项目
echo ""
echo "============================================"
echo "开始编译项目..."
echo "============================================"
cd "$PROJECT_DIR"
$MVN_CMD clean compile -DskipTests -q

# 启动项目
echo ""
echo "============================================"
echo "启动 Schema 注册审批 API..."
echo "============================================"
echo "服务地址: http://localhost:8080"
echo "H2 控制台: http://localhost:8080/h2-console"
echo "按 Ctrl+C 停止服务"
echo "============================================"
echo ""

cd "$PROJECT_DIR"
$MVN_CMD spring-boot:run
