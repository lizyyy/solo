import json
import csv
import os
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Tuple
from .models import (
    DatabaseState, Source, SourceType, Customer, VinylRecord,
    ScratchRecord, ListeningTest, CleaningRecord, CleaningStatus,
    ScratchSeverity, ListeningResult, CleaningStep, generate_id
)


class DataImporter:
    def __init__(self, db_state: DatabaseState):
        self.db = db_state

    def import_file(self, file_path: str, source_type: SourceType,
                    imported_by: str = None) -> Tuple[str, List[str]]:
        file_path = Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")

        source_id = generate_id("src")
        raw_data = self._read_file(file_path)

        source = Source(
            source_id=source_id,
            source_type=source_type,
            file_name=file_path.name,
            imported_by=imported_by,
            raw_data=raw_data
        )
        self.db.sources[source_id] = source

        records = []
        if source_type == SourceType.VINYL_RECORD:
            records = self._import_vinyl_records(raw_data, source_id)
        elif source_type == SourceType.CUSTOMER:
            records = self._import_customers(raw_data, source_id)
        elif source_type == SourceType.CLEANING_RECORD:
            records = self._import_cleaning_records(raw_data, source_id)
        elif source_type == SourceType.SCRATCH:
            records = self._import_scratches(raw_data, source_id)
        elif source_type == SourceType.LISTENING_TEST:
            records = self._import_listening_tests(raw_data, source_id)

        return source_id, records

    def _read_file(self, file_path: Path) -> Dict[str, Any]:
        if file_path.suffix == '.json':
            with open(file_path, 'r', encoding='utf-8') as f:
                return {"records": json.load(f)}
        elif file_path.suffix == '.csv':
            records = []
            with open(file_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    records.append(row)
            return {"records": records}
        else:
            raise ValueError(f"不支持的文件格式: {file_path.suffix}")

    def _import_vinyl_records(self, raw_data: Dict[str, Any],
                              source_id: str) -> List[str]:
        imported = []
        for item in raw_data.get("records", []):
            record_id = item.get("record_id") or generate_id("rec")
            if record_id not in self.db.vinyl_records:
                record = VinylRecord(
                    record_id=record_id,
                    catalog_number=item.get("catalog_number", ""),
                    artist=item.get("artist"),
                    album_title=item.get("album_title"),
                    customer_id=item.get("customer_id"),
                    status=CleaningStatus(item.get("status", "pending")),
                    total_cleanings=int(item.get("total_cleanings", 0)),
                    source_id=source_id
                )
                self.db.vinyl_records[record_id] = record
                imported.append(record_id)
            else:
                pass
        return imported

    def _import_customers(self, raw_data: Dict[str, Any],
                          source_id: str) -> List[str]:
        imported = []
        for item in raw_data.get("records", []):
            customer_id = item.get("customer_id") or generate_id("cust")
            if customer_id not in self.db.customers:
                customer = Customer(
                    customer_id=customer_id,
                    name=item.get("name", ""),
                    phone=item.get("phone"),
                    email=item.get("email"),
                    notes=item.get("notes"),
                    source_id=source_id
                )
                self.db.customers[customer_id] = customer
                imported.append(customer_id)
        return imported

    def _import_cleaning_records(self, raw_data: Dict[str, Any],
                                 source_id: str) -> List[str]:
        imported = []
        for item in raw_data.get("records", []):
            cleaning_id = item.get("cleaning_id") or generate_id("cln")
            record_id = item.get("record_id", "")

            steps = []
            for step_data in item.get("steps", []):
                step = CleaningStep(
                    step_name=step_data.get("step_name", ""),
                    duration_seconds=int(step_data.get("duration_seconds", 0)) if step_data.get("duration_seconds") else None,
                    notes=step_data.get("notes"),
                    completed=step_data.get("completed", False),
                    completed_at=datetime.fromisoformat(step_data["completed_at"]) if step_data.get("completed_at") else None
                )
                steps.append(step)

            record = CleaningRecord(
                cleaning_id=cleaning_id,
                record_id=record_id,
                sequence=int(item.get("sequence", 1)),
                status=CleaningStatus(item.get("status", "pending")),
                cleaning_agent=item.get("cleaning_agent"),
                brush_type=item.get("brush_type"),
                machine=item.get("machine"),
                steps=steps,
                photo_before=item.get("photo_before", []),
                photo_after=item.get("photo_after", []),
                notes=item.get("notes"),
                performed_by=item.get("performed_by"),
                source_id=source_id,
                started_at=datetime.fromisoformat(item["started_at"]) if item.get("started_at") else None,
                completed_at=datetime.fromisoformat(item["completed_at"]) if item.get("completed_at") else None
            )
            self.db.cleaning_records[cleaning_id] = record

            if record_id in self.db.vinyl_records:
                if cleaning_id not in self.db.vinyl_records[record_id].cleaning_records:
                    self.db.vinyl_records[record_id].cleaning_records.append(cleaning_id)
                    self.db.vinyl_records[record_id].updated_at = datetime.now()

            imported.append(cleaning_id)
        return imported

    def _import_scratches(self, raw_data: Dict[str, Any],
                          source_id: str) -> List[str]:
        imported = []
        for item in raw_data.get("records", []):
            scratch_id = item.get("scratch_id") or generate_id("scr")
            record_id = item.get("record_id", "")

            scratch = ScratchRecord(
                scratch_id=scratch_id,
                record_id=record_id,
                location=item.get("location", ""),
                severity=ScratchSeverity(item.get("severity", "moderate")),
                description=item.get("description", ""),
                side=item.get("side"),
                track=item.get("track"),
                photo_ids=item.get("photo_ids", []),
                source_id=source_id,
                recorded_at=datetime.fromisoformat(item["recorded_at"]) if item.get("recorded_at") else datetime.now()
            )
            self.db.scratches[scratch_id] = scratch

            if record_id in self.db.vinyl_records:
                if scratch_id not in self.db.vinyl_records[record_id].scratches:
                    self.db.vinyl_records[record_id].scratches.append(scratch_id)
                    self.db.vinyl_records[record_id].updated_at = datetime.now()

            imported.append(scratch_id)
        return imported

    def _import_listening_tests(self, raw_data: Dict[str, Any],
                                source_id: str) -> List[str]:
        imported = []
        for item in raw_data.get("records", []):
            test_id = item.get("test_id") or generate_id("test")
            record_id = item.get("record_id", "")

            crackle = int(item.get("crackle", 0))
            surface_noise = int(item.get("surface_noise", 0))
            pops = int(item.get("pops", 0))
            distortion = int(item.get("distortion", 0))
            overall_score = (crackle + surface_noise + pops + distortion) / 4.0

            test = ListeningTest(
                test_id=test_id,
                record_id=record_id,
                side=item.get("side", "A"),
                result=ListeningResult(item.get("result", "untested")),
                crackle=crackle,
                surface_noise=surface_noise,
                pops=pops,
                distortion=distortion,
                overall_score=overall_score,
                notes=item.get("notes"),
                tested_by=item.get("tested_by"),
                source_id=source_id,
                tested_at=datetime.fromisoformat(item["tested_at"]) if item.get("tested_at") else datetime.now()
            )
            self.db.listening_tests[test_id] = test

            if record_id in self.db.vinyl_records:
                if test_id not in self.db.vinyl_records[record_id].listening_tests:
                    self.db.vinyl_records[record_id].listening_tests.append(test_id)
                    self.db.vinyl_records[record_id].updated_at = datetime.now()

            imported.append(test_id)
        return imported
