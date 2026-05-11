"""结果导出器"""

import json
import csv
import os
from dataclasses import asdict
from typing import List, Dict, Any

from .models import ExportResult
from .storage import Storage


class Exporter:
    """结果导出器"""
    
    def __init__(self, storage: Storage):
        self.storage = storage
    
    def export(self, export_type: str, output_path: str) -> ExportResult:
        ext = os.path.splitext(output_path)[1].lower()
        
        try:
            if export_type == "results":
                data = self._get_results_data()
            elif export_type == "problems":
                data = self._get_problems_data()
            elif export_type == "all":
                data = {
                    "results": self._get_results_data(),
                    "problems": self._get_problems_data(),
                    "batches": self._get_batches_data(),
                    "receipts": self._get_receipts_data(),
                }
            else:
                return ExportResult(
                    success=False,
                    record_count=0,
                    error=f"未知的导出类型: {export_type}"
                )
            
            if ext == ".json":
                self._export_json(data, output_path)
            elif ext == ".csv":
                self._export_csv(data, output_path, export_type)
            else:
                return ExportResult(
                    success=False,
                    record_count=0,
                    error=f"不支持的导出格式: {ext}"
                )
            
            record_count = self._count_records(data)
            
            self.storage.add_history(
                "export",
                True,
                f"导出 {export_type} 到 {output_path}, 共 {record_count} 条记录"
            )
            
            return ExportResult(
                success=True,
                record_count=record_count
            )
        except Exception as e:
            return ExportResult(
                success=False,
                record_count=0,
                error=str(e)
            )
    
    def _get_results_data(self) -> List[Dict[str, Any]]:
        results = self.storage.get_check_results()
        return results
    
    def _get_problems_data(self) -> List[Dict[str, Any]]:
        problems = self.storage.get_import_problems(limit=1000)
        return [{
            "line_number": p.line_number,
            "source": p.source,
            "message": p.message,
            "details": p.details or ""
        } for p in problems]
    
    def _get_batches_data(self) -> List[Dict[str, Any]]:
        batches = self.storage.get_all_batches()
        return [{
            "batch_id": b.batch_id,
            "case_id": b.case_id,
            "from_stage": b.from_stage.value,
            "to_stage": b.to_stage.value,
            "total_pages": b.total_pages,
            "dossier_count": b.dossier_count,
            "transfer_date": b.transfer_date,
            "transfer_person": b.transfer_person,
            "status": b.status.value,
            "notes": b.notes or ""
        } for b in batches]
    
    def _get_receipts_data(self) -> List[Dict[str, Any]]:
        receipts = self.storage.get_all_receipts()
        return [{
            "receipt_id": r.receipt_id,
            "batch_id": r.batch_id,
            "case_id": r.case_id,
            "receipt_date": r.receipt_date,
            "receipt_person": r.receipt_person,
            "received_page_count": r.received_page_count or "",
            "missing_pages": r.missing_pages or "",
            "extra_pages": r.extra_pages or "",
            "status": r.status.value,
            "return_reason": r.return_reason.value if r.return_reason else "",
            "return_notes": r.return_notes or ""
        } for r in receipts]
    
    def _export_json(self, data: Any, output_path: str):
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def _export_csv(self, data: Any, output_path: str, export_type: str):
        if export_type == "all":
            base_path = os.path.splitext(output_path)[0]
            
            if "results" in data and data["results"]:
                self._write_csv(data["results"], f"{base_path}_results.csv")
            if "problems" in data and data["problems"]:
                self._write_csv(data["problems"], f"{base_path}_problems.csv")
            if "batches" in data and data["batches"]:
                self._write_csv(data["batches"], f"{base_path}_batches.csv")
            if "receipts" in data and data["receipts"]:
                self._write_csv(data["receipts"], f"{base_path}_receipts.csv")
        else:
            if isinstance(data, list) and data:
                self._write_csv(data, output_path)
            else:
                raise ValueError("没有数据可导出")
    
    def _write_csv(self, rows: List[Dict[str, Any]], output_path: str):
        if not rows:
            return
        
        all_keys = set()
        for row in rows:
            all_keys.update(row.keys())
        
        with open(output_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=sorted(all_keys))
            writer.writeheader()
            for row in rows:
                writer.writerow(row)
    
    def _count_records(self, data: Any) -> int:
        if isinstance(data, list):
            return len(data)
        elif isinstance(data, dict):
            count = 0
            for v in data.values():
                if isinstance(v, list):
                    count += len(v)
            return count
        return 0
