#!/bin/bash
# ⚠️  DEPRECATED - 此脚本已废弃！
# 请使用 ./one-click-start.sh 作为唯一启动入口
# 此脚本依赖 Maven，而 one-click-start.sh 是完全独立的

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  ⚠️  警告：此脚本已废弃！                                    ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "此脚本 (quick-start.sh) 依赖 Maven，可能会导致:"
echo "  ❌ 环境没有 Maven 时无法运行"
echo "  ❌ Maven 下载依赖慢或失败"
echo ""
echo "✅ 请使用完全独立的一键启动脚本："
echo ""
echo "   ./one-click-start.sh"
echo ""
echo "它不需要任何构建工具，只需要 JDK 8+"
echo "自动完成 7 个步骤，零配置启动"
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
