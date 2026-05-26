import uuid
import json
from typing import List, Dict, Any, Tuple, Optional
from sqlalchemy.orm import Session
from datetime import datetime
from app.models.models import Batch, ProcessedRecord
from app.services.data_parser import DataParser
from app.services.rules_engine import RulesEngine

class BatchService:
    def __init__(self, db: Session):
        self.db = db
    
    def generate_batch_no(self) -> str:
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        unique_id = str(uuid.uuid4())[:8].upper()
        return f"BATCH{timestamp}{unique_id}"
    
    def check_duplicate_batch(self, file_hash: str) -> Optional[Batch]:
        return self.db.query(Batch).filter(Batch.file_hash == file_hash).first()
    
    def create_batch(self, file_name: str, file_hash: str, data_type: str, source_type: str = "upload") -> Tuple[bool, str, Optional[Batch]]:
        existing_batch = self.check_duplicate_batch(file_hash)
        if existing_batch:
            return False, f"该文件已在批次 {existing_batch.batch_no} 中处理过，请勿重复提交", existing_batch
        
        batch_no = self.generate_batch_no()
        new_batch = Batch(
            batch_no=batch_no,
            file_name=file_name,
            file_hash=file_hash,
            status="processing",
            data_type=data_type,
            source_type=source_type
        )
        self.db.add(new_batch)
        self.db.flush()
        
        return True, batch_no, new_batch
    
    def process_records(self, batch: Batch, records: List[Dict[str, Any]], record_type: str) -> Dict[str, Any]:
        rules_engine = RulesEngine(self.db)
        
        success_items = []
        pending_items = []
        failed_items = []
        
        for record in records:
            if record_type == "registration":
                result = rules_engine.process_registration(record, batch.batch_no)
            elif record_type == "waitlist":
                result = rules_engine.process_waitlist(record, batch.batch_no)
            elif record_type == "checkin":
                result = rules_engine.process_checkin(record, batch.batch_no)
            else:
                result = {
                    "status": "failed",
                    "record_type": record_type,
                    "original_data": record,
                    "error_message": f"未知的记录类型: {record_type}",
                    "suggestion": "请检查数据类型参数"
                }
            
            processed_record = ProcessedRecord(
                batch_id=batch.id,
                record_type=result["record_type"],
                status=result["status"],
                phone=result.get("phone"),
                name=result.get("name"),
                activity_name=result.get("activity_name"),
                activity_session=result.get("activity_session"),
                id_card=result.get("id_card"),
                original_data=json.dumps(result["original_data"], ensure_ascii=False),
                error_message=result.get("error_message"),
                suggestion=result.get("suggestion")
            )
            self.db.add(processed_record)
            
            if result["status"] == "success":
                success_items.append(result)
            elif result["status"] == "pending":
                pending_items.append(result)
            else:
                failed_items.append(result)
        
        batch.total_count = len(records)
        batch.success_count = len(success_items)
        batch.pending_count = len(pending_items)
        batch.failed_count = len(failed_items)
        batch.status = "completed"
        
        self.db.commit()
        
        return {
            "batch_no": batch.batch_no,
            "total_count": batch.total_count,
            "success_count": batch.success_count,
            "pending_count": batch.pending_count,
            "failed_count": batch.failed_count,
            "success_items": success_items,
            "pending_items": pending_items,
            "failed_items": failed_items
        }
    
    def get_batch_info(self, batch_no: str) -> Optional[Batch]:
        return self.db.query(Batch).filter(Batch.batch_no == batch_no).first()
    
    def get_batch_records(self, batch_no: str, status: Optional[str] = None) -> List[ProcessedRecord]:
        batch = self.get_batch_info(batch_no)
        if not batch:
            return []
        
        query = self.db.query(ProcessedRecord).filter(ProcessedRecord.batch_id == batch.id)
        if status:
            query = query.filter(ProcessedRecord.status == status)
        
        return query.all()
    
    def list_batches(self, skip: int = 0, limit: int = 100) -> List[Batch]:
        return self.db.query(Batch).order_by(Batch.upload_time.desc()).offset(skip).limit(limit).all()
