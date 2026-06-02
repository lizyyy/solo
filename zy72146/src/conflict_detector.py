from typing import List, Dict, Any
from dataclasses import dataclass
from .models import TrackRecord, TrackStatus, AnomalyType

@dataclass
class ConflictEvidence:
    field_name: str
    excel_value: Any
    import_value: Any
    suggestion: str

@dataclass
class ConflictResult:
    track_id: str
    conflicts: List[ConflictEvidence]
    has_conflict: bool = False

class ConflictDetector:
    def __init__(self, original_tracks: List[TrackRecord], imported_tracks: List[TrackRecord]):
        self.original_tracks = {t.track_id: t for t in original_tracks}
        self.imported_tracks = {t.track_id: t for t in imported_tracks}
    
    def detect_conflicts(self) -> Dict[str, ConflictResult]:
        results = {}
        
        for track_id in set(self.original_tracks.keys()) | set(self.imported_tracks.keys()):
            original = self.original_tracks.get(track_id)
            imported = self.imported_tracks.get(track_id)
            
            if original and imported:
                conflict = self._compare_tracks(original, imported)
                if conflict.has_conflict:
                    results[track_id] = conflict
        
        return results
    
    def _compare_tracks(self, original: TrackRecord, imported: TrackRecord) -> ConflictResult:
        conflicts = []
        
        if original.track_name != imported.track_name:
            conflicts.append(ConflictEvidence(
                field_name="曲目名称",
                excel_value=original.track_name,
                import_value=imported.track_name,
                suggestion="建议核对曲目名称后手动选择正确值"
            ))
        
        if original.student_name != imported.student_name:
            conflicts.append(ConflictEvidence(
                field_name="学生姓名",
                excel_value=original.student_name,
                import_value=imported.student_name,
                suggestion="建议核对学生姓名后手动选择正确值"
            ))
        
        if original.duration != imported.duration and imported.duration > 0:
            conflicts.append(ConflictEvidence(
                field_name="时长",
                excel_value=f"{original.duration}秒",
                import_value=f"{imported.duration}秒",
                suggestion="建议以实际音频时长为准"
            ))
        
        if original.authorized != imported.authorized:
            conflicts.append(ConflictEvidence(
                field_name="授权状态",
                excel_value="已授权" if original.authorized else "未授权",
                import_value="已授权" if imported.authorized else "未授权",
                suggestion="建议确认授权状态后手动更新"
            ))
        
        result = ConflictResult(
            track_id=original.track_id,
            conflicts=conflicts,
            has_conflict=len(conflicts) > 0
        )
        
        if result.has_conflict:
            imported.status = TrackStatus.CONFLICT
            for c in conflicts:
                imported.add_anomaly(
                    AnomalyType.NAME_MISMATCH if c.field_name == "曲目名称" else AnomalyType.NAME_MISMATCH,
                    f"数据冲突 [{c.field_name}]: Excel='{c.excel_value}', 导入='{c.import_value}'"
                )
        
        return result
