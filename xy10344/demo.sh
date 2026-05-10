#!/bin/bash

set -e

echo "=========================================="
echo "   赛事装备检录 CLI - 演示脚本"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "【1/8】安装依赖..."
npm install --silent
echo "✓ 依赖安装完成"
echo ""

echo "【2/8】重置数据..."
node index.js reset --yes
echo ""

echo "【3/8】导入选手名单 (8人)..."
node index.js import-athletes samples/athletes.csv
echo ""

echo "【4/8】导入强制装备清单 (6项强制, 2项可选)..."
node index.js import-equipment samples/equipment.csv
echo ""

echo "【5/8】开始现场检录流程..."
echo "------------------------------------------"

echo ""
echo ">>> 发放号码布给1001,1002,1003,1004,1005"
node index.js scan-bib 1001
node index.js scan-bib 1002
node index.js scan-bib 1003
node index.js scan-bib 1004
node index.js scan-bib 1005

echo ""
echo ">>> 测试重复扫描1001 (应该报错)"
set +e
node index.js scan-bib 1001
set -e

echo ""
echo ">>> 测试不存在的号码布9999 (应该报错)"
set +e
node index.js scan-bib 9999
set -e

echo ""
echo ">>> 发放补给包给1001,1002 (正常)"
node index.js scan-supply 1001
node index.js scan-supply 1002

echo ""
echo ">>> 测试补给包已领但未检录 (1006先领补给包)"
node index.js scan-supply 1006

echo ""
echo ">>> 装备检查录入"
echo ""
echo "1001张伟 - 装备齐全 (允许通过)"
node index.js check-equipment 1001 -p helmet,headlamp,vest,water_bag,energy_food,first_aid

echo ""
echo "1002李明 - 缺头灯,救生衣 (待补装备)"
node index.js check-equipment 1002 -p helmet,water_bag,energy_food,first_aid -m headlamp,vest

echo ""
echo "1003王芳 - 齐全但忘带头灯，人工豁免"
node index.js check-equipment 1003 -p helmet,vest,water_bag,energy_food,first_aid -m headlamp
node index.js waive 1003 headlamp "现场确认已借组委会备用头灯" -a "赛事总监-张工"

echo ""
echo "1004刘强 - 检查部分装备"
node index.js check-equipment 1004 -p helmet,headlamp -m vest

echo ""
echo "【6/8】查看缺项装备列表..."
echo ""
node index.js list-missing

echo ""
echo "【7/8】查看人工豁免列表..."
echo ""
node index.js list-waived

echo ""
echo "【8/8】查看统计信息..."
echo ""
node index.js statistics

echo ""
echo "=========================================="
echo "   导出最终报告"
echo "=========================================="
echo ""

mkdir -p reports
echo ">>> 导出文本格式报告..."
node index.js export reports/checkin-report.txt

echo ""
echo ">>> 导出JSON格式报告..."
node index.js export reports/checkin-report.json -f json

echo ""
echo ">>> 导出CSV格式报告..."
node index.js export reports/checkin-report.csv -f csv

echo ""
echo "=========================================="
echo "   查看生成的报告"
echo "=========================================="
echo ""
echo "文本报告内容预览:"
echo "------------------------------------------"
head -100 reports/checkin-report.txt

echo ""
echo "=========================================="
echo "   演示完成"
echo "=========================================="
echo ""
echo "可用命令:"
echo "  node index.js --help          查看帮助"
echo "  node index.js list-athletes   查看所有选手"
echo "  node index.js list-equipment  查看装备清单"
echo "  node index.js status 1001     查看选手状态"
echo "  node index.js statistics      查看统计"
echo ""
echo "报告已导出到 reports/ 目录"
