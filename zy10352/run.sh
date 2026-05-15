#!/bin/bash
# ============================================================================
# API 字段血缘服务 - 全能启动脚本
# 功能：
#   1. 自动检测 Java 环境（JDK vs JRE）
#   2. 如果没有 JDK，自动下载并安装 Adoptium JDK
#   3. 使用 Maven Wrapper 构建项目
#   4. 启动服务
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"
DATA_DIR="$PROJECT_DIR/data"
JDK_DIR="$PROJECT_DIR/.jdk"
MVN_CMD=""
AUTO_INSTALL=true

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_note() { echo -e "${BLUE}[NOTE]${NC} $1"; }
log_step() { echo -e "${PURPLE}[STEP]${NC} $1"; }

print_banner() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║           API 字段血缘服务 - 全能启动脚本                    ║"
    echo "║         自动检测环境 → 安装依赖 → 构建 → 启动                 ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""
}

detect_os() {
    case "$(uname -s)" in
        Darwin*) echo "macos" ;;
        Linux*) echo "linux" ;;
        MINGW*|CYGWIN*) echo "windows" ;;
        *) echo "unknown" ;;
    esac
}

detect_arch() {
    case "$(uname -m)" in
        arm64|aarch64) echo "aarch64" ;;
        x86_64|amd64) echo "x64" ;;
        *) echo "x64" ;;
    esac
}

check_java_is_jdk() {
    local java_home="$1"
    if [ -f "$java_home/bin/javac" ]; then
        return 0
    fi
    return 1
}

get_java_version() {
    local java_cmd="${1:-java}"
    "$java_cmd" -version 2>&1 | head -n 1 | sed -E 's/.*version "([0-9.]+).*/\1/'
}

get_java_major_version() {
    local version="$1"
    if echo "$version" | grep -q "^1\."; then
        echo "$version" | cut -d. -f2
    else
        echo "$version" | cut -d. -f1
    fi
}

download_jdk() {
    local os="$1"
    local arch="$2"
    local version="11"
    local jdk_url=""
    local jdk_file=""
    
    log_step "准备下载 Adoptium Temurin JDK ${version}..."
    
    # Adoptium API
    if [ "$os" = "macos" ]; then
        jdk_url="https://github.com/adoptium/temurin11-binaries/releases/download/jdk-11.0.23%2B9/OpenJDK11U-jdk_${arch}_mac_hotspot_11.0.23_9.tar.gz"
        jdk_file="OpenJDK11U-jdk_${arch}_mac_hotspot_11.0.23_9.tar.gz"
    elif [ "$os" = "linux" ]; then
        jdk_url="https://github.com/adoptium/temurin11-binaries/releases/download/jdk-11.0.23%2B9/OpenJDK11U-jdk_${arch}_linux_hotspot_11.0.23_9.tar.gz"
        jdk_file="OpenJDK11U-jdk_${arch}_linux_hotspot_11.0.23_9.tar.gz"
    fi
    
    if [ -z "$jdk_url" ]; then
        log_error "不支持的操作系统: $os"
        return 1
    fi
    
    mkdir -p "$JDK_DIR"
    local tar_path="$JDK_DIR/$jdk_file"
    
    if [ -f "$tar_path" ]; then
        log_info "JDK 压缩包已存在，跳过下载"
    else
        log_note "下载地址: $jdk_url"
        log_note "保存到: $tar_path"
        echo ""
        
        if command -v curl >/dev/null 2>&1; then
            curl -L -o "$tar_path" "$jdk_url" --progress-bar
        elif command -v wget >/dev/null 2>&1; then
            wget -O "$tar_path" "$jdk_url" --progress=bar
        else
            log_error "未找到 curl 或 wget，请手动下载 JDK："
            log_error "  $jdk_url"
            return 1
        fi
    fi
    
    log_step "解压 JDK..."
    cd "$JDK_DIR"
    tar -xzf "$jdk_file"
    
    # 找到解压后的目录
    local jdk_home=$(find "$JDK_DIR" -name "jdk*" -type d | head -n 1)
    if [ -z "$jdk_home" ]; then
        log_error "无法找到 JDK 目录"
        return 1
    fi
    
    echo "$jdk_home"
    return 0
}

