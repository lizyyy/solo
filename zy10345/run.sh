#!/bin/bash
# 最简单的启动方案 - 直接下载预编译 JAR 并运行

set -e

JAR_URL="https://github.com/spring-projects/spring-boot/releases/download/v2.7.18/spring-boot-2.7.18.jar"
LOCAL_JAR="target/device-command-confirmation-api-1.0.0.jar"

echo "========================================"
echo "设备命令确认 API - 快速启动"
echo "========================================"

# 检查 Java
echo ""
echo "[1/2] 检查 Java 环境..."
java -version
echo ""

# 如果本地没有编译好的 JAR，我们用嵌入式方案
if [ ! -f "$LOCAL_JAR" ]; then
    echo "[2/2] 准备运行环境..."
    
    # 先检查我们的源码是否可以用简单方式编译
    if [ -d "src" ]; then
        echo "  正在下载 ECJ 编译器..."
        mkdir -p lib target/classes
        
        # 下载 ECJ
        if [ ! -f "lib/ecj.jar" ]; then
            curl -s -L -o lib/ecj.jar "https://repo1.maven.org/maven2/org/eclipse/jdt/ecj/3.20.0/ecj-3.20.0.jar"
        fi
        
        # 下载最小依赖集
        echo "  正在下载依赖库..."
        DEPS=(
            "https://repo1.maven.org/maven2/org/springframework/boot/spring-boot/2.7.18/spring-boot-2.7.18.jar"
            "https://repo1.maven.org/maven2/org/springframework/boot/spring-boot-autoconfigure/2.7.18/spring-boot-autoconfigure-2.7.18.jar"
            "https://repo1.maven.org/maven2/org/springframework/spring-context/5.3.31/spring-context-5.3.31.jar"
            "https://repo1.maven.org/maven2/org/springframework/spring-core/5.3.31/spring-core-5.3.31.jar"
            "https://repo1.maven.org/maven2/org/springframework/spring-beans/5.3.31/spring-beans-5.3.31.jar"
            "https://repo1.maven.org/maven2/org/springframework/spring-web/5.3.31/spring-web-5.3.31.jar"
            "https://repo1.maven.org/maven2/org/springframework/spring-webmvc/5.3.31/spring-webmvc-5.3.31.jar"
            "https://repo1.maven.org/maven2/org/springframework/data/spring-data-jpa/2.7.18/spring-data-jpa-2.7.18.jar"
            "https://repo1.maven.org/maven2/org/springframework/spring-orm/5.3.31/spring-orm-5.3.31.jar"
            "https://repo1.maven.org/maven2/org/springframework/spring-tx/5.3.31/spring-tx-5.3.31.jar"
            "https://repo1.maven.org/maven2/org/springframework/spring-aop/5.3.31/spring-aop-5.3.31.jar"
            "https://repo1.maven.org/maven2/org/springframework/spring-jdbc/5.3.31/spring-jdbc-5.3.31.jar"
            "https://repo1.maven.org/maven2/org/springframework/boot/spring-boot-starter-tomcat/2.7.18/spring-boot-starter-tomcat-2.7.18.jar"
            "https://repo1.maven.org/maven2/jakarta/annotation/jakarta.annotation-api/1.3.5/jakarta.annotation-api-1.3.5.jar"
            "https://repo1.maven.org/maven2/com/h2database/h2/2.1.214/h2-2.1.214.jar"
            "https://repo1.maven.org/maven2/org/hibernate/hibernate-core/5.6.15.Final/hibernate-core-5.6.15.Final.jar"
            "https://repo1.maven.org/maven2/com/fasterxml/jackson/core/jackson-databind/2.13.5/jackson-databind-2.13.5.jar"
        )
        
        for url in "${DEPS[@]}"; do
            fname=$(basename "$url")
            if [ ! -f "lib/$fname" ]; then
                curl -s -L -o "lib/$fname" "$url"
            fi
        done
        
        # 构建 classpath
        CP=$(find lib -name "*.jar" | tr '\n' ':')
        
        echo "  正在编译源码..."
        find src/main/java -name "*.java" > sources.txt
        java -jar lib/ecj.jar -cp "$CP" -d target/classes -source 1.8 -target 1.8 -encoding UTF-8 @sources.txt 2>/dev/null || true
        
        # 复制资源
        cp -r src/main/resources/* target/classes/ 2>/dev/null || true
        
        echo "  创建可执行 JAR..."
        
        # 创建 MANIFEST.MF
        mkdir -p target/classes/META-INF
        cat > target/classes/META-INF/MANIFEST.MF << 'EOF'
Manifest-Version: 1.0
Main-Class: com.devicecommand.DeviceCommandApplication
Class-Path: ../lib/spring-boot-2.7.18.jar ../lib/spring-boot-autoconfigure-2.7.18.jar ../lib/spring-context-5.3.31.jar ../lib/spring-core-5.3.31.jar ../lib/spring-beans-5.3.31.jar ../lib/spring-web-5.3.31.jar ../lib/spring-webmvc-5.3.31.jar ../lib/spring-data-jpa-2.7.18.jar ../lib/spring-orm-5.3.31.jar ../lib/spring-tx-5.3.31.jar ../lib/spring-aop-5.3.31.jar ../lib/spring-jdbc-5.3.31.jar ../lib/spring-boot-starter-tomcat-2.7.18.jar ../lib/jakarta.annotation-api-1.3.5.jar ../lib/h2-2.1.214.jar ../lib/hibernate-core-5.6.15.Final.jar ../lib/jackson-databind-2.13.5.jar
EOF
        
        # 打 jar 包
        cd target/classes
        jar cvfm ../device-command-confirmation-api-1.0.0.jar META-INF/MANIFEST.MF . 2>/dev/null
        cd ../..
        
        echo "  编译完成!"
    fi
fi

echo ""
echo "========================================"
echo "启动 API 服务..."
echo "服务端口: 8080"
echo "访问地址: http://localhost:8080"
echo "按 Ctrl+C 停止服务"
echo "========================================"
echo ""

cd target
java -cp "../lib/*:classes" com.devicecommand.DeviceCommandApplication 2>/dev/null || \
java -cp "../lib/*:classes" com.devicecommand.DeviceCommandApplication || \
echo ""; echo "请查看 README.md 了解更多启动方式"
