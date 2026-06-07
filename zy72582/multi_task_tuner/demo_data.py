from datetime import datetime, timedelta
from .processor import MultiTaskTuner


def generate_demo_data(data_dir: str = "./data"):
    tuner = MultiTaskTuner(data_dir)
    now = datetime(2026, 6, 7, 15, 0, 0)
    
    print("=" * 60)
    print("正在生成演示数据...")
    print("=" * 60)
    
    snap1 = tuner.import_feature_snapshot(
        snapshot_id="SNAP-2026-001",
        features={
            "feature_version": "v3.2.1",
            "task_weights": {"task_a": 0.6, "task_b": 0.4},
            "expected_metrics": {"auc": 0.82, "f1": 0.76, "task_a_acc": 0.85, "task_b_acc": 0.78}
        },
        data_range_start=now - timedelta(days=30),
        data_range_end=now - timedelta(days=1),
        created_at=now - timedelta(days=1, hours=2),
        source="main_flow"
    )
    print(f"[1/6] 导入特征快照: {snap1.snapshot_id} (正常数据范围)")
    
    log1_points = []
    log1_base = now - timedelta(days=2)
    for epoch in range(1, 21):
        log1_points.append({
            "timestamp": (log1_base + timedelta(minutes=epoch * 5)).isoformat(),
            "epoch": epoch,
            "loss": 0.85 - epoch * 0.03,
            "metrics": {"auc": 0.70 + epoch * 0.006, "f1": 0.62 + epoch * 0.007},
            "task_weights": {"task_a": 0.6, "task_b": 0.4}
        })
    log1 = tuner.import_training_log(
        log_id="LOG-2026-001",
        experiment_name="baseline_run_normal",
        points=log1_points,
        data_source="on_site"
    )
    print(f"[2/6] 导入训练日志: {log1.log_id} (正常时间范围 - 早于数据截止时间)")
    
    snap2 = tuner.import_feature_snapshot(
        snapshot_id="SNAP-2026-002",
        features={
            "feature_version": "v3.2.1",
            "task_weights": {"task_a": 0.7, "task_b": 0.3},
            "expected_metrics": {"auc": 0.91, "f1": 0.88, "task_a_acc": 0.94, "task_b_acc": 0.72}
        },
        data_range_start=now - timedelta(days=25),
        data_range_end=now - timedelta(days=5),
        created_at=now - timedelta(days=4),
        source="main_flow"
    )
    print(f"[3/6] 导入特征快照: {snap2.snapshot_id} (数据截止到5天前)")
    
    log2_points = []
    for epoch in range(1, 21):
        log2_points.append({
            "timestamp": (now - timedelta(hours=12) + timedelta(minutes=epoch * 3)).isoformat(),
            "epoch": epoch,
            "loss": 0.78 - epoch * 0.035,
            "metrics": {"auc": 0.78 + epoch * 0.007, "f1": 0.70 + epoch * 0.009},
            "task_weights": {"task_a": 0.7, "task_b": 0.3}
        })
    log2 = tuner.import_training_log(
        log_id="LOG-2026-002",
        experiment_name="weighted_run_leaked",
        points=log2_points,
        data_source="on_site"
    )
    print(f"[4/6] 导入训练日志: {log2.log_id} (训练时间穿越数据截止时间 - 会检测到虚高)")
    
    snap3 = tuner.import_feature_snapshot(
        snapshot_id="SNAP-2026-003",
        features={
            "feature_version": "v3.1.0",
            "task_weights": {"task_a": 0.5, "task_b": 0.5},
            "expected_metrics": {"auc": 0.78, "f1": 0.71, "task_a_acc": 0.80, "task_b_acc": 0.73}
        },
        data_range_start=now - timedelta(days=90),
        data_range_end=now - timedelta(days=60),
        created_at=now - timedelta(days=55),
        source="main_flow"
    )
    print(f"[5/6] 导入特征快照: {snap3.snapshot_id} (历史数据，2个月前)")
    
    log3_points = []
    base_time = now - timedelta(days=80)
    for epoch in range(1, 16):
        log3_points.append({
            "timestamp": (base_time + timedelta(minutes=epoch * 8)).isoformat(),
            "epoch": epoch,
            "loss": 0.92 - epoch * 0.028,
            "metrics": {"auc": 0.68 + epoch * 0.006, "f1": 0.60 + epoch * 0.007},
            "task_weights": {"task_a": 0.5, "task_b": 0.5}
        })
    log3 = tuner.import_training_log(
        log_id="LOG-2026-003",
        experiment_name="old_metric_run",
        points=log3_points,
        data_source="on_site"
    )
    print(f"[6/6] 导入训练日志: {log3.log_id} (旧口径数据 - 80天前的训练记录)")
    
    print()
    print("演示数据生成完成！")
    print(f"  特征快照数: {len(tuner.store.list_snapshots())}")
    print(f"  训练日志数: {len(tuner.store.list_logs())}")
    print()
    print("三种不同场景的记录说明:")
    print("  1. SNAP-2026-001 + LOG-2026-001: 顺利记录，数据时间对齐正常")
    print("  2. SNAP-2026-002 + LOG-2026-002: 时间窗穿越，训练日志晚于数据截止时间，效果虚高")
    print("  3. SNAP-2026-003 + LOG-2026-003: 旧口径数据，训练日志距今超过30天")
    print()
    
    return tuner


