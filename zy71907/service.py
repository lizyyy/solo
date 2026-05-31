import csv
from typing import List, Dict, Optional, Tuple
from datetime import datetime
from database import Database, Record, RecordStatus, SourceType, HistoryLog


class MusicReviewService:
    def __init__(self, db_path: str = "music_review.db"):
        self.db = Database(db_path)

    def import_records(self, file_path: str, source: SourceType,
                       operator: str, source_note: str = "") -> Tuple[int, List[str]]:
        imported_count = 0
        warnings = []

        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                try:
                    student_name = row.get('学生姓名', '').strip()
                    song_title = row.get('曲目', '').strip()
                    voice_part = row.get('声部', '').strip()

                    if not all([student_name, song_title, voice_part]):
                        warnings.append(f"第{row_num}行：缺少必要信息，跳过")
                        continue

                    duplicates = self.db.find_duplicates(student_name, song_title)
                    pending_reason = ""

                    if duplicates:
                        duplicate_sources = [d.source.value for d in duplicates]
                        pending_reason = f"重复导入：已存在来自 {', '.join(duplicate_sources)} 的记录"

                    record = Record(
                        id=None,
                        student_name=student_name,
                        song_title=song_title,
                        voice_part=voice_part,
                        status=RecordStatus.PENDING if pending_reason else RecordStatus.CONFIRMED,
                        source=source,
                        source_note=source_note or row.get('备注', ''),
                        pending_reason=pending_reason,
                        created_at="",
                        updated_at="",
                        created_by=operator,
                        updated_by=operator
                    )

                    self.db.add_record(record)
                    imported_count += 1

                except Exception as e:
                    warnings.append(f"第{row_num}行：导入失败 - {str(e)}")

        return imported_count, warnings

    def withdraw_record(self, record_id: int, operator: str, reason: str) -> bool:
        record = self.db.get_record(record_id)
        if not record:
            return False

        if record.status == RecordStatus.WITHDRAWN:
            return False

        self.db.update_record(
            record_id=record_id,
            updates={
                'status': RecordStatus.WITHDRAWN.value,
                'pending_reason': f"撤回原因：{reason}"
            },
            changed_by=operator,
            note=f"撤回记录，原因：{reason}"
        )
        return True

    def confirm_record(self, record_id: int, operator: str, note: str = "") -> bool:
        record = self.db.get_record(record_id)
        if not record:
            return False

        if record.status == RecordStatus.WITHDRAWN:
            return False

        self.db.update_record(
            record_id=record_id,
            updates={
                'status': RecordStatus.CONFIRMED.value,
                'pending_reason': ''
            },
            changed_by=operator,
            note=note or "确认记录"
        )
        return True

    def update_song_info(self, record_id: int, song_title: Optional[str],
                         voice_part: Optional[str], operator: str,
                         reason: str = "") -> bool:
        record = self.db.get_record(record_id)
        if not record:
            return False

        updates = {}
        if song_title is not None:
            updates['song_title'] = song_title
        if voice_part is not None:
            updates['voice_part'] = voice_part

        if not updates:
            return False

        self.db.update_record(
            record_id=record_id,
            updates=updates,
            changed_by=operator,
            note=reason or "修正选曲信息"
        )
        return True

    def get_pending_records(self) -> List[Record]:
        return self.db.list_records(status=RecordStatus.PENDING.value)

    def get_record_detail(self, record_id: int) -> Optional[Dict]:
        record = self.db.get_record(record_id)
        if not record:
            return None

        history = self.db.get_history(record_id)
        return {
            'record': record,
            'history': history
        }

    def get_duplicate_summary(self) -> List[Dict]:
        return self.db.get_duplicate_stats()

    def export_records(self, file_path: str, status: Optional[str] = None,
                       include_withdrawn: bool = False) -> int:
        records = self.db.list_records(status=status)

        if not include_withdrawn:
            records = [r for r in records if r.status != RecordStatus.WITHDRAWN]

        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                '记录ID', '学生姓名', '曲目', '声部', '状态', '来源',
                '来源备注', '待处理原因', '创建时间', '更新时间',
                '创建人', '更新人'
            ])

            for r in records:
                writer.writerow([
                    r.id, r.student_name, r.song_title, r.voice_part,
                    r.status.value, r.source.value, r.source_note,
                    r.pending_reason, r.created_at, r.updated_at,
                    r.created_by, r.updated_by
                ])

        return len(records)

    def export_summary(self, file_path: str) -> Dict:
        records = self.db.list_records()
        records = [r for r in records if r.status != RecordStatus.WITHDRAWN]

        summary = {
            '总记录数': len(records),
            '声部长记录': len([r for r in records if r.source == SourceType.VOICE_LEADER]),
            '节拍器记录': len([r for r in records if r.source == SourceType.METRONOME]),
            '手动录入': len([r for r in records if r.source == SourceType.MANUAL]),
            '待处理记录': len([r for r in records if r.status == RecordStatus.PENDING]),
            '已确认记录': len([r for r in records if r.status == RecordStatus.CONFIRMED]),
        }

        voice_parts = {}
        for r in records:
            voice_parts[r.voice_part] = voice_parts.get(r.voice_part, 0) + 1
        summary['声部分布'] = voice_parts

        duplicates = self.db.get_duplicate_stats()
        summary['重复记录组数'] = len(duplicates)
        summary['涉及重复记录数'] = sum(d['count'] for d in duplicates)

        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['统计项', '数值'])
            for k, v in summary.items():
                if isinstance(v, dict):
                    writer.writerow([k, ''])
                    for sub_k, sub_v in v.items():
                        writer.writerow([f'  {sub_k}', sub_v])
                else:
                    writer.writerow([k, v])

        return summary

    def compare_record_versions(self, record_id: int) -> List[Dict]:
        history = self.db.get_history(record_id)
        changes = []

        for log in history:
            if log.action == "修改" and log.field_name:
                changes.append({
                    '时间': log.changed_at,
                    '操作人': log.changed_by,
                    '字段': log.field_name,
                    '原值': log.old_value,
                    '新值': log.new_value,
                    '备注': log.note
                })

        return changes

    def add_manual_record(self, student_name: str, song_title: str,
                          voice_part: str, operator: str,
                          source_note: str = "") -> int:
        duplicates = self.db.find_duplicates(student_name, song_title)
        pending_reason = ""

        if duplicates:
            duplicate_sources = [d.source.value for d in duplicates]
            pending_reason = f"重复导入：已存在来自 {', '.join(duplicate_sources)} 的记录"

        record = Record(
            id=None,
            student_name=student_name,
            song_title=song_title,
            voice_part=voice_part,
            status=RecordStatus.PENDING if pending_reason else RecordStatus.CONFIRMED,
            source=SourceType.MANUAL,
            source_note=source_note,
            pending_reason=pending_reason,
            created_at="",
            updated_at="",
            created_by=operator,
            updated_by=operator
        )

        return self.db.add_record(record)
