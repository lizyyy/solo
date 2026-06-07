from .engine import AcceptanceEngine
from .models import RecordStatus


def load_demo_data(engine: AcceptanceEngine):
    record1 = engine.import_slice(
        slice_id="SLICE-20240601-001",
        name="618大促核心搜索切片-差1桶",
        offline_score=0.72,
        online_score=0.58,
        query_count=12580,
        tags=["618", "核心搜索", "高优"],
    )

    record2 = engine.import_slice(
        slice_id="SLICE-20240601-002",
        name="推荐首页长尾切片-分桶一致",
        offline_score=0.65,
        online_score=0.63,
        query_count=8920,
        tags=["首页推荐", "长尾"],
    )

    record3 = engine.import_slice(
        slice_id="SLICE-20240601-003",
        name="相似商品召回切片",
        offline_score=0.81,
        online_score=0.78,
        query_count=5670,
        tags=["相似商品"],
    )

    engine.fill_feature_snapshot(
        record_id=record2.record_id,
        snapshot_id="FEAT-SNAP-20240528-v3",
        feature_version="v3.2.1",
        vector_dim=768,
        index_type="HNSW",
        remark="618前最新特征版本",
    )

    engine.manual_correct(
        record_id=record2.record_id,
        operator="推荐策略老唐",
        field="特征快照备注",
        before="618前最新特征版本",
        after="618前最新特征版本，已验证离线线上口径一致",
        reason="补录验证说明，给新人演示用",
    )

    engine.re_run(
        record_id=record1.record_id,
        operator="推荐策略老唐",
    )

    return {
        "bucket_mismatch_record": record1,
        "normal_record": record2,
        "pending_record": record3,
    }
