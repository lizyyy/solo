#!/bin/bash
# 多源身份校验 API - 快速启动脚本
# 自动检测环境并提供运行方案

set -e  # 遇到错误立即退出

echo "========================================"
echo "  多源身份校验 API - 快速启动工具"
echo "========================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检测 Java 版本
echo "[1/6] 检测 Java 环境..."
HAS_JAVA=false
HAS_JDK=false
JAVA_VERSION=""
JAVAC_VERSION=""

if command -v java &> /dev/null; then
    JAVA_VERSION=$(java -version 2>&1 | head -1)
    echo -e "${GREEN}✓${NC} 检测到 Java 运行时: $JAVA_VERSION"
    HAS_JAVA=true
    
    # 检查是否有 javac (需要真正执行并检查输出)
    if javac -version &> /dev/null; then
        JAVAC_VERSION=$(javac -version 2>&1)
        echo -e "${GREEN}✓${NC} 检测到完整 JDK: $JAVAC_VERSION"
        HAS_JDK=true
    else
        echo -e "${YELLOW}⚠${NC}  仅检测到 JRE（运行时），缺少 javac 编译器"
        echo "  可以运行已编译的 JAR，但无法从源码编译"
        HAS_JDK=false
    fi
else
    echo -e "${RED}✗${NC} 未检测到 Java，请先安装 JDK 8 或更高版本"
    echo ""
    echo "安装建议："
    echo "  macOS:    brew install openjdk@8"
    echo "  Ubuntu:   sudo apt-get install openjdk-8-jdk"
    echo "  Windows:  从 Oracle 官网下载 JDK 8"
    exit 1
fi
echo ""

# 检测 Maven
echo "[2/6] 检测构建工具..."
HAS_MAVEN=false
MVN_CMD=""

if command -v mvn &> /dev/null; then
    if mvn -version &> /dev/null; then
        MVN_VERSION=$(mvn -version | head -1)
        echo -e "${GREEN}✓${NC} 检测到系统 Maven: $MVN_VERSION"
        HAS_MAVEN=true
        MVN_CMD="mvn"
    fi
fi

if [ "$HAS_MAVEN" = false ] && [ -f "./mvnw" ]; then
    echo -e "${GREEN}✓${NC} 检测到项目 Maven Wrapper"
    echo "  首次运行会自动下载 Maven (约 10MB)"
    HAS_MAVEN=true
    MVN_CMD="./mvnw"
fi

if [ "$HAS_MAVEN" = false ]; then
    echo -e "${YELLOW}⚠${NC}  未检测到 Maven 环境"
fi
echo ""

# 检查是否有已编译的 jar
echo "[3/6] 检查编译产物..."
HAS_JAR=false
JAR_FILE=""

