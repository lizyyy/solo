#!/bin/bash

echo "========================================"
echo "  API合成事务巡检 - 环境配置工具"
echo "========================================"
echo ""

# 检查Java
echo "1/3 检查Java环境..."
if ! command -v java &> /dev/null; then
    echo "❌ 未检测到Java，请先安装JDK 11+"
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -1 | grep -Eo '[0-9]+\.[0-9]+' | head -1 | cut -d'.' -f1)
echo "✓ Java版本: $JAVA_VERSION"
echo ""

# 下载 maven-wrapper.jar
echo "2/3 检查Maven Wrapper..."
WRAPPER_JAR=".mvn/wrapper/maven-wrapper.jar"

if [ ! -f "$WRAPPER_JAR" ]; then
    echo "正在下载 maven-wrapper.jar..."
    mkdir -p .mvn/wrapper
    
    # 尝试多个下载源
    DOWNLOAD_URLS=(
        "https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.1.0/maven-wrapper-3.1.0.jar"
        "https://mirrors.aliyun.com/maven2/org/apache/maven/wrapper/maven-wrapper/3.1.0/maven-wrapper-3.1.0.jar"
    )
    
    DOWNLOAD_SUCCESS=0
    for url in "${DOWNLOAD_URLS[@]}"; do
        echo "尝试下载: $url"
        if command -v curl &> /dev/null; then
            curl -f -s -L -o "$WRAPPER_JAR" "$url"
        elif command -v wget &> /dev/null; then
            wget -q -O "$WRAPPER_JAR" "$url"
        else
            echo "❌ 未找到 curl 或 wget，请手动下载："
            echo "   $url"
            echo "   保存到: $WRAPPER_JAR"
            exit 1
        fi
        
        if [ $? -eq 0 ] && [ -f "$WRAPPER_JAR" ]; then
            FILE_SIZE=$(wc -c < "$WRAPPER_JAR")
            if [ $FILE_SIZE -gt 10000 ]; then
                echo "✓ 下载成功 ($((FILE_SIZE/1024)) KB)"
                DOWNLOAD_SUCCESS=1
                break
            fi
        fi
        rm -f "$WRAPPER_JAR" 2>/dev/null
    done
    
    if [ $DOWNLOAD_SUCCESS -eq 0 ]; then
        echo "❌ 下载失败，请检查网络连接"
        exit 1
    fi
else
    echo "✓ maven-wrapper.jar 已存在"
fi
echo ""

# 设置执行权限
echo "3/3 设置执行权限..."
chmod +x mvnw self-check.sh 2>/dev/null
echo "✓ 完成"
echo ""

echo "========================================"
echo "  ✅ 环境配置完成!"
echo "========================================"
echo ""
echo "可用命令:"
echo "  ./self-check.sh          - 运行自检测试"
echo "  ./mvnw compile           - 编译项目"
echo "  ./mvnw spring-boot:run   - 启动服务"
echo "  ./mvnw package           - 打包项目"
echo ""
