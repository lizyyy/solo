"""CSV数据解析器"""
import csv
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Union, Tuple
import pandas as pd
import numpy as np

from ..models import (
    BatchData, BatchMetadata, RecipeInfo, PhaseData,
    TemperatureData, VacuumData, MoistureData, SensorData
)


class CSVParser:
    """基础CSV解析器"""
    
    TIME_FORMATS = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%m/%d/%Y %H:%M:%S",
        "%m/%d/%Y %H:%M",
        "%d-%b-%Y %H:%M:%S",
        "%d-%b-%Y %H:%M",
        "%H:%M:%S",
        "%H:%M",
    ]
    
    def __init__(self, encoding: str = "utf-8", delimiter: str = ","):
        self.encoding = encoding
        self.delimiter = delimiter
        self.warnings: List[str] = []
    
    def parse_time(self, time_str: str, base_date: Optional[datetime] = None) -> Optional[datetime]:
        """解析时间字符串"""
        if not time_str or pd.isna(time_str):
            return None
        
        time_str = str(time_str).strip()
        
        for fmt in self.TIME_FORMATS:
            try:
                parsed = datetime.strptime(time_str, fmt)
                
                if "%Y" not in fmt and base_date:
                    parsed = parsed.replace(
                        year=base_date.year,
                        month=base_date.month,
                        day=base_date.day
                    )
                elif "%Y" not in fmt:
                    parsed = parsed.replace(
                        year=datetime.now().year,
                        month=datetime.now().month,
                        day=datetime.now().day
                    )
                
                return parsed
            except (ValueError, TypeError):
                continue
        
        return None
    
    def parse_number(self, value: Any) -> Optional[float]:
        """解析数值"""
        if value is None or pd.isna(value) or value == "":
            return None
        
        try:
            if isinstance(value, str):
                value = value.strip()
                value = value.replace(",", "")
            return float(value)
        except (ValueError, TypeError):
            return None
    
    def detect_columns(self, file_path: Path) -> Tuple[List[str], Dict[str, str]]:
        """自动检测CSV列"""
        df = pd.read_csv(file_path, encoding=self.encoding, delimiter=self.delimiter, nrows=5)
        columns = list(df.columns)
        
        column_mapping = {}
        
        time_keywords = ["time", "timestamp", "日期时间", "时间", "时刻"]
        temp_keywords = ["temperature", "temp", "温度", "搁板", "产品"]
        vacuum_keywords = ["vacuum", "pressure", "真空", "压力"]
        moisture_keywords = ["moisture", "water", "水分", "含水量"]
        
        for col in columns:
            col_lower = col.lower()
            
            for kw in time_keywords:
                if kw in col_lower:
                    column_mapping[col] = "time"
                    break
            
            if col not in column_mapping:
                for kw in temp_keywords:
                    if kw in col_lower:
                        if "shelf" in col_lower or "搁板" in col:
                            column_mapping[col] = "shelf_temp"
                        elif "product" in col_lower or "产品" in col:
                            column_mapping[col] = "product_temp"
                        else:
                            column_mapping[col] = "temperature"
                        break
            
            if col not in column_mapping:
                for kw in vacuum_keywords:
                    if kw in col_lower:
                        column_mapping[col] = "vacuum"
                        break
            
            if col not in column_mapping:
                for kw in moisture_keywords:
                    if kw in col_lower:
                        column_mapping[col] = "moisture"
                        break
        
        return columns, column_mapping
    
    def parse_sensor_data(self, file_path: Path, time_col: str = "time", 
                          value_col: str = "value", sensor_name: str = "unknown",
                          unit: str = "", base_date: Optional[datetime] = None) -> Optional[SensorData]:
        """解析传感器数据"""
        try:
            df = pd.read_csv(file_path, encoding=self.encoding, delimiter=self.delimiter)
            
            timestamps: List[datetime] = []
            values: List[float] = []
            
            for _, row in df.iterrows():
                time_val = self.parse_time(row[time_col], base_date)
                value_val = self.parse_number(row[value_col])
                
                if time_val is not None and value_val is not None:
                    timestamps.append(time_val)
                    values.append(value_val)
            
            if not timestamps:
                self.warnings.append(f"文件 {file_path.name} 中未找到有效时间戳")
                return None
            
            sorted_pairs = sorted(zip(timestamps, values), key=lambda x: x[0])
            timestamps, values = zip(*sorted_pairs) if sorted_pairs else ([], [])
            
            if sensor_name.lower().endswith("temp") or "温度" in sensor_name:
                return TemperatureData(
                    sensor_name=sensor_name,
                    unit=unit or "°C",
                    timestamps=list(timestamps),
                    values=list(values)
                )
            elif "vacuum" in sensor_name.lower() or "真空" in sensor_name:
                return VacuumData(
                    sensor_name=sensor_name,
                    unit=unit or "mTorr",
                    timestamps=list(timestamps),
                    values=list(values)
                )
            else:
                return SensorData(
                    sensor_name=sensor_name,
                    unit=unit,
                    timestamps=list(timestamps),
                    values=list(values)
                )
                
        except Exception as e:
            self.warnings.append(f"解析文件 {file_path.name} 时出错: {str(e)}")
            return None


