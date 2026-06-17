from datetime import datetime, timedelta

from tower_warning.models import Evidence, EvidenceType, RecordInput, RemarkInput, ReportStatus, SamplePoint
from tower_warning.service import WarningService, build_demo_service


def points(values: list[float], start: datetime | None = None) -> list[SamplePoint]:
    base = start or datetime(2026, 6, 8, 9, 0)
    return [SamplePoint(at=base + timedelta(minutes=index), value=value) for index, value in enumerate(values)]


def test_unit_mismatch_is_kept_as_blocked_record() -> None:
    service = WarningService()

    record = service.analyze(
        RecordInput(
            record_id="WB-X",
            crane_id="TD-X",
            work_date=datetime(2026, 6, 8, 9, 0),
            unit="ton",
            expected_unit="MPa",
            threshold=0.8,
            samples=points([1.0, 1.1]),
        )
    )

    assert record.status == ReportStatus.BLOCKED
    assert record.block_reason == "unit"
    assert "单位" in record.conclusion
    assert service.get_record("WB-X").record_id == "WB-X"


def test_masked_peak_requires_photo_before_release() -> None:
    service = WarningService()
    record = service.analyze(
        RecordInput(
            record_id="WB-M",
            crane_id="TD-M",
            work_date=datetime(2026, 6, 8, 9, 0),
            unit="MPa",
            expected_unit="MPa",
            threshold=80,
            expected_sample_count=6,
            samples=points([65, 70, 92, 69, 71, 72]),
        )
    )

    assert record.status == ReportStatus.SUSPENDED
    assert record.issues[0].issue_type == "masked_by_average"

    updated = service.add_evidence(
        "WB-M",
        Evidence(
            evidence_id="P-1",
            record_id="WB-M",
            evidence_type=EvidenceType.REPAIR_PHOTO,
            version="v1",
            anomaly_link="峰值 92 与维修照片对应",
            summary="照片说明峰值为启动尖峰",
        ),
    )

    assert updated.status == ReportStatus.READY
    assert "证据链" in updated.conclusion


def test_sampling_gap_creates_single_issue_packet() -> None:
    service = WarningService()
    record = service.analyze(
        RecordInput(
            record_id="WB-G",
            crane_id="TD-G",
            work_date=datetime(2026, 6, 8, 9, 0),
            unit="MPa",
            expected_unit="MPa",
            threshold=0.5,
            expected_sample_count=60,
            samples=points([0.3] * 20),
        )
    )

    assert record.status == ReportStatus.SUSPENDED
    assert record.block_reason == "sampling_gap"
    assert record.issues[0].source == "采样明细数量与预期数量对比"
    assert "复采" in record.action_for_assistant


def test_backfill_remark_records_export_delta() -> None:
    service = build_demo_service()
    before = service.export_preview("WB-004")

    delta = service.add_remark("WB-004", RemarkInput(text="二次复核：照片与峰值时间仍一致。"))

    assert delta.before == before
    assert "remark_count" in delta.changed_fields
    assert "导出" in delta.explanation
    assert service.export_preview("WB-004")["remark_count"] == "2"


def test_dashboards_show_assistant_and_supervisor_views() -> None:
    service = build_demo_service()

    worklist = service.assistant_worklist()
    dashboard = service.supervisor_dashboard()

    assert any(row["record_id"] == "WB-002" and row["can_export"] == "no" for row in worklist)
    assert dashboard.total == 4
    assert dashboard.ready >= 2
    assert any(item["record_id"] == "WB-003" for item in dashboard.missing_evidence)
