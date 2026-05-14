#!/bin/bash
# API 变更投票门禁系统构建脚本
# 自动下载依赖并编译为 Java 8 兼容版本

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=============================================="
echo "  API 变更投票门禁系统 - 构建脚本"
echo "=============================================="
echo ""

# 检查 Java
if ! command -v java >/dev/null 2>&1; then
    echo "✗ 错误: 未找到 Java 命令"
    echo "  请安装 Java 8 或更高版本"
    exit 1
fi

if ! command -v javac >/dev/null 2>&1; then
    echo "✗ 错误: 未找到 javac 编译器"
    echo "  请安装 JDK（不仅是 JRE）"
    echo "  Java 8 或更高版本"
    exit 1
fi

# 显示 Java 版本信息
JAVA_VERSION=$(java -version 2>&1 | head -n 1)
JAVAC_VERSION=$(javac -version 2>&1 | head -n 1)
echo "检测到 Java 运行时: $JAVA_VERSION"
echo "检测到 Java 编译器: $JAVAC_VERSION"
echo ""

# 清理旧的编译输出（确保重新编译）
echo "清理旧的构建产物..."
rm -rf target/classes target/dependency 2>/dev/null || true
mkdir -p target/classes target/dependency
echo "✓ 清理完成"
echo ""

# Maven 中央仓库 URL
MAVEN_REPO="https://repo1.maven.org/maven2"

# 下载依赖函数
download_dep() {
    local group_path="$1"
    local artifact="$2"
    local version="$3"
    local dest="target/dependency/${artifact}-${version}.jar"
    
    if [ ! -f "$dest" ]; then
        echo "  下载: $artifact $version"
        local url="${MAVEN_REPO}/${group_path}/${artifact}/${version}/${artifact}-${version}.jar"
        local success=0
        
        if command -v curl >/dev/null 2>&1; then
            curl -s -L -o "$dest" "$url" && success=1
        elif command -v wget >/dev/null 2>&1; then
            wget -q -O "$dest" "$url" && success=1
        fi
        
        if [ $success -eq 0 ]; then
            echo "    ✗ 下载失败，请检查网络连接"
            return 1
        fi
    else
        echo "  已存在: $artifact $version"
    fi
    return 0
}

echo ""
echo "正在下载核心依赖..."

# Spring Boot 核心依赖 (2.7.18 - 兼容 Java 8)
download_dep "org/springframework/boot" "spring-boot" "2.7.18"
download_dep "org/springframework/boot" "spring-boot-autoconfigure" "2.7.18"
download_dep "org/springframework/boot" "spring-boot-starter-web" "2.7.18"
download_dep "org/springframework/boot" "spring-boot-starter-data-jpa" "2.7.18"
download_dep "org/springframework/boot" "spring-boot-starter-validation" "2.7.18"

# Spring 核心框架
download_dep "org/springframework" "spring-core" "5.3.31"
download_dep "org/springframework" "spring-context" "5.3.31"
download_dep "org/springframework" "spring-web" "5.3.31"
download_dep "org/springframework" "spring-webmvc" "5.3.31"
download_dep "org/springframework" "spring-beans" "5.3.31"
download_dep "org/springframework" "spring-aop" "5.3.31"
download_dep "org/springframework" "spring-expression" "5.3.31"
download_dep "org/springframework" "spring-jdbc" "5.3.31"
download_dep "org/springframework" "spring-orm" "5.3.31"
download_dep "org/springframework" "spring-tx" "5.3.31"

# JPA & Hibernate
download_dep "org/hibernate" "hibernate-core" "5.6.15.Final"
download_dep "javax/persistence" "javax.persistence-api" "2.2"

# Servlet & Validation
download_dep "javax/servlet" "javax.servlet-api" "4.0.1"
download_dep "javax/validation" "validation-api" "2.0.1.Final"
download_dep "org/hibernate/validator" "hibernate-validator" "6.2.5.Final"

# Jackson (JSON)
download_dep "com/fasterxml/jackson/core" "jackson-databind" "2.13.5"
download_dep "com/fasterxml/jackson/core" "jackson-core" "2.13.5"
download_dep "com/fasterxml/jackson/core" "jackson-annotations" "2.13.5"
download_dep "com/fasterxml/jackson/datatype" "jackson-datatype-jsr310" "2.13.5"

