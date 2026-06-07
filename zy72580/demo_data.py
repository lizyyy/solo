from datetime import datetime
from core import FeatureSnapshot, TrainingLog


def get_demo_snapshots():
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    return [
        FeatureSnapshot(
            snapshot_id="SNAP-20260601-001",
            import_time=now,
            feature_name="user_click_rate_7d",
            ps_value=0.82,
            drift_value=0.08,
            missing_rate=0.05,
            threshold_version="v1",
            note="",
            status="pending"
        ),
        FeatureSnapshot(
            snapshot_id="SNAP-20260601-002",
            import_time=now,
            feature_name="user_purchase_prob",
            ps_value=0.88,
            drift_value=0.12,
            missing_rate=0.03,
            threshold_version="v1",
            note="阈值改过但报告仍写旧值，v2阈值PS_medium=0.90但报告用v1的0.85",
            status="pending"
        ),
        FeatureSnapshot(
            snapshot_id="SNAP-20260601-003",
            import_time=now,
            feature_name="item_exposure_count",
            ps_value=0.96,
            drift_value=0.25,
            missing_rate=0.08,
            threshold_version="v1",
            note="阈值改过但报告仍写旧值，需要从训练日志曲线补旧口径",
            status="pending"
        )
    ]


def get_demo_training_logs():
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    return [
        TrainingLog(
            log_id="LOG-20260601-001",
            snapshot_id="SNAP-20260601-001",
            curve_data={
                "train_loss": [0.8, 0.6, 0.4, 0.3, 0.25, 0.22, 0.2],
                "val_auc": [0.72, 0.78, 0.82, 0.85, 0.86, 0.87, 0.875],
                "ps_curve": [0.75, 0.78, 0.80, 0.81, 0.82, 0.82, 0.82]
            },
            log_time=now,
            model_version="v20260530",
            old_caliber_ps=None,
            old_caliber_drift=None
        ),
        TrainingLog(
            log_id="LOG-20260601-002",
            snapshot_id="SNAP-20260601-002",
            curve_data={
                "train_loss": [0.7, 0.5, 0.35, 0.28, 0.24, 0.22, 0.21],
                "val_auc": [0.75, 0.80, 0.84, 0.86, 0.87, 0.875, 0.88],
                "ps_curve": [0.80, 0.84, 0.86, 0.87, 0.88, 0.88, 0.88]
            },
            log_time=now,
            model_version="v20260530",
            old_caliber_ps=None,
            old_caliber_drift=None
        ),
        TrainingLog(
            log_id="LOG-20260601-003",
            snapshot_id="SNAP-20260601-003",
            curve_data={
                "train_loss": [0.9, 0.7, 0.5, 0.38, 0.32, 0.29, 0.28],
                "val_auc": [0.68, 0.74, 0.79, 0.82, 0.84, 0.85, 0.855],
                "ps_curve": [0.85, 0.88, 0.90, 0.91, 0.92, 0.92, 0.92]
            },
            log_time=now,
            model_version="v20260525",
            old_caliber_ps=0.82,
            old_caliber_drift=0.10
        )
    ]
