import pytest
import sys
from datetime import datetime, timedelta

sys.path.insert(0, ".")

from app.models import (
    FeatureRecord,
    CheckParameters,
    RecordStatus,
    ConflictResolution,
    CheckStep,
)
from app.checker import (
    detect_time_leakage,
    detect_conflicts,
    process_record_status,
    process_all_records,
)
from app.self_check import (
    check_duplicate_imports,
    check_feature_missing_default,
    check_resupplement_recalculation,
    check_export_consistency,
)
from app.workflow import WorkflowManager
from app.result_store import UnifiedResultStore


def create_test_record(
    sample_id="s001",
    feature_value=100.0,
    default_value_used=False,
    hours_before_end=48,
    feature_id="f001",
    feature_name="测试特征",
    bucket_id="test_bucket",
):
    window_end = datetime(2024, 1, 8, 0, 0, 0)
    window_start = datetime(2024, 1, 1, 0, 0, 0)
    feature_ts = window_end - timedelta(hours=hours_before_end)

    return FeatureRecord(
        feature_id=feature_id,
        feature_name=feature_name,
        bucket_id=bucket_id,
        sample_id=sample_id,
        feature_value=feature_value,
        default_value_used=default_value_used,
        time_window_start=window_start,
        time_window_end=window_end,
        feature_timestamp=feature_ts if not (feature_value is None or default_value_used) else None,
    )


