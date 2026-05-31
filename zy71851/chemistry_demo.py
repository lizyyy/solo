from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


class RecordType(str, Enum):
    NORMAL = "正常记录"
    LATE_ATTACHMENT = "晚到附件"
    DUPLICATE = "重复项"
    MANUAL_CORRECTION = "人工更正"


class AnomalyType(str, Enum):
    NONE = "无异常"
    VIEW_RESET = "视角重置"
    STEP_SKIPPED = "步骤被跳过"
    DRAG_STATE_LOST = "拖拽后状态丢失"


class Severity(str, Enum):
    NORMAL = "正常"
    WARNING = "需关注"
    PENDING_CONFIRMATION = "待确认"


@dataclass
class Record:
    id: str
    session_id: str
    step_index: int
    step_name: str
    timestamp: str
    operator: str
    instrument: str
    action: str
    record_type: RecordType
    state_before: dict = field(default_factory=dict)
    state_after: dict = field(default_factory=dict)
    attachment_url: str = ""
    correction_note: str = ""
    is_duplicate_of: str = ""
    metadata: dict = field(default_factory=dict)

    @classmethod
    def from_dict(cls, d: dict) -> Record:
        d = dict(d)
        d["record_type"] = RecordType(d["record_type"])
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


@dataclass
class AnomalyResult:
    record_id: str
    anomaly_type: AnomalyType
    severity: Severity
    reason: str
    next_step: str
    evidence: dict = field(default_factory=dict)


@dataclass
class AuditEntry:
    timestamp: str
    operation: str
    record_id: str
    detail: str
    operator: str = "系统"


@dataclass
class ProcessingReport:
    session_id: str
    generated_at: str
    total_records: int
    normal_count: int
    anomaly_count: int
    pending_confirmation_count: int
    late_attachment_count: int
    duplicate_count: int
    manual_correction_count: int
    anomalies: list[AnomalyResult] = field(default_factory=list)
    pending_items: list[AnomalyResult] = field(default_factory=list)
    audit_trail: list[AuditEntry] = field(default_factory=list)

    def to_text(self) -> str:
        lines = [
            "=" * 60,
            "  化学仪器安全演示 — 课堂记录处理报告",
            "=" * 60,
            f"会话编号：{self.session_id}",
            f"生成时间：{self.generated_at}",
            "",
            "── 一、数据概览 ──",
            f"  收到记录总数：{self.total_records}",
            f"  正常记录：{self.normal_count}",
            f"  晚到附件：{self.late_attachment_count}",
            f"  重复项：{self.duplicate_count}（已去重留痕）",
            f"  人工更正：{self.manual_correction_count}",
            "",
            "── 二、异常检测 ──",
            f"  异常记录数：{self.anomaly_count}",
            f"  其中「待确认」：{self.pending_confirmation_count}",
        ]
        if self.anomalies:
            lines.append("")
            lines.append("  ▸ 异常明细：")
            for i, a in enumerate(self.anomalies, 1):
                lines.append(f"    {i}. 记录 {a.record_id}")
                lines.append(f"       类型：{a.anomaly_type.value}")
                lines.append(f"       级别：{a.severity.value}")
                lines.append(f"       原因：{a.reason}")
                lines.append(f"       下一步：{a.next_step}")
                if a.evidence:
                    for k, v in a.evidence.items():
                        lines.append(f"       证据[{k}]：{v}")
        if self.pending_items:
            lines.append("")
            lines.append("── 三、待确认事项（需人工复核）──")
            for i, p in enumerate(self.pending_items, 1):
                lines.append(f"  {i}. 记录 {p.record_id}")
                lines.append(f"     类型：{p.anomaly_type.value}")
                lines.append(f"     原因：{p.reason}")
                lines.append(f"     建议操作：{p.next_step}")
        else:
            lines.append("")
            lines.append("── 三、待确认事项 ──")
            lines.append("  无")
        lines.append("")
        lines.append("── 四、处理留痕 ──")
        for entry in self.audit_trail:
            lines.append(f"  [{entry.timestamp}] {entry.operation} | 记录 {entry.record_id} | {entry.detail} | 操作人：{entry.operator}")
        lines.append("")
        lines.append("=" * 60)
        lines.append("  报告结束 — 如有疑问，请依据「处理留痕」逐条复核")
        lines.append("=" * 60)
        return "\n".join(lines)


