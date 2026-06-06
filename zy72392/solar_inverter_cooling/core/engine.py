import uuid
from datetime import datetime
from typing import List, Dict, Any, Tuple, Optional
from enum import Enum

from .models import (
    InspectionBatch, RepairGroupScreenshot, SamplingIntervalNote,
    AbnormalRecord, AuditLog, DirectionStatus, NextHandler, AbnormalStatus
)
from .storage import Storage


class InspectionEngine:
    def __init__(self, storage: Storage):
        self.storage = storage

    def create_batch(self, name: str, operator: str = "系统") -> InspectionBatch:
        batch = InspectionBatch(
            id=str(uuid.uuid4())[:8],
            name=name,
            created_at=datetime.now(),
            status="新建",
        )
        self._add_audit_log(
            batch, operator, "创建批次", "批次状态",
            "无", "新建", f"创建新批次：{name}", []
        )
        self.storage.save_batch(batch)
        return batch

    def import_repair_screenshot(
        self, batch_id: str, filename: str, content: Dict[str, Any],
        raw_text: str = "", uploader: str = "质检员小白"
    ) -> Tuple[InspectionBatch, RepairGroupScreenshot]:
        batch = self.storage.load_batch(batch_id)
        if not batch:
            raise ValueError(f"批次 {batch_id} 不存在")

        screenshot = RepairGroupScreenshot(
            id=str(uuid.uuid4())[:8],
            batch_id=batch_id,
            filename=filename,
            upload_time=datetime.now(),
            uploader=uploader,
            content=content,
            raw_text=raw_text,
        )
        batch.repair_screenshots.append(screenshot)
        batch.status = "已导入维修群截图"

        self._add_audit_log(
            batch, uploader, "导入维修群截图", "维修群截图",
            "无", filename, f"导入维修群截图：{filename}", []
        )

        self._generate_abnormal_from_repair(batch, screenshot)
        batch.run_count += 1
        self.storage.save_batch(batch)
        return batch, screenshot

    def import_sampling_note(
        self, batch_id: str, content: Dict[str, Any],
        filename: Optional[str] = None, raw_text: str = "",
        uploader: str = "质检员小白"
    ) -> Tuple[InspectionBatch, SamplingIntervalNote]:
        batch = self.storage.load_batch(batch_id)
        if not batch:
            raise ValueError(f"批次 {batch_id} 不存在")

        note = SamplingIntervalNote(
            id=str(uuid.uuid4())[:8],
            batch_id=batch_id,
            filename=filename,
            upload_time=datetime.now(),
            uploader=uploader,
            content=content,
            raw_text=raw_text,
        )
        batch.sampling_notes.append(note)
        batch.status = "已补录采样间隔说明"

        self._add_audit_log(
            batch, uploader, "补录采样间隔说明", "采样间隔说明",
            "无", filename or "文本说明", f"补录采样间隔说明", []
        )

        self._update_abnormal_with_sampling(batch, note)
        batch.run_count += 1
        self.storage.save_batch(batch)
        return batch, note

    def _generate_abnormal_from_repair(
        self, batch: InspectionBatch, screenshot: RepairGroupScreenshot
    ) -> None:
        points = screenshot.content.get("points", [])
        affected = []

        for point in points:
            point_id = point.get("id")
            point_name = point.get("name", point_id)
            direction_text = point.get("direction", "")
            temperature = point.get("temperature")

            keep_reason = "维修群截图中记录该测点数据异常"
            missing = []
            next_handler = NextHandler.QA_XIAOBAI
            direction_status = DirectionStatus.ABNORMAL
            is_dispute = False
            field_mention = point.get("field_mention", "")

            if "向左" in direction_text or "负方向" in direction_text:
                if "向左" in direction_text:
                    is_dispute = True
                    direction_status = DirectionStatus.FIELD_DISPUTE
                    keep_reason = "现场师傅将'负方向'表述为'向左'，存在表述争议，需实验老师复核确认方向是否正确"
                    next_handler = NextHandler.EXPERIMENT_TEACHER
                    missing.append("实验老师对方向表述的复核意见")
                    field_mention = "现场师傅口误：将负方向说成向左"
                elif "负方向" in direction_text:
                    direction_status = DirectionStatus.ABNORMAL
                    keep_reason = "维修群截图显示该测点负方向散热异常"
                    next_handler = NextHandler.QA_XIAOBAI

            if temperature and temperature > 65:
                keep_reason += f"，温度{temperature}℃超过阈值65℃"

            if not batch.sampling_notes:
                missing.append("采样间隔说明")

            evidence = [f"维修群截图:{screenshot.filename}"]

            record = AbnormalRecord(
                id=str(uuid.uuid4())[:8],
                batch_id=batch.id,
                point_id=point_id,
                point_name=point_name,
                status=AbnormalStatus.NEEDS_MORE_INFO if missing else AbnormalStatus.READY_FOR_REVIEW,
                direction_status=direction_status,
                keep_reason=keep_reason,
                missing_materials=missing,
                next_handler=next_handler,
                evidence_sources=evidence,
                created_at=datetime.now(),
                updated_at=datetime.now(),
                field_mention=field_mention,
                direction_field_text=direction_text,
                is_field_dispute=is_dispute,
            )
            batch.abnormal_records.append(record)
            affected.append(record.point_name)

        self._add_audit_log(
            batch, screenshot.uploader, "生成异常工况", "异常记录表",
            "无", f"新增{len(points)}条",
            f"根据维修群截图生成{len(points)}条异常记录",
            affected
        )

    def _update_abnormal_with_sampling(
        self, batch: InspectionBatch, note: SamplingIntervalNote
    ) -> None:
        sampling_points = note.content.get("points", {})
        affected = []

        for record in batch.abnormal_records:
            point_info = sampling_points.get(record.point_id, {})
            if not point_info:
                continue

            old_status = record.status.value
            old_missing = list(record.missing_materials)
            old_next = record.next_handler.value
            old_reason = record.keep_reason

            if "采样间隔说明" in record.missing_materials:
                record.missing_materials.remove("采样间隔说明")

            sampling_explanation = point_info.get("explanation", "")
            if sampling_explanation:
                record.field_mention += f"；采样间隔说明：{sampling_explanation}"
                record.evidence_sources.append("采样间隔说明")

                if "正常" in sampling_explanation or "没问题" in sampling_explanation:
                    if record.is_field_dispute:
                        record.keep_reason = (
                            f"现场师傅表述为'向左'（应为'负方向'），"
                            f"采样间隔说明补充：{sampling_explanation}，"
                            f"仍需实验老师最终复核方向表述是否影响判定"
                        )
                        record.next_handler = NextHandler.EXPERIMENT_TEACHER
                    else:
                        record.keep_reason = (
                            f"原由维修群截图检出异常，采样间隔说明补充：{sampling_explanation}"
                        )
                elif "异常" in sampling_explanation:
                    record.keep_reason = (
                        f"维修群截图与采样间隔说明双重确认异常：{sampling_explanation}"
                    )
                    record.status = AbnormalStatus.READY_FOR_REVIEW
                    record.next_handler = NextHandler.EXPERIMENT_TEACHER

            if not record.missing_materials and record.status == AbnormalStatus.NEEDS_MORE_INFO:
                if record.is_field_dispute:
                    record.status = AbnormalStatus.DISPUTED
                else:
                    record.status = AbnormalStatus.READY_FOR_REVIEW

            record.updated_at = datetime.now()
            affected.append(record.point_name)

            changes = []
            if old_status != record.status.value:
                changes.append(f"状态:{old_status}→{record.status.value}")
            if old_missing != record.missing_materials:
                changes.append(f"缺料:{old_missing}→{record.missing_materials}")
            if old_next != record.next_handler.value:
                changes.append(f"处理人:{old_next}→{record.next_handler.value}")
            if old_reason != record.keep_reason and changes:
                changes.append(f"原因更新")

            if changes:
                self._add_audit_log(
                    batch, note.uploader, "补录采样后更新", f"异常:{record.point_name}",
                    "; ".join([old_status, str(old_missing), old_next]),
                    "; ".join([record.status.value, str(record.missing_materials), record.next_handler.value]),
                    f"补录采样间隔说明后更新：{', '.join(changes)}",
                    [record.point_name]
                )

    def manual_correct(
        self, batch_id: str, record_id: str, field: str,
        old_value: str, new_value: str, reason: str, operator: str
    ) -> InspectionBatch:
        batch = self.storage.load_batch(batch_id)
        if not batch:
            raise ValueError(f"批次 {batch_id} 不存在")

        record = None
        for r in batch.abnormal_records:
            if r.id == record_id:
                record = r
                break
        if not record:
            raise ValueError(f"异常记录 {record_id} 不存在")

        actual_old = getattr(record, field, "")
        if isinstance(actual_old, Enum):
            actual_old = actual_old.value

        setattr(record, field, new_value)
        if hasattr(record, 'updated_at'):
            record.updated_at = datetime.now()

        batch.status = "已人工修正"

        self._add_audit_log(
            batch, operator, "人工修正", f"{record.point_name}.{field}",
            str(actual_old), new_value, reason, [record.point_name]
        )

        self.storage.save_batch(batch)
        return batch

    def rerun(self, batch_id: str, operator: str = "质检员小白") -> InspectionBatch:
        batch = self.storage.load_batch(batch_id)
        if not batch:
            raise ValueError(f"批次 {batch_id} 不存在")

        old_count = len(batch.abnormal_records)

        for record in batch.abnormal_records:
            if "采样间隔说明" not in record.evidence_sources and batch.sampling_notes:
                for note in batch.sampling_notes:
                    point_info = note.content.get("points", {}).get(record.point_id, {})
                    if point_info:
                        explanation = point_info.get("explanation", "")
                        if explanation:
                            record.evidence_sources.append("采样间隔说明")
                            record.field_mention += f"；重跑补充：{explanation}"
                            if "采样间隔说明" in record.missing_materials:
                                record.missing_materials.remove("采样间隔说明")
                            if not record.missing_materials:
                                if record.is_field_dispute:
                                    record.status = AbnormalStatus.DISPUTED
                                else:
                                    record.status = AbnormalStatus.READY_FOR_REVIEW
                            record.updated_at = datetime.now()

        batch.run_count += 1
        batch.status = f"已重跑(第{batch.run_count}次)"

        self._add_audit_log(
            batch, operator, "重跑分析", "批次状态",
            f"run_count={batch.run_count-1}", f"run_count={batch.run_count}",
            f"重新执行质检分析，当前{len(batch.abnormal_records)}条异常",
            [r.point_name for r in batch.abnormal_records]
        )

        self.storage.save_batch(batch)
        return batch

    def review_resolve(
        self, batch_id: str, record_id: str, resolution: str,
        operator: str = "实验老师"
    ) -> InspectionBatch:
        batch = self.storage.load_batch(batch_id)
        if not batch:
            raise ValueError(f"批次 {batch_id} 不存在")

        record = None
        for r in batch.abnormal_records:
            if r.id == record_id:
                record = r
                break
        if not record:
            raise ValueError(f"异常记录 {record_id} 不存在")

        old_status = record.status.value
        record.status = AbnormalStatus.RESOLVED
        record.direction_status = DirectionStatus.NORMAL
        record.notes = f"{operator}复核结论：{resolution}"
        record.updated_at = datetime.now()

        if "待实验老师复核" in record.missing_materials:
            record.missing_materials.remove("待实验老师复核")
        if not record.missing_materials:
            record.next_handler = NextHandler.QA_XIAOBAI

        self._add_audit_log(
            batch, operator, "复核解决", f"{record.point_name}.状态",
            old_status, AbnormalStatus.RESOLVED.value,
            resolution, [record.point_name]
        )

        batch.status = "复核中"
        self.storage.save_batch(batch)
        return batch

    def _add_audit_log(
        self, batch: InspectionBatch, operator: str, action: str,
        field_changed: str, old_value: str, new_value: str,
        reason: str, affected_results: List[str]
    ) -> None:
        log = AuditLog(
            id=str(uuid.uuid4())[:8],
            batch_id=batch.id,
            timestamp=datetime.now(),
            operator=operator,
            action=action,
            field_changed=field_changed,
            old_value=old_value,
            new_value=new_value,
            reason=reason,
            affected_results=affected_results,
        )
        batch.audit_logs.append(log)
