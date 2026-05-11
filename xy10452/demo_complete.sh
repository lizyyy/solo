#!/bin/bash

set -e

echo "========================================"
echo "项目风险周报 CLI - 完整演示"
echo "========================================"
echo ""

STORAGE="./risk_data"
PYTHON="python3"

echo "📦 步骤 1: 清理旧数据..."
rm -rf "$STORAGE" reports
mkdir -p reports

echo ""
echo "📥 步骤 2: 导入三个样例项目数据..."
echo "  - 健康项目: 电商平台V2"
echo "  - 延期项目: 金融管理系统"
echo "  - 需要升级的项目: AI决策系统"
echo ""

$PYTHON run_risk.py import json --file ./sample_data/healthy_project_w1.json
$PYTHON run_risk.py import json --file ./sample_data/delayed_project_w1.json
$PYTHON run_risk.py import json --file ./sample_data/escalate_project_w1.json

echo ""
echo "📋 步骤 3: 查看所有项目..."
$PYTHON run_risk.py projects

echo ""
echo "🔍 步骤 4: 计算三个项目的风险..."
echo ""

echo "--- 健康项目 (电商平台V2) ---"
$PYTHON run_risk.py calculate --project "电商平台V2" --week 1 --today 2026-05-11

echo ""
echo "--- 延期项目 (金融管理系统) ---"
$PYTHON run_risk.py calculate --project "金融管理系统" --week 1 --today 2026-05-11

echo ""
echo "--- 需要升级的项目 (AI决策系统) ---"
$PYTHON run_risk.py calculate --project "AI决策系统" --week 1 --today 2026-05-11

echo ""
echo "📊 步骤 5: 查看所有风险列表..."
$PYTHON run_risk.py list

echo ""
echo "🔎 步骤 6: 查看某个风险的详细信息 (包含证据)..."
$PYTHON run_risk.py show --risk-id R01006

echo ""
echo "✏️ 步骤 7: 标记风险为已解释..."
$PYTHON run_risk.py explain --risk-id R01006 --explanation "已与HR沟通，新员工下周入职，将临时指派王五处理" --owner 王五

echo ""
echo "📤 步骤 8: 导出三个项目的周报 (Markdown格式)..."
$PYTHON run_risk.py export --project "电商平台V2" --week 1 --format markdown --output ./reports/healthy_weekly_report.md
$PYTHON run_risk.py export --project "金融管理系统" --week 1 --format markdown --output ./reports/delayed_weekly_report.md
$PYTHON run_risk.py export --project "AI决策系统" --week 1 --format markdown --output ./reports/escalate_weekly_report.md

echo ""
echo "🔄 步骤 9: 测试重复导入 (应跳过已存在的数据)..."
$PYTHON run_risk.py import json --file ./sample_data/healthy_project_w1.json

echo ""
echo "🔄 步骤 10: 重新计算风险 (演示重新计算功能)..."
$PYTHON run_risk.py calculate --project "电商平台V2" --week 1 --today 2026-05-11

echo ""
echo "========================================"
echo "🎉 演示完成！"
echo "========================================"
echo ""
echo "📁 生成的文件:"
echo "  - reports/healthy_weekly_report.md (健康项目周报)"
echo "  - reports/delayed_weekly_report.md (延期项目周报)"
echo "  - reports/escalate_weekly_report.md (需要升级的项目周报)"
echo ""
echo "💡 使用提示:"
echo "  python3 run_risk.py --help          查看所有命令"
echo "  python3 run_risk.py import --help   查看导入命令"
echo "  python3 run_risk.py calculate --help 查看计算命令"
echo ""
echo "========================================"
