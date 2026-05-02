"""
CSV解析模块 - 解析订单CSV文件
"""

import csv
import os
from datetime import datetime
from typing import List, Dict, Optional, Any

from .models import (
    OrderCase, PatientInfo, ToothPosition, MaterialInfo, 
    ResinBatch, MaterialType
)


class CSVParser:
    SUPPORTED_FIELD_MAPPINGS = {
        "case_id": ["case_id", "病例编号", "订单编号", "order_id", "id"],
        "patient_id": ["patient_id", "患者编号", "患者ID", "patient_number"],
        "patient_name": ["patient_name", "患者姓名", "姓名", "name"],
        "gender": ["gender", "性别", "sex"],
        "age": ["age", "年龄"],
        "tooth_position": ["tooth_position", "牙位", "tooth", "position", "teeth"],
        "material_type": ["material_type", "材料类型", "材料", "material"],
        "color_shade": ["color_shade", "色号", "颜色", "shade", "color"],
        "material_brand": ["material_brand", "材料品牌", "品牌", "brand"],
        "material_model": ["material_model", "材料型号", "型号", "model"],
        "resin_batch": ["resin_batch", "树脂批号", "batch_number", "batch", "批号"],
        "resin_expiration": ["resin_expiration", "有效期", "expiration_date", "expiry"],
        "resin_manufacturer": ["resin_manufacturer", "厂家", "manufacturer"],
        "resin_name": ["resin_name", "树脂名称", "material_name"],
    }
    
    def __init__(self):
        self.imported_cases: List[OrderCase] = []
    
    def parse_file(self, file_path: str, encoding: str = "utf-8") -> List[OrderCase]:
        file_path = os.path.abspath(file_path)
        
        if not os.path.isfile(file_path):
            raise FileNotFoundError(f"CSV file not found: {file_path}")
        
        encodings = [encoding, "gbk", "gb2312", "utf-8-sig", "latin1"]
        last_error = None
        
        for enc in encodings:
            try:
                with open(file_path, "r", encoding=enc) as f:
                    content = f.read()
                    return self._parse_content(content, file_path)
            except UnicodeDecodeError as e:
                last_error = e
                continue
        
        raise ValueError(f"Failed to decode CSV file with any supported encoding: {last_error}")
    
    def _parse_content(self, content: str, file_path: str) -> List[OrderCase]:
        import io
        cases = []
        
        reader = csv.DictReader(io.StringIO(content))
        
        field_mapping = self._build_field_mapping(reader.fieldnames)
        
        for row_num, row in enumerate(reader, start=2):
            try:
                case = self._parse_row(row, field_mapping, row_num)
                if case:
                    cases.append(case)
                    self.imported_cases.append(case)
            except Exception as e:
                print(f"Warning: Failed to parse row {row_num}: {e}")
        
        return cases
    
    def _build_field_mapping(self, actual_fields: List[str]) -> Dict[str, str]:
        mapping = {}
        
        if not actual_fields:
            return mapping
        
        actual_lower = [f.strip().lower() for f in actual_fields]
        actual_original = {f.strip().lower(): f for f in actual_fields}
        
        for standard_field, possible_names in self.SUPPORTED_FIELD_MAPPINGS.items():
            possible_lower = [name.lower() for name in possible_names]
            
            for actual_idx, actual_lower_name in enumerate(actual_lower):
                if actual_lower_name in possible_lower:
                    mapping[standard_field] = actual_original[actual_lower_name]
                    break
                
                for possible_lower_name in possible_lower:
                    if possible_lower_name in actual_lower_name or actual_lower_name in possible_lower_name:
                        mapping[standard_field] = actual_original[actual_lower_name]
                        break
        
        return mapping
    
    def _parse_row(self, row: Dict[str, str], field_mapping: Dict[str, str], row_num: int) -> Optional[OrderCase]:
        def get_val(field: str, default: str = "") -> str:
            csv_field = field_mapping.get(field)
            if csv_field and csv_field in row:
                return row[csv_field].strip()
            return default
        
        case_id = get_val("case_id", f"CASE_{row_num:04d}")
        patient_id = get_val("patient_id")
        
        if not patient_id:
            patient_id = case_id
        
        patient_name = get_val("patient_name")
        gender = get_val("gender")
        
        age_str = get_val("age", "0")
        try:
            age = int(age_str) if age_str else 0
        except ValueError:
            age = 0
        
        patient = PatientInfo(
            patient_id=patient_id,
            patient_name=patient_name,
            gender=gender,
            age=age
        )
        
        raw_tooth_position = get_val("tooth_position")
        tooth_position = self._parse_tooth_position(raw_tooth_position)
        
        material_type_str = get_val("material_type")
        material_type = self._parse_material_type(material_type_str)
        color_shade = get_val("color_shade")
        material_brand = get_val("material_brand")
        material_model = get_val("material_model")
        
        material = MaterialInfo(
            material_type=material_type,
            color_shade=color_shade,
            brand=material_brand,
            model=material_model
        )
        
        resin_batch = None
        batch_number = get_val("resin_batch")
        if batch_number:
            expiration_str = get_val("resin_expiration")
            expiration_date = self._parse_expiration_date(expiration_str)
            
            resin_batch = ResinBatch(
                batch_number=batch_number,
                expiration_date=expiration_date or datetime.max,
                manufacturer=get_val("resin_manufacturer"),
                material_name=get_val("resin_name")
            )
        
        case = OrderCase(
            case_id=case_id,
            patient=patient,
            tooth_position=tooth_position,
            material=material,
            resin_batch=resin_batch
        )
        
        return case
    
    def _parse_tooth_position(self, raw_position: str) -> ToothPosition:
        teeth = []
        validation_errors = []
        is_valid = True
        
        if not raw_position:
            validation_errors.append("牙位为空")
            is_valid = False
            return ToothPosition(
                raw_position="",
                teeth=[],
                is_valid=False,
                validation_errors=["牙位不能为空"]
            )
        
        import re
        position_str = raw_position.upper().strip()
        
        ranges = re.split(r'[，,\s]+', position_str)
        
        for r in ranges:
            r = r.strip()
            if not r:
                continue
            
            if '-' in r or '～' in r:
                parts = re.split(r'[-～]', r)
                if len(parts) == 2:
                    start = parts[0].strip()
                    end = parts[1].strip()
                    try:
                        start_num = int(start)
                        end_num = int(end)
                        
                        if 1 <= start_num <= 32 and 1 <= end_num <= 32:
                            step = 1 if end_num > start_num else -1
                            for num in range(start_num, end_num + step, step):
                                teeth.append(str(num))
                        else:
                            validation_errors.append(f"牙位范围 {r} 超出有效范围(1-32)")
                            is_valid = False
                    except ValueError:
                        validation_errors.append(f"无效的牙位范围格式: {r}")
                        is_valid = False
            else:
                try:
                    num = int(r)
                    if 1 <= num <= 32:
                        teeth.append(str(num))
                    else:
                        validation_errors.append(f"牙位 {r} 超出有效范围(1-32)")
                        is_valid = False
                except ValueError:
                    if len(r) == 2 and r[0] in ['1', '2', '3', '4', '5', '6', '7', '8'] and r[1] in ['1', '2', '3', '4', '5', '6', '7', '8']:
                        teeth.append(r)
                    else:
                        validation_errors.append(f"无效的牙位格式: {r}")
                        is_valid = False
        
        seen = set()
        unique_teeth = []
        for t in teeth:
            if t not in seen:
                seen.add(t)
                unique_teeth.append(t)
        
        return ToothPosition(
            raw_position=raw_position,
            teeth=sorted(unique_teeth, key=lambda x: int(x) if x.isdigit() else 99),
            is_valid=is_valid,
            validation_errors=validation_errors
        )
    
    def _parse_material_type(self, material_str: str) -> MaterialType:
        if not material_str:
            return MaterialType.RESIN
        
        material_lower = material_str.lower()
        
        type_mapping = {
            "resin": MaterialType.RESIN,
            "树脂": MaterialType.RESIN,
            "光固化": MaterialType.RESIN,
            "ceramic": MaterialType.CERAMIC,
            "陶瓷": MaterialType.CERAMIC,
            "瓷": MaterialType.CERAMIC,
            "氧化锆": MaterialType.CERAMIC,
            "metal": MaterialType.METAL,
            "金属": MaterialType.METAL,
            "钴铬": MaterialType.METAL,
            "钛合金": MaterialType.METAL,
            "composite": MaterialType.COMPOSITE,
            "复合": MaterialType.COMPOSITE,
            "复合树脂": MaterialType.COMPOSITE,
        }
        
        for key, value in type_mapping.items():
            if key in material_lower:
                return value
        
        return MaterialType.RESIN
    
    def _parse_expiration_date(self, date_str: str) -> Optional[datetime]:
        if not date_str:
            return None
        
        formats = [
            "%Y-%m-%d",
            "%Y/%m/%d",
            "%Y.%m.%d",
            "%Y年%m月%d日",
            "%Y%m%d",
            "%y-%m-%d",
            "%y/%m/%d",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(date_str.strip(), fmt)
            except ValueError:
                continue
        
        return None
    
    def get_import_summary(self) -> Dict[str, Any]:
        if not self.imported_cases:
            return {
                "total_cases": 0,
                "cases": []
            }
        
        return {
            "total_cases": len(self.imported_cases),
            "material_types": self._count_by_material_type(),
            "color_shades": self._count_by_color_shade(),
            "cases": [
                {
                    "case_id": c.case_id,
                    "patient_id": c.patient.patient_id,
                    "patient_name": c.patient.patient_name,
                    "tooth_position": c.tooth_position.raw_position,
                    "tooth_count": len(c.tooth_position.teeth),
                    "material_type": c.material.material_type.value,
                    "color_shade": c.material.color_shade,
                    "has_resin_batch": c.resin_batch is not None
                }
                for c in self.imported_cases
            ]
        }
    
    def _count_by_material_type(self) -> Dict[str, int]:
        counts = {}
        for case in self.imported_cases:
            mt = case.material.material_type.value
            counts[mt] = counts.get(mt, 0) + 1
        return counts
    
    def _count_by_color_shade(self) -> Dict[str, int]:
        counts = {}
        for case in self.imported_cases:
            shade = case.material.color_shade or "未指定"
            counts[shade] = counts.get(shade, 0) + 1
        return counts
