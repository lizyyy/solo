import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, field
import json
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class ValidationError:
    row_index: int
    column: str
    error_type: str
    message: str
    value: Any = None


@dataclass
class ValidationResult:
    valid_rows: pd.DataFrame
    invalid_rows: pd.DataFrame
    errors: List[ValidationError] = field(default_factory=list)
    warnings: List[dict] = field(default_factory=list)
    
    @property
    def has_errors(self) -> bool:
        return len(self.errors) > 0
    
    @property
    def error_summary(self) -> Dict[str, int]:
        summary = {}
        for error in self.errors:
            error_type = error.error_type
            summary[error_type] = summary.get(error_type, 0) + 1
        return summary


class DataImporter:
    SENSOR_COLUMNS = {
        "required": ["井盖编号", "经度", "纬度", "记录时间", "异响次数", "振动强度", "传感器状态"],
        "optional": ["街区", "安装日期", "最后校准", "备注"]
    }
    
    MANUAL_COLUMNS = {
        "required": ["井盖编号", "经度", "纬度", "巡检时间", "异响情况", "积水深度", "巡检员", "状态"],
        "optional": ["街区", "井盖类型", "损坏程度", "照片编号", "备注"]
    }
    
    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {}
        self.coord_bounds = self.config.get("COORDINATE_BOUNDS", {
            "min_lat": 30.0, "max_lat": 32.0,
            "min_lon": 118.0, "max_lon": 120.0
        })
        self.timezone = self.config.get("TIMEZONE", "Asia/Shanghai")
    
    def import_sensor_csv(self, file_path: Path) -> ValidationResult:
        logger.info(f"导入传感器数据: {file_path}")
        errors: List[ValidationError] = []
        warnings: List[dict] = []
        
        try:
            df = pd.read_csv(file_path, encoding='utf-8')
        except UnicodeDecodeError:
            df = pd.read_csv(file_path, encoding='gbk')
        except Exception as e:
            raise ValueError(f"无法读取文件: {e}")
        
        missing_cols = [col for col in self.SENSOR_COLUMNS["required"] if col not in df.columns]
        if missing_cols:
            raise ValueError(f"缺少必要列: {', '.join(missing_cols)}")
        
        df_clean = df.copy()
        invalid_indices = set()
        
        for idx, row in df_clean.iterrows():
            row_errors = self._validate_sensor_row(row, idx)
            if row_errors:
                errors.extend(row_errors)
                invalid_indices.add(idx)
        
        duplicate_errors, dup_indices = self._detect_duplicates(df_clean, "井盖编号")
        errors.extend(duplicate_errors)
        invalid_indices.update(dup_indices)
        
        valid_df = df_clean.drop(index=list(invalid_indices)).reset_index(drop=True)
        invalid_df = df_clean.loc[list(invalid_indices)].reset_index(drop=True)
        
        valid_df = self._normalize_sensor_data(valid_df)
        
        return ValidationResult(
            valid_rows=valid_df,
            invalid_rows=invalid_df,
            errors=errors,
            warnings=warnings
        )
    
    def import_manual_csv(self, file_path: Path) -> ValidationResult:
        logger.info(f"导入人工巡检数据: {file_path}")
        errors: List[ValidationError] = []
        warnings: List[dict] = []
        
        try:
            df = pd.read_csv(file_path, encoding='utf-8')
        except UnicodeDecodeError:
            df = pd.read_csv(file_path, encoding='gbk')
        except Exception as e:
            raise ValueError(f"无法读取文件: {e}")
        
        missing_cols = [col for col in self.MANUAL_COLUMNS["required"] if col not in df.columns]
        if missing_cols:
            raise ValueError(f"缺少必要列: {', '.join(missing_cols)}")
        
        df_clean = df.copy()
        invalid_indices = set()
        
        for idx, row in df_clean.iterrows():
            row_errors = self._validate_manual_row(row, idx)
            if row_errors:
                errors.extend(row_errors)
                invalid_indices.add(idx)
        
        duplicate_errors, dup_indices = self._detect_duplicates(df_clean, "井盖编号", "巡检时间")
        errors.extend(duplicate_errors)
        invalid_indices.update(dup_indices)
        
        valid_df = df_clean.drop(index=list(invalid_indices)).reset_index(drop=True)
        invalid_df = df_clean.loc[list(invalid_indices)].reset_index(drop=True)
        
        valid_df = self._normalize_manual_data(valid_df)
        
        return ValidationResult(
            valid_rows=valid_df,
            invalid_rows=invalid_df,
            errors=errors,
            warnings=warnings
        )
    
    def import_water_geojson(self, file_path: Path) -> ValidationResult:
        logger.info(f"导入积水点位数据: {file_path}")
        errors: List[ValidationError] = []
        warnings: List[dict] = []
        
        with open(file_path, 'r', encoding='utf-8') as f:
            geojson_data = json.load(f)
        
        features = geojson_data.get("features", [])
        if not features:
            raise ValueError("GeoJSON 文件不包含任何要素")
        
        records = []
        for idx, feature in enumerate(features):
            try:
                geometry = feature.get("geometry", {})
                properties = feature.get("properties", {})
                
                if geometry.get("type") == "Point":
                    coords = geometry.get("coordinates", [])
                    if len(coords) >= 2:
                        record = {
                            "经度": coords[0],
                            "纬度": coords[1],
                            "积水深度": properties.get("积水深度", properties.get("depth", 0)),
                            "积水半径": properties.get("积水半径", properties.get("radius", 10)),
                            "发生时间": properties.get("发生时间", properties.get("time", datetime.now().isoformat())),
                            "严重程度": properties.get("严重程度", properties.get("severity", "中等")),
                            "街区": properties.get("街区", properties.get("block", "未知")),
                            "source_index": idx
                        }
                        records.append(record)
            except Exception as e:
                errors.append(ValidationError(
                    row_index=idx,
                    column="geometry",
                    error_type="invalid_geometry",
                    message=f"无法解析几何数据: {e}",
                    value=str(geometry)
                ))
        
        df = pd.DataFrame(records)
        invalid_indices = set()
        
        for idx, row in df.iterrows():
            row_errors = self._validate_water_row(row, idx)
            if row_errors:
                errors.extend(row_errors)
                invalid_indices.add(idx)
        
        valid_df = df.drop(index=list(invalid_indices)).reset_index(drop=True)
        invalid_df = df.loc[list(invalid_indices)].reset_index(drop=True)
        
        valid_df = self._normalize_water_data(valid_df)
        
        return ValidationResult(
            valid_rows=valid_df,
            invalid_rows=invalid_df,
            errors=errors,
            warnings=warnings
        )
    
    def _validate_sensor_row(self, row: pd.Series, idx: int) -> List[ValidationError]:
        errors = []
        
        manhole_id = str(row.get("井盖编号", "")).strip()
        if not manhole_id or manhole_id == "nan":
            errors.append(ValidationError(
                row_index=idx,
                column="井盖编号",
                error_type="missing_value",
                message="井盖编号不能为空",
                value=manhole_id
            ))
        
        try:
            lon = float(row.get("经度", np.nan))
            lat = float(row.get("纬度", np.nan))
            
            if np.isnan(lon) or np.isnan(lat):
                errors.append(ValidationError(
                    row_index=idx,
                    column="经纬度",
                    error_type="missing_coordinate",
                    message="经纬度不能为空",
                    value=f"({row.get('经度')}, {row.get('纬度')})"
                ))
            else:
                if not (self.coord_bounds["min_lon"] <= lon <= self.coord_bounds["max_lon"]):
                    errors.append(ValidationError(
                        row_index=idx,
                        column="经度",
                        error_type="out_of_bounds",
                        message=f"经度超出有效范围 [{self.coord_bounds['min_lon']}, {self.coord_bounds['max_lon']}]",
                        value=lon
                    ))
                if not (self.coord_bounds["min_lat"] <= lat <= self.coord_bounds["max_lat"]):
                    errors.append(ValidationError(
                        row_index=idx,
                        column="纬度",
                        error_type="out_of_bounds",
                        message=f"纬度超出有效范围 [{self.coord_bounds['min_lat']}, {self.coord_bounds['max_lat']}]",
                        value=lat
                    ))
        except (ValueError, TypeError):
            errors.append(ValidationError(
                row_index=idx,
                column="经纬度",
                error_type="invalid_format",
                message="经纬度格式无效",
                value=f"({row.get('经度')}, {row.get('纬度')})"
            ))
        
        time_str = str(row.get("记录时间", ""))
        if time_str:
            try:
                pd.to_datetime(time_str)
            except (ValueError, TypeError):
                errors.append(ValidationError(
                    row_index=idx,
                    column="记录时间",
                    error_type="invalid_time_format",
                    message="时间格式无效",
                    value=time_str
                ))
        
        try:
            sound_count = int(row.get("异响次数", 0))
            if sound_count < 0:
                errors.append(ValidationError(
                    row_index=idx,
                    column="异响次数",
                    error_type="negative_value",
                    message="异响次数不能为负数",
                    value=sound_count
                ))
        except (ValueError, TypeError):
            errors.append(ValidationError(
                row_index=idx,
                column="异响次数",
                error_type="invalid_format",
                message="异响次数格式无效",
                value=row.get("异响次数")
            ))
        
        return errors
    
    def _validate_manual_row(self, row: pd.Series, idx: int) -> List[ValidationError]:
        errors = []
        
        manhole_id = str(row.get("井盖编号", "")).strip()
        if not manhole_id or manhole_id == "nan":
            errors.append(ValidationError(
                row_index=idx,
                column="井盖编号",
                error_type="missing_value",
                message="井盖编号不能为空",
                value=manhole_id
            ))
        
        try:
            lon = float(row.get("经度", np.nan))
            lat = float(row.get("纬度", np.nan))
            
            if np.isnan(lon) or np.isnan(lat):
                errors.append(ValidationError(
                    row_index=idx,
                    column="经纬度",
                    error_type="missing_coordinate",
                    message="经纬度不能为空",
                    value=f"({row.get('经度')}, {row.get('纬度')})"
                ))
            else:
                if not (self.coord_bounds["min_lon"] <= lon <= self.coord_bounds["max_lon"]):
                    errors.append(ValidationError(
                        row_index=idx,
                        column="经度",
                        error_type="out_of_bounds",
                        message=f"经度超出有效范围",
                        value=lon
                    ))
                if not (self.coord_bounds["min_lat"] <= lat <= self.coord_bounds["max_lat"]):
                    errors.append(ValidationError(
                        row_index=idx,
                        column="纬度",
                        error_type="out_of_bounds",
                        message=f"纬度超出有效范围",
                        value=lat
                    ))
        except (ValueError, TypeError):
            errors.append(ValidationError(
                row_index=idx,
                column="经纬度",
                error_type="invalid_format",
                message="经纬度格式无效",
                value=f"({row.get('经度')}, {row.get('纬度')})"
            ))
        
        time_str = str(row.get("巡检时间", ""))
        if time_str and time_str != "nan":
            try:
                pd.to_datetime(time_str)
            except (ValueError, TypeError):
                errors.append(ValidationError(
                    row_index=idx,
                    column="巡检时间",
                    error_type="invalid_time_format",
                    message="时间格式无效",
                    value=time_str
                ))
        
        try:
            water_depth = float(row.get("积水深度", 0))
            if water_depth < 0:
                errors.append(ValidationError(
                    row_index=idx,
                    column="积水深度",
                    error_type="negative_value",
                    message="积水深度不能为负数",
                    value=water_depth
                ))
        except (ValueError, TypeError):
            pass
        
        return errors
    
    def _validate_water_row(self, row: pd.Series, idx: int) -> List[ValidationError]:
        errors = []
        
        try:
            lon = float(row.get("经度", np.nan))
            lat = float(row.get("纬度", np.nan))
            
            if np.isnan(lon) or np.isnan(lat):
                errors.append(ValidationError(
                    row_index=idx,
                    column="经纬度",
                    error_type="missing_coordinate",
                    message="经纬度不能为空",
                    value=f"({row.get('经度')}, {row.get('纬度')})"
                ))
        except (ValueError, TypeError):
            errors.append(ValidationError(
                row_index=idx,
                column="经纬度",
                error_type="invalid_format",
                message="经纬度格式无效",
                value=f"({row.get('经度')}, {row.get('纬度')})"
            ))
        
        return errors
    
    def _detect_duplicates(self, df: pd.DataFrame, *key_columns) -> Tuple[List[ValidationError], set]:
        errors = []
        dup_indices = set()
        
        if df.empty:
            return errors, dup_indices
        
        key_cols = [col for col in key_columns if col in df.columns]
        if not key_cols:
            return errors, dup_indices
        
        seen = {}
        for idx, row in df.iterrows():
            key = tuple(row[col] for col in key_cols)
            if pd.notna(key).all():
                if key in seen:
                    errors.append(ValidationError(
                        row_index=idx,
                        column=key_columns[0],
                        error_type="duplicate_record",
                        message=f"发现重复记录: {key}",
                        value=str(key)
                    ))
                    dup_indices.add(idx)
                    dup_indices.add(seen[key])
                seen[key] = idx
        
        return errors, dup_indices
    
    def _normalize_sensor_data(self, df: pd.DataFrame) -> pd.DataFrame:
        if df.empty:
            return df
        
        df = df.copy()
        df["井盖编号"] = df["井盖编号"].astype(str).str.strip()
        df["记录时间"] = pd.to_datetime(df["记录时间"], errors='coerce')
        df["经度"] = pd.to_numeric(df["经度"], errors='coerce')
        df["纬度"] = pd.to_numeric(df["纬度"], errors='coerce')
        df["异响次数"] = pd.to_numeric(df["异响次数"], errors='coerce').fillna(0).astype(int)
        df["振动强度"] = pd.to_numeric(df["振动强度"], errors='coerce').fillna(0)
        
        df["normalized_id"] = df["井盖编号"].apply(self._normalize_manhole_id)
        
        if "街区" not in df.columns or df["街区"].isna().all():
            df["街区"] = df.apply(self._infer_block, axis=1)
        
        return df
    
    def _normalize_manual_data(self, df: pd.DataFrame) -> pd.DataFrame:
        if df.empty:
            return df
        
        df = df.copy()
        df["井盖编号"] = df["井盖编号"].astype(str).str.strip()
        df["巡检时间"] = pd.to_datetime(df["巡检时间"], errors='coerce')
        df["经度"] = pd.to_numeric(df["经度"], errors='coerce')
        df["纬度"] = pd.to_numeric(df["纬度"], errors='coerce')
        df["积水深度"] = pd.to_numeric(df["积水深度"], errors='coerce').fillna(0)
        
        df["normalized_id"] = df["井盖编号"].apply(self._normalize_manhole_id)
        
        df["异响情况"] = df["异响情况"].astype(str).str.strip()
        df["has_abnormal_sound"] = df["异响情况"].apply(
            lambda x: any(keyword in x for keyword in ["有", "存在", "是", "异常", "yes", "有异响"])
        )
        
        if "街区" not in df.columns or df["街区"].isna().all():
            df["街区"] = df.apply(self._infer_block, axis=1)
        
        return df
    
    def _normalize_water_data(self, df: pd.DataFrame) -> pd.DataFrame:
        if df.empty:
            return df
        
        df = df.copy()
        df["经度"] = pd.to_numeric(df["经度"], errors='coerce')
        df["纬度"] = pd.to_numeric(df["纬度"], errors='coerce')
        df["积水深度"] = pd.to_numeric(df["积水深度"], errors='coerce').fillna(0)
        df["积水半径"] = pd.to_numeric(df["积水半径"], errors='coerce').fillna(10)
        df["发生时间"] = pd.to_datetime(df["发生时间"], errors='coerce')
        
        return df
    
    def _normalize_manhole_id(self, manhole_id: str) -> str:
        if pd.isna(manhole_id):
            return ""
        
        manhole_id = str(manhole_id).strip().upper()
        
        prefixes = ["MH-", "S-", "SS-", "井盖-", "井盖编号-", "JH-", "JG-"]
        for prefix in prefixes:
            if manhole_id.startswith(prefix.upper()):
                manhole_id = manhole_id[len(prefix):]
                break
        
        manhole_id = ''.join(c for c in manhole_id if c.isalnum())
        
        return manhole_id
    
    def _infer_block(self, row: pd.Series) -> str:
        try:
            lon = float(row.get("经度", 0))
            lat = float(row.get("纬度", 0))
            
            center_lon = (self.coord_bounds["min_lon"] + self.coord_bounds["max_lon"]) / 2
            center_lat = (self.coord_bounds["min_lat"] + self.coord_bounds["max_lat"]) / 2
            
            if lat > center_lat + 0.1:
                return "北部新城"
            elif lat < center_lat - 0.1:
                return "南部新区"
            elif lon > center_lon + 0.1:
                return "东部工业区"
            elif lon < center_lon - 0.1:
                return "西部开发区"
            else:
                return "中心城区"
        except (ValueError, TypeError):
            return "未知"
