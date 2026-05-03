import pandas as pd
import numpy as np
from typing import Optional, Dict, Any, Tuple, List, Callable
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class MissingHandler:
    """缺测数据处理器"""
    
    FILL_STRATEGIES = {
        "forward": "前向填充",
        "backward": "后向填充",
        "interpolate": "插值填充",
        "mean": "均值填充",
        "median": "中位数填充",
        "mode": "众数填充",
        "constant": "常量填充",
        "time_weighted": "时间加权填充",
        "drop": "删除缺失"
    }
    
    def __init__(self):
        self.missing_stats: Dict[str, Any] = {
            "total_records": 0,
            "total_missing": 0,
            "columns_missing": {},
            "filled_count": 0,
            "dropped_count": 0,
            "patterns": []
        }
    
    def detect_missing(
        self,
        df: pd.DataFrame,
        detail: bool = True
    ) -> Dict[str, Any]:
        """
        检测缺失值
        
        Args:
            df: 数据 DataFrame
            detail: 是否返回详细信息
            
        Returns:
            缺失值统计信息
        """
        stats = {
            "total_records": len(df),
            "total_missing": int(df.isna().sum().sum()),
            "columns": {}
        }
        
        for col in df.columns:
            missing_count = int(df[col].isna().sum())
            missing_ratio = missing_count / len(df) if len(df) > 0 else 0
            
            stats["columns"][col] = {
                "missing_count": missing_count,
                "missing_ratio": round(missing_ratio, 4),
                "dtype": str(df[col].dtype)
            }
        
        if detail:
            stats["patterns"] = self._detect_missing_patterns(df)
        
        self.missing_stats.update(stats)
        
        return stats
    
    def _detect_missing_patterns(
        self,
        df: pd.DataFrame
    ) -> List[Dict[str, Any]]:
        """
        检测缺失值模式
        
        Args:
            df: 数据 DataFrame
            
        Returns:
            缺失模式列表
        """
        patterns = []
        
        null_matrix = df.isna()
        
        if "monitor_time" in df.columns or "complaint_time" in df.columns:
            time_col = "monitor_time" if "monitor_time" in df.columns else "complaint_time"
            
            df_sorted = df.sort_values(time_col)
            null_series = df_sorted.isna().any(axis=1)
            
            consecutive_missing = []
            current_start = None
            current_count = 0
            
            for idx, is_null in enumerate(null_series):
                if is_null:
                    if current_start is None:
                        current_start = idx
                    current_count += 1
                else:
                    if current_start is not None and current_count >= 3:
                        start_time = df_sorted.iloc[current_start][time_col]
                        end_time = df_sorted.iloc[idx - 1][time_col]
                        consecutive_missing.append({
                            "type": "consecutive_time",
                            "start_index": current_start,
                            "end_index": idx - 1,
                            "start_time": start_time,
                            "end_time": end_time,
                            "count": current_count
                        })
                    current_start = None
                    current_count = 0
            
            patterns.extend(consecutive_missing)
        
        column_correlations = []
        for i, col1 in enumerate(df.columns):
            for col2 in list(df.columns)[i+1:]:
                both_null = (df[col1].isna() & df[col2].isna()).sum()
                if both_null > 0:
                    column_correlations.append({
                        "type": "column_pair",
                        "columns": [col1, col2],
                        "both_null_count": int(both_null),
                        "ratio": round(both_null / len(df), 4)
                    })
        
        patterns.extend(column_correlations)
        
        return patterns
    
    def fill_numeric(
        self,
        series: pd.Series,
        strategy: str = "interpolate",
        constant_value: Any = None,
        time_index: Optional[pd.Series] = None
    ) -> Tuple[pd.Series, int]:
        """
        填充数值型缺失值
        
        Args:
            series: 数据序列
            strategy: 填充策略
            constant_value: 常量值（用于 'constant' 策略）
            time_index: 时间索引（用于 'time_weighted' 策略）
            
        Returns:
            (填充后的序列, 填充数量)
        """
        filled = series.copy()
        original_missing = filled.isna().sum()
        
        if original_missing == 0:
            return filled, 0
        
        if strategy == "forward":
            filled = filled.ffill()
        elif strategy == "backward":
            filled = filled.bfill()
        elif strategy == "interpolate":
            if time_index is not None and not time_index.isna().any():
                filled = filled.interpolate(method="time")
            else:
                filled = filled.interpolate()
        elif strategy == "mean":
            mean_val = series.mean()
            filled = filled.fillna(mean_val)
        elif strategy == "median":
            median_val = series.median()
            filled = filled.fillna(median_val)
        elif strategy == "mode":
            mode_val = series.mode().iloc[0] if not series.mode().empty else None
            if mode_val is not None:
                filled = filled.fillna(mode_val)
        elif strategy == "constant":
            if constant_value is not None:
                filled = filled.fillna(constant_value)
        elif strategy == "time_weighted" and time_index is not None:
            valid_idx = ~filled.isna()
            if valid_idx.sum() >= 2:
                filled = filled.interpolate(method="time")
        elif strategy == "drop":
            filled = filled.dropna()
        
        filled_count = original_missing - filled.isna().sum()
        
        return filled, filled_count
    
    def fill_categorical(
        self,
        series: pd.Series,
        strategy: str = "mode",
        constant_value: Any = "unknown"
    ) -> Tuple[pd.Series, int]:
        """
        填充类别型缺失值
        
        Args:
            series: 数据序列
            strategy: 填充策略
            constant_value: 常量值
            
        Returns:
            (填充后的序列, 填充数量)
        """
        filled = series.copy()
        original_missing = filled.isna().sum()
        
        if original_missing == 0:
            return filled, 0
        
        if strategy == "mode":
            mode_val = series.mode().iloc[0] if not series.mode().empty else constant_value
            filled = filled.fillna(mode_val)
        elif strategy == "constant":
            filled = filled.fillna(constant_value)
        elif strategy == "forward":
            filled = filled.ffill()
        elif strategy == "backward":
            filled = filled.bfill()
        elif strategy == "drop":
            filled = filled.dropna()
        
        filled_count = original_missing - filled.isna().sum()
        
        return filled, filled_count
    
    def process_dataframe(
        self,
        df: pd.DataFrame,
        column_strategies: Optional[Dict[str, str]] = None,
        default_numeric_strategy: str = "interpolate",
        default_categorical_strategy: str = "mode",
        time_column: Optional[str] = None,
        drop_threshold: float = 0.5
    ) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        处理整个 DataFrame 的缺失值
        
        Args:
            df: 数据 DataFrame
            column_strategies: 各列的填充策略
            default_numeric_strategy: 数值列默认策略
            default_categorical_strategy: 类别列默认策略
            time_column: 时间列名
            drop_threshold: 删除列的阈值（缺失比例超过此值则删除）
            
        Returns:
            (处理后的 DataFrame, 处理统计)
        """
        stats = {
            "original_shape": df.shape,
            "columns_dropped": [],
            "columns_processed": {},
            "total_filled": 0,
            "total_dropped_rows": 0
        }
        
        result_df = df.copy()
        
        missing_stats = self.detect_missing(result_df, detail=False)
        
        for col in result_df.columns:
            col_missing_ratio = missing_stats["columns"][col]["missing_ratio"]
            
            if col_missing_ratio > drop_threshold:
                stats["columns_dropped"].append({
                    "column": col,
                    "missing_ratio": col_missing_ratio
                })
                result_df = result_df.drop(columns=[col])
                continue
        
        time_index = None
        if time_column and time_column in result_df.columns:
            time_index = result_df[time_column]
        
        for col in result_df.columns:
            if col == time_column:
                continue
            
            col_missing = result_df[col].isna().sum()
            if col_missing == 0:
                continue
            
            strategy = None
            if column_strategies and col in column_strategies:
                strategy = column_strategies[col]
            
            is_numeric = pd.api.types.is_numeric_dtype(result_df[col])
            
            if strategy is None:
                strategy = default_numeric_strategy if is_numeric else default_categorical_strategy
            
            if is_numeric:
                result_df[col], filled = self.fill_numeric(
                    result_df[col],
                    strategy=strategy,
                    time_index=time_index
                )
            else:
                result_df[col], filled = self.fill_categorical(
                    result_df[col],
                    strategy=strategy
                )
            
            stats["columns_processed"][col] = {
                "strategy": strategy,
                "filled_count": int(filled),
                "is_numeric": is_numeric
            }
            stats["total_filled"] += filled
        
        stats["final_shape"] = result_df.shape
        
        return result_df, stats
    
    def get_missing_report(self) -> Dict[str, Any]:
        """获取缺失值处理报告"""
        return self.missing_stats
