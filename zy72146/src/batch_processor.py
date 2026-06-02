import time
import traceback
from typing import List, Callable
from datetime import datetime
from .models import TrackRecord, BatchSummary, TrackStatus, AnomalyType

class BatchProcessor:
    def __init__(self, error_isolation: bool = True):
        self.error_isolation = error_isolation
        self.errors = []
    
    def process_batch(self, 
                     tracks: List[TrackRecord], 
                     process_func: Callable[[TrackRecord], None]) -> BatchSummary:
        summary = BatchSummary()
        summary.start_time = datetime.now()
        start_time = time.time()
        
        summary.total_tracks = len(tracks)
        
        for i, track in enumerate(tracks):
            try:
                process_func(track)
            except Exception as e:
                if self.error_isolation:
                    error_msg = f"处理曲目 {track.track_id} 时出错: {str(e)}"
                    self.errors.append(error_msg)
                    track.status = TrackStatus.ERROR
                    track.log(f"处理失败: {str(e)}")
                    track.log(f"错误详情: {traceback.format_exc()}")
                    summary.error_tracks += 1
                else:
                    raise
        
        for track in tracks:
            if track.status == TrackStatus.MATCHED:
                summary.matched_tracks += 1
            elif track.status == TrackStatus.UNMATCHED:
                summary.unmatched_tracks += 1
            elif track.status == TrackStatus.CONFLICT:
                summary.conflict_tracks += 1
            
            summary.total_anomalies += len(track.anomalies)
            for anomaly in track.anomalies:
                summary.anomaly_counts[anomaly] = summary.anomaly_counts.get(anomaly, 0) + 1
        
        end_time = time.time()
        summary.process_time = end_time - start_time
        summary.end_time = datetime.now()
        
        return summary
