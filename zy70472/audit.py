import os
import json
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional
from pathlib import Path
import logging

from config import settings
from models import AuditRecord, BatchItem, BatchResultItem

logger = logging.getLogger(__name__)


class AuditManager:
    def __init__(self):
        self.audit_dir = Path(settings.AUDIT_DIR)
        self.audit_dir.mkdir(parents=True, exist_ok=True)
        self._records: List[Dict[str, Any]] = []
        self._load_from_disk()

    def _get_batch_file(self, batch_id: str) -> Path:
        return self.audit_dir / f"batch_{batch_id}.json"

    def _load_from_disk(self):
        try:
            for file in self.audit_dir.glob("batch_*.json"):
                with open(file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if "records" in data:
                        self._records.extend(data["records"])
        except Exception as e:
            logger.warning(f"加载审计记录失败: {e}")

    def _save_batch_to_disk(self, batch_id: str, data: Dict[str, Any]):
        try:
            file_path = self._get_batch_file(batch_id)
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"保存审计记录失败: {e}", exc_info=True)

    def record_batch(
        self,
        batch_id: str,
        items: List[BatchItem],
        results: Dict[str, Any],
        started_at: datetime,
        completed_at: datetime
    ):
        records = []
        item_map = {item.id: item for item in items}
        
        for result_item in results["items"]:
            item = item_map.get(result_item.id)
            if not item:
                continue
            
            record = {
                "id": str(uuid.uuid4()),
                "batch_id": batch_id,
                "item_id": result_item.id,
                "client_id": item.client_id,
                "status": "success" if result_item.success else "failed",
                "signature": result_item.signature,
                "error_code": result_item.error_code,
                "error_message": result_item.error_message,
                "original_params": item.params,
                "compensated": result_item.compensated,
                "execution_time_ms": result_item.execution_time_ms,
                "created_at": datetime.now().isoformat(),
                "confirmed": False,
                "confirmed_by": None,
                "confirmed_at": None
            }
            records.append(record)
            self._records.append(record)
        
        batch_data = {
            "batch_id": batch_id,
            "started_at": started_at.isoformat(),
            "completed_at": completed_at.isoformat(),
            "total_count": results["total_count"],
            "success_count": results["success_count"],
            "fail_count": results["fail_count"],
            "confirmed": False,
            "confirmed_by": None,
            "confirmed_at": None,
            "records": records
        }
        
        self._save_batch_to_disk(batch_id, batch_data)
        logger.info(f"已记录批次 {batch_id}: {len(records)} 条记录")

    def query(
        self,
        filters: Dict[str, Any],
        page: int = 1,
        page_size: int = 50
    ) -> Dict[str, Any]:
        filtered = self._records
        
        if "status" in filters:
            filtered = [r for r in filtered if r["status"] == filters["status"]]
        if "batch_id" in filters:
            filtered = [r for r in filtered if r["batch_id"] == filters["batch_id"]]
        if "client_id" in filters:
            filtered = [r for r in filtered if r["client_id"] == filters["client_id"]]
        if "failure_reason" in filters:
            filtered = [
                r for r in filtered
                if r.get("error_message") and filters["failure_reason"] in r["error_message"]
            ]
        
        total = len(filtered)
        start = (page - 1) * page_size
        end = start + page_size
        paginated = filtered[start:end]
        
        return {
            "total": total,
            "items": [AuditRecord(**r) for r in paginated]
        }

    def group_by_failure_reason(self, records: List[AuditRecord]) -> Dict[str, List[AuditRecord]]:
        groups = {}
        
        for record in records:
            if record.status != "failed" or not record.error_code:
                continue
            
            error_code = record.error_code
            if error_code not in groups:
                groups[error_code] = []
            groups[error_code].append(record)
        
        return groups

    def get_batch_summary(self, batch_id: str) -> Optional[Dict[str, Any]]:
        file_path = self._get_batch_file(batch_id)
        if not file_path.exists():
            return None
        
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return {
                    "batch_id": data["batch_id"],
                    "started_at": data["started_at"],
                    "completed_at": data["completed_at"],
                    "total_count": data["total_count"],
                    "success_count": data["success_count"],
                    "fail_count": data["fail_count"],
                    "confirmed": data.get("confirmed", False),
                    "confirmed_by": data.get("confirmed_by"),
                    "confirmed_at": data.get("confirmed_at"),
                    "records": [AuditRecord(**r) for r in data.get("records", [])]
                }
        except Exception as e:
            logger.error(f"获取批次摘要失败: {e}", exc_info=True)
            return None

    def mark_confirmed(self, batch_id: str, confirmed_by: str) -> bool:
        file_path = self._get_batch_file(batch_id)
        if not file_path.exists():
            return False
        
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            data["confirmed"] = True
            data["confirmed_by"] = confirmed_by
            data["confirmed_at"] = datetime.now().isoformat()
            
            for record in data.get("records", []):
                record["confirmed"] = True
                record["confirmed_by"] = confirmed_by
                record["confirmed_at"] = data["confirmed_at"]
            
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            
            for record in self._records:
                if record["batch_id"] == batch_id:
                    record["confirmed"] = True
                    record["confirmed_by"] = confirmed_by
                    record["confirmed_at"] = data["confirmed_at"]
            
            logger.info(f"批次 {batch_id} 已由 {confirmed_by} 确认")
            return True
        except Exception as e:
            logger.error(f"标记确认失败: {e}", exc_info=True)
            return False

    def get_failed_records(self, batch_id: Optional[str] = None) -> List[AuditRecord]:
        filters = {"status": "failed"}
        if batch_id:
            filters["batch_id"] = batch_id
        result = self.query(filters, page=1, page_size=10000)
        return result["items"]
