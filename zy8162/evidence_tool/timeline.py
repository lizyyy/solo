from datetime import datetime, timedelta
from typing import List, Optional, Tuple
from collections import defaultdict

from .models import VideoSegment, GPSPoint, ClockCalibration, Timeline


class TimelineMerger:
    """
    时间线归并器，负责将多源数据整合成统一的时间线
    特别处理跨午夜片段的问题
    """
    
    def __init__(self, max_gap_seconds: float = 60.0):
        self.max_gap_seconds = max_gap_seconds
    
    def merge(
        self,
        video_segments: List[VideoSegment],
        gps_points: List[GPSPoint],
        clock_calibrations: List[ClockCalibration]
    ) -> Timeline:
        """
        合并所有数据源到一个统一的时间线
        """
        all_segments = self._process_video_segments(video_segments)
        all_gps = self._process_gps_points(gps_points, all_segments)
        all_calibrations = self._process_calibrations(clock_calibrations)
        
        if all_segments:
            start_time = min(s.start_time for s in all_segments)
            end_time = max(s.end_time for s in all_segments)
        elif all_gps:
            start_time = min(p.timestamp for p in all_gps)
            end_time = max(p.timestamp for p in all_gps)
        else:
            now = datetime.now()
            start_time = now
            end_time = now
        
        timeline = Timeline(
            start_time=start_time,
            end_time=end_time,
            video_segments=all_segments,
            gps_points=all_gps,
            clock_calibrations=all_calibrations
        )
        
        timeline.sort_all()
        return timeline
    
    def _process_video_segments(self, segments: List[VideoSegment]) -> List[VideoSegment]:
        """
        处理视频片段，特别处理跨午夜片段
        """
        if not segments:
            return []
        
        sorted_segments = sorted(segments, key=lambda x: x.start_time)
        
        processed = []
        for i, segment in enumerate(sorted_segments):
            corrected_segment = self._correct_midnight_crossing(
                segment, 
                sorted_segments, 
                i
            )
            processed.append(corrected_segment)
        
        return self._resolve_overlaps_and_adjacent(processed)
    
    def _correct_midnight_crossing(
        self,
        segment: VideoSegment,
        all_segments: List[VideoSegment],
        current_index: int
    ) -> VideoSegment:
        """
        检测并纠正跨午夜片段
        跨午夜片段的特征：start_time > end_time（当只记录时间不记录日期时）
        或者 end_time - start_time 异常大
        """
        start = segment.start_time
        end = segment.end_time
        
        if start > end:
            expected_duration = segment.duration.total_seconds() if segment.duration else 0
            
            if expected_duration > 0:
                actual_duration = (start - end).total_seconds()
                if actual_duration > 12 * 3600:
                    corrected_end = end + timedelta(days=1)
                    
                    new_segment = VideoSegment(
                        filename=segment.filename,
                        file_path=segment.file_path,
                        start_time=start,
                        end_time=corrected_end,
                        duration=corrected_end - start,
                        device_id=segment.device_id,
                        file_size=segment.file_size,
                        sha256_hash=segment.sha256_hash,
                        original_index=segment.original_index,
                        metadata={**segment.metadata, 'crossed_midnight': True}
                    )
                    return new_segment
        
        if current_index > 0:
            prev_segment = all_segments[current_index - 1]
            
            if prev_segment.end_time > start and (prev_segment.end_time - start).total_seconds() > 12 * 3600:
                corrected_start = start + timedelta(days=1)
                if corrected_start > end:
                    corrected_end = end + timedelta(days=1)
                else:
                    corrected_end = end
                
                new_segment = VideoSegment(
                    filename=segment.filename,
                    file_path=segment.file_path,
                    start_time=corrected_start,
                    end_time=corrected_end,
                    duration=corrected_end - corrected_start,
                    device_id=segment.device_id,
                    file_size=segment.file_size,
                    sha256_hash=segment.sha256_hash,
                    original_index=segment.original_index,
                    metadata={**segment.metadata, 'date_corrected': True}
                )
                return new_segment
        
        return segment
    
    def _resolve_overlaps_and_adjacent(self, segments: List[VideoSegment]) -> List[VideoSegment]:
        """
        解决重叠片段和相邻片段的问题
        """
        if len(segments) <= 1:
            return segments
        
        sorted_segments = sorted(segments, key=lambda x: x.start_time)
        result = [sorted_segments[0]]
        
        for i in range(1, len(sorted_segments)):
            current = sorted_segments[i]
            last = result[-1]
            
            if current.overlaps_with(last):
                merged = self._merge_segments(last, current)
                result[-1] = merged
            elif current.is_adjacent_to(last, timedelta(seconds=self.max_gap_seconds)):
                merged = self._merge_segments(last, current, mark_adjacent=True)
                result[-1] = merged
            else:
                result.append(current)
        
        return result
    
    def _merge_segments(
        self, 
        seg1: VideoSegment, 
        seg2: VideoSegment, 
        mark_adjacent: bool = False
    ) -> VideoSegment:
        """
        合并两个视频片段
        """
        start_time = min(seg1.start_time, seg2.start_time)
        end_time = max(seg1.end_time, seg2.end_time)
        
        merged_metadata = {
            **seg1.metadata,
            **seg2.metadata,
            'merged_from': [seg1.filename, seg2.filename],
            'merged_at': datetime.now().isoformat()
        }
        
        if mark_adjacent:
            merged_metadata['adjacent_merge'] = True
            gap_seconds = abs((seg2.start_time - seg1.end_time).total_seconds())
            merged_metadata['gap_seconds'] = gap_seconds
        
        return VideoSegment(
            filename=f"{seg1.filename}_merged",
            file_path=seg1.file_path,
            start_time=start_time,
            end_time=end_time,
            duration=end_time - start_time,
            device_id=seg1.device_id if seg1.device_id == seg2.device_id else "mixed",
            file_size=seg1.file_size + seg2.file_size,
            sha256_hash=None,
            original_index=min(seg1.original_index, seg2.original_index),
            metadata=merged_metadata
        )
    
    def _process_gps_points(
        self, 
        points: List[GPSPoint], 
        video_segments: List[VideoSegment]
    ) -> List[GPSPoint]:
        """
        处理GPS点，根据视频片段的时间范围进行日期校正
        """
        if not points or not video_segments:
            return points
        
        video_start = min(s.start_time for s in video_segments)
        video_end = max(s.end_time for s in video_segments)
        video_duration = (video_end - video_start).total_seconds()
        
        if video_duration > 24 * 3600:
            return points
        
        processed = []
        for point in points:
            corrected_point = self._correct_gps_timestamp(
                point, 
                video_start, 
                video_end
            )
            processed.append(corrected_point)
        
        return processed
    
    def _correct_gps_timestamp(
        self,
        point: GPSPoint,
        video_start: datetime,
        video_end: datetime
    ) -> GPSPoint:
        """
        校正GPS时间戳，处理跨午夜的情况
        """
        point_time = point.timestamp
        
        time_only = point_time.time()
        video_start_time = video_start.time()
        video_end_time = video_end.time()
        
        if video_start_time > video_end_time:
            if time_only >= video_start_time or time_only <= video_end_time:
                if time_only <= video_end_time:
                    corrected_time = datetime.combine(
                        video_start.date() + timedelta(days=1),
                        time_only
                    )
                else:
                    corrected_time = datetime.combine(
                        video_start.date(),
                        time_only
                    )
                
                return GPSPoint(
                    timestamp=corrected_time,
                    latitude=point.latitude,
                    longitude=point.longitude,
                    altitude=point.altitude,
                    speed=point.speed,
                    satellites=point.satellites,
                    quality=point.quality,
                    raw_data=point.raw_data
                )
        
        return point
    
    def _process_calibrations(self, calibrations: List[ClockCalibration]) -> List[ClockCalibration]:
        """
        处理时钟校准数据
        """
        return sorted(calibrations, key=lambda x: x.calibration_time)


