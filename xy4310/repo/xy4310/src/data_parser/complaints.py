import pandas as pd
from pathlib import Path
from typing import Optional, Dict, Any
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ComplaintsParser:
    """居民投诉 CSV 解析器"""
    
    REQUIRED_COLUMNS = {
        "complaint_id": "投诉单号",
        "complaint_time": "投诉时间",
        "location": "投诉地点",
        "longitude": "经度",
        "latitude": "纬度",
        "description": "投诉描述",
        "complaint_type": "投诉类型",
        "severity": "严重程度"
    }
    
    COLUMN_MAPPINGS = {
        "id": "complaint_id",
        "单号": "complaint_id",
        "投诉单号": "complaint_id",
        "时间": "complaint_time",
        "投诉时间": "complaint_time",
        "日期": "complaint_time",
        "地点": "location",
        "投诉地点": "location",
        "地址": "location",
        "lon": "longitude",
        "经度": "longitude",
        "lat": "latitude",
        "纬度": "latitude",
        "描述": "description",
        "投诉描述": "description",
        "内容": "description",
        "类型": "complaint_type",
        "投诉类型": "complaint_type",
        "级别": "severity",
        "严重程度": "severity",
        "等级": "severity"
    }
    
    def __init__(self):
        self.raw_data: Optional[pd.DataFrame] = None
        self.parsed_data: Optional[pd.DataFrame] = None
        self.validation_errors: Dict[str, Any] = {
            "missing_columns": [],
            "invalid_rows": [],
            "warnings": []
        }
    
    def parse(self, file_path: Path) -> pd.DataFrame:
        """
        解析投诉 CSV 文件
        
        Args:
            file_path: CSV 文件路径
            
        Returns:
            解析后的 DataFrame
        """
        logger.info(f"开始解析投诉文件: {file_path}")
        
        try:
            self.raw_data = pd.read_csv(file_path, encoding="utf-8-sig")
            logger.info(f"读取原始数据: {len(self.raw_data)} 行")
        except Exception as e:
            logger.error(f"读取文件失败: {e}")
            raise ValueError(f"无法读取投诉文件: {e}")
        
        self._map_columns()
        self._validate_columns()
        self._parse_data_types()
        
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
        if missing:
            self.validation_errors["missing_columns"] = list(missing)
            logger.warning(f"缺少必需列: {missing}")
    
    def _parse_data_types(self):
        """解析数据类型"""
        if self.raw_data is None:
            return
        
        df = self.raw_data.copy()
        
        if "complaint_time" in df.columns:
            df["complaint_time"] = pd.to_datetime(
                df["complaint_time"],
                errors="coerce",
                infer_datetime_format=True
            )
            invalid_times = df["complaint_time"].isna().sum()
            if invalid_times > 0:
                self.validation_errors["invalid_rows"].append({
                    "column": "complaint_time",
                    "count": invalid_times,
                    "message": f"{invalid_times} 行时间格式无效"
                })
                logger.warning(f"发现 {invalid_times} 行无效时间")
        
        for col in ["longitude", "latitude"]:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")
                invalid_coords = df[col].isna().sum()
                if invalid_coords > 0:
                    self.validation_errors["invalid_rows"].append({
                        "column": col,
                        "count": invalid_coords,
                        "message": f"{invalid_coords} 行{col}无效"
                    })
        
        if "severity" in df.columns:
            df["severity"] = df["severity"].astype(str).str.strip()
        
        self.parsed_data = df
        logger.info(f"数据类型解析完成，共 {len(df)} 行")
    
    def get_validation_report(self) -> Dict[str, Any]:
        """获取验证报告"""
        return {
            "total_rows": len(self.raw_data) if self.raw_data is not None else 0,
            "valid_rows": len(self.parsed_data) if self.parsed_data is not None else 0,
            "errors": self.validation_errors,
            "columns": list(self.parsed_data.columns) if self.parsed_data is not None else []
        }
