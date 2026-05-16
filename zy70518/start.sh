#!/bin/bash
# 连接池诊断服务启动脚本

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_info "===================================="
log_info "连接池泄漏诊断API 服务启动"
log_info "===================================="

# 检查Java
if ! command -v java >/dev/null 2>&1; then
    log_error "Java 未找到，请先安装 JDK 11+"
    exit 1
fi

# 方法1: 尝试使用本地 Maven
if command -v mvn >/dev/null 2>&1; then
    log_info "使用本地 Maven 启动服务..."
    cd "$SCRIPT_DIR" && mvn spring-boot:run
    exit $?
fi

# 方法2: 尝试使用 Maven Wrapper (./mvnw)
if [ -f "$SCRIPT_DIR/mvnw" ] && [ -x "$SCRIPT_DIR/mvnw" ]; then
    log_info "使用 Maven Wrapper 启动服务..."
    cd "$SCRIPT_DIR" && ./mvnw spring-boot:run
    exit $?
fi

# 方法3: 尝试使用 Docker Compose
if command -v docker-compose >/dev/null 2>&1 || command -v docker >/dev/null 2>&1; then
    log_info "检测到 Docker，尝试使用 Docker 方式启动..."
    
    # 检查 Docker daemon 是否运行
    if ! docker info >/dev/null 2>&1; then
        log_warn "Docker daemon 未运行，请先启动 Docker..."
        echo ""
        echo "启动 Docker 的方法："
        echo "  macOS: 打开 Docker Desktop 应用"
        echo "  Linux: sudo systemctl start docker"
        echo "  Windows: 启动 Docker Desktop"
    else
        log_info "Docker 已运行，尝试使用 docker-compose 启动..."
        cd "$SCRIPT_DIR"
        if command -v docker-compose >/dev/null 2>&1; then
            docker-compose up --build
        else
            docker compose up --build
        fi
        exit $?
    fi
fi

log_error "无法启动服务！所有可用方式都失败。"
echo ""
echo "=== 可用启动方式 ==="
echo "方式1: 安装 Maven"
echo "  macOS:    brew install maven"
echo "  Ubuntu:   sudo apt-get install maven"
echo "  CentOS:   sudo yum install maven"
echo ""
echo "方式2: 安装 Docker Desktop"
echo "  下载地址: https://docs.docker.com/get-docker/"
echo ""
echo "方式3: 手动下载 Maven"
echo "  下载地址: https://maven.apache.org/download.cgi"
echo ""
echo "安装任意一种后重新运行 ./start.sh"
exit 1