class ChemistryDemoProcessor:
    def __init__(self):
        self.audit_trail: list[AuditEntry] = []
        self._now = datetime.now

    def _log(self, operation: str, record_id: str, detail: str, operator: str = "系统"):
        self.audit_trail.append(AuditEntry(
            timestamp=self._now().strftime("%Y-%m-%d %H:%M:%S"),
            operation=operation,
            record_id=record_id,
            detail=detail,
            operator=operator,
        ))

    def deduplicate(self, records: list[Record]) -> list[Record]:
        seen: dict[str, Record] = {}
        result: list[Record] = []
        for r in records:
            key = f"{r.session_id}|{r.step_index}|{r.action}|{r.timestamp}"
            if r.record_type == RecordType.DUPLICATE:
                self._log("去重", r.id, f"标记为重复项，对应原始记录 {r.is_duplicate_of}，已跳过但留痕")
                continue
            if key in seen:
                self._log("去重", r.id, f"内容与记录 {seen[key].id} 完全一致，判定为重复，跳过但留痕")
                continue
            seen[key] = r
            result.append(r)
        return result

    def merge_late_attachments(self, records: list[Record]) -> list[Record]:
        indexed: dict[str, Record] = {}
        late: list[Record] = []
        for r in records:
            if r.record_type == RecordType.LATE_ATTACHMENT:
                late.append(r)
            else:
                indexed[r.id] = r
        for lr in late:
            parent_key = lr.is_duplicate_of or lr.metadata.get("parent_id", "")
            if parent_key and parent_key in indexed:
                parent = indexed[parent_key]
                parent.attachment_url = lr.attachment_url
                self._log("合并附件", lr.id, f"晚到附件已合并到主记录 {parent.id}，附件地址：{lr.attachment_url}")
            else:
                records.append(lr)
                self._log("合并附件", lr.id, "未找到对应主记录，保留为独立记录并标为待确认")
        return list(indexed.values())

    def apply_manual_corrections(self, records: list[Record]) -> list[Record]:
        corrections = [r for r in records if r.record_type == RecordType.MANUAL_CORRECTION]
        base = [r for r in records if r.record_type != RecordType.MANUAL_CORRECTION]
        indexed = {r.id: r for r in base}
        for cr in corrections:
            target_id = cr.is_duplicate_of or cr.metadata.get("target_id", "")
            if target_id and target_id in indexed:
                original = indexed[target_id]
                self._log("人工更正", cr.id, f"对记录 {target_id} 执行人工更正，更正说明：{cr.correction_note}，更正前 state_after={original.state_after}")
                original.state_after = cr.state_after
                original.metadata["corrected_by"] = cr.id
                original.metadata["correction_note"] = cr.correction_note
            else:
                self._log("人工更正", cr.id, f"未找到目标记录 {target_id}，更正无法应用，保留更正记录独立存档")
                base.append(cr)
        return base

    def detect_anomalies(self, records: list[Record], expected_steps: list[str] | None = None) -> list[AnomalyResult]:
        results: list[AnomalyResult] = []
        step_indices = sorted(set(r.step_index for r in records))
        max_step = max(step_indices) if step_indices else 0

        for r in records:
            if r.action == "reset_view":
                results.append(AnomalyResult(
                    record_id=r.id,
                    anomaly_type=AnomalyType.VIEW_RESET,
                    severity=Severity.PENDING_CONFIRMATION,
                    reason=(
                        f"步骤 {r.step_index}（{r.step_name}）发生了视角重置。"
                        f"重置前视角为 {r.state_before.get('view_angle', '未知')}，"
                        f"重置后变为 {r.state_after.get('view_angle', '未知')}。"
                        "视角重置可能由设备误触或系统异常触发，需确认是否为教学意图。"
                    ),
                    next_step="请培训老师确认：该视角重置是否为教学操作？若是，补充说明；若否，标记为设备异常。",
                    evidence={
                        "操作前视角": r.state_before.get("view_angle", "未知"),
                        "操作后视角": r.state_after.get("view_angle", "未知"),
                        "操作人": r.operator,
                    },
                ))
                self._log("异常检测", r.id, "检测到视角重置，标为待确认")

            elif r.action == "skip_step":
                results.append(AnomalyResult(
                    record_id=r.id,
                    anomaly_type=AnomalyType.STEP_SKIPPED,
                    severity=Severity.PENDING_CONFIRMATION,
                    reason=(
                        f"步骤 {r.step_index}（{r.step_name}）被跳过。"
                        f"预期完成步骤 {max_step} 个，当前跳至步骤 {r.step_index}。"
                        "步骤被跳过属高争议记录，若无明确留痕，后续可能无法回溯跳步原因。"
                    ),
                    next_step="请培训老师补充跳步原因，并确认后续步骤是否受影响。如无法确认，保持「待确认」状态。",
                    evidence={
                        "跳至步骤": r.step_index,
                        "步骤名称": r.step_name,
                        "操作人": r.operator,
                    },
                ))
                self._log("异常检测", r.id, f"检测到步骤被跳过（步骤 {r.step_index}），标为待确认")

            elif r.action == "drag":
                lost = False
                before_pos = r.state_before.get("instrument_position", "")
                after_pos = r.state_after.get("instrument_position", "")
                if before_pos and after_pos and before_pos != "" and (after_pos == "" or after_pos == r.state_before.get("instrument_position_default", "")):
                    lost = True
                if r.state_after.get("drag_committed") is False:
                    lost = True
                if lost:
                    results.append(AnomalyResult(
                        record_id=r.id,
                        anomaly_type=AnomalyType.DRAG_STATE_LOST,
                        severity=Severity.PENDING_CONFIRMATION,
                        reason=(
                            f"步骤 {r.step_index}（{r.step_name}）拖拽操作后状态丢失。"
                            f"拖拽前位置：{before_pos}，拖拽后位置：{after_pos}。"
                            f"drag_committed={r.state_after.get('drag_committed', '未知')}。"
                            "拖拽后仪器位置未生效，可能由页面刷新、焦点丢失或系统异常导致。"
                        ),
                        next_step="请培训老师确认：是否需要重新执行该拖拽操作？若状态已手动恢复，补充说明；否则标记为需重做。",
                        evidence={
                            "拖拽前位置": before_pos,
                            "拖拽后位置": after_pos,
                            "状态是否提交": str(r.state_after.get("drag_committed", "未知")),
                            "操作人": r.operator,
                        },
                    ))
                    self._log("异常检测", r.id, "检测到拖拽后状态丢失，标为待确认")

        if expected_steps:
            completed = {r.step_index for r in records if r.action not in ("skip_step",)}
            for idx, name in enumerate(expected_steps, 1):
                if idx not in completed:
                    results.append(AnomalyResult(
                        record_id="",
                        anomaly_type=AnomalyType.STEP_SKIPPED,
                        severity=Severity.PENDING_CONFIRMATION,
                        reason=f"预期步骤 {idx}（{name}）在记录中完全缺失，未找到任何操作痕迹。可能整步被跳过或系统未记录。",
                        next_step=f"请核实步骤 {idx}（{name}）是否实际执行。若已执行但未记录，补录操作日志；若确实跳过，补充跳步原因。",
                        evidence={"缺失步骤序号": idx, "缺失步骤名称": name},
                    ))
                    self._log("异常检测", "—", f"预期步骤 {idx}（{name}）完全缺失，标为待确认")

        return results

    def process(self, records: list[Record], expected_steps: list[str] | None = None) -> ProcessingReport:
        self.audit_trail.clear()
        self._log("开始处理", "—", f"收到 {len(records)} 条原始记录")

        deduped = self.deduplicate(records)
        self._log("去重完成", "—", f"去重后剩余 {len(deduped)} 条")

        merged = self.merge_late_attachments(deduped)
        self._log("附件合并完成", "—", f"合并后 {len(merged)} 条")

        corrected = self.apply_manual_corrections(merged)
        self._log("人工更正完成", "—", f"更正后 {len(corrected)} 条")

        anomalies = self.detect_anomalies(corrected, expected_steps)
        self._log("异常检测完成", "—", f"检出异常 {len(anomalies)} 条")

        pending = [a for a in anomalies if a.severity == Severity.PENDING_CONFIRMATION]
        type_counts = {rt: 0 for rt in RecordType}
        for r in records:
            type_counts[r.record_type] = type_counts.get(r.record_type, 0) + 1

        return ProcessingReport(
            session_id=corrected[0].session_id if corrected else "无",
            generated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            total_records=len(records),
            normal_count=type_counts.get(RecordType.NORMAL, 0),
            anomaly_count=len(anomalies),
            pending_confirmation_count=len(pending),
            late_attachment_count=type_counts.get(RecordType.LATE_ATTACHMENT, 0),
            duplicate_count=type_counts.get(RecordType.DUPLICATE, 0),
            manual_correction_count=type_counts.get(RecordType.MANUAL_CORRECTION, 0),
            anomalies=anomalies,
            pending_items=pending,
            audit_trail=self.audit_trail,
        )


def load_records(path: str) -> list[Record]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return [Record.from_dict(d) for d in data]
