#!/bin/bash
# ============================================================================
#  API 变更投票门禁系统 - 一键准备脚本
#
#  功能：
#    1. 自动检测可用的下载工具（curl / wget）
#    2. 从 Maven Central 下载所有必需的依赖 JAR
#    3. 编译 Java 源代码（Java 8 兼容）
#    4. 验证准备结果
#
#  使用：bash prepare.sh
# ============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║           API 变更投票门禁系统 - 一键准备脚本                      ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# ----------------------------------------------------------------------------
# 第一步：环境检查
# ----------------------------------------------------------------------------
echo "[1/6] 环境检查..."

# 检查 Java
if ! command -v java >/dev/null 2>&1; then
    echo "  ❌ 错误: 未找到 java 命令"
    echo "  请安装 Java 8 或更高版本"
    exit 1
fi
JAVA_VERSION=$(java -version 2>&1 | head -n 1)
echo "  ✅ Java: $JAVA_VERSION"

# 检查 javac
if ! command -v javac >/dev/null 2>&1; then
    echo "  ❌ 错误: 未找到 javac 编译器"
    echo "  请安装 JDK（不仅是 JRE）"
    exit 1
fi
JAVAC_VERSION=$(javac -version 2>&1 | head -n 1)
echo "  ✅ Java Compiler: $JAVAC_VERSION"

# 检查可用的下载工具
DOWNLOAD_TOOL=""
if command -v curl >/dev/null 2>&1; then
    DOWNLOAD_TOOL="curl"
    echo "  ✅ 下载工具: curl"
elif command -v wget >/dev/null 2>&1; then
    DOWNLOAD_TOOL="wget"
    echo "  ✅ 下载工具: wget"
else
    echo "  ❌ 错误: 未找到 curl 或 wget"
    echo "  请先安装其中一个网络下载工具"
    exit 1
fi

echo ""

# ----------------------------------------------------------------------------
# 第二步：创建目录
# ----------------------------------------------------------------------------
echo "[2/6] 创建目录结构..."

rm -rf target/dependency 2>/dev/null || true
mkdir -p target/dependency
mkdir -p target/classes

echo "  ✅ target/dependency"
echo "  ✅ target/classes"
echo ""

# ----------------------------------------------------------------------------
# 第三步：下载依赖
# ----------------------------------------------------------------------------
echo "[3/6] 下载依赖 JAR 包（从 Maven Central）..."

MAVEN_REPO="https://repo1.maven.org/maven2"

