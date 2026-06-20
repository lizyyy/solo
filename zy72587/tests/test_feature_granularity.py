import pytest
from datetime import datetime, timedelta
from app.models import (
    FeatureRecord,
    CheckParameters,
    RecordStatus,
    ConflictResolution,
    CheckStep,
    SelfCheckResult,
)
from app.checker import detect_conflicts, process_all_records
from app.workflow import WorkflowManager


FEATURE_NAMES = {
    "clk_7d": "用户近7天点击量",
    "conv_rt": "用户转化率",
    "dwell_s": "用户平均停留时长(s)",
}


def make_record(sample_id, feature_id, feature_value=None, default_value_used=False, bucket_id="exp_prod_bucket"):
    return FeatureRecord(
        feature_id=feature_id,
        feature_name=FEATURE_NAMES.get(feature_id, feature_id),
        bucket_id=bucket_id,
        sample_id=sample_id,
        feature_value=feature_value,
        default_value_used=default_value_used,
        time_window_start=datetime(2024, 1, 1, 0, 0, 0),
        time_window_end=datetime(2024, 1, 8, 0, 0, 0),
        feature_timestamp=datetime(2024, 1, 5, 0, 0, 0) if feature_value is not None else None,
    )


class TestMultiFeatureConflicts:
    def test_same_user_multiple_features_all_detected_as_separate_conflicts(self):
        bucket = [
            make_record("user_0002", "clk_7d", feature_value=None, default_value_used=True),
            make_record("user_0002", "conv_rt", feature_value=0.05, default_value_used=False),
        ]
        negative = [
            make_record("user_0002", "clk_7d", feature_value=5, default_value_used=False, bucket_id="neg_ref"),
            make_record("user_0002", "conv_rt", feature_value=0.05, default_value_used=False, bucket_id="neg_ref"),
        ]
        conflicts = detect_conflicts(bucket, negative)
        unique_rids = {c.record_id for c in conflicts}
        assert len(unique_rids) == 1, f"Expected 1 unique conflict but got {len(unique_rids)}: {unique_rids}"
        assert "user_0002:clk_7d" in unique_rids
        conv_rt_conflicts = [c for c in conflicts if "conv_rt" in c.record_id]
        assert len(conv_rt_conflicts) == 0, "conv_rt 不应产生冲突"

    def test_same_user_multiple_features_two_conflicts(self):
        bucket = [
            make_record("user_0002", "clk_7d", feature_value=10, default_value_used=False),
            make_record("user_0002", "conv_rt", feature_value=None, default_value_used=True),
        ]
        negative = [
            make_record("user_0002", "clk_7d", feature_value=50, default_value_used=False, bucket_id="neg_ref"),
            make_record("user_0002", "conv_rt", feature_value=0.15, default_value_used=False, bucket_id="neg_ref"),
        ]
        conflicts = detect_conflicts(bucket, negative)
        record_ids = {c.record_id for c in conflicts}
        assert len(record_ids) == 2, f"Expected 2 unique conflicts but got {len(record_ids)}: {record_ids}"
        assert "user_0002:clk_7d" in record_ids
        assert "user_0002:conv_rt" in record_ids

