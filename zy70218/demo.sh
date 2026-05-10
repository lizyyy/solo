#!/bin/bash

set -e

echo "=========================================="
echo "  古籍数字化页码校对 CLI 演示"
echo "=========================================="
echo ""

echo "步骤 1: 安装依赖"
echo "------------------------"
pip install -e .
echo ""

echo "步骤 2: 导入演示扫描目录"
echo "------------------------"
python -m ancient_books.cli import-dir demo_scans
echo ""

echo "步骤 3: 查看导入的扫描会话"
echo "------------------------"
python -m ancient_books.cli query sessions
echo ""

echo "步骤 4: 查看所有文件"
echo "------------------------"
python -m ancient_books.cli query files
echo ""

echo "步骤 5: 执行卷次校验和缺页检测"
echo "------------------------"
python -m ancient_books.cli check --description "第一次完整检查"
echo ""

echo "步骤 6: 查看检查运行历史"
echo "------------------------"
python -m ancient_books.cli query checks
echo ""

echo "步骤 7: 查看卷次详情 (使用最新的检查运行 ID)"
echo "------------------------"
python -m ancient_books.cli query volumes 1
echo ""

echo "步骤 8: 查看异常列表"
echo "------------------------"
python -m ancient_books.cli query exceptions
echo ""

echo "步骤 9: 查看缺页详情 (状态为 missing)"
echo "------------------------"
python -m ancient_books.cli query pages 1 --status missing
echo ""

echo "步骤 10: 生成报告"
echo "------------------------"
python -m ancient_books.cli report --output demo_report.md
echo ""

echo "=========================================="
echo "  演示完成！"
echo "=========================================="
echo ""
echo "生成的报告: demo_report.md"
echo "数据库文件: page_checker.db"
echo ""
echo "您可以继续使用以下命令："
echo "  python -m ancient_books.cli --help          查看帮助"
echo "  python -m ancient_books.cli query exception-detail <ID>  查看异常详情"
echo "  python -m ancient_books.cli resolve <ID>    标记异常为已解决"
