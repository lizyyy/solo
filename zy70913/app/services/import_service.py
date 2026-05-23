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
    def generate_batch_no() -> str:
        return "BATCH" + datetime.now().strftime("%Y%m%d%H%M%S")

    @staticmethod
    def parse_csv_content(content: str) -> List[Dict[str, Any]]:
        df = pd.read_csv(StringIO(content))
        return df.to_dict("records")

    @staticmethod
    def parse_json_content(content: str) -> List[Dict[str, Any]]:
        data = json.loads(content)
        if isinstance(data, dict):
            return [data]
        return data

    @staticmethod
    def check_duplicate_batch(db: Session, file_hash: str) -> Tuple[bool, Optional[Batch]]:
        existing = db.query(Batch).filter(Batch.file_hash == file_hash).first()
        return (existing is not None), existing


    @staticmethod
    def build_flight_map(flight_data):
        flight_map = {}
        for item in flight_data:
            flight_no = item.get("flight_no")
            if flight_no:
                flight_map[flight_no] = item
        return flight_map


    @staticmethod
    def _parse_date(date_str):
        if not date_str:
            return None
        try:
            if isinstance(date_str, datetime):
                return date_str
            if " " in date_str:
                return datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
            return datetime.strptime(date_str, "%Y-%m-%d")
        except:
            return None


    @staticmethod
    def build_photo_map(photo_data):
        photo_map = {}
        for item in photo_data:
            grievance_no = item.get("grievance_no")
            if grievance_no:
                if grievance_no not in photo_map:
                    photo_map[grievance_no] = []
                photo_map[grievance_no].append(item)
        return photo_map


    @staticmethod
    def import_grievances_csv(db, csv_content, file_name, file_hash, flight_data=None, photo_data=None):
        grievance_list = ImportService.parse_csv_content(csv_content)
        
        batch = Batch(
            batch_no=ImportService.generate_batch_no(),
            file_name=file_name,
            file_hash=file_hash,
            status=BatchStatus.PROCESSING,
            total_count=len(grievance_list)
        )
        db.add(batch)
        db.commit()
        db.refresh(batch)
        
        return batch, grievance_list


    @staticmethod
    def _create_flight_from_dict(grievance_id, item):
        return Flight(
            grievance_id=grievance_id,
            flight_no=item.get("flight_no"),
            airline=item.get("airline"),
            departure=item.get("departure"),
            arrival=item.get("arrival"),
            is_responsible=item.get("is_responsible", False),
            delay_minutes=item.get("delay_minutes", 0)
        )


    @staticmethod
    def _create_photo_from_dict(grievance_id, item):
        return PhotoIndex(
            grievance_id=grievance_id,
            photo_path=item.get("photo_path"),
            photo_hash=item.get("photo_hash"),
            photo_type=item.get("photo_type"),
            is_valid=True
        )


    @staticmethod
    def create_grievance_records(db, batch, grievance_list, flight_map=None, photo_map=None):
        created_grievances = []
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
                apply_amount=item.get("apply_amount"),
                apply_time=ImportService._parse_date(item.get("apply_time")),
                status=GrievanceStatus.PENDING
            )
            db.add(grievance)
            db.flush()
            db.refresh(grievance)
            created_grievances.append(grievance)
        db.commit()
        return created_grievances
