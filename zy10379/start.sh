#!/bin/bash

# 服务令牌交换 API - 启动脚本
# 支持多种运行方式，自动检测可用环境

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
    echo "${BLUE}║${NC}  ${GREEN}🔐 服务令牌交换 API - 启动向导${NC}                               ${BLUE}║${NC}"
    echo "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_footer() {
    echo ""
    echo "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo "访问地址:"
    echo "  - 管理首页:    ${GREEN}http://localhost:8080${NC}"
    echo "  - H2 控制台:   ${GREEN}http://localhost:8080/h2-console${NC}"
    echo "  - 系统状态:    ${GREEN}http://localhost:8080/api/token/diagnostic/summary${NC}"
    echo "${BLUE}══════════════════════════════════════════════════════════════${NC}"
}

print_test_commands() {
    echo ""
    echo "${PURPLE}🧪 测试命令参考:${NC}"
    echo ""
    echo "# 查看所有服务:"
    echo "  ${CYAN}curl http://localhost:8080/api/admin/services${NC}"
    echo ""
    echo "# 查看所有场景:"
    echo "  ${CYAN}curl http://localhost:8080/api/admin/scenarios${NC}"
    echo ""
    echo "# 创建用户令牌:"
    echo "  ${CYAN}curl -X POST http://localhost:8080/api/admin/user-tokens \\${NC}"
    echo "    ${CYAN}-H 'Content-Type: application/json' \\${NC}"
    echo "    ${CYAN}-d '{\"userId\": \"user-001\", \"scopes\": \"read,write\", \"expireDays\": 30}'${NC}"
    echo ""
    echo "# 令牌交换测试:"
    echo "  ${CYAN}curl -X POST http://localhost:8080/api/token/exchange \\${NC}"
    echo "    ${CYAN}-H 'Content-Type: application/json' \\${NC}"
    echo "    ${CYAN}-d '{\"userToken\": \"你的令牌值\", \"sourceServiceId\": \"service-auth\", \\${NC}"
    echo "         ${CYAN}\"targetServiceId\": \"service-order\", \"scenarioCode\": \"USER_TO_ORDER\"}'${NC}"
}

