import pytest
from chemistry_demo import (
    ChemistryDemoProcessor,
    Record,
    RecordType,
    AnomalyType,
    Severity,
    load_records,
)


def _make_record(**overrides) -> Record:
    defaults = dict(
        id="T001",
        session_id="SES-TEST",
        step_index=1,
        step_name="测试步骤",
        timestamp="2026-05-31 10:00:00",
        operator="测试员",
        instrument="试管",
        action="inspect",
        record_type=RecordType.NORMAL,
        state_before={},
        state_after={},
    )
    defaults.update(overrides)
    return Record(**defaults)


class TestDeduplicate:
    def test_removes_explicit_duplicate_type(self):
        r1 = _make_record(id="A1", step_index=1, action="inspect")
        r2 = _make_record(id="A2", step_index=1, action="inspect", record_type=RecordType.DUPLICATE, is_duplicate_of="A1")
        p = ChemistryDemoProcessor()
        result = p.deduplicate([r1, r2])
        assert len(result) == 1
        assert result[0].id == "A1"
        assert any("重复项" in e.detail for e in p.audit_trail)

    def test_removes_content_duplicate(self):
        r1 = _make_record(id="B1", step_index=1, action="inspect", timestamp="2026-05-31 10:00:00")
        r2 = _make_record(id="B2", step_index=1, action="inspect", timestamp="2026-05-31 10:00:00")
        p = ChemistryDemoProcessor()
        result = p.deduplicate([r1, r2])
        assert len(result) == 1
        assert any("完全一致" in e.detail for e in p.audit_trail)

    def test_keeps_different_records(self):
        r1 = _make_record(id="C1", step_index=1, action="inspect")
        r2 = _make_record(id="C2", step_index=2, action="drag")
        p = ChemistryDemoProcessor()
        result = p.deduplicate([r1, r2])
        assert len(result) == 2


class TestMergeLateAttachments:
    def test_merges_to_parent(self):
        r1 = _make_record(id="D1", step_index=1, action="inspect", attachment_url="")
        r2 = _make_record(id="D2", step_index=1, action="drag", record_type=RecordType.LATE_ATTACHMENT,
                          is_duplicate_of="D1", attachment_url="https://example.com/photo.jpg")
        p = ChemistryDemoProcessor()
        result = p.merge_late_attachments([r1, r2])
        assert result[0].attachment_url == "https://example.com/photo.jpg"
        assert any("晚到附件已合并" in e.detail for e in p.audit_trail)

    def test_orphan_late_attachment_kept(self):
        r1 = _make_record(id="E1", step_index=1, action="inspect")
        r2 = _make_record(id="E2", step_index=1, action="drag", record_type=RecordType.LATE_ATTACHMENT,
                          is_duplicate_of="MISSING", attachment_url="https://example.com/orphan.jpg")
        p = ChemistryDemoProcessor()
        p.merge_late_attachments([r1, r2])
        assert any("未找到对应主记录" in e.detail for e in p.audit_trail)


class TestManualCorrections:
    def test_applies_correction(self):
        r1 = _make_record(id="F1", step_index=1, action="inspect",
                          state_after={"duration_sec": 15})
        r2 = _make_record(id="F2", step_index=1, action="inspect",
                          record_type=RecordType.MANUAL_CORRECTION,
                          is_duplicate_of="F1",
                          correction_note="时长修正",
                          state_after={"duration_sec": 20},
                          metadata={"target_id": "F1"})
        p = ChemistryDemoProcessor()
        result = p.apply_manual_corrections([r1, r2])
        corrected = [r for r in result if r.id == "F1"][0]
        assert corrected.state_after["duration_sec"] == 20
        assert any("人工更正" in e.operation for e in p.audit_trail)

    def test_correction_logs_before_state(self):
        r1 = _make_record(id="G1", state_after={"val": "old"})
        r2 = _make_record(id="G2", record_type=RecordType.MANUAL_CORRECTION,
                          is_duplicate_of="G1", correction_note="修正",
                          state_after={"val": "new"})
        p = ChemistryDemoProcessor()
        p.apply_manual_corrections([r1, r2])
        entry = [e for e in p.audit_trail if e.operation == "人工更正"][0]
        assert "old" in entry.detail


class TestDetectAnomalies:
    def test_view_reset(self):
        r = _make_record(action="reset_view",
                         state_before={"view_angle": "侧视45度"},
                         state_after={"view_angle": "正视0度"})
        p = ChemistryDemoProcessor()
        results = p.detect_anomalies([r])
        assert len(results) == 1
        assert results[0].anomaly_type == AnomalyType.VIEW_RESET
        assert results[0].severity == Severity.PENDING_CONFIRMATION
        assert "视角重置" in results[0].reason
        assert results[0].next_step != ""

    def test_step_skipped(self):
        r = _make_record(action="skip_step", step_index=5, step_name="某步骤")
        p = ChemistryDemoProcessor()
        results = p.detect_anomalies([r])
        assert len(results) == 1
        assert results[0].anomaly_type == AnomalyType.STEP_SKIPPED
        assert results[0].severity == Severity.PENDING_CONFIRMATION

    def test_drag_state_lost(self):
        r = _make_record(action="drag",
                         state_before={"instrument_position": "架子-第2层"},
                         state_after={"instrument_position": "", "drag_committed": False})
        p = ChemistryDemoProcessor()
        results = p.detect_anomalies([r])
        assert len(results) == 1
        assert results[0].anomaly_type == AnomalyType.DRAG_STATE_LOST
        assert results[0].severity == Severity.PENDING_CONFIRMATION

    def test_normal_drag_not_flagged(self):
        r = _make_record(action="drag",
                         state_before={"instrument_position": "架子"},
                         state_after={"instrument_position": "实验台", "drag_committed": True})
        p = ChemistryDemoProcessor()
        results = p.detect_anomalies([r])
        assert len(results) == 0

    def test_expected_step_missing(self):
        r = _make_record(step_index=1, action="inspect")
        p = ChemistryDemoProcessor()
        results = p.detect_anomalies([r], expected_steps=["步骤1", "步骤2", "步骤3"])
        assert any(a.anomaly_type == AnomalyType.STEP_SKIPPED for a in results)

    def test_normal_record_no_anomaly(self):
        r = _make_record(action="inspect", step_index=1,
                         state_before={"status": "未检查"},
                         state_after={"status": "已检查"})
        p = ChemistryDemoProcessor()
        results = p.detect_anomalies([r])
        assert len(results) == 0


class TestFullPipeline:
    def test_sample_data(self):
        import pathlib
        sample = pathlib.Path(__file__).parent / "sample_data.json"
        if not sample.exists():
            pytest.skip("sample_data.json not found")
        records = load_records(str(sample))
        p = ChemistryDemoProcessor()
        report = p.process(records, expected_steps=[
            "检查护目镜", "取用烧杯", "量取盐酸",
            "倾倒试剂", "搅拌混合", "观察反应",
            "记录实验结果", "清理实验台",
        ])
        text = report.to_text()
        assert "化学仪器安全演示" in text
        assert "待确认" in text
        assert report.total_records > 0
        assert report.pending_confirmation_count > 0
        assert len(report.audit_trail) > 0
        assert "处理留痕" in text
        for a in report.pending_items:
            assert a.reason != ""
            assert a.next_step != ""
