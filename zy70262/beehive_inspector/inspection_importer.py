"""巡检数据导入模块"""
import os
from typing import List, Dict, Any, Tuple
import pandas as pd
from beehive_inspector.validator import DataValidator
from beehive_inspector.storage import FileStorage
from beehive_inspector.beehive_manager import BeehiveManager


class InspectionImporter:
    def __init__(self, storage: FileStorage, beehive_manager: BeehiveManager):
        self.storage = storage
        self.beehive_manager = beehive_manager

    def load_from_file(self, filepath: str) -> List[Dict[str, Any]]:
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"文件不存在: {filepath}")

        ext = os.path.splitext(filepath)[1].lower()
        
        if ext == ".csv":
            df = pd.read_csv(filepath, encoding="utf-8")
        elif ext in [".xlsx", ".xls"]:
            df = pd.read_excel(filepath)
        else:
            raise ValueError(f"不支持的文件格式: {ext}，仅支持 CSV 和 Excel")

        df = df.where(pd.notnull(df), None)
        records = df.to_dict("records")
        
        for record in records:
            for key, value in record.items():
                if isinstance(value, float) and pd.isna(value):
                    record[key] = None
                if isinstance(value, str):
                    record[key] = value.strip()

        return records

    def validate_records(self, records: List[Dict[str, Any]]) -> Dict[str, Any]:
        all_errors = []
        all_warnings = []
        
        existing_inspections = self.storage.load_inspections()
        all_to_check = existing_inspections + records
        
        duplicates = DataValidator.check_duplicates(all_to_check)
        
        for idx, record in enumerate(records):
            row_num = idx + 2
            errors, warnings = DataValidator.validate_inspection_record(record, row_num)
            all_errors.extend(errors)
            all_warnings.extend(warnings)

        for dup in duplicates:
            dup_idx = dup["row"] - 2
            if dup_idx >= len(existing_inspections):
                all_errors.append(dup)

        beehives = self.beehive_manager.list_beehives()
        known_hive_ids = {b["beehive_id"] for b in beehives}
        
        for idx, record in enumerate(records):
            row_num = idx + 2
            hive_id = record.get("beehive_id")
            if hive_id and hive_id not in known_hive_ids:
                all_warnings.append({
                    "row": row_num,
                    "type": "unknown_beehive",
                    "field": "beehive_id",
                    "value": hive_id,
                    "message": f"未知蜂箱编号: {hive_id}，此记录将被导入但可能影响后续分析",
                })

        return {
            "total_records": len(records),
            "error_count": len(all_errors),
            "warning_count": len(all_warnings),
            "errors": all_errors,
            "warnings": all_warnings,
            "duplicates": [d for d in duplicates if (d["row"] - 2) >= len(existing_inspections)],
        }

    def import_records(self, records: List[Dict[str, Any]], skip_errors: bool = False) -> Dict[str, Any]:
        validation = self.validate_records(records)
        
        if validation["error_count"] > 0 and not skip_errors:
            return {
                "success": False,
                "imported": 0,
                "validation": validation,
                "message": "存在验证错误，导入已取消",
            }

        valid_records = []
        skipped_rows = []
        beehives = self.beehive_manager.list_beehives()
        known_hive_ids = {b["beehive_id"] for b in beehives}
        latest_inspection_dates = {}
        
        for idx, record in enumerate(records):
            row_num = idx + 2
            has_error = any(e["row"] == row_num for e in validation["errors"])
            
            if has_error and skip_errors:
                skipped_rows.append(row_num)
                continue
            
            valid_records.append(record)
            
            hive_id = record.get("beehive_id")
            insp_date = record.get("inspection_date")
            if hive_id and insp_date:
                if hive_id not in latest_inspection_dates or insp_date > latest_inspection_dates[hive_id]:
                    latest_inspection_dates[hive_id] = insp_date

        existing = self.storage.load_inspections()
        
        existing_keys = set()
        for rec in existing:
            key = f"{rec.get('beehive_id')}|{rec.get('inspection_date')}"
            existing_keys.add(key)
        
        new_records = []
        for rec in valid_records:
            key = f"{rec.get('beehive_id')}|{rec.get('inspection_date')}"
            if key not in existing_keys:
                new_records.append(rec)
            else:
                skipped_rows.append(f"{rec.get('beehive_id')}|{rec.get('inspection_date')}")

        if new_records:
            self.storage.append_inspections(new_records)
            
            for hive_id, latest_date in latest_inspection_dates.items():
                if hive_id in known_hive_ids:
                    self.beehive_manager.update_last_inspection(hive_id, str(latest_date))

        return {
            "success": True,
            "imported": len(new_records),
            "skipped": len(records) - len(new_records),
            "validation": validation,
            "message": f"成功导入 {len(new_records)} 条巡检记录",
        }

    def import_file(self, filepath: str, skip_errors: bool = False) -> Dict[str, Any]:
        records = self.load_from_file(filepath)
        return self.import_records(records, skip_errors=skip_errors)
