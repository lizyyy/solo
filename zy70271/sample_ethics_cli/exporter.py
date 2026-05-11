"""数据导出和报告生成"""
import csv
import json
import os
from datetime import datetime, date, timedelta
from typing import Any, Dict, List

from .database import Database


class DataExporter:
    def __init__(self, db: Database):
        self.db = db

    def export_all(self, output_dir: str = "output") -> Dict[str, str]:
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        files = {}
        
        samples = self.db.get_all_samples()
        files["samples"] = self._write_csv(
            os.path.join(output_dir, f"samples_{timestamp}.csv"),
            samples,
            ["id", "sample_code", "subject_id", "sample_type", "collection_date", 
             "status", "source_file", "source_batch", "created_at", "updated_at"]
        )
        
        approvals = self.db.get_all_approvals()
        files["approvals"] = self._write_csv(
            os.path.join(output_dir, f"ethics_approvals_{timestamp}.csv"),
            approvals,
            ["id", "approval_number", "title", "principal_investigator", 
             "effective_date", "expiry_date", "status", "source_file", 
             "source_batch", "created_at", "updated_at"]
        )
        
        usages = self.db.get_all_usages()
        files["usages"] = self._write_csv(
            os.path.join(output_dir, f"usage_registrations_{timestamp}.csv"),
            usages,
            ["id", "sample_id", "ethics_approval_id", "usage_purpose", 
             "usage_date", "operator", "notes", "status", "source_file", 
             "source_batch", "created_at", "updated_at"]
        )
        
        results = self.db.get_all_results()
        files["results"] = self._write_csv(
            os.path.join(output_dir, f"results_{timestamp}.csv"),
            results,
            ["id", "sample_id", "ethics_approval_id", "result_type", 
             "result_data", "analysis_date", "operator", "notes", "status",
             "source_file", "source_batch", "created_at", "updated_at"]
        )
        
        return files

    def _write_csv(self, file_path: str, data: List[Dict[str, Any]], 
                   fieldnames: List[str]) -> str:
        with open(file_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction='ignore')
            writer.writeheader()
            for row in data:
                writer.writerow(row)
        return file_path

    def _write_json(self, file_path: str, data: List[Dict[str, Any]]) -> str:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)
        return file_path

    def export_batch_summary(self, batch_name: str, output_dir: str = "output") -> str:
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
        
        batch_run = self.db.get_batch_run(batch_name)
        if not batch_run:
            raise ValueError(f"批次不存在: {batch_name}")
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_path = os.path.join(output_dir, f"batch_{batch_name}_summary_{timestamp}.json")
        
        summary = {
            "batch_name": batch_name,
            "run_type": batch_run.get("run_type"),
            "source_file": batch_run.get("source_file"),
            "status": batch_run.get("status"),
            "statistics": {
                "total_rows": batch_run.get("total_rows"),
                "processed_rows": batch_run.get("processed_rows"),
                "skipped_rows": batch_run.get("skipped_rows"),
                "needs_manual_review": batch_run.get("needs_manual_review")
            },
            "started_at": batch_run.get("started_at"),
            "finished_at": batch_run.get("finished_at"),
            "skipped_records": self.db.get_skipped_records(batch_run["id"]),
            "manual_review_records": self.db.get_manual_review_records(batch_run["id"])
        }
        
        self._write_json(file_path, [summary])
        return file_path

    def export_expiring_report(self, days_threshold: int = 30, 
                                output_dir: str = "output") -> Dict[str, str]:
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        files = {}
        
        expiring = self.db.get_samples_with_expiring_ethics(days_threshold)
        if expiring:
            csv_path = os.path.join(output_dir, f"expiring_{days_threshold}days_{timestamp}.csv")
            files["expiring_csv"] = self._write_csv(
                csv_path,
                expiring,
                ["id", "sample_code", "subject_id", "sample_type", "collection_date",
                 "approval_number", "title", "expiry_date"]
            )
            json_path = os.path.join(output_dir, f"expiring_{days_threshold}days_{timestamp}.json")
            files["expiring_json"] = self._write_json(json_path, expiring)
        
        expired = self.db.get_samples_with_expired_ethics()
        if expired:
            csv_path = os.path.join(output_dir, f"expired_{timestamp}.csv")
            files["expired_csv"] = self._write_csv(
                csv_path,
                expired,
                ["id", "sample_code", "subject_id", "sample_type", "collection_date",
                 "approval_number", "title", "expiry_date"]
            )
            json_path = os.path.join(output_dir, f"expired_{timestamp}.json")
            files["expired_json"] = self._write_json(json_path, expired)
        
        return files

    def generate_status_report(self) -> Dict[str, Any]:
        today = date.today()
        
        samples = self.db.get_all_samples()
        approvals = self.db.get_all_approvals()
        usages = self.db.get_all_usages()
        results = self.db.get_all_results()
        
        active_approvals = [a for a in approvals if a.get("status") == "active"]
        expired_approvals = [a for a in approvals if a.get("status") == "expired"]
        
        expiring_soon = []
        for a in approvals:
            expiry_date_str = a.get("expiry_date", "")
            if expiry_date_str:
                try:
                    expiry = datetime.strptime(expiry_date_str, "%Y-%m-%d").date()
                    days_until = (expiry - today).days
                    if 0 <= days_until <= 30:
                        expiring_soon.append(a)
                except ValueError:
                    pass
        
        return {
            "report_date": today.isoformat(),
            "statistics": {
                "total_samples": len(samples),
                "total_approvals": len(approvals),
                "active_approvals": len(active_approvals),
                "expired_approvals": len(expired_approvals),
                "expiring_soon": len(expiring_soon),
                "total_usages": len(usages),
                "total_results": len(results)
            },
            "expiring_approvals": [
                {
                    "approval_number": a.get("approval_number"),
                    "title": a.get("title"),
                    "expiry_date": a.get("expiry_date"),
                    "days_until": (datetime.strptime(a.get("expiry_date", ""), "%Y-%m-%d").date() - today).days
                }
                for a in expiring_soon
            ],
            "expired_approvals": [
                {
                    "approval_number": a.get("approval_number"),
                    "title": a.get("title"),
                    "expiry_date": a.get("expiry_date"),
                    "days_expired": (today - datetime.strptime(a.get("expiry_date", ""), "%Y-%m-%d").date()).days
                }
                for a in expired_approvals
            ]
        }

    def export_status_report(self, output_dir: str = "output") -> Dict[str, str]:
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report = self.generate_status_report()
        
        json_path = os.path.join(output_dir, f"status_report_{timestamp}.json")
        self._write_json(json_path, [report])
        
        files = {"json": json_path}
        
        csv_path = os.path.join(output_dir, f"status_report_{timestamp}.csv")
        with open(csv_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(["项目", "数值"])
            stats = report["statistics"]
            writer.writerow(["报告日期", report["report_date"]])
            writer.writerow(["样本总数", stats["total_samples"]])
            writer.writerow(["伦理批件总数", stats["total_approvals"]])
            writer.writerow(["有效批件", stats["active_approvals"]])
            writer.writerow(["已过期批件", stats["expired_approvals"]])
            writer.writerow(["30天内到期批件", stats["expiring_soon"]])
            writer.writerow(["用途登记数", stats["total_usages"]])
            writer.writerow(["结果记录数", stats["total_results"]])
        
        files["csv"] = csv_path
        
        return files