class TimelineAnalyzer:
    """
    时间线分析器，用于检测时间线中的异常模式
    """
    
    def __init__(self, gap_threshold_seconds: float = 60.0):
        self.gap_threshold = gap_threshold_seconds
    
    def find_gaps(self, timeline: Timeline) -> List[Tuple[datetime, datetime, float]]:
        """
        查找视频片段之间的间隙
        返回: [(start_gap, end_gap, duration_seconds), ...]
        """
        gaps = []
        segments = timeline.video_segments
        
        if len(segments) < 2:
            return gaps
        
        sorted_segments = sorted(segments, key=lambda x: x.start_time)
        
        for i in range(1, len(sorted_segments)):
            prev_end = sorted_segments[i-1].end_time
            current_start = sorted_segments[i].start_time
            
            gap = (current_start - prev_end).total_seconds()
            
            if gap > self.gap_threshold:
                gaps.append((prev_end, current_start, gap))
        
        return gaps
    
    def find_overlaps(self, timeline: Timeline) -> List[Tuple[VideoSegment, VideoSegment, float]]:
        """
        查找重叠的视频片段
        返回: [(seg1, seg2, overlap_seconds), ...]
        """
        overlaps = []
        segments = timeline.video_segments
        
        if len(segments) < 2:
            return overlaps
        
        sorted_segments = sorted(segments, key=lambda x: x.start_time)
        
        for i in range(len(sorted_segments)):
            for j in range(i + 1, len(sorted_segments)):
                seg1 = sorted_segments[i]
                seg2 = sorted_segments[j]
                
                if seg2.start_time >= seg1.end_time:
                    break
                
                overlap_start = max(seg1.start_time, seg2.start_time)
                overlap_end = min(seg1.end_time, seg2.end_time)
                overlap_seconds = (overlap_end - overlap_start).total_seconds()
                
                if overlap_seconds > 0:
                    overlaps.append((seg1, seg2, overlap_seconds))
        
        return overlaps
    
    def get_timeline_coverage(self, timeline: Timeline) -> float:
        """
        计算时间线的覆盖百分比
        返回: 0.0 - 1.0
        """
        if not timeline.video_segments:
            return 0.0
        
        total_duration = (timeline.end_time - timeline.start_time).total_seconds()
        
        if total_duration <= 0:
            return 0.0
        
        covered_duration = sum(
            seg.duration.total_seconds() 
            for seg in timeline.video_segments
        )
        
        gaps = self.find_gaps(timeline)
        gap_duration = sum(gap[2] for gap in gaps)
        
        effective_coverage = covered_duration - gap_duration
        
        return max(0.0, min(1.0, effective_coverage / total_duration))
