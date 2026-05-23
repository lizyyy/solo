#!/bin/bash
# 充电桩巡检多源导入巡检 CLI 完整演示脚本

set -e

echo "========================================"
echo "  充电桩巡检多源导入巡检 CLI 演示"
echo "========================================"
echo ""

echo "【步骤 1】安装依赖并初始化项目"
echo "----------------------------------------"
pip install -e . -q
echo "依赖安装完成"
echo ""

echo "【步骤 2】初始化数据库"
echo "----------------------------------------"
cpi init --force
echo ""

echo "【步骤 3】生成样例数据（包含坏数据）"
echo "----------------------------------------"
python samples/generate_samples.py
echo ""

echo "【步骤 4】导入桩端告警数据"
echo "----------------------------------------"
python3 -m cpi_cli.main import-data pile_alarm samples/pile_alarms.xlsx --mode append --operator 张工
echo ""

echo "【步骤 5】查看导入批次列表"
echo "----------------------------------------"
python3 -m cpi_cli.main check
echo ""

echo "【步骤 6】检查桩端告警数据质量"
echo "----------------------------------------"
echo "请输入上面显示的批次号，然后运行: python3 -m cpi_cli.main check <批次号> --show-errors"
echo ""

echo "【步骤 7】导入巡检表数据"
echo "----------------------------------------"
python3 -m cpi_cli.main import-data inspection samples/inspections.xlsx --operator 李工
echo ""

echo "【步骤 8】导入客服投诉单"
echo "----------------------------------------"
python3 -m cpi_cli.main import-data complaint samples/complaints.xlsx --operator 王工
echo ""

echo "【步骤 9】生成片区经理报告"
echo "----------------------------------------"
python3 -m cpi_cli.main report
echo ""

echo "【步骤 10】查看审计历史"
echo "----------------------------------------"
echo "运行: python3 -m cpi_cli.main history <批次号>"
echo ""

echo "【步骤 11】人工修正错误示例"
echo "----------------------------------------"
echo "1. 先查看错误: python3 -m cpi_cli.main check <批次号> --show-errors"
echo "2. 然后修复: python3 -m cpi_cli.main fix <批次号> --row-no <行号> --field <字段> --value <新值>"
echo "3. 再次检查: python3 -m cpi_cli.main check <批次号>"
echo ""

echo "【步骤 12】导出数据"
echo "----------------------------------------"
echo "python3 -m cpi_cli.main export pile_alarm --format excel"
echo ""

echo "【步骤 13】演示重复导入 - 忽略模式"
echo "----------------------------------------"
python3 -m cpi_cli.main import-data pile_alarm samples/pile_alarms.xlsx --mode ignore --operator 张工
echo ""

echo "【步骤 14】异步任务管理"
echo "----------------------------------------"
echo "python3 -m cpi_cli.main task list"
echo "python3 -m cpi_cli.main task retry <task_id>"
echo "python3 -m cpi_cli.main task fail <task_id> --reason '数据不可修复'"
echo ""

echo "========================================"
echo "  演示完成！"
echo "========================================"
echo ""
echo "常用命令:"
echo "  python3 -m cpi_cli.main --help              查看所有命令"
echo "  python3 -m cpi_cli.main check               查看批次列表"
echo "  python3 -m cpi_cli.main report              生成片区经理报告"
echo "  python3 -m cpi_cli.main history             查看审计历史"
