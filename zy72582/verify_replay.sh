#!/bin/bash
set -e

cd /Users/lzy/pro/solo/workspaces/zy72582
rm -rf data retrospective.json

echo "=========================================="
echo "验证可重新跑命令 - 完整流程复现"
echo "=========================================="
echo ""

echo ">>> 第一步：导入基础数据"
echo "------------------------------------------"
python3 -m multi_task_tuner import-snapshot --id SNAP-2026-001 --start '2026-05-08T15:00:00' --end '2026-06-06T15:00:00' --demo-pattern
python3 -m multi_task_tuner import-snapshot --id SNAP-2026-002 --start '2026-05-13T15:00:00' --end '2026-06-02T15:00:00' --demo-pattern
python3 -m multi_task_tuner import-snapshot --id SNAP-2026-003 --start '2026-03-09T15:00:00' --end '2026-04-08T15:00:00' --demo-pattern

python3 -m multi_task_tuner import-log --id LOG-2026-001 --experiment 'baseline_run_normal' --demo-pattern
python3 -m multi_task_tuner import-log --id LOG-2026-002 --experiment 'weighted_run_leaked' --demo-pattern
python3 -m multi_task_tuner import-log --id LOG-2026-003 --experiment 'old_metric_run' --demo-pattern
echo ""

echo ">>> 第二步：特征快照第一次导入，生成初始异常样本"
echo "------------------------------------------"
python3 -m multi_task_tuner create-anomaly --snapshot SNAP-2026-001 --ref-time 2026-06-07T15:00:00 --sample-id SAMP-NORMAL-001 --log LOG-2026-001
python3 -m multi_task_tuner create-anomaly --snapshot SNAP-2026-002 --ref-time 2026-06-07T15:00:00 --sample-id SAMP-LEAK-002
python3 -m multi_task_tuner create-anomaly --snapshot SNAP-2026-003 --ref-time 2026-06-07T15:00:00 --sample-id SAMP-OLD-003
echo ""

echo ">>> 初始异常样本页"
echo "------------------------------------------"
python3 -m multi_task_tuner anomaly-page
echo ""

echo ">>> 第三步：实验平台负责人阿越补看训练日志曲线"
echo "------------------------------------------"
python3 -m multi_task_tuner supplement-log --sample SAMP-LEAK-002 --log LOG-2026-002 --ref-time 2026-06-07T15:00:00
python3 -m multi_task_tuner supplement-log --sample SAMP-OLD-003 --log LOG-2026-003 --ref-time 2026-06-07T15:00:00
echo ""

echo ">>> 补录后的异常样本页"
echo "------------------------------------------"
python3 -m multi_task_tuner anomaly-page
echo ""

echo ">>> 第四步：时间窗穿越不急着归正常，留给阿越复核"
echo "------------------------------------------"
python3 -m multi_task_tuner review --sample SAMP-LEAK-002 --reviewer '阿越' --action confirm_leak --note "确认存在时间窗穿越，训练数据泄露了测试期信息，效果虚高，需要重新划分数据集后重跑。"
python3 -m multi_task_tuner review --sample SAMP-NORMAL-001 --reviewer '阿越' --action correct --note "人工确认数据正常，任务权重调优后效果符合预期，标记为已修正。"
echo ""

echo ">>> 复核后的异常样本页"
echo "------------------------------------------"
python3 -m multi_task_tuner anomaly-page
echo ""

echo ">>> 第五步：一次重跑（使用调整后的权重）"
echo "------------------------------------------"
python3 -m multi_task_tuner rerun --type post_review_rerun --weights '{"task_a": 0.55, "task_b": 0.45}' --snapshots SNAP-2026-002 --samples SAMP-LEAK-002 --notes "时间窗穿越问题修复后重跑，使用新的数据集划分"
echo ""

echo ">>> 最终异常样本页"
echo "------------------------------------------"
python3 -m multi_task_tuner anomaly-page
echo ""

echo ">>> 生成复盘记录"
echo "------------------------------------------"
python3 -m multi_task_tuner retrospective --output retrospective.json
echo ""

echo "=========================================="
echo "验证完成！可重新跑命令全部执行成功。"
echo "=========================================="
