from typing import List, Dict, Optional, Tuple, Any
from datetime import datetime
from data_models import (
    RoyaltyRecord, ImportBatch, RecordStatus, ChangeType, AuditLog, ReplayCommand
)


class RoyaltyEngine:
    def __init__(self):
        self.records: Dict[str, RoyaltyRecord] = {}
        self.batches: Dict[str, ImportBatch] = {}
        self.replay_commands: List[ReplayCommand] = []
        self._add_replay("RoyaltyEngine()", "初始化版税分摊引擎")

    def _add_replay(self, cmd: str, desc: str):
        self.replay_commands.append(ReplayCommand(command=cmd, description=desc))

    def step1_import_rehearsal(
        self,
        raw_rows: List[Dict],
        batch_name: str,
        operator: str = "店长老周",
        expected_cities_map: Optional[Dict[str, List[str]]] = None
    ) -> Tuple[ImportBatch, List[RoyaltyRecord]]:
        batch = ImportBatch(
            batch_name=batch_name,
            operator=operator,
            record_count=len(raw_rows),
            raw_file_name=f"{batch_name}_排练群接龙.xlsx"
        )
        self.batches[batch.batch_id] = batch

        imported = []
        for idx, row in enumerate(raw_rows, start=2):
            record = RoyaltyRecord(
                source_row=idx,
                musician_name=row.get("音乐人", ""),
                song_title=row.get("曲目", ""),
                authorized_cities=row.get("授权城市", "").split("、") if row.get("授权城市") else [],
                play_count=int(row.get("播放次数", 0)),
                contract_note=row.get("合同备注", ""),
                import_batch=batch.batch_id,
                raw_data=row
            )
            if expected_cities_map and record.song_title in expected_cities_map:
                record.expected_cities = expected_cities_map[record.song_title]
            record.add_audit_log(AuditLog(
                operator=operator,
                change_type=ChangeType.IMPORT,
                field_name="record",
                old_value=None,
                new_value=f"从第{idx}行导入",
                note=f"批次 {batch.batch_id}"
            ))
            self.records[record.record_id] = record
            imported.append(record)

        self._add_replay(
            f"step1_import_rehearsal(rows, '{batch_name}', '{operator}')",
            f"步骤1：导入排练群接龙 {len(imported)} 条记录"
        )
        return batch, imported

    def step2_review_contract(
        self,
        record_id: str,
        contract_note: str,
        authorized_cities: Optional[List[str]] = None,
        operator: str = "店长老周"
    ) -> RoyaltyRecord:
        record = self.records[record_id]
        old_note = record.contract_note
        record.contract_note = contract_note
        record.add_audit_log(AuditLog(
            operator=operator,
            change_type=ChangeType.CONTRACT_NOTE_UPDATE,
            field_name="contract_note",
            old_value=old_note,
            new_value=contract_note,
            note="补充合同页截图信息"
        ))
        if authorized_cities:
            old_cities = record.authorized_cities.copy()
            record.authorized_cities = authorized_cities
            record.add_audit_log(AuditLog(
                operator=operator,
                change_type=ChangeType.AREA_FIX,
                field_name="authorized_cities",
                old_value=old_cities,
                new_value=authorized_cities,
                note="修正授权地区"
            ))
        self._mark_affected_by_note(record_id)
        self._update_status_after_contract(record)
        self._add_replay(
            f"step2_review_contract('{record_id}', '{contract_note[:20]}...', {authorized_cities})",
            f"步骤2：复核合同 {record.musician_name} - {record.song_title}"
        )
        return record

    def _mark_affected_by_note(self, record_id: str):
        record = self.records[record_id]
        if record.status in (RecordStatus.AREA_MISSING, RecordStatus.VERIFICATION_PENDING):
            record.affected_by_note_update = True

    def _update_status_after_contract(self, record: RoyaltyRecord):
        if record.expected_cities:
            missing = set(record.expected_cities) - set(record.authorized_cities)
            if missing:
                record.status = RecordStatus.AREA_MISSING
                return
        if record.authorized_cities:
            record.status = RecordStatus.CONTRACT_REVIEWED
        else:
            record.status = RecordStatus.CONTRACT_PENDING

    def fix_missing_area(
        self,
        record_id: str,
        additional_cities: List[str],
        operator: str = "店长老周"
    ) -> RoyaltyRecord:
        record = self.records[record_id]
        old_cities = record.authorized_cities.copy()
        new_cities = list(set(old_cities + additional_cities))
        record.authorized_cities = new_cities
        record.status = RecordStatus.AREA_FIXED
        record.add_audit_log(AuditLog(
            operator=operator,
            change_type=ChangeType.AREA_FIX,
            field_name="authorized_cities",
            old_value=old_cities,
            new_value=new_cities,
            note=f"补录缺失城市: {additional_cities}"
        ))
        self._add_replay(
            f"fix_missing_area('{record_id}', {additional_cities})",
            f"补录授权地区: {record.song_title} +{additional_cities}"
        )
        return record

    def step3_update_verification(
        self,
        verification_data: List[Dict],
        operator: str = "店长老周"
    ) -> List[RoyaltyRecord]:
        updated = []
        for vdata in verification_data:
            record_id = vdata.get("record_id")
            if record_id and record_id in self.records:
                record = self.records[record_id]
                old_verified = record.verified_count
                new_verified = int(vdata.get("verified_count", 0))
                record.verified_count = new_verified
                record.royalty_amount = new_verified * float(vdata.get("unit_price", 0.5))
                record.status = RecordStatus.VERIFIED
                record.add_audit_log(AuditLog(
                    operator=operator,
                    change_type=ChangeType.VERIFICATION_UPDATE,
                    field_name="verified_count",
                    old_value=old_verified,
                    new_value=new_verified,
                    note="课时核销单更新"
                ))
                updated.append(record)
        self._add_replay(
            f"step3_update_verification(data, '{operator}')",
            f"步骤3：核销单更新 {len(updated)} 条记录"
        )
        return updated

    def manual_edit(
        self,
        record_id: str,
        field: str,
        value: Any,
        operator: str = "店长老周",
        note: str = ""
    ) -> RoyaltyRecord:
        record = self.records[record_id]
        old_value = getattr(record, field, None)
        setattr(record, field, value)
        record.add_audit_log(AuditLog(
            operator=operator,
            change_type=ChangeType.MANUAL_EDIT,
            field_name=field,
            old_value=old_value,
            new_value=value,
            note=note or "人工修改"
        ))
        self._add_replay(
            f"manual_edit('{record_id}', '{field}', {value})",
            f"人工修改: {field} = {value}"
        )
        return record

    def get_records_by_status(self, status: RecordStatus) -> List[RoyaltyRecord]:
        return [r for r in self.records.values() if r.status == status]

    def get_affected_by_note(self) -> List[RoyaltyRecord]:
        return [r for r in self.records.values() if r.affected_by_note_update]

    def clear_affected_flags(self):
        for r in self.records.values():
            r.affected_by_note_update = False
        self._add_replay("clear_affected_flags()", "清除备注修改影响标记")
