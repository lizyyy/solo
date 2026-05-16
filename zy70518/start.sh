#!/bin/bash
# 连接池诊断服务启动脚本

set +e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

log_title() {
    echo -e "${BLUE}$1${NC}"
}

echo ""
log_title "===================================="
log_title "连接池泄漏诊断API 服务启动"
log_title "===================================="
echo ""

# 检查 Java
if ! command -v java >/dev/null 2>&1; then
    log_error "❌ Java 未找到，请先安装 JDK 11+"
    echo ""
    echo "下载地址: https://adoptium.net/"
    exit 1
fi

JAVA_VER=$(java -version 2>&1 | head -1)
log_info "✅ Java 环境: $JAVA_VER"
echo ""

# 方法 1: 尝试直接运行已编译的 JAR
if ls "$SCRIPT_DIR"/target/*.jar 1>/dev/null 2>&1; then
    JAR_FILE=$(ls "$SCRIPT_DIR"/target/*.jar | head -1)
    log_info "📦 找到已编译的 JAR 文件: $(basename "$JAR_FILE")"
    log_info "🚀 方式 1/4: 直接运行 JAR..."
    echo ""
    cd "$SCRIPT_DIR" && java -jar "$JAR_FILE"
    exit $?
fi

# 方法 2: 尝试使用本地 Maven
if command -v mvn >/dev/null 2>&1; then
    log_info "🚀 方式 2/4: 使用本地 Maven 启动服务..."
    echo ""
    cd "$SCRIPT_DIR" && mvn spring-boot:run
    exit $?
fi

# 方法 3: 尝试使用 Maven Wrapper (./mvnw)
if [ -f "$SCRIPT_DIR/mvnw" ] && [ -x "$SCRIPT_DIR/mvnw" ]; then
    log_info "🚀 方式 3/4: 使用 Maven Wrapper 启动服务..."
    echo ""
    cd "$SCRIPT_DIR" && ./mvnw spring-boot:run
    exit $?
fi

# 方法 4: 尝试使用 Docker Compose
if command -v docker-compose >/dev/null 2>&1 || command -v docker >/dev/null 2>&1; then
    if docker info >/dev/null 2>&1; then
        log_info "🚀 方式 4/4: 使用 Docker Compose 启动服务..."
        echo ""
        cd "$SCRIPT_DIR"
        if command -v docker-compose >/dev/null 2>&1; then
            docker-compose up --build
        else
            docker compose up --build
        fi
        exit $?
    else
        log_warn "⚠️  Docker daemon 未运行"
    fi
fi

# 所有方法都失败了
echo ""
log_error "❌ 所有启动方式均失败！"
echo ""
echo "运行 ./env-check.sh 查看详细环境诊断:"
echo ""
"$SCRIPT_DIR"/env-check.sh
exit 1
