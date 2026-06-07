# 样本权重异常追踪 - 记录 track_ffd0ab90 重跑命令
# 快照ID: snap_20260603_002
# 状态: threshold_changed_report_old

# Step 1: 导入特征快照
python cli.py import-snapshot \
  --snapshot-id snap_20260603_002 \
  --version v2.3.1 \
  --threshold 0.7 \
  --threshold-version caliber_2026_q2_v2 \
  --source feature_platform_daily \
  --operator system

# Step 2: 补看训练日志曲线
python cli.py check-log \
  --track-id track_ffd0ab90 \
  --log-id log_20260603_002 \
  --caliber caliber_2026_q2 \
  --final-weight 0.7 \
  --operator 推荐策略老唐

# 冲突处理
python cli.py resolve \
  --track-id track_ffd0ab90 \
  --decision confirm \
  --reviewer 数据科学家A \
  --comment "确认阈值版本不匹配为报告同步延迟导致"

# Step 3: 更新分层指标
python cli.py update-metrics \
  --track-id track_ffd0ab90 \
  --caliber caliber_2026_q2_v2 \
  --operator system

# 查看追踪记录
python cli.py show --track-id track_ffd0ab90