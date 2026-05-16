#!/bin/bash
# 快速启动脚本 - 最终版

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  API 可观测标签校验系统 - 快速启动${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 检查 Java
check_java() {
    if ! command -v java >/dev/null 2>&1; then
        echo -e "${RED}✗ 未找到 Java，请先安装 JDK 17+${NC}"
        echo "   macOS:  brew install openjdk@17"
        echo "   Linux:  sudo apt install openjdk-17-jdk"
        exit 1
    fi
    
    JAVA_VERSION=$(java -version 2>&1 | head -1 | grep -Eo '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
    JAVA_MAJOR=$(echo $JAVA_VERSION | cut -d. -f1)
    if [ "$JAVA_MAJOR" = "1" ]; then
        JAVA_MAJOR=$(echo $JAVA_VERSION | cut -d. -f2)
    fi
    
    if [ "$JAVA_MAJOR" -lt 17 ]; then
        echo -e "${RED}✗ Java 版本过低: $JAVA_VERSION，需要 >= 17${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Java 版本: $JAVA_VERSION${NC}"
    return 0
}

check_java
echo ""

# 优先级 1: 检查是否有预编译 jar
if [ -f "$SCRIPT_DIR/target/api-tag-validation-1.0.0.jar" ]; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  发现预编译 jar 包，直接启动${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    cd "$SCRIPT_DIR"
    exec java -jar target/api-tag-validation-1.0.0.jar
fi

# 优先级 2: 使用系统 Maven
if command -v mvn >/dev/null 2>&1; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  使用系统 Maven${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    cd "$SCRIPT_DIR"
    
    if [ ! -d "target" ] || [ -z "$(ls target/*.jar 2>/dev/null)" ]; then
        echo "第一步: 编译项目..."
        mvn clean package -DskipTests
        echo ""
    fi
    
    echo "第二步: 启动服务..."
    exec mvn spring-boot:run
fi

# 优先级 3: 使用 Maven Wrapper
if [ -f "$SCRIPT_DIR/mvnw" ]; then
    echo -e "${YELLOW}========================================${NC}"
    echo -e "${YELLOW}  使用 Maven Wrapper（可能需要联网下载）${NC}"
    echo -e "${YELLOW}========================================${NC}"
    echo ""
    cd "$SCRIPT_DIR"
    
    echo "第一步: 编译项目..."
    if ./mvnw clean package -DskipTests; then
        echo ""
        echo "第二步: 启动服务..."
        exec ./mvnw spring-boot:run
    else
        echo ""
        echo -e "${RED}========================================${NC}"
        echo -e "${RED}  Maven Wrapper 编译失败${NC}"
        echo -e "${RED}========================================${NC}"
        echo ""
        echo "可用替代方案："
        echo ""
        echo "  📦 1. 安装系统 Maven（推荐）"
        echo "     macOS:  brew install maven"
        echo "     Linux:  sudo apt install maven"
        echo ""
        echo "  💻 2. 使用 IDE 直接运行主类"
        echo "     com.observability.tagvalidation.TagValidationApplication"
        echo ""
        echo "  📥 3. 手动下载 Maven Wrapper"
        echo "     mkdir -p .mvn/wrapper"
        echo "     curl -o .mvn/wrapper/maven-wrapper.jar \\"
        echo "       https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.2.0/maven-wrapper-3.2.0.jar"
        exit 1
    fi
fi

# 都不可用
echo -e "${RED}========================================${NC}"
echo -e "${RED}  未找到可用的 Maven 环境${NC}"
echo -e "${RED}========================================${NC}"
echo ""
echo "可用替代方案（按优先级）："
echo ""
echo "  📦 1. 安装系统 Maven（推荐）"
echo "     macOS:  brew install maven"
echo "     Linux:  sudo apt install maven"
echo ""
echo "  💻 2. 使用 IDE 直接运行主类"
echo "     com.observability.tagvalidation.TagValidationApplication"
echo ""
echo "  📥 3. 手动下载 Maven Wrapper"
echo "     mkdir -p .mvn/wrapper"
echo "     curl -o .mvn/wrapper/maven-wrapper.jar \\"
echo "       https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.2.0/maven-wrapper-3.2.0.jar"
echo ""
exit 1