class MultiSourceCSVParser:
    """多源CSV数据解析器"""
    
    def __init__(self):
        self.csv_parser = CSVParser()
        self.warnings: List[str] = []
    
    def parse_from_directory(self, directory_path: Path, batch_id: Optional[str] = None) -> Optional[BatchData]:
        """从目录解析多源数据"""
        if not directory_path.exists():
            self.warnings.append(f"目录不存在: {directory_path}")
            return None
        
        csv_files = list(directory_path.glob("*.csv"))
        
        if not csv_files:
            self.warnings.append(f"目录中没有找到CSV文件: {directory_path}")
            return None
        
        batch_metadata = self._parse_metadata_from_files(csv_files, batch_id)
        
        shelf_temp: Optional[TemperatureData] = None
        product_temp: Optional[TemperatureData] = None
        vacuum: Optional[VacuumData] = None
        moisture: Optional[MoistureData] = None
        additional_sensors: Dict[str, SensorData] = {}
        
        for csv_file in csv_files:
            file_lower = csv_file.name.lower()
            
            if "shelf" in file_lower or "搁板" in csv_file.name:
                sensor_data = self._parse_temperature_file(csv_file, "shelf_temp")
                if sensor_data:
                    shelf_temp = sensor_data
            elif "product" in file_lower or "产品" in csv_file.name:
                sensor_data = self._parse_temperature_file(csv_file, "product_temp")
                if sensor_data:
                    product_temp = sensor_data
            elif "vacuum" in file_lower or "真空" in csv_file.name:
                sensor_data = self._parse_vacuum_file(csv_file)
                if sensor_data:
                    vacuum = sensor_data
            elif "moisture" in file_lower or "水分" in csv_file.name:
                moisture_data = self._parse_moisture_file(csv_file)
                if moisture_data:
                    moisture = moisture_data
            else:
                generic_data = self._try_parse_generic_file(csv_file)
                if generic_data:
                    additional_sensors[csv_file.stem] = generic_data
        
        batch_data = BatchData(
            metadata=batch_metadata,
            shelf_temp=shelf_temp,
            product_temp=product_temp,
            vacuum=vacuum,
            moisture=moisture,
            additional_sensors=additional_sensors,
        )
        
        recipe_file = directory_path / "recipe.csv"
        if recipe_file.exists():
            batch_data.recipe = self._parse_recipe_file(recipe_file)
        
        phases_file = directory_path / "phases.csv"
        if phases_file.exists():
            batch_data.phases = self._parse_phases_file(phases_file)
        
        batch_data.validation_errors.extend(self.csv_parser.warnings)
        batch_data.validation_errors.extend(self.warnings)
        
        return batch_data
    
    def parse_from_files(self, batch_id: str, shelf_temp_file: Optional[Path] = None,
                        product_temp_file: Optional[Path] = None,
                        vacuum_file: Optional[Path] = None,
                        moisture_file: Optional[Path] = None,
                        recipe_file: Optional[Path] = None,
                        phases_file: Optional[Path] = None,
                        additional_files: Optional[List[Path]] = None) -> Optional[BatchData]:
        """从指定文件解析数据"""
        
        batch_metadata = BatchMetadata(
            batch_id=batch_id,
            product_name="未知产品",
            equipment_id="未知设备"
        )
        
        shelf_temp: Optional[TemperatureData] = None
        product_temp: Optional[TemperatureData] = None
        vacuum: Optional[VacuumData] = None
        moisture: Optional[MoistureData] = None
        additional_sensors: Dict[str, SensorData] = {}
        
        if shelf_temp_file:
            shelf_temp = self._parse_temperature_file(shelf_temp_file, "shelf_temp")
        
        if product_temp_file:
            product_temp = self._parse_temperature_file(product_temp_file, "product_temp")
        
        if vacuum_file:
            vacuum = self._parse_vacuum_file(vacuum_file)
        
        if moisture_file:
            moisture = self._parse_moisture_file(moisture_file)
        
        if additional_files:
            for file_path in additional_files:
                generic_data = self._try_parse_generic_file(file_path)
                if generic_data:
                    additional_sensors[file_path.stem] = generic_data
        
        batch_data = BatchData(
            metadata=batch_metadata,
            shelf_temp=shelf_temp,
            product_temp=product_temp,
            vacuum=vacuum,
            moisture=moisture,
            additional_sensors=additional_sensors,
        )
        
        if recipe_file:
            batch_data.recipe = self._parse_recipe_file(recipe_file)
        
        if phases_file:
            batch_data.phases = self._parse_phases_file(phases_file)
        
        batch_data.validation_errors.extend(self.csv_parser.warnings)
        batch_data.validation_errors.extend(self.warnings)
        
        return batch_data
    
    def _parse_metadata_from_files(self, files: List[Path], batch_id: Optional[str]) -> BatchMetadata:
        """从文件解析元数据"""
        product_name = "未知产品"
        equipment_id = "未知设备"
        actual_batch_id = batch_id or "UNK-001"
        
        for file_path in files:
            if "meta" in file_path.name.lower() or "metadata" in file_path.name.lower():
                try:
                    df = pd.read_csv(file_path, encoding=self.csv_parser.encoding)
                    for _, row in df.iterrows():
                        if len(row) >= 2:
                            key = str(row.iloc[0]).lower()
                            value = str(row.iloc[1])
                            
                            if "batch" in key or "批次" in key:
                                actual_batch_id = value
                            elif "product" in key or "产品" in key:
                                product_name = value
                            elif "equipment" in key or "设备" in key:
                                equipment_id = value
                except Exception:
                    pass
        
        return BatchMetadata(
            batch_id=actual_batch_id,
            product_name=product_name,
            equipment_id=equipment_id
        )
    
    def _parse_temperature_file(self, file_path: Path, sensor_name: str) -> Optional[TemperatureData]:
        """解析温度文件"""
        try:
            df = pd.read_csv(file_path, encoding=self.csv_parser.encoding)
            columns = list(df.columns)
            
            time_col = None
            temp_col = None
            
            for col in columns:
                col_lower = col.lower()
                if "time" in col_lower or "日期时间" in col or "时间" in col:
                    time_col = col
                elif "temp" in col_lower or "温度" in col:
                    temp_col = col
            
            if not time_col:
                if len(columns) >= 1:
                    time_col = columns[0]
                else:
                    self.warnings.append(f"温度文件 {file_path.name} 没有时间列")
                    return None
            
            if not temp_col:
                if len(columns) >= 2:
                    temp_col = columns[1]
                else:
                    self.warnings.append(f"温度文件 {file_path.name} 没有温度值列")
                    return None
            
            timestamps: List[datetime] = []
            values: List[float] = []
            base_date = None
            
            for _, row in df.iterrows():
                time_val = self.csv_parser.parse_time(row[time_col], base_date)
                temp_val = self.csv_parser.parse_number(row[temp_col])
                
                if time_val is not None and temp_val is not None:
                    if base_date is None:
                        base_date = time_val
                    timestamps.append(time_val)
                    values.append(temp_val)
            
            if not timestamps:
                return None
            
            sorted_pairs = sorted(zip(timestamps, values), key=lambda x: x[0])
            timestamps, values = zip(*sorted_pairs)
            
            return TemperatureData(
                sensor_name=sensor_name,
                unit="°C",
                timestamps=list(timestamps),
                values=list(values)
            )
            
        except Exception as e:
            self.warnings.append(f"解析温度文件 {file_path.name} 时出错: {str(e)}")
            return None
    
    def _parse_vacuum_file(self, file_path: Path) -> Optional[VacuumData]:
        """解析真空文件"""
        try:
            df = pd.read_csv(file_path, encoding=self.csv_parser.encoding)
            columns = list(df.columns)
            
            time_col = None
            vacuum_col = None
            
            for col in columns:
                col_lower = col.lower()
                if "time" in col_lower or "日期时间" in col or "时间" in col:
                    time_col = col
                elif "vacuum" in col_lower or "pressure" in col_lower or "真空" in col:
                    vacuum_col = col
            
            if not time_col:
                if len(columns) >= 1:
                    time_col = columns[0]
                else:
                    return None
            
            if not vacuum_col:
                if len(columns) >= 2:
                    vacuum_col = columns[1]
                else:
                    return None
            
            timestamps: List[datetime] = []
            values: List[float] = []
            base_date = None
            
            for _, row in df.iterrows():
                time_val = self.csv_parser.parse_time(row[time_col], base_date)
                vac_val = self.csv_parser.parse_number(row[vacuum_col])
                
                if time_val is not None and vac_val is not None:
                    if base_date is None:
                        base_date = time_val
                    timestamps.append(time_val)
                    values.append(vac_val)
            
            if not timestamps:
                return None
            
            sorted_pairs = sorted(zip(timestamps, values), key=lambda x: x[0])
            timestamps, values = zip(*sorted_pairs)
            
            return VacuumData(
                sensor_name="vacuum",
                unit="mTorr",
                timestamps=list(timestamps),
                values=list(values)
            )
            
        except Exception as e:
            self.warnings.append(f"解析真空文件 {file_path.name} 时出错: {str(e)}")
            return None
    
    def _parse_moisture_file(self, file_path: Path) -> Optional[MoistureData]:
        """解析水分文件"""
        try:
            df = pd.read_csv(file_path, encoding=self.csv_parser.encoding)
            moisture = MoistureData(measurement_type="Karl Fischer")
            
            columns = list(df.columns)
            time_col = None
            moisture_col = None
            sample_col = None
            location_col = None
            
            for col in columns:
                col_lower = col.lower()
                if "time" in col_lower or "日期" in col or "时间" in col:
                    time_col = col
                elif "moisture" in col_lower or "水分" in col:
                    moisture_col = col
                elif "sample" in col_lower or "样品" in col:
                    sample_col = col
                elif "location" in col_lower or "位置" in col:
                    location_col = col
            
            for _, row in df.iterrows():
                time_val = datetime.now()
                if time_col and time_col in df.columns:
                    parsed_time = self.csv_parser.parse_time(row[time_col])
                    if parsed_time:
                        time_val = parsed_time
                
                moisture_val = None
                if moisture_col and moisture_col in df.columns:
                    moisture_val = self.csv_parser.parse_number(row[moisture_col])
                
                if moisture_val is not None:
                    sample_id = None
                    if sample_col and sample_col in df.columns:
                        sample_id = str(row[sample_col]) if not pd.isna(row[sample_col]) else None
                    
                    location = None
                    if location_col and location_col in df.columns:
                        location = str(row[location_col]) if not pd.isna(row[location_col]) else None
                    
                    moisture.add_sample(
                        time=time_val,
                        moisture_pct=moisture_val,
                        sample_id=sample_id,
                        location=location
                    )
            
            return moisture if moisture.values else None
            
        except Exception as e:
            self.warnings.append(f"解析水分文件 {file_path.name} 时出错: {str(e)}")
            return None
    
    def _parse_recipe_file(self, file_path: Path) -> Optional[RecipeInfo]:
        """解析配方文件"""
        try:
            df = pd.read_csv(file_path, encoding=self.csv_parser.encoding)
            
            if "key" in df.columns and "value" in df.columns:
                data = {}
                for _, row in df.iterrows():
                    key = str(row["key"]).strip().lower()
                    value = str(row["value"]) if not pd.isna(row["value"]) else ""
                    
                    if "product" in key or "产品" in key:
                        data["product_name"] = value
                    elif "batch_size" in key or "批次体积" in key:
                        data["batch_size_ml"] = float(value)
                    elif "vial_count" in key or "西林瓶数量" in key:
                        data["vial_count"] = int(value)
                    elif "fill_volume" in key or "灌装体积" in key:
                        data["fill_volume_ml"] = float(value)
                    elif "collapse_temp" in key or "塌陷温度" in key:
                        data["collapse_temp_c"] = float(value)
                    elif "eutectic_temp" in key or "共晶温度" in key:
                        data["eutectic_temp_c"] = float(value)
                    elif "formulation" in key or "配方" in key:
                        data["formulation"] = value
                    elif "concentration" in key or "浓度" in key:
                        data["concentration_mg_ml"] = float(value)
                
                if "product_name" not in data:
                    data["product_name"] = "未知产品"
                if "batch_size_ml" not in data:
                    data["batch_size_ml"] = 0.0
                if "vial_count" not in data:
                    data["vial_count"] = 0
                if "fill_volume_ml" not in data:
                    data["fill_volume_ml"] = 0.0
                
                return RecipeInfo(**data)
            
            else:
                if len(df) > 0:
                    row = df.iloc[0]
                    return RecipeInfo(
                        product_name=str(row.get("product_name", row.get("产品名称", "未知产品"))),
                        batch_size_ml=float(row.get("batch_size_ml", row.get("批次体积_ml", 0))),
                        vial_count=int(row.get("vial_count", row.get("西林瓶数量", 0))),
                        fill_volume_ml=float(row.get("fill_volume_ml", row.get("灌装体积_ml", 0))),
                        collapse_temp_c=float(row["collapse_temp_c"]) if "collapse_temp_c" in df.columns else None,
                        eutectic_temp_c=float(row["eutectic_temp_c"]) if "eutectic_temp_c" in df.columns else None,
                    )
                    
        except Exception as e:
            self.warnings.append(f"解析配方文件时出错: {str(e)}")
            return None
        
        return None
    
    def _parse_phases_file(self, file_path: Path) -> List[PhaseData]:
        """解析阶段文件"""
        phases: List[PhaseData] = []
        
        try:
            df = pd.read_csv(file_path, encoding=self.csv_parser.encoding)
            
            for _, row in df.iterrows():
                phase = PhaseData(
                    phase_name=str(row.get("phase_name", row.get("阶段名称", "未知阶段"))),
                    target_temp_c=float(row["target_temp_c"]) if "target_temp_c" in df.columns and not pd.isna(row["target_temp_c"]) else None,
                    target_vacuum_mtorr=float(row["target_vacuum_mtorr"]) if "target_vacuum_mtorr" in df.columns and not pd.isna(row["target_vacuum_mtorr"]) else None,
                    duration_minutes=float(row["duration_minutes"]) if "duration_minutes" in df.columns and not pd.isna(row["duration_minutes"]) else None,
                    ramp_rate_c_min=float(row["ramp_rate_c_min"]) if "ramp_rate_c_min" in df.columns and not pd.isna(row["ramp_rate_c_min"]) else None,
                )
                phases.append(phase)
                
        except Exception as e:
            self.warnings.append(f"解析阶段文件时出错: {str(e)}")
        
        return phases
    
    def _try_parse_generic_file(self, file_path: Path) -> Optional[SensorData]:
        """尝试解析通用传感器文件"""
        try:
            df = pd.read_csv(file_path, encoding=self.csv_parser.encoding)
            columns = list(df.columns)
            
            if len(columns) < 2:
                return None
            
            time_col = None
            value_col = None
            
            for col in columns:
                col_lower = col.lower()
                if "time" in col_lower or "日期时间" in col or "时间" in col:
                    time_col = col
                    break
            
            if not time_col:
                time_col = columns[0]
            
            value_col = columns[1] if len(columns) >= 2 else None
            
            if not value_col:
                return None
            
            timestamps: List[datetime] = []
            values: List[float] = []
            base_date = None
            
            for _, row in df.iterrows():
                time_val = self.csv_parser.parse_time(row[time_col], base_date)
                val = self.csv_parser.parse_number(row[value_col])
                
                if time_val is not None and val is not None:
                    if base_date is None:
                        base_date = time_val
                    timestamps.append(time_val)
                    values.append(val)
            
            if not timestamps:
                return None
            
            sorted_pairs = sorted(zip(timestamps, values), key=lambda x: x[0])
            timestamps, values = zip(*sorted_pairs)
            
            return SensorData(
                sensor_name=file_path.stem,
                unit="",
                timestamps=list(timestamps),
                values=list(values)
            )
            
        except Exception:
            return None
