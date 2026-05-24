#!/bin/bash
# 县域防汛安置物资 API - 全自动启动脚本
# 自动检测 → 自动安装 → 自动运行

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }
blue() { echo -e "${BLUE}$1${NC}"; }

echo ""
blue "========================================"
blue "  县域防汛安置物资 API - 全自动启动器"
blue "========================================"
echo ""

# 查找 Maven
find_maven() {
    # 1. 系统 Maven
    command -v mvn >/dev/null 2>&1 && echo "mvn" && return
    [ -f "/opt/homebrew/bin/mvn" ] && echo "/opt/homebrew/bin/mvn" && return
    [ -f "/usr/local/bin/mvn" ] && echo "/usr/local/bin/mvn" && return
    
    # 2. 项目本地 Maven
    [ -f "$PROJECT_DIR/tools/maven/bin/mvn" ] && echo "$PROJECT_DIR/tools/maven/bin/mvn" && return
    
    # 3. IDE 或其他位置
    local FOUND=$(find /Users -name "mvn" -type f 2>/dev/null | grep -v ".m2" | head -1)
    [ -n "$FOUND" ] && echo "$FOUND" && return
    
    echo ""
}

# 安装本地 Maven
install_maven() {
    warn "未找到 Maven，开始自动安装..."
    echo ""
    
    if [ -x "$PROJECT_DIR/install-maven.sh" ]; then
        "$PROJECT_DIR/install-maven.sh"
        if [ $? -eq 0 ] && [ -f "$PROJECT_DIR/tools/maven/bin/mvn" ]; then
            echo "$PROJECT_DIR/tools/maven/bin/mvn"
            return
        fi
    fi
    
    # 手动下载安装
    info "正在下载 Maven 3.9.6..."
    mkdir -p "$PROJECT_DIR/tools"
    
    local MAVEN_URL="https://mirrors.tuna.tsinghua.edu.cn/apache/maven/maven-3/3.9.6/binaries/apache-maven-3.9.6-bin.tar.gz"
    
    if command -v curl >/dev/null 2>&1; then
        curl -L -o "$PROJECT_DIR/tools/maven.tar.gz" "$MAVEN_URL"
    elif command -v wget >/dev/null 2>&1; then
        wget -O "$PROJECT_DIR/tools/maven.tar.gz" "$MAVEN_URL"
    else
        error "未找到 curl 或 wget，无法自动下载 Maven"
        echo ""
        manual_guide
        exit 1
    fi
    
    mkdir -p "$PROJECT_DIR/tools/maven"
    tar -xzf "$PROJECT_DIR/tools/maven.tar.gz" -C "$PROJECT_DIR/tools/maven" --strip-components=1
    rm -f "$PROJECT_DIR/tools/maven.tar.gz"
    
    if [ -f "$PROJECT_DIR/tools/maven/bin/mvn" ]; then
        chmod +x "$PROJECT_DIR/tools/maven/bin/mvn"
        info "Maven 安装完成!"
        echo "$PROJECT_DIR/tools/maven/bin/mvn"
    else
        error "Maven 安装失败"
        exit 1
    fi
}

# 手动安装指南
manual_guide() {
    yellow "----------------------------------------"
    yellow "  手动安装指南"
    yellow "----------------------------------------"
    echo ""
    echo "方案 1: 使用 Maven 安装脚本"
    echo "  ./install-maven.sh"
    echo ""
    echo "方案 2: 手动下载 Maven"
    echo "  1. 访问: https://maven.apache.org/download.cgi"
    echo "  2. 下载: apache-maven-3.9.6-bin.tar.gz"
    echo "  3. 解压到: tools/maven/"
    echo "  4. 确保 tools/maven/bin/mvn 存在"
    echo ""
    echo "方案 3: 使用 Homebrew"
    echo "  brew install maven"
    echo ""
    echo "安装完成后运行: ./start.sh"
    echo ""
}

# 显示服务信息
show_service_info() {
    echo ""
    blue "========================================"
    blue "  🚀 服务启动中..."
    blue "========================================"
    echo ""
    info "📡 API 基础路径: http://localhost:8080/api"
    info "🔍 H2 数据库控制台: http://localhost:8080/api/h2-console"
    info "💾 JDBC URL: jdbc:h2:file:./data/floodrelief"
    info "👤 用户名/密码: admin / admin"
    echo ""
    info "服务启动后，运行 ./verify-api.sh 验证 API 闭环"
    echo ""
    yellow "按 Ctrl+C 停止服务"
    echo ""
}

# 主流程
MVN_CMD=$(find_maven)

if [ -z "$MVN_CMD" ]; then
    MVN_CMD=$(install_maven)
fi

if [ -n "$MVN_CMD" ] && [ -f "$(echo $MVN_CMD | awk '{print $NF}')" -o "$MVN_CMD" = "mvn" ]; then
    info "使用 Maven: $MVN_CMD"
    show_service_info
    
    # 执行 Maven 命令
    cd "$PROJECT_DIR"
    $MVN_CMD clean spring-boot:run
else
    error "无法找到或安装 Maven"
    manual_guide
    exit 1
fi
