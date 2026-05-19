from datetime import datetime, timedelta
import json
from typing import List, Optional, Dict, Any
from sqlalchemy import create_engine, and_, or_, func
from sqlalchemy.orm import sessionmaker, Session
from contextlib import contextmanager

from models import (
    Base, ParentComplaintDB, GPSRecordDB, DriverCheckinDB,
    DecisionRecordDB, OperationLogDB, SystemConfigDB,
    ParentComplaint, GPSRecord, DriverCheckin,
    ComplaintStatus, GPSStatus
)
from rules import RuleEngine, determine_responsibility
from security import SensitiveDataMasker, setup_logging

def json_serializer(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Object of type {obj.__class__.__name__} is not JSON serializable")

def custom_json_dumps(obj, **kwargs):
    return json.dumps(obj, default=json_serializer, **kwargs)

def make_json_serializable(obj):
    if isinstance(obj, dict):
        return {k: make_json_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [make_json_serializable(item) for item in obj]
    elif isinstance(obj, datetime):
        return obj.isoformat()
    return obj

DATABASE_URL = "sqlite:///./bus_scheduler.db"

engine = create_engine(
    DATABASE_URL, 
    connect_args={"check_same_thread": False},
    json_serializer=custom_json_dumps
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

logger = setup_logging()

def init_db():
    Base.metadata.create_all(bind=engine)
    logger.info("Database initialized")

@contextmanager
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class ComplaintService:
    def __init__(self, db: Session):
        self.db = db
        self.rule_engine = RuleEngine()
        self.masker = SensitiveDataMasker()
    
    def create_complaint(self, complaint_data: ParentComplaint, operator: str = "system") -> ParentComplaintDB:
        if complaint_data.complaint_time is None:
            complaint_data.complaint_time = datetime.utcnow()
        
        db_complaint = ParentComplaintDB(**complaint_data.model_dump())
        self.db.add(db_complaint)
        self.db.commit()
        self.db.refresh(db_complaint)
        
        self._log_operation(
            operator=operator,
            operation="create",
            target_type="complaint",
            target_id=db_complaint.id,
            new_value=complaint_data.model_dump()
        )
        
        logger.info(f"Created complaint {db_complaint.complaint_no}")
        return db_complaint
    
    def get_complaint(self, complaint_id: int, mask_sensitive: bool = True) -> Optional[ParentComplaintDB]:
        complaint = self.db.query(ParentComplaintDB).filter(ParentComplaintDB.id == complaint_id).first()
        if complaint and mask_sensitive:
            return self._mask_complaint(complaint)
        return complaint
    
    def get_complaint_by_no(self, complaint_no: str, mask_sensitive: bool = True) -> Optional[ParentComplaintDB]:
        complaint = self.db.query(ParentComplaintDB).filter(ParentComplaintDB.complaint_no == complaint_no).first()
        if complaint and mask_sensitive:
            return self._mask_complaint(complaint)
        return complaint
    
    def list_complaints(self, status: Optional[str] = None, start_date: Optional[datetime] = None,
                        end_date: Optional[datetime] = None, bus_no: Optional[str] = None,
                        mask_sensitive: bool = True) -> List[ParentComplaintDB]:
        query = self.db.query(ParentComplaintDB)
        
        if status:
            query = query.filter(ParentComplaintDB.status == status)
        if start_date:
            query = query.filter(ParentComplaintDB.complaint_time >= start_date)
        if end_date:
            query = query.filter(ParentComplaintDB.complaint_time <= end_date)
        if bus_no:
            query = query.filter(ParentComplaintDB.bus_no == bus_no)
        
        complaints = query.order_by(ParentComplaintDB.complaint_time.desc()).all()
        
        if mask_sensitive:
            return [self._mask_complaint(c) for c in complaints]
        return complaints
    
    def _mask_complaint(self, complaint: ParentComplaintDB) -> ParentComplaintDB:
        complaint.parent_name = self.masker.mask_name(complaint.parent_name)
        complaint.parent_phone = self.masker.mask_mobile(complaint.parent_phone)
        complaint.student_name = self.masker.mask_name(complaint.student_name)
        return complaint
    
    def add_gps_records(self, bus_no: str, gps_records: List[GPSRecord]) -> int:
        count = 0
        for record in gps_records:
            db_record = GPSRecordDB(**record.model_dump())
            self.db.add(db_record)
            count += 1
        self.db.commit()
        logger.info(f"Added {count} GPS records for bus {bus_no}")
        return count
    
    def add_checkin_records(self, checkin_records: List[DriverCheckin]) -> int:
        count = 0
        for record in checkin_records:
            db_record = DriverCheckinDB(**record.model_dump())
            self.db.add(db_record)
            count += 1
        self.db.commit()
        logger.info(f"Added {count} checkin records")
        return count
    
    def get_gps_for_complaint(self, complaint: ParentComplaintDB) -> List[GPSRecordDB]:
        time_window = timedelta(hours=2)
        return self.db.query(GPSRecordDB).filter(
            and_(
                GPSRecordDB.bus_no == complaint.bus_no,
                GPSRecordDB.record_time >= complaint.scheduled_arrival - time_window,
                GPSRecordDB.record_time <= complaint.actual_arrival + time_window
            )
        ).order_by(GPSRecordDB.record_time).all()
    
    def get_checkins_for_complaint(self, complaint: ParentComplaintDB) -> List[DriverCheckinDB]:
        time_window = timedelta(hours=2)
        return self.db.query(DriverCheckinDB).filter(
            and_(
                DriverCheckinDB.bus_no == complaint.bus_no,
                DriverCheckinDB.checkin_time >= complaint.scheduled_arrival - time_window,
                DriverCheckinDB.checkin_time <= complaint.actual_arrival + time_window
            )
        ).order_by(DriverCheckinDB.checkin_time).all()
    
    def process_complaint(self, complaint_id: int, operator: str = "system") -> Dict[str, Any]:
        complaint = self.get_complaint(complaint_id, mask_sensitive=False)
        if not complaint:
            raise ValueError(f"Complaint {complaint_id} not found")
        
        complaint.status = ComplaintStatus.PROCESSING
        self.db.commit()
        
        gps_records = self.get_gps_for_complaint(complaint)
        checkin_records = self.get_checkins_for_complaint(complaint)
        
        all_complaints = self.list_complaints(
            start_date=complaint.scheduled_arrival - timedelta(hours=2),
            end_date=complaint.scheduled_arrival + timedelta(hours=2),
            mask_sensitive=False
        )
        
        rule_results, is_blocked = self.rule_engine.run_all(
            complaint, gps_records, checkin_records, all_complaints
        )
        
        for result in rule_results:
            db_decision = DecisionRecordDB(
                complaint_id=complaint.id,
                rule_name=result.rule_name,
                rule_result=result.result,
                reason=result.reason,
                evidence=result.evidence,
                is_blocked=result.is_blocked,
                operator=operator,
                operation_time=datetime.utcnow()
            )
            self.db.add(db_decision)
        
        gps_gap_result = next((r for r in rule_results if r.rule_name == "gps_gap_check"), None)
        if gps_gap_result:
            complaint.gps_status = gps_gap_result.evidence.get("status", "unknown")
            complaint.gps_gap_minutes = int(gps_gap_result.evidence.get("max_gap_minutes", 0))
        
        cross_site_result = next((r for r in rule_results if r.rule_name == "cross_site_late_check"), None)
        if cross_site_result:
            complaint.cross_site = cross_site_result.evidence.get("cross_site", False)
            complaint.site_count = cross_site_result.evidence.get("site_count", 1)
        
        responsibility, decision_reason = determine_responsibility(
            complaint, gps_records, checkin_records, rule_results
        )
        complaint.responsibility = responsibility
        complaint.final_decision = decision_reason
        complaint.decided_by = operator
        complaint.decided_at = datetime.utcnow()
        
        if is_blocked:
            complaint.status = ComplaintStatus.PENDING
            status_note = "已拦截，需要人工审核"
        else:
            complaint.status = ComplaintStatus.APPROVED
            status_note = "自动审核通过"
        
        self.db.commit()
        
        self._log_operation(
            operator=operator,
            operation="process",
            target_type="complaint",
            target_id=complaint.id,
            new_value={
                "status": complaint.status,
                "responsibility": responsibility,
                "decision": decision_reason
            }
        )
        
        logger.info(f"Processed complaint {complaint.complaint_no}: {status_note}")
        
        return {
            "complaint_id": complaint.id,
            "complaint_no": complaint.complaint_no,
            "status": complaint.status,
            "is_blocked": is_blocked,
            "responsibility": responsibility,
            "decision_reason": decision_reason,
            "rule_results": [
                {
                    "rule_name": r.rule_name,
                    "result": r.result,
                    "reason": r.reason,
                    "is_blocked": r.is_blocked
                } for r in rule_results
            ]
        }
    
    def merge_complaints(self, target_complaint_id: int, source_complaint_ids: List[int],
                         operator: str = "system") -> Dict[str, Any]:
        target = self.get_complaint(target_complaint_id, mask_sensitive=False)
        if not target:
            raise ValueError(f"Target complaint {target_complaint_id} not found")
        
        merged_count = 0
        merged_details = []
        
        for source_id in source_complaint_ids:
            source = self.get_complaint(source_id, mask_sensitive=False)
            if source and source.status not in ["merged", "rejected"]:
                source.status = ComplaintStatus.MERGED
                source.merged_into = target_complaint_id
                merged_count += 1
                merged_details.append({
                    "complaint_no": source.complaint_no,
                    "parent_name": source.parent_name,
                    "delay_minutes": source.delay_minutes
                })
        
        self.db.commit()
        
        self._log_operation(
            operator=operator,
            operation="merge",
            target_type="complaint",
            target_id=target_complaint_id,
            new_value={
                "merged_count": merged_count,
                "merged_complaints": merged_details
            }
        )
        
        logger.info(f"Merged {merged_count} complaints into {target.complaint_no}")
        
        return {
            "target_complaint_id": target_complaint_id,
            "merged_count": merged_count,
            "merged_complaints": merged_details
        }
    
    def update_complaint_decision(self, complaint_id: int, responsibility: str,
                              final_decision: str, operator: str) -> ParentComplaintDB:
        complaint = self.get_complaint(complaint_id, mask_sensitive=False)
        if not complaint:
            raise ValueError(f"Complaint {complaint_id} not found")
        
        old_values = {
            "responsibility": complaint.responsibility,
            "final_decision": complaint.final_decision,
            "status": complaint.status
        }
        
        complaint.responsibility = responsibility
        complaint.final_decision = final_decision
        complaint.status = ComplaintStatus.APPROVED
        complaint.decided_by = operator
        complaint.decided_at = datetime.utcnow()
        
        self.db.commit()
        
        self._log_operation(
            operator=operator,
            operation="update_decision",
            target_type="complaint",
            target_id=complaint_id,
            old_value=old_values,
            new_value={
                "responsibility": responsibility,
                "final_decision": final_decision,
                "status": ComplaintStatus.APPROVED
            }
        )
        
        logger.info(f"Updated decision for complaint {complaint.complaint_no} by {operator}")
        
        return complaint
    
    def reject_complaint(self, complaint_id: int, reason: str, operator: str) -> ParentComplaintDB:
        complaint = self.get_complaint(complaint_id, mask_sensitive=False)
        if not complaint:
            raise ValueError(f"Complaint {complaint_id} not found")
        
        old_status = complaint.status
        complaint.status = ComplaintStatus.REJECTED
        complaint.final_decision = reason
        complaint.decided_by = operator
        complaint.decided_at = datetime.utcnow()
        
        self.db.commit()
        
        self._log_operation(
            operator=operator,
            operation="reject",
            target_type="complaint",
            target_id=complaint_id,
            old_value={"status": old_status},
            new_value={"status": ComplaintStatus.REJECTED, "reason": reason}
        )
        
        logger.info(f"Rejected complaint {complaint.complaint_no} by {operator}")
        
        return complaint
    
    def get_decision_records(self, complaint_id: int) -> List[DecisionRecordDB]:
        return self.db.query(DecisionRecordDB).filter(
            DecisionRecordDB.complaint_id == complaint_id
        ).order_by(DecisionRecordDB.operation_time).all()
    
    def get_operation_logs(self, target_type: Optional[str] = None,
                            target_id: Optional[int] = None,
                            operator: Optional[str] = None,
                            limit: int = 100) -> List[OperationLogDB]:
        query = self.db.query(OperationLogDB)
        
        if target_type:
            query = query.filter(OperationLogDB.target_type == target_type)
        if target_id:
            query = query.filter(OperationLogDB.target_id == target_id)
        if operator:
            query = query.filter(OperationLogDB.operator == operator)
        
        return query.order_by(OperationLogDB.created_at.desc()).limit(limit).all()
    
    def _log_operation(self, operator: str, operation: str, target_type: str,
                        target_id: int, old_value: Optional[Dict] = None,
                        new_value: Optional[Dict] = None):
        log = OperationLogDB(
            operator=operator,
            operation=operation,
            target_type=target_type,
            target_id=target_id,
            old_value=make_json_serializable(old_value) if old_value else None,
            new_value=make_json_serializable(new_value) if new_value else None,
            created_at=datetime.utcnow()
        )
        self.db.add(log)
        self.db.commit()
    
    def get_statistics(self, start_date: Optional[datetime] = None,
                       end_date: Optional[datetime] = None) -> Dict[str, Any]:
        query = self.db.query(ParentComplaintDB)
        
        if start_date:
            query = query.filter(ParentComplaintDB.complaint_time >= start_date)
        if end_date:
            query = query.filter(ParentComplaintDB.complaint_time <= end_date)
        
        total = query.count()
        
        status_stats = {}
        for status in [ComplaintStatus.PENDING, ComplaintStatus.PROCESSING,
                       ComplaintStatus.MERGED, ComplaintStatus.APPROVED,
                       ComplaintStatus.REJECTED]:
            count = query.filter(ParentComplaintDB.status == status).count()
            status_stats[status] = count
        
        responsibility_stats = {}
        for resp in ["driver", "company", "traffic", "weather", "parent", "unclear"]:
            count = query.filter(ParentComplaintDB.responsibility == resp).count()
            responsibility_stats[resp] = count
        
        avg_delay = query.with_entities(
            func.avg(ParentComplaintDB.delay_minutes)
        ).scalar() or 0
        
        return {
            "total_complaints": total,
            "by_status": status_stats,
            "by_responsibility": responsibility_stats,
            "average_delay_minutes": round(avg_delay, 2)
        }
