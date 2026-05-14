#!/bin/bash
set -e

echo "========================================="
echo "  Maven 自动安装引导脚本"
echo "========================================="
echo ""

MAVEN_VERSION="3.9.9"
MAVEN_TAR="apache-maven-${MAVEN_VERSION}-bin.tar.gz"
MAVEN_URL="https://archive.apache.org/dist/maven/maven-3/${MAVEN_VERSION}/binaries/${MAVEN_TAR}"
INSTALL_DIR="$HOME/.m2/wrapper/dists/apache-maven-${MAVEN_VERSION}"

mkdir -p "$INSTALL_DIR"

# 检查是否已安装
if [ -f "$INSTALL_DIR/apache-maven-${MAVEN_VERSION}/bin/mvn" ]; then
    echo "✅ Maven 已安装: $INSTALL_DIR"
    export M2_HOME="$INSTALL_DIR/apache-maven-${MAVEN_VERSION}"
    export PATH="$M2_HOME/bin:$PATH"
    mvn -version
    exit 0
fi

# 下载 Maven
echo "📥 下载 Maven ${MAVEN_VERSION}..."
if command -v curl > /dev/null 2>&1; then
    curl -L -o "$INSTALL_DIR/${MAVEN_TAR}" "$MAVEN_URL"
elif command -v wget > /dev/null 2>&1; then
    wget -O "$INSTALL_DIR/${MAVEN_TAR}" "$MAVEN_URL"
else
    echo "❌ 请先安装 curl 或 wget"
    exit 1
fi

# 解压
echo "📦 解压 Maven..."
tar -xzf "$INSTALL_DIR/${MAVEN_TAR}" -C "$INSTALL_DIR"
rm -f "$INSTALL_DIR/${MAVEN_TAR}"

# 设置环境变量
export M2_HOME="$INSTALL_DIR/apache-maven-${MAVEN_VERSION}"
export PATH="$M2_HOME/bin:$PATH"

echo ""
echo "✅ Maven 安装完成: $M2_HOME"
echo ""
mvn -version
echo ""
echo "========================================="
echo "  安装完成！"
echo "========================================="
echo ""
echo "现在可以执行: ./mvnw clean package -DskipTests"
echo ""
