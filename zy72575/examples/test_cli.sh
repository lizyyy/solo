#!/bin/bash
# CLI 功能测试脚本

set -e

echo "清理旧数据..."
rm -rf data/

echo ""
echo "=== 1. 导入特征快照 ==="
python3 -m ranking_click_bias.cli import --file examples/sample_snapshots.json --by 林姐 --source cli_test

echo ""
echo "=== 2. 查看系统概览 ==="
python3 -m ranking_click_bias.cli summary

echo ""
echo "=== 3. 执行工作流 Step 1 ==="
python3 -m ranking_click_bias.cli workflow step1 --snapshot-id SNAP001 --by 林姐 --notes "CLI测试导入"

echo ""
echo "=== 4. 执行工作流 Step 2 - 审阅训练日志 ==="
python3 -m ranking_click_bias.cli workflow step2 \
    --snapshot-id SNAP001 \
    --by 林姐 \
    --log-analysis "训练曲线正常收敛，AUC稳定在0.85" \
    --curve-findings "loss无异常波动"

echo ""
echo "=== 5. 执行工作流 Step 3 - 更新摘要（触发特征缺失边界规则） ==="
python3 -m ranking_click_bias.cli workflow step3 \
    --snapshot-id SNAP001 \
    --by 林姐 \
    --summary "位置偏置贡献60%，时间因素30%" \
    --score 0.15 \
    --missing-features feature_003 \
    --default-score

echo ""
echo "=== 6. 查看需复核列表 ==="
python3 -m ranking_click_bias.cli review-list

echo ""
echo "=== 7. 查看单个快照详情 ==="
python3 -m ranking_click_bias.cli show --snapshot-id SNAP001 | head -50

echo ""
echo "=== 8. 推荐负责人复核通过 ==="
python3 -m ranking_click_bias.cli approve \
    --snapshot-id SNAP001 \
    --by 推荐负责人 \
    --notes "已确认，同意标记为正常"

echo ""
echo "=== 9. 再次查看系统概览 ==="
python3 -m ranking_click_bias.cli summary

echo ""
echo "=== 10. 生成复盘报告（保存到文件） ==="
python3 -m ranking_click_bias.cli audit --snapshot-id SNAP001 --save 2>&1 | tail -5

echo ""
echo "=== 11. 生成重放命令（保存到文件） ==="
python3 -m ranking_click_bias.cli replay --snapshot-id SNAP001 --save 2>&1 | tail -3

echo ""
echo "✅ CLI 测试完成！"
