import uuid
from typing import List, Dict, Tuple, Optional
from datetime import datetime
from collections import defaultdict

from models import (
    SparePart, Alarm, ManualNote, AnomalyAttribution, AttributionDetail,
    PartStatus, AlarmStatus, AttributionStatus, NoteSource,
    STATUS_EXPORT_MAPPING
)
from database import (
    init_db,
    SparePartRepo, AlarmRepo, ManualNoteRepo, AnomalyAttributionRepo
)


def _gen_no(prefix: str) -> str:
    ts = datetime.now().strftime("%Y%m%d%H%M%S")
    suffix = uuid.uuid4().hex[:6].upper()
    return f"{prefix}-{ts}-{suffix}"


class PipelineAnomalyService:
    def __init__(self):
        init_db()

    def add_spare_part(self, part_no: str, part_name: str, part_model: str,
                       expected_model: str, quantity: int, pipeline_id: str,
                       status: PartStatus = PartStatus.NORMAL) -> SparePart:
        existing = SparePartRepo.get_by_no(part_no)
        if existing:
            raise ValueError(f"备件编号 {part_no} 已存在")
        part = SparePart(
            part_no=part_no, part_name=part_name, part_model=part_model,
            expected_model=expected_model, quantity=quantity,
            pipeline_id=pipeline_id, status=status
        )
        pid = SparePartRepo.insert(part)
        part.id = pid
        return part

    def add_alarm(self, pipeline_id: str, alarm_type: str, alarm_desc: str,
                  related_part_no: Optional[str] = None) -> Alarm:
        alarm = Alarm(
            alarm_no=_gen_no("ALM"), pipeline_id=pipeline_id,
            alarm_type=alarm_type, alarm_desc=alarm_desc,
            status=AlarmStatus.OPEN, related_part_no=related_part_no
        )
        aid = AlarmRepo.insert(alarm)
        alarm.id = aid
        return alarm

    def add_manual_note(self, pipeline_id: str, content: str, operator: str,
                        related_alarm_no: Optional[str] = None,
                        related_part_no: Optional[str] = None,
                        source: NoteSource = NoteSource.MANUAL) -> ManualNote:
        note = ManualNote(
            note_no=_gen_no("NOTE"), pipeline_id=pipeline_id,
            related_alarm_no=related_alarm_no, related_part_no=related_part_no,
            source=source, operator=operator, content=content
        )
        nid = ManualNoteRepo.insert(note)
        note.id = nid
        return note

    def _check_part_alarm_note_match(self, part: SparePart, alarm: Optional[Alarm],
                                     note: Optional[ManualNote]) -> Tuple[bool, str]:
        mismatches = []
        if alarm:
            if alarm.pipeline_id != part.pipeline_id:
                mismatches.append(f"报警管线{alarm.pipeline_id}与备件管线{part.pipeline_id}不符")
            if alarm.related_part_no and alarm.related_part_no != part.part_no:
                mismatches.append(f"报警关联备件{alarm.related_part_no}与实际备件{part.part_no}不符")
        if note:
            if note.pipeline_id != part.pipeline_id:
                mismatches.append(f"备注管线{note.pipeline_id}与备件管线{part.pipeline_id}不符")
            if note.related_part_no and note.related_part_no != part.part_no:
                mismatches.append(f"备注关联备件{note.related_part_no}与实际备件{part.part_no}不符")
            if note.related_alarm_no and alarm and note.related_alarm_no != alarm.alarm_no:
                mismatches.append(f"备注关联报警{note.related_alarm_no}与实际报警{alarm.alarm_no}不符")
        return (len(mismatches) == 0, "; ".join(mismatches))

    def _check_model_replace(self, part: SparePart) -> Tuple[bool, str, List[str]]:
        if part.part_model != part.expected_model:
            reason = f"备件型号不匹配：期望{part.expected_model}，实际{part.part_model}"
            affected = [part.part_no]
            return True, reason, affected
        return False, "", []

    def run_attribution_main(self, part_no: str, operator: str,
                             alarm_no: Optional[str] = None,
                             note_no: Optional[str] = None,
                             attribution_reason: str = "") -> AnomalyAttribution:
        part = SparePartRepo.get_by_no(part_no)
        if not part:
            raise ValueError(f"备件 {part_no} 不存在")

        alarm = AlarmRepo.get_by_no(alarm_no) if alarm_no else None
        note = ManualNoteRepo.get_by_no(note_no) if note_no else None

        matched, mismatch_desc = self._check_part_alarm_note_match(part, alarm, note)

        is_replace, replace_reason, affected = self._check_model_replace(part)

        attr = AnomalyAttribution(
            attr_no=_gen_no("ATTR"), pipeline_id=part.pipeline_id,
            part_id=part.id, alarm_id=alarm.id if alarm else None,
            note_id=note.id if note else None,
            operator=operator, is_model_replace=is_replace
        )

        if not matched:
            attr.status = AttributionStatus.PENDING_CONFIRM
            attr.pending_reason = mismatch_desc
            attr.attribution_reason = attribution_reason or "备件-报警-备注关联不一致，待人工复核"
            attr.affected_records = ", ".join(filter(None, [
                part.part_no,
                alarm.alarm_no if alarm else "",
                note.note_no if note else ""
            ]))
        elif is_replace:
            attr.status = AttributionStatus.PENDING_CONFIRM
            attr.pending_reason = replace_reason
            attr.attribution_reason = attribution_reason or "备件型号发生替换，暂不按正常结果放过"
            attr.affected_records = ", ".join(affected)
        elif part.status == PartStatus.NORMAL:
            attr.status = AttributionStatus.NORMAL
            attr.attribution_reason = attribution_reason or "主流程校验通过：备件、报警、备注一致，型号匹配"
            attr.affected_records = part.part_no
        else:
            attr.status = AttributionStatus.PENDING_CONFIRM
            attr.attribution_reason = attribution_reason or f"备件状态为{part.status.value}，需进一步确认"
            attr.affected_records = part.part_no

        aid = AnomalyAttributionRepo.insert(attr)
        attr.id = aid
        return attr

    def confirm_attribution(self, attr_no: str, operator: str,
                            final_status: AttributionStatus,
                            confirm_reason: str = "") -> AnomalyAttribution:
        attr = AnomalyAttributionRepo.get_by_no(attr_no)
        if not attr:
            raise ValueError(f"归因记录 {attr_no} 不存在")
        attr.status = final_status
        if confirm_reason:
            attr.attribution_reason = confirm_reason
        attr.operator = operator
        AnomalyAttributionRepo.update(attr)
        return attr

    def list_model_replace_pending(self) -> List[Dict]:
        all_attrs = AnomalyAttributionRepo.list_all()
        result = []
        for a in all_attrs:
            if a.is_model_replace and a.status == AttributionStatus.PENDING_CONFIRM:
                part = SparePartRepo.get_by_id(a.part_id) if a.part_id else None
                result.append({
                    "attr_no": a.attr_no,
                    "pipeline_id": a.pipeline_id,
                    "pending_reason": a.pending_reason,
                    "affected_records": a.affected_records,
                    "part_no": part.part_no if part else "",
                    "part_name": part.part_name if part else "",
                    "part_model": part.part_model if part else "",
                    "expected_model": part.expected_model if part else "",
                    "operator": a.operator,
                    "created_at": a.created_at.strftime("%Y-%m-%d %H:%M:%S")
                })
        return result

    def monthly_review(self) -> Dict[str, List[AttributionDetail]]:
        details = AnomalyAttributionRepo.get_details()
        groups = defaultdict(list)
        for d in details:
            if d.status == AttributionStatus.CONFIRMED:
                groups["已确认"].append(d)
            elif d.status == AttributionStatus.PENDING_PART:
                groups["待补件"].append(d)
            elif d.status == AttributionStatus.RETURNED:
                groups["退回"].append(d)
            else:
                groups["其他"].append(d)
        return dict(groups)

    def query_attribution_details(self) -> List[Dict]:
        details = AnomalyAttributionRepo.get_details()
        result = []
        for d in details:
            result.append({
                "attr_no": d.attr_no,
                "pipeline_id": d.pipeline_id,
                "status": d.status.value,
                "status_for_export": d.status_for_export,
                "attribution_reason": d.attribution_reason,
                "pending_reason": d.pending_reason,
                "affected_records": d.affected_records,
                "part_no": d.part_no,
                "part_name": d.part_name,
                "part_model": d.part_model,
                "expected_model": d.expected_model,
                "part_status": d.part_status,
                "alarm_no": d.alarm_no,
                "alarm_type": d.alarm_type,
                "alarm_desc": d.alarm_desc,
                "alarm_status": d.alarm_status,
                "note_no": d.note_no,
                "note_content": d.note_content,
                "note_operator": d.note_operator,
                "operator": d.operator,
                "created_at": d.created_at
            })
        return result

    def export_anomaly_queue(self) -> List[Dict]:
        result = []
        for r in self.query_attribution_details():
            result.append({
                "归因编号": r["attr_no"],
                "管线编号": r["pipeline_id"],
                "状态": r["status_for_export"],
                "归因原因": r["attribution_reason"],
                "待确认理由": r["pending_reason"],
                "受影响记录": r["affected_records"],
                "备件编号": r["part_no"],
                "备件名称": r["part_name"],
                "实际型号": r["part_model"],
                "期望型号": r["expected_model"],
                "备件状态": r["part_status"],
                "报警编号": r["alarm_no"],
                "报警类型": r["alarm_type"],
                "报警描述": r["alarm_desc"],
                "报警状态": r["alarm_status"],
                "备注编号": r["note_no"],
                "备注内容": r["note_content"],
                "备注人": r["note_operator"],
                "处理人": r["operator"],
                "创建时间": r["created_at"]
            })
        return result

    def verify_status_consistency(self) -> Tuple[bool, List[str]]:
        details = AnomalyAttributionRepo.get_details()
        errors = []
        for d in details:
            expected_export = STATUS_EXPORT_MAPPING.get(d.status, "未知")
            if d.status_for_export != expected_export:
                errors.append(
                    f"{d.attr_no}: 接口状态={d.status.value}, 导出状态={d.status_for_export}, 期望={expected_export}"
                )
            queue_records = self.export_anomaly_queue()
            for qr in queue_records:
                if qr["归因编号"] == d.attr_no:
                    if qr["状态"] != expected_export:
                        errors.append(
                            f"{d.attr_no}: 导出队列状态={qr['状态']}与映射表不符"
                        )
        return (len(errors) == 0, errors)

    def verify_restart_persistence(self) -> Tuple[bool, List[str]]:
        errors = []
        all_notes = []
        for note in ManualNoteRepo.list_by_pipeline("*"):
            all_notes.append(note)
        all_notes = []
        try:
            all_parts = SparePartRepo.list_all()
            all_alarms = AlarmRepo.list_all()
            all_attrs = AnomalyAttributionRepo.list_all()
            details = AnomalyAttributionRepo.get_details()

            if len(all_attrs) != len(details):
                errors.append(f"归因主记录数({len(all_attrs)})与明细数({len(details)})不一致")

            for attr in all_attrs:
                matching = [d for d in details if d.attr_no == attr.attr_no]
                if not matching:
                    errors.append(f"归因记录{attr.attr_no}在明细中缺失")
                else:
                    if matching[0].status.value != attr.status.value:
                        errors.append(f"{attr.attr_no}: 状态在主表与明细表中不一致")
        except Exception as e:
            errors.append(f"持久化验证异常: {e}")
        return (len(errors) == 0, errors)

    def get_all_parts(self) -> List[SparePart]:
        return SparePartRepo.list_all()

    def get_all_alarms(self) -> List[Alarm]:
        return AlarmRepo.list_all()

    def get_all_attrs(self) -> List[AnomalyAttribution]:
        return AnomalyAttributionRepo.list_all()
