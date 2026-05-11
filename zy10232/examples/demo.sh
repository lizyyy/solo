#!/bin/bash
# 服装样衣借还CLI演示脚本
# 使用方法: chmod +x examples/demo.sh && examples/demo.sh

set -e

echo "════════════════════════════════════════════════════════════"
echo "           🎬 服装样衣借还CLI 演示脚本"
echo "════════════════════════════════════════════════════════════"
echo ""

GARMENT="node bin/cli.js"

# 清理数据
echo "[1/8] 🧹 清理测试数据..."
rm -rf .garment-data
echo "      完成"
echo ""

# 导入CSV
echo "[2/8] 📥 导入拍摄清单 (CSV)"
echo "      命令: garment import examples/shooting-list.csv"
echo ""
$GARMENT import examples/shooting-list.csv
echo ""
read -p "按回车继续..." -n1 -s
echo ""
echo ""

# 查看导入历史
echo "[3/8] 📚 查看导入历史"
echo "      命令: garment import-history"
echo ""
$GARMENT import-history
echo ""
read -p "按回车继续..." -n1 -s
echo ""
echo ""

# 查看列表
echo "[4/8] 📋 查看借用记录列表"
echo "      命令: garment list"
echo ""
$GARMENT list
echo ""
read -p "按回车继续..." -n1 -s
echo ""
echo ""

# 手动借出
echo "[5/8] ✋ 手动登记样衣借出"
echo "      命令: garment borrow --style SS2024-008 --size M --color 红色 --department 电商部 --borrower 测试用户 --due-date 2026-05-20"
echo ""
$GARMENT borrow --style SS2024-008 --size M --color 红色 --department 电商部 --borrower "测试用户" --due-date 2026-05-20
echo ""
read -p "按回车继续..." -n1 -s
echo ""
echo ""

# 异常检查
echo "[6/8] 🔍 异常检查"
echo "      命令: garment check"
echo ""
$GARMENT check
echo ""
read -p "按回车继续..." -n1 -s
echo ""
echo ""

# 档期查询
echo "[7/8] 📅 档期查询 (检查档期冲突)"
echo "      命令: garment check-schedule --style SS2024-001 --size M --color 黑色 --borrow 2026-05-11 --due 2026-05-14"
echo ""
$GARMENT check-schedule --style SS2024-001 --size M --color 黑色 --borrow 2026-05-11 --due 2026-05-14
echo ""
read -p "按回车继续..." -n1 -s
echo ""
echo ""

# 导出逾期清单
echo "[8/8] 📤 导出逾期清单"
echo "      命令: garment export-overdue"
echo ""
$GARMENT export-overdue
echo ""

echo "════════════════════════════════════════════════════════════"
echo "                   ✅ 演示完成！"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "更多命令示例:"
echo "  garment return --record <记录ID> --damage '污损说明' --compensation 50"
echo "  garment inspect --record <记录ID> --status passed --comp-status paid"
echo "  garment confirm --all"
echo "  garment correct --record <记录ID> --due-date 2026-05-25 --reason '档期调整'"
echo "  garment stats"
echo "  garment export-all --output reports/all-records.csv"
echo ""
