from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from collections import defaultdict
import math

from .models import (
    VideoSegment, 
    GPSPoint, 
    ClockCalibration, 
    Timeline, 
    Anomaly, 
    AnomalyType, 
    AnomalySeverity
)


class AnomalyDetector:
    """
    综合异常检测器
    检测以下类型的异常：
    1. 缺段 (Missing Segment) - 视频片段之间的间隙
    2. 时钟漂移 (Clock Drift) - 设备时钟与参考时间的偏差
    3. GPS跳点 (GPS Jump) - GPS位置的异常跳跃
    4. 重复片段 (Duplicate Segment) - 相同哈希的片段
    """
    
    def __init__(
        self,
        gap_threshold_seconds: float = 60.0,
        clock_drift_threshold_seconds: float = 5.0,
        gps_jump_threshold_meters: float = 100.0,
        gps_time_interval_seconds: float = 1.0
    ):
        self.gap_threshold = gap_threshold_seconds
        self.clock_drift_threshold = clock_drift_threshold_seconds
        self.gps_jump_threshold = gps_jump_threshold_meters
        self.gps_time_interval = gps_time_interval_seconds
    
    def detect_all(
        self,
        timeline: Timeline,
        hash_manifest: Dict[str, str] = None
    ) -> List[Anomaly]:
        """
        执行所有类型的异常检测
        """
        anomalies = []
        
        anomalies.extend(self.detect_missing_segments(timeline))
        anomalies.extend(self.detect_clock_drift(timeline))
        anomalies.extend(self.detect_gps_jumps(timeline))
        anomalies.extend(self.detect_overlapping_segments(timeline))
        
        return anomalies
    
    def detect_missing_segments(self, timeline: Timeline) -> List[Anomaly]:
        """
        检测缺段（视频片段之间的间隙）
        """
        anomalies = []
        segments = timeline.video_segments
        
        if len(segments) < 2:
            return anomalies
        
        sorted_segments = sorted(segments, key=lambda x: x.start_time)
        
        for i in range(1, len(sorted_segments)):
            prev_segment = sorted_segments[i-1]
            curr_segment = sorted_segments[i]
            
            gap_start = prev_segment.end_time
            gap_end = curr_segment.start_time
            gap_duration = (gap_end - gap_start).total_seconds()
            
            if gap_duration > self.gap_threshold:
                severity = self._calculate_gap_severity(gap_duration)
                
                anomaly = Anomaly(
                    anomaly_type=AnomalyType.MISSING_SEGMENT,
                    severity=severity,
                    timestamp=gap_start,
                    description=f"检测到视频缺段，间隙时长: {gap_duration:.2f} 秒",
                    affected_files=[prev_segment.filename, curr_segment.filename],
                    affected_time_range=(gap_start, gap_end),
                    details={
                        'gap_start': gap_start.isoformat(),
                        'gap_end': gap_end.isoformat(),
                        'gap_duration_seconds': gap_duration,
                        'previous_segment': prev_segment.filename,
                        'previous_segment_end': prev_segment.end_time.isoformat(),
                        'current_segment': curr_segment.filename,
                        'current_segment_start': curr_segment.start_time.isoformat(),
                        'threshold_seconds': self.gap_threshold
                    }
                )
                anomalies.append(anomaly)
        
        return anomalies
    
    def detect_clock_drift(self, timeline: Timeline) -> List[Anomaly]:
        """
        检测时钟漂移
        """
        anomalies = []
        calibrations = timeline.clock_calibrations
        
        if not calibrations:
            return anomalies
        
        for calibration in calibrations:
            drift_seconds = abs(calibration.drift_seconds)
            
            if drift_seconds > self.clock_drift_threshold:
                severity = self._calculate_drift_severity(drift_seconds)
                
                anomaly = Anomaly(
                    anomaly_type=AnomalyType.CLOCK_DRIFT,
                    severity=severity,
                    timestamp=calibration.calibration_time,
                    description=f"检测到时钟漂移: {drift_seconds:.2f} 秒",
                    affected_time_range=(calibration.device_time, calibration.reference_time),
                    details={
                        'calibration_time': calibration.calibration_time.isoformat(),
                        'device_time': calibration.device_time.isoformat(),
                        'reference_time': calibration.reference_time.isoformat(),
                        'drift_seconds': calibration.drift_seconds,
                        'drift_seconds_abs': drift_seconds,
                        'calibration_type': calibration.calibration_type,
                        'threshold_seconds': self.clock_drift_threshold
                    }
                )
                anomalies.append(anomaly)
        
        if len(calibrations) >= 2:
            for i in range(1, len(calibrations)):
                prev = calibrations[i-1]
                curr = calibrations[i]
                
                drift_change = abs(curr.drift_seconds - prev.drift_seconds)
                
                if drift_change > self.clock_drift_threshold * 2:
                    anomaly = Anomaly(
                        anomaly_type=AnomalyType.CLOCK_DRIFT,
                        severity=AnomalySeverity.HIGH,
                        timestamp=curr.calibration_time,
                        description=f"检测到时钟漂移率异常变化: {drift_change:.2f} 秒",
                        details={
                            'previous_drift': prev.drift_seconds,
                            'current_drift': curr.drift_seconds,
                            'drift_change': drift_change,
                            'previous_calibration_time': prev.calibration_time.isoformat(),
                            'current_calibration_time': curr.calibration_time.isoformat()
                        }
                    )
                    anomalies.append(anomaly)
        
        return anomalies
    
    def detect_gps_jumps(self, timeline: Timeline) -> List[Anomaly]:
        """
        检测GPS跳点
        """
        anomalies = []
        gps_points = timeline.gps_points
        
        if len(gps_points) < 2:
            return anomalies
        
        sorted_points = sorted(gps_points, key=lambda x: x.timestamp)
        
        for i in range(1, len(sorted_points)):
            prev_point = sorted_points[i-1]
            curr_point = sorted_points[i]
            
            time_diff = (curr_point.timestamp - prev_point.timestamp).total_seconds()
            
            if time_diff <= 0:
                continue
            
            distance = self._calculate_distance(
                prev_point.latitude, prev_point.longitude,
                curr_point.latitude, curr_point.longitude
            )
            
            expected_distance = self._calculate_expected_distance(
                prev_point.speed, curr_point.speed, time_diff
            )
            
            if distance > self.gps_jump_threshold:
                if expected_distance is None or distance > expected_distance * 3:
                    severity = self._calculate_gps_jump_severity(distance, time_diff)
                    
                    anomaly = Anomaly(
                        anomaly_type=AnomalyType.GPS_JUMP,
                        severity=severity,
                        timestamp=curr_point.timestamp,
                        description=f"检测到GPS跳点，距离: {distance:.2f} 米",
                        affected_time_range=(prev_point.timestamp, curr_point.timestamp),
                        details={
                            'previous_timestamp': prev_point.timestamp.isoformat(),
                            'current_timestamp': curr_point.timestamp.isoformat(),
                            'time_diff_seconds': time_diff,
                            'previous_latitude': prev_point.latitude,
                            'previous_longitude': prev_point.longitude,
                            'current_latitude': curr_point.latitude,
                            'current_longitude': curr_point.longitude,
                            'distance_meters': distance,
                            'expected_distance_meters': expected_distance,
                            'threshold_meters': self.gps_jump_threshold,
                            'previous_satellites': prev_point.satellites,
                            'current_satellites': curr_point.satellites,
                            'previous_quality': prev_point.quality,
                            'current_quality': curr_point.quality
                        }
                    )
                    anomalies.append(anomaly)
        
        return anomalies
    
    def detect_overlapping_segments(self, timeline: Timeline) -> List[Anomaly]:
        """
        检测重叠的视频片段
        """
        anomalies = []
        segments = timeline.video_segments
        
        if len(segments) < 2:
            return anomalies
        
        sorted_segments = sorted(segments, key=lambda x: x.start_time)
        
        for i in range(len(sorted_segments)):
            for j in range(i + 1, len(sorted_segments)):
                seg1 = sorted_segments[i]
                seg2 = sorted_segments[j]
                
                if seg2.start_time >= seg1.end_time:
                    break
                
                overlap_start = max(seg1.start_time, seg2.start_time)
                overlap_end = min(seg1.end_time, seg2.end_time)
                overlap_duration = (overlap_end - overlap_start).total_seconds()
                
                if overlap_duration > 1.0:
                    severity = self._calculate_overlap_severity(overlap_duration)
                    
                    anomaly = Anomaly(
                        anomaly_type=AnomalyType.DUPLICATE_SEGMENT,
                        severity=severity,
                        timestamp=overlap_start,
                        description=f"检测到视频片段重叠，重叠时长: {overlap_duration:.2f} 秒",
                        affected_files=[seg1.filename, seg2.filename],
                        affected_time_range=(overlap_start, overlap_end),
                        details={
                            'segment1': seg1.filename,
                            'segment1_start': seg1.start_time.isoformat(),
                            'segment1_end': seg1.end_time.isoformat(),
                            'segment2': seg2.filename,
                            'segment2_start': seg2.start_time.isoformat(),
                            'segment2_end': seg2.end_time.isoformat(),
                            'overlap_start': overlap_start.isoformat(),
                            'overlap_end': overlap_end.isoformat(),
                            'overlap_duration_seconds': overlap_duration
                        }
                    )
                    anomalies.append(anomaly)
        
        return anomalies
    
    def _calculate_distance(
        self, 
        lat1: float, lon1: float, 
        lat2: float, lon2: float
    ) -> float:
        """
        使用 Haversine 公式计算两点之间的距离（米）
        """
        R = 6371000
        
        lat1_rad = math.radians(lat1)
        lon1_rad = math.radians(lon1)
        lat2_rad = math.radians(lat2)
        lon2_rad = math.radians(lon2)
        
        dlat = lat2_rad - lat1_rad
        dlon = lon2_rad - lon1_rad
        
        a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        
        return R * c
    
    def _calculate_expected_distance(
        self, 
        speed1: Optional[float], 
        speed2: Optional[float], 
        time_diff: float
    ) -> Optional[float]:
        """
        根据速度计算预期移动距离
        速度单位：节（knots），转换为米/秒：1节 = 0.514444 m/s
        """
        if speed1 is None and speed2 is None:
            return None
        
        speeds = []
        if speed1 is not None:
            speeds.append(speed1)
        if speed2 is not None:
            speeds.append(speed2)
        
        avg_speed_knots = sum(speeds) / len(speeds)
        avg_speed_mps = avg_speed_knots * 0.514444
        
        return avg_speed_mps * time_diff
    
    def _calculate_gap_severity(self, gap_duration: float) -> AnomalySeverity:
        """
        根据间隙时长计算严重程度
        """
        if gap_duration > 300:
            return AnomalySeverity.CRITICAL
        elif gap_duration > 120:
            return AnomalySeverity.HIGH
        elif gap_duration > 60:
            return AnomalySeverity.MEDIUM
        else:
            return AnomalySeverity.LOW
    
    def _calculate_drift_severity(self, drift_seconds: float) -> AnomalySeverity:
        """
        根据时钟漂移计算严重程度
        """
        if drift_seconds > 60:
            return AnomalySeverity.CRITICAL
        elif drift_seconds > 30:
            return AnomalySeverity.HIGH
        elif drift_seconds > 10:
            return AnomalySeverity.MEDIUM
        else:
            return AnomalySeverity.LOW
    
    def _calculate_gps_jump_severity(self, distance: float, time_diff: float) -> AnomalySeverity:
        """
        根据GPS跳点距离计算严重程度
        """
        if distance > 1000:
            return AnomalySeverity.CRITICAL
        elif distance > 500:
            return AnomalySeverity.HIGH
        elif distance > 200:
            return AnomalySeverity.MEDIUM
        else:
            return AnomalySeverity.LOW
    
    def _calculate_overlap_severity(self, overlap_duration: float) -> AnomalySeverity:
        """
        根据重叠时长计算严重程度
        """
        if overlap_duration > 60:
            return AnomalySeverity.HIGH
        elif overlap_duration > 10:
            return AnomalySeverity.MEDIUM
        else:
            return AnomalySeverity.LOW