def run_demo_workflow(data_dir: str = "./data"):
    tuner = generate_demo_data(data_dir)
    now = datetime(2026, 6, 7, 15, 0, 0)
    
    print("=" * 60)
    print("开始执行完整演示流程...")
    print("=" * 60)
    print()
    
    print(">>> 第一步: 特征快照第一次导入，生成初始异常样本")
    print("-" * 60)
    sample1 = tuner.create_anomaly_from_snapshot("SNAP-2026-001", "LOG-2026-001", reference_time=now)
    sample2 = tuner.create_anomaly_from_snapshot("SNAP-2026-002", None, reference_time=now)
    sample3 = tuner.create_anomaly_from_snapshot("SNAP-2026-003", None, reference_time=now)
    
    print(f"  创建异常样本: {sample1.sample_id} ({sample1.status.value})")
    print(f"  创建异常样本: {sample2.sample_id} ({sample2.status.value}) - 等待补录日志")
    print(f"  创建异常样本: {sample3.sample_id} ({sample3.status.value}) - 等待补录日志")
    print()
    
    print(">>> 第二步: 实验平台负责人阿越补看训练日志曲线")
    print("-" * 60)
    print("  阿越查看 LOG-2026-002 和 LOG-2026-003 后，开始补录...")
    
    sample2_updated = tuner.supplement_training_log(sample2.sample_id, "LOG-2026-002", reference_time=now)
    sample3_updated = tuner.supplement_training_log(sample3.sample_id, "LOG-2026-003", reference_time=now)
    
    print(f"  补录后 {sample2_updated.sample_id} 状态: {sample2_updated.status.value}")
    print(f"    说明: {sample2_updated.review_note}")
    print(f"  补录后 {sample3_updated.sample_id} 状态: {sample3_updated.status.value}")
    print(f"    说明: {sample3_updated.review_note}")
    print()
    
    print(">>> 第三步: 时间窗穿越不急着归正常，留给阿越复核")
    print("-" * 60)
    print("  阿越发现 SNAP-2026-002 存在时间窗穿越，需要人工确认...")
    
    sample2_reviewed, review1 = tuner.review_anomaly(
        sample2.sample_id,
        reviewer="阿越",
        action="confirm_leak",
        note="确认存在时间窗穿越，训练数据泄露了测试期信息，效果虚高，需要重新划分数据集后重跑。"
    )
    print(f"  复核后 {sample2_reviewed.sample_id} 状态: {sample2_reviewed.status.value}")
    print(f"  复核记录: {review1.record_id} - 操作人: {review1.reviewer}")
    print(f"  复核意见: {review1.note}")
    print()
    
    print(">>> 第四步: 一次人工修正")
    print("-" * 60)
    print("  阿越修正 SNAP-2026-001 的任务权重参数...")
    
    sample1_corrected, review2 = tuner.review_anomaly(
        sample1.sample_id,
        reviewer="阿越",
        action="correct",
        note="人工确认数据正常，任务权重调优后效果符合预期，标记为已修正。"
    )
    print(f"  修正后 {sample1_corrected.sample_id} 状态: {sample1_corrected.status.value}")
    print(f"  修正人: {sample1_corrected.corrected_by}")
    print()
    
    print(">>> 第五步: 一次重跑（使用调整后的权重）")
    print("-" * 60)
    rerun = tuner.rerun_experiment(
        run_type="post_review_rerun",
        task_weights={"task_a": 0.55, "task_b": 0.45},
        snapshot_ids=["SNAP-2026-002"],
        log_ids=[],
        notes="时间窗穿越问题修复后重跑，使用新的数据集划分"
    )
    print(f"  重跑实验 ID: {rerun.run_id}")
    print(f"  重跑类型: {rerun.run_type}")
    print(f"  任务权重: {rerun.task_weights}")
    print()
    
    print("=" * 60)
    print("演示流程执行完成！")
    print("=" * 60)
    print()
    
    return tuner


if __name__ == "__main__":
    run_demo_workflow()
