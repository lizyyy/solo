#!/bin/bash

set -e

DB_PATH="test.db"

rm -f "$DB_PATH"

echo "========================================"
echo "  货代舱位取消CLI - 完整测试流程"
echo "========================================"
echo ""

echo "【步骤1】导入订舱清单"
echo "----------------------------------------"
python3 freight_cancel_cli.py --db "$DB_PATH" import-data \
    sample_data/bookings.csv \
    --type bookings
echo ""

echo "【步骤2】导入船期规则"
echo "----------------------------------------"
python3 freight_cancel_cli.py --db "$DB_PATH" import-data \
    sample_data/schedules.csv \
    --type schedules
echo ""

echo "【步骤3】导入取消/改船记录"
echo "----------------------------------------"
python3 freight_cancel_cli.py --db "$DB_PATH" import-data \
    sample_data/cancellations.csv \
    --type cancellations
echo ""

echo "【步骤4】查看所有记录（核算前）"
echo "----------------------------------------"
python3 freight_cancel_cli.py --db "$DB_PATH" list-records
echo ""

echo "【步骤5】执行费用核算"
echo "----------------------------------------"
python3 freight_cancel_cli.py --db "$DB_PATH" calculate
echo ""

echo "【步骤6】查看所有记录（核算后）"
echo "----------------------------------------"
python3 freight_cancel_cli.py --db "$DB_PATH" list-records
echo ""

echo "【步骤7】查看REC002详情（截关前取消，需收取消费）"
echo "----------------------------------------"
python3 freight_cancel_cli.py --db "$DB_PATH" detail REC002
echo ""

echo "【步骤8】查看REC003详情（截关后取消，需赔付）"
echo "----------------------------------------"
python3 freight_cancel_cli.py --db "$DB_PATH" detail REC003
echo ""

echo "【步骤9】登记人工减免 - 对REC002减免至1000元"
echo "----------------------------------------"
python3 freight_cancel_cli.py --db "$DB_PATH" waive REC002 \
    --waive-amount 1000 \
    --reason "长期合作客户特殊申请" \
    --operator "张经理"
echo ""

echo "【步骤10】再次查看REC002详情（减免后，带原始规则对照）"
echo "----------------------------------------"
python3 freight_cancel_cli.py --db "$DB_PATH" detail REC002
echo ""

echo "【步骤11】导出CSV报告"
echo "----------------------------------------"
python3 freight_cancel_cli.py --db "$DB_PATH" export report.csv --format csv
echo ""

echo "【步骤12】导出TXT明细报告"
echo "----------------------------------------"
python3 freight_cancel_cli.py --db "$DB_PATH" export report.txt --format txt
echo ""

echo "========================================"
echo "  测试流程完成！"
echo "========================================"
echo ""
echo "生成的文件："
echo "  - test.db: 数据库文件"
echo "  - report.csv: CSV汇总报告"
echo "  - report.txt: 详细文本报告"
