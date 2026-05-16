#!/bin/bash
# 连接池诊断服务启动脚本

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo "${RED}[ERROR]${NC} $1"
}

log_info "===================================="
log_info "连接池泄漏诊断API 服务启动"
log_info "===================================="

# 检查Java
if ! command -v java >/dev/null 2>&1; then
    log_error "Java 未找到，请先安装 JDK 11+"
    exit 1
fi

# 方法1: 尝试使用 Maven
if command -v mvn >/dev/null 2>&1; then
    log_info "使用 Maven 启动服务..."
    mvn spring-boot:run
    exit $?
fi

# 方法2: 尝试使用 Docker
if command -v docker >/dev/null 2>&1; then
    log_warn "未找到 Maven，使用 Docker 构建..."
    if [ ! -f target/*.jar ]; then
        log_info "使用 Docker 构建项目..."
        docker run -it --rm -v "$PWD":/app -w /app maven:3.8.6-openjdk-11 mvn clean package -DskipTests
    fi
    
    if ls target/*.jar 1> /dev/null 2>&1; then
        log_info "使用 Docker 启动服务..."
        docker run -it --rm -p 8080:8080 -v "$PWD/target:/app" openjdk:11-jre-slim java -jar /app/$(ls target/*.jar | xargs basename)
        exit $?
    fi
fi

log_error "无法启动服务！"
echo ""
echo "可选方案："
echo "1. 安装 Maven: brew install maven (macOS) 或 sudo apt-get install maven (Linux)"
echo "2. 安装 Docker: https://docs.docker.com/get-docker/"
echo "3. 使用 docker-compose: docker-compose up --build"
echo "4. 手动下载 Maven: https://maven.apache.org/download.cgi"
exit 1
