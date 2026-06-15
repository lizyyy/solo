import pytest
from datetime import datetime, timedelta
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
):
    window_end = datetime(2024, 1, 8, 0, 0, 0)
    window_start = datetime(2024, 1, 1, 0, 0, 0)
    feature_ts = window_end - timedelta(hours=hours_before_end)

    return FeatureRecord(
        feature_id=feature_id,
        feature_name="测试特征",
        bucket_id="test_bucket",
        sample_id=sample_id,
        feature_value=feature_value,
        default_value_used=default_value_used,
        time_window_start=window_start,
        time_window_end=window_end,
        feature_timestamp=feature_ts,
    )


class TestTimeLeakageDetection:
    def test_no_leakage_safe_gap(self):
        record = create_test_record(hours_before_end=48)
        params = CheckParameters(time_window_gap_hours=24)
        is_leakage, reason = detect_time_leakage(record, params)
        assert is_leakage is False
        assert "无时间窗穿越" in reason

    def test_leakage_within_safe_gap(self):
        record = create_test_record(hours_before_end=12)
        params = CheckParameters(time_window_gap_hours=24)
        is_leakage, reason = detect_time_leakage(record, params)
        assert is_leakage is True
        assert "小于安全间隔" in reason

    def test_leakage_after_window_end(self):
        record = create_test_record(hours_before_end=-2)
        params = CheckParameters(time_window_gap_hours=24)
        is_leakage, reason = detect_time_leakage(record, params)
        assert is_leakage is True
        assert "晚于窗口结束时间" in reason

    def test_no_timestamp_cannot_detect(self):
        record = create_test_record()
        record.feature_timestamp = None
        params = CheckParameters()
        is_leakage, reason = detect_time_leakage(record, params)
        assert is_leakage is False
        assert "无法检测" in reason


class TestConflictDetection:
    def test_no_conflicts_identical_records(self):
        bucket = [create_test_record(sample_id="s001", feature_value=100)]
        negative = [create_test_record(sample_id="s001", feature_value=100)]
        conflicts = detect_conflicts(bucket, negative)
        assert len(conflicts) == 0

    def test_conflict_different_values(self):
        bucket = [create_test_record(sample_id="s001", feature_value=100)]
        negative = [create_test_record(sample_id="s001", feature_value=200)]
        conflicts = detect_conflicts(bucket, negative)
        assert len(conflicts) == 1
        assert "特征值不一致" in conflicts[0].description

    def test_conflict_bucket_missing(self):
        bucket = []
        negative = [create_test_record(sample_id="s001")]
        conflicts = detect_conflicts(bucket, negative)
        assert len(conflicts) == 1
        assert "线上实验桶缺失" in conflicts[0].description

    def test_conflict_negative_missing(self):
        bucket = [create_test_record(sample_id="s001")]
        negative = []
        conflicts = detect_conflicts(bucket, negative)
        assert len(conflicts) == 1
        assert "负样本列表缺失" in conflicts[0].description

    def test_conflict_default_value_mismatch(self):
        bucket = [create_test_record(sample_id="s001", feature_value=0, default_value_used=True)]
        negative = [create_test_record(sample_id="s001", feature_value=0, default_value_used=False)]
        conflicts = detect_conflicts(bucket, negative)
        assert any("默认值使用不一致" in c.description for c in conflicts)


class TestRecordProcessing:
    def test_feature_missing_default_sets_pending_review(self):
        record = create_test_record(feature_value=None, default_value_used=True)
        params = CheckParameters()
        result = process_record_status(record, params)
        assert result.status == RecordStatus.FEATURE_MISSING_DEFAULT
        assert "默认分填充" in result.result_explanation
        assert "参数版本" in result.result_explanation

    def test_normal_record_no_leakage(self):
        record = create_test_record(hours_before_end=48)
        params = CheckParameters()
        result = process_record_status(record, params)
        assert result.status == RecordStatus.NORMAL
        assert result.is_leakage is False

    def test_abnormal_record_with_leakage(self):
        record = create_test_record(hours_before_end=12)
        params = CheckParameters(time_window_gap_hours=24)
        result = process_record_status(record, params)
        assert result.status == RecordStatus.ABNORMAL
        assert result.is_leakage is True


class TestSelfCheck:
    def test_duplicate_imports_detected(self):
        records = [
            create_test_record(sample_id="s001", feature_id="f001"),
            create_test_record(sample_id="s001", feature_id="f001"),
        ]
        result = check_duplicate_imports(records)
        assert result.passed is False
        assert result.found_issues == 1

    def test_no_duplicates_passes(self):
        records = [
            create_test_record(sample_id="s001", feature_id="f001"),
            create_test_record(sample_id="s002", feature_id="f001"),
        ]
        result = check_duplicate_imports(records)
        assert result.passed is True
        assert result.found_issues == 0

    def test_feature_missing_default_detected(self):
        records = [
            create_test_record(feature_value=None, default_value_used=True),
        ]
        records[0].status = RecordStatus.FEATURE_MISSING_DEFAULT
        result = check_feature_missing_default(records)
        assert result.passed is False
        assert result.found_issues == 1
        assert "推荐负责人复核" in result.details

    def test_export_consistency_matching(self):
        data = [{"sample_id": "s001", "value": 100}]
        result = check_export_consistency(data, data, data)
        assert result.passed is True

    def test_export_consistency_mismatched_length(self):
        page = [{"a": 1}, {"b": 2}]
        api = [{"a": 1}]
        detail = [{"a": 1}]
        result = check_export_consistency(page, api, detail)
        assert result.passed is False
        assert "条数不一致" in result.details

    def test_resupplement_not_updated_detected(self):
        original = [create_test_record(sample_id="s001", feature_value=None, default_value_used=True)]
        original[0].status = RecordStatus.FEATURE_MISSING_DEFAULT
        resupplemented = [create_test_record(sample_id="s001", feature_value=None, default_value_used=True)]
        resupplemented[0].status = RecordStatus.FEATURE_MISSING_DEFAULT
        result = check_resupplement_recalculation(original, resupplemented)
        assert result.passed is False


