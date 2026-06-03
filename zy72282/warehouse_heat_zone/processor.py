import json
import os
from datetime import datetime
from typing import List, Dict, Optional
from .models import (
    CoordinateOrigin,
    Shelf,
    HeatZone,
    InspectionRecord,
    AlertLabel,
    PhotoRecord,
    SafetyReport,
    RecordStatus,
    AlertSeverity,
)


class HeatZoneProcessor:
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = data_dir
        self.origins: Dict[str, CoordinateOrigin] = {}
        self.shelves: Dict[str, Shelf] = {}
        self.records: Dict[str, InspectionRecord] = {}
        self.current_batch_id = ""
        self._ensure_directories()
        self._load_existing_data()

    def _load_existing_data(self):
        self._load_origins()
        self._load_shelves()
        self._load_records()

    def _load_origins(self):
        origins_dir = f"{self.data_dir}/origins"
        if os.path.exists(origins_dir):
            for filename in os.listdir(origins_dir):
                if filename.endswith(".json"):
                    with open(f"{origins_dir}/{filename}", "r", encoding="utf-8") as f:
                        data = json.load(f)
                    origin = CoordinateOrigin(**data)
                    self.origins[origin.origin_id] = origin

    def _load_shelves(self):
        shelves_dir = f"{self.data_dir}/shelves"
        if os.path.exists(shelves_dir):
            for filename in os.listdir(shelves_dir):
                if filename.endswith(".json"):
                    with open(f"{shelves_dir}/{filename}", "r", encoding="utf-8") as f:
                        data = json.load(f)
                    shelf = Shelf(**data)
                    self.shelves[shelf.shelf_id] = shelf

    def _load_records(self):
        records_dir = f"{self.data_dir}/records"
        if os.path.exists(records_dir):
            for filename in os.listdir(records_dir):
                if filename.endswith(".json"):
                    with open(f"{records_dir}/{filename}", "r", encoding="utf-8") as f:
                        data = json.load(f)
                    data["status"] = RecordStatus(data["status"])
                    data["heat_zones"] = [HeatZone(**z) for z in data["heat_zones"]]
                    record = InspectionRecord(**data)
                    self.records[record.record_id] = record

    def _ensure_directories(self):
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(f"{self.data_dir}/origins", exist_ok=True)
        os.makedirs(f"{self.data_dir}/shelves", exist_ok=True)
        os.makedirs(f"{self.data_dir}/records", exist_ok=True)
        os.makedirs(f"{self.data_dir}/reports", exist_ok=True)

    def import_coordinate_origin(self, origin: CoordinateOrigin) -> str:
        self.origins[origin.origin_id] = origin
        self._save_origin(origin)
        return origin.origin_id

    def import_coordinate_origin_from_file(self, file_path: str) -> str:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        origin = CoordinateOrigin(**data)
        return self.import_coordinate_origin(origin)

    def add_shelf(self, shelf: Shelf):
        self.shelves[shelf.shelf_id] = shelf
        self._save_shelf(shelf)

    def create_new_batch(self, batch_id: str):
        self.current_batch_id = batch_id

    def detect_blocked_labels(self, photo: PhotoRecord) -> List[AlertLabel]:
        blocked_labels = []
        if photo.is_mobile_screenshot and photo.screenshot_bbox:
            sx, sy, sw, sh = photo.screenshot_bbox
            for label in photo.labels:
                if self._check_overlap(
                    (label.position_x, label.position_y, label.width, label.height),
                    (sx, sy, sw, sh),
                ):
                    label.is_blocked = True
                    label.blocked_by = "mobile_screenshot"
                    blocked_labels.append(label)
        return blocked_labels

    def _check_overlap(self, rect1: tuple, rect2: tuple) -> bool:
        x1, y1, w1, h1 = rect1
        x2, y2, w2, h2 = rect2
        return not (x1 + w1 < x2 or x2 + w2 < x1 or y1 + h1 < y2 or y2 + h2 < y1)

    def calculate_heat_zones(
        self, shelf: Shelf, origin: CoordinateOrigin
    ) -> List[HeatZone]:
        zones = []
        load_ratio = shelf.current_load / shelf.max_load

        if load_ratio > 0.9:
            severity = AlertSeverity.CRITICAL
            safe_distance = 2.5
        elif load_ratio > 0.7:
            severity = AlertSeverity.HIGH
            safe_distance = 1.8
        elif load_ratio > 0.5:
            severity = AlertSeverity.MEDIUM
            safe_distance = 1.2
        else:
            severity = AlertSeverity.LOW
            safe_distance = 0.8

        center_x = origin.x + shelf.location_x
        center_y = origin.y + shelf.location_y

        zones.append(
            HeatZone(
                zone_id=f"zone_{shelf.shelf_id}",
                shelf_id=shelf.shelf_id,
                center_x=center_x,
                center_y=center_y,
                radius=safe_distance,
                load_ratio=load_ratio,
                severity=severity,
                safe_distance=safe_distance,
            )
        )
        return zones

    def process_record(
        self,
        shelf_code: str,
        origin_id: str,
        photo: Optional[PhotoRecord] = None,
        photo_number: Optional[str] = None,
        is_rerun: bool = False,
    ) -> InspectionRecord:
        record_id = f"rec_{shelf_code}_{datetime.now().strftime('%Y%m%d%H%M%S')}"

        shelf = next(
            (s for s in self.shelves.values() if s.code == shelf_code), None
        )
        origin = self.origins.get(origin_id)

        if not shelf or not origin:
            raise ValueError(f"Shelf {shelf_code} or origin {origin_id} not found")

        record = InspectionRecord(
            record_id=record_id,
            batch_id=self.current_batch_id,
            shelf_code=shelf_code,
            origin_id=origin_id,
            photo_number=photo_number,
            run_count=1,
        )

        if photo:
            record.photos.append(photo)
            blocked_labels = self.detect_blocked_labels(photo)
            if blocked_labels:
                record.status = RecordStatus.NEED_REVIEW
            else:
                record.status = RecordStatus.NORMAL
        elif photo_number:
            record.status = RecordStatus.NORMAL

        record.heat_zones = self.calculate_heat_zones(shelf, origin)
        record.updated_at = datetime.now()

        self.records[record_id] = record
        self._save_record(record)

        return record

    def supplement_photo_number(
        self, record_id: str, photo_number: str, old_calibration: bool = False
    ) -> InspectionRecord:
        record = self.records.get(record_id)
        if not record:
            raise ValueError(f"Record {record_id} not found")

        record.photo_number = photo_number
        record.updated_at = datetime.now()

        if old_calibration:
            record.status = RecordStatus.OLD_CALIBRATION
            record.old_calibration_data = {
                "photo_number": photo_number,
                "source": "historical_calibration",
            }
        else:
            record.status = RecordStatus.COMPLETED

        self._save_record(record)
        return record

    def manual_correct(
        self, record_id: str, new_status: RecordStatus, note: str
    ) -> InspectionRecord:
        record = self.records.get(record_id)
        if not record:
            raise ValueError(f"Record {record_id} not found")

        record.status = new_status
        record.is_manual_correction = True
        record.correction_note = note
        record.updated_at = datetime.now()

        self._save_record(record)
        return record

    def rerun_record(self, record_id: str) -> InspectionRecord:
        record = self.records.get(record_id)
        if not record:
            raise ValueError(f"Record {record_id} not found")

        record.run_count += 1
        record.updated_at = datetime.now()

        shelf = next(
            (s for s in self.shelves.values() if s.code == record.shelf_code), None
        )
        origin = self.origins.get(record.origin_id)

        if shelf and origin:
            record.heat_zones = self.calculate_heat_zones(shelf, origin)

        self._save_record(record)
        return record

    def generate_safety_report(self, batch_id: str) -> SafetyReport:
        batch_records = [
            r for r in self.records.values() if r.batch_id == batch_id
        ]

        report = SafetyReport(
            report_id=f"report_{batch_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            batch_id=batch_id,
            total_records=len(batch_records),
            records=batch_records,
        )

        safe_distances = []
        for record in batch_records:
            if record.status == RecordStatus.NORMAL:
                report.normal_count += 1
            elif record.status == RecordStatus.NEED_REVIEW:
                report.need_review_count += 1
            elif record.status == RecordStatus.BLOCKED:
                report.blocked_count += 1
            elif record.status == RecordStatus.OLD_CALIBRATION:
                report.old_calibration_count += 1

            for zone in record.heat_zones:
                safe_distances.append(zone.safe_distance)

        if safe_distances:
            report.min_safe_distance = min(safe_distances)
            report.avg_safe_distance = sum(safe_distances) / len(safe_distances)
            report.max_safe_distance = max(safe_distances)

        self._save_report(report)
        return report

    def _save_origin(self, origin: CoordinateOrigin):
        with open(
            f"{self.data_dir}/origins/{origin.origin_id}.json",
            "w",
            encoding="utf-8",
        ) as f:
            json.dump(origin.__dict__, f, ensure_ascii=False, default=str, indent=2)

    def _save_shelf(self, shelf: Shelf):
        with open(
            f"{self.data_dir}/shelves/{shelf.shelf_id}.json",
            "w",
            encoding="utf-8",
        ) as f:
            json.dump(shelf.__dict__, f, ensure_ascii=False, default=str, indent=2)

    def _save_record(self, record: InspectionRecord):
        with open(
            f"{self.data_dir}/records/{record.record_id}.json",
            "w",
            encoding="utf-8",
        ) as f:
            json.dump(self._record_to_dict(record), f, ensure_ascii=False, default=str, indent=2)

    def _save_report(self, report: SafetyReport):
        report_dict = {
            "report_id": report.report_id,
            "batch_id": report.batch_id,
            "generated_at": str(report.generated_at),
            "total_records": report.total_records,
            "normal_count": report.normal_count,
            "blocked_count": report.blocked_count,
            "need_review_count": report.need_review_count,
            "old_calibration_count": report.old_calibration_count,
            "min_safe_distance": report.min_safe_distance,
            "avg_safe_distance": report.avg_safe_distance,
            "max_safe_distance": report.max_safe_distance,
            "records": [self._record_to_dict(r) for r in report.records],
        }
        with open(
            f"{self.data_dir}/reports/{report.report_id}.json",
            "w",
            encoding="utf-8",
        ) as f:
            json.dump(report_dict, f, ensure_ascii=False, default=str, indent=2)

    def _record_to_dict(self, record: InspectionRecord) -> dict:
        return {
            "record_id": record.record_id,
            "batch_id": record.batch_id,
            "shelf_code": record.shelf_code,
            "origin_id": record.origin_id,
            "photo_number": record.photo_number,
            "status": record.status.value,
            "heat_zones": [z.__dict__ for z in record.heat_zones],
            "photos": [p.__dict__ for p in record.photos],
            "is_manual_correction": record.is_manual_correction,
            "correction_note": record.correction_note,
            "created_at": str(record.created_at),
            "updated_at": str(record.updated_at),
            "run_count": record.run_count,
            "old_calibration_data": record.old_calibration_data,
        }

    def get_record(self, record_id: str) -> Optional[InspectionRecord]:
        return self.records.get(record_id)

    def get_all_records(self) -> List[InspectionRecord]:
        return list(self.records.values())
