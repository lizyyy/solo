#!/bin/bash

echo "=========================================="
echo "  资源标签继承 API - 项目验证"
echo "=========================================="
echo ""

# 检查 Java
echo "🔍 检查 Java 环境..."
if command -v java >/dev/null 2>&1; then
  java -version 2>&1 | head -1
  echo "✅ Java 已安装"
else
  echo "❌ 未找到 Java，请安装 JDK 8+"
  exit 1
fi
echo ""

# 检查 Maven
echo "🔍 检查 Maven 环境..."
if command -v mvn >/dev/null 2>&1; then
  mvn -version 2>&1 | head -1
  echo "✅ Maven 已安装"
  HAS_MVN=1
else
  echo "⚠️  未找到系统 Maven"
  HAS_MVN=0
fi
echo ""

# 检查 Maven Wrapper
echo "🔍 检查 Maven Wrapper..."
if [ -f "mvnw" ] && [ -f ".mvn/wrapper/maven-wrapper.jar" ] && [ -f ".mvn/wrapper/maven-wrapper.properties" ]; then
  echo "✅ Maven Wrapper 文件齐全"
  HAS_MVNW=1
else
  echo "⚠️  Maven Wrapper 不完整"
  HAS_MVNW=0
fi
echo ""

# 检查项目结构
echo "🔍 检查项目结构..."
PROJECT_OK=1

if [ -f "pom.xml" ]; then
  echo "✅ pom.xml 存在"
else
  echo "❌ 缺少 pom.xml"
  PROJECT_OK=0
fi

if [ -d "src/main/java/com/resource/tag" ]; then
  echo "✅ 源代码目录存在"
else
  echo "❌ 缺少源代码目录"
  PROJECT_OK=0
fi

if [ -f "src/main/java/com/resource/tag/TagInheritanceApplication.java" ]; then
  echo "✅ 启动类存在"
else
  echo "❌ 缺少启动类"
  PROJECT_OK=0
fi
echo ""

# 显示文件列表
echo "📁 项目文件结构:"
find . -type f -name "*.java" | head -20
echo ""

# Java 8 兼容性检查
echo "🔍 Java 8 兼容性检查..."
echo "   (检查是否有 Java 9+ 特有语法...)"

CHECK_FAILED=0

# 检查 List.of, Map.of, Set.of
if grep -r "List\.of\|Map\.of\|Set\.of" src/main/java --include="*.java" | grep -v "Arrays.asList" >/dev/null 2>&1; then
  echo "❌ 发现 Java 9+ 的 *.of 语法:"
  grep -rn "List\.of\|Map\.of\|Set\.of" src/main/java --include="*.java"
  CHECK_FAILED=1
else
  echo "✅ *.of 语法检查通过"
fi

# 检查 switch 表达式 (->)
if grep -rn "case.*->" src/main/java --include="*.java" >/dev/null 2>&1; then
  echo "❌ 发现 Java 14+ 的 switch 表达式:"
  grep -rn "case.*->" src/main/java --include="*.java"
  CHECK_FAILED=1
else
  echo "✅ switch 表达式检查通过"
fi

# 检查 var 关键字
if grep -rn "^[[:space:]]*var[[:space:]]" src/main/java --include="*.java" >/dev/null 2>&1; then
  echo "❌ 发现 Java 10+ 的 var 关键字:"
  grep -rn "^[[:space:]]*var[[:space:]]" src/main/java --include="*.java"
  CHECK_FAILED=1
else
  echo "✅ var 关键字检查通过"
fi

echo ""

# 总结
echo "=========================================="
echo "            验证结果总结"
echo "=========================================="
echo ""

if [ $CHECK_FAILED -eq 0 ]; then
  echo "✅ 代码兼容 Java 8"
else
  echo "❌ 存在 Java 8 不兼容代码"
fi
echo ""

echo "🚀 启动方式:"
echo ""
echo "1. 如果系统有 Maven:"
echo "   mvn spring-boot:run"
echo ""
echo "2. 打包并运行:"
echo "   mvn clean package"
echo "   java -jar target/tag-inheritance-api-1.0.0.jar"
echo ""
echo "3. 使用 Maven Wrapper:"
echo "   ./mvnw spring-boot:run"
echo ""
