#!/bin/bash
set -e

echo "========================================="
echo "  类别不平衡重采样 - 完整流程演示"
echo "========================================="

SESSION_ID="demo_$(date +%Y%m%d_%H%M%S)"
echo "会话ID: $SESSION_ID"
echo ""

echo "步骤1: 导入特征快照"
echo "-------------------------"
resampler --data-dir ./work_data import-snapshot sample_features.csv \
    --score-col model_score \
    --label-col label \
    --created-by ayue \
    --session-id $SESSION_ID
echo ""

echo "查看会话概览"
resampler --data-dir ./work_data show $SESSION_ID
echo ""

echo "步骤2: (模拟)阿越审查训练日志"
echo "-------------------------"
echo "注意: 实际使用时需要先查看可疑记录，人工决策后生成 ayue_decisions.json"
echo ""

echo "步骤3: 自动生成可解释摘要"
echo "-------------------------"
resampler --data-dir ./work_data update-summary $SESSION_ID --auto-generate
echo ""

echo "应用重采样权重"
echo "-------------------------"
resampler --data-dir ./work_data apply-weights $SESSION_ID --label-col label
echo ""

echo "导出结果"
echo "-------------------------"
resampler --data-dir ./work_data export $SESSION_ID --output resample_result.csv
echo ""

echo "查看可疑记录详情"
echo "-------------------------"
resampler --data-dir ./work_data show $SESSION_ID --suspicious-only
echo ""

echo "========================================="
echo "  演示完成！"
echo "  数据目录: ./work_data"
echo "  导出文件: resample_result.csv"
echo "========================================="
