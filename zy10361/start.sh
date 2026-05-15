#!/bin/bash
# ⚠️  DEPRECATED - 此脚本已废弃！
# 请使用 ./one-click-start.sh 作为唯一启动入口
# 该脚本会自动：清理旧 class、下载依赖、Java 8 编译、启动服务

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  ⚠️  警告：此脚本已废弃！                                    ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "此脚本 (start.sh) 会直接加载旧的 class 文件，导致:"
echo "  ❌ UnsupportedClassVersionError: class file version 55.0"
echo "  ❌ 缺少 lib 依赖目录"
echo "  ❌ 无法正确启动服务"
echo ""
echo "✅ 请使用正确的一键启动脚本："
echo ""
echo "   ./one-click-start.sh"
echo ""
echo "它会自动完成 7 个步骤："
echo "   1. 🔍 检查 Java 环境"
echo "   2. 🧹 强制删除旧的 class 文件（解决 version 55 问题）"
echo "   3. 🔧 移除 Lombok 注解，生成纯 Java 代码"
echo "   4. 📦 自动下载所有依赖 jar 到 lib 目录"
echo "   5. 🔨 用 Java 8 模式 (-source 1.8 -target 1.8) 编译"
echo "   6. 🔍 验证 class 文件版本（确保是 52 = Java 8）"
echo "   7. 🚀 启动 Spring Boot 服务"
echo ""
echo "正在跳转到正确的启动脚本..."
echo ""

sleep 2

if [ -f "one-click-start.sh" ]; then
    exec ./one-click-start.sh
else
    echo "❌ 找不到 one-click-start.sh"
    exit 1
fi
