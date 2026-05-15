#!/bin/bash

echo "=========================================="
echo "财务结转表处理工具 - 验收测试脚本"
echo "=========================================="
echo ""

echo "[1/6] 安装依赖..."
pip install -e . > /dev/null 2>&1
echo "✓ 安装完成"
echo ""

echo "[2/6] 测试1: 处理正常财务数据..."
echo "执行: fcarrier process data/samples/normal_finance_data.csv -p zhang_san"
fcarrier process data/samples/normal_finance_data.csv -p zhang_san -b "日常结转处理"
exit_code=$?
echo "退出码: $exit_code"
if [ $exit_code -eq 0 ]; then
    echo "✓ 测试1通过"
else
    echo "✗ 测试1失败"
fi
echo ""

echo "[3/6] 测试2: 触发批次号冲突..."
echo "执行: fcarrier process data/samples/conflict_finance_data.csv -p test_user"
fcarrier process data/samples/conflict_finance_data.csv -p test_user -b "冲突测试"
exit_code=$?
echo "退出码: $exit_code"
if [ $exit_code -eq 3 ]; then
    echo "✓ 测试2通过 (正确返回批次号冲突错误码3)"
else
    echo "✗ 测试2失败 (期望退出码3，实际$exit_code)"
fi
echo ""

echo "[4/6] 测试3: 边界数据验证..."
echo "执行: fcarrier process data/samples/boundary_finance_data.csv -p test_user"
fcarrier process data/samples/boundary_finance_data.csv -p test_user -b "边界测试"
exit_code=$?
echo "退出码: $exit_code"
if [ $exit_code -eq 4 ]; then
    echo "✓ 测试3通过 (正确返回数据验证错误码4)"
else
    echo "✗ 测试3失败 (期望退出码4，实际$exit_code)"
fi
echo ""

echo "[5/6] 测试4: 统一查询入口 - 查看所有状态..."
echo "执行: fcarrier query --status all"
fcarrier query --status all
echo "✓ 查询完成"
echo ""

echo "[6/6] 测试5: 处理人追踪功能..."
echo "执行: fcarrier trace zhang_san"
fcarrier trace zhang_san
echo "✓ 追踪完成"
echo ""

echo "=========================================="
echo "回滚安全机制测试"
echo "=========================================="
echo ""

echo "生成回滚候选清单..."
fcarrier rollback --generate-candidates
echo ""

echo "查看候选清单文件内容:"
cat data/rollback_candidates.json
echo ""

echo "=========================================="
echo "验收测试完成!"
echo "=========================================="
echo ""
echo "错误码说明:"
echo "  0 - 成功"
echo "  1 - 通用错误"
echo "  2 - 文件不存在"
echo "  3 - 批次号冲突"
echo "  4 - 数据验证失败"
echo "  5 - 候选清单为空"
echo "  6 - 处理人未找到"
