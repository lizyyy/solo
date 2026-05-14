#!/bin/bash
# 多版本响应适配器 - 离线/无 Maven 启动脚本
# 支持 Java 8 JRE 环境，无需 Maven，无需编译

set -e

PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$PROJECT_DIR"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_banner() {
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}            ${GREEN}多版本响应适配器 - 离线启动模式${NC}                   ${BLUE}║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_banner

# ============================================
# 环境检测
# ============================================
echo -e "${BLUE}[1/5]${NC} 检测运行环境..."

# 检测 Java
if ! command -v java > /dev/null 2>&1; then
    echo -e "${RED}✗ 错误: 未找到 Java 命令!${NC}"
    echo ""
    echo "  请安装 Java 8 或更高版本:"
    echo "  - 下载地址: https://www.oracle.com/java/technologies/downloads/"
    echo "  - 或使用 OpenJDK: https://adoptium.net/"
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -n 1)
echo -e "${GREEN}✓${NC} 检测到 $JAVA_VERSION"

# 检测是否有 javac (JDK)
HAS_JDK=0
if command -v javac > /dev/null 2>&1; then
    HAS_JDK=1
    echo -e "${GREEN}✓${NC} 检测到 JDK 编译环境"
else
    echo -e "${YELLOW}!${NC} 检测到只有 JRE，无 JDK 编译环境"
fi

# ============================================
# 检查是否已有编译好的 jar
# ============================================
echo ""
echo -e "${BLUE}[2/5]${NC} 检查编译产物..."

JAR_FILE="$PROJECT_DIR/target/version-response-adapter-1.0.0.jar"

if [ -f "$JAR_FILE" ]; then
    JAR_SIZE=$(du -h "$JAR_FILE" | cut -f1)
    echo -e "${GREEN}✓${NC} 找到可执行 jar: $JAR_FILE ($JAR_SIZE)"
    echo ""
    echo -e "${BLUE}[5/5]${NC} 启动应用服务..."
    echo ""
    echo "  服务地址: http://localhost:8080"
    echo "  H2控制台: http://localhost:8080/h2-console"
    echo "  按 Ctrl+C 停止服务"
    echo ""
    exec java -jar "$JAR_FILE"
    exit 0
fi

echo -e "${YELLOW}!${NC} 未找到预编译的 jar 文件"

# ============================================
# 尝试构建
# ============================================
echo ""
echo -e "${BLUE}[3/5]${NC} 查找可用的构建工具..."

# 尝试多种 Maven 命令
MVN_CMD=""
MVN_SOURCE=""

# 方案 1: 系统 Maven
if command -v mvn > /dev/null 2>&1; then
    MVN_VERSION=$(mvn -version 2>&1 | head -n 1)
    echo -e "${GREEN}✓${NC} 系统 Maven 可用: $MVN_VERSION"
    MVN_CMD="mvn"
    MVN_SOURCE="系统 Maven"
fi

# 方案 2: Maven Wrapper jar
if [ -z "$MVN_CMD" ] && [ -f "$PROJECT_DIR/.mvn/wrapper/maven-wrapper.jar" ]; then
    echo -e "${GREEN}✓${NC} Maven Wrapper jar 已存在"
    MVN_CMD="java -jar $PROJECT_DIR/.mvn/wrapper/maven-wrapper.jar"
    MVN_SOURCE="Maven Wrapper"
fi

# 方案 3: 本地 Maven 安装
LOCAL_MAVEN_DIR="$PROJECT_DIR/.tools/maven"
if [ -z "$MVN_CMD" ] && [ -d "$LOCAL_MAVEN_DIR" ]; then
    LOCAL_MVN=$(find "$LOCAL_MAVEN_DIR" -name "mvn" -type f 2>/dev/null | head -n 1)
    if [ -n "$LOCAL_MVN" ] && [ -x "$LOCAL_MVN" ]; then
        echo -e "${GREEN}✓${NC} 本地 Maven 可用"
        MVN_CMD="$LOCAL_MVN"
        MVN_SOURCE="本地 Maven"
    fi
fi

