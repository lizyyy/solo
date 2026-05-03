"""CSV 数据解析器"""

import csv
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Union

from nickel_plating_calculator.models.data_models import (
    TitrationData,
    TankRecord,
    ProductionRecord,
    ChemicalInventory,
)


class CSVParseError(Exception):
    """CSV 解析错误"""
    pass


class TitrationCSVParser:
    """滴定化验数据 CSV 解析器"""
    
    REQUIRED_COLUMNS = [
        "batch_id", "timestamp", "operator",
        "nickel_sulfate_edta_ml", "nickel_chloride_edta_ml",
        "boric_titrant_ml", "ph_value"
    ]
    
    OPTIONAL_COLUMNS = [
        "sample_volume_ml", "edta_concentration_mol_l", "naoh_concentration_mol_l"
    ]
    
    @classmethod
    def parse(cls, file_path: Union[str, Path]) -> TitrationData:
        """解析滴定 CSV 文件"""
        file_path = Path(file_path)
        if not file_path.exists():
            raise CSVParseError(f"文件不存在: {file_path}")
        
        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            rows = list(reader)
        
        if len(rows) == 0:
            raise CSVParseError("CSV 文件为空")
        
        if len(rows) > 1:
            raise CSVParseError("滴定 CSV 只能包含一行数据")
        
        row = rows[0]
        cls._validate_columns(row, file_path.name)
        
        try:
            timestamp_str = row["timestamp"].strip()
            timestamp = cls._parse_timestamp(timestamp_str)
            
            return TitrationData(
                batch_id=row["batch_id"].strip(),
                timestamp=timestamp,
                operator=row["operator"].strip(),
                nickel_sulfate_edta_volume=float(row["nickel_sulfate_edta_ml"]),
                nickel_chloride_edta_volume=float(row["nickel_chloride_edta_ml"]),
                boric_titrant_volume=float(row["boric_titrant_ml"]),
                ph_value=float(row["ph_value"]),
                sample_volume=float(row.get("sample_volume_ml", 2.0)),
                edta_concentration=float(row.get("edta_concentration_mol_l", 0.05)),
                naoh_concentration=float(row.get("naoh_concentration_mol_l", 0.1)),
            )
        except (ValueError, KeyError) as e:
            raise CSVParseError(f"数据格式错误: {e}")
    
    @classmethod
    def _validate_columns(cls, row: Dict[str, str], filename: str):
        """验证必需列"""
        missing = []
        for col in cls.REQUIRED_COLUMNS:
            if col not in row:
                missing.append(col)
        
        if missing:
            raise CSVParseError(
                f"文件 {filename} 缺少必需列: {', '.join(missing)}"
            )
    
    @staticmethod
    def _parse_timestamp(ts_str: str) -> datetime:
        """解析时间戳"""
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
            "%Y%m%d%H%M%S",
            "%Y%m%d",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(ts_str, fmt)
            except ValueError:
                continue
        
        raise ValueError(f"无法解析时间戳: {ts_str}")


class TankRecordCSVParser:
    """槽液记录 CSV 解析器"""
    
    REQUIRED_COLUMNS = [
        "tank_id", "batch_id", "timestamp", "operator",
        "volume_liters", "temperature_celsius", "current_ph"
    ]
    
    OPTIONAL_COLUMNS = ["notes"]
    
    @classmethod
    def parse(cls, file_path: Union[str, Path]) -> TankRecord:
        """解析槽液记录 CSV 文件"""
        file_path = Path(file_path)
        if not file_path.exists():
            raise CSVParseError(f"文件不存在: {file_path}")
        
        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            rows = list(reader)
        
        if len(rows) == 0:
            raise CSVParseError("CSV 文件为空")
        
        if len(rows) > 1:
            raise CSVParseError("槽液记录 CSV 只能包含一行数据")
        
        row = rows[0]
        cls._validate_columns(row, file_path.name)
        
        try:
            timestamp_str = row["timestamp"].strip()
            timestamp = TitrationCSVParser._parse_timestamp(timestamp_str)
            
            return TankRecord(
                tank_id=row["tank_id"].strip(),
                batch_id=row["batch_id"].strip(),
                timestamp=timestamp,
                operator=row["operator"].strip(),
                volume_liters=float(row["volume_liters"]),
                temperature_celsius=float(row["temperature_celsius"]),
                current_ph=float(row["current_ph"]),
                notes=row.get("notes", "").strip(),
            )
        except (ValueError, KeyError) as e:
            raise CSVParseError(f"数据格式错误: {e}")
    
    @classmethod
    def _validate_columns(cls, row: Dict[str, str], filename: str):
        """验证必需列"""
        missing = []
        for col in cls.REQUIRED_COLUMNS:
            if col not in row:
                missing.append(col)
        
        if missing:
            raise CSVParseError(
                f"文件 {filename} 缺少必需列: {', '.join(missing)}"
            )


