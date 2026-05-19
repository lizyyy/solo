import os
import csv
import json
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from io import StringIO
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import (
    Hazard, HazardStatus, HazardLevel,
    Rectification, Review, ReviewResult,
    ImportRecord, BadRecord
)
from app.schemas.common import mask_sensitive_value


class ExportService:
    def __init__(self, db: Session):
        self.db = db

    def _get_export_file_path(self, filename: str) -> str:
        return os.path.join(settings.EXPORT_DIR, filename)

    def _sanitize_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        result = {}
        for key, value in data.items():
            if isinstance(value, dict):
                result[key] = self._sanitize_data(value)
            elif isinstance(value, list):
                result[key] = [
                    self._sanitize_data(item) if isinstance(item, dict) else item
                    for item in value
                ]
            elif isinstance(value, str):
                result[key] = mask_sensitive_value(value, key)
            else:
                result[key] = value
        return result

    def export_hazards_csv(
        self,
        status: Optional[HazardStatus] = None,
        level: Optional[HazardLevel] = None,
        department: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> str:
        query = self.db.query(Hazard)
        
        if status:
            query = query.filter(Hazard.status == status)
        if level:
            query = query.filter(Hazard.level == level)
        if department:
            query = query.filter(Hazard.department == department)
        if start_date:
            query = query.filter(Hazard.created_at >= start_date)
        if end_date:
            query = query.filter(Hazard.created_at <= end_date)
        
        hazards = query.order_by(Hazard.created_at.desc()).all()
        
        filename = f"hazards_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        file_path = self._get_export_file_path(filename)
        
        fieldnames = [
            'id', 'hazard_code', 'title', 'description', 'location',
            'level', 'status', 'discovered_by', 'discovered_at',
            'department', 'category', 'responsible_person',
            'responsible_phone', 'deadline', 'closed_at',
            'closed_by', 'remarks', 'created_at', 'updated_at'
        ]
        
        with open(file_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for hazard in hazards:
                row = {
                    'id': hazard.id,
                    'hazard_code': hazard.hazard_code,
                    'title': hazard.title,
                    'description': hazard.description or '',
                    'location': hazard.location or '',
                    'level': hazard.level.value,
                    'status': hazard.status.value,
                    'discovered_by': hazard.discovered_by or '',
                    'discovered_at': hazard.discovered_at.isoformat() if hazard.discovered_at else '',
                    'department': hazard.department or '',
                    'category': hazard.category or '',
                    'responsible_person': hazard.responsible_person or '',
                    'responsible_phone': mask_sensitive_value(hazard.responsible_phone or '', 'responsible_phone'),
                    'deadline': hazard.deadline.isoformat() if hazard.deadline else '',
                    'closed_at': hazard.closed_at.isoformat() if hazard.closed_at else '',
                    'closed_by': hazard.closed_by or '',
                    'remarks': hazard.remarks or '',
                    'created_at': hazard.created_at.isoformat(),
                    'updated_at': hazard.updated_at.isoformat()
                }
                writer.writerow(row)
        
        return filename

    def export_hazards_json(self, **filters) -> str:
        query = self.db.query(Hazard)
        
        if filters.get('status'):
            query = query.filter(Hazard.status == filters['status'])
        if filters.get('level'):
            query = query.filter(Hazard.level == filters['level'])
        if filters.get('department'):
            query = query.filter(Hazard.department == filters['department'])
        
        hazards = query.order_by(Hazard.created_at.desc()).all()
        
        filename = f"hazards_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        file_path = self._get_export_file_path(filename)
        
        data = []
        for hazard in hazards:
            hazard_data = {
                'id': hazard.id,
                'hazard_code': hazard.hazard_code,
                'title': hazard.title,
                'description': hazard.description,
                'location': hazard.location,
                'level': hazard.level.value,
                'status': hazard.status.value,
                'discovered_by': hazard.discovered_by,
                'discovered_at': hazard.discovered_at.isoformat() if hazard.discovered_at else None,
                'department': hazard.department,
                'category': hazard.category,
                'responsible_person': hazard.responsible_person,
                'responsible_phone': mask_sensitive_value(hazard.responsible_phone or '', 'responsible_phone'),
                'deadline': hazard.deadline.isoformat() if hazard.deadline else None,
                'closed_at': hazard.closed_at.isoformat() if hazard.closed_at else None,
                'closed_by': hazard.closed_by,
                'created_at': hazard.created_at.isoformat()
            }
            data.append(self._sanitize_data(hazard_data))
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        return filename

    def generate_monthly_report(self, year: int, month: int) -> Dict[str, Any]:
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month + 1, 1)
        
        total_hazards = self.db.query(Hazard).filter(
            Hazard.created_at >= start_date,
            Hazard.created_at < end_date
        ).count()
        
        closed_hazards = self.db.query(Hazard).filter(
            Hazard.closed_at >= start_date,
            Hazard.closed_at < end_date,
            Hazard.status == HazardStatus.CLOSED
        ).count()
        
        by_level = self.db.query(
            Hazard.level,
            Hazard.id
        ).filter(
            Hazard.created_at >= start_date,
            Hazard.created_at < end_date
        ).all()
        
        level_stats = {}
        for level in HazardLevel:
            count = sum(1 for item in by_level if item[0] == level)
            level_stats[level.value] = count
        
        by_status = self.db.query(
            Hazard.status,
            Hazard.id
        ).filter(
            Hazard.created_at >= start_date,
            Hazard.created_at < end_date
        ).all()
        
        status_stats = {}
        for status in HazardStatus:
            count = sum(1 for item in by_status if item[0] == status)
            status_stats[status.value] = count
        
        by_department = self.db.query(
            Hazard.department,
            Hazard.id
        ).filter(
            Hazard.created_at >= start_date,
            Hazard.created_at < end_date,
            Hazard.department.isnot(None)
        ).all()
        
        dept_stats = {}
        for dept, _ in by_department:
            dept_stats[dept] = dept_stats.get(dept, 0) + 1
        
        from sqlalchemy import func
        total_rectification_cost = self.db.query(Rectification).filter(
            Rectification.created_at >= start_date,
            Rectification.created_at < end_date
        ).with_entities(func.sum(Rectification.cost)).scalar() or 0
        
        avg_closure_days = 0
        closed_hazards_list = self.db.query(Hazard).filter(
            Hazard.closed_at >= start_date,
            Hazard.closed_at < end_date,
            Hazard.status == HazardStatus.CLOSED
        ).all()
        
        if closed_hazards_list:
            total_days = sum(
                (h.closed_at - h.created_at).days
                for h in closed_hazards_list
                if h.closed_at and h.created_at
            )
            avg_closure_days = round(total_days / len(closed_hazards_list), 1)
        
        closure_rate = round((closed_hazards / total_hazards * 100), 1) if total_hazards > 0 else 0
        
        report = {
            "report_period": f"{year}年{month}月",
            "generated_at": datetime.now().isoformat(),
            "summary": {
                "total_hazards": total_hazards,
                "closed_hazards": closed_hazards,
                "closure_rate": closure_rate,
                "avg_closure_days": avg_closure_days,
                "total_rectification_cost": total_rectification_cost
            },
            "by_level": level_stats,
            "by_status": status_stats,
            "by_department": dept_stats
        }
        
        return report

    def export_report_to_json(self, report: Dict[str, Any]) -> str:
        filename = f"monthly_report_{report['report_period']}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        file_path = self._get_export_file_path(filename)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        
        return filename

    def export_bad_records_csv(self, import_id: int) -> str:
        bad_records = self.db.query(BadRecord).filter(
            BadRecord.import_record_id == import_id
        ).order_by(BadRecord.row_number).all()
        
        import_record = self.db.query(ImportRecord).filter(
            ImportRecord.id == import_id
        ).first()
        
        filename = f"bad_records_import_{import_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        file_path = self._get_export_file_path(filename)
        
        fieldnames = [
            'row_number', 'original_data', 'error_type',
            'error_message', 'suggested_fix', 'corrected'
        ]
        
        with open(file_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for record in bad_records:
                row = {
                    'row_number': record.row_number,
                    'original_data': json.dumps(record.original_data, ensure_ascii=False),
                    'error_type': record.error_type or '',
                    'error_message': record.error_message or '',
                    'suggested_fix': record.suggested_fix or '',
                    'corrected': record.corrected
                }
                writer.writerow(row)
        
        return filename

    def get_overdue_hazards(self) -> List[Dict[str, Any]]:
        now = datetime.utcnow()
        overdue = self.db.query(Hazard).filter(
            Hazard.deadline < now,
            Hazard.status != HazardStatus.CLOSED
        ).order_by(Hazard.deadline).all()
        
        result = []
        for h in overdue:
            days_overdue = (now - h.deadline).days
            result.append({
                'id': h.id,
                'hazard_code': h.hazard_code,
                'title': h.title,
                'level': h.level.value,
                'status': h.status.value,
                'responsible_person': h.responsible_person,
                'responsible_phone': mask_sensitive_value(h.responsible_phone or '', 'responsible_phone'),
                'deadline': h.deadline.isoformat(),
                'days_overdue': days_overdue
            })
        
        return result

    def get_exported_files(self) -> List[Dict[str, Any]]:
        files = []
        for filename in os.listdir(settings.EXPORT_DIR):
            if filename.startswith('.'):
                continue
            file_path = os.path.join(settings.EXPORT_DIR, filename)
            if os.path.isfile(file_path):
                stat = os.stat(file_path)
                files.append({
                    'filename': filename,
                    'size': stat.st_size,
                    'created_at': datetime.fromtimestamp(stat.st_ctime).isoformat()
                })
        
        return sorted(files, key=lambda x: x['created_at'], reverse=True)


export_service = ExportService
