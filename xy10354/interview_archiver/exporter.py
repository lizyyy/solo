import csv
from pathlib import Path
from typing import List, Optional

from .models import ActionItem, InterviewNote, SecurityLevel
from .storage import Storage


class Exporter:
    def __init__(self, storage: Storage):
        self.storage = storage

    def export_to_csv(self, output_path: str) -> tuple[int, bool]:
        notes = self.storage.get_all_interviews()
        path = Path(output_path)

        has_high_security = any(
            note.security_level in [SecurityLevel.CONFIDENTIAL, SecurityLevel.TOP_SECRET]
            for note in notes
        )

        rows = []
        for note in notes:
            for item in note.action_items:
                rows.append(self._action_item_to_row(note, item))

            if not note.action_items:
                rows.append(self._interview_to_row(note))

        with path.open('w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=[
                '客户名称', '访谈对象', '访谈日期', '保密级别',
                '行动项', '负责人', '截止日期', '完成状态', '完成日期',
                '关键问题', '文件路径'
            ])
            writer.writeheader()
            writer.writerows(rows)

        return len(rows), has_high_security

    def _action_item_to_row(self, note: InterviewNote, item: ActionItem) -> dict:
        return {
            '客户名称': note.customer_name or '',
            '访谈对象': note.interviewee or '',
            '访谈日期': note.interview_date.isoformat() if note.interview_date else '',
            '保密级别': note.security_level.value,
            '行动项': item.description,
            '负责人': item.owner or '',
            '截止日期': item.due_date.isoformat() if item.due_date else '',
            '完成状态': '已完成' if item.is_completed else '待处理',
            '完成日期': item.completed_date.isoformat() if item.completed_date else '',
            '关键问题': '\n'.join(note.key_questions) if note.key_questions else '',
            '文件路径': note.file_path,
        }

    def _interview_to_row(self, note: InterviewNote) -> dict:
        return {
            '客户名称': note.customer_name or '',
            '访谈对象': note.interviewee or '',
            '访谈日期': note.interview_date.isoformat() if note.interview_date else '',
            '保密级别': note.security_level.value,
            '行动项': '',
            '负责人': '',
            '截止日期': '',
            '完成状态': '',
            '完成日期': '',
            '关键问题': '\n'.join(note.key_questions) if note.key_questions else '',
            '文件路径': note.file_path,
        }
