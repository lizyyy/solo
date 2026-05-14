#!/bin/bash
# Maven 自动安装脚本
# 用于本地安装独立的 Maven，不依赖系统环境

set -e

PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$PROJECT_DIR"

# 配置
MVN_VERSION="3.9.6"
MVN_DIR="$PROJECT_DIR/.tools/maven"
MVN_TAR="$MVN_DIR/apache-maven-$MVN_VERSION-bin.tar.gz"
MVN_HOME="$MVN_DIR/apache-maven-$MVN_VERSION"
MVN_BIN="$MVN_HOME/bin/mvn"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC}                   ${GREEN}Maven 自动安装脚本${NC}                           ${BLUE}║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# 检测下载工具
if command -v curl > /dev/null 2>&1; then
    DOWNLOAD_CMD="curl -s -L -o"
    echo -e "${BLUE}[1/4]${NC} 检测到 curl 下载工具"
elif command -v wget > /dev/null 2>&1; then
    DOWNLOAD_CMD="wget -q -O"
    echo -e "${BLUE}[1/4]${NC} 检测到 wget 下载工具"
else
    echo -e "${RED}✗${NC} 错误: 未找到 curl 或 wget"
    echo "  请先安装其中一个工具后重试"
    echo "  macOS: brew install curl"
    echo "  Ubuntu/Debian: sudo apt-get install curl"
    exit 1
fi

# 创建目录
mkdir -p "$MVN_DIR"

# 下载 Maven
echo -e "${BLUE}[2/4]${NC} 下载 Maven $MVN_VERSION..."
if [ ! -f "$MVN_TAR" ]; then
    MVN_URL="https://archive.apache.org/dist/maven/maven-3/$MVN_VERSION/binaries/apache-maven-$MVN_VERSION-bin.tar.gz"
    $DOWNLOAD_CMD "$MVN_TAR" "$MVN_URL"
    echo -e "${GREEN}✓${NC} Maven 下载完成"
else
    echo -e "${GREEN}✓${NC} Maven 已下载，跳过"
fi

# 解压
echo -e "${BLUE}[3/4]${NC} 解压 Maven..."
if [ ! -d "$MVN_HOME" ]; then
    tar -xzf "$MVN_TAR" -C "$MVN_DIR"
    chmod +x "$MVN_HOME/bin/mvn"
    echo -e "${GREEN}✓${NC} Maven 解压完成"
else
    echo -e "${GREEN}✓${NC} Maven 已解压，跳过"
fi

# 测试运行
echo -e "${BLUE}[4/4]${NC} 验证 Maven 安装..."
if "$MVN_BIN" -version > /dev/null 2>&1; then
    MVN_VERSION_OUTPUT=$("$MVN_BIN" -version 2>&1 | head -n 1)
    echo -e "${GREEN}✓${NC} Maven 安装成功: $MVN_VERSION_OUTPUT"
else
    echo -e "${RED}✗${NC} Maven 安装失败"
    exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                       使用说明                                ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  方法 1: 使用启动脚本（推荐）                                 ║"
echo "║      ./start.sh                                               ║"
echo "║                                                              ║"
echo "║  方法 2: 使用本地 Maven 直接运行                              ║"
echo "║      $MVN_BIN clean package                                   ║"
echo "║      java -jar target/version-response-adapter-1.0.0.jar    ║"
echo "║                                                              ║"
echo "║  方法 3: 添加到 PATH（可选）                                  ║"
echo "║      export PATH=\$PATH:$MVN_HOME/bin                         ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}安装完成！现在可以运行 ./start.sh 启动项目${NC}"
echo ""
