"""换箱记录管理模块"""
from typing import List, Dict, Any, Optional
from datetime import datetime
from beehive_inspector.storage import FileStorage
from beehive_inspector.validator import DataValidator


class SwapManager:
    def __init__(self, storage: FileStorage):
        self.storage = storage

    def list_swaps(self) -> List[Dict[str, Any]]:
        return self.storage.load_swaps()

    def add_swap(self, from_beehive_id: str, to_beehive_id: str, swap_date: str, 
                 reason: str, notes: str = "", operator: str = "") -> Dict[str, Any]:
        swaps = self.storage.load_swaps()
        
        record = {
            "id": len(swaps) + 1,
            "from_beehive_id": from_beehive_id,
            "to_beehive_id": to_beehive_id,
            "swap_date": swap_date,
            "reason": reason,
            "notes": notes,
            "operator": operator,
            "created_at": datetime.now().isoformat(),
        }
        
        swaps.append(record)
        self.storage.save_swaps(swaps)
        return record

    def import_swaps_from_file(self, filepath: str) -> Dict[str, Any]:
        import pandas as pd
        import os
        
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"文件不存在: {filepath}")

        ext = os.path.splitext(filepath)[1].lower()
        if ext == ".csv":
            df = pd.read_csv(filepath, encoding="utf-8")
        elif ext in [".xlsx", ".xls"]:
            df = pd.read_excel(filepath)
        else:
            raise ValueError(f"不支持的文件格式: {ext}")

        df = df.where(pd.notnull(df), None)
        records = df.to_dict("records")
        
        all_errors = []
        all_warnings = []
        
        for idx, record in enumerate(records):
            row_num = idx + 2
            errors, warnings = DataValidator.validate_swap_record(record, row_num)
            all_errors.extend(errors)
            all_warnings.extend(warnings)

        if all_errors:
            return {
                "success": False,
                "imported": 0,
                "error_count": len(all_errors),
                "errors": all_errors,
                "warnings": all_warnings,
            }

        swaps = self.storage.load_swaps()
        start_id = len(swaps) + 1
        
        for idx, record in enumerate(records):
            swap_record = {
                "id": start_id + idx,
                "from_beehive_id": record["from_beehive_id"],
                "to_beehive_id": record["to_beehive_id"],
                "swap_date": record["swap_date"],
                "reason": record["reason"],
                "notes": record.get("notes", ""),
                "operator": record.get("operator", ""),
                "created_at": datetime.now().isoformat(),
            }
            swaps.append(swap_record)

        self.storage.save_swaps(swaps)
        
        return {
            "success": True,
            "imported": len(records),
            "error_count": 0,
            "errors": [],
            "warnings": all_warnings,
        }

    def get_swap_chain(self, beehive_id: str, swaps: Optional[List[Dict[str, Any]]] = None) -> List[Dict[str, Any]]:
        if swaps is None:
            swaps = self.storage.load_swaps()
        
        chain = []
        current_id = beehive_id
        visited = set()
        
        while True:
            related = [s for s in swaps if 
                      s["from_beehive_id"] == current_id or 
                      s["to_beehive_id"] == current_id]
            
            if not related:
                break
            
            related = sorted(related, key=lambda x: x["swap_date"])
            found_new = False
            
            for swap in related:
                swap_key = f"{swap['id']}"
                if swap_key in visited:
                    continue
                
                visited.add(swap_key)
                chain.append(swap)
                
                if swap["from_beehive_id"] == current_id:
                    current_id = swap["to_beehive_id"]
                else:
                    current_id = swap["from_beehive_id"]
                
                found_new = True
                break
            
            if not found_new:
                break
        
        return chain

    def get_swaps_for_beehive(self, beehive_id: str) -> List[Dict[str, Any]]:
        swaps = self.storage.load_swaps()
        return [s for s in swaps if 
                s["from_beehive_id"] == beehive_id or 
                s["to_beehive_id"] == beehive_id]
