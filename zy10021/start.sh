#!/bin/bash

# PaymentGuard 启动脚本
# 这是一个后端工程化项目，用于模拟和检测支付平台回调幂等性问题

set -e

echo "=========================================="
echo "   PaymentGuard 支付回调幂等性验证平台"
echo "=========================================="
echo ""

# 检查 Java 版本
if ! command -v java &> /dev/null; then
    echo "❌ 错误: 未找到 Java 运行环境"
    echo "   请安装 Java 17 或更高版本"
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2 | cut -d'.' -f1)
if [ "$JAVA_VERSION" -lt 11 ]; then
    echo "⚠️  警告: 当前 Java 版本较低 ($JAVA_VERSION)"
    echo "   项目推荐使用 Java 17+"
    echo ""
fi

# 检查 Maven
if ! command -v mvn &> /dev/null; then
    echo "❌ 错误: 未找到 Maven"
    echo "   请安装 Maven 3.8+"
    exit 1
fi

echo "📦 正在编译项目..."
mvn clean package -DskipTests -q

echo ""
echo "🚀 正在启动 PaymentGuard..."
echo ""

java -jar target/payment-guard-1.0.0.jar
