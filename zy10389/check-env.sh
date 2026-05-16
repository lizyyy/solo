#!/bin/bash
# 环境检查脚本 - 最终版

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  API 可观测标签校验系统 - 环境检查${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

JAVA_OK=false
MVN_OK=false
CURL_OK=false

# 检查 Java
echo "[1/3] 检查 Java 环境..."
if command -v java >/dev/null 2>&1; then
    JAVA_VERSION=$(java -version 2>&1 | head -1 | grep -Eo '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
    JAVA_MAJOR=$(echo $JAVA_VERSION | cut -d. -f1)
    # Java 8 显示 1.8.x
    if [ "$JAVA_MAJOR" = "1" ]; then
        JAVA_MAJOR=$(echo $JAVA_VERSION | cut -d. -f2)
    fi
    
    echo -e "  版本: $JAVA_VERSION (主版本: $JAVA_MAJOR)"
    
    if [ "$JAVA_MAJOR" -ge 17 ]; then
        echo -e "  ${GREEN}✓ 版本符合要求 (>= 17)${NC}"
        JAVA_OK=true
    else
        echo -e "  ${RED}✗ 版本不符合要求，需要 >= 17${NC}"
        JAVA_OK=false
    fi
else
    echo -e "  ${RED}✗ 未安装 Java${NC}"
    JAVA_OK=false
fi
echo ""

# 检查 Maven
echo "[2/3] 检查 Maven 环境..."
HAS_SYSTEM_MVN=false
HAS_WRAPPER=false

if command -v mvn >/dev/null 2>&1; then
    if mvn -version >/dev/null 2>&1; then
        MVN_VERSION=$(mvn -v | head -1 | awk '{print $3}')
        echo -e "  ${GREEN}✓ 系统 Maven 已安装: $MVN_VERSION${NC}"
        HAS_SYSTEM_MVN=true
        MVN_OK=true
    fi
fi

if [ "$HAS_SYSTEM_MVN" = false ] && [ -f "./mvnw" ]; then
    echo "  发现 Maven Wrapper 脚本，正在验证..."
    if ./mvnw --version >/dev/null 2>&1; then
        echo -e "  ${GREEN}✓ Maven Wrapper 可用${NC}"
        HAS_WRAPPER=true
        MVN_OK=true
    else
        echo -e "  ${YELLOW}⚠ Maven Wrapper 需要联网下载依赖${NC}"
    fi
fi

if [ "$MVN_OK" = false ]; then
    echo -e "  ${RED}✗ Maven 不可用${NC}"
fi
echo ""

# 检查 curl
echo "[3/3] 检查 curl 环境..."
if command -v curl >/dev/null 2>&1; then
    CURL_VERSION=$(curl --version | head -1 | awk '{print $2}')
    echo -e "  ${GREEN}✓ curl 已安装: $CURL_VERSION${NC}"
    CURL_OK=true
else
    echo -e "  ${RED}✗ curl 未安装${NC}"
    CURL_OK=false
fi
echo ""

# 汇总结果
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  检查结果汇总${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "  Java:   $($JAVA_OK && echo "${GREEN}✓ 就绪${NC}" || echo "${RED}✗ 需升级${NC}")"
echo -e "  Maven:  $($MVN_OK && echo "${GREEN}✓ 就绪${NC}" || echo "${RED}✗ 需配置${NC}")"
echo -e "  curl:   $($CURL_OK && echo "${GREEN}✓ 就绪${NC}" || echo "${RED}✗ 需安装${NC}")"
echo ""

if $JAVA_OK && $MVN_OK; then
    echo -e "${GREEN}✓ 环境检查通过！${NC}"
    echo ""
    echo "  下一步操作："
    
    if $HAS_SYSTEM_MVN; then
        echo "    📦 编译: mvn clean package -DskipTests"
        echo "       启动: mvn spring-boot:run"
    else
        echo "    📥 编译: ./mvnw clean package -DskipTests"
        echo "       启动: ./mvnw spring-boot:run"
    fi
    
    echo "    🧪 测试: ./test_demo.sh"
    echo ""
elif $JAVA_OK; then
    echo -e "${YELLOW}⚠ Java 就绪，但 Maven 不可用${NC}"
    echo ""
    echo "  可用方案（按优先级）："
    echo ""
    echo "  📦 方案 1: 安装系统 Maven（推荐）"
    echo "     macOS:  brew install maven"
    echo "     Linux:  sudo apt install maven"
    echo "     Windows: choco install maven"
    echo ""
    echo "  🚀 方案 2: 使用一键启动脚本"
    echo "     ./quick-start.sh"
    echo ""
    echo "  💻 方案 3: 使用 IDE 直接运行"
    echo "     主类: com.observability.tagvalidation.TagValidationApplication"
    echo ""
    echo "  📥 方案 4: 手动下载 Maven Wrapper"
    echo "     mkdir -p .mvn/wrapper"
    echo "     curl -o .mvn/wrapper/maven-wrapper.jar \\"
    echo "       https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.2.0/maven-wrapper-3.2.0.jar"
    echo ""
    exit 1
else
    echo -e "${RED}✗ 环境检查不通过${NC}"
    echo ""
    echo "  请先安装 Java 17+:"
    echo "     macOS:  brew install openjdk@17"
    echo "     Linux:  sudo apt install openjdk-17-jdk"
    echo "     Windows: 下载 Oracle JDK 17"
    echo ""
    exit 1
fi
