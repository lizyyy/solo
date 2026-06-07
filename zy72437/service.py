import uuid
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from models import (
    ClaimRecord,
    ConflictEvidence,
    ConflictType,
    RecordStatus,
    RecordSource,
    AuditLog,
    SelfCheckResult,
    SelfCheckType,
    CalculationMeta,
)


class ClaimRecordService:
    def __init__(self):
        self.records: Dict[str, ClaimRecord] = {}
        self.param_version = "v1.0.0"

    def _generate_id(self) -> str:
        return str(uuid.uuid4())

    def _add_audit_log(
        self,
        record: ClaimRecord,
        source: RecordSource,
        action: str,
        old_value: Optional[Dict] = None,
        new_value: Optional[Dict] = None,
        operator: Optional[str] = None,
        remark: Optional[str] = None,
    ):
        log = AuditLog(
            log_id=self._generate_id(),
            record_id=record.record_id,
            source=source,
            action=action,
            old_value=old_value,
            new_value=new_value,
            operator=operator,
            remark=remark,
        )
        record.audit_logs.append(log)

    def import_sign_in_photos(
        self,
        data_list: List[Dict],
        operator: Optional[str] = None,
    ) -> List[ClaimRecord]:
        created_records = []
        for data in data_list:
            record = ClaimRecord(
                record_id=self._generate_id(),
                lesson_date=data["lesson_date"],
                teacher=data["teacher"],
                student=data["student"],
                song_live_name=data.get("song_live_name"),
                song_copyright_name=data.get("song_copyright_name"),
                attendance_count=data.get("attendance_count"),
                raw_remark=data.get("raw_remark", ""),
                source=RecordSource.SIGN_IN_PHOTO,
                status=RecordStatus.PENDING_REVIEW,
                created_by=operator,
            )
            self._check_song_name_alias(record)
            self.records[record.record_id] = record
            self._add_audit_log(
                record,
                RecordSource.SIGN_IN_PHOTO,
                "import_sign_in",
                new_value=self._record_to_dict(record),
                operator=operator,
                remark="导入课时签到照片",
            )
            created_records.append(record)
        return created_records

    def import_ticket_export(
        self,
        record_id: str,
        ticket_data: Dict,
        operator: Optional[str] = None,
    ) -> ClaimRecord:
        record = self.records[record_id]
        old_record = self._record_to_dict(record)

        conflicts = self._detect_conflicts(record, ticket_data)
        record.conflicts.extend(conflicts)

        if conflicts:
            record.status = RecordStatus.CONFLICT
        else:
            if not record.song_live_name and ticket_data.get("song_name"):
                record.song_live_name = ticket_data.get("song_name")
            record.attendance_count = ticket_data.get(
                "attendance_count", record.attendance_count
            )
            record.status = RecordStatus.NORMAL

        record.ticket_imported = True
        record.updated_at = datetime.now()

        self._add_audit_log(
            record,
            RecordSource.TICKET_EXPORT,
            "import_ticket",
            old_value=old_record,
            new_value=self._record_to_dict(record),
            operator=operator,
            remark=f"导入票务导出表，冲突数: {len(conflicts)}",
        )

        return record

    def _detect_conflicts(
        self, record: ClaimRecord, ticket_data: Dict
    ) -> List[ConflictEvidence]:
        conflicts = []

        ticket_song = ticket_data.get("song_name")
        if ticket_song and record.song_live_name and ticket_song != record.song_live_name:
            conflicts.append(
                ConflictEvidence(
                    conflict_id=self._generate_id(),
                    conflict_type=ConflictType.SONG_NAME_MISMATCH,
                    field_name="song_name",
                    sign_in_value=record.song_live_name,
                    ticket_value=ticket_song,
                    description=f"课时签到歌曲名 '{record.song_live_name}' 与票务导出 '{ticket_song}' 不一致",
                )
            )

        ticket_attendance = ticket_data.get("attendance_count")
        if (
            ticket_attendance is not None
            and record.attendance_count is not None
            and ticket_attendance != record.attendance_count
        ):
            conflicts.append(
                ConflictEvidence(
                    conflict_id=self._generate_id(),
                    conflict_type=ConflictType.ATTENDANCE_MISMATCH,
                    field_name="attendance_count",
                    sign_in_value=record.attendance_count,
                    ticket_value=ticket_attendance,
                    description=f"课时签到人数 {record.attendance_count} 与票务导出 {ticket_attendance} 不一致",
                )
            )

        return conflicts

    def _check_song_name_alias(self, record: ClaimRecord):
        if record.song_live_name and record.song_copyright_name:
            if record.song_live_name != record.song_copyright_name:
                record.status = RecordStatus.PENDING_REVIEW
                record.calculation_meta = CalculationMeta(
                    param_version=self.param_version,
                    decision_reason=f"检测到同一首歌有现场名 '{record.song_live_name}' 和版权名 '{record.song_copyright_name}'，需音乐老师复核，不归为正常",
                )

    def resolve_conflict(
        self,
        record_id: str,
        conflict_id: str,
        resolution: str,
        operator: str,
        use_sign_in_value: bool = True,
    ) -> ClaimRecord:
        record = self.records[record_id]
        old_record = self._record_to_dict(record)

        conflict = next(c for c in record.conflicts if c.conflict_id == conflict_id)
        conflict.resolved = True
        conflict.resolved_by = operator
        conflict.resolved_at = datetime.now()
        conflict.resolution = resolution

        if use_sign_in_value:
            final_value = conflict.sign_in_value
            remark = f"人工确认采用课时签到数据: {conflict.sign_in_value}"
        else:
            final_value = conflict.ticket_value
            remark = f"人工确认采用票务导出数据: {conflict.ticket_value}"

        if conflict.field_name == "song_name":
            record.song_live_name = final_value
        elif conflict.field_name == "attendance_count":
            record.attendance_count = final_value

        unresolved = [c for c in record.conflicts if not c.resolved]
        if not unresolved:
            record.status = RecordStatus.CONFIRMED

        record.updated_at = datetime.now()

        self._add_audit_log(
            record,
            RecordSource.MANUAL_CONFIRM,
            "resolve_conflict",
            old_value=old_record,
            new_value=self._record_to_dict(record),
            operator=operator,
            remark=remark,
        )

        return record

    def reject_record(
        self,
        record_id: str,
        reason: str,
        operator: str,
    ) -> ClaimRecord:
        record = self.records[record_id]
        old_record = self._record_to_dict(record)
        record.status = RecordStatus.REJECTED
        record.updated_at = datetime.now()

        self._add_audit_log(
            record,
            RecordSource.MANUAL_CONFIRM,
            "reject_record",
            old_value=old_record,
            new_value=self._record_to_dict(record),
            operator=operator,
            remark=f"驳回: {reason}",
        )

        return record

    def run_self_check(self, record_id: Optional[str] = None) -> List[SelfCheckResult]:
        results = []
        target_records = (
            [self.records[record_id]] if record_id else list(self.records.values())
        )

        results.append(self._check_duplicate_import(target_records))
        results.append(self._check_song_name_alias_records(target_records))
        results.append(self._check_recalc_after_update(target_records))
        results.append(self._check_export_consistency(target_records))

        return results

    def _check_duplicate_import(self, records: List[ClaimRecord]) -> SelfCheckResult:
        seen = set()
        duplicates = []
        for r in records:
            key = (r.lesson_date, r.teacher, r.student, r.song_live_name)
            if key in seen:
                duplicates.append(r.record_id)
            seen.add(key)

        return SelfCheckResult(
            check_id=self._generate_id(),
            check_type=SelfCheckType.DUPLICATE_IMPORT,
            passed=len(duplicates) == 0,
            message=f"检测到 {len(duplicates)} 条重复导入记录" if duplicates else "无重复导入",
            details={"duplicate_record_ids": duplicates},
        )

    def _check_song_name_alias_records(
        self, records: List[ClaimRecord]
    ) -> SelfCheckResult:
        alias_records = []
        for r in records:
            if (
                r.song_live_name
                and r.song_copyright_name
                and r.song_live_name != r.song_copyright_name
            ):
                alias_records.append(
                    {
                        "record_id": r.record_id,
                        "live_name": r.song_live_name,
                        "copyright_name": r.song_copyright_name,
                        "status": r.status.value,
                    }
                )

        return SelfCheckResult(
            check_id=self._generate_id(),
            check_type=SelfCheckType.SONG_NAME_ALIAS,
            passed=all(r["status"] != "normal" for r in alias_records),
            message=f"检测到 {len(alias_records)} 条歌曲别名记录，均需人工复核" if alias_records else "无歌曲别名记录",
            details={"alias_records": alias_records},
        )

    def _check_recalc_after_update(
        self, records: List[ClaimRecord]
    ) -> SelfCheckResult:
        outdated = []
        for r in records:
            if r.ticket_imported and not r.calculation_meta:
                outdated.append(r.record_id)

        return SelfCheckResult(
            check_id=self._generate_id(),
            check_type=SelfCheckType.RECALC_AFTER_UPDATE,
            passed=len(outdated) == 0,
            message=f"{len(outdated)} 条记录补录后未重新计算" if outdated else "所有记录补录后均已重算",
            details={"outdated_record_ids": outdated},
        )

    def _check_export_consistency(
        self, records: List[ClaimRecord]
    ) -> SelfCheckResult:
        all_consistent = True
        inconsistent = []
        for r in records:
            exported = self._record_to_export_dict(r)
            displayed = self._record_to_display_dict(r)
            if exported != displayed:
                all_consistent = False
                inconsistent.append(r.record_id)

        return SelfCheckResult(
            check_id=self._generate_id(),
            check_type=SelfCheckType.EXPORT_CONSISTENCY,
            passed=all_consistent,
            message="所有记录展示、接口、导出一致" if all_consistent else f"{len(inconsistent)} 条记录展示/导出不一致",
            details={"inconsistent_record_ids": inconsistent},
        )

    def _record_to_dict(self, record: ClaimRecord) -> Dict:
        return {
            "record_id": record.record_id,
            "lesson_date": record.lesson_date,
            "teacher": record.teacher,
            "student": record.student,
            "song_live_name": record.song_live_name,
            "song_copyright_name": record.song_copyright_name,
            "attendance_count": record.attendance_count,
            "raw_remark": record.raw_remark,
            "status": record.status.value,
            "source": record.source.value,
        }

    def get_record(self, record_id: str) -> ClaimRecord:
        return self.records[record_id]

    def get_all_records(self) -> List[ClaimRecord]:
        return list(self.records.values())

    def _record_to_export_dict(self, record: ClaimRecord) -> Dict:
        return self._record_to_unified_dict(record)

    def _record_to_display_dict(self, record: ClaimRecord) -> Dict:
        return self._record_to_unified_dict(record)

    def _record_to_unified_dict(self, record: ClaimRecord) -> Dict:
        result = {
            "record_id": record.record_id,
            "lesson_date": record.lesson_date,
            "teacher": record.teacher,
            "student": record.student,
            "song_live_name": record.song_live_name,
            "song_copyright_name": record.song_copyright_name,
            "attendance_count": record.attendance_count,
            "raw_remark": record.raw_remark,
            "status": record.status.value,
            "status_text": self._get_status_text(record.status),
            "has_conflicts": len(record.conflicts) > 0,
            "conflict_count": len(record.conflicts),
            "ticket_imported": record.ticket_imported,
            "weekly_report_generated": record.weekly_report_generated,
        }

        if record.calculation_meta:
            result["calculation_meta"] = {
                "param_version": record.calculation_meta.param_version,
                "decision_reason": record.calculation_meta.decision_reason,
                "calculated_at": record.calculation_meta.calculated_at.isoformat(),
            }

        if record.conflicts:
            result["conflicts"] = [
                {
                    "conflict_id": c.conflict_id,
                    "conflict_type": c.conflict_type.value,
                    "field_name": c.field_name,
                    "sign_in_value": c.sign_in_value,
                    "ticket_value": c.ticket_value,
                    "description": c.description,
                    "resolved": c.resolved,
                    "resolution": c.resolution,
                }
                for c in record.conflicts
            ]

        return result

    def _get_status_text(self, status: RecordStatus) -> str:
        mapping = {
            RecordStatus.PENDING_REVIEW: "待复核",
            RecordStatus.CONFLICT: "存在冲突",
            RecordStatus.CONFIRMED: "已确认",
            RecordStatus.REJECTED: "已驳回",
            RecordStatus.NORMAL: "正常",
        }
        return mapping.get(status, status.value)