# 定义所有依赖（按依赖顺序，被依赖的先下）
# 格式: "groupId/artifactId/version/filename"
DEPS=(
    # 基础日志
    "org/slf4j/slf4j-api/1.7.36/slf4j-api-1.7.36.jar"
    "ch/qos/logback/logback-core/1.2.12/logback-core-1.2.12.jar"
    "ch/qos/logback/logback-classic/1.2.12/logback-classic-1.2.12.jar"
    "org/apache/logging/log4j/log4j-api/2.17.2/log4j-api-2.17.2.jar"
    "org/apache/logging/log4j/log4j-to-slf4j/2.17.2/log4j-to-slf4j-2.17.2.jar"
    
    # Spring 核心框架
    "org/springframework/spring-core/5.3.31/spring-core-5.3.31.jar"
    "org/springframework/spring-jcl/5.3.31/spring-jcl-5.3.31.jar"
    "org/springframework/spring-beans/5.3.31/spring-beans-5.3.31.jar"
    "org/springframework/spring-expression/5.3.31/spring-expression-5.3.31.jar"
    "org/springframework/spring-aop/5.3.31/spring-aop-5.3.31.jar"
    "org/springframework/spring-context/5.3.31/spring-context-5.3.31.jar"
    
    # Spring Web
    "org/springframework/spring-web/5.3.31/spring-web-5.3.31.jar"
    "org/springframework/spring-webmvc/5.3.31/spring-webmvc-5.3.31.jar"
    
    # Spring 数据访问
    "org/springframework/spring-jdbc/5.3.31/spring-jdbc-5.3.31.jar"
    "org/springframework/spring-tx/5.3.31/spring-tx-5.3.31.jar"
    "org/springframework/spring-orm/5.3.31/spring-orm-5.3.31.jar"
    
    # Spring Boot
    "org/springframework/boot/spring-boot/2.7.18/spring-boot-2.7.18.jar"
    "org/springframework/boot/spring-boot-autoconfigure/2.7.18/spring-boot-autoconfigure-2.7.18.jar"
    "org/springframework/boot/spring-boot-starter/2.7.18/spring-boot-starter-2.7.18.jar"
    "org/springframework/boot/spring-boot-starter-web/2.7.18/spring-boot-starter-web-2.7.18.jar"
    "org/springframework/boot/spring-boot-starter-data-jpa/2.7.18/spring-boot-starter-data-jpa-2.7.18.jar"
    "org/springframework/boot/spring-boot-starter-validation/2.7.18/spring-boot-starter-validation-2.7.18.jar"
    "org/springframework/boot/spring-boot-starter-json/2.7.18/spring-boot-starter-json-2.7.18.jar"
    "org/springframework/boot/spring-boot-starter-tomcat/2.7.18/spring-boot-starter-tomcat-2.7.18.jar"
    
    # JPA & Hibernate
    "javax/persistence/javax.persistence-api/2.2/javax.persistence-api-2.2.jar"
    "org/hibernate/hibernate-core/5.6.15.Final/hibernate-core-5.6.15.Final.jar"
    "org/jboss/logging/jboss-logging/3.4.3.Final/jboss-logging-3.4.3.Final.jar"
    "javax/transaction/javax.transaction-api/1.3/javax.transaction-api-1.3.jar"
    
    # Validation
    "javax/validation/validation-api/2.0.1.Final/validation-api-2.0.1.Final.jar"
    "org/hibernate/validator/hibernate-validator/6.2.5.Final/hibernate-validator-6.2.5.Final.jar"
    "com/fasterxml/classmate/1.5.1/classmate-1.5.1.jar"
    
    # Jackson JSON
    "com/fasterxml/jackson/core/jackson-core/2.13.5/jackson-core-2.13.5.jar"
    "com/fasterxml/jackson/core/jackson-annotations/2.13.5/jackson-annotations-2.13.5.jar"
    "com/fasterxml/jackson/core/jackson-databind/2.13.5/jackson-databind-2.13.5.jar"
    "com/fasterxml/jackson/datatype/jackson-datatype-jsr310/2.13.5/jackson-datatype-jsr310-2.13.5.jar"
    
    # Tomcat
    "org/apache/tomcat/embed/tomcat-embed-core/9.0.78/tomcat-embed-core-9.0.78.jar"
    "org/apache/tomcat/embed/tomcat-embed-el/9.0.78/tomcat-embed-el-9.0.78.jar"
    "org/apache/tomcat/embed/tomcat-embed-websocket/9.0.78/tomcat-embed-websocket-9.0.78.jar"
    
    # H2 Database
    "com/h2database/h2/2.1.214/h2-2.1.214.jar"
    
    # Lombok
    "org/projectlombok/lombok/1.18.30/lombok-1.18.30.jar"
    
    # Apache POI (Excel)
    "org/apache/commons/commons-compress/1.21/commons-compress-1.21.jar"
    "com/github/virtuald/curvesapi/1.06/curvesapi-1.06.jar"
    "org/apache/xmlbeans/xmlbeans/5.1.1/xmlbeans-5.1.1.jar"
    "org/apache/poi/poi/5.2.5/poi-5.2.5.jar"
    "org/apache/poi/poi-ooxml/5.2.5/poi-ooxml-5.2.5.jar"
    "org/apache/poi/poi-ooxml-lite/5.2.5/poi-ooxml-lite-5.2.5.jar"
)

SUCCESS_COUNT=0
FAILED_COUNT=0
FAILED_LIST=""

