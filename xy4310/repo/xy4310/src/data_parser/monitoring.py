import pandas as pd
from pathlib import Path
from typing import Optional, Dict, Any, List
import logging
import numpy as np

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class MonitoringParser:
    """噪声监测分钟级记录解析器"""
    
    REQUIRED_COLUMNS = {
        "monitor_id": "监测点编号",
        "monitor_time": "监测时间",
        "longitude": "经度",
        "latitude": "纬度",
        "db_level": "分贝值",
        "db_peak": "峰值分贝",
        "db_leq": "等效连续声级",
        "status": "监测状态"
    }
    
    COLUMN_MAPPINGS = {
        "id": "monitor_id",
        "监测点": "monitor_id",
        "监测点编号": "monitor_id",
        "设备编号": "monitor_id",
        "时间": "monitor_time",
        "监测时间": "monitor_time",
        "记录时间": "monitor_time",
        "lon": "longitude",
        "经度": "longitude",
        "lat": "latitude",
        "纬度": "latitude",
        "db": "db_level",
        "分贝": "db_level",
        "分贝值": "db_level",
        "laeq": "db_level",
        "lmax": "db_peak",
        "峰值": "db_peak",
        "峰值分贝": "db_peak",
        "最大分贝": "db_peak",
        "leq": "db_leq",
        "等效声级": "db_leq",
        "等效连续声级": "db_leq",
        "状态": "status",
        "监测状态": "status",
        "设备状态": "status"
    }
    
    VALID_STATUSES = ["正常", "异常", "离线", "维护", "unknown"]
    
    def __init__(self):
        self.raw_data: Optional[pd.DataFrame] = None
        self.parsed_data: Optional[pd.DataFrame] = None
        self.validation_errors: Dict[str, Any] = {
            "missing_columns": [],
            "invalid_rows": [],
            "outliers": [],
            "warnings": []
        }
    
    def parse(self, file_path: Path) -> pd.DataFrame:
        """
        解析噪声监测文件
        
        Args:
            file_path: 文件路径（支持 CSV、Excel）
            
        Returns:
            解析后的 DataFrame
        """
        logger.info(f"开始解析噪声监测文件: {file_path}")
        
        suffix = file_path.suffix.lower()
        
        try:
            if suffix == ".csv":
                self.raw_data = pd.read_csv(file_path, encoding="utf-8-sig")
            elif suffix in [".xlsx", ".xls"]:
                self.raw_data = pd.read_excel(file_path)
            else:
                raise ValueError(f"不支持的文件格式: {suffix}")
            
            logger.info(f"读取原始数据: {len(self.raw_data)} 行")
        except Exception as e:
            logger.error(f"读取文件失败: {e}")
            raise ValueError(f"无法读取噪声监测文件: {e}")
        
        self._map_columns()
        self._validate_columns()
        self._parse_and_clean()
        
        return self.parsed_data
    
    def _map_columns(self):
        """映射列名到标准格式"""
        if self.raw_data is None:
            return
        
        new_columns = {}
        for col in self.raw_data.columns:
            col_stripped = col.strip()
            if col_stripped in self.COLUMN_MAPPINGS:
                new_columns[col] = self.COLUMN_MAPPINGS[col_stripped]
            elif col_stripped in self.REQUIRED_COLUMNS:
                new_columns[col] = col_stripped
        
        if new_columns:
            self.raw_data = self.raw_data.rename(columns=new_columns)
            logger.info(f"列名映射完成，共映射 {len(new_columns)} 列")
    
    def _validate_columns(self):
        """验证必需列是否存在"""
        if self.raw_data is None:
            return
        
        existing_columns = set(self.raw_data.columns)
        required_set = set(self.REQUIRED_COLUMNS.keys())
        
        missing = required_set - existing_columns
        
        critical_missing = {"monitor_id", "monitor_time", "db_level"} - existing_columns
        if critical_missing:
            self.validation_errors["missing_columns"].extend(list(critical_missing))
            logger.warning(f"缺少关键列: {critical_missing}")
        
        if missing - critical_missing:
            self.validation_errors["warnings"].append(
                f"缺少推荐列: {missing - critical_missing}"
            )
    
    def _parse_and_clean(self):
        """解析数据类型并清洗"""
        if self.raw_data is None:
            return
        
        df = self.raw_data.copy()
        
        if "monitor_time" in df.columns:
            df["monitor_time"] = pd.to_datetime(
                df["monitor_time"],
                errors="coerce",
                infer_datetime_format=True
            )
            invalid_times = df["monitor_time"].isna().sum()
            if invalid_times > 0:
                self.validation_errors["invalid_rows"].append({
                    "column": "monitor_time",
                    "count": invalid_times,
                    "message": f"{invalid_times} 行时间格式无效"
                })
        
        for col in ["longitude", "latitude"]:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")
        
        for col in ["db_level", "db_peak", "db_leq"]:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")
                
                outliers = df[
                    (df[col] < 20) | (df[col] > 140)
                ].shape[0]
                if outliers > 0:
                    self.validation_errors["outliers"].append({
                        "column": col,
                        "count": outliers,
                        "message": f"{outliers} 个{col}值超出合理范围(20-140dB)"
                    })
                    df.loc[(df[col] < 20) | (df[col] > 140), col] = np.nan
        
        if "status" in df.columns:
            df["status"] = df["status"].astype(str).str.strip()
            df.loc[~df["status"].isin(self.VALID_STATUSES), "status"] = "unknown"
        
        df = df.sort_values(["monitor_id", "monitor_time"]).reset_index(drop=True)
        
        self.parsed_data = df
        logger.info(f"数据清洗完成，共 {len(df)} 行有效记录")
    
    def get_time_range(self) -> tuple:
        """获取数据时间范围"""
        if self.parsed_data is None or self.parsed_data.empty:
            return None, None
        
        return (
            self.parsed_data["monitor_time"].min(),
            self.parsed_data["monitor_time"].max()
        )
    
    def get_monitor_stats(self) -> pd.DataFrame:
        """获取各监测点统计信息"""
        if self.parsed_data is None or self.parsed_data.empty:
            return pd.DataFrame()
        
        stats = self.parsed_data.groupby("monitor_id").agg({
            "monitor_time": ["min", "max", "count"],
            "db_level": ["mean", "max", "min", "std"],
            "db_peak": ["max", "mean"],
            "longitude": "first",
            "latitude": "first"
        }).round(2)
        
        stats.columns = ["_".join(col).strip() for col in stats.columns.values]
        stats = stats.rename(columns={
            "monitor_time_min": "first_record",
            "monitor_time_max": "last_record",
            "monitor_time_count": "record_count",
            "db_level_mean": "avg_db",
            "db_level_max": "max_db",
            "db_level_min": "min_db",
            "db_level_std": "db_std",
            "db_peak_max": "max_peak",
            "db_peak_mean": "avg_peak",
            "longitude_first": "longitude",
            "latitude_first": "latitude"
        })
        
        return stats
    
    def get_validation_report(self) -> Dict[str, Any]:
        """获取验证报告"""
        return {
            "total_rows": len(self.raw_data) if self.raw_data is not None else 0,
            "valid_rows": len(self.parsed_data) if self.parsed_data is not None else 0,
            "errors": self.validation_errors,
            "columns": list(self.parsed_data.columns) if self.parsed_data is not None else [],
            "time_range": self.get_time_range(),
            "monitor_count": self.parsed_data["monitor_id"].nunique() if self.parsed_data is not None else 0
        }