# Tomcat
download_dep "org/apache/tomcat/embed" "tomcat-embed-core" "9.0.78"
download_dep "org/apache/tomcat/embed" "tomcat-embed-el" "9.0.78"
download_dep "org/apache/tomcat/embed" "tomcat-embed-websocket" "9.0.78"

# H2 Database
download_dep "com/h2database" "h2" "2.1.214"

# Lombok - 编译时注解处理
download_dep "org/projectlombok" "lombok" "1.18.30"

# Apache POI (Excel)
download_dep "org/apache/poi" "poi" "5.2.5"
download_dep "org/apache/poi" "poi-ooxml" "5.2.5"
download_dep "org/apache/poi" "poi-ooxml-lite" "5.2.5"
download_dep "org/apache/xmlbeans" "xmlbeans" "5.1.1"
download_dep "org/apache/commons" "commons-compress" "1.21"
download_dep "com/github/virtuald" "curvesapi" "1.06"

# 其他工具库
download_dep "org/slf4j" "slf4j-api" "1.7.36"
download_dep "ch/qos/logback" "logback-classic" "1.2.12"
download_dep "ch/qos/logback" "logback-core" "1.2.12"
download_dep "org/apache/logging/log4j" "log4j-to-slf4j" "2.17.2"
download_dep "org/apache/logging/log4j" "log4j-api" "2.17.2"
download_dep "org/jboss/logging" "jboss-logging" "3.4.3.Final"

# 统计下载的依赖数量
DEP_COUNT=$(ls -1 target/dependency/*.jar 2>/dev/null | wc -l | tr -d ' ')
echo ""
echo "✓ 完成下载 $DEP_COUNT 个依赖包"

echo ""
echo "正在编译 Java 源代码（Java 8 兼容模式）..."

# 构建 classpath 用于编译
COMPILE_CLASSPATH=""
for jar in target/dependency/*.jar; do
    if [ -z "$COMPILE_CLASSPATH" ]; then
        COMPILE_CLASSPATH="$jar"
    else
        COMPILE_CLASSPATH="$COMPILE_CLASSPATH:$jar"
    fi
done

# 查找所有 Java 源文件
JAVA_FILES=$(find src/main/java -name "*.java" | sort)
JAVA_FILE_COUNT=$(echo "$JAVA_FILES" | wc -l | tr -d ' ')
echo "  找到 $JAVA_FILE_COUNT 个源文件"

# 使用 javac 编译，强制 Java 8 兼容，包含 Lombok 注解处理器
LOMBOK_JAR="target/dependency/lombok-1.18.30.jar"

echo "  正在编译..."
echo "  (使用 Lombok 注解处理器: $LOMBOK_JAR)"

javac -cp "$COMPILE_CLASSPATH" \
      -processorpath "$LOMBOK_JAR" \
      -d target/classes \
      -source 1.8 \
      -target 1.8 \
      -encoding UTF-8 \
      -Xlint:-options \
      $JAVA_FILES 2>&1 | head -40

# 检查编译结果
if [ $? -eq 0 ]; then
    CLASS_COUNT=$(find target/classes -name "*.class" | wc -l | tr -d ' ')
    echo "✓ 编译成功！生成 $CLASS_COUNT 个类文件"
else
    echo "✗ 编译失败，请检查错误信息"
    exit 1
fi

# 检查主类版本
if [ -f "target/classes/com/apigate/voting/VotingGateApplication.class" ]; then
    echo ""
    echo "验证类文件版本..."
    
    # 使用 javap 检查版本（Java 8 = 版本52）
    if command -v javap >/dev/null 2>&1; then
        CLASS_VERSION_HEX=$(javap -verbose target/classes/com/apigate/voting/VotingGateApplication.class 2>/dev/null | grep "major version" | awk '{print $3}')
        echo "  主类文件版本: $CLASS_VERSION_HEX (Java 8 = 52, Java 11 = 55)"
        if [ "$CLASS_VERSION_HEX" = "52" ]; then
            echo "  ✓ 确认是 Java 8 兼容版本"
        else
            echo "  ⚠ 注意: 类文件版本不是 52，可能不兼容 Java 8"
        fi
    fi
fi

# 复制配置文件
echo ""
echo "复制配置文件..."
cp src/main/resources/application.yml target/classes/
echo "✓ 配置文件已复制"

echo ""
echo "=============================================="
echo "  构建完成！"
echo "=============================================="
echo ""
echo "下一步操作："
echo "  1. 启动服务: ./start.sh"
echo "  2. 验证接口 (服务启动后): ./verify.sh"
echo ""
