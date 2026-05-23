import csv
import json
import hashlib
from io import StringIO
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime
import pandas as pd
from sqlalchemy.orm import Session
from app.models import Batch, Grievance, Flight, PhotoIndex, BatchStatus, GrievanceStatus
from app.schemas import GrievanceCreate


class ImportService:
    @staticmethod
    def generate_file_hash(content: bytes) -> str:
        return hashlib.md5(content).hexdigest()

    @staticmethod
    def _parse_date(date_str: Optional[str]) -> Optional[datetime]:
        if not date_str:
            return None
        for fmt in ['%Y-%m-%d', '%Y-%m-%d %H:%M:%S', '%Y/%m/%d', '%Y%m%d']:
            try:
                return datetime.strptime(str(date_str).strip(), fmt)
            except (ValueError, TypeError):
                continue
        return None

    @staticmethod
    def _create_flight_from_dict(grievance_id: int, flight_dict: Dict[str, Any]) -> Flight:
        return Flight(
            grievance_id=grievance_id,
            flight_no=flight_dict.get("flight_no"),
            flight_date=ImportService._parse_date(flight_dict.get("flight_date")),
            departure=flight_dict.get("departure"),
            arrival=flight_dict.get("arrival"),
            airline=flight_dict.get("airline"),
            is_responsible=flight_dict.get("is_responsible", False)
        )

    @staticmethod
    def _create_photo_from_dict(grievance_id: int, photo_dict: Dict[str, Any]) -> PhotoIndex:
        return PhotoIndex(
            grievance_id=grievance_id,
            photo_path=photo_dict.get("photo_path"),
            photo_hash=photo_dict.get("photo_hash"),
            photo_type=photo_dict.get("photo_type"),
            is_valid=photo_dict.get("is_valid", True),
            ocr_text=photo_dict.get("ocr_text")
        )

    @staticmethod
    def check_duplicate(db: Session, file_hash: str) -> Optional[Batch]:
        return db.query(Batch).filter(Batch.file_hash == file_hash).first()

    @staticmethod
    def check_duplicate_batch(db: Session, file_hash: str) -> Tuple[bool, Optional[Batch]]:
        existing_batch = db.query(Batch).filter(Batch.file_hash == file_hash).first()
        return (existing_batch is not None, existing_batch)

    @staticmethod
    def parse_grievances_csv(content: bytes) -> List[Dict[str, Any]]:
        text = content.decode('utf-8-sig')
        reader = csv.DictReader(StringIO(text))
        return list(reader)

    @staticmethod
    def parse_flights_json(content: bytes) -> Dict[str, Any]:
        data = json.loads(content.decode('utf-8'))
        flight_map = {}
        for item in data:
            flight_no = item.get("flight_no")
            if flight_no:
                flight_map[flight_no] = item
        return flight_map

    @staticmethod
    def parse_photos_json(content: bytes) -> Dict[str, List[Dict[str, Any]]]:
        data = json.loads(content.decode('utf-8'))
        photo_map = {}
        for item in data:
            grievance_no = item.get("grievance_no")
            if grievance_no:
                if grievance_no not in photo_map:
                    photo_map[grievance_no] = []
                photo_map[grievance_no].append(item)
        return photo_map

    @staticmethod
    def import_grievances_csv(db: Session, csv_content: str, file_name: str, file_hash: str) -> Tuple[Batch, List[Dict[str, Any]]]:
        batch_no = f"BATCH{datetime.now().strftime('%Y%m%d%H%M%S')}"
        batch = Batch(
            batch_no=batch_no,
            file_name=file_name,
            file_hash=file_hash,
            status=BatchStatus.PROCESSING,
            total_count=0,
            success_count=0,
            fail_count=0
        )
        db.add(batch)
        db.commit()
        db.refresh(batch)
        
        reader = csv.DictReader(StringIO(csv_content))
        grievance_list = list(reader)
        return batch, grievance_list

    @staticmethod
    def create_batch(db: Session, batch_name: str, file_hash: str) -> Batch:
        batch = Batch(
            batch_name=batch_name,
            file_hash=file_hash,
            status=BatchStatus.PROCESSING,
            total_count=0,
            success_count=0,
            pending_count=0,
            failed_count=0
        )
        db.add(batch)
        db.commit()
        db.refresh(batch)
        return batch

    @staticmethod
    def create_grievance_records(db: Session, batch: Batch, grievance_list: List[Dict[str, Any]], 
                                 flight_map: Dict[str, Any] = None, 
                                 photo_map: Dict[str, List[Dict[str, Any]]] = None) -> List[Grievance]:
        created_grievances = []
        flight_map = flight_map or {}
        photo_map = photo_map or {}
        
        for item in grievance_list:
            grievance = Grievance(
                batch_id=batch.id,
                grievance_no=item.get("grievance_no"),
                passenger_name=item.get("passenger_name"),
                passenger_id=item.get("passenger_id"),
                flight_no=item.get("flight_no"),
                flight_date=ImportService._parse_date(item.get("flight_date")),
                incident_type=item.get("incident_type"),
                incident_desc=item.get("incident_desc"),
                apply_amount=float(item.get("apply_amount", 0) or 0),
                apply_time=ImportService._parse_date(item.get("apply_time")),
                status=GrievanceStatus.PENDING,
                original_data=json.dumps(item, ensure_ascii=False)
            )
            
            db.add(grievance)
            db.flush()
            db.refresh(grievance)
            
            flight_no = item.get("flight_no")
            if flight_no and flight_no in flight_map:
                flight_info = flight_map[flight_no]
                flight = ImportService._create_flight_from_dict(grievance.id, flight_info)
                flight.grievance = grievance
                db.add(flight)
                grievance.is_responsible = flight_info.get("is_responsible", False)
            
            grievance_no = item.get("grievance_no")
            if grievance_no and grievance_no in photo_map:
                photos = photo_map[grievance_no]
                grievance.photo_count = len(photos)
                grievance.has_photo_evidence = len(photos) > 0
                for photo_info in photos:
                    photo = ImportService._create_photo_from_dict(grievance.id, photo_info)
                    photo.grievance = grievance
                    db.add(photo)
            
            db.flush()
            created_grievances.append(grievance)
        
        db.commit()
        return created_grievances

    @staticmethod
    def update_batch_stats(db: Session, batch: Batch) -> None:
        grievances = db.query(Grievance).filter(Grievance.batch_id == batch.id).all()
        batch.total_count = len(grievances)
        batch.success_count = sum(1 for g in grievances if g.status == GrievanceStatus.NORMAL)
        batch.pending_count = sum(1 for g in grievances if g.status == GrievanceStatus.PENDING)
        batch.failed_count = sum(1 for g in grievances if g.status == GrievanceStatus.REJECTED)
        batch.status = BatchStatus.COMPLETED
        db.commit()
