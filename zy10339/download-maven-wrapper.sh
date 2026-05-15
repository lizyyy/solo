#!/bin/bash
# 手动下载 Maven Wrapper jar 文件（解决网络代理问题）

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WRAPPER_DIR="$SCRIPT_DIR/.mvn/wrapper"
WRAPPER_JAR="$WRAPPER_DIR/maven-wrapper.jar"

WRAPPER_VERSION="3.1.0"
MAVEN_VERSION="3.8.6"

# 官方下载地址
BASE_URL="https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/${WRAPPER_VERSION}"
JAR_URL="${BASE_URL}/maven-wrapper-${WRAPPER_VERSION}.jar"

echo "============================================================"
echo "  Maven Wrapper 手动下载工具"
echo "============================================================"
echo ""

mkdir -p "$WRAPPER_DIR"

if [ -f "$WRAPPER_JAR" ]; then
    echo "✅ maven-wrapper.jar 已存在，跳过下载"
    echo ""
    echo "现在可以运行: ./mvnw clean compile"
    exit 0
fi

echo "尝试从 Maven Central 下载..."
echo "URL: $JAR_URL"
echo ""

# 尝试多种下载方式
if command -v curl &> /dev/null; then
    echo "使用 curl 下载..."
    # 尝试不使用代理，或使用系统代理设置
    curl --noproxy "*" -f -L -o "$WRAPPER_JAR" "$JAR_URL" 2>/dev/null || \
    curl -f -L -o "$WRAPPER_JAR" "$JAR_URL"
elif command -v wget &> /dev/null; then
    echo "使用 wget 下载..."
    wget --no-proxy -O "$WRAPPER_JAR" "$JAR_URL" 2>/dev/null || \
    wget -O "$WRAPPER_JAR" "$JAR_URL"
else
    echo "❌ 未找到 curl 或 wget，请手动下载："
    echo "   $JAR_URL"
    echo "   保存到: $WRAPPER_JAR"
    exit 1
fi

if [ -f "$WRAPPER_JAR" ] && [ -s "$WRAPPER_JAR" ]; then
    echo ""
    echo "✅ 下载成功！"
    echo "   文件: $WRAPPER_JAR"
    echo ""
    echo "现在可以运行: ./mvnw clean compile"
    echo ""
    echo "如果仍然无法下载，也可以运行: ./verify.sh 进行离线验证"
else
    echo ""
    echo "❌ 下载失败"
    echo ""
    echo "解决方案："
    echo "1. 检查网络连接"
    echo "2. 检查代理设置: env | grep -i proxy"
    echo "3. 暂时取消代理: unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY"
    echo "4. 或者直接运行: ./verify.sh 进行离线功能验证"
    exit 1
fi
