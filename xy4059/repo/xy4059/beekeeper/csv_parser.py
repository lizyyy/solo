"""CSV 解析器模块"""

import csv
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, TypeVar, Generic

from .store import InspectionRecord, TreatmentRecord, HarvestRecord


T = TypeVar('T')


@dataclass
class ParseResult(Generic[T]):
    """解析结果"""
    valid_records: List[T]
    invalid_rows: List[Dict[str, Any]]
    source_file: str
    total_rows: int


class CSVParser:
    """CSV 解析器基类"""
    
    REQUIRED_FIELDS: List[str] = []
    
    def __init__(self):
        self.encoding = "utf-8"
    
    def parse(self, file_path: Path) -> ParseResult:
        """解析 CSV 文件"""
        if not file_path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        valid_records = []
        invalid_rows = []
        total_rows = 0
        
        with open(file_path, "r", encoding=self.encoding, newline="") as f:
            reader = csv.DictReader(f)
            fieldnames = reader.fieldnames or []
            
            missing_fields = [f for f in self.REQUIRED_FIELDS if f not in fieldnames]
            if missing_fields:
                raise ValueError(f"CSV 缺少必需字段: {', '.join(missing_fields)}")
            
            for row in reader:
                total_rows += 1
                try:
                    record = self._parse_row(row)
                    if record:
                        valid_records.append(record)
                except Exception as e:
                    invalid_rows.append({
                        "row_data": dict(row),
                        "row_number": total_rows,
                        "error": str(e)
                    })
        
        return ParseResult(
            valid_records=valid_records,
            invalid_rows=invalid_rows,
            source_file=str(file_path),
            total_rows=total_rows
        )
    
    def _parse_row(self, row: Dict[str, str]) -> Optional[Any]:
        """解析单行数据 - 子类需要实现"""
        raise NotImplementedError("子类必须实现 _parse_row 方法")
    
    @staticmethod
    def _parse_date(date_str: str) -> str:
        """解析日期字符串"""
        date_str = date_str.strip()
        for fmt in ["%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d", "%d-%m-%Y", "%d/%m/%Y"]:
            try:
                parsed = datetime.strptime(date_str, fmt)
                return parsed.strftime("%Y-%m-%d")
            except ValueError:
                continue
        raise ValueError(f"无法解析日期格式: {date_str}")
    
    @staticmethod
    def _parse_float(value: str) -> Optional[float]:
        """解析浮点数"""
        value = value.strip()
        if not value:
            return None
        try:
            return float(value.replace(",", ""))
        except ValueError:
            raise ValueError(f"无法解析数值: {value}")
    
    @staticmethod
    def _parse_int(value: str) -> Optional[int]:
        """解析整数"""
        value = value.strip()
        if not value:
            return None
        try:
            return int(value)
        except ValueError:
            raise ValueError(f"无法解析整数: {value}")


class InspectionCSVParser(CSVParser):
    """巡检记录 CSV 解析器"""
    
    REQUIRED_FIELDS = ["date", "hive_number"]
    
    def _parse_row(self, row: Dict[str, str]) -> Optional[InspectionRecord]:
        """解析巡检记录行"""
        date = self._parse_date(row["date"])
        hive_number = row["hive_number"].strip()
        
        if not hive_number:
            raise ValueError("箱号不能为空")
        
        record_id = self._generate_record_id(date, hive_number, row)
        
        return InspectionRecord(
            record_id=record_id,
            date=date,
            hive_number=hive_number,
            colony_strength=row.get("colony_strength", "").strip() or None,
            queen_status=row.get("queen_status", "").strip() or None,
            pests_diseases=row.get("pests_diseases", "").strip() or None,
            feeding=row.get("feeding", "").strip() or None,
            notes=row.get("notes", "").strip() or None,
        )
    
    @staticmethod
    def _generate_record_id(date: str, hive_number: str, row: Dict[str, str]) -> str:
        """生成巡检记录唯一 ID"""
        from hashlib import md5
        content = f"{date}|{hive_number}|{row.get('colony_strength','')}|{row.get('queen_status','')}|{row.get('pests_diseases','')}"
        return f"inspect_{md5(content.encode('utf-8')).hexdigest()[:12]}"


class TreatmentCSVParser(CSVParser):
    """用药/饲喂记录 CSV 解析器"""
    
    REQUIRED_FIELDS = ["date", "hive_number", "treatment_type", "product_name"]
    
    def _parse_row(self, row: Dict[str, str]) -> Optional[TreatmentRecord]:
        """解析用药记录行"""
        date = self._parse_date(row["date"])
        hive_number = row["hive_number"].strip()
        treatment_type = row["treatment_type"].strip()
        product_name = row["product_name"].strip()
        
        if not hive_number:
            raise ValueError("箱号不能为空")
        if not treatment_type:
            raise ValueError("处理类型不能为空")
        if not product_name:
            raise ValueError("产品名称不能为空")
        
        record_id = self._generate_record_id(date, hive_number, product_name)
        
        return TreatmentRecord(
            record_id=record_id,
            date=date,
            hive_number=hive_number,
            treatment_type=treatment_type,
            product_name=product_name,
            dosage=row.get("dosage", "").strip() or None,
            notes=row.get("notes", "").strip() or None,
        )
    
    @staticmethod
    def _generate_record_id(date: str, hive_number: str, product_name: str) -> str:
        """生成用药记录唯一 ID"""
        from hashlib import md5
        content = f"{date}|{hive_number}|{product_name}"
        return f"treat_{md5(content.encode('utf-8')).hexdigest()[:12]}"


class HarvestCSVParser(CSVParser):
    """摇蜜记录 CSV 解析器"""
    
    REQUIRED_FIELDS = ["date", "hive_number", "batch_number"]
    
    def _parse_row(self, row: Dict[str, str]) -> Optional[HarvestRecord]:
        """解析摇蜜记录行"""
        date = self._parse_date(row["date"])
        hive_number = row["hive_number"].strip()
        batch_number = row["batch_number"].strip()
        
        if not hive_number:
            raise ValueError("箱号不能为空")
        if not batch_number:
            raise ValueError("批次号不能为空")
        
        record_id = self._generate_record_id(date, hive_number, batch_number)
        
        quantity_kg = None
        if "quantity_kg" in row and row["quantity_kg"].strip():
            quantity_kg = self._parse_float(row["quantity_kg"])
        
        moisture_content = None
        if "moisture_content" in row and row["moisture_content"].strip():
            moisture_content = self._parse_float(row["moisture_content"])
        
        return HarvestRecord(
            record_id=record_id,
            date=date,
            hive_number=hive_number,
            batch_number=batch_number,
            quantity_kg=quantity_kg,
            moisture_content=moisture_content,
            notes=row.get("notes", "").strip() or None,
        )
    
    @staticmethod
    def _generate_record_id(date: str, hive_number: str, batch_number: str) -> str:
        """生成摇蜜记录唯一 ID"""
        from hashlib import md5
        content = f"{date}|{hive_number}|{batch_number}"
        return f"harvest_{md5(content.encode('utf-8')).hexdigest()[:12]}"


def get_parser_for_type(record_type: str) -> CSVParser:
    """根据记录类型获取对应的解析器"""
    parsers = {
        "inspection": InspectionCSVParser(),
        "treatment": TreatmentCSVParser(),
        "harvest": HarvestCSVParser(),
    }
    parser = parsers.get(record_type)
    if parser is None:
        raise ValueError(f"未知的记录类型: {record_type}")
    return parser