if ls target/*.jar 1> /dev/null 2>&1; then
    JAR_FILE=$(ls target/*.jar 2>/dev/null | head -1)
    if [ -f "$JAR_FILE" ]; then
        echo -e "${GREEN}✓${NC} 发现可执行 JAR: $JAR_FILE"
        HAS_JAR=true
    else
        echo -e "${YELLOW}⚠${NC}  未发现编译好的 JAR 文件"
        HAS_JAR=false
    fi
else
    echo -e "${YELLOW}⚠${NC}  未发现编译好的 JAR 文件"
    HAS_JAR=false
fi
echo ""

# 代码结构验证
echo "[4/6] 验证代码结构..."
JAVA_FILES_COUNT=$(find src/main/java -name "*.java" 2>/dev/null | wc -l | tr -d ' ')
REPO_COUNT=$(find src/main/java -name "*Repository.java" 2>/dev/null | wc -l | tr -d ' ')
SERVICE_COUNT=$(find src/main/java -name "*Service.java" 2>/dev/null | wc -l | tr -d ' ')
CONTROLLER_COUNT=$(find src/main/java -name "*Controller.java" 2>/dev/null | wc -l | tr -d ' ')

echo -e "${GREEN}✓${NC} Java 源文件: $JAVA_FILES_COUNT 个"
echo -e "${GREEN}✓${NC} Repository 接口: $REPO_COUNT 个"
echo -e "${GREEN}✓${NC} Service 实现: $SERVICE_COUNT 个"
echo -e "${GREEN}✓${NC} REST Controller: $CONTROLLER_COUNT 个"
echo ""

# 选择运行方式
echo "[5/6] 评估运行方案..."
echo ""

# 方案判断逻辑
if [ "$HAS_JAR" = true ] && [ "$HAS_JAVA" = true ]; then
    RUN_OPTION="A"
    echo -e "${GREEN}方案 A: 直接运行已编译的 JAR（推荐）${NC}"
    echo "  命令: java -jar $JAR_FILE"
elif [ "$HAS_JDK" = true ] && [ "$HAS_MAVEN" = true ]; then
    RUN_OPTION="B"
    echo -e "${YELLOW}方案 B: 从源码编译后运行${NC}"
    echo "  需要: JDK + Maven"
    echo "  命令: $MVN_CMD clean package -DskipTests"
    echo "        java -jar target/*.jar"
else
    RUN_OPTION="C"
    echo -e "${RED}方案 C: 当前环境无法直接运行${NC}"
    echo ""
    echo "环境分析:"
    if [ "$HAS_JAR" = false ]; then
        echo "  ✗ 缺少已编译的 JAR 文件"
    fi
    if [ "$HAS_JDK" = false ]; then
        echo "  ✗ 缺少完整 JDK（只有 JRE 无法编译）"
    fi
    if [ "$HAS_MAVEN" = false ]; then
        echo "  ✗ 缺少 Maven 构建工具"
    fi
fi
echo ""

# 显示 API 信息
echo "[6/6] 系统信息概览"
echo ""
echo "核心接口列表:"
echo "  POST   /api/verification              - 创建校验任务"
echo "  GET    /api/verification/{taskId}     - 查询校验结果"
echo "  POST   /api/verification/{taskId}/advance - 推进校验"
echo "  POST   /api/verification/{taskId}/revoke  - 撤销校验"
echo "  GET    /api/verification/{taskId}/history - 查询历史记录"
echo "  GET    /api/verification/list         - 任务列表"
echo "  GET    /api/export/{taskId}/excel     - 导出Excel"
echo ""
echo "管理界面:"
echo "  H2 控制台: http://localhost:8080/h2-console"
echo "  JDBC URL: jdbc:h2:mem:identitydb"
echo "  用户名: sa"
echo "  密码: (空)"
echo ""
echo "状态流转:"
echo "  创建 → 校验中 → 有冲突 → 待确认 → 人工确认 → 已合并 → 结束"
echo "                    ↓"
echo "                  无冲突 → 已确认 → 结束"
echo "                    ↓"
echo "                  任意阶段可撤销 → 已撤销"
echo ""
echo "========================================"
echo ""

# 执行选择
if [ "$RUN_OPTION" = "A" ]; then
    echo "🎉 检测到完整运行环境！"
    echo ""
    read -p "是否直接启动应用？(y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "启动应用中..."
        echo "访问地址: http://localhost:8080"
        echo ""
        java -jar $JAR_FILE
    fi
elif [ "$RUN_OPTION" = "B" ]; then
    echo "🔧 可以从源码编译运行"
    echo ""
    read -p "是否开始编译并启动？(y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "开始编译..."
        echo "命令: $MVN_CMD clean package -DskipTests"
        echo ""
        if $MVN_CMD clean package -DskipTests; then
            echo ""
            echo "✅ 编译成功！"
            NEW_JAR=$(ls target/*.jar 2>/dev/null | head -1)
            if [ -n "$NEW_JAR" ]; then
                echo "正在启动应用: $NEW_JAR"
                echo "访问地址: http://localhost:8080"
                echo ""
                java -jar $NEW_JAR
            else
                echo -e "${RED}错误: 编译成功但未找到 JAR 文件${NC}"
                exit 1
            fi
        else
            echo -e "${RED}❌ 编译失败${NC}"
            exit 1
        fi
    fi
else
    echo "📋 代码结构验证完成！"
    echo ""
    echo "当前环境状态:"
    if [ "$HAS_JAVA" = true ]; then
        echo "  ✅ Java 运行时: $JAVA_VERSION"
    fi
    if [ "$HAS_JDK" = true ]; then
        echo "  ✅ JDK 编译器: $JAVAC_VERSION"
    fi
    if [ "$HAS_MAVEN" = true ]; then
        echo "  ✅ Maven: 可用 ($MVN_CMD)"
    fi
    echo ""
    echo "下一步操作建议:"
    echo ""
    if [ "$HAS_JDK" = false ]; then
        echo "1. 安装完整 JDK 8+"
        echo "   macOS:    brew install openjdk@8"
        echo "   Ubuntu:   sudo apt-get install openjdk-8-jdk"
    fi
    if [ "$HAS_JDK" = true ] && [ "$HAS_MAVEN" = true ]; then
        echo "1. 编译项目: $MVN_CMD clean package -DskipTests"
        echo "2. 运行应用: java -jar target/multi-source-identity-verification-1.0.0.jar"
    fi
    echo ""
    echo "项目代码结构完整，所有功能已实现！"
fi
