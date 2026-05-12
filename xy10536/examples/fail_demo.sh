#!/bin/bash

echo "=========================================="
echo "  模型训练数据剔除 CLI 工具 - 失败路径演示"
echo "=========================================="
echo ""

WORKSPACE=$(pwd)

# 清理之前的数据
echo "清理之前的演示数据..."
rm -rf "$WORKSPACE/.purge_data"
echo ""

# 1. 未初始化就执行操作
echo "1. 测试：未初始化就执行操作..."
echo "命令: python3 purge.py import dataset test_dataset --sample-index examples/text_samples.json"
echo "预期结果: 失败，提示工作空间未初始化"
python3 purge.py import dataset test_dataset --sample-index examples/text_samples.json 2>/dev/null
echo "退出码: $?"
echo ""

# 初始化
python3 purge.py init >/dev/null 2>&1
echo "已初始化工作空间"
echo ""

# 2. 导入不存在的文件
echo "2. 测试：导入不存在的文件..."
echo "命令: python3 purge.py import dataset test_dataset --sample-index nonexistent.json"
echo "预期结果: 失败，提示文件不存在"
python3 purge.py import dataset test_dataset --sample-index nonexistent.json 2>/dev/null
echo "退出码: $?"
echo ""

# 3. 检查不存在的敏感操作ID
echo "3. 测试：检查不存在的敏感操作ID..."
echo "命令: python3 purge.py check nonexistent-id-12345"
echo "预期结果: 失败，提示敏感样本清单不存在"
python3 purge.py check nonexistent-id-12345 2>/dev/null
echo "退出码: $?"
echo ""

# 正常导入数据，为后续测试做准备
python3 purge.py import dataset text_dataset \
    --sample-index examples/text_samples.json \
    --labels examples/text_labels.json \
    --version v1.0.0 \
    --published \
    --operator test_user >/dev/null 2>&1

SENSITIVE_RESULT=$(python3 purge.py --json import sensitive examples/sensitive_samples.json \
    --reason "测试" \
    --operator test_user)
SENSITIVE_OP_ID=$(echo "$SENSITIVE_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('operation_id',''))")

CHECK_RESULT=$(python3 purge.py --json check "$SENSITIVE_OP_ID" --operator test_user)
CHECK_OP_ID=$(echo "$CHECK_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('operation_id',''))")

echo "已准备好测试数据，SENSITIVE_OP_ID=$SENSITIVE_OP_ID"
echo "CHECK_OP_ID=$CHECK_OP_ID"
echo ""

# 4. 对已发布版本执行剔除但未指定补丁版本
echo "4. 测试：对已发布版本执行剔除但未指定补丁版本..."
echo "命令: python3 purge.py execute $CHECK_OP_ID text_dataset v1.0.0"
echo "预期结果: 失败，提示已发布版本只能通过补丁版本修改"
python3 purge.py execute "$CHECK_OP_ID" text_dataset v1.0.0 2>/dev/null
echo "退出码: $?"
echo ""

# 5. 执行剔除时使用不存在的检查操作ID
echo "5. 测试：使用不存在的检查操作ID执行剔除..."
echo "命令: python3 purge.py execute fake-check-id text_dataset v1.0.0 --patch-version v1.0.1"
echo "预期结果: 失败，提示检查操作不存在"
python3 purge.py execute "fake-check-id" text_dataset v1.0.0 --patch-version v1.0.1 2>/dev/null
echo "退出码: $?"
echo ""

# 6. 执行剔除时使用不存在的数据集
echo "6. 测试：使用不存在的数据集执行剔除..."
echo "命令: python3 purge.py execute $CHECK_OP_ID nonexistent_dataset v1.0.0"
echo "预期结果: 失败，提示数据集版本不存在"
python3 purge.py execute "$CHECK_OP_ID" nonexistent_dataset v1.0.0 2>/dev/null
echo "退出码: $?"
echo ""

# 7. 执行剔除时使用不存在的版本
echo "7. 测试：使用不存在的版本执行剔除..."
echo "命令: python3 purge.py execute $CHECK_OP_ID text_dataset v999.0.0"
echo "预期结果: 失败，提示数据集版本不存在"
python3 purge.py execute "$CHECK_OP_ID" text_dataset v999.0.0 2>/dev/null
echo "退出码: $?"
echo ""

echo "=========================================="
echo "  失败路径演示完成"
echo "=========================================="
echo ""
echo "查看失败操作历史: python3 purge.py detail --all --status failed"
echo ""

# 显示所有失败操作
python3 purge.py detail --all --status failed
