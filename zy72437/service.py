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
    RemarkHistory,
    DuplicateType,
)


class ClaimRecordService:
    def __init__(self):
        self.records: Dict[str, ClaimRecord] = {}
        self.param_version = "v1.1.0"

    def _generate_id(self) -> str:
        return str(uuid.uuid4())

    def _make_remark_key(self, data: Dict) -> Tuple:
        return (
            data.get("lesson_date"),
            data.get("teacher"),
            data.get("student"),
            data.get("song_live_name"),
            data.get("song_copyright_name"),
        )

    def _make_record_key(self, record: ClaimRecord) -> Tuple:
        return (
            record.lesson_date,
            record.teacher,
            record.student,
            record.song_live_name,
            record.song_copyright_name,
        )

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

    def _add_remark_history(
        self,
        record: ClaimRecord,
        source: RecordSource,
        remark_text: str,
        modified_by: Optional[str] = None,
        change_reason: Optional[str] = None,
    ):
        history = RemarkHistory(
            history_id=self._generate_id(),
            source=source,
            remark_text=remark_text,
            modified_by=modified_by,
            modified_at=datetime.now(),
            change_reason=change_reason,
        )
        record.remark_histories.append(history)

    def _check_song_name_alias(self, record: ClaimRecord, operator: Optional[str] = None):
        if record.song_live_name and record.song_copyright_name:
            if record.song_live_name != record.song_copyright_name:
                old_status = record.status
                record.status = RecordStatus.PENDING_REVIEW
                record.calculation_meta = CalculationMeta(
                    param_version=self.param_version,
                    decision_reason=(
                        f"同一首歌存在现场名 '{record.song_live_name}' "
                        f"与版权名 '{record.song_copyright_name}' 不一致，"
                        f"保留现场名+版权名双字段，不自动归为正常，"
                        f"需音乐老师许老师人工复核。"
                        f"（原状态: {old_status.value}）"
                    ),
                )
                return True
        return False

    def import_sign_in_photos(
        self,
        data_list: List[Dict],
        operator: Optional[str] = None,
    ) -> Dict:
        created_records: List[ClaimRecord] = []
        new_records: List[ClaimRecord] = []
        current_batch_duplicates: List[Dict] = []
        historical_duplicates: List[Dict] = []

        existing_keys = {
            self._make_record_key(r): r.record_id
            for r in self.records.values()
        }
        batch_seen_keys: Dict[Tuple, str] = {}

        for data in data_list:
            key = self._make_remark_key(data)

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

            if key in batch_seen_keys:
                record.duplicate_type = DuplicateType.CURRENT_BATCH_DUPLICATE
                record.duplicate_of_record_id = batch_seen_keys[key]
                current_batch_duplicates.append(
                    {
                        "record_id": record.record_id,
                        "duplicate_of": batch_seen_keys[key],
                        "key": {
                            "lesson_date": key[0],
                            "teacher": key[1],
                            "student": key[2],
                            "song_live_name": key[3],
                            "song_copyright_name": key[4],
                        },
                    }
                )
            elif key in existing_keys:
                record.duplicate_type = DuplicateType.HISTORICAL_DUPLICATE
                record.duplicate_of_record_id = existing_keys[key]
                historical_duplicates.append(
                    {
                        "record_id": record.record_id,
                        "duplicate_of": existing_keys[key],
                        "key": {
                            "lesson_date": key[0],
                            "teacher": key[1],
                            "student": key[2],
                            "song_live_name": key[3],
                            "song_copyright_name": key[4],
                        },
                    }
                )
            else:
                record.duplicate_type = DuplicateType.NEW
                new_records.append(record)
                batch_seen_keys[key] = record.record_id

            self._check_song_name_alias(record, operator)

            if data.get("raw_remark"):
                self._add_remark_history(
                    record,
                    RecordSource.SIGN_IN_PHOTO,
                    data["raw_remark"],
                    modified_by=operator,
                    change_reason="课时签到照片原始备注导入",
                )

            self.records[record.record_id] = record

            self._add_audit_log(
                record,
                RecordSource.SIGN_IN_PHOTO,
                "import_sign_in",
                new_value=self._record_to_dict(record),
                operator=operator,
                remark=(
                    f"导入课时签到照片 - "
                    f"类型: {record.duplicate_type.value if record.duplicate_type else 'unknown'}"
                    + (
                        f", 与 {record.duplicate_of_record_id} 重复"
                        if record.duplicate_of_record_id
                        else ""
                    )
                ),
            )
            created_records.append(record)

        return {
            "records": created_records,
            "summary": {
                "total_input": len(data_list),
                "total_created": len(created_records),
                "new_count": len(new_records),
                "current_batch_duplicate_count": len(current_batch_duplicates),
                "historical_duplicate_count": len(historical_duplicates),
                "song_alias_needs_review_count": sum(
                    1
                    for r in created_records
                    if r.song_live_name
                    and r.song_copyright_name
                    and r.song_live_name != r.song_copyright_name
                ),
            },
            "current_batch_duplicates": current_batch_duplicates,
            "historical_duplicates": historical_duplicates,
        }

    def import_ticket_export(
        self,
        record_id: str,
        ticket_data: Dict,
        operator: Optional[str] = None,
    ) -> ClaimRecord:
        record = self.records[record_id]
        old_record = self._record_to_dict(record)
        old_status = record.status.value

        conflicts = self._detect_conflicts(record, ticket_data)
        record.conflicts.extend(conflicts)

        ticket_remark = ticket_data.get("remark", "")
        if ticket_remark:
            old_ticket_remark = record.ticket_remark
            record.ticket_remark = ticket_remark
            self._add_remark_history(
                record,
                RecordSource.TICKET_EXPORT,
                ticket_remark,
                modified_by=operator,
                change_reason="票务导出表备注补录"
                + (f"（原值存在: '{old_ticket_remark}'，已保留历史）" if old_ticket_remark else ""),
            )

        if conflicts:
            record.status = RecordStatus.CONFLICT
        else:
            if not record.song_live_name and ticket_data.get("song_name"):
                record.song_live_name = ticket_data.get("song_name")
            record.attendance_count = ticket_data.get(
                "attendance_count", record.attendance_count
            )

            has_alias = self._check_song_name_alias(record, operator)

            if has_alias:
                pass
            else:
                if record.status == RecordStatus.PENDING_REVIEW:
                    record.status = RecordStatus.NORMAL
                elif record.status == RecordStatus.CONFLICT:
                    pass

        record.ticket_imported = True
        record.updated_at = datetime.now()

        status_changes = f"{old_status} -> {record.status.value}"
        alias_note = ""
        if (
            record.song_live_name
            and record.song_copyright_name
            and record.song_live_name != record.song_copyright_name
        ):
            alias_note = (
                f"；歌曲别名保留: 现场名='{record.song_live_name}' "
                f"版权名='{record.song_copyright_name}'，状态未归为正常，留待许老师复核"
            )

        self._add_audit_log(
            record,
            RecordSource.TICKET_EXPORT,
            "import_ticket",
            old_value=old_record,
            new_value=self._record_to_dict(record),
            operator=operator,
            remark=(
                f"导入票务导出表，冲突数: {len(conflicts)}；"
                f"状态变化: [{status_changes}]{alias_note}"
            ),
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
                    description=(
                        f"【冲突证据】课时签到歌曲名 '{record.song_live_name}' "
                        f"与票务导出 '{ticket_song}' 不一致，"
                        f"请许老师确认采用哪个值，不要自动拍板"
                    ),
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
                    description=(
                        f"【冲突证据】课时签到人数 {record.attendance_count} "
                        f"与票务导出 {ticket_attendance} 不一致，"
                        f"请许老师确认采用哪个值，不要自动拍板"
                    ),
                )
            )

        ticket_copy_name = ticket_data.get("song_copyright_name")
        if (
            ticket_copy_name
            and record.song_copyright_name
            and ticket_copy_name != record.song_copyright_name
        ):
            conflicts.append(
                ConflictEvidence(
                    conflict_id=self._generate_id(),
                    conflict_type=ConflictType.SONG_NAME_MISMATCH,
                    field_name="song_copyright_name",
                    sign_in_value=record.song_copyright_name,
                    ticket_value=ticket_copy_name,
                    description=(
                        f"【冲突证据】课时签到版权名 '{record.song_copyright_name}' "
                        f"与票务导出版权名 '{ticket_copy_name}' 不一致，"
                        f"请许老师确认采用哪个值，不要自动拍板"
                    ),
                )
            )
        elif ticket_copy_name and not record.song_copyright_name:
            record.song_copyright_name = ticket_copy_name
        elif (
            ticket_copy_name
            and record.song_copyright_name
            and ticket_copy_name == record.song_copyright_name
        ):
            pass

        return conflicts

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
        old_status = record.status.value

        conflict = next(c for c in record.conflicts if c.conflict_id == conflict_id)
        conflict.resolved = True
        conflict.resolved_by = operator
        conflict.resolved_at = datetime.now()
        conflict.resolution = resolution

        if use_sign_in_value:
            final_value = conflict.sign_in_value
            choice_note = f"采用课时签到数据: {conflict.sign_in_value}"
        else:
            final_value = conflict.ticket_value
            choice_note = f"采用票务导出数据: {conflict.ticket_value}"

        remark = f"人工确认[{conflict.field_name}] - {choice_note}。原因: {resolution}"

        if conflict.field_name == "song_name":
            old_song = record.song_live_name
            record.song_live_name = final_value
            remark += f"；现场名从 '{old_song}' 改为 '{final_value}'"
        elif conflict.field_name == "attendance_count":
            old_count = record.attendance_count
            record.attendance_count = final_value
            remark += f"；人数从 {old_count} 改为 {final_value}"
        elif conflict.field_name == "song_copyright_name":
            old_copy = record.song_copyright_name
            record.song_copyright_name = final_value
            remark += f"；版权名从 '{old_copy}' 改为 '{final_value}'"

        unresolved = [c for c in record.conflicts if not c.resolved]

        has_alias = self._check_song_name_alias(record, operator)

        if unresolved:
            record.status = RecordStatus.CONFLICT
            remark += f"；仍有 {len(unresolved)} 个冲突未解决"
        else:
            if has_alias:
                record.status = RecordStatus.PENDING_REVIEW
                remark += (
                    "；全部票务冲突已解决，但歌曲现场名/版权名仍有别名，"
                    "保持待复核，需许老师确认，不归为正常或已确认"
                )
            else:
                record.status = RecordStatus.CONFIRMED
                remark += "；全部冲突解决，状态归为已确认"

        remark += f"；状态变化: [{old_status} -> {record.status.value}]"

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
        old_status = record.status.value
        record.status = RecordStatus.REJECTED
        record.updated_at = datetime.now()

        self._add_audit_log(
            record,
            RecordSource.MANUAL_CONFIRM,
            "reject_record",
            old_value=old_record,
            new_value=self._record_to_dict(record),
            operator=operator,
            remark=f"驳回记录，原因: {reason}；状态变化: [{old_status} -> {record.status.value}]",
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
            key = (r.lesson_date, r.teacher, r.student, r.song_live_name, r.song_copyright_name)
            if key in seen:
                duplicates.append(
                    {
                        "record_id": r.record_id,
                        "duplicate_type": r.duplicate_type.value if r.duplicate_type else "unknown",
                        "duplicate_of": r.duplicate_of_record_id,
                    }
                )
            seen.add(key)

        return SelfCheckResult(
            check_id=self._generate_id(),
            check_type=SelfCheckType.DUPLICATE_IMPORT,
            passed=len(duplicates) == 0,
            message=f"检测到 {len(duplicates)} 条重复导入记录（已分类标记）" if duplicates else "无重复导入",
            details={"duplicate_records": duplicates},
        )

    def _check_song_name_alias_records(
        self, records: List[ClaimRecord]
    ) -> SelfCheckResult:
        alias_records = []
        wrongly_normal = []
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
                        "has_calculation_meta": r.calculation_meta is not None,
                    }
                )
                if r.status == RecordStatus.NORMAL or r.status == RecordStatus.CONFIRMED:
                    wrongly_normal.append(r.record_id)

        passed = len(wrongly_normal) == 0 and all(
            r["has_calculation_meta"] for r in alias_records
        )

        return SelfCheckResult(
            check_id=self._generate_id(),
            check_type=SelfCheckType.SONG_NAME_ALIAS,
            passed=passed,
            message=(
                f"检测到 {len(alias_records)} 条歌曲别名记录；"
                + (
                    f"其中 {len(wrongly_normal)} 条状态异常（应待复核）"
                    if wrongly_normal
                    else "均正确保留为待复核状态"
                )
            )
            if alias_records
            else "无歌曲别名记录",
            details={
                "alias_records": alias_records,
                "wrongly_normalized_ids": wrongly_normal,
            },
        )

    def _check_recalc_after_update(
        self, records: List[ClaimRecord]
    ) -> SelfCheckResult:
        outdated = []
        alias_without_meta = []
        for r in records:
            if r.ticket_imported:
                if r.calculation_meta is None:
                    has_alias = (
                        r.song_live_name
                        and r.song_copyright_name
                        and r.song_live_name != r.song_copyright_name
                    )
                    if has_alias:
                        outdated.append(r.record_id)
                        alias_without_meta.append(r.record_id)

        return SelfCheckResult(
            check_id=self._generate_id(),
            check_type=SelfCheckType.RECALC_AFTER_UPDATE,
            passed=len(outdated) == 0,
            message=(
                f"{len(outdated)} 条歌曲别名记录补录票务后未重新标记"
                if outdated
                else "所有别名记录补录后均已正确重算并标记"
            ),
            details={"outdated_alias_record_ids": alias_without_meta},
        )

    def _check_export_consistency(
        self, records: List[ClaimRecord]
    ) -> SelfCheckResult:
        all_consistent = True
        inconsistent = []
        for r in records:
            exported = self._record_to_export_dict(r)
            displayed = self._record_to_display_dict(r)
            api_returned = self._record_to_unified_dict(r)
            if exported != displayed or exported != api_returned:
                all_consistent = False
                inconsistent.append(r.record_id)

        return SelfCheckResult(
            check_id=self._generate_id(),
            check_type=SelfCheckType.EXPORT_CONSISTENCY,
            passed=all_consistent,
            message="展示/接口/导出三方数据完全一致" if all_consistent else f"{len(inconsistent)} 条记录三方数据不一致",
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
            "ticket_remark": record.ticket_remark,
            "status": record.status.value,
            "source": record.source.value,
            "duplicate_type": record.duplicate_type.value if record.duplicate_type else None,
        }

    def get_record(self, record_id: str) -> ClaimRecord:
        return self.records[record_id]

    def get_all_records(self) -> List[ClaimRecord]:
        return list(self.records.values())

    def get_state_change_trail(self, record_id: str) -> List[Dict]:
        record = self.get_record(record_id)
        trail = []
        for log in record.audit_logs:
            change = {}
            if log.old_value and log.new_value:
                change["status_change"] = (
                    f"{log.old_value.get('status')} -> {log.new_value.get('status')}"
                )
                change["old_status"] = log.old_value.get("status")
                change["new_status"] = log.new_value.get("status")
                changed_fields = []
                tracked_fields = [
                    ("song_live_name", "歌曲现场名"),
                    ("song_copyright_name", "歌曲版权名"),
                    ("attendance_count", "出勤课时数"),
                    ("raw_remark", "签到原始备注"),
                    ("ticket_remark", "票务备注"),
                    ("status", "记录状态"),
                    ("duplicate_type", "重复类型"),
                ]
                for k, field_label in tracked_fields:
                    ov = log.old_value.get(k)
                    nv = log.new_value.get(k)
                    if ov != nv:
                        changed_fields.append(
                            {
                                "field_key": k,
                                "field_label": field_label,
                                "old_value": ov,
                                "new_value": nv,
                            }
                        )
                change["field_changes"] = changed_fields
                change["field_change_count"] = len(changed_fields)
            else:
                change["field_changes"] = []
                change["field_change_count"] = 0

            conflict_reason = ""
            if record.conflicts and log.action in ("import_ticket", "resolve_conflict", "confirm_song_alias"):
                unresolved_at_time = [
                    c.description for c in record.conflicts if not c.resolved
                ]
                if unresolved_at_time:
                    conflict_reason = "；".join(unresolved_at_time)

            processing_result = ""
            if log.action == "import_sign_in":
                processing_result = "课时签到照片导入完成，记录已建立"
            elif log.action == "import_ticket":
                processing_result = (
                    f"票务补录完成；冲突数={len(record.conflicts)}；"
                    f"状态: {change.get('new_status', '未知')}"
                )
            elif log.action == "resolve_conflict":
                remaining = sum(1 for c in record.conflicts if not c.resolved)
                processing_result = f"冲突已处理；剩余未解决冲突数={remaining}"
            elif log.action == "confirm_song_alias":
                remaining = sum(1 for c in record.conflicts if not c.resolved)
                if remaining > 0:
                    processing_result = f"别名已确认，但仍有 {remaining} 条票务冲突未解决，暂不能生成周报"
                else:
                    processing_result = "别名已确认，且无未解决票务冲突，可生成周报"
            elif log.action == "generate_weekly_report":
                processing_result = "已纳入店长周报生成"
            elif log.action == "reject_record":
                processing_result = "记录已驳回"

            change_reason = ""
            if log.action == "confirm_song_alias":
                if record.calculation_meta:
                    change_reason = record.calculation_meta.decision_reason
            elif log.action == "resolve_conflict":
                resolved_log = next(
                    (c for c in record.conflicts if c.resolution),
                    None,
                )
                if resolved_log:
                    change_reason = resolved_log.resolution

            trail.append(
                {
                    "log_id": log.log_id,
                    "source": log.source.value,
                    "source_text": self._get_source_text(log.source),
                    "action": log.action,
                    "action_text": self._get_action_text_for_trail(log.action),
                    "operator": log.operator,
                    "timestamp": log.timestamp.isoformat(),
                    "remark": log.remark,
                    "change_detail": change,
                    "conflict_reason": conflict_reason,
                    "processing_result": processing_result,
                    "change_reason": change_reason,
                }
            )
        return trail

    def _record_to_export_dict(self, record: ClaimRecord) -> Dict:
        return self._record_to_unified_dict(record)

    def _record_to_display_dict(self, record: ClaimRecord) -> Dict:
        return self._record_to_unified_dict(record)

    def _record_to_unified_dict(self, record: ClaimRecord) -> Dict:
        unresolved_conflicts = [c for c in record.conflicts if not c.resolved]
        resolved_conflicts = [c for c in record.conflicts if c.resolved]
        has_song_alias = bool(
            record.song_live_name
            and record.song_copyright_name
            and record.song_live_name != record.song_copyright_name
        )
        can_generate_weekly_report = (
            len(unresolved_conflicts) == 0
            and not has_song_alias
            and record.status in (RecordStatus.CONFIRMED, RecordStatus.NORMAL)
        )

        last_audit = record.audit_logs[-1] if record.audit_logs else None
        latest_operator = last_audit.operator if last_audit else None
        latest_action = last_audit.action if last_audit else None
        latest_action_text = self._get_action_text_for_trail(latest_action) if latest_action else ""
        latest_remark = last_audit.remark if last_audit else ""

        processing_judgment = ""
        if unresolved_conflicts:
            processing_judgment = (
                f"仍有 {len(unresolved_conflicts)} 条票务冲突未解决，不能生成周报，请先处理。"
            )
        elif has_song_alias:
            processing_judgment = "歌曲现场名与版权名不一致（别名），待许老师确认后才能生成周报。"
        elif record.status == RecordStatus.PENDING_REVIEW:
            processing_judgment = "记录处于待复核状态，请人工确认后再生成周报。"
        elif record.status == RecordStatus.REJECTED:
            processing_judgment = "该记录已驳回，不纳入周报。"
        elif record.status in (RecordStatus.CONFIRMED, RecordStatus.NORMAL):
            processing_judgment = "无冲突、无别名、状态正常，可生成周报。"

        result = {
            "record_id": record.record_id,
            "lesson_date": record.lesson_date,
            "teacher": record.teacher,
            "student": record.student,
            "song_live_name": record.song_live_name,
            "song_copyright_name": record.song_copyright_name,
            "attendance_count": record.attendance_count,
            "raw_remark": record.raw_remark,
            "ticket_remark": record.ticket_remark,
            "status": record.status.value,
            "status_text": self._get_status_text(record.status),
            "has_conflicts": len(record.conflicts) > 0,
            "conflict_count": len(record.conflicts),
            "unresolved_conflict_count": len(unresolved_conflicts),
            "resolved_conflict_count": len(resolved_conflicts),
            "ticket_imported": record.ticket_imported,
            "weekly_report_generated": record.weekly_report_generated,
            "duplicate_type": record.duplicate_type.value if record.duplicate_type else None,
            "duplicate_type_text": self._get_duplicate_type_text(record.duplicate_type),
            "duplicate_of_record_id": record.duplicate_of_record_id,
            "has_song_alias": has_song_alias,
            "can_generate_weekly_report": can_generate_weekly_report,
            "processing_judgment": processing_judgment,
            "latest_operator": latest_operator,
            "latest_action": latest_action,
            "latest_action_text": latest_action_text,
            "latest_remark": latest_remark,
            "created_at": record.created_at.isoformat(),
            "updated_at": record.updated_at.isoformat(),
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
                    "resolved_by": c.resolved_by,
                    "resolved_at": c.resolved_at.isoformat() if c.resolved_at else None,
                }
                for c in record.conflicts
            ]

        if record.remark_histories:
            result["remark_histories"] = [
                {
                    "history_id": h.history_id,
                    "source": h.source.value,
                    "source_text": self._get_source_text(h.source),
                    "remark_text": h.remark_text,
                    "modified_by": h.modified_by,
                    "modified_at": h.modified_at.isoformat(),
                    "change_reason": h.change_reason,
                }
                for h in record.remark_histories
            ]

        return result

    def _get_status_text(self, status: RecordStatus) -> str:
        mapping = {
            RecordStatus.PENDING_REVIEW: "待复核（需许老师人工确认）",
            RecordStatus.CONFLICT: "存在冲突（请先列证据让许老师选择）",
            RecordStatus.CONFIRMED: "已确认（许老师已人工拍板）",
            RecordStatus.REJECTED: "已驳回",
            RecordStatus.NORMAL: "正常（无别名无冲突）",
        }
        return mapping.get(status, status.value)

    def _get_duplicate_type_text(self, dup_type: Optional[DuplicateType]) -> str:
        if not dup_type:
            return ""
        mapping = {
            DuplicateType.NEW: "新记录",
            DuplicateType.CURRENT_BATCH_DUPLICATE: "本次导入批次内重复",
            DuplicateType.HISTORICAL_DUPLICATE: "与历史导入记录重复",
        }
        return mapping.get(dup_type, dup_type.value)

    def _get_source_text(self, source: RecordSource) -> str:
        mapping = {
            RecordSource.SIGN_IN_PHOTO: "课时签到照片",
            RecordSource.TICKET_EXPORT: "票务导出表补录",
            RecordSource.MANUAL_CONFIRM: "人工确认",
        }
        return mapping.get(source, source.value)

    def _get_action_text_for_trail(self, action: str) -> str:
        mapping = {
            "import_sign_in": "导入课时签到照片",
            "import_ticket": "导入票务导出表",
            "resolve_conflict": "人工解决冲突",
            "reject_record": "驳回记录",
            "generate_weekly_report": "生成店长周报",
            "confirm_song_alias": "人工确认歌曲别名",
        }
        return mapping.get(action, action)
