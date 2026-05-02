"""
指标计算模块 - 计算最大生长速率、滞后期估计、补料前后pH变化、溶氧跌落区间和批次间相似度
"""
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from scipy import stats


@dataclass
class GrowthMetrics:
    """生长指标"""
    max_growth_rate: Optional[float] = None
    max_growth_rate_time: Optional[datetime] = None
    lag_phase_duration_hours: Optional[float] = None
    lag_phase_end_time: Optional[datetime] = None
    doubling_time_hours: Optional[float] = None
    final_od600: Optional[float] = None
    od600_increase: Optional[float] = None
    total_duration_hours: Optional[float] = None


@dataclass
class FeedMetrics:
    """补料指标"""
    feed_time: datetime
    feed_amount: float
    feed_formulation: Optional[str]
    ph_before_feed: Optional[float]
    ph_after_feed: Optional[float]
    ph_change: Optional[float]
    do_before_feed: Optional[float]
    do_after_feed: Optional[float]
    do_change: Optional[float]
    temperature_before_feed: Optional[float]
    temperature_after_feed: Optional[float]


@dataclass
class DODeclineInterval:
    """溶氧跌落区间"""
    start_time: datetime
    end_time: datetime
    duration_hours: float
    do_start: float
    do_end: float
    do_drop: float
    drop_rate_per_hour: float
    associated_phase: Optional[str] = None


@dataclass
class BatchSimilarity:
    """批次相似度"""
    batch_id_1: str
    batch_id_2: str
    overall_similarity: float
    growth_rate_similarity: float
    ph_profile_similarity: float
    do_profile_similarity: float
    temperature_profile_similarity: float
    phase_distribution_similarity: float


