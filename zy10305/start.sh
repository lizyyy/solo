#!/bin/bash

set -e

echo "========================================"
echo "  分布式缓存失效编排 API - 启动器"
echo "========================================"
echo ""

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

APP_JAR="target/cache-invalidation-orchestrator-1.0.0.jar"
MAIN_CLASS="com.cache.orchestrator.CacheInvalidationApplication"

mkdir -p data

echo " [1/3] 检测可用启动方式..."
echo ""

# 方式1: 已有可执行 jar，直接运行
if [ -f "$APP_JAR" ]; then
    echo "   ✓ 找到可执行 jar: $APP_JAR"
    LAUNCH_MODE="jar"
# 方式2: 有系统 Maven，编译后运行
elif command -v mvn > /dev/null 2>&1; then
    echo "   ✓ 找到系统 Maven"
    LAUNCH_MODE="maven"
# 方式3: 使用 Maven Wrapper，下载后编译运行
elif command -v curl > /dev/null 2>&1 || command -v wget > /dev/null 2>&1; then
    echo "   ✓ 使用 Maven Wrapper"
    LAUNCH_MODE="wrapper"
# 方式4: IDE 已编译，直接用 class 文件运行
elif [ -f "target/classes/$MAIN_CLASS.class" ]; then
    echo "   ✓ 找到已编译的类文件"
    LAUNCH_MODE="classes"
else
    echo "   ✗ 未找到直接可用的启动方式"
    LAUNCH_MODE="none"
fi

echo ""
echo " [2/3] 准备启动环境..."
echo ""

case "$LAUNCH_MODE" in
    "jar")
        echo "   使用方式1: 直接运行可执行 jar"
        echo ""
        echo "   启动命令: java -jar $APP_JAR"
        echo ""
        echo "========================================"
        echo ""
        exec java -jar "$APP_JAR"
        ;;
        
    "maven")
        echo "   使用方式2: 系统 Maven 编译并运行"
        echo ""
        echo "   正在编译项目 (首次运行需要下载依赖，请稍候)..."
        echo "   编译日志: mvn compile -q -DskipTests"
        echo ""
        
        if mvn compile -q -DskipTests 2>&1 | tail -5; then
            echo ""
            echo "   ✓ 编译成功!"
            echo ""
            echo "   正在启动应用..."
            echo ""
            echo "========================================"
            echo ""
            exec mvn spring-boot:run -q
        else
            echo ""
            echo "   ✗ 编译失败，请检查错误信息"
            exit 1
        fi
        ;;
        
    "wrapper")
        echo "   使用方式3: Maven Wrapper 编译并运行"
        echo ""
        echo "   正在下载 Maven (仅首次运行)..."
        chmod +x mvnw
        
        echo ""
        echo "   正在编译项目 (首次运行需要下载依赖，请稍候)..."
        echo "   编译日志: ./mvnw compile -q -DskipTests"
        echo ""
        
        if ./mvnw compile -q -DskipTests 2>&1 | tail -5; then
            echo ""
            echo "   ✓ 编译成功!"
            echo ""
            echo "   正在启动应用..."
            echo ""
            echo "========================================"
            echo ""
            exec ./mvnw spring-boot:run -q
        else
            echo ""
            echo "   ✗ 编译失败，请检查错误信息"
            exit 1
        fi
        ;;
        
    "classes")
        echo "   使用方式4: 直接运行已编译的类文件"
        echo ""
        echo "   正在尝试从 IDE 编译的类文件启动..."
        echo ""
        
        if [ -d "$HOME/.m2/repository" ]; then
            echo "   ✓ 找到 Maven 本地仓库"
            echo ""
            echo "   正在构建类路径..."
            
            CLASSPATH="target/classes"
            
            # 查找常用的 Spring Boot 依赖 jar
            for jar in \
                "$HOME/.m2/repository/org/springframework/boot/spring-boot/2.7.18/spring-boot-2.7.18.jar" \
                "$HOME/.m2/repository/org/springframework/boot/spring-boot-autoconfigure/2.7.18/spring-boot-autoconfigure-2.7.18.jar" \
                "$HOME/.m2/repository/org/springframework/spring-context/5.3.27/spring-context-5.3.27.jar" \
                "$HOME/.m2/repository/org/springframework/spring-core/5.3.27/spring-core-5.3.27.jar" \
                "$HOME/.m2/repository/org/springframework/spring-beans/5.3.27/spring-beans-5.3.27.jar" \
                "$HOME/.m2/repository/org/springframework/spring-web/5.3.27/spring-web-5.3.27.jar" \
                "$HOME/.m2/repository/org/springframework/spring-webmvc/5.3.27/spring-webmvc-5.3.27.jar" \
                "$HOME/.m2/repository/org/springframework/boot/spring-boot-starter-web/2.7.18/spring-boot-starter-web-2.7.18.jar" \
                "$HOME/.m2/repository/com/h2database/h2/2.1.214/h2-2.1.214.jar"; do
                if [ -f "$jar" ]; then
                    CLASSPATH="$CLASSPATH:$jar"
                fi
            done
            
            echo ""
            echo "   正在启动应用..."
            echo ""
            echo "========================================"
            echo ""
            
            exec java -cp "$CLASSPATH" $MAIN_CLASS
        else
            echo "   ✗ 未找到 Maven 本地仓库"
            echo ""
            echo "   请先在 IDE 中编译项目，或安装 Maven"
            exit 1
        fi
        ;;
        
    "none")
        echo "========================================"
        echo "  无法自动启动，请选择以下方式之一:"
        echo "========================================"
        echo ""
        echo "  方式 A: 在 IDE 中运行"
        echo "    1. 用 IntelliJ IDEA / Eclipse 打开项目"
        echo "    2. 找到主类: src/main/java/com/cache/orchestrator/CacheInvalidationApplication.java"
        echo "    3. 右键点击 main 方法，选择 Run"
        echo ""
        echo "  方式 B: 安装系统 Maven"
        echo "    macOS:   brew install maven"
        echo "    Ubuntu:  sudo apt install maven"
        echo "    CentOS:  sudo yum install maven"
        echo ""
        echo "  方式 C: 手动下载依赖 jar"
        echo "    访问 https://start.spring.io/ 下载预编译项目"
        echo ""
        echo "  方式 D: 等待 IDE 自动编译后重试"
        echo "    如果您的 IDE 正在后台编译，请稍等片刻后重试"
        echo ""
        exit 1
        ;;
esac
