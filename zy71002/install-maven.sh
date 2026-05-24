#!/bin/bash
# 自动下载并安装 Maven 到项目本地目录
# 无需系统级安装，无需 Homebrew

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

MAVEN_VERSION="3.9.6"
MAVEN_DIR="$PROJECT_DIR/tools/maven"
MAVEN_TAR="apache-maven-${MAVEN_VERSION}-bin.tar.gz"
MAVEN_URL="https://archive.apache.org/dist/maven/maven-3/${MAVEN_VERSION}/binaries/${MAVEN_TAR}"

echo "========================================"
echo "  Maven 本地安装器"
echo "========================================"
echo ""

# 检查是否已安装
if [ -f "$MAVEN_DIR/bin/mvn" ]; then
    echo "✅ Maven 已安装在: $MAVEN_DIR"
    echo ""
    echo "运行服务: ./start.sh"
    exit 0
fi

# 创建目录
mkdir -p "$MAVEN_DIR"
cd "$PROJECT_DIR/tools"

echo "📥 下载 Maven ${MAVEN_VERSION}..."
echo "   URL: $MAVEN_URL"

# 使用 curl 或 wget 下载
if command -v curl >/dev/null 2>&1; then
    curl -L -o "$MAVEN_TAR" "$MAVEN_URL" || {
        echo ""
        echo "⚠️  官方源下载失败，尝试镜像源..."
        curl -L -o "$MAVEN_TAR" "https://mirrors.tuna.tsinghua.edu.cn/apache/maven/maven-3/${MAVEN_VERSION}/binaries/${MAVEN_TAR}"
    }
elif command -v wget >/dev/null 2>&1; then
    wget -O "$MAVEN_TAR" "$MAVEN_URL" || {
        echo ""
        echo "⚠️  官方源下载失败，尝试镜像源..."
        wget -O "$MAVEN_TAR" "https://mirrors.tuna.tsinghua.edu.cn/apache/maven/maven-3/${MAVEN_VERSION}/binaries/${MAVEN_TAR}"
    }
else
    echo "❌ 未找到 curl 或 wget"
    echo "请先安装下载工具，或手动下载 Maven"
    exit 1
fi

echo ""
echo "📦 解压 Maven..."
tar -xzf "$MAVEN_TAR" -C "$MAVEN_DIR" --strip-components=1
rm -f "$MAVEN_TAR"

# 验证安装
if [ -f "$MAVEN_DIR/bin/mvn" ]; then
    chmod +x "$MAVEN_DIR/bin/mvn"
    
    echo ""
    echo "✅ Maven 安装成功！"
    echo "   位置: $MAVEN_DIR"
    echo "   版本: $MAVEN_VERSION"
    echo ""
    echo "🚀 启动服务:"
    echo "   cd $PROJECT_DIR"
    echo "   ./start.sh"
    echo ""
    echo "或直接使用 Maven:"
    echo "   $MAVEN_DIR/bin/mvn clean spring-boot:run"
    echo ""
else
    echo "❌ Maven 安装失败"
    exit 1
fi