class TestUnifiedResultConsistency:
    def test_page_api_export_triple_consistency_after_step1(self):
        wf = WorkflowManager()
        session = wf.create_session("xiaomeng")
        bucket = [
            create_test_record(sample_id="s001", hours_before_end=48),
            create_test_record(sample_id="s002", feature_value=None, default_value_used=True, feature_name="用户转化率"),
            create_test_record(sample_id="s003", hours_before_end=2, feature_name="用户停留时长"),
        ]
        session = wf.step1_import_bucket(session.session_id, bucket)

        store = UnifiedResultStore(session)
        page = store.get_all_records_for_page()
        api = store.get_all_records_for_api()
        export = store.get_all_records_for_export()

        assert page == api == export, "步骤1后：页面/接口/导出三者数据必须完全一致"

    def test_page_api_export_triple_consistency_after_step2_with_conflicts(self):
        wf = WorkflowManager()
        session = wf.create_session("xiaomeng")
        bucket = [
            create_test_record(sample_id="s001", hours_before_end=48, feature_value=100),
            create_test_record(sample_id="s002", feature_value=None, default_value_used=True),
        ]
        session = wf.step1_import_bucket(session.session_id, bucket)

        negative = [
            create_test_record(sample_id="s001", hours_before_end=48, feature_value=200, bucket_id="neg_bucket"),
            create_test_record(sample_id="s002", feature_value=None, default_value_used=True, bucket_id="neg_bucket"),
        ]
        session = wf.step2_review_negatives(session.session_id, negative)

        store = UnifiedResultStore(session)
        page = store.get_all_records_for_page()
        api = store.get_all_records_for_api()
        export = store.get_all_records_for_export()

        assert page == api == export, "步骤2后含冲突：页面/接口/导出三者数据必须完全一致"

        missing_page = [r for r in page if "默认分" in str(r.get("是否使用了默认填充值", ""))]
        missing_api = [r for r in api if "默认分" in str(r.get("是否使用了默认填充值", ""))]
        missing_export = [r for r in export if "默认分" in str(r.get("是否使用了默认填充值", ""))]
        assert len(missing_page) == len(missing_api) == len(missing_export) >= 2

    def test_feature_missing_record_has_history_trace(self):
        wf = WorkflowManager()
        session = wf.create_session("xiaomeng")
        bucket = [
            create_test_record(sample_id="s002", feature_value=None, default_value_used=True, feature_name="转化率"),
        ]
        session = wf.step1_import_bucket(session.session_id, bucket)
        store = UnifiedResultStore(session)
        rec = store.get_all_records_for_api()[0]

        assert rec["最终状态(中文)"] == "待推荐负责人复核"
        assert "历史留痕(完整状态变更链)" in rec
        assert "特征缺失给默认分→留待推荐负责人复核" in rec["历史留痕(完整状态变更链)"]
        assert "待推荐负责人复核，结论暂不能直接发" in rec["结果说明(可解释)"]
        assert rec["应用参数版本"] == CheckParameters().parameter_version

    def test_feature_missing_stays_pending_after_conflict_resolved(self):
        wf = WorkflowManager()
        session = wf.create_session("xiaomeng")
        bucket = [
            create_test_record(sample_id="s001", feature_value=None, default_value_used=True),
        ]
        session = wf.step1_import_bucket(session.session_id, bucket)

        negative = [
            create_test_record(sample_id="s001", feature_value=None, default_value_used=True, bucket_id="neg"),
        ]
        session = wf.step2_review_negatives(session.session_id, negative)

        for c in session.conflicts:
            session = wf.resolve_conflict(
                session.session_id, c.record_id, ConflictResolution.CONFIRM, "xiaomeng"
            )

        store = UnifiedResultStore(session)
        all_recs = store.get_all_records_for_api()

        for rec in all_recs:
            if "默认分" in str(rec.get("是否使用了默认填充值", "")):
                assert rec["最终状态(英文)"] == "pending_review", (
                    f"特征缺失给默认分的记录{rec['样本ID']}在冲突处理后仍必须为待复核，不能自动归正常"
                )
                has_review_keyword = (
                    "推荐负责人复核" in rec["结果说明(可解释)"]
                    or "未自动归为正常" in rec["结果说明(可解释)"]
                    or "待推荐负责人复核" in rec["结果说明(可解释)"]
                )
                assert has_review_keyword, (
                    f"特征缺失记录{rec['样本ID']}的结果说明必须包含复核关键词，实际：{rec['结果说明(可解释)']}"
                )

    def test_step3_blocks_without_reviewer_when_missing_exists(self):
        wf = WorkflowManager()
        session = wf.create_session()
        bucket = [create_test_record(sample_id="s001", feature_value=None, default_value_used=True)]
        session = wf.step1_import_bucket(session.session_id, bucket)
        negative = [create_test_record(sample_id="s001", feature_value=None, default_value_used=True, bucket_id="neg")]
        session = wf.step2_review_negatives(session.session_id, negative)

        for c in session.conflicts:
            session = wf.resolve_conflict(
                session.session_id, c.record_id, ConflictResolution.CONFIRM, "xiaomeng"
            )

        with pytest.raises(ValueError, match="待推荐负责人复核"):
            wf.step3_update_summary(session.session_id, "summary", reviewer=None)

    def test_step3_with_reviewer_marks_missing_as_reviewed(self):
        wf = WorkflowManager()
        session = wf.create_session()
        bucket = [create_test_record(sample_id="s001", feature_value=None, default_value_used=True)]
        session = wf.step1_import_bucket(session.session_id, bucket)
        negative = [create_test_record(sample_id="s001", feature_value=None, default_value_used=True, bucket_id="neg")]
        session = wf.step2_review_negatives(session.session_id, negative)
        for c in session.conflicts:
            session = wf.resolve_conflict(
                session.session_id, c.record_id, ConflictResolution.CONFIRM, "xiaomeng"
            )

        session = wf.step3_update_summary(session.session_id, "完成检查", reviewer="zhang_leader")

        store = UnifiedResultStore(session)
        all_recs = store.get_all_records_for_api()
        for rec in all_recs:
            if "默认分" in str(rec.get("是否使用了默认填充值", "")):
                assert rec["最终状态(英文)"] == "feature_missing_default"
                assert "推荐负责人复核完成" in rec["结果说明(可解释)"]
                assert "zhang_leader" in rec["结果说明(可解释)"]

    def test_summary_contains_consistency_note(self):
        wf = WorkflowManager()
        session = wf.create_session()
        bucket = [create_test_record(sample_id="s001")]
        session = wf.step1_import_bucket(session.session_id, bucket)
        store = UnifiedResultStore(session)
        summary = store.get_summary_data()

        assert "_data_consistency_note" in summary
        assert "三者读取同一数据源" in summary["_data_consistency_note"]
        assert "三个展示渠道完全对齐" in summary["_data_consistency_note"]
        assert "operation_log" in summary
        assert len(summary["operation_log"]) >= 2


class TestConflictDetection:
    def test_conflict_detection_no_false_on_step1_empty_negatives(self):
        bucket = [create_test_record(sample_id="s001")]
        negative = []
        conflicts = detect_conflicts(bucket, negative)
        assert len(conflicts) == 1
        assert "负样本列表缺失" in conflicts[0].description

    def test_conflict_default_value_mismatch_detected(self):
        bucket = [create_test_record(sample_id="s001", feature_value=0, default_value_used=True)]
        negative = [create_test_record(sample_id="s001", feature_value=0, default_value_used=False)]
        conflicts = detect_conflicts(bucket, negative)
        assert any("默认值使用不一致" in c.description for c in conflicts)


class TestHistoryTraceInExport:
    def test_each_status_change_has_timestamp_trigger(self):
        wf = WorkflowManager()
        session = wf.create_session()
        bucket = [create_test_record(sample_id="s001", hours_before_end=2)]
        session = wf.step1_import_bucket(session.session_id, bucket)

        raw_rec = session.bucket_records[0]
        assert len(raw_rec.status_history) >= 1
        first_change = raw_rec.status_history[0]
        assert first_change.event_time is not None
        assert first_change.to_status is not None
        assert first_change.triggered_by is not None
        assert first_change.trigger_step is not None
        assert first_change.parameter_version is not None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
