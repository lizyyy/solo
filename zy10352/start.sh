#!/bin/bash
# API 字段血缘服务启动脚本

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"
DATA_DIR="$PROJECT_DIR/data"
MVN_CMD=""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_java() {
    log_info "检查 Java 版本..."
    if ! command -v java &> /dev/null; then
        log_error "未找到 Java，请先安装 Java 11 或更高版本"
        exit 1
    fi

    JAVA_VERSION=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2 | cut -d'.' -f1)
    log_info "当前 Java 版本: $JAVA_VERSION"

    if [ "$JAVA_VERSION" -lt 11 ]; then
        log_error "需要 Java 11 或更高版本，当前版本: $JAVA_VERSION"
        exit 1
    fi
}

check_maven() {
    log_info "检查 Maven..."

    # 优先使用项目自带的 mvnw
    if [ -f "$PROJECT_DIR/mvnw" ]; then
        MVN_CMD="$PROJECT_DIR/mvnw"
        log_info "使用项目 Maven Wrapper"
        return 0
    fi

    # 检查系统 Maven
    if command -v mvn &> /dev/null; then
        MVN_CMD="mvn"
        log_info "使用系统 Maven"
        return 0
    fi

    log_error "未找到 Maven，请先安装 Maven 或配置 mvnw"
    exit 1
}

build_project() {
    log_info "开始构建项目..."
    cd "$PROJECT_DIR"
    $MVN_CMD clean package -DskipTests
    log_info "项目构建完成"
}

start_service() {
    log_info "启动 API 字段血缘服务..."

    # 创建数据目录
    mkdir -p "$DATA_DIR"

    # 查找 jar 文件
    JAR_FILE=$(find "$PROJECT_DIR/target" -name "api-field-lineage-service-*.jar" | head -n 1)

    if [ -z "$JAR_FILE" ]; then
        log_error "未找到 jar 文件，请先构建项目"
        exit 1
    fi

    log_info "使用 jar 文件: $JAR_FILE"

    # 启动服务
    java -jar "$JAR_FILE"
}

show_usage() {
    echo "API 字段血缘服务 - 启动脚本"
    echo ""
    echo "用法: $0 [命令]"
    echo ""
    echo "命令:"
    echo "  build    仅构建项目"
    echo "  start    仅启动服务（需先构建）"
    echo "  all      构建并启动（默认）"
    echo "  help     显示帮助信息"
    echo ""
    echo "示例:"
    echo "  $0          # 构建并启动"
    echo "  $0 build    # 仅构建"
    echo "  $0 start    # 仅启动"
}

# 主流程
main() {
    case "${1:-all}" in
        build)
            check_java
            check_maven
            build_project
            log_info "构建完成！运行 '$0 start' 启动服务"
            ;;
        start)
            check_java
            start_service
            ;;
        all)
            check_java
            check_maven
            build_project
            start_service
            ;;
        help|--help|-h)
            show_usage
            ;;
        *)
            log_error "未知命令: $1"
            show_usage
            exit 1
            ;;
    esac
}

main "$@"
