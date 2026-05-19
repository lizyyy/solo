import csv
import json
import os
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from .models import (
    get_db, init_db, Room, CleaningRecord, Photo, Complaint,
    ImportRecord, ErrorRecord, OperationHistory
)
from .masker import SensitiveMasker, get_masked_logger

logger = get_masked_logger(__name__)


class DataExporter:
    def __init__(self, db: Optional[Session] = None):
        self.db = db or get_db()
        init_db()

    def get_rooms(self, room_number: str = None, status: str = None) -> List[Dict[str, Any]]:
        query = self.db.query(Room)
        if room_number:
            query = query.filter(Room.room_number.contains(room_number))
        if status:
            query = query.filter(Room.status == status)
        rooms = query.all()
        return SensitiveMasker.mask_model_list(rooms)

    def get_cleaning_records(
        self, 
        room_number: str = None, 
        start_date: str = None, 
        end_date: str = None,
        has_complaint: bool = None
    ) -> List[Dict[str, Any]]:
        query = self.db.query(CleaningRecord)
        
        if room_number:
            query = query.join(Room).filter(Room.room_number.contains(room_number))
        
        if start_date:
            start = datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(CleaningRecord.cleaning_date >= start)
        
        if end_date:
            end = datetime.strptime(end_date, "%Y-%m-%d")
            query = query.filter(CleaningRecord.cleaning_date <= end)
        
        if has_complaint is not None:
            query = query.filter(CleaningRecord.has_complaint == has_complaint)
        
        records = query.order_by(CleaningRecord.cleaning_date.desc()).all()
        return SensitiveMasker.mask_model_list(records)

    def get_photos(self, room_number: str = None, is_approved: bool = None) -> List[Dict[str, Any]]:
        query = self.db.query(Photo)
        
        if room_number:
            query = query.join(Room).filter(Room.room_number.contains(room_number))
        
        if is_approved is not None:
            query = query.filter(Photo.is_approved == is_approved)
        
        photos = query.order_by(Photo.created_at.desc()).all()
        return SensitiveMasker.mask_model_list(photos)

    def get_import_history(self, import_type: str = None) -> List[Dict[str, Any]]:
        query = self.db.query(ImportRecord)
        if import_type:
            query = query.filter(ImportRecord.file_type == import_type)
        records = query.order_by(ImportRecord.imported_at.desc()).all()
        return SensitiveMasker.mask_model_list(records)

    def get_error_records(self, import_id: int = None, is_resolved: bool = None) -> List[Dict[str, Any]]:
        query = self.db.query(ErrorRecord)
        if import_id:
            query = query.filter(ErrorRecord.import_record_id == import_id)
        if is_resolved is not None:
            query = query.filter(ErrorRecord.is_resolved == is_resolved)
        records = query.order_by(ErrorRecord.created_at.desc()).all()
        return SensitiveMasker.mask_model_list(records)

    def get_operation_history(self, operation_type: str = None, limit: int = 100) -> List[Dict[str, Any]]:
        query = self.db.query(OperationHistory)
        if operation_type:
            query = query.filter(OperationHistory.operation_type == operation_type)
        records = query.order_by(OperationHistory.created_at.desc()).limit(limit).all()
        return SensitiveMasker.mask_model_list(records)

    def resolve_error(self, error_id: int) -> bool:
        error = self.db.query(ErrorRecord).filter(ErrorRecord.id == error_id).first()
        if error:
            error.is_resolved = True
            error.resolved_at = datetime.utcnow()
            self.db.commit()
            return True
        return False

    def export_to_csv(self, data: List[Dict[str, Any]], output_path: str, fields: List[str] = None):
        if not data:
            logger.warning("没有数据可导出")
            return False

        if fields:
            fieldnames = fields
        else:
            fieldnames = list(data[0].keys())

        masked_data = [SensitiveMasker.mask_export_row(row) for row in data]

        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

        with open(output_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction='ignore')
            writer.writeheader()
            writer.writerows(masked_data)

        logger.info(f"数据已导出到: {output_path}")
        return True

    def export_to_json(self, data: List[Dict[str, Any]], output_path: str):
        if not data:
            logger.warning("没有数据可导出")
            return False

        masked_data = [SensitiveMasker.mask_export_row(row) for row in data]

        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(masked_data, f, ensure_ascii=False, indent=2, default=str)

        logger.info(f"数据已导出到: {output_path}")
        return True

    def get_statistics(self) -> Dict[str, Any]:
        total_rooms = self.db.query(Room).count()
        total_cleaning = self.db.query(CleaningRecord).count()
        total_photos = self.db.query(Photo).count()
        total_errors = self.db.query(ErrorRecord).filter(ErrorRecord.is_resolved == False).count()
        total_complaints = self.db.query(CleaningRecord).filter(CleaningRecord.has_complaint == True).count()
        total_reworks = self.db.query(CleaningRecord).filter(CleaningRecord.rework_count > 0).count()

        avg_score = None
        records_with_score = self.db.query(CleaningRecord).filter(CleaningRecord.quality_score != None).all()
        if records_with_score:
            avg_score = sum(r.quality_score for r in records_with_score) / len(records_with_score)

        return SensitiveMasker.mask_dict({
            "total_rooms": total_rooms,
            "total_cleaning_records": total_cleaning,
            "total_photos": total_photos,
            "unresolved_errors": total_errors,
            "complaint_count": total_complaints,
            "rework_count": total_reworks,
            "average_quality_score": round(avg_score, 2) if avg_score else None
        })

    def close(self):
        self.db.close()
