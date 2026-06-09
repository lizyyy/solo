from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime
from typing import Any, Optional

from models import (
    AuditEntry,
    ExceptionItem,
    ExceptionStatus,
    FieldName,
    FieldRecord,
    RescueRecord,
    SourceInfo,
    SourceType,
    ValueOrigin,
    compute_attachment_digest,
    compute_idempotency_key,
)


SOURCE_PRIORITY = {
    SourceType.MANUAL_EDIT: 100,
    SourceType.ATTACHMENT: 80,
    SourceType.WECHAT_NOTE: 60,
    SourceType.VERBAL_NOTE: 40,
    SourceType.SYSTEM_DERIVED: 20,
}

FIELD_CONFIRM_PERSON = {
    FieldName.VACCINE_DATE: "主治兽医",
    FieldName.DEWORMING_DATE: "主治兽医",
    FieldName.HEALTH_STATUS: "主治兽医",
    FieldName.APPOINTMENT_TIME: "前台调度",
    FieldName.OWNER_CONTACT: "前台调度",
    FieldName.ANIMAL_NAME: "救助志愿者",
    FieldName.REMARKS: "救助志愿者",
}

REQUIRED_FIELDS = [
    FieldName.ANIMAL_NAME,
    FieldName.VACCINE_DATE,
    FieldName.APPOINTMENT_TIME,
]


