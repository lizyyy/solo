import pandas as pd
import numpy as np
from typing import Optional, Dict, Any, Tuple, List
from datetime import datetime, timedelta
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TimeProcessor:
    """时间格式处理器"""
    
    TIME_FORMATS = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d %H:%M",
        "%Y年%m月%d日 %H:%M:%S",
        "%Y年%m月%d日 %H:%M",
        "%d/%m/%Y %H:%M:%S",
        "%m/%d/%Y %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y%m%d%H%M%S",
        "%Y%m%d %H%M%S",
    ]
    
    def __init__(self):
        self.cleaning_stats: Dict[str, Any] = {
            "total_records": 0,
            "valid_records": 0,
            "fixed_records": 0,
            "invalid_records": 0,
            "time_gaps": [],
            "outliers": []
        }
    
    def parse_datetime(
        self, 
        value: Any, 
        try_formats: bool = True
    ) -> Optional[pd.Timestamp]:
        """
        解析多种时间格式
        
        Args:
            value: 时间值
            try_formats: 是否尝试多种格式
            
        Returns:
            解析后的 Timestamp，失败返回 None
        """
        if pd.isna(value):
            return None
        
        if isinstance(value, pd.Timestamp):
            return value
        
        if isinstance(value, datetime):
            return pd.Timestamp(value)
        
        if isinstance(value, (int, float)):
            try:
                return pd.Timestamp.fromtimestamp(value)
            except:
                try:
                    return pd.Timestamp.fromtimestamp(value / 1000)
                except:
                    pass
        
        value_str = str(value).strip()
        
        result = pd.to_datetime(value_str, errors="coerce")
        if not pd.isna(result):
            return result
        
        if try_formats:
            for fmt in self.TIME_FORMATS:
                try:
                    result = pd.Timestamp.strptime(value_str, fmt)
                    return result
                except:
                    continue
        
        return None
    
    def parse_time_series(
        self, 
        series: pd.Series, 
        fill_strategy: str = "interpolate"
    ) -> Tuple[pd.Series, Dict[str, Any]]:
        """
        解析时间序列并处理缺失值
        
        Args:
            series: 原始时间序列
            fill_strategy: 填充策略 ('forward', 'backward', 'interpolate', 'drop')
            
        Returns:
            (处理后的时间序列, 统计信息)
        """
        stats = {
            "total": len(series),
            "original_valid": series.notna().sum(),
            "parsed_valid": 0,
            "missing_before": 0,
            "missing_after": 0,
            "filled_count": 0
        }
        
        parsed = series.apply(self.parse_datetime)
        
        stats["parsed_valid"] = parsed.notna().sum()
        stats["missing_before"] = parsed.isna().sum()
        
        if fill_strategy == "drop":
            result = parsed.dropna()
            stats["missing_after"] = result.isna().sum()
            stats["filled_count"] = stats["missing_before"] - stats["missing_after"]
            return result, stats
        
        result = parsed.copy()
        
        if fill_strategy == "forward":
            result = result.ffill()
        elif fill_strategy == "backward":
            result = result.bfill()
        elif fill_strategy == "interpolate":
            result = result.interpolate(method="time")
        
        stats["missing_after"] = result.isna().sum()
        stats["filled_count"] = stats["missing_before"] - stats["missing_after"]
        
        return result, stats
    
    def detect_time_gaps(
        self,
        time_series: pd.Series,
        expected_interval: timedelta = timedelta(minutes=1),
        tolerance: float = 1.5
    ) -> List[Dict[str, Any]]:
        """
        检测时间序列中的间隔
        
        Args:
            time_series: 已排序的时间序列
            expected_interval: 预期间隔
            tolerance: 容差倍数
            
        Returns:
            间隔列表
        """
        gaps = []
        
        if time_series.empty or len(time_series) < 2:
            return gaps
        
        sorted_times = time_series.sort_values()
        
        for i in range(1, len(sorted_times)):
            prev = sorted_times.iloc[i-1]
            curr = sorted_times.iloc[i]
            diff = curr - prev
            
            if diff > expected_interval * tolerance:
                gaps.append({
                    "index": i,
                    "previous_time": prev,
                    "current_time": curr,
                    "gap_duration": diff,
                    "expected_interval": expected_interval,
                    "gap_multiplier": diff / expected_interval
                })
        
        return gaps
    
    def detect_outliers(
        self,
        time_series: pd.Series,
        reference_range: Optional[Tuple[pd.Timestamp, pd.Timestamp]] = None,
        iqr_factor: float = 1.5
    ) -> List[Dict[str, Any]]:
        """
        检测时间值异常值（如未来时间、过久的历史时间）
        
        Args:
            time_series: 时间序列
            reference_range: 参考时间范围，默认使用数据的 5%-95% 分位数
            iqr_factor: IQR 因子
            
        Returns:
            异常值列表
        """
        outliers = []
        
        if time_series.empty:
            return outliers
        
        valid_times = time_series.dropna()
        if valid_times.empty:
            return outliers
        
        if reference_range:
            min_time, max_time = reference_range
        else:
            q5 = valid_times.quantile(0.05)
            q95 = valid_times.quantile(0.95)
            iqr = q95 - q5
            min_time = q5 - iqr_factor * iqr
            max_time = q95 + iqr_factor * iqr
        
        for idx, time_val in valid_times.items():
            if time_val < min_time or time_val > max_time:
                outliers.append({
                    "index": idx,
                    "time_value": time_val,
                    "reference_min": min_time,
                    "reference_max": max_time,
                    "deviation": (time_val - min_time) if time_val < min_time else (time_val - max_time)
                })
        
        return outliers
    
    def extract_time_features(
        self,
        time_series: pd.Series
    ) -> pd.DataFrame:
        """
        从时间序列中提取特征
        
        Args:
            time_series: 时间序列
            
        Returns:
            特征 DataFrame
        """
        features = pd.DataFrame(index=time_series.index)
        
        features["year"] = time_series.dt.year
        features["month"] = time_series.dt.month
        features["day"] = time_series.dt.day
        features["hour"] = time_series.dt.hour
        features["minute"] = time_series.dt.minute
        features["day_of_week"] = time_series.dt.dayofweek
        features["is_weekend"] = time_series.dt.dayofweek >= 5
        features["is_night"] = (time_series.dt.hour >= 22) | (time_series.dt.hour < 6)
        features["is_peak_hour"] = time_series.dt.hour.isin([18, 19, 20, 21, 22, 23, 0, 1])
        
        time_bins = [0, 6, 9, 12, 18, 22, 24]
        time_labels = ["night_late", "early_morning", "morning", "afternoon", "evening", "night_early"]
        features["time_slot"] = pd.cut(
            time_series.dt.hour,
            bins=time_bins,
            labels=time_labels,
            right=False,
            include_lowest=True
        )
        
        return features
    
    def get_cleaning_report(self) -> Dict[str, Any]:
        """获取清洗报告"""
        return self.cleaning_stats
