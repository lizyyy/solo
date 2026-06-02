import pandas as pd
from pathlib import Path
from typing import List, Optional
from .models import TrackRecord, TrackStatus
from .config import EXCEL_COLUMNS

class ExcelReader:
    def __init__(self, excel_path: str):
        self.excel_path = Path(excel_path)
        if not self.excel_path.exists():
            raise FileNotFoundError(f"Excel文件不存在: {excel_path}")
    
    def read_tracks(self) -> List[TrackRecord]:
        try:
            df = pd.read_excel(self.excel_path, sheet_name=0)
            tracks = []
            
            for _, row in df.iterrows():
                try:
                    track = self._parse_row(row)
                    tracks.append(track)
                except Exception as e:
                    print(f"解析行失败: {row.get('曲目编号', '未知')}, 错误: {e}")
            
            return tracks
        except Exception as e:
            raise RuntimeError(f"读取Excel失败: {e}")
    
    def _parse_row(self, row: pd.Series) -> TrackRecord:
        track_id = str(row.get(EXCEL_COLUMNS["track_id"], "")).strip()
        if not track_id:
            raise ValueError("曲目编号为空")
        
        authorized_val = str(row.get(EXCEL_COLUMNS["authorized"], "否")).strip()
        authorized = authorized_val in ["是", "True", "true", "1", "yes"]
        
        duration = row.get(EXCEL_COLUMNS["duration"], 0)
        try:
            duration = int(float(duration)) if pd.notna(duration) else 0
        except (ValueError, TypeError):
            duration = 0
        
        return TrackRecord(
            track_id=track_id,
            track_name=str(row.get(EXCEL_COLUMNS["track_name"], "")).strip(),
            student_name=str(row.get(EXCEL_COLUMNS["student_name"], "")).strip(),
            class_date=str(row.get(EXCEL_COLUMNS["class_date"], "")).strip(),
            duration=duration,
            authorized=authorized,
            version=str(row.get(EXCEL_COLUMNS["version"], "")).strip(),
            notes=str(row.get(EXCEL_COLUMNS["notes"], "")).strip()
        )
    
    def get_duplicate_track_ids(self, tracks: List[TrackRecord]) -> List[str]:
        id_counts = {}
        for track in tracks:
            id_counts[track.track_id] = id_counts.get(track.track_id, 0) + 1
        return [tid for tid, count in id_counts.items() if count > 1]
