#!/bin/bash

set -e

echo "========================================"
echo "  API 返回体瘦身服务 - IDE 后启动脚本"
echo "========================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "👉 此脚本用于 IDE 编译后的项目启动"
echo "👉 不依赖本机 mvn 命令"
echo "👉 使用 IDE 已下载的 Maven 本地仓库依赖"
echo ""

# 检查是否已编译
if [ ! -d "target/classes" ]; then
    echo -e "${RED}❌ 未找到编译后的 class 文件${NC}"
    echo ""
    echo "请先按以下步骤操作："
    echo ""
    echo "1. 用 IntelliJ IDEA 打开 pom.xml"
    echo "2. 设置 Project SDK 为 1.8"
    echo "3. Build → Rebuild Project"
    echo "4. 再次运行此脚本"
    echo ""
    echo "或直接在 IDE 中右键运行："
    echo "   src/main/java/com/api/slimming/ApiSlimmingApplication.java"
    exit 1
fi

# 检查 class 版本
echo "🔍 检查 Java class 版本..."
FIRST_CLASS=$(find target/classes -name "*.class" | head -1)
if [ -n "$FIRST_CLASS" ] && command -v javap &> /dev/null; then
    CLASS_VERSION=$(javap -verbose "$FIRST_CLASS" 2>/dev/null | grep "major version" | awk '{print $3}')
    if [ "$CLASS_VERSION" = "52" ]; then
        echo -e "${GREEN}✅ Java 8 class (version 52)${NC}"
    else
        echo -e "${YELLOW}⚠️  class version = $CLASS_VERSION (需要 52 = Java 8)${NC}"
        echo "   请在 IDE 中设置 Java 8 并 Rebuild Project"
    fi
else
    echo "   (javap 不可用，跳过版本检查)"
fi
echo ""

# 查找 Maven 本地仓库位置
echo "🔍 查找 Maven 本地仓库..."
MAVEN_REPOS=""
POSSIBLE_PATHS=(
    "$HOME/.m2/repository"
    "$HOME/Library/Caches/JetBrains/IdeaIC202*/MavenLocalRepo"
    "$HOME/Library/Caches/JetBrains/IntelliJIdea*/MavenLocalRepo"
    "$HOME/.cache/JetBrains/IdeaIC*/MavenLocalRepo"
    "/Applications/IntelliJ IDEA.app/Contents/plugins/maven/lib/maven3"
)

for PATTERN in "${POSSIBLE_PATHS[@]}"; do
    for PATH in $PATTERN; do
        if [ -d "$PATH" ] && [ "$(ls -A "$PATH" 2>/dev/null)" ]; then
            MAVEN_REPOS="$MAVEN_REPOS $PATH"
        fi
    done
done

# 去重
MAVEN_REPOS=$(echo "$MAVEN_REPOS" | tr ' ' '\n' | sort -u | tr '\n' ' ')

if [ -z "$MAVEN_REPOS" ]; then
    echo -e "${RED}❌ 未找到 Maven 本地仓库${NC}"
    echo ""
    echo "💡 建议方案："
    echo ""
    echo "方案 A（推荐）：直接在 IDE 中启动"
    echo "   右键运行: src/main/java/com/api/slimming/ApiSlimmingApplication.java"
    echo ""
    echo "方案 B：用 IDE 的 Maven 插件先编译下载依赖"
    echo "   1. IDE 打开 pom.xml"
    echo "   2. 等待 IDE 自动下载依赖"
    echo "   3. Build → Rebuild Project"
    echo "   4. 再运行此脚本"
    echo ""
    exit 1
fi

echo "✅ 找到 Maven 仓库位置:"
for REPO in $MAVEN_REPOS; do
    echo "   - $REPO"
done
echo ""

# 构建 classpath
echo "🔍 构建 classpath..."
CLASSPATH="target/classes"

# 必需的依赖 jar 列表
REQUIRED_JARS=(
    "spring-boot-2.7.18.jar"
    "spring-boot-autoconfigure-2.7.18.jar"
    "spring-core-5.3.*.jar"
    "spring-context-5.3.*.jar"
    "spring-beans-5.3.*.jar"
    "spring-web-5.3.*.jar"
    "spring-webmvc-5.3.*.jar"
    "tomcat-embed-core-9.0.*.jar"
    "jackson-databind-2.13.*.jar"
    "mybatis-plus-boot-starter-3.5.3.1.jar"
    "mybatis-plus-core-3.5.3.1.jar"
    "mybatis-spring-2.0.7.jar"
    "mybatis-3.5.10.jar"
    "h2-2.1.214.jar"
    "lombok-1.18.*.jar"
    "hutool-all-5.8.20.jar"
    "fastjson-1.2.83.jar"
    "slf4j-api-1.7.*.jar"
    "logback-classic-1.2.*.jar"
)

FOUND_COUNT=0
for REPO in $MAVEN_REPOS; do
    for JAR_PATTERN in "${REQUIRED_JARS[@]}"; do
        FOUND_JARS=$(find "$REPO" -name "$JAR_PATTERN" -type f 2>/dev/null | head -1)
        for JAR in $FOUND_JARS; do
            if [ -n "$JAR" ] && [[ ":$CLASSPATH:" != *":$JAR:"* ]]; then
                CLASSPATH="$CLASSPATH:$JAR"
                ((FOUND_COUNT++))
            fi
        done
    done
done

echo "✅ 找到 $FOUND_COUNT 个依赖 jar"
echo ""

# 检查 Java 版本
echo "🔍 检查 Java 运行时版本..."
JAVA_VERSION=$(java -version 2>&1 | head -1 | grep -o 'version "[^"]*"' | cut -d'"' -f2)
echo "   Java version: $JAVA_VERSION"
if [[ "$JAVA_VERSION" == 1.8.* ]] || [[ "$JAVA_VERSION" == "8"* ]]; then
    echo -e "${GREEN}✅ Java 8 运行时${NC}"
else
    echo -e "${YELLOW}⚠️  建议使用 Java 8 运行时${NC}"
fi
echo ""

# 启动应用
echo "========================================"
echo "🚀 启动 API 返回体瘦身服务..."
echo "========================================"
echo ""
echo "📝 启动参数:"
echo "   - Classpath: $FOUND_COUNT jars + target/classes"
echo "   - Main class: com.api.slimming.ApiSlimmingApplication"
echo ""
echo "🌐 服务地址: http://localhost:8080/api-slimming"
echo "🔗 H2控制台:  http://localhost:8080/api-slimming/h2-console"
echo ""
echo "按 Ctrl+C 停止服务"
echo "========================================"
echo ""

# 执行启动
java -cp "$CLASSPATH" \
    -Dfile.encoding=UTF-8 \
    -Dspring.application.name=api-response-slimming-service \
    com.api.slimming.ApiSlimmingApplication
