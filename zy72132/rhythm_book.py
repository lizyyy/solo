from typing import List, Dict, Optional, Any
from datetime import datetime

from database import Record, RecordRepository
from importer import AudioFileImporter, ExcelImporter, ImportResult


class RecordUpdateResult:
    def __init__(self, success: bool, record: Record = None, changes: List[Dict] = None):
        self.success = success
        self.record = record
        self.changes = changes or []


class RhythmErrorBook:
    STATUS_OPTIONS = ["正常", "待确认", "已解决", "已废弃"]

    def __init__(self):
        from database import init_db
        init_db()

    def import_audio_directory(self, directory_path: str, batch_name: str = None) -> ImportResult:
        importer = AudioFileImporter()
        return importer.import_directory(directory_path, batch_name)

    def import_from_excel_csv(self, csv_path: str, source_detail: str = None) -> ImportResult:
        importer = ExcelImporter()
        return importer.import_from_csv(csv_path, source_detail or "曲目Excel导入")

    def add_manual_record(self,
                          file_name: str,
                          track_name: str,
                          source_type: str = "手动录入",
                          source_detail: str = "",
                          status: str = "正常",
                          notes: str = "",
                          exception_reason: str = "",
                          contract_deadline: str = "",
                          file_path: str = "",
                          changed_by: str = "system") -> Record:
        record = Record(
            file_name=file_name,
            file_path=file_path,
            track_name=track_name,
            source_type=source_type,
            source_detail=source_detail,
            status=status,
            notes=notes,
            exception_reason=exception_reason,
            contract_deadline=contract_deadline if contract_deadline else None
        )
        return RecordRepository.create(record, changed_by)

    def update_record(self,
                      record_id: int,
                      updates: Dict[str, Any],
                      changed_by: str,
                      change_reason: str) -> RecordUpdateResult:
        allowed_fields = {
            'status', 'notes', 'exception_reason', 'contract_deadline',
            'track_name', 'file_name', 'file_path', 'source_detail'
        }

        filtered_updates = {k: v for k, v in updates.items() if k in allowed_fields}
        if not filtered_updates:
            return RecordUpdateResult(False, None, [])

        if 'status' in filtered_updates and filtered_updates['status'] not in self.STATUS_OPTIONS:
            return RecordUpdateResult(False, None, [])

        updated_record = RecordRepository.update(
            record_id, filtered_updates, changed_by, change_reason
        )

        if updated_record:
            history = RecordRepository.get_history(record_id)
            new_changes = [h for h in history if h['change_reason'] == change_reason]
            return RecordUpdateResult(True, updated_record, new_changes)

        return RecordUpdateResult(False, None, [])

    def add_notes(self, record_id: int, notes: str, changed_by: str, append: bool = True) -> RecordUpdateResult:
        record = RecordRepository.get_by_id(record_id)
        if not record:
            return RecordUpdateResult(False, None, [])

        if append and record.notes:
            new_notes = f"{record.notes}\n[{datetime.now().strftime('%Y-%m-%d %H:%M')} {changed_by}]: {notes}"
        else:
            new_notes = notes

        return self.update_record(
            record_id,
            {'notes': new_notes},
            changed_by,
            "补录备注"
        )

    def resolve_issue(self, record_id: int, resolution_notes: str, changed_by: str) -> RecordUpdateResult:
        record = RecordRepository.get_by_id(record_id)
        if not record:
            return RecordUpdateResult(False, None, [])

        updates = {'status': '已解决'}
        if resolution_notes:
            if record.notes:
                updates['notes'] = f"{record.notes}\n【处理结果】{resolution_notes}"
            else:
                updates['notes'] = f"【处理结果】{resolution_notes}"

        return self.update_record(
            record_id,
            updates,
            changed_by,
            "标记已解决"
        )

    def get_record(self, record_id: int) -> Optional[Record]:
        return RecordRepository.get_by_id(record_id)

    def get_record_history(self, record_id: int) -> List[Dict]:
        return RecordRepository.get_history(record_id)

    def get_all_records(self) -> List[Record]:
        return RecordRepository.get_all()

    def get_records_by_status(self, status: str) -> List[Record]:
        all_records = RecordRepository.get_all()
        return [r for r in all_records if r.status == status]

    def format_changes_summary(self, changes: List[Dict]) -> str:
        if not changes:
            return "无变更"

        lines = []
        for change in changes:
            field_display = self._get_field_display_name(change['field_name'])
            old_val = change['old_value'] or '(空)'
            new_val = change['new_value'] or '(空)'
            lines.append(f"  - {field_display}: {old_val} → {new_val}")

        return "\n".join(lines)

    def _get_field_display_name(self, field_name: str) -> str:
        mapping = {
            'status': '状态',
            'notes': '备注',
            'exception_reason': '异常原因',
            'contract_deadline': '授权截止',
            'track_name': '曲目名称',
            'file_name': '文件名',
            'file_path': '文件路径',
            'source_detail': '来源详情',
            'version': '版本'
        }
        return mapping.get(field_name, field_name)

    def get_status_icon(self, status: str) -> str:
        mapping = {
            '正常': '✓',
            '待确认': '?',
            '已解决': '✓',
            '已废弃': '×'
        }
        return mapping.get(status, '')
