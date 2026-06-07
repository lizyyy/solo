from datetime import datetime, timedelta
from models import FeatureSnapshot, TrainingLogCurve, StratifiedMetric


def create_normal_sample():
    snapshot = FeatureSnapshot(
        snapshot_id="snap_20260601_001",
        version="v2.3.1",
        create_time=datetime.now() - timedelta(days=6),
        weight_threshold=0.65,
        weight_threshold_version="caliber_2026_q2",
        features={"user_activeness": 0.82, "item_quality": 0.75, "context_relevance": 0.68},
        source="feature_platform_daily"
    )

    training_log = TrainingLogCurve(
        log_id="log_20260601_001",
        snapshot_id="snap_20260601_001",
        train_time=datetime.now() - timedelta(days=6),
        metric_name="weight_curve",
        metric_values=[0.45, 0.52, 0.58, 0.62, 0.65, 0.65, 0.65],
        epochs=[1, 2, 3, 4, 5, 6, 7],
        final_weight=0.65,
        weight_caliber="caliber_2026_q2",
        remarks=""
    )

    metrics = [
        StratifiedMetric(
            metric_name="sample_weight",
            segment="high_value_users",
            value=0.72,
            confidence=0.95,
            caliber="caliber_2026_q2",
            update_time=datetime.now(),
            source="feature_snapshot"
        ),
        StratifiedMetric(
            metric_name="sample_weight",
            segment="mid_value_users",
            value=0.61,
            confidence=0.92,
            caliber="caliber_2026_q2",
            update_time=datetime.now(),
            source="feature_snapshot"
        ),
        StratifiedMetric(
            metric_name="sample_weight",
            segment="low_value_users",
            value=0.48,
            confidence=0.88,
            caliber="caliber_2026_q2",
            update_time=datetime.now(),
            source="feature_snapshot"
        ),
    ]

    return snapshot, training_log, metrics


def create_threshold_old_report_sample():
    snapshot = FeatureSnapshot(
        snapshot_id="snap_20260603_002",
        version="v2.3.1",
        create_time=datetime.now() - timedelta(days=4),
        weight_threshold=0.70,
        weight_threshold_version="caliber_2026_q2_v2",
        features={"user_activeness": 0.78, "item_quality": 0.72, "context_relevance": 0.70},
        source="feature_platform_daily"
    )

    training_log = TrainingLogCurve(
        log_id="log_20260603_002",
        snapshot_id="snap_20260603_002",
        train_time=datetime.now() - timedelta(days=4),
        metric_name="weight_curve",
        metric_values=[0.48, 0.55, 0.60, 0.65, 0.70, 0.70, 0.70],
        epochs=[1, 2, 3, 4, 5, 6, 7],
        final_weight=0.70,
        weight_caliber="caliber_2026_q2",
        remarks="阈值已更新但报告未同步，当天早上紧急调整阈值，报告脚本未更新版本号"
    )

    metrics = [
        StratifiedMetric(
            metric_name="sample_weight",
            segment="high_value_users",
            value=0.76,
            confidence=0.94,
            caliber="caliber_2026_q2_v2",
            update_time=datetime.now(),
            source="feature_snapshot"
        ),
        StratifiedMetric(
            metric_name="sample_weight",
            segment="mid_value_users",
            value=0.67,
            confidence=0.91,
            caliber="caliber_2026_q2_v2",
            update_time=datetime.now(),
            source="feature_snapshot"
        ),
        StratifiedMetric(
            metric_name="sample_weight",
            segment="low_value_users",
            value=0.52,
            confidence=0.87,
            caliber="caliber_2026_q2_v2",
            update_time=datetime.now(),
            source="feature_snapshot"
        ),
    ]

    return snapshot, training_log, metrics


def create_training_log_supplement_sample():
    snapshot = FeatureSnapshot(
        snapshot_id="snap_20260525_003",
        version="v2.3.0",
        create_time=datetime.now() - timedelta(days=13),
        weight_threshold=0.60,
        weight_threshold_version="caliber_2026_q1",
        features={"user_activeness": 0.75, "item_quality": 0.70, "context_relevance": 0.62},
        source="feature_platform_daily"
    )

    training_log = TrainingLogCurve(
        log_id="log_20260525_003",
        snapshot_id="snap_20260525_003",
        train_time=datetime.now() - timedelta(days=13),
        metric_name="weight_curve",
        metric_values=[0.42, 0.48, 0.53, 0.57, 0.60, 0.60, 0.60],
        epochs=[1, 2, 3, 4, 5, 6, 7],
        final_weight=0.60,
        weight_caliber="caliber_2026_q1",
        remarks="从历史训练曲线补录，原特征快照丢失，从TensorBoard日志回溯"
    )

    metrics = [
        StratifiedMetric(
            metric_name="sample_weight",
            segment="high_value_users",
            value=0.68,
            confidence=0.90,
            caliber="caliber_2026_q1",
            update_time=datetime.now(),
            source="training_log_backfill"
        ),
        StratifiedMetric(
            metric_name="sample_weight",
            segment="mid_value_users",
            value=0.58,
            confidence=0.87,
            caliber="caliber_2026_q1",
            update_time=datetime.now(),
            source="training_log_backfill"
        ),
        StratifiedMetric(
            metric_name="sample_weight",
            segment="low_value_users",
            value=0.45,
            confidence=0.82,
            caliber="caliber_2026_q1",
            update_time=datetime.now(),
            source="training_log_backfill"
        ),
    ]

    return snapshot, training_log, metrics
