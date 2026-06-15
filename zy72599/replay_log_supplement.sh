#!/bin/bash
# 样本权重异常追踪 - 记录 track_f15eb2aa 重跑命令
# 快照ID: snap_20260525_003
# 原始状态: from_training_log
set -e

STORAGE_FILE="track_records.json"

# Step 1: 导入特征快照（生成新的追踪编号）
echo "=== Step 1: 导入特征快照 ==="
TRACK_ID=$(python3 cli.py import-snapshot \
  --snapshot-id snap_20260525_003 \
  --version v2.3.0 \
  --threshold 0.6 \
  --threshold-version caliber_2026_q1 \
  --source feature_platform_daily \
  --operator system \
  --storage "$STORAGE_FILE" \
  | grep '^TRACK_ID=' | cut -d= -f2)
echo "新生成追踪编号: $TRACK_ID"

# Step 2: 补看训练日志曲线
echo "=== Step 2: 补看训练日志曲线 ==="
python3 cli.py check-log \
  --track-id "$TRACK_ID" \
  --log-id log_20260525_003 \
  --caliber caliber_2026_q1 \
  --final-weight 0.6 \
  --remarks "从历史训练曲线补录，原特征快照丢失，从TensorBoard日志回溯" \
  --operator 推荐策略老唐 \
  --storage "$STORAGE_FILE"

# Step 2.5: 冲突复核
echo "=== Step 2.5: 冲突复核 ==="
python3 cli.py resolve \
  --track-id "$TRACK_ID" \
  --decision confirm \
  --reviewer 数据科学家B \
  --comment "确认从TensorBoard回溯补录，口径与当时一致" \
  --storage "$STORAGE_FILE"

# Step 3: 更新分层指标
echo "=== Step 3: 更新分层指标 ==="
python3 cli.py update-metrics \
  --track-id "$TRACK_ID" \
  --caliber caliber_2026_q1 \
  --operator system \
  --storage "$STORAGE_FILE"

# 查看最终追踪记录
echo "=== 最终复盘记录 ==="
python3 cli.py show --track-id "$TRACK_ID" --storage "$STORAGE_FILE"

echo ""
echo "重跑完成，追踪编号: $TRACK_ID"