# 样本权重异常追踪 - 记录 track_4083eef6 重跑命令
# 快照ID: snap_20260601_001
# 状态: normal

# Step 1: 导入特征快照
python cli.py import-snapshot \
  --snapshot-id snap_20260601_001 \
  --version v2.3.1 \
  --threshold 0.65 \
  --threshold-version caliber_2026_q2 \
  --source feature_platform_daily \
  --operator system

# Step 2: 补看训练日志曲线
python cli.py check-log \
  --track-id track_4083eef6 \
  --log-id log_20260601_001 \
  --caliber caliber_2026_q2 \
  --final-weight 0.65 \
  --operator 推荐策略老唐

# Step 3: 更新分层指标
python cli.py update-metrics \
  --track-id track_4083eef6 \
  --caliber caliber_2026_q2 \
  --operator system

# 查看追踪记录
python cli.py show --track-id track_4083eef6