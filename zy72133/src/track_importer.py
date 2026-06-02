import pandas as pd
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional
import re

from .models import TrackRecord
from .audit_log import AuditLog


class TrackImporter:
    def __init__(self, config: Dict, audit_log: AuditLog):
        self.config = config
        self.audit_log = audit_log
        self.tracks: List[TrackRecord] = []
        
    def import_excel(self, file_path: str, operator: str = "系统") -> List[TrackRecord]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Excel文件不存在: {file_path}")
            
        self.audit_log.log(
            operator=operator,
            action="导入曲目表",
            reason=f"开始导入文件: {path.name}",
            source=file_path
        )
        
        df = pd.read_excel(file_path)
        tracks = []
        
        column_mapping = self._detect_columns(df.columns)
        
        for idx, row in df.iterrows():
            track = self._parse_row(row, column_mapping, file_path, idx + 2)
            if track:
                tracks.append(track)
                
        self.tracks = tracks
        
        self.audit_log.log(
            operator=operator,
            action="导入完成",
            reason=f"成功导入 {len(tracks)} 条曲目记录",
            source=file_path
        )
        
        return tracks
    
    def _detect_columns(self, columns: List[str]) -> Dict[str, str]:
        mapping = {}
        
        column_patterns = {
            'track_id': ['曲目ID', '编号', 'ID', 'id', 'track_id'],
            'title': ['曲名', '曲目', '标题', '歌名', 'Title', 'title'],
            'artist': ['艺术家', '歌手', '艺人', 'Artist', 'artist'],
            'album': ['专辑', 'Album', 'album'],
            'duration': ['时长', '长度', 'Duration', 'duration'],
            'bpm': ['BPM', 'bpm', '速度'],
            'energy_level': ['能量等级', '能量', 'Energy', 'energy'],
            'license_info': ['授权', '版权', 'License', 'license'],
            'notes': ['备注', '批注', '注释', 'Notes', 'notes']
        }
        
        for field, patterns in column_patterns.items():
            for pattern in patterns:
                for col in columns:
                    if str(col).lower() == pattern.lower() or pattern in str(col):
                        mapping[field] = col
                        break
                if field in mapping:
                    break
                    
        return mapping
    
    def _parse_row(self, row: pd.Series, mapping: Dict[str, str], 
                   source_file: str, source_row: int) -> Optional[TrackRecord]:
        try:
            track_id = str(row.get(mapping.get('track_id', ''), '')).strip()
            title = str(row.get(mapping.get('title', ''), '')).strip()
            
            if not track_id or not title:
                return None
                
            artist = str(row.get(mapping.get('artist', ''), '')).strip()
            album = str(row.get(mapping.get('album', ''), '')).strip() or None
            
            duration = self._parse_duration(row.get(mapping.get('duration', ''), ''))
            bpm = self._parse_bpm(row.get(mapping.get('bpm', ''), ''))
            energy_level = self._parse_energy(row.get(mapping.get('energy_level', ''), ''))
            license_info = str(row.get(mapping.get('license_info', ''), '')).strip() or None
            notes = str(row.get(mapping.get('notes', ''), '')).strip() or None
            
            return TrackRecord(
                track_id=track_id,
                title=title,
                artist=artist,
                album=album,
                duration=duration,
                bpm=bpm,
                energy_level=energy_level,
                license_info=license_info,
                notes=notes,
                source_file=source_file,
                source_row=source_row
            )
        except Exception as e:
            self.audit_log.log(
                operator="系统",
                action="解析失败",
                reason=f"第 {source_row} 行解析失败: {str(e)}",
                source=source_file
            )
            return None
    
    def _parse_duration(self, value) -> Optional[float]:
        if pd.isna(value) or value == '':
            return None
            
        value_str = str(value).strip()
        
        time_match = re.match(r'(\d+):(\d+)', value_str)
        if time_match:
            minutes = int(time_match.group(1))
            seconds = int(time_match.group(2))
            return minutes * 60 + seconds
            
        try:
            return float(value_str)
        except ValueError:
            return None
    
    def _parse_bpm(self, value) -> Optional[float]:
        if pd.isna(value) or value == '':
            return None
            
        try:
            return float(str(value).strip())
        except ValueError:
            return None
    
    def _parse_energy(self, value) -> Optional[int]:
        if pd.isna(value) or value == '':
            return None
            
        try:
            return int(str(value).strip())
        except ValueError:
            return None
