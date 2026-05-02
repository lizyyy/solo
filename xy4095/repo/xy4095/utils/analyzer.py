from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple
import pandas as pd
import numpy as np
import uuid

from models import (
    NoiseData, NoiseRecord,
    WeatherData, WeatherRecord,
    ComplaintData, ComplaintRecord,
    AnalysisResult, AnomalyEvent,
    OverThresholdWindow, SuddenPeak,
    SensorOfflinePeriod, ComplaintEvidence,
    AnomalyType, SeverityLevel
)


@dataclass
class AnalysisConfig:
    """分析配置参数"""
    
    noise_threshold_daytime: float = 60.0  # 昼间阈值 dB
    noise_threshold_nighttime: float = 50.0  # 夜间阈值 dB
    nighttime_start_hour: int = 22  # 夜间开始时间
    nighttime_end_hour: int = 6  # 夜间结束时间
    
    peak_threshold_increase: float = 15.0  # 突增峰值检测阈值（分贝增量）
    peak_min_duration_seconds: float = 1.0  # 峰值最小持续时间
    
    offline_threshold_seconds: float = 60.0  # 判定离线的时间间隔阈值
    
    complaint_analysis_window_before: int = 10  # 投诉前分析窗口（分钟）
    complaint_analysis_window_after: int = 5  # 投诉后分析窗口（分钟）
    
    significant_wind_speed: float = 10.0  # 显著风速阈值 m/s
    significant_rainfall: float = 0.5  # 显著降雨阈值 mm
    
    def get_threshold_for_time(self, timestamp: datetime) -> float:
        """根据时间获取对应的噪声阈值"""
        hour = timestamp.hour
        if self.nighttime_start_hour <= hour or hour < self.nighttime_end_hour:
            return self.noise_threshold_nighttime
        return self.noise_threshold_daytime


