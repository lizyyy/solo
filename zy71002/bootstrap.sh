#!/bin/bash
# 县域防汛安置物资 API - 零依赖启动引导脚本
# 自动寻找或安装 Maven，无需网络下载 Wrapper

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo "========================================"
echo "  县域防汛安置物资 API - 启动引导"
echo "========================================"
echo ""

# 方法1: 查找系统中已有的 Maven
find_system_maven() {
    local MVN_CMD=""
    
    # 标准路径
    if command -v mvn >/dev/null 2>&1; then
        MVN_CMD="mvn"
    fi
    
    # 常见安装位置
    if [ -z "$MVN_CMD" ] && [ -f "/usr/local/bin/mvn" ]; then
        MVN_CMD="/usr/local/bin/mvn"
    fi
    if [ -z "$MVN_CMD" ] && [ -f "/opt/homebrew/bin/mvn" ]; then
        MVN_CMD="/opt/homebrew/bin/mvn"
    fi
    if [ -z "$MVN_CMD" ] && [ -f "/usr/local/Cellar/maven/*/bin/mvn" ]; then
        MVN_CMD=$(ls /usr/local/Cellar/maven/*/bin/mvn 2>/dev/null | head -1)
    fi
    
    # IDE 自带 Maven
    if [ -z "$MVN_CMD" ]; then
        MVN_CMD=$(find /Users -name "mvn" -type f 2>/dev/null | grep -E "(maven|idea|IntelliJ)" | head -1)
    fi
    
    # 之前发现的路径
    if [ -z "$MVN_CMD" ] && [ -f "/Users/lzy/pro/codeGen/workspaces/apache__amoro_6/repo/build/mvn" ]; then
        MVN_CMD="/Users/lzy/pro/codeGen/workspaces/apache__amoro_6/repo/build/mvn"
    fi
    
    echo "$MVN_CMD"
}

# 方法2: 使用本地 Maven 安装包
install_local_maven() {
    echo "正在安装本地 Maven..."
    
    # 检查是否有本地安装包
    if [ -f "$PROJECT_DIR/tools/apache-maven-3.9.6-bin.tar.gz" ]; then
        mkdir -p "$PROJECT_DIR/tools/maven"
        tar -xzf "$PROJECT_DIR/tools/apache-maven-3.9.6-bin.tar.gz" -C "$PROJECT_DIR/tools/maven" --strip-components=1
        echo "$PROJECT_DIR/tools/maven/bin/mvn"
        return 0
    fi
    
    return 1
}

# 方法3: 检查是否已编译可直接运行
try_run_compiled() {
    if [ -d "target/classes" ] && [ -f "target/classes/com/floodrelief/FloodReliefApplication.class" ]; then
        echo ""
        echo "📋 发现已编译的类文件，但运行 Spring Boot 需要 Maven 或 jar 包"
        echo "请先安装 Maven 构建完整的 jar 包"
    fi
    return 1
}

# 主流程
MVN_CMD=$(find_system_maven)

if [ -n "$MVN_CMD" ]; then
    echo "✅ 找到 Maven: $MVN_CMD"
else
    echo "⚠️  未找到系统 Maven"
    
    # 尝试本地安装
    MVN_CMD=$(install_local_maven || true)
    if [ -z "$MVN_CMD" ] || [ "$MVN_CMD" = "1" ]; then
        echo ""
        echo "========================================"
        echo "  ❌ 未找到 Maven，以下是安装方案："
        echo "========================================"
        echo ""
        echo "方案1: 使用 Homebrew 安装（推荐）"
        echo "  brew install maven"
        echo ""
        echo "方案2: 手动下载 Maven"
        echo "  访问: https://maven.apache.org/download.cgi"
        echo "  下载 apache-maven-3.9.6-bin.tar.gz"
        echo "  解压后将 bin 目录加入 PATH"
        echo ""
        echo "方案3: 将 mvn 放入项目 tools 目录"
        echo "  mkdir -p tools/maven/bin"
        echo "  复制 mvn 可执行文件到 tools/maven/bin/"
        echo ""
        echo "安装完成后重新运行: ./run.sh"
        echo ""
        
        try_run_compiled || true
        exit 1
    fi
fi

echo ""
echo "========================================"
echo "  🚀 启动 Spring Boot 服务"
echo "========================================"
echo ""
echo "📡 API 地址: http://localhost:8080/api"
echo "🔍 H2 控制台: http://localhost:8080/api/h2-console"
echo "💾 JDBC URL: jdbc:h2:file:./data/floodrelief"
echo "👤 用户名/密码: admin / admin"
echo ""
echo "服务启动后运行 ./verify-api.sh 验证 API 闭环"
echo ""

# 执行 Maven 命令
cd "$PROJECT_DIR"
exec "$MVN_CMD" clean spring-boot:run
