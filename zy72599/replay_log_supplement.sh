# 样本权重异常追踪 - 记录 track_5f156a36 重跑命令
# 快照ID: snap_20260525_003
# 状态: from_training_log

# Step 1: 导入特征快照
python cli.py import-snapshot \
  --snapshot-id snap_20260525_003 \
  --version v2.3.0 \
  --threshold 0.6 \
  --threshold-version caliber_2026_q1 \
  --source feature_platform_daily \
  --operator system

# Step 2: 补看训练日志曲线
python cli.py check-log \
  --track-id track_5f156a36 \
  --log-id log_20260525_003 \
  --caliber caliber_2026_q1 \
  --final-weight 0.6 \
  --operator 推荐策略老唐

# 冲突处理
python cli.py resolve \
  --track-id track_5f156a36 \
  --decision confirm \
  --reviewer 数据科学家B \
  --comment "确认从TensorBoard回溯补录，口径与当时一致"

# Step 3: 更新分层指标
python cli.py update-metrics \
  --track-id track_5f156a36 \
  --caliber caliber_2026_q1 \
  --operator system

# 查看追踪记录
python cli.py show --track-id track_5f156a36