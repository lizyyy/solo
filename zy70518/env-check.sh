#!/bin/bash
# 环境检查与诊断脚本
# 检测当前可用的构建/运行选项

set +e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
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

log_ok() {
    echo -e "${GREEN}✓${NC} $1"
}

log_no() {
    echo -e "${RED}✗${NC} $1"
}

log_title() {
    echo -e "${BLUE}$1${NC}"
}

log_section() {
    echo -e "${PURPLE}### $1${NC}"
}

echo ""
log_title "=============================================="
log_title "   连接池泄漏诊断API - 环境诊断工具"
log_title "=============================================="
echo ""

HAS_JAVA=0
HAS_MVN=0
HAS_DOCKER=0
HAS_DOCKER_COMPOSE=0
HAS_JAR=0
DOCKER_DAEMON_RUNNING=0

# 检查 Java
log_section "1. Java 环境"
if command -v java >/dev/null 2>&1; then
    JAVA_VER=$(java -version 2>&1 | head -1)
    log_ok "Java 已安装: $JAVA_VER"
    HAS_JAVA=1
else
    log_no "Java 未安装"
fi

# 检查 Maven
log_section "2. Maven 环境"
if command -v mvn >/dev/null 2>&1; then
    MVN_VER=$(mvn -v | head -1)
    log_ok "Maven 已安装: $MVN_VER"
    HAS_MVN=1
else
    log_no "Maven 未安装 (mvn 命令不可用)"
fi

# 检查 Docker
log_section "3. Docker 环境"
if command -v docker >/dev/null 2>&1; then
    DOCKER_VER=$(docker --version)
    log_ok "Docker 已安装: $DOCKER_VER"
    HAS_DOCKER=1
    
    if docker info >/dev/null 2>&1; then
        log_ok "Docker daemon 正在运行"
        DOCKER_DAEMON_RUNNING=1
    else
        log_no "Docker daemon 未运行，请启动 Docker Desktop"
    fi
else
    log_no "Docker 未安装"
fi

# 检查 Docker Compose
if [ $HAS_DOCKER -eq 1 ]; then
    if command -v docker-compose >/dev/null 2>&1; then
        log_ok "Docker Compose (v1) 可用"
        HAS_DOCKER_COMPOSE=1
    elif docker compose version >/dev/null 2>&1; then
        log_ok "Docker Compose (v2) 可用"
        HAS_DOCKER_COMPOSE=1
    else
        log_no "Docker Compose 不可用"
    fi
fi

