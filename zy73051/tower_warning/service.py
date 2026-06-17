from __future__ import annotations

from datetime import datetime, timedelta
from statistics import mean

from .models import (
    BlockReason,
    DashboardSummary,
    Evidence,
    EvidenceType,
    ExportDelta,
    IssuePacket,
    MaintenanceRecord,
    RecordInput,
    RemarkInput,
    ReportStatus,
    SamplePoint,
)


class WarningService:
    def __init__(self) -> None:
        self.records: dict[str, MaintenanceRecord] = {}
        self.export_deltas: list[ExportDelta] = []

    def analyze(self, payload: RecordInput) -> MaintenanceRecord:
        record = MaintenanceRecord(**payload.model_dump())
        self._evaluate(record)
        self.records[record.record_id] = record
        return record

    def list_records(self) -> list[MaintenanceRecord]:
        return sorted(self.records.values(), key=lambda row: row.record_id)

    def get_record(self, record_id: str) -> MaintenanceRecord:
        try:
            return self.records[record_id]
        except KeyError as exc:
            raise KeyError(f"record not found: {record_id}") from exc

    def add_evidence(self, record_id: str, evidence: Evidence) -> MaintenanceRecord:
        record = self.get_record(record_id)
        if evidence.record_id != record_id:
            raise ValueError("evidence record_id does not match path record_id")

        if evidence.is_latest:
            for existing in record.evidence:
                if existing.evidence_type == evidence.evidence_type and existing.anomaly_link == evidence.anomaly_link:
                    existing.is_latest = False

        record.evidence.append(evidence)
        self._evaluate(record)
        return record

    def add_remark(self, record_id: str, remark: RemarkInput) -> ExportDelta:
        record = self.get_record(record_id)
        before = self.export_preview(record_id)

        evidence = Evidence(
            evidence_id=remark.evidence_id or f"remark-{len(record.remarks) + 1:03d}",
            record_id=record_id,
            evidence_type=EvidenceType.BACKFILL_REMARK,
            version=f"v{len(record.evidence) + 1}",
            anomaly_link=remark.anomaly_link,
            summary=remark.text,
            is_latest=True,
            is_backfill=True,
        )
        record.remarks.append(remark.text)
        record.evidence.append(evidence)
        self._evaluate(record)

        after = self.export_preview(record_id)
        changed = [key for key in after if before.get(key) != after.get(key)]
        delta = ExportDelta(
            record_id=record_id,
            before=before,
            after=after,
            changed_fields=changed,
            explanation=self._delta_explanation(record, changed),
        )
        self.export_deltas.append(delta)
        return delta

    def assistant_worklist(self) -> list[dict[str, str]]:
        rows: list[dict[str, str]] = []
        for record in self.list_records():
            rows.append(
                {
                    "record_id": record.record_id,
                    "crane_id": record.crane_id,
                    "status": record.status.value,
                    "action": record.action_for_assistant,
                    "can_export": "yes" if record.status == ReportStatus.READY else "no",
                }
            )
        return rows

    def supervisor_dashboard(self) -> DashboardSummary:
        records = self.list_records()
        missing: list[dict[str, str]] = []
        for record in records:
            if record.status in {ReportStatus.BLOCKED, ReportStatus.SUSPENDED}:
                missing.append(
                    {
                        "record_id": record.record_id,
                        "crane_id": record.crane_id,
                        "gap": record.action_for_assistant,
                        "source": "; ".join(issue.source for issue in record.issues) or "record fields",
                    }
                )
        return DashboardSummary(
            total=len(records),
            ready=sum(row.status == ReportStatus.READY for row in records),
            suspended=sum(row.status == ReportStatus.SUSPENDED for row in records),
            blocked=sum(row.status == ReportStatus.BLOCKED for row in records),
            missing_evidence=missing,
        )

    def export_preview(self, record_id: str) -> dict[str, str]:
        record = self.get_record(record_id)
        latest_evidence = [item for item in record.evidence if item.is_latest]
        return {
            "record_id": record.record_id,
            "crane_id": record.crane_id,
            "report_status": record.status.value,
            "conclusion": record.conclusion,
            "evidence_chain": f"{len(record.evidence)} total / {len(latest_evidence)} latest",
            "assistant_action": record.action_for_assistant,
            "remark_count": str(len(record.remarks)),
        }

    def _evaluate(self, record: MaintenanceRecord) -> None:
        record.issues.clear()
        record.block_reason = None

        if record.threshold is None:
            self._block(record, BlockReason.THRESHOLD, "缺少阈值，不能判断是否超限", "主记录阈值字段为空", "补齐本设备当日阈值")
            return
        if record.unit != record.expected_unit:
            self._block(record, BlockReason.UNIT, "采样单位和阈值单位不一致", f"{record.unit} != {record.expected_unit}", "确认单位换算或重传同单位数据")
            return
        if record.formula is None:
            self._block(record, BlockReason.FORMULA, "计算公式未配置", "公式字段为空", "补齐平均值或实际采样点数公式")
            return

        valid_samples = [point.value for point in record.samples if not point.missing]
        if not valid_samples:
            self._block(record, BlockReason.SAMPLING_GAP, "没有有效采样点", "采样明细为空", "补传原始采样明细")
            return

        record.average_value = round(mean(valid_samples), 3)
        record.peak_value = max(valid_samples)

        valid_ratio = len(valid_samples) / max(record.expected_sample_count, 1)
        if valid_ratio < 0.5:
            self._suspend_for_sampling_gap(record, valid_ratio)
            return

        masked = record.average_value <= record.threshold < record.peak_value
        if masked and not self._has_repair_photo_for_masked_peak(record):
            record.status = ReportStatus.SUSPENDED
            record.conclusion = "峰值超阈值但平均值正常，需照片或现场说明确认"
            record.action_for_assistant = "补维修照片或现场说明，说明峰值时刻是否真实异常"
            record.issues.append(
                IssuePacket(
                    issue_type="masked_by_average",
                    suspicion=f"平均值 {record.average_value} 未超阈值 {record.threshold}，但峰值 {record.peak_value} 已超阈值",
                    source="采样明细与阈值计算",
                    hold_reason="缺少峰值时刻的维修照片或现场备注，不能直接放行",
                    required_materials=["峰值时刻维修照片", "塔吊编号和时间戳说明", "维修队现场结论"],
                    priority="high",
                )
            )
            return

        record.status = ReportStatus.READY
        if record.peak_value > record.threshold:
            record.conclusion = "峰值已解释，证据链满足放行条件"
            record.action_for_assistant = "可放行，导出前复核最新照片和补录备注"
        else:
            record.conclusion = "采样完整且未超阈值"
            record.action_for_assistant = "可放行，提交导出"

    def _block(self, record: MaintenanceRecord, reason: BlockReason, suspicion: str, source: str, material: str) -> None:
        record.status = ReportStatus.BLOCKED
        record.block_reason = reason
        record.conclusion = f"算不出：{suspicion}"
        record.action_for_assistant = material
        record.issues.append(
            IssuePacket(
                issue_type=reason,
                suspicion=suspicion,
                source=source,
                hold_reason="基础计算条件不完整，保留记录但不进入最终报告",
                required_materials=[material],
                priority="high",
            )
        )

    def _suspend_for_sampling_gap(self, record: MaintenanceRecord, valid_ratio: float) -> None:
        record.status = ReportStatus.SUSPENDED
        record.block_reason = BlockReason.SAMPLING_GAP
        missing = record.expected_sample_count - len([point for point in record.samples if not point.missing])
        record.conclusion = "采样断档，暂缓报告"
        record.action_for_assistant = "安排复采并补传断档时段来源说明"
        record.issues.append(
            IssuePacket(
                issue_type=BlockReason.SAMPLING_GAP,
                suspicion=f"有效采样占比 {valid_ratio:.0%}，缺 {missing} 个点，平均值不能代表全天风险",
                source="采样明细数量与预期数量对比",
                hold_reason="断档期间可能包含被平均值盖住的异常，不能直接导出最终报告",
                required_materials=["复采数据", "断档时段现场照片", "传感器离线原因说明"],
                priority="high",
            )
        )

    def _has_repair_photo_for_masked_peak(self, record: MaintenanceRecord) -> bool:
        for item in record.evidence:
            if item.is_latest and item.evidence_type == EvidenceType.REPAIR_PHOTO and "峰值" in item.anomaly_link:
                return True
        return False

    def _delta_explanation(self, record: MaintenanceRecord, changed: list[str]) -> str:
        if not changed:
            return "补录备注已留痕，本次导出字段未变化"
        fields = "、".join(changed)
        return f"补录备注已进入证据历史，导出中的 {fields} 发生变化；当前处理建议：{record.action_for_assistant}"


