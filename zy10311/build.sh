#!/bin/bash
# API 变更投票门禁系统构建脚本
# 自动下载依赖并编译项目

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=============================================="
echo "  API 变更投票门禁系统 - 构建脚本"
echo "=============================================="
echo ""

# 检查 Java
if ! command -v java >/dev/null 2>&1; then
    echo "错误: 未找到 Java 命令"
    echo "请安装 Java 8 或更高版本"
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2 | cut -d'.' -f1-2)
echo "检测到 Java 版本: $JAVA_VERSION"
echo ""

# 创建必要的目录
mkdir -p target/classes
mkdir -p target/dependency

echo "正在下载依赖..."

# 定义依赖版本
SPRING_BOOT_VERSION="2.7.18"
H2_VERSION="2.1.214"
LOMBOK_VERSION="1.18.30"
POI_VERSION="5.2.5"

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
        if command -v curl >/dev/null 2>&1; then
            curl -s -L -o "$dest" "$url" || echo "    下载失败 (curl)"
        elif command -v wget >/dev/null 2>&1; then
            wget -q -O "$dest" "$url" || echo "    下载失败 (wget)"
        else
            echo "    错误: 未找到 curl 或 wget"
            return 1
        fi
    else
        echo "  已存在: $artifact $version"
    fi
}

# Spring Boot 核心依赖
download_dep "org/springframework/boot" "spring-boot" "$SPRING_BOOT_VERSION"
download_dep "org/springframework/boot" "spring-boot-autoconfigure" "$SPRING_BOOT_VERSION"
download_dep "org/springframework/boot" "spring-boot-starter-web" "$SPRING_BOOT_VERSION"
download_dep "org/springframework/boot" "spring-boot-starter-data-jpa" "$SPRING_BOOT_VERSION"
download_dep "org/springframework/boot" "spring-boot-starter-validation" "$SPRING_BOOT_VERSION"

# Spring 核心
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

# Tomcat
download_dep "org/apache/tomcat/embed" "tomcat-embed-core" "9.0.78"
download_dep "org/apache/tomcat/embed" "tomcat-embed-el" "9.0.78"
download_dep "org/apache/tomcat/embed" "tomcat-embed-websocket" "9.0.78"

# H2 Database
download_dep "com/h2database" "h2" "$H2_VERSION"

# Lombok
download_dep "org/projectlombok" "lombok" "$LOMBOK_VERSION"

# Apache POI (Excel)
download_dep "org/apache/poi" "poi" "$POI_VERSION"
download_dep "org/apache/poi" "poi-ooxml" "$POI_VERSION"
download_dep "org/apache/poi" "poi-ooxml-lite" "$POI_VERSION"
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
download_dep "com/fasterxml/jackson/datatype" "jackson-datatype-jsr310" "2.13.5"

echo ""
echo "正在编译 Java 源代码..."

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
JAVA_FILES=$(find src/main/java -name "*.java" | tr '\n' ' ')

# 使用 javac 编译
if command -v javac >/dev/null 2>&1; then
    javac -cp "$COMPILE_CLASSPATH" \
          -d target/classes \
          -source 1.8 \
          -target 1.8 \
          -encoding UTF-8 \
          $JAVA_FILES
    echo "编译成功！"
else
    echo "警告: 未找到 javac 命令"
    echo "请确保安装了 JDK（不仅是 JRE）"
    echo ""
    echo "如果已安装 JDK 但仍有问题，请设置 JAVA_HOME 环境变量"
    exit 1
fi

# 复制配置文件
cp src/main/resources/application.yml target/classes/

echo ""
echo "=============================================="
echo "  构建完成！"
echo "=============================================="
echo ""
echo "启动服务运行: ./start.sh"
echo "或查看验证脚本: ./verify.sh"
echo ""
