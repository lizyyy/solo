#!/bin/bash

echo "========================================"
echo "  影棚道具借用押金 CLI - 演示脚本"
echo "========================================"
echo ""

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "步骤 1: 创建示例数据..."
python3 create_sample_data.py
echo ""

echo "========================================"
echo "步骤 2: 导入道具档案"
echo "========================================"
python3 cli.py import props sample_data/props.xlsx
echo ""

echo "========================================"
echo "步骤 3: 导入借用单"
echo "========================================"
python3 cli.py import borrows sample_data/borrows.xlsx
echo ""

echo "========================================"
echo "步骤 4: 导入脏数据（测试问题记录）"
echo "========================================"
python3 cli.py import props sample_data/dirty_props.xlsx
echo ""

echo "========================================"
echo "步骤 5: 查看所有道具"
echo "========================================"
python3 cli.py query props
echo ""

echo "========================================"
echo "步骤 6: 查看所有借用单"
echo "========================================"
python3 cli.py query borrows
echo ""

echo "========================================"
echo "步骤 7: 查看单个道具详情 (P001)"
echo "========================================"
python3 cli.py query prop P001
echo ""

echo "========================================"
echo "步骤 8: 查看单个借用单详情 (B001)"
echo "========================================"
python3 cli.py query borrow B001
echo ""

echo "========================================"
echo "步骤 9: 处理归还 (B004 - 无损坏, 按时归还)"
echo "========================================"
python3 cli.py process-return B004 --return-date 2026-05-08 --damage none
echo ""

echo "========================================"
echo "步骤 10: 处理归还 (B005 - 轻微损坏, 逾期2天)"
echo "========================================"
python3 cli.py process-return B005 --return-date 2026-05-07 --damage minor
echo ""

echo "========================================"
echo "步骤 11: 检查逾期借用单"
echo "========================================"
python3 cli.py check overdue --date 2026-05-11
echo ""

echo "========================================"
echo "步骤 12: 查看问题记录"
echo "========================================"
python3 cli.py query problems
echo ""

echo "========================================"
echo "步骤 13: 查看汇总统计"
echo "========================================"
python3 cli.py check summary
echo ""

echo "========================================"
echo "步骤 14: 检查数据一致性"
echo "========================================"
python3 cli.py check consistency
echo ""

echo "========================================"
echo "步骤 15: 生成押金汇总报告"
echo "========================================"
python3 cli.py report summary
echo ""

echo "========================================"
echo "步骤 16: 生成逾期报告"
echo "========================================"
python3 cli.py report overdue
echo ""

echo "========================================"
echo "步骤 17: 生成损坏报告"
echo "========================================"
python3 cli.py report damage
echo ""

echo "========================================"
echo "步骤 18: 生成业务负责人汇总报告"
echo "========================================"
python3 cli.py report business
echo ""

echo "========================================"
echo "演示完成！"
echo "========================================"
echo ""
echo "报告文件位置: data_storage/reports/"
echo "数据文件位置: data_storage/data/"
echo "问题记录位置: data_storage/problems/"
