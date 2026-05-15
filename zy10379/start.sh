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
NC='\033[0m'

print_header() {
    clear
    echo "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo "${BLUE}║${NC}  ${GREEN}🔐 服务令牌交换 API - 启动脚本${NC}                               ${BLUE}║${NC}"
    echo "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_footer() {
    echo ""
    echo "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo "访问地址:"
    echo "  - 管理首页:    ${GREEN}http://localhost:8080${NC}"
    echo "  - H2 控制台:   ${GREEN}http://localhost:8080/h2-console${NC}"
    echo "  - API 文档:    ${GREEN}http://localhost:8080/api/token/diagnostic/summary${NC}"
    echo "${BLUE}══════════════════════════════════════════════════════════════${NC}"
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
    mvn clean spring-boot:run
}

run_with_precompiled() {
    echo ""
    echo "${BLUE}[1/2]${NC} 检查已编译的 class 文件..."
    
    if [ ! -d "target/classes" ]; then
        echo "${RED}❌ 未找到编译后的 class 文件${NC}"
        return 1
    fi
    
    echo "${GREEN}✅ 找到 class 文件${NC}"
    echo ""
    echo "${BLUE}[2/2]${NC} 尝试直接启动 Spring Boot 应用..."
    echo ""
    
    # 检查是否有依赖 jar
    if [ -f "pom.xml" ]; then
        echo "${YELLOW}⚠️  需要依赖的 jar 包，请先使用 Maven 编译下载依赖${NC}"
        echo "   或使用 IDE (IntelliJ IDEA, Eclipse) 直接打开项目运行"
        return 1
    fi
    
    return 0
}

show_ide_guide() {
    echo ""
    echo "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo "${YELLOW}📝 IDE 运行指南:${NC}"
    echo ""
    echo "方式 1: IntelliJ IDEA / Eclipse"
    echo "  1. 打开 IDE，选择 'Open' 或 'Import Project'"
    echo "  2. 选择项目根目录，作为 Maven 项目导入"
    echo "  3. 等待 IDE 下载依赖并构建项目"
    echo "  4. 找到 TokenExchangeApplication.java 右键运行"
    echo ""
    echo "方式 2: VS Code"
    echo "  1. 安装 Extension Pack for Java 插件"
    echo "  2. 打开项目文件夹"
    echo "  3. 在 Java Projects 面板中找到 TokenExchangeApplication"
    echo "  4. 点击 'Run' 按钮"
    echo ""
    echo "方式 3: 安装 Maven 后重新运行此脚本"
    echo "  Maven 下载地址: https://maven.apache.org/install.html"
    echo "${BLUE}══════════════════════════════════════════════════════════════${NC}"
}

show_api_tests() {
    echo ""
    echo "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo "${GREEN}🧪 启动成功后的 API 测试命令:${NC}"
    echo ""
    echo "# 查看所有服务:"
    echo "  curl http://localhost:8080/api/admin/services"
    echo ""
    echo "# 查看所有场景:"
    echo "  curl http://localhost:8080/api/admin/scenarios"
    echo ""
    echo "# 创建用户令牌:"
    echo "  curl -X POST http://localhost:8080/api/admin/user-tokens \\"
    echo "    -H 'Content-Type: application/json' \\"
    echo "    -d '{\"userId\": \"user-001\", \"scopes\": \"read,write\", \"expireDays\": 30}'"
    echo ""
    echo "# 令牌交换测试:"
    echo "  curl -X POST http://localhost:8080/api/token/exchange \\"
    echo "    -H 'Content-Type: application/json' \\"
    echo "    -d '{\"userToken\": \"你的令牌值\", \"sourceServiceId\": \"service-user\", \\"
    echo "         \"targetServiceId\": \"service-order\", \"scenarioCode\": \"USER_TO_ORDER\"}'"
    echo "${BLUE}══════════════════════════════════════════════════════════════${NC}"
}

# 主逻辑
print_header
check_java

echo ""
echo "请选择启动方式:"
echo "  ${GREEN}1${NC} - 使用 Maven 编译并启动 (推荐)"
echo "  ${GREEN}2${NC} - 使用 IDE 运行 (IntelliJ/Eclipse/VS Code)"
echo "  ${GREEN}3${NC} - 退出"
echo ""
read -p "请输入选项 (1-3): " choice

case $choice in
    1)
        if check_maven; then
            run_with_maven
            print_footer
            show_api_tests
        else
            echo ""
            echo "${YELLOW}未找到 Maven，切换到 IDE 运行指南...${NC}"
            show_ide_guide
        fi
        ;;
    2)
        show_ide_guide
        ;;
    3)
        echo "退出"
        exit 0
        ;;
    *)
        echo "${RED}无效选项${NC}"
        exit 1
        ;;
esac
