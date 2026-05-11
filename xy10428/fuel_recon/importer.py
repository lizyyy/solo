import csv
import json
from datetime import datetime, date
from typing import List, Dict, Any, Optional
from .models import (
    FuelRecord,
    MileageRecord,
    ScheduleRecord,
    Vehicle,
    FuelType,
    ReviewNote,
    ReviewStatus,
)


class DataImporter:
    def __init__(self):
        self.fuel_records: List[FuelRecord] = []
        self.mileage_records: List[MileageRecord] = []
        self.schedule_records: List[ScheduleRecord] = []
        self.vehicles: List[Vehicle] = []
        self.review_notes: List[ReviewNote] = []

    def load_fuel_records_from_csv(self, filepath: str) -> List[FuelRecord]:
        records = []
        with open(filepath, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                record = FuelRecord(
                    id=row["id"],
                    plate_number=row["plate_number"],
                    fuel_time=datetime.strptime(row["fuel_time"], "%Y-%m-%d %H:%M:%S"),
                    fuel_amount=float(row["fuel_amount"]),
                    fuel_liters=float(row["fuel_liters"]),
                    unit_price=float(row["unit_price"]),
                    station_name=row["station_name"],
                    card_number=row["card_number"],
                    odometer=float(row["odometer"]) if row.get("odometer") else None,
                    fuel_type=FuelType(row.get("fuel_type", "汽油")),
                )
                records.append(record)
        self.fuel_records.extend(records)
        return records

    def load_mileage_records_from_csv(self, filepath: str) -> List[MileageRecord]:
        records = []
        with open(filepath, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                record = MileageRecord(
                    id=row["id"],
                    plate_number=row["plate_number"],
                    record_time=datetime.strptime(row["record_time"], "%Y-%m-%d %H:%M:%S"),
                    odometer=float(row["odometer"]),
                    location=row.get("location", ""),
                    operator=row.get("operator", ""),
                )
                records.append(record)
        self.mileage_records.extend(records)
        return records

    def load_schedule_records_from_csv(self, filepath: str) -> List[ScheduleRecord]:
        records = []
        with open(filepath, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                shift_date = datetime.strptime(row["shift_date"], "%Y-%m-%d").date()
                start_dt = datetime.strptime(row["start_time"], "%Y-%m-%d %H:%M:%S")
                end_dt = datetime.strptime(row["end_time"], "%Y-%m-%d %H:%M:%S")
                record = ScheduleRecord(
                    id=row["id"],
                    driver_name=row["driver_name"],
                    plate_number=row["plate_number"],
                    shift_date=shift_date,
                    shift_type=row["shift_type"],
                    start_time=start_dt,
                    end_time=end_dt,
                    route=row.get("route", ""),
                )
                records.append(record)
        self.schedule_records.extend(records)
        return records

    def load_vehicles_from_csv(self, filepath: str) -> List[Vehicle]:
        records = []
        with open(filepath, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                vehicle = Vehicle(
                    plate_number=row["plate_number"],
                    standard_fuel_consumption=float(row["standard_fuel_consumption"]),
                    fuel_type=FuelType(row["fuel_type"]),
                    fuel_tank_capacity=float(row.get("fuel_tank_capacity", 0)),
                    driver_name=row.get("driver_name"),
                )
                records.append(vehicle)
        self.vehicles.extend(records)
        return records

    def load_review_notes_from_json(self, filepath: str) -> List[ReviewNote]:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        notes = []
        for item in data:
            note = ReviewNote(
                id=item["id"],
                fuel_record_id=item["fuel_record_id"],
                reviewer=item["reviewer"],
                review_time=datetime.fromisoformat(item["review_time"]),
                status=ReviewStatus(item["status"]),
                conclusion=item["conclusion"],
                remarks=item.get("remarks", ""),
            )
            notes.append(note)
        self.review_notes.extend(notes)
        return notes

    def save_review_notes_to_json(self, filepath: str, notes: List[ReviewNote] = None):
        notes_to_save = notes if notes is not None else self.review_notes
        data = [
            {
                "id": n.id,
                "fuel_record_id": n.fuel_record_id,
                "reviewer": n.reviewer,
                "review_time": n.review_time.isoformat(),
                "status": n.status.value,
                "conclusion": n.conclusion,
                "remarks": n.remarks,
            }
            for n in notes_to_save
        ]
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def get_vehicle_by_plate(self, plate_number: str) -> Optional[Vehicle]:
        for v in self.vehicles:
            if v.plate_number == plate_number:
                return v
        return None