class NoiseAnalyzer:
    """噪声数据分析器"""
    
    def __init__(self, config: Optional[AnalysisConfig] = None):
        self.config = config or AnalysisConfig()
        self.analysis_id = str(uuid.uuid4())[:8]
    
    def align_time_series(self, 
                           noise_data_dict: Dict[str, NoiseData],
                           weather_data_dict: Dict[str, WeatherData],
                           complaint_data: Optional[ComplaintData] = None) -> Dict[str, Any]:
        """
        对齐多个数据源的时间线
        
        返回对齐后的时间范围和各站点的时间序列数据
        """
        all_start_times = []
        all_end_times = []
        
        for site_id, noise_data in noise_data_dict.items():
            if noise_data.start_time:
                all_start_times.append(noise_data.start_time)
            if noise_data.end_time:
                all_end_times.append(noise_data.end_time)
        
        for site_id, weather_data in weather_data_dict.items():
            if weather_data.start_time:
                all_start_times.append(weather_data.start_time)
            if weather_data.end_time:
                all_end_times.append(weather_data.end_time)
        
        if complaint_data and complaint_data.records:
            all_start_times.append(complaint_data.start_time)
            all_end_times.append(complaint_data.end_time)
        
        if not all_start_times or not all_end_times:
            return {
                'aligned_start': None,
                'aligned_end': None,
                'common_sites': [],
                'time_coverage': {}
            }
        
        aligned_start = min(all_start_times)
        aligned_end = max(all_end_times)
        
        noise_sites = set(noise_data_dict.keys())
        weather_sites = set(weather_data_dict.keys())
        common_sites = list(noise_sites & weather_sites)
        
        time_coverage = {}
        for site_id in noise_data_dict:
            nd = noise_data_dict[site_id]
            time_coverage[f'noise_{site_id}'] = {
                'start': nd.start_time,
                'end': nd.end_time,
                'duration_hours': (nd.end_time - nd.start_time).total_seconds() / 3600 if nd.start_time and nd.end_time else 0
            }
        
        for site_id in weather_data_dict:
            wd = weather_data_dict[site_id]
            time_coverage[f'weather_{site_id}'] = {
                'start': wd.start_time,
                'end': wd.end_time,
                'duration_hours': (wd.end_time - wd.start_time).total_seconds() / 3600 if wd.start_time and wd.end_time else 0
            }
        
        return {
            'aligned_start': aligned_start,
            'aligned_end': aligned_end,
            'common_sites': common_sites,
            'noise_sites': list(noise_sites),
            'weather_sites': list(weather_sites),
            'time_coverage': time_coverage
        }
    
    def detect_over_threshold_windows(self, 
                                        noise_data: NoiseData,
                                        site_id: str) -> List[OverThresholdWindow]:
        """检测超标窗口"""
        windows = []
        window_id_counter = 0
        
        if not noise_data.records:
            return windows
        
        current_window_start = None
        current_window_records = []
        
        for record in noise_data.records:
            if not record.is_valid or record.is_missing:
                if current_window_start is not None:
                    window = self._create_over_threshold_window(
                        current_window_start, current_window_records, site_id, window_id_counter
                    )
                    if window:
                        windows.append(window)
                        window_id_counter += 1
                    current_window_start = None
                    current_window_records = []
                continue
            
            threshold = self.config.get_threshold_for_time(record.timestamp)
            is_over_threshold = record.laeq > threshold
            
            if is_over_threshold:
                if current_window_start is None:
                    current_window_start = record.timestamp
                current_window_records.append(record)
            else:
                if current_window_start is not None:
                    window = self._create_over_threshold_window(
                        current_window_start, current_window_records, site_id, window_id_counter
                    )
                    if window:
                        windows.append(window)
                        window_id_counter += 1
                    current_window_start = None
                    current_window_records = []
        
        if current_window_start is not None and current_window_records:
            window = self._create_over_threshold_window(
                current_window_start, current_window_records, site_id, window_id_counter
            )
            if window:
                windows.append(window)
        
        return windows
    
    def _create_over_threshold_window(self, 
                                        start_time: datetime,
                                        records: List[NoiseRecord],
                                        site_id: str,
                                        counter: int) -> Optional[OverThresholdWindow]:
        """创建超标窗口对象"""
        if not records:
            return None
        
        end_time = records[-1].timestamp
        duration_seconds = (end_time - start_time).total_seconds()
        
        if duration_seconds < 1:
            return None
        
        laeq_values = [r.laeq for r in records if r.is_valid and not r.is_missing]
        if not laeq_values:
            return None
        
        threshold = self.config.get_threshold_for_time(start_time)
        
        return OverThresholdWindow(
            window_id=f'OTW-{site_id}-{counter:04d}',
            site_id=site_id,
            start_time=start_time,
            end_time=end_time,
            threshold=threshold,
            max_value=max(laeq_values),
            mean_value=np.mean(laeq_values),
            duration_minutes=duration_seconds / 60.0
        )
    
    def detect_sudden_peaks(self, 
                             noise_data: NoiseData,
                             site_id: str) -> List[SuddenPeak]:
        """检测突增峰值"""
        peaks = []
        peak_id_counter = 0
        
        if len(noise_data.records) < 5:
            return peaks
        
        valid_records = [r for r in noise_data.records if r.is_valid and not r.is_missing]
        
        if len(valid_records) < 5:
            return peaks
        
        laeq_values = [r.laeq for r in valid_records]
        timestamps = [r.timestamp for r in valid_records]
        
        for i in range(3, len(valid_records) - 2):
            current_value = laeq_values[i]
            baseline_window = laeq_values[max(0, i-10):i]
            
            if not baseline_window:
                continue
            
            baseline_value = np.median(baseline_window)
            increase_amount = current_value - baseline_value
            increase_percent = (increase_amount / baseline_value * 100) if baseline_value > 0 else 0
            
            if increase_amount >= self.config.peak_threshold_increase:
                peak_duration = self._estimate_peak_duration(laeq_values, i, baseline_value)
                
                peak = SuddenPeak(
                    peak_id=f'SPK-{site_id}-{peak_id_counter:04d}',
                    site_id=site_id,
                    timestamp=timestamps[i],
                    peak_value=current_value,
                    baseline_value=baseline_value,
                    increase_amount=increase_amount,
                    increase_percent=increase_percent,
                    duration_seconds=peak_duration
                )
                peaks.append(peak)
                peak_id_counter += 1
        
        return peaks
    
    def _estimate_peak_duration(self, values: List[float], peak_index: int, baseline: float) -> float:
        """估计峰值持续时间"""
        threshold = baseline + (self.config.peak_threshold_increase * 0.5)
        
        start_idx = peak_index
        while start_idx > 0 and values[start_idx] > threshold:
            start_idx -= 1
        
        end_idx = peak_index
        while end_idx < len(values) - 1 and values[end_idx] > threshold:
            end_idx += 1
        
        return float(max(1, end_idx - start_idx))
    
    def detect_sensor_offline_periods(self, 
                                         noise_data: NoiseData,
                                         site_id: str) -> List[SensorOfflinePeriod]:
        """检测传感器离线时间段"""
        offline_periods = []
        period_id_counter = 0
        
        if len(noise_data.records) < 2:
            return offline_periods
        
        records = sorted(noise_data.records, key=lambda x: x.timestamp)
        
        for i in range(1, len(records)):
            prev_record = records[i-1]
            curr_record = records[i]
            
            time_gap = (curr_record.timestamp - prev_record.timestamp).total_seconds()
            
            if time_gap > self.config.offline_threshold_seconds:
                expected_samples = int(time_gap / noise_data.sampling_interval_seconds)
                
                offline_period = SensorOfflinePeriod(
                    period_id=f'OFF-{site_id}-{period_id_counter:04d}',
                    site_id=site_id,
                    start_time=prev_record.timestamp,
                    end_time=curr_record.timestamp,
                    duration_minutes=time_gap / 60.0,
                    expected_samples=expected_samples,
                    actual_samples=2,
                    missing_count=expected_samples - 2
                )
                offline_periods.append(offline_period)
                period_id_counter += 1
        
        return offline_periods
    
    def analyze_complaint_evidence(self,
                                     complaint: ComplaintRecord,
                                     noise_data: Optional[NoiseData],
                                     weather_data: Optional[WeatherData],
                                     over_threshold_windows: List[OverThresholdWindow],
                                     sudden_peaks: List[SuddenPeak],
                                     offline_periods: List[SensorOfflinePeriod]) -> ComplaintEvidence:
        """分析单个投诉的证据"""
        evidence_id = f'EVD-{complaint.complaint_id}'
        
        window_before = timedelta(minutes=self.config.complaint_analysis_window_before)
        window_after = timedelta(minutes=self.config.complaint_analysis_window_after)
        
        analysis_start = complaint.timestamp - window_before
        analysis_end = complaint.timestamp + window_after
        
        evidence = ComplaintEvidence(
            evidence_id=evidence_id,
            complaint_id=complaint.complaint_id,
            site_id=complaint.site_id,
            complaint_time=complaint.timestamp,
            analysis_window_start=analysis_start,
            analysis_window_end=analysis_end
        )
        
        if noise_data:
            site_windows = [w for w in over_threshold_windows 
                           if w.site_id == complaint.site_id]
            
            overlapping_windows = []
            for window in site_windows:
                if self._time_overlaps(
                    window.start_time, window.end_time,
                    analysis_start, analysis_end
                ):
                    overlapping_windows.append(window)
            
            if overlapping_windows:
                evidence.has_exceedance = True
                max_exceed = max(w.max_value - w.threshold for w in overlapping_windows)
                evidence.exceedance_details = {
                    'window_count': len(overlapping_windows),
                    'max_exceedance_db': max_exceed,
                    'windows': [w.to_dict() for w in overlapping_windows]
                }
            
            site_peaks = [p for p in sudden_peaks 
                         if p.site_id == complaint.site_id and
                         analysis_start <= p.timestamp <= analysis_end]
            
            if site_peaks:
                evidence.has_sudden_peak = True
                max_peak = max(site_peaks, key=lambda p: p.increase_amount)
                evidence.peak_details = {
                    'peak_count': len(site_peaks),
                    'max_increase_db': max_peak.increase_amount,
                    'peaks': [p.to_dict() for p in site_peaks]
                }
            
            site_offlines = [o for o in offline_periods
                            if o.site_id == complaint.site_id and
                            self._time_overlaps(
                                o.start_time, o.end_time,
                                analysis_start, analysis_end
                            )]
            
            if site_offlines:
                evidence.has_sensor_offline = True
                max_offline = max(site_offlines, key=lambda o: o.duration_minutes)
                evidence.offline_details = {
                    'offline_count': len(site_offlines),
                    'max_duration_minutes': max_offline.duration_minutes,
                    'periods': [o.to_dict() for o in site_offlines]
                }
        
        if weather_data:
            weather_check = weather_data.has_significant_weather(
                analysis_start, analysis_end
            )
            
            if weather_check['has_significant_weather']:
                evidence.has_weather_interference = True
                evidence.weather_details = weather_check
        
        evidence.summary = self._generate_evidence_summary(evidence)
        evidence.recommendation = self._generate_recommendation(evidence)
        
        return evidence
    
    def _time_overlaps(self, start1: datetime, end1: datetime,
                        start2: datetime, end2: datetime) -> bool:
        """检查两个时间段是否有重叠"""
        return start1 <= end2 and start2 <= end1
    
    def _generate_evidence_summary(self, evidence: ComplaintEvidence) -> str:
        """生成证据摘要"""
        parts = []
        
        if evidence.has_exceedance:
            parts.append(f"发现{evidence.exceedance_details.get('window_count', 0)}个超标窗口")
        
        if evidence.has_sudden_peak:
            parts.append(f"发现{evidence.peak_details.get('peak_count', 0)}个突增峰值")
        
        if evidence.has_sensor_offline:
            parts.append(f"发现{evidence.offline_details.get('offline_count', 0)}个传感器离线时段")
        
        if evidence.has_weather_interference:
            parts.append("存在天气干扰因素")
        
        if not parts:
            return "投诉时段内未发现明显噪声异常"
        
        return "；".join(parts)
    
    def _generate_recommendation(self, evidence: ComplaintEvidence) -> str:
        """生成复核建议"""
        if evidence.has_sensor_offline:
            return 'further_review'
        
        if evidence.has_weather_interference and not evidence.has_exceedance and not evidence.has_sudden_peak:
            return 'dismissed'
        
        if evidence.has_exceedance or evidence.has_sudden_peak:
            if evidence.has_weather_interference:
                return 'further_review'
            return 'confirmed'
        
        return 'dismissed'
    
    def analyze_all(self,
                    noise_data_dict: Dict[str, NoiseData],
                    weather_data_dict: Dict[str, WeatherData],
                    complaint_data: Optional[ComplaintData] = None) -> AnalysisResult:
        """执行完整的分析流程"""
        result = AnalysisResult(
            analysis_id=self.analysis_id,
            analysis_time=datetime.now()
        )
        
        result.noise_data_sites = list(noise_data_dict.keys())
        result.weather_data_sites = list(weather_data_dict.keys())
        
        if complaint_data:
            result.total_complaints = complaint_data.total_complaints
        
        result.threshold_config = {
            'daytime_threshold': self.config.noise_threshold_daytime,
            'nighttime_threshold': self.config.noise_threshold_nighttime,
            'nighttime_hours': f"{self.config.nighttime_start_hour}:00 - {self.config.nighttime_end_hour}:00"
        }
        
        all_windows = []
        all_peaks = []
        all_offlines = []
        all_anomalies = []
        anomaly_counter = 0
        
        for site_id, noise_data in noise_data_dict.items():
            windows = self.detect_over_threshold_windows(noise_data, site_id)
            all_windows.extend(windows)
            
            for window in windows:
                severity = SeverityLevel.MEDIUM
                if window.max_value - window.threshold > 10:
                    severity = SeverityLevel.HIGH
                elif window.duration_minutes > 30:
                    severity = SeverityLevel.HIGH
                
                anomaly = AnomalyEvent(
                    event_id=f'ANOM-{anomaly_counter:05d}',
                    event_type=AnomalyType.OVER_THRESHOLD,
                    site_id=site_id,
                    start_time=window.start_time,
                    end_time=window.end_time,
                    severity=severity,
                    description=f'噪声超标: 最大值{window.max_value:.1f}dB, 超过阈值{window.threshold:.1f}dB',
                    evidence={'window_id': window.window_id, 'max_value': window.max_value, 'threshold': window.threshold}
                )
                all_anomalies.append(anomaly)
                anomaly_counter += 1
            
            peaks = self.detect_sudden_peaks(noise_data, site_id)
            all_peaks.extend(peaks)
            
            for peak in peaks:
                severity = SeverityLevel.MEDIUM
                if peak.increase_amount > 25:
                    severity = SeverityLevel.CRITICAL
                elif peak.increase_amount > 20:
                    severity = SeverityLevel.HIGH
                
                anomaly = AnomalyEvent(
                    event_id=f'ANOM-{anomaly_counter:05d}',
                    event_type=AnomalyType.SUDDEN_PEAK,
                    site_id=site_id,
                    start_time=peak.timestamp,
                    end_time=peak.timestamp + timedelta(seconds=peak.duration_seconds),
                    severity=severity,
                    description=f'噪声突增: 峰值{peak.peak_value:.1f}dB, 较基线增加{peak.increase_amount:.1f}dB',
                    evidence={'peak_id': peak.peak_id, 'peak_value': peak.peak_value, 'increase_amount': peak.increase_amount}
                )
                all_anomalies.append(anomaly)
                anomaly_counter += 1
            
            offlines = self.detect_sensor_offline_periods(noise_data, site_id)
            all_offlines.extend(offlines)
            
            for offline in offlines:
                severity = SeverityLevel.MEDIUM
                if offline.duration_minutes > 60:
                    severity = SeverityLevel.HIGH
                
                anomaly = AnomalyEvent(
                    event_id=f'ANOM-{anomaly_counter:05d}',
                    event_type=AnomalyType.SENSOR_OFFLINE,
                    site_id=site_id,
                    start_time=offline.start_time,
                    end_time=offline.end_time,
                    severity=severity,
                    description=f'传感器离线: 持续{offline.duration_minutes:.1f}分钟, 缺失{offline.missing_count}个采样',
                    evidence={'period_id': offline.period_id, 'duration_minutes': offline.duration_minutes, 'missing_count': offline.missing_count}
                )
                all_anomalies.append(anomaly)
                anomaly_counter += 1
        
        result.over_threshold_windows = all_windows
        result.sudden_peaks = all_peaks
        result.sensor_offline_periods = all_offlines
        result.anomaly_events = all_anomalies
        
        if complaint_data and complaint_data.records:
            all_evidences = []
            
            for complaint in complaint_data.records:
                site_noise_data = noise_data_dict.get(complaint.site_id)
                site_weather_data = weather_data_dict.get(complaint.site_id)
                
                evidence = self.analyze_complaint_evidence(
                    complaint=complaint,
                    noise_data=site_noise_data,
                    weather_data=site_weather_data,
                    over_threshold_windows=all_windows,
                    sudden_peaks=all_peaks,
                    offline_periods=all_offlines
                )
                all_evidences.append(evidence)
                
                if evidence.has_exceedance:
                    for window in all_windows:
                        if window.site_id == complaint.site_id:
                            if complaint.complaint_id not in window.related_complaints:
                                window.related_complaints.append(complaint.complaint_id)
                
                for anomaly in all_anomalies:
                    if anomaly.site_id == complaint.site_id:
                        if self._time_overlaps(
                            anomaly.start_time, anomaly.end_time,
                            evidence.analysis_window_start, evidence.analysis_window_end
                        ):
                            if complaint.complaint_id not in anomaly.related_complaints:
                                anomaly.related_complaints.append(complaint.complaint_id)
            
            result.complaint_evidences = all_evidences
        
        result.statistics = self._calculate_statistics(result, noise_data_dict)
        
        return result
    
    def _calculate_statistics(self,
                               result: AnalysisResult,
                               noise_data_dict: Dict[str, NoiseData]) -> Dict[str, Any]:
        """计算统计信息"""
        stats = {
            'total_anomaly_events': len(result.anomaly_events),
            'anomaly_by_type': {},
            'total_over_threshold_windows': len(result.over_threshold_windows),
            'total_sudden_peaks': len(result.sudden_peaks),
            'total_sensor_offlines': len(result.sensor_offline_periods),
            'total_complaint_evidences': len(result.complaint_evidences),
            'site_statistics': {}
        }
        
        for anomaly_type in AnomalyType:
            count = len([a for a in result.anomaly_events if a.event_type == anomaly_type])
            stats['anomaly_by_type'][anomaly_type.value] = count
        
        for site_id, noise_data in noise_data_dict.items():
            site_stats = noise_data.get_statistics()
            
            site_windows = [w for w in result.over_threshold_windows if w.site_id == site_id]
            site_peaks = [p for p in result.sudden_peaks if p.site_id == site_id]
            site_offlines = [o for o in result.sensor_offline_periods if o.site_id == site_id]
            
            site_stats['over_threshold_windows'] = len(site_windows)
            site_stats['sudden_peaks'] = len(site_peaks)
            site_stats['sensor_offlines'] = len(site_offlines)
            
            if site_windows:
                site_stats['max_exceedance'] = max(w.max_value - w.threshold for w in site_windows)
            if site_peaks:
                site_stats['max_peak_increase'] = max(p.increase_amount for p in site_peaks)
            
            stats['site_statistics'][site_id] = site_stats
        
        complaint_stats = {
            'confirmed': 0,
            'dismissed': 0,
            'further_review': 0
        }
        
        for evidence in result.complaint_evidences:
            if evidence.recommendation in complaint_stats:
                complaint_stats[evidence.recommendation] += 1
        
        stats['complaint_recommendations'] = complaint_stats
        
        return stats
