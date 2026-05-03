import json
import pandas as pd
from pathlib import Path
from typing import Optional, Dict, Any, List
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PermitsParser:
    """施工备案 JSON 解析器"""
    
    REQUIRED_FIELDS = {
        "permit_id": "备案编号",
        "project_name": "项目名称",
        "location": "施工地点",
        "longitude": "经度",
        "latitude": "纬度",
        "start_time": "开始时间",
        "end_time": "结束时间",
        "construction_type": "施工类型",
        "contractor": "施工单位",
        "permit_status": "备案状态"
    }
    
    FIELD_MAPPINGS = {
        "id": "permit_id",
        "备案号": "permit_id",
        "备案编号": "permit_id",
        "项目": "project_name",
        "项目名称": "project_name",
        "工程名称": "project_name",
        "地点": "location",
        "施工地点": "location",
        "地址": "location",
        "lon": "longitude",
        "经度": "longitude",
        "lat": "latitude",
        "纬度": "latitude",
        "开始": "start_time",
        "开始时间": "start_time",
        "开工时间": "start_time",
        "结束": "end_time",
        "结束时间": "end_time",
        "完工时间": "end_time",
        "类型": "construction_type",
        "施工类型": "construction_type",
        "工程类型": "construction_type",
        "单位": "contractor",
        "施工单位": "contractor",
        "承建单位": "contractor",
        "状态": "permit_status",
        "备案状态": "permit_status"
    }
    
    VALID_CONSTRUCTION_TYPES = [
        "道路施工",
        "房屋建筑",
        "装修改造",
        "市政工程",
        "园林绿化",
        "管线敷设",
        "拆迁工程",
        "其他"
    ]
    
    def __init__(self):
        self.raw_data: Optional[List[Dict]] = None
        self.parsed_data: Optional[pd.DataFrame] = None
        self.validation_errors: Dict[str, Any] = {
            "missing_fields": [],
            "invalid_records": [],
            "warnings": []
        }
    
    def parse(self, file_path: Path) -> pd.DataFrame:
        """
        解析施工备案 JSON 文件
        
        Args:
            file_path: JSON 文件路径
            
        Returns:
            解析后的 DataFrame
        """
        logger.info(f"开始解析施工备案文件: {file_path}")
        
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                self.raw_data = json.load(f)
            
            if isinstance(self.raw_data, dict):
                if "data" in self.raw_data:
                    self.raw_data = self.raw_data["data"]
                elif "records" in self.raw_data:
                    self.raw_data = self.raw_data["records"]
                else:
                    self.raw_data = [self.raw_data]
            
            logger.info(f"读取原始数据: {len(self.raw_data)} 条记录")
        except Exception as e:
            logger.error(f"读取文件失败: {e}")
            raise ValueError(f"无法读取施工备案文件: {e}")
        
        normalized_data = self._normalize_records()
        self.parsed_data = pd.DataFrame(normalized_data)
        
        self._validate_and_clean()
        
        return self.parsed_data
    
    def _normalize_records(self) -> List[Dict]:
        """标准化记录字段"""
        if not self.raw_data:
            return []
        
        normalized = []
        for record in self.raw_data:
            if not isinstance(record, dict):
                continue
            
            new_record = {}
            for key, value in record.items():
                key_stripped = str(key).strip()
                if key_stripped in self.FIELD_MAPPINGS:
                    mapped_key = self.FIELD_MAPPINGS[key_stripped]
                    new_record[mapped_key] = value
                elif key_stripped in self.REQUIRED_FIELDS:
                    new_record[key_stripped] = value
            
            normalized.append(new_record)
        
        return normalized
    
    def _validate_and_clean(self):
        """验证并清洗数据"""
        if self.parsed_data is None or self.parsed_data.empty:
            return
        
        df = self.parsed_data
        
        for col in ["start_time", "end_time"]:
            if col in df.columns:
                df[col] = pd.to_datetime(
                    df[col],
                    errors="coerce",
                    infer_datetime_format=True
                )
                invalid = df[col].isna().sum()
                if invalid > 0:
                    self.validation_errors["invalid_records"].append({
                        "field": col,
                        "count": invalid,
                        "message": f"{invalid} 条记录时间格式无效"
                    })
        
        for col in ["longitude", "latitude"]:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")
                invalid = df[col].isna().sum()
                if invalid > 0:
                    self.validation_errors["invalid_records"].append({
                        "field": col,
                        "count": invalid,
                        "message": f"{invalid} 条记录坐标无效"
                    })
        
        if "start_time" in df.columns and "end_time" in df.columns:
            invalid_periods = df[
                (df["start_time"].notna()) & 
                (df["end_time"].notna()) & 
                (df["start_time"] > df["end_time"])
            ].shape[0]
            if invalid_periods > 0:
                self.validation_errors["warnings"].append(
                    f"{invalid_periods} 条记录开始时间晚于结束时间"
                )
        
        if "construction_type" in df.columns:
            df["construction_type"] = df["construction_type"].astype(str).str.strip()
            unknown_types = df[
                ~df["construction_type"].isin(self.VALID_CONSTRUCTION_TYPES + ["nan"])
            ].shape[0]
            if unknown_types > 0:
                self.validation_errors["warnings"].append(
                    f"{unknown_types} 条记录施工类型不在预定义列表中"
                )
        
        self.parsed_data = df
        logger.info(f"数据验证清洗完成，共 {len(df)} 条有效记录")
    
    def get_active_permits(self, check_time: pd.Timestamp) -> pd.DataFrame:
        """
        获取指定时间点有效的备案
        
        Args:
            check_time: 检查时间点
            
        Returns:
            有效的备案 DataFrame
        """
        if self.parsed_data is None:
            return pd.DataFrame()
        
        df = self.parsed_data
        active = df[
            (df["start_time"] <= check_time) & 
            (df["end_time"] >= check_time)
        ]
        
        return active.copy()
    
    def get_validation_report(self) -> Dict[str, Any]:
        """获取验证报告"""
        return {
            "total_records": len(self.raw_data) if self.raw_data else 0,
            "valid_records": len(self.parsed_data) if self.parsed_data is not None else 0,
            "errors": self.validation_errors,
            "columns": list(self.parsed_data.columns) if self.parsed_data is not None else []
        }
