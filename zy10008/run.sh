#!/bin/bash
# 配置热更新系统 - 无需 Maven 的启动脚本
# 支持：build, start, test, clean 等操作

set -e

# 配置
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$PROJECT_DIR/src/main/java"
TEST_DIR="$PROJECT_DIR/src/test/java"
RES_DIR="$PROJECT_DIR/src/main/resources"
BUILD_DIR="$PROJECT_DIR/build"
LIB_DIR="$BUILD_DIR/libs"
CLASSES_DIR="$BUILD_DIR/classes"
TEST_CLASSES_DIR="$BUILD_DIR/test-classes"
MAIN_CLASS="com.example.config.ConfigHotUpdateApplication"

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 检查 Java
check_java() {
    if command -v java >/dev/null 2>&1; then
        local version=$(java -version 2>&1 | head -1 | awk -F'"' '{print $2}')
        info "Java 版本: $version"
        return 0
    else
        error "未找到 Java，请安装 Java 8+"
        exit 1
    fi
}

# 检查 javac
check_javac() {
    if ! command -v javac >/dev/null 2>&1; then
        error "未找到 javac (JDK 需要，而不是 JRE)"
        error "请安装 JDK 8+，而不是只安装了 JRE"
        exit 1
    fi
}

# 创建目录结构
create_dirs() {
    mkdir -p "$LIB_DIR" "$CLASSES_DIR" "$TEST_CLASSES_DIR" 2>/dev/null || true
}

# 检查是否有编译后的类文件
has_compiled_classes() {
    # 检查 classes 目录是否存在且有 .class 文件
    if [ ! -d "$CLASSES_DIR" ]; then
        return 1
    fi
    
    # 检查是否有 .class 文件
    local class_count=$(find "$CLASSES_DIR" -name "*.class" 2>/dev/null | wc -l)
    if [ "$class_count" -eq 0 ]; then
        return 1
    fi
    
    # 检查主类是否存在
    local main_class_file="$CLASSES_DIR/com/example/config/ConfigHotUpdateApplication.class"
    if [ ! -f "$main_class_file" ]; then
        return 1
    fi
    
    return 0
}

# Spring Boot 核心依赖 - 手动下载的 JAR
download_dependency() {
    local url="$1"
    local file="$2"
    if [ ! -f "$file" ]; then
        info "下载: $(basename "$file")"
        if command -v curl >/dev/null 2>&1; then
            curl -sL "$url" -o "$file"
        elif command -v wget >/dev/null 2>&1; then
            wget -q "$url" -O "$file"
        else
            error "没有 curl 或 wget，无法下载依赖"
            exit 1
        fi
    fi
}