class ReconciliationEngine:
    def __init__(self) -> None:
        self.records: dict[str, RescueRecord] = {}
        self.exceptions: dict[str, ExceptionItem] = {}

    def _get_or_create_record(self, case_id: str, animal_id: str) -> RescueRecord:
        if case_id not in self.records:
            self.records[case_id] = RescueRecord(case_id=case_id, animal_id=animal_id)
        return self.records[case_id]

    def _make_audit(
        self,
        action: str,
        field_name: Optional[FieldName],
        old: Any,
        new: Any,
        src: SourceType,
        actor: str,
        note: str = "",
    ) -> AuditEntry:
        return AuditEntry(
            action=action,
            field_name=field_name,
            old_value=old,
            new_value=new,
            source=src,
            actor=actor,
            timestamp=datetime.now(),
            note=note,
        )

    def submit_rescue_payload(
        self,
        case_id: str,
        animal_id: str,
        submitter: str,
        field_values: dict[FieldName, Any],
        source_type: SourceType,
        source_id: str,
        source_version: int = 1,
        raw_ref: Optional[str] = None,
        payload_fingerprint: Optional[str] = None,
        attachment_meta: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        record = self._get_or_create_record(case_id, animal_id)

        if payload_fingerprint is None:
            payload_fingerprint = hashlib.sha256(
                json.dumps({k.value: str(v) for k, v in field_values.items()}, sort_keys=True).encode()
            ).hexdigest()

        idem_key = compute_idempotency_key(case_id, payload_fingerprint, submitter)

        attachment_digest: Optional[str] = None
        if attachment_meta:
            attachment_digest = compute_attachment_digest(
                attachment_meta["file_name"],
                attachment_meta["file_size"],
                attachment_meta["content_hash"],
            )

        if not record.add_submission_idempotency_key(idem_key):
            if attachment_digest:
                if record.has_attachment(attachment_digest):
                    return {
                        "status": "ignored_duplicate",
                        "reason": "幂等键命中：重复提交，晚到附件已登记不重复计数",
                        "case_id": case_id,
                        "attachment_registered": False,
                        "attachment_deduped": True,
                    }
                else:
                    record.register_attachment(attachment_digest)
                    return {
                        "status": "ignored_duplicate",
                        "reason": "幂等键命中：字段重复已忽略，仅登记新到附件不重复处理内容",
                        "case_id": case_id,
                        "attachment_registered": True,
                        "attachment_deduped": False,
                    }
            else:
                return {
                    "status": "ignored_duplicate",
                    "reason": "幂等键命中：重复提交已被忽略",
                    "case_id": case_id,
                    "attachment_registered": False,
                    "attachment_deduped": False,
                }

        attachment_deduped = False
        if attachment_digest:
            if record.has_attachment(attachment_digest):
                attachment_deduped = True
            else:
                record.register_attachment(attachment_digest)

        source_info = SourceInfo(
            source_type=source_type,
            source_id=source_id,
            submitted_at=datetime.now(),
            submitter=submitter,
            version=source_version,
            raw_ref=raw_ref,
        )

        applied_fields: list[FieldName] = []
        conflict_fields: list[FieldName] = []
        skipped_manual: list[FieldName] = []

        for field_name, value in field_values.items():
            if value is None or value == "":
                continue

            existing = record.fields.get(field_name)
            new_fr = FieldRecord(
                field_name=field_name,
                value=value,
                source_info=source_info,
                captured_at=datetime.now(),
            )

            if field_name not in record.field_history:
                record.field_history[field_name] = []

            if existing is None:
                new_fr.origin = ValueOrigin.WON
                record.fields[field_name] = new_fr
                record.field_history[field_name].append(new_fr)
                record.audit_log.append(
                    self._make_audit(
                        "SET", field_name, None, value, source_type, submitter,
                        f"首次写入，来源={source_type.value}",
                    )
                )
                applied_fields.append(field_name)
            else:
                if existing.source_info.source_type == SourceType.MANUAL_EDIT and source_type != SourceType.MANUAL_EDIT:
                    skipped_manual.append(field_name)
                    record.audit_log.append(
                        self._make_audit(
                            "SKIP", field_name, existing.value, value, source_type, submitter,
                            "人工备注不予覆盖，保留原值",
                        )
                    )
                    continue

                new_prio = SOURCE_PRIORITY[source_type]
                old_prio = SOURCE_PRIORITY[existing.source_info.source_type]

                if new_prio > old_prio:
                    old_fr = existing
                    old_fr.origin = ValueOrigin.OVERRIDDEN
                    old_fr.overridden_by = idem_key
                    new_fr.overrides = idem_key
                    new_fr.origin = ValueOrigin.WON
                    record.fields[field_name] = new_fr
                    record.field_history[field_name].append(new_fr)
                    record.audit_log.append(
                        self._make_audit(
                            "OVERRULE", field_name, old_fr.value, value, source_type, submitter,
                            f"{old_fr.source_info.source_type.value} 被高优先级来源 {source_type.value} 覆盖",
                        )
                    )
                    conflict_fields.append(field_name)
                    self._update_exception_on_overrule(case_id, field_name, old_fr, new_fr, submitter)
                elif new_prio == old_prio and value != existing.value:
                    if source_info.submitted_at > existing.source_info.submitted_at:
                        old_fr = existing
                        old_fr.origin = ValueOrigin.OVERRIDDEN
                        new_fr.origin = ValueOrigin.WON
                        record.fields[field_name] = new_fr
                        record.field_history[field_name].append(new_fr)
                        record.audit_log.append(
                            self._make_audit(
                                "OVERRULE", field_name, old_fr.value, value, source_type, submitter,
                                "同优先级，以较新提交时间胜出",
                            )
                        )
                        conflict_fields.append(field_name)
                        self._update_exception_on_overrule(case_id, field_name, old_fr, new_fr, submitter)
                    else:
                        new_fr.origin = ValueOrigin.OVERRIDDEN
                        record.field_history[field_name].append(new_fr)
                        record.audit_log.append(
                            self._make_audit(
                                "REJECT", field_name, existing.value, value, source_type, submitter,
                                "同优先级，保留时间较早的记录",
                            )
                        )
                else:
                    new_fr.origin = ValueOrigin.OVERRIDDEN
                    record.field_history[field_name].append(new_fr)
                    record.audit_log.append(
                        self._make_audit(
                            "REJECT", field_name, existing.value, value, source_type, submitter,
                            f"优先级低于现有来源 {existing.source_info.source_type.value}，记录备查",
                        )
                    )

        record.updated_at = datetime.now()
        self._refresh_exceptions(record, source_info, submitter)

        return {
            "status": "applied",
            "case_id": case_id,
            "applied_fields": [f.value for f in applied_fields],
            "conflict_fields_resolved": [f.value for f in conflict_fields],
            "skipped_manual_protected": [f.value for f in skipped_manual],
            "attachment_registered": attachment_digest is not None and not attachment_deduped,
            "attachment_deduped": attachment_deduped,
        }

    def _update_exception_on_overrule(
        self,
        case_id: str,
        field_name: FieldName,
        old_fr: FieldRecord,
        new_fr: FieldRecord,
        actor: str,
    ) -> None:
        for exc in self.exceptions.values():
            if exc.animal_case_id == case_id and exc.missing_field == field_name:
                if exc.status in (ExceptionStatus.PENDING, ExceptionStatus.SUPPLEMENTED):
                    exc.status = ExceptionStatus.OVERRULED
                    exc.history.append(
                        AuditEntry(
                            action="OVERRULE",
                            field_name=field_name,
                            old_value=old_fr.value if old_fr else None,
                            new_value=new_fr.value,
                            source=new_fr.source_info.source_type,
                            actor=actor,
                            timestamp=datetime.now(),
                            note=f"结论改判：来源{old_fr.source_info.source_type.value} → {new_fr.source_info.source_type.value}",
                        )
                    )
                    exc.updated_at = datetime.now()

    def _refresh_exceptions(self, record: RescueRecord, latest_source: SourceInfo, actor: str) -> None:
        for field_name in REQUIRED_FIELDS:
            if field_name not in record.fields or record.fields[field_name].value in (None, ""):
                existing_exc = next(
                    (e for e in self.exceptions.values()
                     if e.animal_case_id == record.case_id and e.missing_field == field_name),
                    None,
                )
                if existing_exc is None:
                    exc_id = f"EXC-{uuid.uuid4().hex[:8].upper()}"
                    field_label = {
                        FieldName.VACCINE_DATE: "疫苗接种日期",
                        FieldName.ANIMAL_NAME: "动物姓名/编号",
                        FieldName.APPOINTMENT_TIME: "排程时间",
                    }[field_name]

                    history_for_field = record.field_history.get(field_name, [])
                    if history_for_field:
                        oldest = min(history_for_field, key=lambda x: x.captured_at)
                        priority_source = oldest.source_info
                    else:
                        priority_source = latest_source

                    exc = ExceptionItem(
                        exception_id=exc_id,
                        animal_case_id=record.case_id,
                        title=f"{field_label}缺失",
                        description=(
                            f"救助记录【{record.case_id}】缺少{field_label}，"
                            f"当前存在 {len(history_for_field)} 条历史提交但均未提供有效值。"
                        ),
                        status=ExceptionStatus.PENDING,
                        missing_field=field_name,
                        confirm_person=FIELD_CONFIRM_PERSON.get(field_name, "救助负责人"),
                        priority_source=priority_source,
                        created_at=datetime.now(),
                        updated_at=datetime.now(),
                    )
                    self.exceptions[exc_id] = exc
            else:
                for exc_id, exc in list(self.exceptions.items()):
                    if exc.animal_case_id == record.case_id and exc.missing_field == field_name:
                        if exc.status == ExceptionStatus.PENDING:
                            fr = record.fields[field_name]
                            exc.status = ExceptionStatus.SUPPLEMENTED
                            exc.history.append(
                                AuditEntry(
                                    action="SUPPLEMENT",
                                    field_name=field_name,
                                    old_value=None,
                                    new_value=fr.value,
                                    source=fr.source_info.source_type,
                                    actor=actor,
                                    timestamp=datetime.now(),
                                    note=f"已补录，来源={fr.source_info.source_type.value}，提交人={fr.source_info.submitter}",
                                )
                            )
                            exc.updated_at = datetime.now()

    def supplement_exception_manually(
        self,
        exception_id: str,
        field_value: Any,
        operator: str,
        note: str = "",
    ) -> dict[str, Any]:
        exc = self.exceptions.get(exception_id)
        if exc is None:
            return {"status": "error", "reason": "异常记录不存在"}
        if exc.missing_field is None:
            return {"status": "error", "reason": "该异常无可补录的字段"}

        record = self.records.get(exc.animal_case_id)
        if record is None:
            return {"status": "error", "reason": "关联救助记录不存在"}

        source_info = SourceInfo(
            source_type=SourceType.MANUAL_EDIT,
            source_id=f"manual-{exception_id}",
            submitted_at=datetime.now(),
            submitter=operator,
            version=1,
        )
        fr = FieldRecord(
            field_name=exc.missing_field,
            value=field_value,
            source_info=source_info,
            captured_at=datetime.now(),
            origin=ValueOrigin.SUPPLEMENT,
        )
        if exc.missing_field not in record.field_history:
            record.field_history[exc.missing_field] = []
        record.field_history[exc.missing_field].append(fr)
        record.fields[exc.missing_field] = fr
        record.audit_log.append(
            self._make_audit(
                "SUPPLEMENT", exc.missing_field, None, field_value,
                SourceType.MANUAL_EDIT, operator, note or "人工补录",
            )
        )
        record.updated_at = datetime.now()

        exc.status = ExceptionStatus.SUPPLEMENTED
        exc.history.append(
            self._make_audit(
                "SUPPLEMENT", exc.missing_field, None, field_value,
                SourceType.MANUAL_EDIT, operator, note or "人工补录",
            )
        )
        exc.updated_at = datetime.now()

        return {"status": "supplemented", "exception_id": exception_id, "field": exc.missing_field.value}

    def render_exception_queue_for_communication(self) -> str:
        if not self.exceptions:
            return "【流浪动物救助排程对账 · 异常队列】\n状态：所有记录对账正常，无异常。"

        lines = ["【流浪动物救助排程对账 · 异常队列】", "=" * 56, ""]

        pending = [e for e in self.exceptions.values() if e.status == ExceptionStatus.PENDING]
        supplemented = [e for e in self.exceptions.values() if e.status == ExceptionStatus.SUPPLEMENTED]
        overruled = [e for e in self.exceptions.values() if e.status == ExceptionStatus.OVERRULED]

        def source_label(src: SourceInfo) -> str:
            type_map = {
                SourceType.WECHAT_NOTE: "主人微信备注",
                SourceType.ATTACHMENT: "附件材料",
                SourceType.VERBAL_NOTE: "口头备注",
                SourceType.MANUAL_EDIT: "人工编辑",
                SourceType.SYSTEM_DERIVED: "系统推导",
            }
            return f"{type_map.get(src.source_type, src.source_type.value)}#{src.source_id} v{src.version}（{src.submitter}，{src.submitted_at.strftime('%m-%d %H:%M')}）"

        def status_tags(exc: ExceptionItem) -> str:
            tags = []
            if exc.is_supplemented():
                tags.append("✅已补")
            if exc.is_overruled():
                tags.append("⚠️改判")
            if exc.status == ExceptionStatus.PENDING:
                tags.append("🔴待处理")
            return " ".join(tags)

        if pending:
            lines.append(f"■ 待处理（{len(pending)} 条）")
            lines.append("-" * 40)
            for exc in pending:
                src_tag = source_label(exc.priority_source)
                lines.append(f"【{exc.exception_id}】{exc.title} {status_tags(exc)}")
                lines.append(f"    救助单号：{exc.animal_case_id}")
                lines.append(f"    情况：{exc.description}")
                lines.append(f"    找谁确认：{exc.confirm_person}")
                lines.append(f"    优先查看来源：{src_tag}")
                lines.append("")

        if supplemented:
            lines.append(f"● 已补录（{len(supplemented)} 条）")
            lines.append("-" * 40)
            for exc in supplemented:
                supp = next((h for h in reversed(exc.history) if h.action == "SUPPLEMENT"), None)
                supp_info = f"{supp.source.value if supp else '?'} · {supp.actor if supp else '?'} · {supp.note if supp else ''}"
                lines.append(f"【{exc.exception_id}】{exc.title} {status_tags(exc)}")
                lines.append(f"    救助单号：{exc.animal_case_id}")
                lines.append(f"    补录信息：{supp_info}")
                if exc.is_overruled():
                    ov = next((h for h in reversed(exc.history) if h.action == "OVERRULE"), None)
                    if ov:
                        lines.append(f"    改判说明：{ov.note}")
                lines.append("")

        if overruled:
            lines.append(f"▲ 已改判（{len(overruled)} 条）")
            lines.append("-" * 40)
            for exc in overruled:
                ov = next((h for h in reversed(exc.history) if h.action == "OVERRULE"), None)
                ov_info = ov.note if ov else ""
                lines.append(f"【{exc.exception_id}】{exc.title} {status_tags(exc)}")
                lines.append(f"    救助单号：{exc.animal_case_id}")
                if exc.is_supplemented():
                    supp = next((h for h in exc.history if h.action == "SUPPLEMENT"), None)
                    if supp:
                        supp_info = f"{supp.source.value} · {supp.actor} · {supp.note}"
                        lines.append(f"    补录信息：{supp_info}")
                lines.append(f"    改判说明：{ov_info}")
                lines.append("")

        lines.append("=" * 56)
        lines.append("汇总：待处理 %d · 已补录 %d · 已改判 %d · 总计 %d" % (
            len(pending), len(supplemented), len(overruled), len(self.exceptions)
        ))
        return "\n".join(lines)

    def get_conclusion_trace(self, case_id: str, field_name: FieldName) -> list[dict[str, Any]]:
        record = self.records.get(case_id)
        if not record:
            return []
        history = record.field_history.get(field_name, [])
        trace = []
        for fr in history:
            trace.append({
                "field": field_name.value,
                "value": fr.value,
                "origin": fr.origin.value,
                "source_type": fr.source_info.source_type.value,
                "source_id": fr.source_info.source_id,
                "submitter": fr.source_info.submitter,
                "captured_at": fr.captured_at.isoformat(timespec="seconds"),
                "overrides": fr.overrides,
                "overridden_by": fr.overridden_by,
            })
        return trace