def build_demo_service() -> WarningService:
    service = WarningService()
    base_time = datetime(2026, 6, 8, 9, 0)

    service.analyze(
        RecordInput(
            record_id="WB-001",
            crane_id="TD-A01",
            work_date=base_time,
            unit="MPa",
            expected_unit="MPa",
            threshold=0.8,
            samples=[SamplePoint(at=base_time + timedelta(minutes=i), value=0.42 + (i % 4) * 0.03) for i in range(60)],
        )
    )
    service.analyze(
        RecordInput(
            record_id="WB-002",
            crane_id="TD-B03",
            work_date=base_time,
            unit="ton",
            expected_unit="MPa",
            threshold=0.8,
            samples=[SamplePoint(at=base_time, value=15.2)],
        )
    )
    service.analyze(
        RecordInput(
            record_id="WB-003",
            crane_id="TD-C07",
            work_date=base_time,
            unit="MPa",
            expected_unit="MPa",
            threshold=0.5,
            expected_sample_count=60,
            samples=[SamplePoint(at=base_time + timedelta(minutes=i), value=0.35 + (i % 3) * 0.04) for i in range(18)],
        )
    )
    masked = service.analyze(
        RecordInput(
            record_id="WB-004",
            crane_id="TD-A02",
            work_date=base_time,
            unit="MPa",
            expected_unit="MPa",
            threshold=80,
            samples=[SamplePoint(at=base_time + timedelta(minutes=i), value=value) for i, value in enumerate([65, 70, 88, 72, 92, 68, 85, 64, 69, 70] * 6)],
        )
    )
    service.add_evidence(
        masked.record_id,
        Evidence(
            evidence_id="ZJ-004-v1",
            record_id=masked.record_id,
            evidence_type=EvidenceType.OLD_SCREENSHOT,
            version="v1",
            anomaly_link="峰值 88/92/85 旧版截图",
            summary="旧截图保留了最初把峰值判为异常的依据",
            is_latest=False,
        ),
    )
    service.add_evidence(
        masked.record_id,
        Evidence(
            evidence_id="ZJ-004-v2",
            record_id=masked.record_id,
            evidence_type=EvidenceType.REPAIR_PHOTO,
            version="v2",
            anomaly_link="峰值 88/92/85 与维修照片对应",
            summary="照片显示峰值时刻为启动尖峰，塔吊编号和时间戳可核对",
            is_latest=True,
        ),
    )
    service.add_remark(masked.record_id, RemarkInput(text="小林核对照片时间戳、塔吊编号与峰值时刻一致，建议放行。"))
    return service
