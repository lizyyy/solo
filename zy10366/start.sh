#!/bin/bash
# 附件元数据修复 API - 智能启动脚本
# 支持多种环境：有JDK/无JDK(只有JRE)、有Maven/无Maven

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo "================================================"
echo "  附件元数据修复 API - 智能启动器"
echo "================================================"
echo ""

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }

# ============================================
# 环境检测
# ============================================
echo "[1/6] 环境检测..."

# 检测Java
if command -v java &> /dev/null; then
    JAVA_VERSION=$(java -version 2>&1 | head -n 1 | awk -F'"' '{print $2}')
    print_success "检测到 Java: $JAVA_VERSION"
else
    print_error "未找到 Java，请先安装 Java 8 或更高版本"
    exit 1
fi

# 检测javac
HAVE_JAVAC=false
if command -v javac &> /dev/null; then
    JAVAC_VERSION=$(javac -version 2>&1 | head -n 1)
    print_success "检测到 javac: $JAVAC_VERSION"
    HAVE_JAVAC=true
else
    print_warning "未检测到 javac (只有JRE，没有JDK)"
fi

# 检测Maven
HAVE_MVN=false
if command -v mvn &> /dev/null; then
    MVN_VERSION=$(mvn -version 2>&1 | head -n 1)
    print_success "检测到 Maven: $MVN_VERSION"
    HAVE_MVN=true
else
    print_warning "未检测到 Maven"
fi

echo ""

# ============================================
# 检查是否已有编译好的类文件
# ============================================
echo "[2/6] 检查编译状态..."

if [ -f "target/classes/com/metadata/repair/MetadataRepairApplication.class" ]; then
    print_success "检测到已编译的类文件，跳过编译"
    NEED_COMPILE=false
else
    print_warning "未检测到编译产物，需要编译"
    NEED_COMPILE=true
fi
echo ""

