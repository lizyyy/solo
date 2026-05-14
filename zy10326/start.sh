#!/bin/bash
# 🔋 接口重试预算服务 - 完全自包含启动脚本
# 只需Java 17和curl，无需预装Maven！

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "=================================="
echo "  接口重试预算服务 - 自启动器"
echo "=================================="
echo -e "${NC}"

# 创建必要目录
mkdir -p data logs .m2/wrapper

# ==================================
# 检查Java环境
# ==================================
if ! command -v java &> /dev/null; then
    echo -e "${RED}❌ 未找到Java命令${NC}"
    echo ""
    echo "请先安装JDK 17或更高版本:"
    echo "  macOS: brew install openjdk@17"
    echo "  Linux: sudo apt install openjdk-17-jdk"
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -1 | grep -Eo '[0-9]+' | head -1)
echo -e "${GREEN}✅ Java版本: $JAVA_VERSION${NC}"

# ==================================
# 检查curl
# ==================================
if ! command -v curl &> /dev/null; then
    echo -e "${RED}❌ 未找到curl，请先安装curl${NC}"
    exit 1
fi
echo -e "${GREEN}✅ curl可用${NC}"

# ==================================
# 自动下载Maven
# ==================================
MAVEN_VERSION="3.9.6"
MAVEN_DIR=".m2/wrapper/apache-maven-$MAVEN_VERSION"

if [ ! -d "$MAVEN_DIR" ]; then
    echo ""
    echo -e "${YELLOW}📦 正在下载 Maven $MAVEN_VERSION...${NC}"
    echo "   (只需下载一次，后续启动直接使用)"
    mkdir -p "$MAVEN_DIR"
    
    # 尝试多个镜像源
    MAVEN_URLS=(
        "https://dlcdn.apache.org/maven/maven-3/$MAVEN_VERSION/binaries/apache-maven-$MAVEN_VERSION-bin.tar.gz"
        "https://mirrors.aliyun.com/apache/maven/maven-3/$MAVEN_VERSION/binaries/apache-maven-$MAVEN_VERSION-bin.tar.gz"
    )
    
    for url in "${MAVEN_URLS[@]}"; do
        echo "   尝试: $url"
        if curl -sL --connect-timeout 5 "$url" | tar xz -C "$MAVEN_DIR" --strip-components=1 2>/dev/null; then
            echo -e "${GREEN}✅ Maven 下载成功${NC}"
            break
        fi
    done
    
    if [ ! -f "$MAVEN_DIR/bin/mvn" ]; then
        echo -e "${RED}❌ Maven下载失败${NC}"
        exit 1
    fi
fi

MVN="$PWD/$MAVEN_DIR/bin/mvn"
echo -e "${GREEN}✅ Maven准备就绪${NC}"

# ==================================
# 编译并启动
# ==================================
echo ""
echo -e "${BLUE}🔨 正在编译项目...${NC}"
echo "   首次运行需要下载依赖，请耐心等待（约1-2分钟）"
echo ""

# 使用阿里云镜像加速（如果需要）
if [ ! -f ".m2/wrapper/settings.xml" ]; then
    cat > .m2/wrapper/settings.xml << 'EOF'
<settings>
  <mirrors>
    <mirror>
      <id>aliyun</id>
      <mirrorOf>central</mirrorOf>
      <url>https://maven.aliyun.com/repository/public</url>
    </mirror>
  </mirrors>
</settings>
EOF
fi

# 编译
"$MVN" compile -s .m2/wrapper/settings.xml -q 2>&1 | tail -5 || true
echo -e "${GREEN}✅ 编译完成${NC}"

# ==================================
# 启动服务
# ==================================
echo ""
echo -e "${BLUE}🚀 正在启动 Spring Boot 服务...${NC}"
echo ""
echo -e "访问地址:"
echo -e "  ${GREEN}主服务:${NC}  http://localhost:8080"
echo -e "  ${GREEN}H2控制台:${NC} http://localhost:8080/h2-console"
echo -e "  ${GREEN}JDBC URL:${NC} jdbc:h2:file:./data/retry-budget-db"
echo ""
echo -e "${YELLOW}按 Ctrl+C 停止服务${NC}"
echo "=================================="
echo ""

# 启动
"$MVN" spring-boot:run -s .m2/wrapper/settings.xml -q