# 下载所有依赖
download_dependencies() {
    info "检查依赖..."
    
    local maven_repo="https://repo1.maven.org/maven2"
    
    # Spring Boot 2.7.x (Java 8 兼容)
    local spring_boot_version="2.7.18"
    local spring_version="5.3.31"
    local spring_data_version="2.7.18"
    local jackson_version="2.15.2"
    local h2_version="2.1.214"
    local slf4j_version="1.7.36"
    local logback_version="1.2.12"
    local lombok_version="1.18.30"
    
    # 核心依赖列表
    local deps=(
        # Spring Boot
        "org/springframework/boot/spring-boot/$spring_boot_version/spring-boot-$spring_boot_version.jar"
        "org/springframework/boot/spring-boot-autoconfigure/$spring_boot_version/spring-boot-autoconfigure-$spring_boot_version.jar"
        "org/springframework/boot/spring-boot-starter/$spring_boot_version/spring-boot-starter-$spring_boot_version.jar"
        "org/springframework/boot/spring-boot-starter-web/$spring_boot_version/spring-boot-starter-web-$spring_boot_version.jar"
        "org/springframework/boot/spring-boot-starter-data-jpa/$spring_boot_version/spring-boot-starter-data-jpa-$spring_boot_version.jar"
        "org/springframework/boot/spring-boot-starter-actuator/$spring_boot_version/spring-boot-starter-actuator-$spring_boot_version.jar"
        
        # Spring Framework
        "org/springframework/spring-core/$spring_version/spring-core-$spring_version.jar"
        "org/springframework/spring-context/$spring_version/spring-context-$spring_version.jar"
        "org/springframework/spring-web/$spring_version/spring-web-$spring_version.jar"
        "org/springframework/spring-webmvc/$spring_version/spring-webmvc-$spring_version.jar"
        "org/springframework/spring-jdbc/$spring_version/spring-jdbc-$spring_version.jar"
        "org/springframework/spring-orm/$spring_version/spring-orm-$spring_version.jar"
        "org/springframework/spring-tx/$spring_version/spring-tx-$spring_version.jar"
        "org/springframework/spring-websocket/$spring_version/spring-websocket-$spring_version.jar"
        "org/springframework/spring-messaging/$spring_version/spring-messaging-$spring_version.jar"
        
        # Spring Data JPA
        "org/springframework/data/spring-data-jpa/$spring_data_version/spring-data-jpa-$spring_data_version.jar"
        "org/springframework/data/spring-data-commons/$spring_data_version/spring-data-commons-$spring_data_version.jar"
        
        # Hibernate
        "org/hibernate/hibernate-core/5.6.15.Final/hibernate-core-5.6.15.Final.jar"
        
        # Jackson
        "com/fasterxml/jackson/core/jackson-core/$jackson_version/jackson-core-$jackson_version.jar"
        "com/fasterxml/jackson/core/jackson-annotations/$jackson_version/jackson-annotations-$jackson_version.jar"
        "com/fasterxml/jackson/core/jackson-databind/$jackson_version/jackson-databind-$jackson_version.jar"
        
        # H2 Database
        "com/h2database/h2/$h2_version/h2-$h2_version.jar"
        
        # Logging
        "org/slf4j/slf4j-api/$slf4j_version/slf4j-api-$slf4j_version.jar"
        "ch/qos/logback/logback-classic/$logback_version/logback-classic-$logback_version.jar"
        "ch/qos/logback/logback-core/$logback_version/logback-core-$logback_version.jar"
        
        # Lombok
        "org/projectlombok/lombok/$lombok_version/lombok-$lombok_version.jar"
        
        # Jakarta
        "jakarta/persistence/jakarta.persistence-api/2.2.3/jakarta.persistence-api-2.2.3.jar"
        "jakarta/annotation/jakarta.annotation-api/1.3.5/jakarta.annotation-api-1.3.5.jar"
        "jakarta/transaction/jakarta.transaction-api/1.3.3/jakarta.transaction-api-1.3.3.jar"
        
        # 其他
        "javax/annotation/javax.annotation-api/1.3.2/javax.annotation-api-1.3.2.jar"
        "javax/validation/validation-api/2.0.1.Final/validation-api-2.0.1.Final.jar"
        
        # SnakeYAML
        "org/yaml/snakeyaml/1.33/snakeyaml-1.33.jar"
        
        # JBoss Logging
        "org/jboss/logging/jboss-logging/3.4.3.Final/jboss-logging-3.4.3.Final.jar"
    )
    
    for dep in "${deps[@]}"; do
        local filename=$(basename "$dep")
        local filepath="$LIB_DIR/$filename"
        if [ ! -f "$filepath" ]; then
            download_dependency "$maven_repo/$dep" "$filepath"
        fi
    done
    
    info "依赖下载完成"
}