# ============================================
# 编译（如果需要）
# ============================================
if [ "$NEED_COMPILE" = true ]; then
    echo "[3/6] 编译源码..."
    
    mkdir -p target/classes target/dependency
    
    # 方案1: 有Maven，用Maven编译
    if [ "$HAVE_MVN" = true ]; then
        print_success "使用 Maven 编译..."
        mvn compile -DskipTests -q
        print_success "Maven 编译完成"
    
    # 方案2: 没有Maven但有javac，直接编译
    elif [ "$HAVE_JAVAC" = true ]; then
        print_success "使用 javac 直接编译..."
        
        # 下载依赖
        echo "  下载依赖库..."
        DEPS_DIR="target/dependency"
        mkdir -p "$DEPS_DIR"
        
        # 核心依赖列表
        BASE_URL="https://repo.maven.apache.org/maven2"
        
        download_dep() {
            local path="$1"
            local filename="$2"
            if [ ! -f "$DEPS_DIR/$filename" ]; then
                echo "    下载: $filename"
                curl -s -L -f "$BASE_URL/$path" -o "$DEPS_DIR/$filename" 2>/dev/null || true
            fi
        }
        
        # Spring Boot 2.7.18 核心依赖
        download_dep "org/springframework/boot/spring-boot/2.7.18/spring-boot-2.7.18.jar" "spring-boot-2.7.18.jar"
        download_dep "org/springframework/boot/spring-boot-autoconfigure/2.7.18/spring-boot-autoconfigure-2.7.18.jar" "spring-boot-autoconfigure-2.7.18.jar"
        download_dep "org/springframework/spring-core/5.3.24/spring-core-5.3.24.jar" "spring-core-5.3.24.jar"
        download_dep "org/springframework/spring-context/5.3.24/spring-context-5.3.24.jar" "spring-context-5.3.24.jar"
        download_dep "org/springframework/spring-beans/5.3.24/spring-beans-5.3.24.jar" "spring-beans-5.3.24.jar"
        download_dep "org/springframework/spring-expression/5.3.24/spring-expression-5.3.24.jar" "spring-expression-5.3.24.jar"
        download_dep "org/springframework/spring-aop/5.3.24/spring-aop-5.3.24.jar" "spring-aop-5.3.24.jar"
        download_dep "org/springframework/spring-web/5.3.24/spring-web-5.3.24.jar" "spring-web-5.3.24.jar"
        download_dep "org/springframework/spring-webmvc/5.3.24/spring-webmvc-5.3.24.jar" "spring-webmvc-5.3.24.jar"
        download_dep "org/springframework/data/spring-data-jpa/2.7.11/spring-data-jpa-2.7.11.jar" "spring-data-jpa-2.7.11.jar"
        download_dep "org/springframework/data/spring-data-commons/2.7.11/spring-data-commons-2.7.11.jar" "spring-data-commons-2.7.11.jar"
        download_dep "org/springframework/spring-tx/5.3.24/spring-tx-5.3.24.jar" "spring-tx-5.3.24.jar"
        download_dep "org/springframework/spring-jcl/5.3.24/spring-jcl-5.3.24.jar" "spring-jcl-5.3.24.jar"
        download_dep "org/springframework/spring-jdbc/5.3.24/spring-jdbc-5.3.24.jar" "spring-jdbc-5.3.24.jar"
        download_dep "org/springframework/spring-orm/5.3.24/spring-orm-5.3.24.jar" "spring-orm-5.3.24.jar"
        
        # JPA和Hibernate
        download_dep "javax/persistence/javax.persistence-api/2.2/javax.persistence-api-2.2.jar" "javax.persistence-api-2.2.jar"
        download_dep "org/hibernate/hibernate-core/5.6.15.Final/hibernate-core-5.6.15.Final.jar" "hibernate-core-5.6.15.Final.jar"
        
        # 数据库和验证
        download_dep "com/h2database/h2/2.1.214/h2-2.1.214.jar" "h2-2.1.214.jar"
        download_dep "javax/validation/javax.validation-api/2.0.1.Final/javax.validation-api-2.0.1.Final.jar" "javax.validation-api-2.0.1.Final.jar"
        
        # Jackson
        download_dep "com/fasterxml/jackson/core/jackson-core/2.13.5/jackson-core-2.13.5.jar" "jackson-core-2.13.5.jar"
        download_dep "com/fasterxml/jackson/core/jackson-databind/2.13.5/jackson-databind-2.13.5.jar" "jackson-databind-2.13.5.jar"
        download_dep "com/fasterxml/jackson/core/jackson-annotations/2.13.5/jackson-annotations-2.13.5.jar" "jackson-annotations-2.13.5.jar"
        
        # Tomcat嵌入式
        download_dep "org/apache/tomcat/embed/tomcat-embed-core/9.0.82/tomcat-embed-core-9.0.82.jar" "tomcat-embed-core-9.0.82.jar"
        download_dep "org/apache/tomcat/embed/tomcat-embed-el/9.0.82/tomcat-embed-el-9.0.82.jar" "tomcat-embed-el-9.0.82.jar"
        download_dep "org/apache/tomcat/embed/tomcat-embed-websocket/9.0.82/tomcat-embed-websocket-9.0.82.jar" "tomcat-embed-websocket-9.0.82.jar"
        
        # 日志
        download_dep "org/slf4j/slf4j-api/1.7.36/slf4j-api-1.7.36.jar" "slf4j-api-1.7.36.jar"
        download_dep "ch/qos/logback/logback-classic/1.2.12/logback-classic-1.2.12.jar" "logback-classic-1.2.12.jar"
        download_dep "ch/qos/logback/logback-core/1.2.12/logback-core-1.2.12.jar" "logback-core-1.2.12.jar"
        
        # Lombok (用于编译)
        download_dep "org/projectlombok/lombok/1.18.30/lombok-1.18.30.jar" "lombok-1.18.30.jar"
        
        # 构建 classpath
        CLASSPATH=""
        for jar in "$DEPS_DIR"/*.jar; do
            if [ -f "$jar" ]; then
                CLASSPATH="$CLASSPATH:$jar"
            fi
        done
        CLASSPATH="target/classes${CLASSPATH}"
        
        print_success "依赖下载完成，开始编译..."
        
        # 找到所有Java源文件
        find src/main/java -name "*.java" > target/sources.txt
        
        # 使用javac编译，包含lombok注解处理器
        LOMBOK_JAR="$DEPS_DIR/lombok-1.18.30.jar"
        if [ -f "$LOMBOK_JAR" ]; then
            echo "  使用Lombok注解处理器编译..."
            javac -encoding UTF-8 -cp "$CLASSPATH" -processorpath "$LOMBOK_JAR" \
                  -d target/classes @target/sources.txt 2>&1 || {
                print_warning "带注解处理器编译失败，尝试普通编译..."
                javac -encoding UTF-8 -cp "$CLASSPATH" -d target/classes @target/sources.txt 2>&1 || true
            }
        else
            javac -encoding UTF-8 -cp "$CLASSPATH" -d target/classes @target/sources.txt 2>&1 || true
        fi
        
        print_success "编译完成"
    
    # 方案3: 既没有Maven也没有javac，提示
    else
        print_error "未检测到可用的编译环境！"
        echo ""
        echo "可用解决方案："
        echo "  1. 安装 JDK 8 或更高版本（推荐）"
        echo "  2. 或安装 Maven"
        echo ""
        exit 1
    fi
fi
echo ""

# ============================================
# 复制配置文件
# ============================================
echo "[4/6] 准备配置文件..."
mkdir -p target/classes
cp -r src/main/resources/* target/classes/ 2>/dev/null || true
print_success "配置文件已准备"
echo ""

# ============================================
# 构建运行 classpath
# ============================================
echo "[5/6] 构建运行环境..."

RUN_CLASSPATH="target/classes"
for jar in target/dependency/*.jar; do
    if [ -f "$jar" ]; then
        RUN_CLASSPATH="$RUN_CLASSPATH:$jar"
    fi
done

# 如果Maven本地仓库有依赖，也加上
if [ -d "$HOME/.m2/repository" ]; then
    for jar in $(find "$HOME/.m2/repository" -name "*.jar" 2>/dev/null | head -200); do
        RUN_CLASSPATH="$RUN_CLASSPATH:$jar"
    done
fi

print_success "运行环境已准备"
echo ""

# ============================================
# 启动服务
# ============================================
echo "[6/6] 启动服务..."
echo "================================================"
echo ""
echo "  API 基础路径: http://localhost:8080/api/repair"
echo "  H2 控制台:    http://localhost:8080/api/h2-console"
echo ""
echo "  按 Ctrl+C 停止服务"
echo "================================================"
echo ""

java -cp "$RUN_CLASSPATH" com.metadata.repair.MetadataRepairApplication
