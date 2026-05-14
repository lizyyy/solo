#!/bin/bash

echo "========================================"
echo "  API合成事务巡检 - 服务启动"
echo "========================================"
echo ""

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_ok() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_fail() {
    echo -e "${RED}❌ $1${NC}"
}

# 检查端口
if command -v lsof &> /dev/null; then
    if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_warn "端口8080已被占用"
        echo ""
        read -p "是否关闭占用进程？(y/n): " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            lsof -Pi :8080 -sTCP:LISTEN -t | xargs kill -9 2>/dev/null
            echo "已关闭"
            sleep 1
        else
            echo "请手动关闭端口占用后重试"
            exit 1
        fi
    fi
fi

# 检查Maven
USE_MVN=0
if command -v mvn &> /dev/null; then
    MVN_CMD="mvn"
    USE_MVN=1
elif [ -f "./mvnw" ] && [ -f ".mvn/wrapper/maven-wrapper.jar" ]; then
    MVN_CMD="./mvnw"
    USE_MVN=1
else
    print_fail "未找到Maven，请先运行 ./setup.sh"
    exit 1
fi

echo ""
echo "启动服务..."
echo "  服务地址: http://localhost:8080"
echo "  H2控制台: http://localhost:8080/h2-console"
echo ""
echo "按 Ctrl+C 停止服务"
echo "========================================"
echo ""

$MVN_CMD spring-boot:run
