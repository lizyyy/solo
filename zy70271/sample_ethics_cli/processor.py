"""数据处理器：解析、验证和处理数据"""
import csv
import json
import os
from typing import Any, Dict, List, Tuple
from datetime import datetime, date

from .database import Database


class DataProcessor:
    def __init__(self, db: Database):
        self.db = db

    def _validate_sample_record(self, record: Dict[str, Any]) -> Tuple[bool, str]:
        sample_code = record.get("sample_code") or record.get("样本编号")
        subject_id = record.get("subject_id") or record.get("受试者ID")
        
        if not sample_code:
            return False, "缺少样本编号"
        if not subject_id:
            return False, "缺少受试者ID"
        return True, ""

    def _validate_ethics_record(self, record: Dict[str, Any]) -> Tuple[bool, str]:
        approval_number = record.get("approval_number") or record.get("伦理批件号")
        expiry_date = record.get("expiry_date") or record.get("到期日期")
        
        if not approval_number:
            return False, "缺少伦理批件号"
        if not expiry_date:
            return False, "缺少到期日期"
        try:
            datetime.strptime(str(expiry_date), "%Y-%m-%d")
        except ValueError:
            return False, f"到期日期格式错误: {expiry_date}，应为 YYYY-MM-DD"
        return True, ""

    def _validate_usage_record(self, record: Dict[str, Any]) -> Tuple[bool, str]:
        sample_code = record.get("sample_code") or record.get("样本编号")
        approval_number = record.get("ethics_approval_number") or record.get("伦理批件号")
        
        if not sample_code:
            return False, "缺少样本编号"
        if not approval_number:
            return False, "缺少伦理批件号"
        return True, ""

    def _validate_result_record(self, record: Dict[str, Any]) -> Tuple[bool, str]:
        sample_code = record.get("sample_code") or record.get("样本编号")
        approval_number = record.get("ethics_approval_number") or record.get("伦理批件号")
        
        if not sample_code:
            return False, "缺少样本编号"
        if not approval_number:
            return False, "缺少伦理批件号"
        return True, ""

    def _parse_csv(self, file_path: str) -> List[Dict[str, Any]]:
        records = []
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                records.append(row)
        return records

    def _parse_json(self, file_path: str) -> List[Dict[str, Any]]:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if isinstance(data, dict):
            return data.get("records", [data])
        return data

    def parse_file(self, file_path: str) -> List[Dict[str, Any]]:
        ext = os.path.splitext(file_path)[1].lower()
        if ext == '.csv':
            return self._parse_csv(file_path)
        elif ext in ['.json', '.jsonl']:
            return self._parse_json(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {ext}，支持 CSV 和 JSON")

    def process_samples(self, file_path: str, batch_name: str) -> Dict[str, Any]:
        records = self.parse_file(file_path)
        total_rows = len(records)
        processed_rows = 0
        skipped_rows = 0
        needs_manual_review = 0
        
        batch_id = self.db.create_batch_run(batch_name, "samples", file_path)
        
        for record in records:
            record["_source_file"] = file_path
            record["_batch_name"] = batch_name
            
            valid, reason = self._validate_sample_record(record)
            if not valid:
                skipped_rows += 1
                self.db.add_skipped_record(batch_id, "sample", record, reason)
                continue
            
            try:
                self.db.insert_sample(record)
                processed_rows += 1
            except Exception as e:
                skipped_rows += 1
                self.db.add_skipped_record(batch_id, "sample", record, f"处理错误: {str(e)}")
        
        self.db.complete_batch_run(batch_id, total_rows, processed_rows, skipped_rows, needs_manual_review)
        
        return {
            "batch_id": batch_id,
            "batch_name": batch_name,
            "total_rows": total_rows,
            "processed_rows": processed_rows,
            "skipped_rows": skipped_rows,
            "needs_manual_review": needs_manual_review,
            "skipped_records": self.db.get_skipped_records(batch_id),
            "manual_review_records": self.db.get_manual_review_records(batch_id)
        }

    def process_ethics(self, file_path: str, batch_name: str) -> Dict[str, Any]:
        records = self.parse_file(file_path)
        total_rows = len(records)
        processed_rows = 0
        skipped_rows = 0
        needs_manual_review = 0
        
        batch_id = self.db.create_batch_run(batch_name, "ethics", file_path)
        
        for record in records:
            record["_source_file"] = file_path
            record["_batch_name"] = batch_name
            
            valid, reason = self._validate_ethics_record(record)
            if not valid:
                skipped_rows += 1
                self.db.add_skipped_record(batch_id, "ethics", record, reason)
                continue
            
            expiry_date = record.get("expiry_date") or record.get("到期日期")
            try:
                expiry = datetime.strptime(str(expiry_date), "%Y-%m-%d").date()
                if expiry < date.today():
                    needs_manual_review += 1
                    self.db.add_manual_review(batch_id, "ethics", "", f"伦理批件已过期: {expiry_date}")
                
                approval_id = self.db.insert_ethics_approval(record)
                
                if needs_manual_review > 0:
                    self.db.add_manual_review(batch_id, "ethics", approval_id, 
                                              f"伦理批件到期检查: {expiry_date}")
                
                processed_rows += 1
            except Exception as e:
                skipped_rows += 1
                self.db.add_skipped_record(batch_id, "ethics", record, f"处理错误: {str(e)}")
        
        self.db.complete_batch_run(batch_id, total_rows, processed_rows, skipped_rows, needs_manual_review)
        
        return {
            "batch_id": batch_id,
            "batch_name": batch_name,
            "total_rows": total_rows,
            "processed_rows": processed_rows,
            "skipped_rows": skipped_rows,
            "needs_manual_review": needs_manual_review,
            "skipped_records": self.db.get_skipped_records(batch_id),
            "manual_review_records": self.db.get_manual_review_records(batch_id)
        }

    def process_usage(self, file_path: str, batch_name: str) -> Dict[str, Any]:
        records = self.parse_file(file_path)
        total_rows = len(records)
        processed_rows = 0
        skipped_rows = 0
        needs_manual_review = 0
        
        batch_id = self.db.create_batch_run(batch_name, "usage", file_path)
        
        for record in records:
            record["_source_file"] = file_path
            record["_batch_name"] = batch_name
            
            valid, reason = self._validate_usage_record(record)
            if not valid:
                skipped_rows += 1
                self.db.add_skipped_record(batch_id, "usage", record, reason)
                continue
            
            sample_code = record.get("sample_code") or record.get("样本编号")
            approval_number = record.get("ethics_approval_number") or record.get("伦理批件号")
            
            sample = self.db.find_sample_by_code(sample_code)
            if not sample:
                skipped_rows += 1
                self.db.add_skipped_record(batch_id, "usage", record, 
                                          f"样本不存在: {sample_code}")
                continue
            
            approval = self.db.find_approval_by_number(approval_number)
            if not approval:
                skipped_rows += 1
                self.db.add_skipped_record(batch_id, "usage", record,
                                          f"伦理批件不存在: {approval_number}")
                continue
            
            try:
                approval_status = approval.get("status", "active")
                if approval_status == "expired":
                    needs_manual_review += 1
                    self.db.add_manual_review(
                        batch_id, "usage", "",
                        f"伦理批件已过期: {approval_number}，到期日期: {approval.get('expiry_date')}"
                    )
                
                self.db.insert_usage_registration(record, sample["id"], approval["id"])
                processed_rows += 1
            except Exception as e:
                skipped_rows += 1
                self.db.add_skipped_record(batch_id, "usage", record, f"处理错误: {str(e)}")
        
        self.db.complete_batch_run(batch_id, total_rows, processed_rows, skipped_rows, needs_manual_review)
        
        return {
            "batch_id": batch_id,
            "batch_name": batch_name,
            "total_rows": total_rows,
            "processed_rows": processed_rows,
            "skipped_rows": skipped_rows,
            "needs_manual_review": needs_manual_review,
            "skipped_records": self.db.get_skipped_records(batch_id),
            "manual_review_records": self.db.get_manual_review_records(batch_id)
        }

    def process_results(self, file_path: str, batch_name: str) -> Dict[str, Any]:
        records = self.parse_file(file_path)
        total_rows = len(records)
        processed_rows = 0
        skipped_rows = 0
        needs_manual_review = 0
        
        batch_id = self.db.create_batch_run(batch_name, "results", file_path)
        
        for record in records:
            record["_source_file"] = file_path
            record["_batch_name"] = batch_name
            
            valid, reason = self._validate_result_record(record)
            if not valid:
                skipped_rows += 1
                self.db.add_skipped_record(batch_id, "results", record, reason)
                continue
            
            sample_code = record.get("sample_code") or record.get("样本编号")
            approval_number = record.get("ethics_approval_number") or record.get("伦理批件号")
            
            sample = self.db.find_sample_by_code(sample_code)
            if not sample:
                skipped_rows += 1
                self.db.add_skipped_record(batch_id, "results", record,
                                          f"样本不存在: {sample_code}")
                continue
            
            approval = self.db.find_approval_by_number(approval_number)
            if not approval:
                skipped_rows += 1
                self.db.add_skipped_record(batch_id, "results", record,
                                          f"伦理批件不存在: {approval_number}")
                continue
            
            try:
                approval_status = approval.get("status", "active")
                if approval_status == "expired":
                    needs_manual_review += 1
                    self.db.add_manual_review(
                        batch_id, "results", "",
                        f"伦理批件已过期: {approval_number}，到期日期: {approval.get('expiry_date')}"
                    )
                
                self.db.insert_result(record, sample["id"], approval["id"])
                processed_rows += 1
            except Exception as e:
                skipped_rows += 1
                self.db.add_skipped_record(batch_id, "results", record, f"处理错误: {str(e)}")
        
        self.db.complete_batch_run(batch_id, total_rows, processed_rows, skipped_rows, needs_manual_review)
        
        return {
            "batch_id": batch_id,
            "batch_name": batch_name,
            "total_rows": total_rows,
            "processed_rows": processed_rows,
            "skipped_rows": skipped_rows,
            "needs_manual_review": needs_manual_review,
            "skipped_records": self.db.get_skipped_records(batch_id),
            "manual_review_records": self.db.get_manual_review_records(batch_id)
        }

    def check_expiring_ethics(self, days_threshold: int = 30) -> List[Dict[str, Any]]:
        return self.db.get_samples_with_expiring_ethics(days_threshold)

    def check_expired_ethics(self) -> List[Dict[str, Any]]:
        return self.db.get_samples_with_expired_ethics()
