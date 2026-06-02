import json
import os
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime
from dataclasses import dataclass, asdict
from .models import TrackRecord

@dataclass
class NoteRecord:
    track_id: str
    note_content: str
    created_at: str
    updated_at: str

class NoteManager:
    def __init__(self, notes_file: str):
        self.notes_file = Path(notes_file)
        self.notes: Dict[str, NoteRecord] = {}
        self._load_notes()
    
    def _load_notes(self):
        if self.notes_file.exists():
            try:
                with open(self.notes_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    for track_id, note_data in data.items():
                        self.notes[track_id] = NoteRecord(**note_data)
            except Exception as e:
                print(f"加载备注文件失败: {e}")
    
    def _save_notes(self):
        self.notes_file.parent.mkdir(parents=True, exist_ok=True)
        with open(self.notes_file, 'w', encoding='utf-8') as f:
            json.dump(
                {k: asdict(v) for k, v in self.notes.items()},
                f,
                ensure_ascii=False,
                indent=2
            )
    
    def add_note(self, track_id: str, content: str) -> NoteRecord:
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        if track_id in self.notes:
            self.notes[track_id].note_content += f"\n[{now}] {content}"
            self.notes[track_id].updated_at = now
        else:
            self.notes[track_id] = NoteRecord(
                track_id=track_id,
                note_content=f"[{now}] {content}",
                created_at=now,
                updated_at=now
            )
        self._save_notes()
        return self.notes[track_id]
    
    def get_note(self, track_id: str) -> Optional[NoteRecord]:
        return self.notes.get(track_id)
    
    def get_all_notes(self) -> Dict[str, NoteRecord]:
        return self.notes

@dataclass
class DiffItem:
    field: str
    old_value: str
    new_value: str
    change_type: str

@dataclass
class TrackDiff:
    track_id: str
    changes: List[DiffItem]
    has_changes: bool = False

class DiffComparator:
    @staticmethod
    def compare_tracks(old_track: TrackRecord, new_track: TrackRecord) -> TrackDiff:
        changes = []
        
        fields_to_compare = [
            ("track_name", "曲目名称"),
            ("student_name", "学生姓名"),
            ("class_date", "上课日期"),
            ("duration", "时长(秒)"),
            ("authorized", "已授权"),
            ("version", "版本"),
            ("notes", "备注"),
            ("status", "状态"),
            ("audio_file", "音频文件")
        ]
        
        for field_name, display_name in fields_to_compare:
            old_val = getattr(old_track, field_name)
            new_val = getattr(new_track, field_name)
            
            if field_name == "authorized":
                old_val = "是" if old_val else "否"
                new_val = "是" if new_val else "否"
            elif field_name == "status":
                old_val = old_val.value if old_val else ""
                new_val = new_val.value if new_val else ""
            
            old_str = str(old_val) if old_val is not None else ""
            new_str = str(new_val) if new_val is not None else ""
            
            if old_str != new_str:
                if not old_str and new_str:
                    change_type = "新增"
                elif old_str and not new_str:
                    change_type = "删除"
                else:
                    change_type = "修改"
                
                changes.append(DiffItem(
                    field=display_name,
                    old_value=old_str,
                    new_value=new_str,
                    change_type=change_type
                ))
        
        old_anomalies = set(a.value for a in old_track.anomalies)
        new_anomalies = set(a.value for a in new_track.anomalies)
        
        added = new_anomalies - old_anomalies
        removed = old_anomalies - new_anomalies
        
        for a in added:
            changes.append(DiffItem(
                field="异常类型",
                old_value="",
                new_value=a,
                change_type="新增异常"
            ))
        
        for a in removed:
            changes.append(DiffItem(
                field="异常类型",
                old_value=a,
                new_value="",
                change_type="移除异常"
            ))
        
        return TrackDiff(
            track_id=new_track.track_id,
            changes=changes,
            has_changes=len(changes) > 0
        )
    
    @staticmethod
    def compare_track_lists(old_tracks: List[TrackRecord], new_tracks: List[TrackRecord]) -> List[TrackDiff]:
        old_map = {t.track_id: t for t in old_tracks}
        new_map = {t.track_id: t for t in new_tracks}
        
        diffs = []
        
        for track_id in set(old_map.keys()) & set(new_map.keys()):
            diff = DiffComparator.compare_tracks(old_map[track_id], new_map[track_id])
            if diff.has_changes:
                diffs.append(diff)
        
        for track_id in set(new_map.keys()) - set(old_map.keys()):
            t = new_map[track_id]
            diffs.append(TrackDiff(
                track_id=track_id,
                changes=[DiffItem("曲目", "", track_id, "新增曲目")],
                has_changes=True
            ))
        
        for track_id in set(old_map.keys()) - set(new_map.keys()):
            diffs.append(TrackDiff(
                track_id=track_id,
                changes=[DiffItem("曲目", track_id, "", "删除曲目")],
                has_changes=True
            ))
        
        return diffs