TOTAL_DEPS=${#DEPS[@]}
CURRENT_COUNT=0

for dep in "${DEPS[@]}"; do
    CURRENT_COUNT=$((CURRENT_COUNT + 1))
    FILENAME=$(basename "$dep")
    DEST="target/dependency/$FILENAME"
    
    # 显示进度
    PROGRESS="[$CURRENT_COUNT/$TOTAL_DEPS]"
    
    # 如果文件已存在，跳过
    if [ -f "$DEST" ] && [ -s "$DEST" ]; then
        echo "  $PROGRESS 已存在: $FILENAME"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        continue
    fi
    
    # 下载
    DOWNLOAD_URL="$MAVEN_REPO/$dep"
    
    if [ "$DOWNLOAD_TOOL" = "curl" ]; then
        if curl -s -L -o "$DEST" "$DOWNLOAD_URL"; then
            if [ -f "$DEST" ] && [ -s "$DEST" ]; then
                echo "  $PROGRESS 下载成功: $FILENAME"
                SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
            else
                echo "  $PROGRESS 下载失败: $FILENAME (空文件)"
                FAILED_COUNT=$((FAILED_COUNT + 1))
                FAILED_LIST="$FAILED_LIST $FILENAME"
                rm -f "$DEST" 2>/dev/null || true
            fi
        else
            echo "  $PROGRESS 下载失败: $FILENAME"
            FAILED_COUNT=$((FAILED_COUNT + 1))
            FAILED_LIST="$FAILED_LIST $FILENAME"
            rm -f "$DEST" 2>/dev/null || true
        fi
    else # wget
        if wget -q -O "$DEST" "$DOWNLOAD_URL" 2>/dev/null; then
            if [ -f "$DEST" ] && [ -s "$DEST" ]; then
                echo "  $PROGRESS 下载成功: $FILENAME"
                SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
            else
                echo "  $PROGRESS 下载失败: $FILENAME (空文件)"
                FAILED_COUNT=$((FAILED_COUNT + 1))
                FAILED_LIST="$FAILED_LIST $FILENAME"
                rm -f "$DEST" 2>/dev/null || true
            fi
        else
            echo "  $PROGRESS 下载失败: $FILENAME"
            FAILED_COUNT=$((FAILED_COUNT + 1))
            FAILED_LIST="$FAILED_LIST $FILENAME"
            rm -f "$DEST" 2>/dev/null || true
        fi
    fi
done

echo ""
echo "  依赖下载统计: 成功 $SUCCESS_COUNT / $TOTAL_DEPS"

if [ $FAILED_COUNT -gt 0 ]; then
    echo "  ⚠️  失败 $FAILED_COUNT 个: $FAILED_LIST"
    echo ""
    echo "  建议："
    echo "    1. 检查网络连接"
    echo "    2. 可手动从 Maven Central 下载"
    echo "    3. 或使用系统 Maven: mvn dependency:copy-dependencies"
fi

# 至少需要 80% 的依赖才能继续（一些可选依赖可能失败）
MIN_REQUIRED=$((TOTAL_DEPS * 8 / 10))
if [ $SUCCESS_COUNT -lt $MIN_REQUIRED ]; then
    echo ""
    echo "❌ 依赖下载严重不足，无法继续"
    echo "  成功: $SUCCESS_COUNT, 需要至少: $MIN_REQUIRED"
    exit 1
fi

echo ""

# ----------------------------------------------------------------------------
# 第四步：编译源代码
# ----------------------------------------------------------------------------
echo "[4/6] 编译 Java 源代码（Java 8 兼容模式）..."

# 构建 classpath
COMPILE_CLASSPATH=""
for jar in target/dependency/*.jar; do
    if [ -f "$jar" ]; then
        if [ -z "$COMPILE_CLASSPATH" ]; then
            COMPILE_CLASSPATH="$jar"
        else
            COMPILE_CLASSPATH="$COMPILE_CLASSPATH:$jar"
        fi
    fi
done

# 查找所有 Java 源文件
JAVA_FILES=$(find src/main/java -name "*.java" | sort)
JAVA_FILE_COUNT=$(echo "$JAVA_FILES" | wc -l | tr -d ' ')

echo "  找到 $JAVA_FILE_COUNT 个源文件"

# 清理旧的 class 文件
rm -rf target/classes/* 2>/dev/null || true

LOMBOK_JAR="target/dependency/lombok-1.18.30.jar"

# 使用 javac 编译
echo "  正在编译..."
if javac -cp "$COMPILE_CLASSPATH" \
        -processorpath "$LOMBOK_JAR" \
        -d target/classes \
        -source 1.8 \
        -target 1.8 \
        -encoding UTF-8 \
        -Xlint:-options \
        -nowarn \
        $JAVA_FILES 2>&1; then
    CLASS_COUNT=$(find target/classes -name "*.class" | wc -l | tr -d ' ')
    echo "  ✅ 编译成功，生成 $CLASS_COUNT 个类文件"
else
    echo "  ❌ 编译失败"
    exit 1
fi

echo ""

# ----------------------------------------------------------------------------
# 第五步：复制配置文件
# ----------------------------------------------------------------------------
echo "[5/6] 复制配置文件..."

if cp src/main/resources/application.yml target/classes/; then
    echo "  ✅ application.yml"
else
    echo "  ⚠️  复制配置文件失败（可能不影响运行）"
fi

echo ""

# ----------------------------------------------------------------------------
# 第六步：验证准备结果
# ----------------------------------------------------------------------------
echo "[6/6] 验证准备结果..."

ALL_OK=true

# 检查类文件
if [ -f "target/classes/com/apigate/voting/VotingGateApplication.class" ]; then
    echo "  ✅ 主类文件存在"
else
    echo "  ❌ 主类文件缺失"
    ALL_OK=false
fi

# 检查依赖数量
JAR_COUNT=$(find target/dependency -name "*.jar" | wc -l | tr -d ' ')
if [ "$JAR_COUNT" -gt 20 ]; then
    echo "  ✅ 依赖 JAR 包: $JAR_COUNT 个"
else
    echo "  ⚠️  依赖 JAR 包较少: $JAR_COUNT 个"
fi

# 检查配置文件
if [ -f "target/classes/application.yml" ]; then
    echo "  ✅ 配置文件存在"
else
    echo "  ⚠️  配置文件缺失"
fi

echo ""

# ----------------------------------------------------------------------------
# 总结
# ----------------------------------------------------------------------------
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║                         准备完成！                                ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

if [ "$ALL_OK" = true ]; then
    echo "✅ 所有检查通过，可以启动服务了！"
else
    echo "⚠️  部分检查未通过，但仍可尝试启动"
fi

echo ""
echo "下一步操作："
echo ""
echo "  1. 启动服务（在当前窗口，会占用终端）"
echo "     bash start.sh"
echo ""
echo "  2. 服务启动后（看到 Spring Boot 标志，约 10-30 秒），新开窗口运行："
echo "     bash verify.sh"
echo ""
echo "  3. 查看完整文档"
echo "     cat API_DOCUMENTATION.md"
echo ""

echo "服务信息："
echo "  - 端口: 8080"
echo "  - H2 Console: http://localhost:8080/h2-console"
echo "  - JDBC URL: jdbc:h2:mem:votingdb"
echo "  - Username: sa"
echo "  - Password: (空)"
echo ""

exit 0
