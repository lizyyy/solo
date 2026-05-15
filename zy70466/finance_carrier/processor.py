import pandas as pd
from typing import List, Dict, Optional, Tuple
from datetime import datetime

from .models import FinanceCarrierRecord, ProcessingLog, CandidateItem
from .storage import Storage
from .exceptions import (
    BatchConflictException,
    ValidationException,
    EmptyCandidatesException,
    ProcessorNotFoundException,
)
from .constants import ProcessingStatus, ExitCode


class FinanceProcessor:
    def __init__(self, storage: Optional[Storage] = None):
        self.storage = storage or Storage()

    def validate_record(self, data: Dict) -> None:
        required_fields = ["batch_no", "source_system", "amount", "carrier_date", "account_code"]
        for field in required_fields:
            if field not in data or pd.isna(data[field]) or data[field] == "":
                raise ValidationException(field, "字段必填")
        
        if not isinstance(data.get("amount", 0), (int, float)):
            raise ValidationException("amount", "金额必须是数字")
        
        if data.get("amount", 0) < 0:
            raise ValidationException("amount", "金额不能为负数")

    def check_batch_conflict(self, batch_no: str) -> Optional[Dict]:
        return self.storage.find_record_by_batch(batch_no)

    def process_file(
        self,
        file_path: str,
        processor: str = "system",
        processing_basis: str = "自动处理",
    ) -> Tuple[List[Dict], List[Dict]]:
        df = pd.read_excel(file_path) if file_path.endswith(".xlsx") else pd.read_csv(file_path)
        
        success_results = []
        failed_results = []

        for _, row in df.iterrows():
            row_data = row.to_dict()
            log = ProcessingLog(
                batch_no=str(row_data.get("batch_no", "")),
                source_system=str(row_data.get("source_system", "")),
                processor=processor,
                input_data={k: str(v) for k, v in row_data.items()},
                processing_basis=processing_basis,
                pharmacy_receipt_id=str(row_data.get("pharmacy_receipt_id", "")),
            )

            try:
                self.validate_record(row_data)
                
                existing = self.check_batch_conflict(str(row_data["batch_no"]))
                if existing:
                    raise BatchConflictException(
                        str(row_data["batch_no"]), existing["source_system"]
                    )

                record = FinanceCarrierRecord(
                    batch_no=str(row_data["batch_no"]),
                    source_system=str(row_data["source_system"]),
                    amount=float(row_data["amount"]),
                    carrier_date=str(row_data["carrier_date"]),
                    account_code=str(row_data["account_code"]),
                    description=str(row_data.get("description", "")),
                    processor=processor,
                    pharmacy_receipt_id=str(row_data.get("pharmacy_receipt_id", "")),
                )

                self.storage.save_record(record)
                log.status = ProcessingStatus.SUCCESS
                log.completed_at = datetime.now()
                
                success_results.append({
                    "batch_no": record.batch_no,
                    "status": ProcessingStatus.SUCCESS,
                })

            except Exception as e:
                log.status = ProcessingStatus.FAILED
                log.error_message = str(e)
                log.error_details = getattr(e, "details", {})
                log.completed_at = datetime.now()
                
                failed_results.append({
                    "batch_no": log.batch_no,
                    "status": ProcessingStatus.FAILED,
                    "error": str(e),
                    "error_details": log.error_details,
                })

            self.storage.save_log(log)

        return success_results, failed_results

    def generate_candidates(
        self,
        action: str = "rollback",
        date_cutoff: Optional[str] = None,
    ) -> List[Dict]:
        candidates = self.storage.get_rollback_candidates(date_cutoff)
        
        if not candidates:
            raise EmptyCandidatesException()

        return [c.to_dict() for c in candidates]

    def execute_rollback(self, candidates: List[Dict]) -> Dict:
        if not candidates:
            raise EmptyCandidatesException()

        results = {"success": [], "failed": []}

        for candidate in candidates:
            batch_no = candidate["batch_no"]
            log = ProcessingLog(
                batch_no=batch_no,
                source_system=candidate["source_system"],
                processor="rollback_system",
                input_data={"candidate": candidate},
                processing_basis="回滚操作",
            )

            try:
                deleted = self.storage.delete_record_by_batch(batch_no)
                if deleted:
                    log.status = ProcessingStatus.ROLLBACK
                    results["success"].append({"batch_no": batch_no, "action": "rolled_back"})
                else:
                    log.status = ProcessingStatus.FAILED
                    log.error_message = "记录不存在"
                    results["failed"].append({"batch_no": batch_no, "error": "记录不存在"})
            except Exception as e:
                log.status = ProcessingStatus.FAILED
                log.error_message = str(e)
                results["failed"].append({"batch_no": batch_no, "error": str(e)})

            log.completed_at = datetime.now()
            self.storage.save_log(log)

        return results

    def query_records(
        self,
        status: Optional[str] = None,
        processor: Optional[str] = None,
        batch_no: Optional[str] = None,
    ) -> List[Dict]:
        return self.storage.query_logs(status, processor, batch_no)

    def find_by_processor(self, processor: str) -> List[Dict]:
        logs = self.storage.query_logs(processor=processor)
        
        if not logs:
            raise ProcessorNotFoundException(processor)

        return logs

    def get_pharmacy_receipt_trace(self, pharmacy_receipt_id: str) -> Dict:
        logs = self.storage.get_all_logs()
        matching_logs = [
            log for log in logs 
            if log.get("pharmacy_receipt_id") == pharmacy_receipt_id
        ]

        if not matching_logs:
            return {
                "pharmacy_receipt_id": pharmacy_receipt_id,
                "found": False,
                "message": "未找到该药房配送回执的处理记录",
            }

        latest_log = matching_logs[-1]
        return {
            "pharmacy_receipt_id": pharmacy_receipt_id,
            "found": True,
            "original_input": latest_log.get("input_data", {}),
            "processing_basis": latest_log.get("processing_basis", ""),
            "processor": latest_log.get("processor", ""),
            "status": latest_log.get("status", ""),
            "processing_history": matching_logs,
        }