check_java() {
    if ! command -v java > /dev/null 2>&1; then
        echo "${RED}❌ 未检测到 Java，请先安装 Java 8+${NC}"
        echo "   下载地址: https://adoptium.net/"
        exit 1
    fi

    JAVA_VERSION=$(java -version 2>&1 | head -n 1 | awk -F'"' '{print $2}')
    echo "${GREEN}✅ 检测到 Java: $JAVA_VERSION${NC}"

    # 检查 Java 版本是否满足 8+
    JAVA_MAJOR=$(echo "$JAVA_VERSION" | cut -d'.' -f1)
    # 对于 1.8.0_xxx 这种格式，取第二个数字
    if [ "$JAVA_MAJOR" = "1" ]; then
        JAVA_MAJOR=$(echo "$JAVA_VERSION" | cut -d'.' -f2)
    fi
    if [ "$JAVA_MAJOR" -lt 8 ]; then
        echo ""
        echo "${YELLOW}⚠️  警告: 当前 Java 版本低于 8，可能无法正常运行${NC}"
        echo "   项目需要 Java 8+，当前版本: $JAVA_VERSION"
        echo ""
        read -p "是否继续尝试启动? (y/n): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

check_maven() {
    if command -v mvn > /dev/null 2>&1; then
        echo "${GREEN}✅ 检测到 Maven: $(mvn -v | head -n 1 | cut -d' ' -f3)${NC}"
        return 0
    else
        echo "${YELLOW}⚠️  未检测到 Maven${NC}"
        return 1
    fi
}

run_with_maven() {
    echo ""
    echo "${BLUE}[1/3]${NC} 使用 Maven 编译并启动..."
    echo ""
    echo "这可能需要几分钟时间，请耐心等待..."
    echo ""
    mvn clean spring-boot:run
}

show_ide_guide() {
    echo ""
    echo "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo "${PURPLE}📝 IDE 运行指南:${NC}"
    echo ""
    echo "${YELLOW}方式 1: IntelliJ IDEA (推荐)${NC}"
    echo "  1. 打开 IntelliJ IDEA"
    echo "  2. 选择 File → Open"
    echo "  3. 选择项目根目录: ${CYAN}$(pwd)${NC}"
    echo "  4. 等待 IDE 自动识别为 Maven 项目并下载依赖"
    echo "  5. 在 Project 面板中找到:"
    echo "     ${CYAN}src/main/java/com/tokenexchange/TokenExchangeApplication.java${NC}"
    echo "  6. 右键点击文件 → Run 'TokenExchangeApplication'"
    echo ""
    echo "${YELLOW}方式 2: Eclipse${NC}"
    echo "  1. 打开 Eclipse"
    echo "  2. 选择 File → Import → Maven → Existing Maven Projects"
    echo "  3. 选择项目根目录: ${CYAN}$(pwd)${NC}"
    echo "  4. 等待依赖下载完成"
    echo "  5. 找到 TokenExchangeApplication.java 右键运行"
    echo ""
    echo "${YELLOW}方式 3: VS Code${NC}"
    echo "  1. 打开 VS Code"
    echo "  2. 安装 Extension Pack for Java 插件"
    echo "  3. File → Open Folder 选择项目目录"
    echo "  4. 在 Java Projects 面板中找到 TokenExchangeApplication"
    echo "  5. 点击 Run 按钮"
    echo ""
    echo "${BLUE}══════════════════════════════════════════════════════════════${NC}"
}

show_quick_start() {
    echo ""
    echo "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo "${PURPLE}⚡ 快速启动提示:${NC}"
    echo ""
    echo "当前目录: ${CYAN}$(pwd)${NC}"
    echo ""
    echo "如果以上方式不可用，你可以:"
    echo ""
    echo "  1. ${GREEN}复制项目路径${NC}到 IDE 中打开"
    echo "  2. ${GREEN}在 IDE 中导入 Maven 项目${NC}"
    echo "  3. ${GREEN}找到主类直接运行${NC}"
    echo ""
    echo "主类位置: ${CYAN}src/main/java/com/tokenexchange/TokenExchangeApplication.java${NC}"
    echo ""
    echo "查看详细文档: ${CYAN}cat IDE_QUICKSTART.md${NC}"
    echo "${BLUE}══════════════════════════════════════════════════════════════${NC}"
}

show_maven_install_guide() {
    echo ""
    echo "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo "${PURPLE}📦 安装 Maven (可选):${NC}"
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
    echo "Windows (Chocolatey):"
    echo "  ${CYAN}choco install maven${NC}"
    echo ""
    echo "手动下载: https://maven.apache.org/download.cgi"
    echo "${BLUE}══════════════════════════════════════════════════════════════${NC}"
}

# 主逻辑
print_header
check_java

echo ""
echo "${PURPLE}请选择启动方式:${NC}"
echo ""
echo "  ${GREEN}1${NC} - 使用 Maven 编译并启动 (需要已安装 Maven)"
echo "  ${GREEN}2${NC} - 查看 IDE 运行指南 (推荐，无需 Maven)"
echo "  ${GREEN}3${NC} - 查看 Maven 安装指南"
echo "  ${GREEN}4${NC} - 退出"
echo ""
read -p "请输入选项 (1-4): " choice

case $choice in
    1)
        if check_maven; then
            run_with_maven
            print_footer
            print_test_commands
        else
            echo ""
            echo "${YELLOW}未检测到 Maven，建议使用 IDE 运行${NC}"
            show_ide_guide
            show_quick_start
        fi
        ;;
    2)
        show_ide_guide
        show_quick_start
        ;;
    3)
        show_maven_install_guide
        ;;
    4)
        echo "退出"
        exit 0
        ;;
    *)
        echo "${RED}无效选项${NC}"
        exit 1
        ;;
esac