class TestWorkflow:
    def test_full_three_step_workflow(self):
        wf = WorkflowManager()
        session = wf.create_session("xiaomeng")
        assert session.current_step == CheckStep.STEP1_IMPORT
        assert session.created_by == "xiaomeng"

        bucket_records = [
            create_test_record(sample_id="s001", hours_before_end=48),
            create_test_record(sample_id="s002", feature_value=None, default_value_used=True),
        ]
        session = wf.step1_import_bucket(session.session_id, bucket_records)

        assert len(session.bucket_records) == 2
        pending_count = sum(1 for r in session.bucket_records if r.status == RecordStatus.PENDING_REVIEW)
        assert pending_count == 1
        assert len(session.self_check_results) > 0

        negative_records = [
            create_test_record(sample_id="s001", hours_before_end=48, feature_value=150),
        ]
        session = wf.step2_review_negatives(session.session_id, negative_records)
        assert session.current_step == CheckStep.STEP2_REVIEW_NEGATIVES
        assert len(session.conflicts) >= 1

        for conflict in session.conflicts:
            session = wf.resolve_conflict(
                session.session_id,
                conflict.record_id,
                ConflictResolution.CONFIRM,
                "xiaomeng",
            )

        session = wf.step3_update_summary(
            session.session_id,
            "检查完成，无重大问题",
            reviewer="zhang_leader",
        )
        assert session.current_step == CheckStep.STEP3_UPDATE_SUMMARY
        assert session.is_locked is True
        assert session.reviewer == "zhang_leader"

    def test_conflict_not_resolved_blocks_step3(self):
        wf = WorkflowManager()
        session = wf.create_session()

        bucket = [create_test_record(sample_id="s001", feature_value=100)]
        session = wf.step1_import_bucket(session.session_id, bucket)

        negative = [create_test_record(sample_id="s001", feature_value=200)]
        session = wf.step2_review_negatives(session.session_id, negative)

        with pytest.raises(ValueError, match="冲突未解决"):
            wf.step3_update_summary(session.session_id, "summary")

    def test_feature_missing_requires_reviewer(self):
        wf = WorkflowManager()
        session = wf.create_session()

        bucket = [create_test_record(sample_id="s001", feature_value=None, default_value_used=True)]
        session = wf.step1_import_bucket(session.session_id, bucket)

        negative = [create_test_record(sample_id="s001", feature_value=None, default_value_used=True)]
        session = wf.step2_review_negatives(session.session_id, negative)

        for conflict in session.conflicts:
            session = wf.resolve_conflict(
                session.session_id,
                conflict.record_id,
                ConflictResolution.CONFIRM,
                "xiaomeng",
            )

        with pytest.raises(ValueError, match="待推荐负责人复核"):
            wf.step3_update_summary(session.session_id, "summary", reviewer=None)


class TestUnifiedResultStore:
    def test_all_channels_same_data(self):
        wf = WorkflowManager()
        session = wf.create_session()
        records = [create_test_record(sample_id="s001")]
        session = wf.step1_import_bucket(session.session_id, records)

        store = UnifiedResultStore(session)

        page_data = store.get_all_records_for_page()
        api_data = store.get_all_records_for_api()
        export_data = store.get_all_records_for_export()

        assert len(page_data) == len(api_data) == len(export_data)
        assert page_data == api_data == export_data

    def test_conflicts_all_channels_same(self):
        wf = WorkflowManager()
        session = wf.create_session()

        bucket = [create_test_record(sample_id="s001", feature_value=100)]
        session = wf.step1_import_bucket(session.session_id, bucket)

        negative = [create_test_record(sample_id="s001", feature_value=200)]
        session = wf.step2_review_negatives(session.session_id, negative)

        store = UnifiedResultStore(session)

        page_conflicts = store.get_conflicts_for_page()
        api_conflicts = store.get_conflicts_for_api()
        export_conflicts = store.get_conflicts_for_export()

        assert page_conflicts == api_conflicts == export_conflicts

    def test_summary_includes_parameters_with_rationale(self):
        wf = WorkflowManager()
        session = wf.create_session()
        params = CheckParameters(
            parameter_version="v2.0",
            rationale="新版本参数，优化了时间窗口算法",
        )
        records = [create_test_record()]
        session = wf.step1_import_bucket(session.session_id, records, params)

        store = UnifiedResultStore(session)
        summary = store.get_summary_data()

        assert summary["parameters"]["parameter_version"] == "v2.0"
        assert "优化了时间窗口算法" in summary["parameters"]["rationale"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
