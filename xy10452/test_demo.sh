#!/bin/bash

set -e

echo "========================================"
echo "项目风险周报 CLI 演示脚本"
echo "========================================"
echo ""

STORAGE="./risk_data"

echo "1. 清理旧数据..."
rm -rf "$STORAGE"

echo ""
echo "2. 导入健康项目数据 (电商平台V2)..."
python run_risk.py import json --file ./sample_data/healthy_project_w1.json

echo ""
echo "3. 导入延期项目数据 (金融管理系统)..."
python run_risk.py import json --file ./sample_data/delayed_project_w1.json

echo ""
echo "4. 导入需要升级项目数据 (AI决策系统)..."
python run_risk.py import json --file ./sample_data/escalate_project_w1.json

echo ""
echo "5. 查看所有项目..."
python run_risk.py projects

echo ""
echo "6. 计算健康项目风险 (电商平台V2 - 第1周)..."
python run_risk.py calculate --project "电商平台V2" --week 1 --today 2026-05-11

echo ""
echo "7. 计算延期项目风险 (金融管理系统 - 第1周)..."
python run_risk.py calculate --project "金融管理系统" --week 1 --today 2026-05-11

echo ""
echo "8. 计算需要升级项目风险 (AI决策系统 - 第1周)..."
python run_risk.py calculate --project "AI决策系统" --week 1 --today 2026-05-11

echo ""
echo "9. 查看所有风险列表..."
python run_risk.py list

echo ""
echo "10. 导出健康项目周报..."
python run_risk.py export --project "电商平台V2" --week 1 --format markdown --output ./reports/healthy_weekly_report.md

echo ""
echo "11. 导出延期项目周报..."
python run_risk.py export --project "金融管理系统" --week 1 --format markdown --output ./reports/delayed_weekly_report.md

echo ""
echo "12. 导出需要升级项目周报..."
python run_risk.py export --project "AI决策系统" --week 1 --format markdown --output ./reports/escalate_weekly_report.md

echo ""
echo "13. 测试重复导入 (导入相同数据应跳过)..."
python run_risk.py import json --file ./sample_data/healthy_project_w1.json

echo ""
echo "========================================"
echo "演示完成！"
echo "生成的周报复位于 ./reports/ 目录"
echo "========================================"
