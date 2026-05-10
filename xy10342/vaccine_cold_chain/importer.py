import csv
import json
from datetime import datetime
from typing import List, Tuple
from .database import (
    TemperatureLog, DoorEvent, VaccineBatch, VaccinationRecord,
    insert_temperature_log, insert_door_event, insert_vaccine_batch, 
    insert_vaccination_record
)


def now_str() -> str:
    return datetime.now().isoformat()


def import_temperature_logs_from_csv(file_path: str) -> Tuple[int, int]:
    inserted = 0
    duplicates = 0
    
    with open(file_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            log = TemperatureLog(
                id=None,
                device_id=row['device_id'].strip(),
                timestamp=row['timestamp'].strip(),
                temperature=float(row['temperature']),
                created_at=now_str()
            )
            if insert_temperature_log(log):
                inserted += 1
            else:
                duplicates += 1
    
    return inserted, duplicates


def import_door_events_from_csv(file_path: str) -> Tuple[int, int]:
    inserted = 0
    duplicates = 0
    
    with open(file_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            duration = int(row['duration_seconds']) if row.get('duration_seconds') and row['duration_seconds'].strip() else None
            event = DoorEvent(
                id=None,
                device_id=row['device_id'].strip(),
                timestamp=row['timestamp'].strip(),
                event_type=row['event_type'].strip(),
                duration_seconds=duration,
                created_at=now_str()
            )
            if insert_door_event(event):
                inserted += 1
            else:
                duplicates += 1
    
    return inserted, duplicates


def import_vaccine_batches_from_csv(file_path: str) -> Tuple[int, int]:
    inserted = 0
    duplicates = 0
    
    with open(file_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            batch = VaccineBatch(
                id=None,
                batch_number=row['batch_number'].strip(),
                vaccine_name=row['vaccine_name'].strip(),
                manufacturer=row['manufacturer'].strip(),
                storage_min_temp=float(row['storage_min_temp']),
                storage_max_temp=float(row['storage_max_temp']),
                receive_time=row['receive_time'].strip(),
                expiry_date=row['expiry_date'].strip(),
                created_at=now_str()
            )
            if insert_vaccine_batch(batch):
                inserted += 1
            else:
                duplicates += 1
    
    return inserted, duplicates


def import_vaccination_records_from_csv(file_path: str) -> Tuple[int, int]:
    inserted = 0
    duplicates = 0
    
    with open(file_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            record = VaccinationRecord(
                id=None,
                vaccination_id=row['vaccination_id'].strip(),
                patient_name=row['patient_name'].strip(),
                patient_phone=row['patient_phone'].strip(),
                batch_number=row['batch_number'].strip(),
                vaccination_time=row['vaccination_time'].strip(),
                created_at=now_str()
            )
            if insert_vaccination_record(record):
                inserted += 1
            else:
                duplicates += 1
    
    return inserted, duplicates


def import_temperature_logs_from_json(file_path: str) -> Tuple[int, int]:
    inserted = 0
    duplicates = 0
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        for item in data:
            log = TemperatureLog(
                id=None,
                device_id=item['device_id'].strip(),
                timestamp=item['timestamp'].strip(),
                temperature=float(item['temperature']),
                created_at=now_str()
            )
            if insert_temperature_log(log):
                inserted += 1
            else:
                duplicates += 1
    
    return inserted, duplicates


def import_door_events_from_json(file_path: str) -> Tuple[int, int]:
    inserted = 0
    duplicates = 0
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        for item in data:
            duration = int(item['duration_seconds']) if item.get('duration_seconds') else None
            event = DoorEvent(
                id=None,
                device_id=item['device_id'].strip(),
                timestamp=item['timestamp'].strip(),
                event_type=item['event_type'].strip(),
                duration_seconds=duration,
                created_at=now_str()
            )
            if insert_door_event(event):
                inserted += 1
            else:
                duplicates += 1
    
    return inserted, duplicates


def import_vaccine_batches_from_json(file_path: str) -> Tuple[int, int]:
    inserted = 0
    duplicates = 0
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        for item in data:
            batch = VaccineBatch(
                id=None,
                batch_number=item['batch_number'].strip(),
                vaccine_name=item['vaccine_name'].strip(),
                manufacturer=item['manufacturer'].strip(),
                storage_min_temp=float(item['storage_min_temp']),
                storage_max_temp=float(item['storage_max_temp']),
                receive_time=item['receive_time'].strip(),
                expiry_date=item['expiry_date'].strip(),
                created_at=now_str()
            )
            if insert_vaccine_batch(batch):
                inserted += 1
            else:
                duplicates += 1
    
    return inserted, duplicates


def import_vaccination_records_from_json(file_path: str) -> Tuple[int, int]:
    inserted = 0
    duplicates = 0
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        for item in data:
            record = VaccinationRecord(
                id=None,
                vaccination_id=item['vaccination_id'].strip(),
                patient_name=item['patient_name'].strip(),
                patient_phone=item['patient_phone'].strip(),
                batch_number=item['batch_number'].strip(),
                vaccination_time=item['vaccination_time'].strip(),
                created_at=now_str()
            )
            if insert_vaccination_record(record):
                inserted += 1
            else:
                duplicates += 1
    
    return inserted, duplicates
