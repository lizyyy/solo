#!/bin/bash

# 服务令牌交换 API - 智能启动脚本
# 自动检测可用的运行方式，提供多种启动选项

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

print_header() {
    clear
    echo "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo "${BLUE}║${NC}  ${GREEN}🔐 服务令牌交换 API - 智能启动向导${NC}                         ${BLUE}║${NC}"
    echo "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

check_java() {
    if ! command -v java > /dev/null 2>&1; then
        echo "${RED}❌ 未检测到 Java，请先安装 Java 8+${NC}"
        echo "   下载地址: https://adoptium.net/"
        exit 1
    fi

    JAVA_VERSION=$(java -version 2>&1 | head -n 1 | awk -F'"' '{print $2}')
    echo "${GREEN}✅ 检测到 Java: $JAVA_VERSION${NC}"

    JAVA_MAJOR=$(echo "$JAVA_VERSION" | cut -d'.' -f1)
    if [ "$JAVA_MAJOR" = "1" ]; then
        JAVA_MAJOR=$(echo "$JAVA_VERSION" | cut -d'.' -f2)
    fi
    if [ "$JAVA_MAJOR" -lt 8 ]; then
        echo ""
        echo "${RED}❌ Java 版本过低，需要 Java 8+${NC}"
        exit 1
    fi
}

check_maven() {
    # 优先检查系统 Maven
    if command -v mvn > /dev/null 2>&1; then
        MVN_CMD="mvn"
        echo "${GREEN}✅ 检测到系统 Maven: $(mvn -v | head -n 1 | cut -d' ' -f3)${NC}"
        return 0
    fi

    # 检查 Maven Wrapper
    if [ -f "mvnw" ] && [ -f ".mvn/wrapper/maven-wrapper.jar" ]; then
        MVN_CMD="./mvnw"
        echo "${GREEN}✅ 检测到 Maven Wrapper${NC}"
        return 0
    fi

    echo "${YELLOW}⚠️  未检测到 Maven 或 Maven Wrapper${NC}"
    return 1
}

check_curl_or_wget() {
    if command -v curl > /dev/null 2>&1 || command -v wget > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

setup_maven_wrapper() {
    echo ""
    echo "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo "${PURPLE}📦 正在安装 Maven Wrapper...${NC}"
    echo ""

    if [ -x "setup-mvnw.sh" ]; then
        ./setup-mvnw.sh
        return $?
    else
        echo "${RED}❌ setup-mvnw.sh 脚本不存在或不可执行${NC}"
        return 1
    fi
}

run_with_maven() {
    local mvn_cmd=$1
    echo ""
    echo "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo "${PURPLE}🚀 使用 Maven 启动应用${NC}"
    echo ""
    echo "命令: ${CYAN}$mvn_cmd spring-boot:run${NC}"
    echo ""
    echo "${YELLOW}💡 提示: 首次运行会下载依赖，请耐心等待（可能需要几分钟）${NC}"
    echo ""
    echo "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo ""

    $mvn_cmd spring-boot:run
}

show_ide_guide() {
    echo ""
    echo "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo "${PURPLE}📝 IDE 运行指南（无需 Maven）${NC}"
    echo ""
    echo "${YELLOW}方式 1: IntelliJ IDEA（推荐）${NC}"
    echo "  1. 打开 IntelliJ IDEA"
    echo "  2. 选择 File → Open"
    echo "  3. 选择项目目录: ${CYAN}$(pwd)${NC}"
    echo "  4. 等待 IDE 导入项目（自动下载依赖）"
    echo "  5. 找到: src/main/java/com/tokenexchange/TokenExchangeApplication.java"
    echo "  6. 右键 → Run 'TokenExchangeApplication'"
    echo ""
    echo "${YELLOW}方式 2: Eclipse${NC}"
    echo "  1. 打开 Eclipse"
    echo "  2. File → Import → Maven → Existing Maven Projects"
    echo "  3. 选择项目目录: ${CYAN}$(pwd)${NC}"
    echo "  4. 等待导入完成后运行主类"
    echo ""
    echo "${YELLOW}方式 3: VS Code${NC}"
    echo "  1. 安装 Extension Pack for Java"
    echo "  2. 打开项目文件夹"
    echo "  3. 运行 TokenExchangeApplication.java"
    echo ""
    echo "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "详细文档请查看: ${CYAN}cat IDE_QUICKSTART.md${NC}"
}

show_maven_install_guide() {
    echo ""
    echo "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo "${PURPLE}📦 安装系统 Maven${NC}"
    echo ""
    echo "macOS:"
    echo "  ${CYAN}brew install maven${NC}"
    echo ""
    echo "Ubuntu/Debian:"
    echo "  ${CYAN}sudo apt update && sudo apt install maven${NC}"
    echo ""
    echo "CentOS/RHEL:"
    echo "  ${CYAN}sudo yum install maven${NC}"
    echo ""
    echo "Windows:"
    echo "  ${CYAN}choco install maven${NC}"
    echo ""
    echo "手动下载:"
    echo "  ${CYAN}https://maven.apache.org/download.cgi${NC}"
    echo "${BLUE}══════════════════════════════════════════════════════════════${NC}"
}

show_test_commands() {
    echo ""
    echo "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo "${PURPLE}🧪 启动成功后的测试命令${NC}"
    echo ""
    echo "# 查看服务列表:"
    echo "  ${CYAN}curl http://localhost:8080/api/admin/services${NC}"
    echo ""
    echo "# 创建用户令牌:"
    echo "  ${CYAN}curl -X POST http://localhost:8080/api/admin/user-tokens \\${NC}"
    echo "    ${CYAN}-H 'Content-Type: application/json' \\${NC}"
    echo "    ${CYAN}-d '{\"userId\": \"user-001\", \"scopes\": \"read,write\"}'${NC}"
    echo ""
    echo "# 令牌交换测试:"
    echo "  ${CYAN}curl -X POST http://localhost:8080/api/token/exchange \\${NC}"
    echo "    ${CYAN}-H 'Content-Type: application/json' \\${NC}"
    echo "    ${CYAN}-d '{\"userToken\": \"你的令牌值\", \"sourceServiceId\": \"service-auth\", \\${NC}"
    echo "    ${CYAN}\"targetServiceId\": \"service-order\", \"expireMinutes\": 15}'${NC}"
    echo ""
    echo "# 系统诊断:"
    echo "  ${CYAN}curl http://localhost:8080/api/token/diagnostic/summary${NC}"
    echo "${BLUE}══════════════════════════════════════════════════════════════${NC}"
}

show_menu() {
    echo ""
    echo "${PURPLE}请选择操作:${NC}"
    echo ""
    echo "  ${GREEN}1${NC} - 自动检测并启动 (推荐)"
    echo "  ${GREEN}2${NC} - 仅安装 Maven Wrapper"
    echo "  ${GREEN}3${NC} - 查看 IDE 运行指南"
    echo "  ${GREEN}4${NC} - 查看系统 Maven 安装指南"
    echo "  ${GREEN}5${NC} - 查看测试命令"
    echo "  ${GREEN}6${NC} - 退出"
    echo ""
    read -p "请输入选项 (1-6): " choice

    case $choice in
        1)
            auto_start
            ;;
        2)
            if check_curl_or_wget; then
                setup_maven_wrapper
                if [ $? -eq 0 ]; then
                    echo ""
                    read -p "Maven Wrapper 安装完成，是否立即启动应用? (y/n): " yn
                    if [ "$yn" = "y" ] || [ "$yn" = "Y" ]; then
                        check_maven
                        run_with_maven "$MVN_CMD"
                    fi
                fi
            else
                echo "${RED}❌ 需要 curl 或 wget 才能下载 Maven Wrapper${NC}"
                echo "   请先安装 curl 或 wget，或使用 IDE 方式运行"
            fi
            ;;
        3)
            show_ide_guide
            ;;
        4)
            show_maven_install_guide
            ;;
        5)
            show_test_commands
            ;;
        6)
            echo "退出"
            exit 0
            ;;
        *)
            echo "${RED}无效选项${NC}"
            exit 1
            ;;
    esac
}

