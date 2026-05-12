#!/bin/bash

# 批处理断点续跑 CLI 演示脚本

echo "========================================"
echo "  批处理断点续跑 CLI 演示"
echo "========================================"
echo ""

BATCH_ID="batch-demo-$(date +%Y%m%d%H%M%S)"
STATE_DIR=".batch-state"
DATA_DIR="./data"

# 清理之前的测试状态
if [ -d "$STATE_DIR" ]; then
    echo "清理之前的测试状态..."
    rm -rf "$STATE_DIR"
fi

echo ""
echo "步骤 1: 查看 CLI 帮助"
echo "----------------------------------------"
node cli.js
echo ""

echo "步骤 2: 首次启动批次 (模拟在第 8 行中断)"
echo "----------------------------------------"
node cli.js start --input "$DATA_DIR/members-part1.jsonl" --batchId "$BATCH_ID" --simulateInterrupt 8
echo ""

echo "步骤 3: 查看当前状态"
echo "----------------------------------------"
node cli.js status --batchId "$BATCH_ID"
echo ""

echo "步骤 4: 查看失败记录"
echo "----------------------------------------"
node cli.js failures --batchId "$BATCH_ID"
echo ""

echo "步骤 5: 续跑批次 (继续处理剩余数据)"
echo "----------------------------------------"
node cli.js resume --batchId "$BATCH_ID"
echo ""

echo "步骤 6: 再次查看状态和报告"
echo "----------------------------------------"
node cli.js status --batchId "$BATCH_ID"
echo ""
node cli.js report --batchId "$BATCH_ID"
echo ""

echo "步骤 7: 测试重复批次号检测 (使用新 batchId 处理相同输入)"
echo "----------------------------------------"
node cli.js start --input "$DATA_DIR/members-part1.jsonl" --batchId "batch-duplicate-test"
echo ""

echo "步骤 8: 列出所有批次"
echo "----------------------------------------"
node cli.js list
echo ""

echo "========================================"
echo "  演示完成！"
echo "========================================"
echo ""
echo "批次状态文件位于: $STATE_DIR/$BATCH_ID.json"
echo ""
