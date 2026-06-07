from datetime import datetime, timedelta
from models import (
    EvalSlice, FeatureSnapshot, FeatureVersion,
    AuditHistory, CorrectionRecord, AuditRecord,
    AuditStatus, RecordSource
)


def create_demo_data():
    base_time = datetime(2026, 6, 1, 10, 0, 0)
    
    feature_snapshots = {
        "SNAP-001": FeatureSnapshot(
            snapshot_id="SNAP-001",
            feature_name="user_last_7d_click_cnt",
            caliber_version="v2.1",
            create_time=base_time - timedelta(days=30),
            default_value=-1,
            is_current=False,
            description="旧口径：近7天点击次数，默认值-1"
        ),
        "SNAP-002": FeatureSnapshot(
            snapshot_id="SNAP-002",
            feature_name="user_last_7d_click_cnt",
            caliber_version="v2.2",
            create_time=base_time - timedelta(days=10),
            default_value=0,
            is_current=True,
            description="新口径：近7天点击次数，默认值0"
        ),
        "SNAP-003": FeatureSnapshot(
            snapshot_id="SNAP-003",
            feature_name="user_category_prefer_score",
            caliber_version="v1.5",
            create_time=base_time - timedelta(days=5),
            default_value=0.0,
            is_current=True,
            description="当前口径：品类偏好分，默认值0.0"
        ),
        "SNAP-004": FeatureSnapshot(
            snapshot_id="SNAP-004",
            feature_name="user_active_level",
            caliber_version="v3.0",
            create_time=base_time - timedelta(days=3),
            default_value=-999,
            is_current=True,
            description="当前口径：活跃度等级，默认值-999"
        ),
    }
    
    slice_001 = EvalSlice(
        slice_id="SLICE-001",
        slice_name="618首页推荐评测-0601",
        data_batch_id="BATCH-20260601-A",
        import_time=base_time,
        feature_snapshot_id="SNAP-002",
        caliber_version="v2.2",
        raw_data={
            "feature": "user_last_7d_click_cnt",
            "sample_count": 5000,
            "default_ratio": 0.023,
            "check_result": "pass"
        }
    )
    
    record_001 = AuditRecord(
        slice_id="SLICE-001",
        eval_slice=slice_001,
        current_status=AuditStatus.IMPORTED,
        source=RecordSource.NORMAL_IMPORT,
        feature_snapshots=[feature_snapshots["SNAP-002"]],
        history=[
            AuditHistory(
                history_id="HIST-001-001",
                slice_id="SLICE-001",
                operation="导入评测切片",
                operator="system",
                operate_time=base_time,
                after_status=AuditStatus.IMPORTED,
                detail={"batch_id": "BATCH-20260601-A", "source": "评测系统自动同步"}
            )
        ]
    )
    
    slice_002_first = EvalSlice(
        slice_id="SLICE-002",
        slice_name="618搜索排序评测-0602",
        data_batch_id="BATCH-20260602-B",
        import_time=base_time + timedelta(days=1, hours=14),
        feature_snapshot_id="SNAP-003",
        caliber_version="v1.5",
        raw_data={
            "feature": "user_category_prefer_score",
            "sample_count": 8000,
            "default_ratio": 0.015,
            "check_result": "pass"
        }
    )
    
    record_002 = AuditRecord(
        slice_id="SLICE-002",
        eval_slice=slice_002_first,
        current_status=AuditStatus.IMPORTED,
        source=RecordSource.NORMAL_IMPORT,
        feature_snapshots=[feature_snapshots["SNAP-003"]],
        history=[
            AuditHistory(
                history_id="HIST-002-001",
                slice_id="SLICE-002",
                operation="导入评测切片",
                operator="system",
                operate_time=base_time + timedelta(days=1, hours=14),
                after_status=AuditStatus.IMPORTED,
                detail={"batch_id": "BATCH-20260602-B", "source": "评测系统自动同步"}
            )
        ]
    )
    
    slice_002_dup = EvalSlice(
        slice_id="SLICE-002-DUP",
        slice_name="618搜索排序评测-0602-重跑",
        data_batch_id="BATCH-20260602-B",
        import_time=base_time + timedelta(days=2, hours=9),
        feature_snapshot_id="SNAP-003",
        caliber_version="v1.5",
        raw_data={
            "feature": "user_category_prefer_score",
            "sample_count": 8000,
            "default_ratio": 0.015,
            "check_result": "pass",
            "note": "同一批数据重复训练"
        }
    )
    
    record_002_dup = AuditRecord(
        slice_id="SLICE-002-DUP",
        eval_slice=slice_002_dup,
        current_status=AuditStatus.IMPORTED,
        source=RecordSource.NORMAL_IMPORT,
        feature_snapshots=[feature_snapshots["SNAP-003"]],
        is_duplicate_training=True,
        duplicate_with_slice="SLICE-002",
        history=[
            AuditHistory(
                history_id="HIST-002D-001",
                slice_id="SLICE-002-DUP",
                operation="导入评测切片",
                operator="system",
                operate_time=base_time + timedelta(days=2, hours=9),
                after_status=AuditStatus.IMPORTED,
                detail={"batch_id": "BATCH-20260602-B", "source": "评测系统自动同步", "duplicate_detected": True}
            )
        ]
    )
    
    slice_003 = EvalSlice(
        slice_id="SLICE-003",
        slice_name="历史回溯评测-0520补录",
        data_batch_id="BATCH-20260520-C",
        import_time=base_time + timedelta(days=3, hours=11),
        feature_snapshot_id=None,
        caliber_version=None,
        raw_data={
            "feature": "user_last_7d_click_cnt",
            "sample_count": 3000,
            "default_ratio": 0.087,
            "check_result": "warning",
            "note": "旧数据补录，特征快照缺失"
        }
    )
    
    record_003 = AuditRecord(
        slice_id="SLICE-003",
        eval_slice=slice_003,
        current_status=AuditStatus.IMPORTED,
        source=RecordSource.SUPPLEMENT,
        feature_snapshots=[],
        supplement_from_snapshot="SNAP-001",
        history=[
            AuditHistory(
                history_id="HIST-003-001",
                slice_id="SLICE-003",
                operation="导入评测切片（补录）",
                operator="xiaoqiao",
                operate_time=base_time + timedelta(days=3, hours=11),
                after_status=AuditStatus.IMPORTED,
                detail={"batch_id": "BATCH-20260520-C", "source": "人工补录历史数据", "missing_snapshot": True}
            )
        ]
    )
    
    return {
        "feature_snapshots": feature_snapshots,
        "records": {
            "SLICE-001": record_001,
            "SLICE-002": record_002,
            "SLICE-002-DUP": record_002_dup,
            "SLICE-003": record_003,
        }
    }


def create_initial_feature_versions():
    base_time = datetime(2026, 6, 1, 10, 0, 0)
    return [
        FeatureVersion(
            version_id="VER-001",
            feature_name="user_last_7d_click_cnt",
            caliber_version="v2.2",
            default_value=0,
            effective_time=base_time - timedelta(days=10),
            is_active=True,
            source_snapshot_id="SNAP-002",
            remark="当前生效版本"
        ),
        FeatureVersion(
            version_id="VER-002",
            feature_name="user_category_prefer_score",
            caliber_version="v1.5",
            default_value=0.0,
            effective_time=base_time - timedelta(days=5),
            is_active=True,
            source_snapshot_id="SNAP-003",
            remark="当前生效版本"
        ),
        FeatureVersion(
            version_id="VER-003",
            feature_name="user_active_level",
            caliber_version="v3.0",
            default_value=-999,
            effective_time=base_time - timedelta(days=3),
            is_active=True,
            source_snapshot_id="SNAP-004",
            remark="当前生效版本"
        ),
    ]
