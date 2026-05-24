#!/bin/bash
# 县域防汛安置物资 API - 全能启动脚本
# 支持: Maven 运行 / 预编译 Jar 运行 / 类文件直接运行

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo "========================================"
echo "  县域防汛安置物资 API - 启动器"
echo "========================================"
echo ""

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 方法1: 检查预编译的 Jar 包
check_jar() {
    local JAR_FILE=$(ls target/county-flood-relief-api-*.jar 2>/dev/null | head -1)
    if [ -n "$JAR_FILE" ] && [ -f "$JAR_FILE" ]; then
        echo "$JAR_FILE"
    fi
}

# 方法2: 查找 Maven
find_maven() {
    # 标准路径
    if command -v mvn >/dev/null 2>&1; then
        echo "mvn"
        return
    fi
    
    # Homebrew
    [ -f "/opt/homebrew/bin/mvn" ] && echo "/opt/homebrew/bin/mvn" && return
    [ -f "/usr/local/bin/mvn" ] && echo "/usr/local/bin/mvn" && return
    [ -f "/usr/local/Cellar/maven/*/bin/mvn" ] && ls /usr/local/Cellar/maven/*/bin/mvn 2>/dev/null | head -1 && return
    
    # IDE 和其他位置
    local FOUND=$(find /Users -name "mvn" -type f 2>/dev/null | grep -v ".m2" | head -1)
    [ -n "$FOUND" ] && echo "$FOUND" && return
    
    # 项目本地 Maven
    [ -f "tools/maven/bin/mvn" ] && echo "tools/maven/bin/mvn" && return
}

# 方法3: 直接运行类文件（需要依赖）
run_with_classes() {
    warn "尝试直接运行编译后的类文件..."
    warn "注意: 需要所有依赖 jar 包在 lib/ 目录下"
    
    if [ ! -d "lib" ]; then
        error "未找到 lib/ 依赖目录"
        return 1
    fi
    
    local CP="target/classes:lib/*"
    java -cp "$CP" com.floodrelief.FloodReliefApplication
}

# 显示帮助信息
show_help() {
    echo ""
    echo "========================================"
    echo "  📦 多种启动方式"
    echo "========================================"
    echo ""
    echo "方式1: 使用 Maven 运行（推荐）"
    echo "  brew install maven"
    echo "  mvn clean spring-boot:run"
    echo ""
    echo "方式2: 使用预编译 Jar"
    echo "  mvn clean package"
    echo "  java -jar target/county-flood-relief-api-1.0.0.jar"
    echo ""
    echo "方式3: 使用项目本地 Maven"
    echo "  mkdir -p tools/maven"
    echo "  下载 maven 并解压到 tools/maven/"
    echo "  ./start.sh"
    echo ""
    echo "方式4: 验证 API（服务启动后）"
    echo "  ./verify-api.sh"
    echo ""
}

# 主逻辑
main() {
    # 首先检查 Jar
    JAR_FILE=$(check_jar)
    if [ -n "$JAR_FILE" ]; then
        info "发现预编译 Jar 包: $JAR_FILE"
        info "直接启动服务..."
        echo ""
        echo "📡 API 地址: http://localhost:8080/api"
        echo "🔍 H2 控制台: http://localhost:8080/api/h2-console"
        echo ""
        java -jar "$JAR_FILE"
        return 0
    fi
    
    # 查找 Maven
    MVN_CMD=$(find_maven)
    if [ -n "$MVN_CMD" ]; then
        info "找到 Maven: $MVN_CMD"
        info "构建并启动服务..."
        echo ""
        echo "📡 API 地址: http://localhost:8080/api"
        echo "🔍 H2 控制台: http://localhost:8080/api/h2-console"
        echo ""
        "$MVN_CMD" clean spring-boot:run
        return 0
    fi
    
    # 没有找到运行环境
    error "未找到可用的运行环境！"
    show_help
    exit 1
}

main "$@"
