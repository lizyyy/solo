import uuid
import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional
from dataclasses import asdict

from .models import TrackRecord, MatchResult, Conflict, TrackStatus
from .audit_log import AuditLog


class ConflictResolver:
    def __init__(self, config: Dict, audit_log: AuditLog, 
                 storage_file: str = "conflicts.json"):
        self.config = config
        self.audit_log = audit_log
        self.storage_file = storage_file
        self.conflicts: List[Conflict] = []
        self._load_conflicts()
        
    def detect_conflicts(self, new_tracks: List[TrackRecord], 
                         existing_results: List[MatchResult],
                         operator: str = "系统") -> List[Conflict]:
        
        self.audit_log.log(
            operator=operator,
            action="检测冲突",
            reason=f"开始检测冲突，新导入 {len(new_tracks)} 条曲目",
            source="冲突检测器"
        )
        
        existing_by_id = {r.track.track_id: r for r in existing_results if r.track}
        conflicts = []
        
        for new_track in new_tracks:
            if new_track.track_id in existing_by_id:
                existing = existing_by_id[new_track.track_id]
                track_conflicts = self._compare_tracks(new_track, existing.track)
                conflicts.extend(track_conflicts)
                
                for conflict in track_conflicts:
                    self.conflicts.append(conflict)
        
        self._save_conflicts()
        
        self.audit_log.log(
            operator=operator,
            action="冲突检测完成",
            reason=f"检测到 {len(conflicts)} 个冲突",
            source="冲突检测器"
        )
        
        return conflicts
    
    def _compare_tracks(self, new_track: TrackRecord, 
                        old_track: TrackRecord) -> List[Conflict]:
        conflicts = []
        
        fields_to_check = [
            ('title', '曲名'),
            ('artist', '艺术家'),
            ('album', '专辑'),
            ('duration', '时长'),
            ('bpm', 'BPM'),
            ('energy_level', '能量等级'),
            ('license_info', '授权信息'),
            ('notes', '备注')
        ]
        
        for field_name, display_name in fields_to_check:
            new_value = getattr(new_track, field_name)
            old_value = getattr(old_track, field_name)
            
            if str(new_value).strip() != str(old_value).strip():
                conflict = Conflict(
                    conflict_id=str(uuid.uuid4()),
                    track_id=new_track.track_id,
                    field_name=display_name,
                    excel_value=str(new_value) if new_value else "",
                    import_value=str(old_value) if old_value else "",
                    suggested_action=self._get_suggested_action(field_name, new_value, old_value)
                )
                conflicts.append(conflict)
                
        return conflicts
    
    def _get_suggested_action(self, field_name: str, new_val, old_val) -> str:
        suggestions = {
            'title': "请确认哪个曲名是正确的，注意区分不同版本",
            'artist': "请核对艺术家名称是否正确",
            'duration': "以音频文件实际时长为准，建议重新测量",
            'bpm': "建议使用专业工具重新检测BPM",
            'energy_level': "请确认能量等级的评级标准是否一致",
            'license_info': "请仔细核对版权授权信息，确保使用合规",
            'notes': "建议合并两边的备注信息",
            'album': "请确认专辑信息"
        }
        return suggestions.get(field_name, "请人工核对确认")
    
    def resolve_conflict(self, conflict_id: str, decision: str, 
                        operator: str, notes: str = "") -> Optional[Conflict]:
        for conflict in self.conflicts:
            if conflict.conflict_id == conflict_id:
                conflict.resolved = True
                conflict.resolved_by = operator
                conflict.resolved_at = datetime.now()
                conflict.resolution_notes = notes
                
                self.audit_log.log(
                    operator=operator,
                    action="解决冲突",
                    track_id=conflict.track_id,
                    old_value=conflict.import_value,
                    new_value=conflict.excel_value,
                    reason=f"解决字段 '{conflict.field_name}' 的冲突: {decision}",
                    source="冲突解决器"
                )
                
                self._save_conflicts()
                return conflict
                
        return None
    
    def get_unresolved_conflicts(self) -> List[Conflict]:
        return [c for c in self.conflicts if not c.resolved]
    
    def get_conflicts_by_track(self, track_id: str) -> List[Conflict]:
        return [c for c in self.conflicts if c.track_id == track_id]
    
    def _load_conflicts(self):
        path = Path(self.storage_file)
        if path.exists():
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    for c_data in data:
                        conflict = Conflict(
                            conflict_id=c_data['conflict_id'],
                            track_id=c_data['track_id'],
                            field_name=c_data['field_name'],
                            excel_value=c_data['excel_value'],
                            import_value=c_data['import_value'],
                            detected_at=datetime.fromisoformat(c_data['detected_at']),
                            suggested_action=c_data.get('suggested_action', ''),
                            resolved=c_data.get('resolved', False),
                            resolved_by=c_data.get('resolved_by'),
                            resolved_at=datetime.fromisoformat(c_data['resolved_at']) if c_data.get('resolved_at') else None,
                            resolution_notes=c_data.get('resolution_notes', '')
                        )
                        self.conflicts.append(conflict)
            except Exception as e:
                print(f"加载冲突记录失败: {e}")
    
    def _save_conflicts(self):
        path = Path(self.storage_file)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        serializable = []
        for c in self.conflicts:
            c_dict = asdict(c)
            c_dict['detected_at'] = c.detected_at.isoformat()
            if c.resolved_at:
                c_dict['resolved_at'] = c.resolved_at.isoformat()
            serializable.append(c_dict)
            
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(serializable, f, ensure_ascii=False, indent=2)
    
    def get_conflict_evidence(self, conflict: Conflict, 
                             match_results: List[MatchResult]) -> Dict:
        result = next((r for r in match_results if r.track.track_id == conflict.track_id), None)
        if not result:
            return {}
            
        return {
            'track_id': conflict.track_id,
            'field': conflict.field_name,
            'excel_value': conflict.excel_value,
            'stored_value': conflict.import_value,
            'suggested_action': conflict.suggested_action,
            'source_file': result.track.source_file,
            'source_row': result.track.source_row,
            'audio_file': result.audio_file.file_path if result.audio_file else None,
            'match_status': result.status.value,
            'import_time': result.track.imported_at.isoformat()
        }
