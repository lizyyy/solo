#!/bin/bash
# 零依赖环境配置脚本
# 功能：自动下载所有必需的依赖jar，不依赖Maven

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

LIB_DIR="$PROJECT_DIR/lib"
mkdir -p "$LIB_DIR"

echo "========================================"
echo "  API 回放隐私预算 - 环境配置"
echo "========================================"

# 检查Java
if ! command -v java &> /dev/null; then
    echo "❌ 未检测到 Java，请先安装 JDK 11+"
    exit 1
fi
echo "✅ Java 已安装"

# 检查curl
if ! command -v curl &> /dev/null; then
    echo "❌ 未检测到 curl，请先安装 curl"
    exit 1
fi
echo "✅ curl 已安装"

echo ""
echo "开始下载依赖..."
echo "========================================"

# Maven 仓库基础地址
MAVEN_REPO="https://repo1.maven.org/maven2"

# 依赖列表 (groupId:artifactId:version:type)
DEPENDENCIES=(
    # Spring Boot 2.7.18
    "org/springframework/boot:spring-boot:2.7.18:jar"
    "org/springframework/boot:spring-boot-autoconfigure:2.7.18:jar"
    "org/springframework/boot:spring-boot-starter-web:2.7.18:jar"
    "org/springframework/boot:spring-boot-starter-data-jpa:2.7.18:jar"
    "org/springframework/boot:spring-boot-starter-validation:2.7.18:jar"
    
    # Spring Framework
    "org/springframework:spring-core:5.3.24:jar"
    "org/springframework:spring-context:5.3.24:jar"
    "org/springframework:spring-beans:5.3.24:jar"
    "org/springframework:spring-web:5.3.24:jar"
    "org/springframework:spring-webmvc:5.3.24:jar"
    "org/springframework:spring-aop:5.3.24:jar"
    "org/springframework:spring-tx:5.3.24:jar"
    "org/springframework:spring-orm:5.3.24:jar"
    "org/springframework:spring-expression:5.3.24:jar"
    "org/springframework:spring-jcl:5.3.24:jar"
    
    # Spring Data JPA
    "org/springframework/data:spring-data-jpa:2.7.15:jar"
    "org/springframework/data:spring-data-commons:2.7.15:jar"
    
    # Hibernate
    "org/hibernate:hibernate-core:5.6.15.Final:jar"
    "javax/persistence:javax.persistence-api:2.2:jar"
    
    # H2 Database
    "com/h2database:h2:2.1.214:jar"
    
    # Tomcat
    "org/apache/tomcat/embed:tomcat-embed-core:9.0.68:jar"
    "org/apache/tomcat/embed:tomcat-embed-el:9.0.68:jar"
    "org/apache/tomcat/embed:tomcat-embed-websocket:9.0.68:jar"
    
    # Jackson
    "com/fasterxml/jackson/core:jackson-core:2.13.5:jar"
    "com/fasterxml/jackson/core:jackson-databind:2.13.5:jar"
    "com/fasterxml/jackson/core:jackson-annotations:2.13.5:jar"
    "com/fasterxml/jackson/datatype:jackson-datatype-jsr310:2.13.5:jar"
    
    # Validation
    "javax/validation:validation-api:2.0.1.Final:jar"
    "org/hibernate/validator:hibernate-validator:6.2.5.Final:jar"
    
    # SLF4J + Logback
    "org/slf4j:slf4j-api:1.7.36:jar"
    "ch/qos/logback:logback-classic:1.2.11:jar"
    "ch/qos/logback:logback-core:1.2.11:jar"
    
    # Lombok (编译时需要，运行时可选)
    "org/projectlombok:lombok:1.18.30:jar"
    
    # 其他依赖
    "com/zaxxer:HikariCP:4.0.3:jar"
    "org/apache/commons:commons-lang3:3.12.0:jar"
)

download_dep() {
    local dep="$1"
    IFS=':' read -r group name version type <<< "$dep"
    local file="${name}-${version}.${type}"
    local url="${MAVEN_REPO}/${group//.//}/${name}/${version}/${file}"
    local dest="$LIB_DIR/$file"
    
    if [ -f "$dest" ]; then
        echo "✅ 已存在: $file"
        return 0
    fi
    
    echo "⬇️  下载: $file"
    if curl -sL "$url" -o "$dest"; then
        echo "✅ 完成: $file"
    else
        echo "❌ 失败: $file"
        return 1
    fi
}

TOTAL=${#DEPENDENCIES[@]}
COUNT=0
FAILED=0

for dep in "${DEPENDENCIES[@]}"; do
    COUNT=$((COUNT + 1))
    echo "[$COUNT/$TOTAL] $dep"
    if ! download_dep "$dep"; then
        FAILED=$((FAILED + 1))
    fi
done

echo ""
echo "========================================"
if [ $FAILED -eq 0 ]; then
    echo "✅ 所有依赖下载完成！"
    echo "   依赖目录: $LIB_DIR"
    echo "   Jar 数量: $(ls -1 "$LIB_DIR"/*.jar 2>/dev/null | wc -l)"
else
    echo "⚠️  $FAILED 个依赖下载失败"
fi
echo ""
echo "下一步：编译并启动项目"
echo "  ./run.sh"
echo "========================================"
