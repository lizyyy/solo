"""
数据解析模块
- 导入多趟数据（振动CSV、转速工况表、人工检修结论）
- 校验采样率、缺测、转速区间
"""

import os
import glob
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime

import numpy as np
import pandas as pd


@dataclass
class TripData:
    """单趟运行数据"""
    trip_id: str
    vibration_data: pd.DataFrame
    speed_profile: pd.DataFrame
    inspection_result: Optional[str] = None
    sampling_rate: float = 0.0
    validation_status: Dict = field(default_factory=dict)


@dataclass
class ValidationResult:
    """校验结果"""
    is_valid: bool
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


class DataParser:
    """数据解析器"""
    
    def __init__(self, 
                 expected_sampling_rate: float = 25600.0,
                 min_sampling_rate: float = 1000.0,
                 max_missing_ratio: float = 0.05,
                 speed_range: Tuple[float, float] = (0.0, 200.0)):
        """
        初始化数据解析器
        
        参数:
            expected_sampling_rate: 期望采样率 (Hz)
            min_sampling_rate: 最小允许采样率 (Hz)
            max_missing_ratio: 最大允许缺测比例
            speed_range: 有效转速区间 (km/h)
        """
        self.expected_sampling_rate = expected_sampling_rate
        self.min_sampling_rate = min_sampling_rate
        self.max_missing_ratio = max_missing_ratio
        self.speed_range = speed_range
        self.trips: Dict[str, TripData] = {}
        
    def parse_directory(self, data_dir: str) -> Dict[str, TripData]:
        """
        解析目录中的所有数据文件，自动匹配多趟数据
        
        参数:
            data_dir: 数据目录路径
            
        返回:
            所有趟次数据的字典
        """
        vibration_files = glob.glob(os.path.join(data_dir, "*vibration*.csv"))
        speed_files = glob.glob(os.path.join(data_dir, "*speed*.csv"))
        inspection_files = glob.glob(os.path.join(data_dir, "*inspection*.csv"))
        
        print(f"找到 {len(vibration_files)} 个振动文件, {len(speed_files)} 个转速文件")
        
        trip_groups = self._group_files_by_trip(vibration_files, speed_files, inspection_files)
        
        for trip_id, files in trip_groups.items():
            trip_data = self._parse_single_trip(trip_id, files)
            if trip_data:
                self.trips[trip_id] = trip_data
                
        return self.trips
    
    def _group_files_by_trip(self, 
                              vibration_files: List[str],
                              speed_files: List[str],
                              inspection_files: List[str]) -> Dict[str, Dict]:
        """
        按趟次分组文件，基于文件名中的共同标识
        """
        trip_groups = {}
        
        for vib_file in vibration_files:
            filename = os.path.basename(vib_file)
            trip_id = self._extract_trip_id(filename)
            
            if trip_id not in trip_groups:
                trip_groups[trip_id] = {
                    "vibration": [],
                    "speed": [],
                    "inspection": []
                }
            trip_groups[trip_id]["vibration"].append(vib_file)
        
        for speed_file in speed_files:
            trip_id = self._extract_trip_id(os.path.basename(speed_file))
            if trip_id in trip_groups:
                trip_groups[trip_id]["speed"].append(speed_file)
            else:
                for key in trip_groups:
                    if key in os.path.basename(speed_file):
                        trip_groups[key]["speed"].append(speed_file)
                        break
        
        for insp_file in inspection_files:
            trip_id = self._extract_trip_id(os.path.basename(insp_file))
            if trip_id in trip_groups:
                trip_groups[trip_id]["inspection"].append(insp_file)
            else:
                for key in trip_groups:
                    if key in os.path.basename(insp_file):
                        trip_groups[key]["inspection"].append(insp_file)
                        break
        
        return trip_groups
    
    def _extract_trip_id(self, filename: str) -> str:
        """从文件名提取趟次标识"""
        import re
        patterns = [
            r'(trip_\d+)',
            r'(run_\d+)',
            r'(\d{8}_\d{6})',
        ]
        for pattern in patterns:
            match = re.search(pattern, filename, re.IGNORECASE)
            if match:
                return match.group(1).lower()
        
        base = os.path.splitext(filename)[0]
        for suffix in ['_vibration', '_speed', '_inspection', '-vibration', '-speed', '-inspection']:
            if suffix in base.lower():
                return base.lower().replace(suffix, '')
        
        return base.lower()
    
    def _parse_single_trip(self, trip_id: str, files: Dict) -> Optional[TripData]:
        """
        解析单趟数据
        """
        if not files["vibration"]:
            print(f"警告: 趟次 {trip_id} 没有振动数据")
            return None
        
        vibration_data = self._parse_vibration_file(files["vibration"][0])
        if vibration_data is None:
            return None
        
        speed_profile = pd.DataFrame()
        if files["speed"]:
            speed_profile = self._parse_speed_file(files["speed"][0])
        
        inspection_result = None
        if files["inspection"]:
            inspection_result = self._parse_inspection_file(files["inspection"][0])
        
        sampling_rate = self._estimate_sampling_rate(vibration_data)
        
        trip_data = TripData(
            trip_id=trip_id,
            vibration_data=vibration_data,
            speed_profile=speed_profile,
            inspection_result=inspection_result,
            sampling_rate=sampling_rate
        )
        
        trip_data.validation_status = self._validate_trip(trip_data)
        
        return trip_data
    
    def _parse_vibration_file(self, filepath: str) -> Optional[pd.DataFrame]:
        """
        解析振动CSV文件
        """
        try:
            df = pd.read_csv(filepath)
            
            if "timestamp" in df.columns:
                pass
            elif df.shape[1] >= 1:
                df["timestamp"] = np.arange(len(df))
            
            vibration_cols = [col for col in df.columns 
                             if any(v in col.lower() for v in ["vibration", "accel", "acc", "x", "y", "z", "径向", "轴向"])]
            
            if not vibration_cols:
                vibration_cols = [df.columns[1]] if len(df.columns) > 1 else [df.columns[0]]
            
            result_df = df[["timestamp"] + vibration_cols].copy()
            result_df.columns = ["timestamp"] + [f"vibration_{i}" for i in range(len(vibration_cols))]
            
            return result_df
            
        except Exception as e:
            print(f"解析振动文件 {filepath} 失败: {e}")
            return None
    
    def _parse_speed_file(self, filepath: str) -> pd.DataFrame:
        """
        解析转速工况表
        """
        try:
            df = pd.read_csv(filepath)
            
            speed_cols = [col for col in df.columns 
                         if any(s in col.lower() for s in ["speed", "rpm", "转速", "速度"])]
            time_cols = [col for col in df.columns 
                        if any(t in col.lower() for t in ["time", "timestamp", "时间"])]
            
            if not time_cols:
                time_cols = [df.columns[0]]
            if not speed_cols:
                speed_cols = [df.columns[1]] if len(df.columns) > 1 else []
            
            result_df = pd.DataFrame()
            result_df["timestamp"] = df[time_cols[0]]
            if speed_cols:
                result_df["speed"] = df[speed_cols[0]]
            else:
                result_df["speed"] = 60.0
            
            return result_df
            
        except Exception as e:
            print(f"解析转速文件 {filepath} 失败: {e}")
            return pd.DataFrame()
    
    def _parse_inspection_file(self, filepath: str) -> Optional[str]:
        """
        解析人工检修结论
        """
        try:
            df = pd.read_csv(filepath)
            
            result_cols = [col for col in df.columns 
                          if any(r in col.lower() for r in ["result", "conclusion", "status", "结论", "结果", "状态"])]
            
            if result_cols:
                return str(df[result_cols[0]].iloc[0]) if len(df) > 0 else None
            
            return str(df.iloc[0, -1]) if len(df) > 0 and len(df.columns) > 0 else None
            
        except Exception as e:
            print(f"解析检修文件 {filepath} 失败: {e}")
            return None
    
    def _estimate_sampling_rate(self, df: pd.DataFrame) -> float:
        """
        从数据估计采样率
        """
        if df is None or len(df) < 2:
            return 0.0
        
        timestamp = df["timestamp"].values
        
        if np.issubdtype(timestamp.dtype, np.datetime64):
            intervals = np.diff(timestamp).astype(float) / 1e9
        else:
            intervals = np.diff(timestamp)
        
        if len(intervals) == 0:
            return 0.0
        
        median_interval = np.median(intervals)
        if median_interval <= 0:
            return 0.0
        
        return 1.0 / median_interval
    
    def _validate_trip(self, trip_data: TripData) -> Dict:
        """
        校验单趟数据
        """
        errors = []
        warnings = []
        
        if trip_data.sampling_rate < self.min_sampling_rate:
            errors.append(f"采样率 {trip_data.sampling_rate:.2f} Hz 低于最小值 {self.min_sampling_rate} Hz")
        
        if abs(trip_data.sampling_rate - self.expected_sampling_rate) / self.expected_sampling_rate > 0.1:
            warnings.append(f"采样率 {trip_data.sampling_rate:.2f} Hz 与期望值 {self.expected_sampling_rate} Hz 偏差较大")
        
        if trip_data.vibration_data is not None:
            missing_count = trip_data.vibration_data.isnull().sum().sum()
            total_count = trip_data.vibration_data.size
            missing_ratio = missing_count / total_count if total_count > 0 else 0
            
            if missing_ratio > self.max_missing_ratio:
                errors.append(f"缺测比例 {missing_ratio:.2%} 超过允许值 {self.max_missing_ratio:.2%}")
            elif missing_ratio > 0:
                warnings.append(f"存在缺测数据，比例: {missing_ratio:.2%}")
        
        if not trip_data.speed_profile.empty and "speed" in trip_data.speed_profile.columns:
            speed_data = trip_data.speed_profile["speed"].dropna()
            if len(speed_data) > 0:
                min_speed = speed_data.min()
                max_speed = speed_data.max()
                
                if min_speed < self.speed_range[0] or max_speed > self.speed_range[1]:
                    warnings.append(f"转速区间 [{min_speed}, {max_speed}] 超出预期范围 {self.speed_range}")
                
                speed_std = speed_data.std()
                speed_mean = speed_data.mean()
                if speed_std > 0 and speed_std / speed_mean > 0.3:
                    warnings.append("转速波动较大，可能存在工况混杂")
        
        return {
            "is_valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "sampling_rate": trip_data.sampling_rate,
            "missing_ratio": trip_data.vibration_data.isnull().sum().sum() / 
                             (trip_data.vibration_data.size if trip_data.vibration_data is not None else 1)
        }
    
    def get_valid_trips(self) -> Dict[str, TripData]:
        """
        获取所有有效趟次数据
        """
        return {
            trip_id: trip_data
            for trip_id, trip_data in self.trips.items()
            if trip_data.validation_status.get("is_valid", False)
        }
    
    def get_trip_summary(self) -> pd.DataFrame:
        """
        获取所有趟次的摘要信息
        """
        summaries = []
        for trip_id, trip_data in self.trips.items():
            summary = {
                "trip_id": trip_id,
                "sampling_rate": trip_data.sampling_rate,
                "vibration_samples": len(trip_data.vibration_data) if trip_data.vibration_data is not None else 0,
                "has_speed_data": not trip_data.speed_profile.empty,
                "has_inspection": trip_data.inspection_result is not None,
                "is_valid": trip_data.validation_status.get("is_valid", False),
                "error_count": len(trip_data.validation_status.get("errors", [])),
                "warning_count": len(trip_data.validation_status.get("warnings", []))
            }
            summaries.append(summary)
        
        return pd.DataFrame(summaries)
