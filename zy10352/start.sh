#!/bin/bash
# API 字段血缘服务启动脚本

# 注意：移除 set -e，确保脚本不会在检查失败时静默退出

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"
DATA_DIR="$PROJECT_DIR/data"
MVN_CMD=""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

log_note() {
    echo -e "${BLUE}[NOTE]${NC} $1"
}

check_java() {
    echo ""
    log_info "=========================================="
    log_info "检查 Java 环境..."
    log_info "=========================================="
    
    if ! command -v java &> /dev/null; then
        echo ""
        log_error "未找到 Java 命令！"
        log_note "请安装 Java 11 或更高版本："
        log_note "  - 下载地址: https://adoptium.net/"
        log_note "  - 或使用包管理器: brew install openjdk@11"
        echo ""
        exit 1
    fi

    # 获取 Java 版本，处理不同版本输出格式
    JAVA_VERSION_OUTPUT=$(java -version 2>&1)
    log_info "Java 版本信息: $JAVA_VERSION_OUTPUT"
    
    # 尝试不同方式解析版本号
    if echo "$JAVA_VERSION_OUTPUT" | grep -q 'version "1\.8'; then
        JAVA_VERSION=8
    elif echo "$JAVA_VERSION_OUTPUT" | grep -q 'version "11\.'; then
        JAVA_VERSION=11
    elif echo "$JAVA_VERSION_OUTPUT" | grep -q 'version "17\.'; then
        JAVA_VERSION=17
    else
        # 尝试提取主版本号
        JAVA_VERSION=$(echo "$JAVA_VERSION_OUTPUT" | head -n 1 | cut -d'"' -f2 | cut -d'.' -f1)
    fi
    
    log_info "检测到的 Java 主版本: $JAVA_VERSION"

    if [ "$JAVA_VERSION" -lt 11 ]; then
        echo ""
        log_error "Java 版本不符合要求！"
        log_error "需要 Java 11 或更高版本，当前检测到: Java $JAVA_VERSION"
        echo ""
        log_note "解决方案:"
        log_note "1) 升级 Java 版本:"
        log_note "   - 下载地址: https://adoptium.net/"
        log_note "   - macOS: brew install openjdk@11"
        log_note "   - Ubuntu: sudo apt install openjdk-11-jdk"
        echo ""
        log_note "2) 使用已安装的高版本 Java:"
        log_note "   export JAVA_HOME=/path/to/java11"
        log_note "   export PATH=\$JAVA_HOME/bin:\$PATH"
        echo ""
        exit 1
    fi
    
    log_info "Java 版本检查通过 ✓"
}

check_maven() {
    echo ""
    log_info "=========================================="
    log_info "检查 Maven 环境..."
    log_info "=========================================="

    # 优先使用项目自带的 mvnw
    if [ -f "$PROJECT_DIR/mvnw" ]; then
        MVN_CMD="$PROJECT_DIR/mvnw"
        log_info "使用项目 Maven Wrapper ✓"
        return 0
    fi

    # 检查系统 Maven
    if command -v mvn &> /dev/null; then
        MVN_CMD="mvn"
        log_info "使用系统 Maven ✓"
        return 0
    fi

    echo ""
    log_error "未找到可用的 Maven！"
    log_note "请安装 Maven 3.6 或更高版本："
    log_note "  - 下载地址: https://maven.apache.org/download.cgi"
    log_note "  - macOS: brew install maven"
    log_note "  - Ubuntu: sudo apt install maven"
    echo ""
    exit 1
}

build_project() {
    echo ""
    log_info "=========================================="
    log_info "开始构建项目..."
    log_info "=========================================="
    cd "$PROJECT_DIR"
    
    log_note "使用命令: $MVN_CMD clean package -DskipTests"
    echo ""
    
    if ! $MVN_CMD clean package -DskipTests; then
        echo ""
        log_error "项目构建失败！"
        log_note "请检查:"
        log_note "1. 网络连接（Maven 需要下载依赖）"
        log_note "2. Maven 配置（~/.m2/settings.xml"
        echo ""
        exit 1
    fi
    
    echo ""
    log_info "项目构建成功 ✓"
}

start_service() {
    echo ""
    log_info "=========================================="
    log_info "启动 API 字段血缘服务..."
    log_info "=========================================="

    # 创建数据目录
    mkdir -p "$DATA_DIR"

    # 查找 jar 文件
    JAR_FILE=$(find "$PROJECT_DIR/target" -name "api-field-lineage-service-*.jar" | head -n 1)

    if [ -z "$JAR_FILE" ]; then
        log_error "未找到 Jar 文件！"
        log_note "请先执行构建命令: $0 build"
        echo ""
        exit 1
    fi

    log_info "使用 Jar 文件: $JAR_FILE"
    echo ""
    log_note "服务将在 http://localhost:8080"
    log_note "H2 控制台: http://localhost:8080/h2-console"
    log_note "按 Ctrl+C 停止服务"
    echo ""
    echo "=========================================="
    echo ""

    # 启动服务
    java -jar "$JAR_FILE"
}

show_usage() {
    echo ""
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
    echo ""
}

# 主流程
main() {
    case "${1:-all}" in
        build)
            check_java
            check_maven
            build_project
            echo ""
            log_info "构建完成！"
            log_note "运行 '$0 start' 启动服务"
            echo ""
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
            echo ""
            log_error "未知命令: $1"
            show_usage
            exit 1
            ;;
    esac
}

main "$@"