auto_start() {
    echo ""
    echo "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo "${PURPLE}🔍 自动检测环境...${NC}"
    echo ""

    if check_maven; then
        echo ""
        read -p "检测到 Maven，是否立即启动应用? (y/n): " yn
        if [ "$yn" = "y" ] || [ "$yn" = "Y" ]; then
            run_with_maven "$MVN_CMD"
        fi
    else
        echo ""
        if check_curl_or_wget; then
            read -p "未检测到 Maven，是否自动安装 Maven Wrapper? (y/n): " yn
            if [ "$yn" = "y" ] || [ "$yn" = "Y" ]; then
                setup_maven_wrapper
                if [ $? -eq 0 ]; then
                    echo ""
                    read -p "安装完成，是否立即启动应用? (y/n): " yn2
                    if [ "$yn2" = "y" ] || [ "$yn2" = "Y" ]; then
                        check_maven
                        run_with_maven "$MVN_CMD"
                    fi
                fi
            else
                echo ""
                echo "取消安装，切换到 IDE 运行指南..."
                show_ide_guide
            fi
        else
            echo "${YELLOW}⚠️  未检测到 curl/wget，无法自动安装 Maven Wrapper${NC}"
            echo ""
            show_ide_guide
        fi
    fi
}

# 主流程
print_header
check_java
show_menu
