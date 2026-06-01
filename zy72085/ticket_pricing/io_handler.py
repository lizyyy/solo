import csv
import json
from datetime import datetime
from typing import List, Dict, Any
import os

try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False

from .models import PricingRecord, RecordManager


class IOHandler:
    def __init__(self, record_manager: RecordManager):
        self.manager = record_manager
    
    def import_from_csv(self, filepath: str, source_name: str = "") -> Dict[str, Any]:
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"文件不存在: {filepath}")
        
        imported_count = 0
        failed_count = 0
        errors = []
        
        with open(filepath, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                try:
                    record = self._parse_row(row, source_name or os.path.basename(filepath))
                    self.manager.add_record(record)
                    imported_count += 1
                except Exception as e:
                    failed_count += 1
                    errors.append(f"第{row_num}行: {str(e)}")
        
        return {
            "success": imported_count,
            "failed": failed_count,
            "errors": errors
        }
    
    def import_from_excel(self, filepath: str, source_name: str = "", sheet_name: str = 0) -> Dict[str, Any]:
        if not PANDAS_AVAILABLE:
            raise ImportError("需要安装pandas和openpyxl才能读取Excel文件")
        
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"文件不存在: {filepath}")
        
        df = pd.read_excel(filepath, sheet_name=sheet_name)
        imported_count = 0
        failed_count = 0
        errors = []
        
        for idx, row in df.iterrows():
            try:
                row_dict = row.to_dict()
                record = self._parse_row(row_dict, source_name or os.path.basename(filepath))
                self.manager.add_record(record)
                imported_count += 1
            except Exception as e:
                failed_count += 1
                errors.append(f"第{idx+2}行: {str(e)}")
        
        return {
            "success": imported_count,
            "failed": failed_count,
            "errors": errors
        }
    
    def _parse_row(self, row: Dict[str, Any], source_name: str) -> PricingRecord:
        def get_val(key, default=0.0, type_func=float):
            for possible_key in [key, key.lower(), key.replace('_', ''), key.replace('_', ' ')]:
                if possible_key in row and row[possible_key] not in (None, ''):
                    try:
                        return type_func(row[possible_key])
                    except (ValueError, TypeError):
                        return default
            return default
        
        def get_str(key, default=""):
            for possible_key in [key, key.lower(), key.replace('_', ''), key.replace('_', ' ')]:
                if possible_key in row:
                    val = row[possible_key]
                    return str(val) if val is not None else default
            return default
        
        return PricingRecord(
            source_name=source_name,
            source_type="imported",
            production_cost=get_val("production_cost", 0.0, float),
            production_cost_unit=get_str("production_cost_unit", "CNY") or "CNY",
            expected_attendance=get_val("expected_attendance", 0.0, float),
            attendance_unit=get_str("attendance_unit", "person") or "person",
            profit_margin=get_val("profit_margin", 0.0, float),
            days_to_show=int(get_val("days_to_show", 0, int)),
            ticket_sold_rate=get_val("ticket_sold_rate", 0.0, float),
            weekend_factor=int(get_val("weekend_factor", 0, int)),
            manual_notes=get_str("manual_notes", "")
        )
    
    def export_to_csv(self, filepath: str, include_failed: bool = True) -> Dict[str, Any]:
        records = self.manager.records if include_failed else \
                  [r for r in self.manager.records if r.process_status == "success"]
        
        if not records:
            return {"exported": 0, "message": "没有可导出的记录"}
        
        fieldnames = list(records[0].to_export_row().keys())
        
        os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
        
        with open(filepath, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for record in records:
                writer.writerow(record.to_export_row())
        
        return {
            "exported": len(records),
            "filepath": filepath
        }
    
    def export_to_excel(self, filepath: str, include_failed: bool = True) -> Dict[str, Any]:
        if not PANDAS_AVAILABLE:
            raise ImportError("需要安装pandas和openpyxl才能导出Excel文件")
        
        records = self.manager.records if include_failed else \
                  [r for r in self.manager.records if r.process_status == "success"]
        
        if not records:
            return {"exported": 0, "message": "没有可导出的记录"}
        
        data = [r.to_export_row() for r in records]
        df = pd.DataFrame(data)
        
        os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
        
        df.to_excel(filepath, index=False, engine='openpyxl')
        
        return {
            "exported": len(records),
            "filepath": filepath
        }
    
    def export_abnormal_list(self, filepath: str) -> Dict[str, Any]:
        abnormal_records = [
            r for r in self.manager.records 
            if r.process_status != "success" or r.needs_review
        ]
        
        if not abnormal_records:
            return {"exported": 0, "message": "没有异常记录"}
        
        data = []
        for r in abnormal_records:
            row = r.to_export_row()
            row["abnormal_type"] = []
            if r.process_status == "failed":
                row["abnormal_type"].append("计算失败")
            if r.needs_review:
                row["abnormal_type"].append("需人工审核")
            if r.calculation_result and r.calculation_result.warnings:
                row["abnormal_type"].append("边界警告")
            if r.calculation_result and r.calculation_result.conflicts:
                row["abnormal_type"].append("与讲义冲突")
            row["abnormal_type"] = ", ".join(row["abnormal_type"])
            data.append(row)
        
        ext = os.path.splitext(filepath)[1].lower()
        
        os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
        
        if ext in ['.xlsx', '.xls']:
            if not PANDAS_AVAILABLE:
                raise ImportError("需要安装pandas和openpyxl才能导出Excel文件")
            df = pd.DataFrame(data)
            df.to_excel(filepath, index=False, engine='openpyxl')
        else:
            fieldnames = list(data[0].keys())
            with open(filepath, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                for row in data:
                    writer.writerow(row)
        
        return {
            "exported": len(abnormal_records),
            "filepath": filepath,
            "abnormal_types": {
                "failed": len([r for r in abnormal_records if r.process_status == "failed"]),
                "needs_review": len([r for r in abnormal_records if r.needs_review]),
            }
        }
