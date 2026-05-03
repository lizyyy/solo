import pandas as pd
import numpy as np
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime, timedelta
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from config import TIME_CONFIG, NOISE_THRESHOLDS

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class MetricsAggregator:
    """指标计算聚合引擎"""
    
    def __init__(self):
        self.aggregation_stats: Dict[str, Any] = {
            "total_records": 0,
            "time_slots_analyzed": 0,
            "grids_analyzed": 0,
            "metrics_computed": []
        }
    
    def aggregate_by_time(
        self,
        df: pd.DataFrame,
        time_col: str,
        value_cols: List[str],
        freq: str = "H",
        agg_funcs: Optional[Dict] = None
    ) -> pd.DataFrame:
        """
        按时间聚合数据
        
        Args:
            df: 数据 DataFrame
            time_col: 时间列名
            value_cols: 要聚合的值列
            freq: 聚合频率 ('T'分钟, 'H'小时, 'D'天, 'W'周)
            agg_funcs: 聚合函数字典
            
        Returns:
            聚合后的 DataFrame
        """
        if df.empty:
            return pd.DataFrame()
        
        df = df.copy()
        df[time_col] = pd.to_datetime(df[time_col])
        df = df.set_index(time_col)
        
        if agg_funcs is None:
            agg_funcs = {col: ["mean", "max", "min", "std"] for col in value_cols}
        
        result = df.resample(freq).agg(agg_funcs)
        result.columns = ["_".join(col).strip() for col in result.columns.values]
        
        result["count"] = df.resample(freq).size()
        
        return result.reset_index()
    
    def aggregate_by_grid(
        self,
        df: pd.DataFrame,
        grid_col: str,
        value_cols: List[str],
        agg_funcs: Optional[Dict] = None
    ) -> pd.DataFrame:
        """
        按网格聚合数据
        
        Args:
            df: 数据 DataFrame
            grid_col: 网格列名
            value_cols: 要聚合的值列
            agg_funcs: 聚合函数字典
            
        Returns:
            聚合后的 DataFrame
        """
        if df.empty:
            return pd.DataFrame()
        
        if agg_funcs is None:
            agg_funcs = {col: ["mean", "max", "min", "std", "count"] for col in value_cols}
        
        result = df.groupby(grid_col).agg(agg_funcs)
        result.columns = ["_".join(col).strip() for col in result.columns.values]
        
        return result.reset_index()
    
    def aggregate_by_grid_and_time(
        self,
        df: pd.DataFrame,
        grid_col: str,
        time_col: str,
        value_cols: List[str],
        freq: str = "H"
    ) -> pd.DataFrame:
        """
        按网格和时间双重聚合
        
        Args:
            df: 数据 DataFrame
            grid_col: 网格列名
            time_col: 时间列名
            value_cols: 要聚合的值列
            freq: 聚合频率
            
        Returns:
            聚合后的 DataFrame
        """
        if df.empty:
            return pd.DataFrame()
        
        df = df.copy()
        df[time_col] = pd.to_datetime(df[time_col])
        
        df["time_slot"] = df[time_col].dt.floor(freq)
        
        agg_funcs = {}
        for col in value_cols:
            agg_funcs[col] = ["mean", "max", "min", "std"]
        
        result = df.groupby([grid_col, "time_slot"]).agg(agg_funcs)
        result.columns = ["_".join(col).strip() for col in result.columns.values]
        result["record_count"] = df.groupby([grid_col, "time_slot"]).size()
        
        return result.reset_index()
    
    def compute_noise_metrics(
        self,
        monitoring_df: pd.DataFrame,
        db_col: str = "db_level",
        peak_col: str = "db_peak",
        time_col: str = "monitor_time"
    ) -> Dict[str, Any]:
        """
        计算噪声相关指标
        
        Args:
            monitoring_df: 噪声监测数据
            db_col: 分贝值列名
            peak_col: 峰值列名
            time_col: 时间列名
            
        Returns:
            噪声指标字典
        """
        if monitoring_df.empty:
            return {}
        
        df = monitoring_df.copy()
        
        metrics = {
            "overall": {},
            "by_hour": {},
            "night_stats": {},
            "exceedances": {}
        }
        
        metrics["overall"] = {
            "mean_db": float(df[db_col].mean()) if db_col in df.columns else None,
            "max_db": float(df[db_col].max()) if db_col in df.columns else None,
            "min_db": float(df[db_col].min()) if db_col in df.columns else None,
            "std_db": float(df[db_col].std()) if db_col in df.columns else None,
            "max_peak": float(df[peak_col].max()) if peak_col in df.columns else None,
            "total_records": len(df)
        }
        
        if time_col in df.columns:
            df[time_col] = pd.to_datetime(df[time_col])
            df["hour"] = df[time_col].dt.hour
            
            hour_stats = df.groupby("hour")[db_col].agg(["mean", "max", "min", "std", "count"])
            metrics["by_hour"] = hour_stats.to_dict("index")
            
            night_mask = (df["hour"] >= TIME_CONFIG["night_start_hour"]) | (df["hour"] < TIME_CONFIG["night_end_hour"])
            night_df = df[night_mask]
            
            if not night_df.empty:
                metrics["night_stats"] = {
                    "mean_db": float(night_df[db_col].mean()),
                    "max_db": float(night_df[db_col].max()),
                    "record_count": len(night_df),
                    "night_ratio": len(night_df) / len(df)
                }
        
        if db_col in df.columns:
            residential_threshold = NOISE_THRESHOLDS.get("residential_night", 55)
            exceedances = df[df[db_col] > residential_threshold]
            
            metrics["exceedances"] = {
                "count": len(exceedances),
                "ratio": len(exceedances) / len(df) if len(df) > 0 else 0,
                "max_exceedance": float(exceedances[db_col].max() - residential_threshold) if not exceedances.empty else 0,
                "threshold": residential_threshold
            }
        
        return metrics
    
    def compute_complaint_density(
        self,
        complaints_df: pd.DataFrame,
        grids_df: Optional[pd.DataFrame] = None,
        time_col: str = "complaint_time",
        grid_col: str = "grid_id",
        area_col: str = "area"
    ) -> Dict[str, Any]:
        """
        计算投诉密度
        
        Args:
            complaints_df: 投诉数据
            grids_df: 网格数据
            time_col: 时间列名
            grid_col: 网格列名
            area_col: 面积列名
            
        Returns:
            投诉密度指标
        """
        if complaints_df.empty:
            return {}
        
        metrics = {
            "total_complaints": len(complaints_df),
            "by_grid": {},
            "by_time": {},
            "density": {}
        }
        
        if grid_col in complaints_df.columns:
            by_grid = complaints_df.groupby(grid_col).size().reset_index(name="complaint_count")
            
            if grids_df is not None and grid_col in grids_df.columns:
                if area_col in grids_df.columns:
                    by_grid = by_grid.merge(
                        grids_df[[grid_col, area_col]],
                        on=grid_col,
                        how="left"
                    )
                    by_grid["density_per_km2"] = by_grid["complaint_count"] / by_grid[area_col].replace(0, 1)
                else:
                    by_grid["density_per_km2"] = None
            
            metrics["by_grid"] = by_grid.set_index(grid_col).to_dict("index")
        
        if time_col in complaints_df.columns:
            complaints_df = complaints_df.copy()
            complaints_df[time_col] = pd.to_datetime(complaints_df[time_col])
            complaints_df["date"] = complaints_df[time_col].dt.date
            complaints_df["hour"] = complaints_df[time_col].dt.hour
            
            by_date = complaints_df.groupby("date").size().reset_index(name="count")
            by_hour = complaints_df.groupby("hour").size().reset_index(name="count")
            
            metrics["by_time"] = {
                "by_date": by_date.to_dict("records"),
                "by_hour": by_hour.to_dict("records")
            }
            
            peak_hours = TIME_CONFIG.get("peak_hours", [18, 19, 20, 21, 22, 23, 0, 1])
            peak_complaints = complaints_df[complaints_df["hour"].isin(peak_hours)]
            
            metrics["density"]["peak_hour_ratio"] = len(peak_complaints) / len(complaints_df) if len(complaints_df) > 0 else 0
            metrics["density"]["peak_hour_count"] = len(peak_complaints)
        
        return metrics
    
    def compute_permit_coverage(
        self,
        monitoring_df: pd.DataFrame,
        permits_df: pd.DataFrame,
        monitoring_time_col: str = "monitor_time",
        monitoring_lon_col: str = "longitude",
        monitoring_lat_col: str = "latitude",
        permit_start_col: str = "start_time",
        permit_end_col: str = "end_time",
        permit_lon_col: str = "longitude",
        permit_lat_col: str = "latitude",
        distance_threshold: float = 0.5
    ) -> Dict[str, Any]:
        """
        计算备案覆盖率
        
        Args:
            monitoring_df: 噪声监测数据
            permits_df: 施工备案数据
            其他参数: 列名配置
            
        Returns:
            备案覆盖率指标
        """
        if monitoring_df.empty or permits_df.empty:
            return {
                "total_noise_events": 0,
                "covered_events": 0,
                "coverage_ratio": 0,
                "uncovered_events": []
            }
        
        from src.data_cleaner.coordinate_processor import CoordinateProcessor
        
        coord_processor = CoordinateProcessor()
        
        monitoring_df = monitoring_df.copy()
        permits_df = permits_df.copy()
        
        monitoring_df[monitoring_time_col] = pd.to_datetime(monitoring_df[monitoring_time_col])
        permits_df[permit_start_col] = pd.to_datetime(permits_df[permit_start_col])
        permits_df[permit_end_col] = pd.to_datetime(permits_df[permit_end_col])
        
        high_noise_mask = monitoring_df.get("db_level", 60) > NOISE_THRESHOLDS.get("residential_night", 55)
        high_noise_events = monitoring_df[high_noise_mask].copy()
        
        total_events = len(high_noise_events)
        covered_count = 0
        uncovered_events = []
        
        for idx, event in high_noise_events.iterrows():
            event_time = event[monitoring_time_col]
            event_lon = event.get(monitoring_lon_col)
            event_lat = event.get(monitoring_lat_col)
            
            active_permits = permits_df[
                (permits_df[permit_start_col] <= event_time) & 
                (permits_df[permit_end_col] >= event_time)
            ]
            
            if active_permits.empty:
                uncovered_events.append({
                    "index": idx,
                    "time": event_time,
                    "db_level": event.get("db_level"),
                    "reason": "no_active_permits"
                })
                continue
            
            has_nearby_permit = False
            
            for _, permit in active_permits.iterrows():
                permit_lon = permit.get(permit_lon_col)
                permit_lat = permit.get(permit_lat_col)
                
                if event_lon is not None and event_lat is not None and permit_lon is not None and permit_lat is not None:
                    distance = coord_processor.haversine_distance(
                        event_lon, event_lat,
                        permit_lon, permit_lat
                    )
                    
                    if distance <= distance_threshold:
                        has_nearby_permit = True
                        break
            
            if has_nearby_permit:
                covered_count += 1
            else:
                uncovered_events.append({
                    "index": idx,
                    "time": event_time,
                    "db_level": event.get("db_level"),
                    "reason": "no_nearby_permit",
                    "active_permits_count": len(active_permits)
                })
        
        coverage_ratio = covered_count / total_events if total_events > 0 else 0
        
        return {
            "total_noise_events": total_events,
            "covered_events": covered_count,
            "uncovered_count": len(uncovered_events),
            "coverage_ratio": round(coverage_ratio, 4),
            "distance_threshold_km": distance_threshold,
            "uncovered_events": uncovered_events
        }
    
    def compute_hotspot_metrics(
        self,
        complaints_df: pd.DataFrame,
        monitoring_df: pd.DataFrame,
        grid_col: str = "grid_id",
        complaint_time_col: str = "complaint_time",
        monitor_time_col: str = "monitor_time",
        db_col: str = "db_level",
        lookback_hours: int = 24
    ) -> pd.DataFrame:
        """
        计算热区综合指标
        
        Args:
            complaints_df: 投诉数据
            monitoring_df: 监测数据
            grid_col: 网格列名
            其他参数: 列名配置
            lookback_hours: 回顾小时数
            
        Returns:
            热区指标 DataFrame
        """
        hotspot_data = []
        
        if not complaints_df.empty and grid_col in complaints_df.columns:
            complaints_df = complaints_df.copy()
            complaints_df[complaint_time_col] = pd.to_datetime(complaints_df[complaint_time_col])
            
            max_time = complaints_df[complaint_time_col].max()
            cutoff_time = max_time - timedelta(hours=lookback_hours)
            
            recent_complaints = complaints_df[complaints_df[complaint_time_col] >= cutoff_time]
            
            complaint_stats = recent_complaints.groupby(grid_col).agg({
                complaint_time_col: ["count", "max"]
            }).reset_index()
            complaint_stats.columns = [grid_col, "complaint_count", "last_complaint_time"]
        else:
            complaint_stats = pd.DataFrame(columns=[grid_col, "complaint_count", "last_complaint_time"])
        
        if not monitoring_df.empty and grid_col in monitoring_df.columns:
            monitoring_df = monitoring_df.copy()
            monitoring_df[monitor_time_col] = pd.to_datetime(monitoring_df[monitor_time_col])
            
            noise_stats = monitoring_df.groupby(grid_col).agg({
                db_col: ["mean", "max", "count"],
                monitor_time_col: "max"
            }).reset_index()
            noise_stats.columns = [
                grid_col, "avg_db", "max_db", "monitor_count", "last_monitor_time"
            ]
        else:
            noise_stats = pd.DataFrame(columns=[grid_col, "avg_db", "max_db", "monitor_count", "last_monitor_time"])
        
        if not complaint_stats.empty and not noise_stats.empty:
            combined = complaint_stats.merge(noise_stats, on=grid_col, how="outer")
        elif not complaint_stats.empty:
            combined = complaint_stats
        else:
            combined = noise_stats
        
        if not combined.empty:
            for _, row in combined.iterrows():
                grid_id = row[grid_col]
                
                complaint_score = row.get("complaint_count", 0) * 10
                
                db_score = 0
                max_db = row.get("max_db")
                if pd.notna(max_db):
                    if max_db > 75:
                        db_score = 30
                    elif max_db > 65:
                        db_score = 20
                    elif max_db > 55:
                        db_score = 10
                
                total_score = complaint_score + db_score
                
                hotspot_data.append({
                    "grid_id": grid_id,
                    "complaint_count": row.get("complaint_count", 0),
                    "avg_db": row.get("avg_db"),
                    "max_db": row.get("max_db"),
                    "monitor_count": row.get("monitor_count", 0),
                    "complaint_score": complaint_score,
                    "db_score": db_score,
                    "hotspot_score": total_score,
                    "last_complaint_time": row.get("last_complaint_time"),
                    "last_monitor_time": row.get("last_monitor_time")
                })
        
        result_df = pd.DataFrame(hotspot_data)
        if not result_df.empty:
            result_df = result_df.sort_values("hotspot_score", ascending=False).reset_index(drop=True)
            result_df["hotspot_rank"] = result_df["hotspot_score"].rank(ascending=False, method="min").astype(int)
        
        return result_df
    
    def get_aggregation_report(self) -> Dict[str, Any]:
        """获取聚合报告"""
        return self.aggregation_stats