class ProductionRecordCSVParser:
    """生产记录 CSV 解析器"""
    
    REQUIRED_COLUMNS = [
        "batch_id", "timestamp", "operator",
        "total_area_dm2", "parts_count", "plating_time_minutes"
    ]
    
    OPTIONAL_COLUMNS = [
        "estimated_nickel_consumption_g", "estimated_acid_consumption_ml"
    ]
    
    @classmethod
    def parse(cls, file_path: Union[str, Path]) -> ProductionRecord:
        """解析生产记录 CSV 文件"""
        file_path = Path(file_path)
        if not file_path.exists():
            raise CSVParseError(f"文件不存在: {file_path}")
        
        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            rows = list(reader)
        
        if len(rows) == 0:
            raise CSVParseError("CSV 文件为空")
        
        if len(rows) > 1:
            raise CSVParseError("生产记录 CSV 只能包含一行数据")
        
        row = rows[0]
        cls._validate_columns(row, file_path.name)
        
        try:
            timestamp_str = row["timestamp"].strip()
            timestamp = TitrationCSVParser._parse_timestamp(timestamp_str)
            
            return ProductionRecord(
                batch_id=row["batch_id"].strip(),
                timestamp=timestamp,
                operator=row["operator"].strip(),
                total_area_dm2=float(row["total_area_dm2"]),
                parts_count=int(float(row["parts_count"])),
                plating_time_minutes=float(row["plating_time_minutes"]),
                estimated_nickel_consumption_g=cls._parse_optional_float(row, "estimated_nickel_consumption_g"),
                estimated_acid_consumption_ml=cls._parse_optional_float(row, "estimated_acid_consumption_ml"),
            )
        except (ValueError, KeyError) as e:
            raise CSVParseError(f"数据格式错误: {e}")
    
    @staticmethod
    def _parse_optional_float(row: Dict[str, str], key: str) -> Optional[float]:
        """解析可选的浮点数值"""
        value = row.get(key, "")
        if value is None or value.strip() == "":
            return None
        try:
            return float(value)
        except ValueError:
            return None
    
    @classmethod
    def _validate_columns(cls, row: Dict[str, str], filename: str):
        """验证必需列"""
        missing = []
        for col in cls.REQUIRED_COLUMNS:
            if col not in row:
                missing.append(col)
        
        if missing:
            raise CSVParseError(
                f"文件 {filename} 缺少必需列: {', '.join(missing)}"
            )


class InventoryCSVParser:
    """库存 CSV 解析器"""
    
    REQUIRED_COLUMNS = [
        "chemical_name", "batch_id", "timestamp", "operator",
        "current_quantity_kg", "minimum_stock_kg"
    ]
    
    OPTIONAL_COLUMNS = [
        "unit_price_per_kg", "supplier", "lot_number"
    ]
    
    @classmethod
    def parse(cls, file_path: Union[str, Path]) -> List[ChemicalInventory]:
        """解析库存 CSV 文件 - 支持多行"""
        file_path = Path(file_path)
        if not file_path.exists():
            raise CSVParseError(f"文件不存在: {file_path}")
        
        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            rows = list(reader)
        
        if len(rows) == 0:
            raise CSVParseError("CSV 文件为空")
        
        result = []
        for idx, row in enumerate(rows):
            cls._validate_columns(row, f"{file_path.name} 第{idx+1}行")
            
            try:
                timestamp_str = row["timestamp"].strip()
                timestamp = TitrationCSVParser._parse_timestamp(timestamp_str)
                
                inventory = ChemicalInventory(
                    chemical_name=row["chemical_name"].strip(),
                    batch_id=row["batch_id"].strip(),
                    timestamp=timestamp,
                    operator=row["operator"].strip(),
                    current_quantity_kg=float(row["current_quantity_kg"]),
                    minimum_stock_kg=float(row["minimum_stock_kg"]),
                    unit_price_per_kg=cls._parse_optional_float(row, "unit_price_per_kg"),
                    supplier=row.get("supplier", "").strip(),
                    lot_number=row.get("lot_number", "").strip(),
                )
                result.append(inventory)
            except (ValueError, KeyError) as e:
                raise CSVParseError(f"第{idx+1}行数据格式错误: {e}")
        
        return result
    
    @staticmethod
    def _parse_optional_float(row: Dict[str, str], key: str) -> Optional[float]:
        """解析可选的浮点数值"""
        value = row.get(key, "")
        if value is None or value.strip() == "":
            return None
        try:
            return float(value)
        except ValueError:
            return None
    
    @classmethod
    def _validate_columns(cls, row: Dict[str, str], location: str):
        """验证必需列"""
        missing = []
        for col in cls.REQUIRED_COLUMNS:
            if col not in row:
                missing.append(col)
        
        if missing:
            raise CSVParseError(
                f"{location} 缺少必需列: {', '.join(missing)}"
            )


def parse_titration_csv(file_path: Union[str, Path]) -> TitrationData:
    """便捷函数：解析滴定 CSV"""
    return TitrationCSVParser.parse(file_path)


def parse_tank_record_csv(file_path: Union[str, Path]) -> TankRecord:
    """便捷函数：解析槽液记录 CSV"""
    return TankRecordCSVParser.parse(file_path)


def parse_production_csv(file_path: Union[str, Path]) -> ProductionRecord:
    """便捷函数：解析生产记录 CSV"""
    return ProductionRecordCSVParser.parse(file_path)


def parse_inventory_csv(file_path: Union[str, Path]) -> List[ChemicalInventory]:
    """便捷函数：解析库存 CSV"""
    return InventoryCSVParser.parse(file_path)
