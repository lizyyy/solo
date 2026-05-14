#!/bin/bash
# 多版本响应适配器 - 增强版启动脚本
# 自动处理依赖下载、环境检测、编译构建、服务启动

set -e

PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$PROJECT_DIR"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_banner() {
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}                ${GREEN}多版本响应适配器${NC}                                ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}            Version Response Adapter Service                   ${BLUE}║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_step() {
    echo -e "${BLUE}[${1}]${NC} ${2}"
}

print_success() {
    echo -e "${GREEN}✓${NC} ${1}"
}

print_warning() {
    echo -e "${YELLOW}!${NC} ${1}"
}

print_error() {
    echo -e "${RED}✗${NC} ${1}"
}

print_banner

# ============================================
# 步骤 1: 环境检测
# ============================================
print_step "1/7" "检测运行环境"

# 检测 Java
if ! command -v java &> /dev/null; then
    print_error "未找到 Java 命令！"
    echo "  请安装 Java 8 或更高版本后重试"
    echo "  下载地址: https://www.oracle.com/java/technologies/downloads/"
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -n 1 | grep -Eo '[0-9]+\.[0-9]+' | head -n 1)
print_success "检测到 Java 版本: $JAVA_VERSION"

# 检测 curl
if ! command -v curl &> /dev/null; then
    print_warning "未检测到 curl，尝试使用 wget..."
    if ! command -v wget &> /dev/null; then
        print_error "curl 和 wget 都不可用！"
        echo "  请安装 curl 或 wget 后重试"
        exit 1
    fi
    DOWNLOAD_CMD="wget -q -O"
else
    DOWNLOAD_CMD="curl -s -L -o"
fi
print_success "下载工具可用"

# ============================================
# 步骤 2: 检测可用的构建工具
# ============================================
print_step "2/7" "查找可用的构建工具"

MVN_CMD=""
MVN_SOURCE=""

# 方案 1: 系统 Maven
if command -v mvn &> /dev/null; then
    MVN_VERSION=$(mvn -version 2>&1 | head -n 1 | grep -Eo 'Apache Maven [0-9]+\.[0-9]+')
    print_success "系统 Maven 可用: $MVN_VERSION"
    MVN_CMD="mvn"
    MVN_SOURCE="系统 Maven"
fi

# 方案 2: 尝试 Maven Wrapper (如果 jar 存在)
if [ -z "$MVN_CMD" ] && [ -f "$PROJECT_DIR/.mvn/wrapper/maven-wrapper.jar" ]; then
    print_success "Maven Wrapper jar 已存在"
    MVN_CMD="java -jar $PROJECT_DIR/.mvn/wrapper/maven-wrapper.jar"
    MVN_SOURCE="Maven Wrapper"
fi

# ============================================
# 步骤 3: 如果没有 Maven，自动下载安装
# ============================================
if [ -z "$MVN_CMD" ]; then
    print_step "3/7" "未找到 Maven，正在自动安装..."
    
    MVN_VERSION="3.9.6"
    MVN_DIR="$PROJECT_DIR/.tools/maven"
    MVN_TAR="$MVN_DIR/apache-maven-$MVN_VERSION-bin.tar.gz"
    MVN_HOME="$MVN_DIR/apache-maven-$MVN_VERSION"
    
    mkdir -p "$MVN_DIR"
    
    print_step "3/7" "下载 Maven $MVN_VERSION..."
    if [ ! -f "$MVN_TAR" ]; then
        $DOWNLOAD_CMD "$MVN_TAR" "https://archive.apache.org/dist/maven/maven-3/$MVN_VERSION/binaries/apache-maven-$MVN_VERSION-bin.tar.gz"
        print_success "Maven 下载完成"
    else
        print_success "Maven 已下载，跳过"
    fi
    
    print_step "3/7" "解压 Maven..."
    if [ ! -d "$MVN_HOME" ]; then
        tar -xzf "$MVN_TAR" -C "$MVN_DIR"
        chmod +x "$MVN_HOME/bin/mvn"
        print_success "Maven 解压完成"
    else
        print_success "Maven 已解压，跳过"
    fi
    
    MVN_CMD="$MVN_HOME/bin/mvn"
    MVN_SOURCE="本地 Maven (自动安装)"
fi

print_success "使用构建工具: $MVN_SOURCE"

# ============================================
# 步骤 4: 编译项目
# ============================================
print_step "4/7" "编译项目（跳过测试）"
echo "      这可能需要几分钟，首次运行会下载依赖..."
echo ""

cd "$PROJECT_DIR"
$MVN_CMD clean package -DskipTests -q

if [ $? -ne 0 ]; then
    print_error "编译失败！"
    echo ""
    echo "  尝试运行以下命令查看详细错误:"
    echo "  $MVN_CMD clean package -DskipTests"
    exit 1
fi

print_success "项目编译成功"

# ============================================
# 步骤 5: 检查构建产物
# ============================================
print_step "5/7" "检查构建产物"

JAR_FILE="$PROJECT_DIR/target/version-response-adapter-1.0.0.jar"

if [ ! -f "$JAR_FILE" ]; then
    print_error "找不到构建产物: $JAR_FILE"
    exit 1
fi

JAR_SIZE=$(du -h "$JAR_FILE" | cut -f1)
print_success "构建产物: $JAR_FILE ($JAR_SIZE)"

# ============================================
# 步骤 6: 显示启动信息
# ============================================
print_step "6/7" "准备启动服务"
echo ""
echo "  ╔══════════════════════════════════════════════════════════════╗"
echo "  ║                       服务访问地址                            ║"
echo "  ╠══════════════════════════════════════════════════════════════╣"
echo "  ║  应用首页:    http://localhost:8080                          ║"
echo "  ║  H2控制台:    http://localhost:8080/h2-console              ║"
echo "  ║  适配接口:    POST http://localhost:8080/api/versions/adapt ║"
echo "  ║  版本列表:    http://localhost:8080/api/versions            ║"
echo "  ║  样本查询:    http://localhost:8080/api/samples             ║"
echo "  ║  审计记录:    http://localhost:8080/api/audit               ║"
echo "  ╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  数据库配置:"
echo "    JDBC URL: jdbc:h2:file:$PROJECT_DIR/data/version_adapter_db"
echo "    用户名:   sa"
echo "    密码:     (空)"
echo ""

# ============================================
# 步骤 7: 启动服务
# ============================================
print_step "7/7" "启动应用服务"
echo ""
echo "  按 Ctrl+C 停止服务"
echo "  ================================================================"
echo ""

exec java -jar "$JAR_FILE"
