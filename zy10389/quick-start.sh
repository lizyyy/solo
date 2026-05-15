#!/bin/bash
# 快速启动脚本 - 自动检测环境并选择最佳方式启动

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  API 可观测标签校验系统 - 快速启动${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 检查 Java
check_java() {
    if ! command -v java >/dev/null 2>&1; then
        echo -e "${RED}✗ 未找到 Java，请先安装 JDK 17+${NC}"
        exit 1
    fi
    
    JAVA_VERSION=$(java -version 2>&1 | head -1 | grep -Eo '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
    JAVA_MAJOR=$(echo $JAVA_VERSION | cut -d. -f1)
    if [ "$JAVA_MAJOR" = "1" ]; then
        JAVA_MAJOR=$(echo $JAVA_VERSION | cut -d. -f2)
    fi
    
    if [ "$JAVA_MAJOR" -lt 17 ]; then
        echo -e "${RED}✗ Java 版本过低: $JAVA_VERSION，需要 >= 17${NC}"
        echo "请先升级 Java 或设置 JAVA_HOME"
        exit 1
    fi
    echo -e "${GREEN}✓ Java 版本: $JAVA_VERSION${NC}"
    return 0
}

# 检查是否有预编译的 jar
check_prebuilt_jar() {
    if [ -f "target/api-tag-validation-1.0.0.jar" ]; then
        echo -e "${GREEN}✓ 找到预编译的 jar 包${NC}"
        return 0
    fi
    return 1
}

# 检查 Maven
check_maven() {
    if command -v mvn >/dev/null 2>&1; then
        echo -e "${GREEN}✓ 找到系统 Maven${NC}"
        MVN_CMD="mvn"
        return 0
    elif [ -f "./mvnw" ]; then
        echo -e "${GREEN}✓ 找到 Maven Wrapper${NC}"
        MVN_CMD="./mvnw"
        return 0
    fi
    return 1
}

# 主流程
check_java
echo ""

if check_prebuilt_jar; then
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  直接启动预编译版本${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "执行: java -jar target/api-tag-validation-1.0.0.jar"
    echo ""
    exec java -jar target/api-tag-validation-1.0.0.jar
fi

echo -e "${YELLOW}⚠ 未找到预编译 jar 包，需要先编译${NC}"
echo ""

if check_maven; then
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  将使用 Maven 编译并启动${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "步骤 1: 编译项目"
    echo "  $MVN_CMD clean package -DskipTests"
    echo ""
    echo "步骤 2: 启动服务"
    echo "  $MVN_CMD spring-boot:run"
    echo ""
    
    read -p "是否继续？(Y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        echo ""
        echo "开始编译..."
        $MVN_CMD clean package -DskipTests
        
        echo ""
        echo "编译成功，启动服务..."
        exec $MVN_CMD spring-boot:run
    fi
else
    echo ""
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}  未找到可用的 Maven 环境${NC}"
    echo -e "${RED}========================================${NC}"
    echo ""
    echo "解决方案："
    echo ""
    echo "方案 1: 手动下载 Maven Wrapper"
    echo "  mkdir -p .mvn/wrapper"
    echo "  curl -o .mvn/wrapper/maven-wrapper.jar \\"
    echo "    https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.2.0/maven-wrapper-3.2.0.jar"
    echo "  然后重新运行: $0"
    echo ""
    echo "方案 2: 安装系统 Maven"
    echo "  macOS: brew install maven"
    echo "  Linux: sudo apt install maven"
    echo ""
    echo "方案 3: 使用其他方式构建"
    echo "  如有 IDE，可直接运行: com.observability.tagvalidation.TagValidationApplication"
    echo ""
    exit 1
fi
