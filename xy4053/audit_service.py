from typing import Dict, Any, List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from models import AuditLog, Counselor, Case
import json


class AuditService:
    def __init__(self, db: Session):
        self.db = db
    
    def log_action(self, action: str, action_type: str, 
                  case_id: Optional[int] = None,
                  counselor_id: Optional[int] = None,
                  old_value: Any = None,
                  new_value: Any = None,
                  ip_address: Optional[str] = None,
                  user_agent: Optional[str] = None) -> AuditLog:
        
        audit_log = AuditLog(
            case_id=case_id,
            counselor_id=counselor_id,
            action=action,
            action_type=action_type,
            old_value=json.dumps(old_value, ensure_ascii=False) if old_value else None,
            new_value=json.dumps(new_value, ensure_ascii=False) if new_value else None,
            ip_address=ip_address,
            user_agent=user_agent,
            timestamp=datetime.utcnow()
        )
        
        self.db.add(audit_log)
        self.db.commit()
        self.db.refresh(audit_log)
        
        return audit_log
    
    def get_case_audit_logs(self, case_id: int, limit: int = 100) -> List[AuditLog]:
        return self.db.query(AuditLog).filter(
            AuditLog.case_id == case_id
        ).order_by(AuditLog.timestamp.desc()).limit(limit).all()
    
    def get_counselor_audit_logs(self, counselor_id: int, limit: int = 100) -> List[AuditLog]:
        return self.db.query(AuditLog).filter(
            AuditLog.counselor_id == counselor_id
        ).order_by(AuditLog.timestamp.desc()).limit(limit).all()
    
    def get_audit_logs_by_type(self, action_type: str, limit: int = 100) -> List[AuditLog]:
        return self.db.query(AuditLog).filter(
            AuditLog.action_type == action_type
        ).order_by(AuditLog.timestamp.desc()).limit(limit).all()
    
    def get_all_audit_logs(self, start_date: Optional[datetime] = None,
                           end_date: Optional[datetime] = None,
                           limit: int = 1000) -> List[Dict[str, Any]]:
        query = self.db.query(AuditLog)
        
        if start_date:
            query = query.filter(AuditLog.timestamp >= start_date)
        if end_date:
            query = query.filter(AuditLog.timestamp <= end_date)
        
        logs = query.order_by(AuditLog.timestamp.desc()).limit(limit).all()
        
        result = []
        for log in logs:
            counselor = None
            case = None
            
            if log.counselor_id:
                counselor = self.db.query(Counselor).filter(
                    Counselor.id == log.counselor_id
                ).first()
            
            if log.case_id:
                case = self.db.query(Case).filter(Case.id == log.case_id).first()
            
            result.append({
                "id": log.id,
                "case_id": log.case_id,
                "case_number": case.case_number if case else None,
                "counselor_id": log.counselor_id,
                "counselor_name": counselor.name if counselor else None,
                "action": log.action,
                "action_type": log.action_type,
                "old_value": log.old_value,
                "new_value": log.new_value,
                "ip_address": log.ip_address,
                "user_agent": log.user_agent,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None
            })
        
        return result
    
    def export_audit_package(self, case_id: Optional[int] = None,
                             counselor_id: Optional[int] = None,
                             start_date: Optional[datetime] = None,
                             end_date: Optional[datetime] = None) -> Dict[str, Any]:
        
        logs = self.get_all_audit_logs(start_date, end_date, limit=10000)
        
        if case_id:
            logs = [log for log in logs if log.get("case_id") == case_id]
        
        if counselor_id:
            logs = [log for log in logs if log.get("counselor_id") == counselor_id]
        
        action_types = {}
        for log in logs:
            action_type = log.get("action_type", "unknown")
            if action_type not in action_types:
                action_types[action_type] = 0
            action_types[action_type] += 1
        
        return {
            "export_metadata": {
                "export_time": datetime.utcnow().isoformat(),
                "total_records": len(logs),
                "filter_criteria": {
                    "case_id": case_id,
                    "counselor_id": counselor_id,
                    "start_date": start_date.isoformat() if start_date else None,
                    "end_date": end_date.isoformat() if end_date else None
                }
            },
            "action_summary": action_types,
            "audit_logs": logs
        }


audit_service = AuditService(None)
