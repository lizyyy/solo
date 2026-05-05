import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from theater_audio_checker.models import (
    ReviewNote,
    CheckStatus
)


class NoteManager:
    """复核备注管理器"""

    def __init__(self, notes_file: Optional[str] = None):
        self.notes: Dict[str, ReviewNote] = {}
        self.notes_file = notes_file
        
        if notes_file and os.path.exists(notes_file):
            self._load_from_file(notes_file)

    def _load_from_file(self, file_path: str):
        """从文件加载备注"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if isinstance(data, list):
                for item in data:
                    note = self._parse_note(item)
                    self.notes[note.note_id] = note
            elif isinstance(data, dict):
                if "items" in data:
                    for item in data["items"]:
                        note = self._parse_note(item)
                        self.notes[note.note_id] = note
                elif "notes" in data:
                    for item in data["notes"]:
                        note = self._parse_note(item)
                        self.notes[note.note_id] = note
        except Exception as e:
            raise ValueError(f"加载备注文件失败: {e}")

    @staticmethod
    def _parse_note(data: dict) -> ReviewNote:
        """解析备注数据"""
        if "status" in data and isinstance(data["status"], str):
            try:
                data["status"] = CheckStatus(data["status"])
            except ValueError:
                pass
        
        if "review_time" in data and isinstance(data["review_time"], str):
            try:
                data["review_time"] = datetime.fromisoformat(data["review_time"])
            except ValueError:
                pass
        
        return ReviewNote(**data)

    def add_note(
        self,
        item_type: str,
        item_id: str,
        reviewer: str,
        status: CheckStatus,
        comment: str,
        attachments: Optional[List[str]] = None
    ) -> ReviewNote:
        """
        添加复核备注
        
        Args:
            item_type: 项目类型: audio, schedule, device, check, issue
            item_id: 关联项目ID
            reviewer: 复核人
            status: 复核状态
            comment: 复核意见
            attachments: 附件列表
        """
        note_id = str(uuid.uuid4())
        
        note = ReviewNote(
            note_id=note_id,
            item_type=item_type,
            item_id=item_id,
            reviewer=reviewer,
            status=status,
            comment=comment,
            attachments=attachments or []
        )
        
        self.notes[note_id] = note
        return note

    def get_note(self, note_id: str) -> Optional[ReviewNote]:
        """获取指定备注"""
        return self.notes.get(note_id)

    def get_notes_for_item(self, item_id: str) -> List[ReviewNote]:
        """获取关联到指定项目的所有备注"""
        return [
            note for note in self.notes.values()
            if note.item_id == item_id
        ]

    def get_notes_by_type(self, item_type: str) -> List[ReviewNote]:
        """按类型获取备注"""
        return [
            note for note in self.notes.values()
            if note.item_type == item_type
        ]

    def get_all_notes(self) -> List[ReviewNote]:
        """获取所有备注"""
        return list(self.notes.values())

    def update_note(
        self,
        note_id: str,
        status: Optional[CheckStatus] = None,
        comment: Optional[str] = None,
        reviewer: Optional[str] = None
    ) -> Optional[ReviewNote]:
        """更新备注"""
        note = self.notes.get(note_id)
        if not note:
            return None
        
        if status is not None:
            note.status = status
        if comment is not None:
            note.comment = comment
        if reviewer is not None:
            note.reviewer = reviewer
        
        note.review_time = datetime.now()
        return note

    def remove_note(self, note_id: str) -> bool:
        """删除备注"""
        if note_id in self.notes:
            del self.notes[note_id]
            return True
        return False

    def save(self, file_path: Optional[str] = None):
        """保存备注到文件"""
        save_path = file_path or self.notes_file
        if not save_path:
            raise ValueError("未指定保存路径")
        
        path = Path(save_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        notes_data = []
        for note in self.notes.values():
            note_dict = note.dict()
            if isinstance(note_dict.get("review_time"), datetime):
                note_dict["review_time"] = note_dict["review_time"].isoformat()
            if hasattr(note_dict.get("status"), "value"):
                note_dict["status"] = note_dict["status"].value
            notes_data.append(note_dict)
        
        output = {
            "version": "1.0",
            "export_time": datetime.now().isoformat(),
            "notes": notes_data
        }
        
        with open(save_path, 'w', encoding='utf-8') as f:
            json.dump(output, f, ensure_ascii=False, indent=2)

    def to_list(self) -> List[dict]:
        """转换为字典列表"""
        result = []
        for note in self.notes.values():
            note_dict = note.dict()
            if isinstance(note_dict.get("review_time"), datetime):
                note_dict["review_time"] = note_dict["review_time"].isoformat()
            if hasattr(note_dict.get("status"), "value"):
                note_dict["status"] = note_dict["status"].value
            result.append(note_dict)
        return result