class MetricsCalculator:
    """指标计算器"""
    
    def __init__(self, config: Any = None):
        self.config = config
    
    def calculate_growth_metrics(
        self,
        merged_data: List[Dict[str, Any]],
        phase_segments: List[Dict[str, Any]]
    ) -> GrowthMetrics:
        """
        计算生长指标
        
        Args:
            merged_data: 合并后的校准数据
            phase_segments: 阶段切分结果
            
        Returns:
            GrowthMetrics对象
        """
        metrics = GrowthMetrics()
        
        od_data = [
            (p["datetime"], p["od600"])
            for p in merged_data
            if p.get("od600") is not None and p["od600"] > 0
        ]
        
        if len(od_data) < 2:
            return metrics
        
        od_data.sort(key=lambda x: x[0])
        metrics.total_duration_hours = (od_data[-1][0] - od_data[0][0]).total_seconds() / 3600
        metrics.final_od600 = od_data[-1][1]
        metrics.od600_increase = od_data[-1][1] - od_data[0][1]
        
        max_rate, max_rate_time = self._calculate_max_growth_rate(od_data)
        metrics.max_growth_rate = max_rate
        metrics.max_growth_rate_time = max_rate_time
        
        if max_rate and max_rate > 0:
            metrics.doubling_time_hours = np.log(2) / max_rate
        
        lag_duration, lag_end_time = self._estimate_lag_phase(od_data, phase_segments)
        metrics.lag_phase_duration_hours = lag_duration
        metrics.lag_phase_end_time = lag_end_time
        
        return metrics
    
    def _calculate_max_growth_rate(
        self,
        od_data: List[Tuple[datetime, float]]
    ) -> Tuple[Optional[float], Optional[datetime]]:
        """
        计算最大比生长速率
        
        使用滑动窗口计算对数生长速率
        
        Args:
            od_data: (时间, OD值)元组列表
            
        Returns:
            (最大生长速率, 对应时间)
        """
        if len(od_data) < 3:
            return None, None
        
        times = np.array([(t - od_data[0][0]).total_seconds() / 3600 for t, _ in od_data])
        od_values = np.array([od for _, od in od_data])
        ln_od = np.log(od_values)
        
        window_size = min(3, len(times) // 2)
        if window_size < 2:
            window_size = 2
        
        max_rate = -float('inf')
        max_rate_time = None
        
        for i in range(len(times) - window_size + 1):
            window_times = times[i:i+window_size]
            window_ln_od = ln_od[i:i+window_size]
            
            if len(window_times) >= 2:
                slope, intercept, r_value, p_value, std_err = stats.linregress(
                    window_times, window_ln_od
                )
                
                if slope > max_rate and r_value > 0.8:
                    max_rate = slope
                    max_rate_time = od_data[i + window_size // 2][0]
        
        if max_rate == -float('inf'):
            for i in range(len(times) - 1):
                dt = times[i+1] - times[i]
                if dt > 0:
                    rate = (ln_od[i+1] - ln_od[i]) / dt
                    if rate > max_rate:
                        max_rate = rate
                        max_rate_time = od_data[i][0]
        
        return (round(max_rate, 4) if max_rate != -float('inf') else None, 
                max_rate_time)
    
    def _estimate_lag_phase(
        self,
        od_data: List[Tuple[datetime, float]],
        phase_segments: List[Dict[str, Any]]
    ) -> Tuple[Optional[float], Optional[datetime]]:
        """
        估计滞后期
        
        Args:
            od_data: OD数据
            phase_segments: 阶段切分结果
            
        Returns:
            (滞后期时长, 滞后期结束时间)
        """
        lag_segments = [s for s in phase_segments if s.get("phase") == "lag"]
        
        if lag_segments:
            total_duration = sum(s.get("duration_hours", 0) for s in lag_segments)
            end_time = max(
                datetime.fromisoformat(s.get("end_time"))
                for s in lag_segments
                if s.get("end_time")
            )
            return round(total_duration, 2), end_time
        
        if len(od_data) < 3:
            return None, None
        
        times = np.array([(t - od_data[0][0]).total_seconds() / 3600 for t, _ in od_data])
        od_values = np.array([od for _, od in od_data])
        
        initial_od = od_values[0]
        growth_threshold = initial_od * 1.05
        
        for i, od in enumerate(od_values):
            if od > growth_threshold and i > 0:
                lag_duration = times[i]
                lag_end_time = od_data[i][0]
                return round(lag_duration, 2), lag_end_time
        
        return None, None
    
    def calculate_feed_metrics(
        self,
        merged_data: List[Dict[str, Any]],
        feed_events: List[Dict[str, Any]]
    ) -> List[FeedMetrics]:
        """
        计算补料相关指标
        
        Args:
            merged_data: 合并后的校准数据
            feed_events: 补料事件列表
            
        Returns:
            FeedMetrics对象列表
        """
        feed_metrics_list: List[FeedMetrics] = []
        
        if not feed_events or not merged_data:
            return feed_metrics_list
        
        for feed in feed_events:
            feed_time = datetime.fromisoformat(feed["time"])
            feed_amount = feed.get("amount", 0)
            feed_formulation = feed.get("formulation")
            
            metrics = FeedMetrics(
                feed_time=feed_time,
                feed_amount=feed_amount,
                feed_formulation=feed_formulation
            )
            
            before_data = [
                p for p in merged_data
                if p["datetime"] <= feed_time
            ]
            after_data = [
                p for p in merged_data
                if p["datetime"] > feed_time
            ]
            
            if before_data:
                latest_before = before_data[-1]
                metrics.ph_before_feed = latest_before.get("ph")
                metrics.do_before_feed = latest_before.get("dissolved_oxygen")
                metrics.temperature_before_feed = latest_before.get("temperature")
            
            if after_data:
                window_after = [
                    p for p in after_data
                    if (p["datetime"] - feed_time).total_seconds() / 3600 <= 1.0
                ]
                if window_after:
                    first_after = window_after[0]
                    metrics.ph_after_feed = first_after.get("ph")
                    metrics.do_after_feed = first_after.get("dissolved_oxygen")
                    metrics.temperature_after_feed = first_after.get("temperature")
                elif after_data:
                    first_after = after_data[0]
                    metrics.ph_after_feed = first_after.get("ph")
                    metrics.do_after_feed = first_after.get("dissolved_oxygen")
                    metrics.temperature_after_feed = first_after.get("temperature")
            
            if metrics.ph_before_feed is not None and metrics.ph_after_feed is not None:
                metrics.ph_change = round(metrics.ph_after_feed - metrics.ph_before_feed, 4)
            
            if metrics.do_before_feed is not None and metrics.do_after_feed is not None:
                metrics.do_change = round(metrics.do_after_feed - metrics.do_before_feed, 2)
            
            feed_metrics_list.append(metrics)
        
        return feed_metrics_list
    
    def detect_do_decline_intervals(
        self,
        merged_data: List[Dict[str, Any]],
        threshold_drop_per_hour: float = 10.0,
        min_duration_hours: float = 0.5
    ) -> List[DODeclineInterval]:
        """
        检测溶氧跌落区间
        
        Args:
            merged_data: 合并后的校准数据
            threshold_drop_per_hour: 每小时跌落阈值
            min_duration_hours: 最小时长
            
        Returns:
            DODeclineInterval对象列表
        """
        intervals: List[DODeclineInterval] = []
        
        if len(merged_data) < 2:
            return intervals
        
        do_data = [
            (p["datetime"], p["dissolved_oxygen"])
            for p in merged_data
            if p.get("dissolved_oxygen") is not None
        ]
        
        if len(do_data) < 3:
            return intervals
        
        in_decline = False
        decline_start_idx = 0
        decline_start_do = 0
        
        for i in range(1, len(do_data)):
            time_prev, do_prev = do_data[i-1]
            time_curr, do_curr = do_data[i]
            
            dt_hours = (time_curr - time_prev).total_seconds() / 3600
            
            if dt_hours <= 0:
                continue
            
            drop_rate = (do_prev - do_curr) / dt_hours
            
            if drop_rate >= threshold_drop_per_hour and do_curr < do_prev:
                if not in_decline:
                    in_decline = True
                    decline_start_idx = i - 1
                    decline_start_do = do_prev
            else:
                if in_decline:
                    in_decline = False
                    
                    duration = (time_prev - do_data[decline_start_idx][0]).total_seconds() / 3600
                    
                    if duration >= min_duration_hours:
                        total_drop = decline_start_do - do_prev
                        avg_drop_rate = total_drop / duration if duration > 0 else 0
                        
                        interval = DODeclineInterval(
                            start_time=do_data[decline_start_idx][0],
                            end_time=time_prev,
                            duration_hours=round(duration, 2),
                            do_start=round(decline_start_do, 2),
                            do_end=round(do_prev, 2),
                            do_drop=round(total_drop, 2),
                            drop_rate_per_hour=round(avg_drop_rate, 2)
                        )
                        intervals.append(interval)
        
        if in_decline and len(do_data) > decline_start_idx + 1:
            last_time, last_do = do_data[-1]
            duration = (last_time - do_data[decline_start_idx][0]).total_seconds() / 3600
            
            if duration >= min_duration_hours:
                total_drop = decline_start_do - last_do
                avg_drop_rate = total_drop / duration if duration > 0 else 0
                
                interval = DODeclineInterval(
                    start_time=do_data[decline_start_idx][0],
                    end_time=last_time,
                    duration_hours=round(duration, 2),
                    do_start=round(decline_start_do, 2),
                    do_end=round(last_do, 2),
                    do_drop=round(total_drop, 2),
                    drop_rate_per_hour=round(avg_drop_rate, 2)
                )
                intervals.append(interval)
        
        return intervals
    
    def calculate_batch_similarity(
        self,
        batch_data_1: Dict[str, Any],
        batch_data_2: Dict[str, Any]
    ) -> BatchSimilarity:
        """
        计算两个批次之间的相似度
        
        Args:
            batch_data_1: 批次1数据
            batch_data_2: 批次2数据
            
        Returns:
            BatchSimilarity对象
        """
        batch_id_1 = batch_data_1.get("batch_id", "unknown_1")
        batch_id_2 = batch_data_2.get("batch_id", "unknown_2")
        
        metrics_1 = batch_data_1.get("growth_metrics", {})
        metrics_2 = batch_data_2.get("growth_metrics", {})
        
        gr_sim = self._calculate_metric_similarity(
            metrics_1.get("max_growth_rate"),
            metrics_2.get("max_growth_rate"),
            0.5
        )
        
        ph_sim = self._calculate_profile_similarity(
            batch_data_1.get("merged_data", []),
            batch_data_2.get("merged_data", []),
            "ph"
        )
        
        do_sim = self._calculate_profile_similarity(
            batch_data_1.get("merged_data", []),
            batch_data_2.get("merged_data", []),
            "dissolved_oxygen"
        )
        
        temp_sim = self._calculate_profile_similarity(
            batch_data_1.get("merged_data", []),
            batch_data_2.get("merged_data", []),
            "temperature"
        )
        
        phase_sim = self._calculate_phase_similarity(
            batch_data_1.get("phase_segments", []),
            batch_data_2.get("phase_segments", [])
        )
        
        weights = {
            "growth_rate": 0.25,
            "ph": 0.2,
            "do": 0.2,
            "temperature": 0.15,
            "phase": 0.2
        }
        
        overall = (
            gr_sim * weights["growth_rate"] +
            ph_sim * weights["ph"] +
            do_sim * weights["do"] +
            temp_sim * weights["temperature"] +
            phase_sim * weights["phase"]
        )
        
        return BatchSimilarity(
            batch_id_1=batch_id_1,
            batch_id_2=batch_id_2,
            overall_similarity=round(overall, 4),
            growth_rate_similarity=round(gr_sim, 4),
            ph_profile_similarity=round(ph_sim, 4),
            do_profile_similarity=round(do_sim, 4),
            temperature_profile_similarity=round(temp_sim, 4),
            phase_distribution_similarity=round(phase_sim, 4)
        )
    
    def _calculate_metric_similarity(
        self,
        value1: Optional[float],
        value2: Optional[float],
        scale: float
    ) -> float:
        """
        计算单个数值指标的相似度
        
        使用高斯核函数
        """
        if value1 is None or value2 is None:
            return 0.5
        
        if value1 == 0 and value2 == 0:
            return 1.0
        
        diff = abs(value1 - value2)
        return float(np.exp(-(diff ** 2) / (2 * scale ** 2)))
    
    def _calculate_profile_similarity(
        self,
        data1: List[Dict[str, Any]],
        data2: List[Dict[str, Any]],
        field: str
    ) -> float:
        """
        计算时间曲线的相似度
        """
        values1 = [p.get(field) for p in data1 if p.get(field) is not None]
        values2 = [p.get(field) for p in data2 if p.get(field) is not None]
        
        if not values1 or not values2:
            return 0.5
        
        min_len = min(len(values1), len(values2))
        if min_len < 3:
            return 0.5
        
        v1 = np.array(values1[:min_len])
        v2 = np.array(values2[:min_len])
        
        norm1 = np.linalg.norm(v1)
        norm2 = np.linalg.norm(v2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.5
        
        correlation = np.dot(v1, v2) / (norm1 * norm2)
        
        similarity = (correlation + 1) / 2
        
        return float(similarity)
    
    def _calculate_phase_similarity(
        self,
        segments1: List[Dict[str, Any]],
        segments2: List[Dict[str, Any]]
    ) -> float:
        """
        计算阶段分布的相似度
        """
        if not segments1 or not segments2:
            return 0.5
        
        def get_phase_distribution(segments):
            total = sum(s.get("duration_hours", 0) for s in segments)
            if total == 0:
                return {}
            
            distribution = {}
            for s in segments:
                phase = s.get("phase", "unknown")
                duration = s.get("duration_hours", 0)
                distribution[phase] = distribution.get(phase, 0) + duration / total
            
            return distribution
        
        dist1 = get_phase_distribution(segments1)
        dist2 = get_phase_distribution(segments2)
        
        all_phases = set(dist1.keys()) | set(dist2.keys())
        
        similarity = 0.0
        for phase in all_phases:
            p1 = dist1.get(phase, 0)
            p2 = dist2.get(phase, 0)
            similarity += 1 - abs(p1 - p2)
        
        if all_phases:
            similarity /= len(all_phases)
        
        return float(similarity)


def calculate_all_metrics(
    calibration_result: Dict[str, Any],
    phase_result: Dict[str, Any],
    config: Any = None
) -> Dict[str, Any]:
    """
    计算所有指标的主函数
    
    Args:
        calibration_result: 校准结果
        phase_result: 阶段切分结果
        config: 配置对象
        
    Returns:
        包含所有指标的字典
    """
    if "error" in calibration_result:
        return calibration_result
    
    merged_data = calibration_result.get("merged_data", [])
    feed_events = calibration_result.get("feed_events", [])
    phase_segments = phase_result.get("segments", [])
    
    if not merged_data:
        return {"error": "没有数据进行指标计算"}
    
    calculator = MetricsCalculator(config)
    
    growth_metrics = calculator.calculate_growth_metrics(merged_data, phase_segments)
    
    feed_metrics = calculator.calculate_feed_metrics(merged_data, feed_events)
    
    do_intervals = calculator.detect_do_decline_intervals(merged_data)
    
    return {
        "growth_metrics": {
            "max_growth_rate": growth_metrics.max_growth_rate,
            "max_growth_rate_time": growth_metrics.max_growth_rate_time.isoformat() if growth_metrics.max_growth_rate_time else None,
            "lag_phase_duration_hours": growth_metrics.lag_phase_duration_hours,
            "lag_phase_end_time": growth_metrics.lag_phase_end_time.isoformat() if growth_metrics.lag_phase_end_time else None,
            "doubling_time_hours": growth_metrics.doubling_time_hours,
            "final_od600": growth_metrics.final_od600,
            "od600_increase": growth_metrics.od600_increase,
            "total_duration_hours": growth_metrics.total_duration_hours
        },
        "feed_metrics": [
            {
                "feed_time": fm.feed_time.isoformat(),
                "feed_amount": fm.feed_amount,
                "feed_formulation": fm.feed_formulation,
                "ph_before_feed": fm.ph_before_feed,
                "ph_after_feed": fm.ph_after_feed,
                "ph_change": fm.ph_change,
                "do_before_feed": fm.do_before_feed,
                "do_after_feed": fm.do_after_feed,
                "do_change": fm.do_change,
                "temperature_before_feed": fm.temperature_before_feed,
                "temperature_after_feed": fm.temperature_after_feed
            }
            for fm in feed_metrics
        ],
        "do_decline_intervals": [
            {
                "start_time": interval.start_time.isoformat(),
                "end_time": interval.end_time.isoformat(),
                "duration_hours": interval.duration_hours,
                "do_start": interval.do_start,
                "do_end": interval.do_end,
                "do_drop": interval.do_drop,
                "drop_rate_per_hour": interval.drop_rate_per_hour
            }
            for interval in do_intervals
        ]
    }