# 构建类路径
build_classpath() {
    local cp=""
    for jar in "$LIB_DIR"/*.jar; do
        if [ -f "$jar" ]; then
            if [ -z "$cp" ]; then
                cp="$jar"
            else
                cp="$cp:$jar"
            fi
        fi
    done
    cp="$cp:$CLASSES_DIR:$RES_DIR"
    echo "$cp"
}

# 编译 Java 源代码
compile() {
    info "编译源代码..."
    
    check_javac
    create_dirs
    
    # 查找所有 Java 源文件
    local sources=()
    while IFS= read -r file; do
        sources+=("$file")
    done < <(find "$SRC_DIR" -name "*.java" 2>/dev/null)
    
    if [ ${#sources[@]} -eq 0 ]; then
        warn "没有找到源文件"
        return 0
    fi
    
    info "编译 ${#sources[@]} 个源文件..."
    
    local cp=$(build_classpath)
    
    # 使用 Lombok 注解处理器
    local lombok_jar="$LIB_DIR/lombok-1.18.30.jar"
    local processor=""
    if [ -f "$lombok_jar" ]; then
        processor="-processorpath $lombok_jar"
    fi
    
    javac -d "$CLASSES_DIR" -cp "$cp" $processor \
        -source 1.8 -target 1.8 \
        "${sources[@]}"
    
    info "编译完成"
}

# 清理
clean() {
    info "清理构建目录..."
    rm -rf "$BUILD_DIR"
    info "清理完成"
}

# 构建
build() {
    check_java
    create_dirs
    download_dependencies
    compile
}

# 运行应用
start() {
    check_java
    
    if ! has_compiled_classes; then
        warn "未找到编译后的类文件，先执行构建..."
        build
    fi
    
    local cp=$(build_classpath)
    
    info "启动应用..."
    info "访问: http://localhost:8080"
    info "H2 控制台: http://localhost:8080/h2-console"
    info "按 Ctrl+C 停止"
    
    java -cp "$cp" "$MAIN_CLASS"
}

# 运行测试
run_tests() {
    check_java
    check_javac
    
    if ! has_compiled_classes; then
        warn "未找到编译后的类文件，先执行构建..."
        build
    fi
    
    info "编译测试代码..."
    
    # 下载 JUnit 依赖
    local maven_repo="https://repo1.maven.org/maven2"
    download_dependency \
        "$maven_repo/junit/junit/4.13.2/junit-4.13.2.jar" \
        "$LIB_DIR/junit-4.13.2.jar"
    download_dependency \
        "$maven_repo/org/hamcrest/hamcrest-core/1.3/hamcrest-core-1.3.jar" \
        "$LIB_DIR/hamcrest-core-1.3.jar"
    
    # 编译测试
    local test_sources=()
    while IFS= read -r file; do
        test_sources+=("$file")
    done < <(find "$TEST_DIR" -name "*.java" 2>/dev/null)
    
    if [ ${#test_sources[@]} -gt 0 ]; then
        local cp=$(build_classpath)
        javac -d "$TEST_CLASSES_DIR" -cp "$cp:$CLASSES_DIR" \
            -source 1.8 -target 1.8 \
            "${test_sources[@]}"
        
        info "运行测试..."
        java -cp "$cp:$CLASSES_DIR:$TEST_CLASSES_DIR" \
            org.junit.runner.JUnitCore \
            com.example.config.ConfigServiceTest \
            com.example.config.DebugServiceTest \
            com.example.config.EventLogServiceTest
    else
        warn "没有找到测试文件"
    fi
}

# 帮助信息
usage() {
    echo "配置热更新系统 - 启动脚本"
    echo ""
    echo "用法: $0 [命令]"
    echo ""
    echo "命令:"
    echo "  build    - 下载依赖并编译"
    echo "  start    - 启动应用"
    echo "  test     - 运行测试"
    echo "  clean    - 清理构建"
    echo "  all      - 清理 -> 构建 -> 启动"
    echo "  deps     - 只下载依赖"
    echo "  help     - 显示帮助信息"
    echo ""
}

# 主逻辑
main() {
    local cmd="${1:-help}"
    
    case "$cmd" in
        build)
            build
            ;;
        start)
            start
            ;;
        test)
            run_tests
            ;;
        clean)
            clean
            ;;
        all)
            clean
            build
            start
            ;;
        deps)
            create_dirs
            download_dependencies
            ;;
        help|--help|-h)
            usage
            ;;
        *)
            error "未知命令: $cmd"
            usage
            exit 1
            ;;
    esac
}

main "$@"
