from typing import List, Dict, Tuple
from .models import TrackRecord, AudioFile, TrackStatus, AnomalyType
from .audio_scanner import AudioScanner

class TrackMatcher:
    def __init__(self, tracks: List[TrackRecord], audio_files: List[AudioFile]):
        self.tracks = tracks
        self.audio_files = audio_files
        self.audio_by_track_id = self._build_audio_index()
    
    def _build_audio_index(self) -> Dict[str, List[AudioFile]]:
        index = {}
        for af in self.audio_files:
            if af.parsed_track_id:
                if af.parsed_track_id not in index:
                    index[af.parsed_track_id] = []
                index[af.parsed_track_id].append(af)
        return index
    
    def match_all(self) -> List[TrackRecord]:
        for track in self.tracks:
            self._match_track(track)
        return self.tracks
    
    def _match_track(self, track: TrackRecord):
        track.log(f"开始匹配曲目: {track.track_id}")
        
        matching_audios = self.audio_by_track_id.get(track.track_id, [])
        
        if not matching_audios:
            track.status = TrackStatus.UNMATCHED
            track.add_anomaly(AnomalyType.MISSING_AUDIO, "未找到对应的音频文件")
            track.log(f"匹配结果: 未找到音频文件")
            return
        
        if len(matching_audios) > 1:
            track.add_anomaly(AnomalyType.DUPLICATE_TRACK, f"找到 {len(matching_audios)} 个匹配的音频文件")
        
        best_match = matching_audios[0]
        track.audio_file = best_match.file_path
        track.status = TrackStatus.MATCHED
        
        if not best_match.is_valid:
            track.add_anomaly(AnomalyType.CORRUPTED_FILE, f"音频文件可能损坏: {best_match.file_name}")
        
        if best_match.parsed_track_name and track.track_name and best_match.parsed_track_name != track.track_name:
            track.add_anomaly(AnomalyType.NAME_MISMATCH, 
                f"Excel曲目名称 '{track.track_name}' vs 文件名解析 '{best_match.parsed_track_name}'")
        
        track.log(f"匹配成功: {best_match.file_name}")
        
        if "old" in best_match.file_name.lower() or "旧版" in best_match.file_name:
            track.add_anomaly(AnomalyType.OLD_MASTER, "音频文件名包含旧版标识")