# ============================================
# 如果有 JDK 但无 Maven，尝试在线下载 Maven
# ============================================
if [ -z "$MVN_CMD" ] && [ $HAS_JDK -eq 1 ]; then
    echo ""
    echo -e "${YELLOW}!${NC} 未找到 Maven，尝试自动下载..."
    
    # 检测下载工具
    if command -v curl > /dev/null 2>&1; then
        DOWNLOAD_CMD="curl -s -L -o"
    elif command -v wget > /dev/null 2>&1; then
        DOWNLOAD_CMD="wget -q -O"
    else
        echo -e "${RED}✗ 错误: 未找到 curl 或 wget${NC}"
        echo "  请先安装下载工具后重试"
        exit 1
    fi
    
    MVN_VERSION="3.9.6"
    MVN_DIR="$PROJECT_DIR/.tools/maven"
    MVN_TAR="$MVN_DIR/apache-maven-$MVN_VERSION-bin.tar.gz"
    MVN_HOME="$MVN_DIR/apache-maven-$MVN_VERSION"
    MVN_BIN="$MVN_HOME/bin/mvn"
    
    mkdir -p "$MVN_DIR"
    
    echo ""
    echo -e "${BLUE}[4/5]${NC} 下载 Maven $MVN_VERSION..."
    if [ ! -f "$MVN_TAR" ]; then
        MVN_URL="https://archive.apache.org/dist/maven/maven-3/$MVN_VERSION/binaries/apache-maven-$MVN_VERSION-bin.tar.gz"
        $DOWNLOAD_CMD "$MVN_TAR" "$MVN_URL"
        echo -e "${GREEN}✓${NC} Maven 下载完成"
    else
        echo -e "${GREEN}✓${NC} Maven 已下载，跳过"
    fi
    
    echo ""
    echo -e "${BLUE}[5/5]${NC} 解压 Maven..."
    if [ ! -d "$MVN_HOME" ]; then
        tar -xzf "$MVN_TAR" -C "$MVN_DIR"
        chmod +x "$MVN_BIN"
        echo -e "${GREEN}✓${NC} Maven 解压完成"
    fi
    
    MVN_CMD="$MVN_BIN"
    MVN_SOURCE="自动下载 Maven"
fi

# ============================================
# 执行构建
# ============================================
if [ -n "$MVN_CMD" ]; then
    echo ""
    echo -e "${GREEN}✓${NC} 使用构建工具: $MVN_SOURCE"
    echo ""
    echo -e "${BLUE}[4/5]${NC} 编译项目 (Java 8 兼容模式)..."
    
    cd "$PROJECT_DIR"
    $MVN_CMD clean package -DskipTests -q
    
    if [ $? -eq 0 ] && [ -f "$JAR_FILE" ]; then
        JAR_SIZE=$(du -h "$JAR_FILE" | cut -f1)
        echo -e "${GREEN}✓${NC} 项目编译成功: $JAR_FILE ($JAR_SIZE)"
        echo ""
        echo -e "${BLUE}[5/5]${NC} 启动应用服务..."
        echo ""
        echo "  服务地址: http://localhost:8080"
        echo "  H2控制台: http://localhost:8080/h2-console"
        echo "  按 Ctrl+C 停止服务"
        echo ""
        exec java -jar "$JAR_FILE"
    else
        echo -e "${RED}✗${NC} 编译失败!"
        exit 1
    fi
fi

# ============================================
# 无法构建，提供帮助信息
# ============================================
echo ""
echo -e "${RED}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║${NC}                    ${YELLOW}无法继续执行!${NC}                               ${RED}║${NC}"
echo -e "${RED}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  当前环境限制:"
echo "    ✓ Java 8 JRE 已安装"
echo "    ✗ 缺少 JDK (javac 编译工具) - 无法编译源码"
echo "    ✗ 缺少 Maven 构建工具"
echo ""
echo "  解决方案:"
echo ""
echo "  方案 1: 安装 JDK (推荐)"
echo "    下载地址: https://adoptium.net/temurin/releases/?version=8"
echo "    安装后重新运行: ./run-offline.sh"
echo ""
echo "  方案 2: 下载预构建的 jar 文件"
echo "    如果有预构建的 version-response-adapter-1.0.0.jar，"
echo "    将其放入 target/ 目录后，本脚本会自动检测并启动"
echo ""
echo "  方案 3: 在有编译环境的机器上构建后拷贝"
echo "    1. 在有 JDK + Maven 的机器上执行: mvn clean package -DskipTests"
echo "    2. 将 target/version-response-adapter-1.0.0.jar 拷贝到本机"
echo "    3. 执行: java -jar target/version-response-adapter-1.0.0.jar"
echo ""
echo "  方案 4: 使用 Maven 替代工具"
echo "    - Gradle: 需创建 build.gradle 配置"
echo ""
echo -e "${YELLOW}提示:${NC} JRE 只能运行已编译的程序，无法编译源码。"
echo "       请选择以上任一方案解决环境问题。"
echo ""

exit 1