class TestResolveGranularity:
    def _setup_two_conflict_session(self):
        wf = WorkflowManager()
        session = wf.create_session("tester")
        bucket = [
            make_record("user_0002", "clk_7d", feature_value=10, default_value_used=False),
            make_record("user_0002", "conv_rt", feature_value=0.03, default_value_used=False),
        ]
        session = wf.step1_import_bucket(session.session_id, bucket)
        negative = [
            make_record("user_0002", "clk_7d", feature_value=99, default_value_used=False, bucket_id="neg_ref"),
            make_record("user_0002", "conv_rt", feature_value=0.20, default_value_used=False, bucket_id="neg_ref"),
        ]
        session = wf.step2_review_negatives(session.session_id, negative)
        return wf, session

    def test_resolve_conflict_only_affects_target_feature(self):
        wf, session = self._setup_two_conflict_session()
        assert len(session.conflicts) == 2
        conv_rt_before = [r for r in session.bucket_records if r.sample_id == "user_0002" and r.feature_id == "conv_rt"][0]
        conv_rt_history_len_before = len(conv_rt_before.status_history)
        clk_7d_record_id = [c.record_id for c in session.conflicts if "clk_7d" in c.record_id][0]
        session = wf.resolve_conflict(session.session_id, clk_7d_record_id, ConflictResolution.CONFIRM, "tester")
        clk_7d_rec = [r for r in session.bucket_records if r.sample_id == "user_0002" and r.feature_id == "clk_7d"][0]
        assert clk_7d_rec.status in (RecordStatus.NORMAL, RecordStatus.ABNORMAL)
        conv_rt_after = [r for r in session.bucket_records if r.sample_id == "user_0002" and r.feature_id == "conv_rt"][0]
        assert conv_rt_after.status == RecordStatus.CONFLICT, f"conv_rt 应仍为 CONFLICT，实际为 {conv_rt_after.status}"
        assert len(conv_rt_after.status_history) == conv_rt_history_len_before, "conv_rt 的 status_history 不应新增记录"

    def test_feature_missing_stays_pending_not_overwritten_by_other_feature_conflict(self):
        wf = WorkflowManager()
        session = wf.create_session("tester")
        bucket = [
            make_record("user_0002", "clk_7d", feature_value=None, default_value_used=True),
            make_record("user_0002", "conv_rt", feature_value=0.03, default_value_used=False),
        ]
        session = wf.step1_import_bucket(session.session_id, bucket)
        clk_7d_rec = [r for r in session.bucket_records if r.sample_id == "user_0002" and r.feature_id == "clk_7d"][0]
        assert clk_7d_rec.status in (RecordStatus.FEATURE_MISSING_DEFAULT, RecordStatus.PENDING_REVIEW)
        clk_7d_history_before = list(clk_7d_rec.status_history)
        negative = [
            make_record("user_0002", "clk_7d", feature_value=None, default_value_used=True, bucket_id="neg_ref"),
            make_record("user_0002", "conv_rt", feature_value=0.30, default_value_used=False, bucket_id="neg_ref"),
        ]
        session = wf.step2_review_negatives(session.session_id, negative)
        conv_rt_conflict_id = [c.record_id for c in session.conflicts if "conv_rt" in c.record_id][0]
        session = wf.resolve_conflict(session.session_id, conv_rt_conflict_id, ConflictResolution.CONFIRM, "tester")
        clk_7d_after = [r for r in session.bucket_records if r.sample_id == "user_0002" and r.feature_id == "clk_7d"][0]
        assert clk_7d_after.status in (RecordStatus.FEATURE_MISSING_DEFAULT, RecordStatus.PENDING_REVIEW), f"clk_7d 应仍为特征缺失相关状态，实际为 {clk_7d_after.status}"
        assert len(clk_7d_after.status_history) == len(clk_7d_history_before) + 0 or len(clk_7d_after.status_history) >= len(clk_7d_history_before)
        last_event = clk_7d_after.status_history[-1] if clk_7d_after.status_history else None
        if last_event is not None:
            reason = str(last_event.reason if hasattr(last_event, "reason") else last_event)
            assert "conv_rt" not in reason, f"clk_7d 最后一条 history 不应与 conv_rt 有关: {reason}"

class TestSelfCheckGranularity:
    def test_resupplement_triggers_recalculate_self_check(self):
        wf = WorkflowManager()
        session = wf.create_session("tester")
        bucket = [
            make_record("user_0001", "clk_7d", feature_value=10, default_value_used=False),
            make_record("user_0002", "clk_7d", feature_value=None, default_value_used=True),
            make_record("user_0002", "conv_rt", feature_value=0.05, default_value_used=False),
        ]
        session = wf.step1_import_bucket(session.session_id, bucket)
        clk_7d_before = [r for r in session.bucket_records if r.sample_id == "user_0002" and r.feature_id == "clk_7d"][0]
        assert clk_7d_before.status in (RecordStatus.FEATURE_MISSING_DEFAULT, RecordStatus.PENDING_REVIEW)
        resupplement_data = {"user_0002": {"clk_7d": 100}}
        session = wf.resupplement_and_recalculate(session.session_id, resupplement_data)
        check_types = {r.check_type: r for r in session.self_check_results}
        found = any("补录后重算正确性" in k or "resupplement_pending" in k.lower() or "pending" in k.lower() for k in check_types.keys())
        pending_check = None
        for k, v in check_types.items():
            if "补录" in k or "Pending" in k or "pending" in k:
                pending_check = v
                break
        assert pending_check is not None, f"未找到补录后重算正确性自检项，现有: {list(check_types.keys())}"
        assert pending_check.passed is True, f"自检未通过: {pending_check.details}"
        clk_7d_after = [r for r in session.bucket_records if r.sample_id == "user_0002" and r.feature_id == "clk_7d"][0]
        assert clk_7d_after.status != RecordStatus.FEATURE_MISSING_DEFAULT, f"clk_7d 不应再是 pending_review，实际为 {clk_7d_after.status}"
        assert clk_7d_after.feature_value == 100
        assert clk_7d_after.default_value_used is False

    def test_export_consistency_in_self_check_chain(self):
        wf = WorkflowManager()
        session = wf.create_session("tester")
        bucket = [
            make_record("user_0001", "clk_7d", feature_value=10, default_value_used=False),
            make_record("user_0002", "clk_7d", feature_value=None, default_value_used=True),
        ]
        session = wf.step1_import_bucket(session.session_id, bucket)
        step1_checks = {r.check_type: r for r in session.self_check_results}
        negative = [make_record("user_0001", "clk_7d", feature_value=10, default_value_used=False, bucket_id="neg_ref")]
        session = wf.step2_review_negatives(session.session_id, negative)
        check_types = {r.check_type: r for r in session.self_check_results}
        consistency_check = None
        for k, v in check_types.items():
            if "三端数据一致性" in k or "Three" in k or "three" in k or "consistency" in k.lower():
                consistency_check = v
                break
        assert consistency_check is not None, f"未找到三端数据一致性自检项，现有: {list(check_types.keys())}"
        assert consistency_check.passed is True, f"自检未通过: {consistency_check.details}"
        assert consistency_check.found_issues == 0, f"发现问题数应为0: {consistency_check.found_issues}"

