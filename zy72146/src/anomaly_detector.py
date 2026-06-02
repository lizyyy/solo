from typing import List, Dict
from collections import defaultdict
from .models import TrackRecord, AnomalyType, TrackStatus

class AnomalyDetector:
    def __init__(self, tracks: List[TrackRecord]):
        self.tracks = tracks
    
    def detect_all(self) -> List[TrackRecord]:
        self._detect_duplicate_track_ids()
        self._detect_unauthorized()
        self._detect_old_master()
        self._detect_manual_rename()
        return self.tracks
    
    def _detect_duplicate_track_ids(self):
        id_to_tracks: Dict[str, List[TrackRecord]] = defaultdict(list)
        for track in self.tracks:
            id_to_tracks[track.track_id].append(track)
        
        for track_id, track_list in id_to_tracks.items():
            if len(track_list) > 1:
                for i, track in enumerate(track_list):
                    track.add_anomaly(
                        AnomalyType.DUPLICATE_TRACK,
                        f"曲目编号重复，共{len(track_list)}条记录，这是第{i+1}条"
                    )
                    track.status = TrackStatus.NEEDS_REVIEW
                    track.log(f"检测到曲目编号重复，关联 {len(track_list)} 条记录")
    
    def _detect_unauthorized(self):
        for track in self.tracks:
            if not track.authorized:
                track.add_anomaly(
                    AnomalyType.UNAUTHORIZED,
                    "该曲目未获得授权"
                )
                track.status = TrackStatus.NEEDS_REVIEW
                track.log("检测到未授权曲目")
    
    def _detect_old_master(self):
        for track in self.tracks:
            if "旧版" in track.version or "v1" in track.version.lower() or "old" in track.version.lower():
                track.add_anomaly(
                    AnomalyType.OLD_MASTER,
                    f"版本标记为旧版: {track.version}"
                )
                if track.status == TrackStatus.MATCHED:
                    track.status = TrackStatus.NEEDS_REVIEW
                track.log(f"检测到旧版母带标记: {track.version}")
    
    def _detect_manual_rename(self):
        for track in self.tracks:
            notes = track.notes or ""
            if "改名" in notes or "rename" in notes.lower() or "原曲目" in notes:
                track.add_anomaly(
                    AnomalyType.MANUAL_RENAME,
                    f"备注中发现改名记录: {notes}"
                )
                if track.status == TrackStatus.MATCHED:
                    track.status = TrackStatus.NEEDS_REVIEW
                track.log(f"检测到人工改名记录: {notes}")
    
    def get_anomaly_summary(self) -> Dict[AnomalyType, List[TrackRecord]]:
        summary = defaultdict(list)
        for track in self.tracks:
            for anomaly in track.anomalies:
                summary[anomaly].append(track)
        return dict(summary)
