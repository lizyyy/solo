#!/bin/bash

echo "========================================"
echo "  API合成事务巡检 - 环境配置工具"
echo "========================================"
echo ""

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_ok() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_fail() {
    echo -e "${RED}❌ $1${NC}"
}

# ============ 检查Java ============
echo "=== 检查Java环境 ==="
echo ""

if ! command -v java &> /dev/null; then
    print_fail "未检测到Java，请先安装JDK 8+"
    echo ""
    echo "  Ubuntu/Debian: sudo apt install openjdk-8-jdk"
    echo "  CentOS/RHEL:   sudo yum install java-1.8.0-openjdk"
    echo "  MacOS:         brew install openjdk@8"
    echo ""
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -1)
print_ok "$JAVA_VERSION"
echo ""

# ============ 检查Maven ============
echo "=== 检查Maven环境 ==="
echo ""

USE_MVN=0

# 优先使用系统Maven
if command -v mvn &> /dev/null; then
    print_ok "使用系统Maven"
    echo ""
    MVN_CMD="mvn"
    USE_MVN=1
else
    # 检查并安装 Maven Wrapper
    WRAPPER_DIR=".mvn/wrapper"
    WRAPPER_JAR="$WRAPPER_DIR/maven-wrapper.jar"
    WRAPPER_PROPS="$WRAPPER_DIR/maven-wrapper.properties"
    
    if [ -f "$WRAPPER_JAR" ] && [ -f "./mvnw" ]; then
        print_ok "Maven Wrapper 已就绪"
        MVN_CMD="./mvnw"
        USE_MVN=1
    else
        print_warn "未找到Maven，正在安装Maven Wrapper..."
        echo ""
        
        mkdir -p "$WRAPPER_DIR"
        
        # 下载 maven-wrapper.jar
        MAVEN_WRAPPER_URL="https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.1.0/maven-wrapper-3.1.0.jar"
        
        echo "正在下载 maven-wrapper.jar..."
        if command -v curl &> /dev/null; then
            curl -f -L -o "$WRAPPER_JAR" "$MAVEN_WRAPPER_URL" 2>/dev/null
        elif command -v wget &> /dev/null; then
            wget -q -O "$WRAPPER_JAR" "$MAVEN_WRAPPER_URL" 2>/dev/null
        else
            print_fail "未找到 curl 或 wget，无法自动下载"
            echo ""
            echo "请手动下载："
            echo "  $MAVEN_WRAPPER_URL"
            echo "  保存到: $WRAPPER_JAR"
            echo ""
            exit 1
        fi
        
        # 检查下载结果
        if [ ! -f "$WRAPPER_JAR" ]; then
            print_fail "下载失败，请检查网络连接"
            exit 1
        fi
        
        # 验证文件大小（正常应该大于50KB）
        FILE_SIZE=$(wc -c < "$WRAPPER_JAR" 2>/dev/null || echo "0")
        if [ "$FILE_SIZE" -lt 50000 ]; then
            print_fail "下载的文件不完整，请检查网络"
            rm -f "$WRAPPER_JAR"
            exit 1
        fi
        
        print_ok "maven-wrapper.jar 下载成功 ($((FILE_SIZE/1024)) KB)"
        
        # 确保 mvnw 脚本存在且可执行
        if [ ! -f "./mvnw" ]; then
            print_warn "mvnw 脚本不存在，请确保项目根目录有该文件"
        else
            chmod +x ./mvnw
        fi
        
        MVN_CMD="./mvnw"
        USE_MVN=1
    fi
fi

echo ""

# ============ 编译项目 ============
echo "=== 编译项目 ==="
echo ""

if [ $USE_MVN -eq 1 ]; then
    echo "正在编译项目，请稍候..."
    echo "(首次运行需要下载依赖，可能需要几分钟)"
    echo ""
    
    $MVN_CMD compile -DskipTests -q 2>&1 | tail -10
    
    if [ $? -ne 0 ]; then
        echo ""
        print_fail "编译失败，请检查网络或代码错误"
        echo ""
        echo "如果是依赖下载问题，可以配置Maven镜像源:"
        echo "  编辑 ~/.m2/settings.xml，添加阿里云镜像"
        echo ""
        exit 1
    fi
    
    print_ok "项目编译成功"
else
    print_warn "跳过编译，请手动编译项目"
fi

echo ""

# ============ 设置执行权限 ============
echo "=== 设置脚本权限 ==="
echo ""

chmod +x *.sh 2>/dev/null
print_ok "脚本权限已设置"

echo ""
echo "========================================"
print_ok "环境配置完成！"
echo "========================================"
echo ""
echo "可用命令:"
echo "  ./self-check.sh          - 运行自检测试"
echo "  ./start.sh               - 启动服务"
echo "  ./mvnw spring-boot:run  - 启动服务"
echo ""
echo "下一步操作:"
echo "  1. 运行 ./self-check.sh 验证核心功能"
echo "  2. 运行 ./start.sh 启动完整服务"
echo ""
