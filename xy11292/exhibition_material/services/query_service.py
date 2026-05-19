from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from exhibition_material.storage.repository import (
    AllocationRepository, ReturnRecordRepository, ImportErrorRepository
)
from exhibition_material.models import RecordStatus, AnomalyType

class QueryService:
    def __init__(self, session: Session):
        self.allocation_repo = AllocationRepository(session)
        self.return_repo = ReturnRecordRepository(session)
        self.import_error_repo = ImportErrorRepository(session)
    
    def query_allocations(self, responsible_person: str = None,
                          booth_number: str = None,
                          status: RecordStatus = None,
                          has_anomaly: bool = None,
                          anomaly_type: AnomalyType = None,
                          start_date: datetime = None,
                          end_date: datetime = None,
                          material_id: int = None) -> List[Dict[str, Any]]:
        allocations = self.allocation_repo.filter_allocations(
            responsible_person=responsible_person,
            booth_number=booth_number,
            status=status,
            has_anomaly=has_anomaly,
            anomaly_type=anomaly_type,
            start_date=start_date,
            end_date=end_date,
            material_id=material_id
        )
        return [a.to_dict(include_material=True) for a in allocations]
    
    def query_return_records(self, received_by: str = None,
                             returned_by: str = None,
                             booth_number: str = None,
                             status: RecordStatus = None,
                             has_anomaly: bool = None,
                             anomaly_type: AnomalyType = None,
                             start_date: datetime = None,
                             end_date: datetime = None,
                             allocation_id: int = None,
                             material_id: int = None) -> List[Dict[str, Any]]:
        records = self.return_repo.filter_records(
            received_by=received_by,
            returned_by=returned_by,
            booth_number=booth_number,
            status=status,
            has_anomaly=has_anomaly,
            anomaly_type=anomaly_type,
            start_date=start_date,
            end_date=end_date,
            allocation_id=allocation_id,
            material_id=material_id
        )
        return [r.to_dict(include_allocation=True) for r in records]
    
    def get_all_anomalies(self) -> Dict[str, Any]:
        allocation_anomalies = self.allocation_repo.list_with_anomalies()
        return_anomalies = self.return_repo.list_with_anomalies()
        import_errors = self.import_error_repo.list_unresolved()
        
        return {
            "allocation_anomalies": [a.to_dict() for a in allocation_anomalies],
            "return_anomalies": [r.to_dict() for r in return_anomalies],
            "import_errors": [e.to_dict() for e in import_errors],
            "total_anomalies": len(allocation_anomalies) + len(return_anomalies) + len(import_errors)
        }
    
    def get_person_summary(self, person_name: str) -> Dict[str, Any]:
        responsible_allocations = self.allocation_repo.filter_allocations(
            responsible_person=person_name
        )
        received_records = self.return_repo.filter_records(
            received_by=person_name
        )
        
        return {
            "person_name": person_name,
            "responsible_allocations_count": len(responsible_allocations),
            "received_records_count": len(received_records),
            "allocation_anomalies_count": sum(1 for a in responsible_allocations if a.has_anomaly),
            "return_anomalies_count": sum(1 for r in received_records if r.has_anomaly),
            "responsible_allocations": [a.to_dict() for a in responsible_allocations],
            "received_records": [r.to_dict() for r in received_records]
        }
    
    def get_daily_summary(self, date: datetime) -> Dict[str, Any]:
        start_of_day = date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = date.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        allocations = self.allocation_repo.filter_allocations(
            start_date=start_of_day,
            end_date=end_of_day
        )
        returns = self.return_repo.filter_records(
            start_date=start_of_day,
            end_date=end_of_day
        )
        
        return {
            "date": date.strftime("%Y-%m-%d"),
            "allocations_count": len(allocations),
            "returns_count": len(returns),
            "allocations_quantity": sum(a.quantity for a in allocations),
            "returns_quantity": sum(r.quantity for r in returns),
            "allocations": [a.to_dict() for a in allocations],
            "returns": [r.to_dict() for r in returns]
        }