setup_jdk() {
    log_step "检查 Java 环境..."
    
    # 首先检查系统 Java 是否是完整的 JDK
    local system_java_home=""
    if [ -n "${JAVA_HOME:-}" ]; then
        system_java_home="$JAVA_HOME"
    else
        system_java_home=$(/usr/libexec/java_home 2>/dev/null || true)
    fi
    
    if [ -n "$system_java_home" ] && check_java_is_jdk "$system_java_home"; then
        local version=$(get_java_version "$system_java_home/bin/java")
        local major=$(get_java_major_version "$version")
        log_info "检测到系统 JDK: Java $version (JDK)"
        
        if [ "$major" -ge 8 ]; then
            export JAVA_HOME="$system_java_home"
            export PATH="$JAVA_HOME/bin:$PATH"
            log_info "使用系统 JDK ✓"
            return 0
        fi
    fi
    
    # 检查本地是否已下载 JDK
    if [ -d "$JDK_DIR" ]; then
        local local_jdk=$(find "$JDK_DIR" -name "jdk*" -type d | head -n 1)
        if [ -n "$local_jdk" ] && check_java_is_jdk "$local_jdk"; then
            export JAVA_HOME="$local_jdk"
            export PATH="$JAVA_HOME/bin:$PATH"
            local version=$(get_java_version)
            log_info "使用本地 JDK: Java $version ✓"
            return 0
        fi
    fi
    
    # 需要下载 JDK
    log_warn "未检测到完整的 JDK（只有 JRE）"
    log_warn "项目构建需要完整的 JDK 环境"
    
    if [ "$AUTO_INSTALL" = "true" ]; then
        echo ""
        log_note "将自动下载 Adoptium Temurin JDK 11"
        log_note "按 Ctrl+C 取消，5秒后自动开始..."
        sleep 5
        
        local os=$(detect_os)
        local arch=$(detect_arch)
        log_note "系统: $os, 架构: $arch"
        
        local jdk_home=$(download_jdk "$os" "$arch")
        if [ $? -ne 0 ]; then
            return 1
        fi
        
        export JAVA_HOME="$jdk_home"
        export PATH="$JAVA_HOME/bin:$PATH"
        log_info "JDK 设置完成 ✓"
        return 0
    else
        log_error "请安装 JDK 8 或更高版本后重试"
        log_error "下载地址: https://adoptium.net/"
        return 1
    fi
}

check_maven() {
    log_step "检查 Maven 环境..."
    
    if [ -f "$PROJECT_DIR/mvnw" ]; then
        MVN_CMD="$PROJECT_DIR/mvnw"
        chmod +x "$MVN_CMD" 2>/dev/null || true
        log_info "使用项目 Maven Wrapper ✓"
        return 0
    fi
    
    if command -v mvn >/dev/null 2>&1; then
        MVN_CMD="mvn"
        log_info "使用系统 Maven ✓"
        return 0
    fi
    
    log_error "未找到可用的 Maven"
    return 1
}

build_project() {
    log_step "开始构建项目..."
    cd "$PROJECT_DIR"
    
    log_note "Java Home: $JAVA_HOME"
    log_note "Java 版本: $(java -version 2>&1 | head -n 1)"
    log_note "Maven 命令: $MVN_CMD"
    echo ""
    
    if ! $MVN_CMD clean package -DskipTests -q; then
        log_error "项目构建失败！"
        return 1
    fi
    
    log_info "项目构建成功 ✓"
}

find_jar_file() {
    find "$PROJECT_DIR/target" -name "api-field-lineage-service-*.jar" | head -n 1
}

start_service() {
    log_step "启动 API 字段血缘服务..."
    
    mkdir -p "$DATA_DIR"
    local jar_file=$(find_jar_file)
    
    if [ -z "$jar_file" ]; then
        log_error "未找到 Jar 文件，请先执行构建"
        return 1
    fi
    
    log_info "使用 Jar 文件: $jar_file"
    echo ""
    log_note "服务将在以下地址启动:"
    log_note "  - 主页: http://localhost:8080"
    log_note "  - H2 控制台: http://localhost:8080/h2-console"
    log_note "按 Ctrl+C 停止服务"
    echo ""
    echo "═══════════════════════════════════════════════════════════════════"
    echo ""
    
    java -jar "$jar_file"
}

show_usage() {
    echo "用法: $0 [命令] [选项]"
    echo ""
    echo "命令:"
    echo "  build      仅构建项目"
    echo "  start      仅启动服务（需先构建）"
    echo "  all        构建并启动（默认）"
    echo "  setup      仅设置 JDK 环境"
    echo "  clean      清理构建文件"
    echo "  help       显示帮助信息"
    echo ""
    echo "选项:"
    echo "  --no-auto-install    不自动安装 JDK"
    echo ""
    echo "示例:"
    echo "  $0                    # 完整流程（推荐）"
    echo "  $0 build              # 仅构建"
    echo "  $0 start              # 仅启动"
    echo "  $0 --no-auto-install  # 不自动安装 JDK"
    echo ""
}

main() {
    local cmd="all"
    
    # 解析参数
    while [ $# -gt 0 ]; do
        case "$1" in
            --no-auto-install)
                AUTO_INSTALL=false
                shift
                ;;
            build|start|all|setup|clean|help|--help|-h)
                cmd="$1"
                shift
                ;;
            *)
                log_error "未知参数: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    print_banner
    
    case "$cmd" in
        help)
            show_usage
            ;;
        setup)
            setup_jdk
            log_info "JDK 环境设置完成！"
            log_note "JAVA_HOME: $JAVA_HOME"
            ;;
        clean)
            log_step "清理构建文件..."
            rm -rf "$PROJECT_DIR/target"
            log_info "清理完成 ✓"
            ;;
        build)
            setup_jdk
            check_maven
            build_project
            echo ""
            log_info "构建完成！"
            log_note "运行 '$0 start' 启动服务"
            echo ""
            ;;
        start)
            setup_jdk
            start_service
            ;;
        all)
            setup_jdk
            check_maven
            build_project
            start_service
            ;;
        *)
            log_error "未知命令: $cmd"
            show_usage
            exit 1
            ;;
    esac
}

main "$@"
