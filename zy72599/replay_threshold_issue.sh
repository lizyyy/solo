#!/bin/bash
# 样本权重异常追踪 - 记录 track_84958483 重跑命令
# 快照ID: snap_20260603_002
# 原始状态: threshold_changed_report_old
set -e

STORAGE_FILE="track_records.json"

# Step 1: 导入特征快照（生成新的追踪编号）
echo "=== Step 1: 导入特征快照 ==="
TRACK_ID=$(python3 cli.py import-snapshot \
  --snapshot-id snap_20260603_002 \
  --version v2.3.1 \
  --threshold 0.7 \
  --threshold-version caliber_2026_q2_v2 \
  --source feature_platform_daily \
  --operator system \
  --storage "$STORAGE_FILE" \
  | grep '^TRACK_ID=' | cut -d= -f2)
echo "新生成追踪编号: $TRACK_ID"

# Step 2: 补看训练日志曲线
echo "=== Step 2: 补看训练日志曲线 ==="
python3 cli.py check-log \
  --track-id "$TRACK_ID" \
  --log-id log_20260603_002 \
  --caliber caliber_2026_q2 \
  --final-weight 0.7 \
  --remarks "阈值已更新但报告未同步，当天早上紧急调整阈值，报告脚本未更新版本号" \
  --operator 推荐策略老唐 \
  --storage "$STORAGE_FILE"

# Step 2.5: 冲突复核
echo "=== Step 2.5: 冲突复核 ==="
python3 cli.py resolve \
  --track-id "$TRACK_ID" \
  --decision confirm \
  --reviewer 数据科学家A \
  --comment "确认阈值版本不匹配为报告同步延迟导致" \
  --storage "$STORAGE_FILE"

# Step 3: 更新分层指标
echo "=== Step 3: 更新分层指标 ==="
python3 cli.py update-metrics \
  --track-id "$TRACK_ID" \
  --caliber caliber_2026_q2_v2 \
  --operator system \
  --storage "$STORAGE_FILE"

# 查看最终追踪记录
echo "=== 最终复盘记录 ==="
python3 cli.py show --track-id "$TRACK_ID" --storage "$STORAGE_FILE"

echo ""
echo "重跑完成，追踪编号: $TRACK_ID"