# 检查已编译的 JAR
log_section "4. 已编译产物检查"
if ls "$SCRIPT_DIR"/target/*.jar 1>/dev/null 2>&1; then
    JAR_COUNT=$(ls "$SCRIPT_DIR"/target/*.jar 2>/dev/null | wc -l)
    log_ok "找到 $JAR_COUNT 个已编译的 JAR 文件"
    ls -lh "$SCRIPT_DIR"/target/*.jar 2>/dev/null | head -5
    HAS_JAR=1
else
    log_no "未找到已编译的 JAR 文件 (target/*.jar)"
fi

# 源代码完整性检查
log_section "5. 源代码完整性检查"
JAVA_FILES=$(find "$SCRIPT_DIR/src" -name "*.java" 2>/dev/null | wc -l)
if [ "$JAVA_FILES" -gt 0 ]; then
    log_ok "找到 $JAVA_FILES 个 Java 源文件"
else
    log_no "未找到 Java 源文件"
fi

# 关键文件检查
log_section "6. 关键配置文件检查"

check_file() {
    if [ -f "$SCRIPT_DIR/$1" ]; then
        log_ok "$1 存在"
    else
        log_no "$1 缺失"
    fi
}

check_file "pom.xml"
check_file "Dockerfile"
check_file "docker-compose.yml"
check_file "src/main/resources/application.yml"

# 归档接口修复检查
log_section "7. 归档接口修复验证"
if grep -q "@Modifying" "$SCRIPT_DIR/src/main/java/com/diagnostic/repository/ConnectionPoolDiagnosticRepository.java" 2>/dev/null; then
    log_ok "✅ @Modifying 注解已添加到 ConnectionPoolDiagnosticRepository"
else
    log_no "❌ ConnectionPoolDiagnosticRepository 缺少 @Modifying 注解"
fi

if grep -q "@Transactional" "$SCRIPT_DIR/src/main/java/com/diagnostic/repository/ConnectionPoolDiagnosticRepository.java" 2>/dev/null; then
    log_ok "✅ @Transactional 注解已添加"
else
    log_no "❌ 缺少 @Transactional 注解"
fi

# 可用启动方式总结
echo ""
log_title "=============================================="
log_title "   可用的启动方式总结"
log_title "=============================================="
echo ""

can_start=0

echo "🔹 方式 1: 本地 Maven"
if [ $HAS_MVN -eq 1 ]; then
    log_ok "✅ 可用"
    echo "   命令: mvn spring-boot:run"
    can_start=1
else
    log_no "❌ 不可用（未安装 Maven）"
fi
echo ""

echo "🔹 方式 2: Maven Wrapper (./mvnw)"
if [ $HAS_MVN -eq 1 ] || ([ $HAS_DOCKER -eq 1 ] && [ $DOCKER_DAEMON_RUNNING -eq 1 ]); then
    log_ok "✅ 可用"
    echo "   命令: ./mvnw spring-boot:run"
    can_start=1
else
    log_no "❌ 不可用（需要 Maven 或可用的 Docker）"
fi
echo ""

echo "🔹 方式 3: Docker Compose"
if [ $HAS_DOCKER -eq 1 ] && [ $DOCKER_DAEMON_RUNNING -eq 1 ] && [ $HAS_DOCKER_COMPOSE -eq 1 ]; then
    log_ok "✅ 可用"
    echo "   命令: docker-compose up --build"
    can_start=1
else
    log_no "❌ 不可用（需要 Docker daemon 运行 + Docker Compose）"
fi
echo ""

echo "🔹 方式 4: 直接运行 JAR"
if [ $HAS_JAVA -eq 1 ] && [ $HAS_JAR -eq 1 ]; then
    log_ok "✅ 可用"
    echo "   命令: java -jar target/*.jar"
    can_start=1
else
    log_no "❌ 不可用（需要 Java + 已编译的 JAR）"
fi
echo ""

echo "🔹 方式 5: 自动检测脚本 (./start.sh)"
if [ $can_start -eq 1 ]; then
    log_ok "✅ 可用（上述至少一种方式可用）"
else
    log_no "❌ 暂时不可用（需要先安装 Maven 或 Docker）"
fi
echo ""

# 最终建议
log_title "=============================================="
log_title "   建议"
log_title "=============================================="
echo ""

if [ $can_start -eq 1 ]; then
    log_info "✅ 恭喜！您的环境可以启动服务。"
    echo ""
    echo "推荐按如下优先级尝试："
    if [ $HAS_MVN -eq 1 ]; then
        echo "  1. 直接运行: mvn spring-boot:run"
    elif [ $HAS_DOCKER -eq 1 ] && [ $DOCKER_DAEMON_RUNNING -eq 1 ]; then
        echo "  1. 直接运行: docker-compose up --build"
    elif [ $HAS_JAR -eq 1 ]; then
        echo "  1. 直接运行: java -jar target/*.jar"
    fi
else
    log_warn "⚠️  当前环境缺少必要的运行条件"
    echo ""
    echo "请选择以下任一方案："
    echo ""
    echo "方案 A: 安装 Docker Desktop（推荐，零配置）"
    echo "   下载地址: https://docs.docker.com/get-docker/"
    echo "   安装完成后，启动 Docker Desktop，然后运行:"
    echo "      docker-compose up --build"
    echo ""
    echo "方案 B: 安装 Maven"
    echo "   macOS:   brew install maven"
    echo "   Ubuntu:  sudo apt-get install maven"
    echo "   CentOS:  sudo yum install maven"
    echo "   安装后运行: mvn spring-boot:run"
    echo ""
fi

echo ""
log_info "🔍 详细文档请查看 README.md"
echo ""
