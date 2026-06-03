from datetime import datetime
from typing import List, Dict, Any, Tuple
from src.models.base import RangefinderRecord, OperationLog
from src.utils.geo import calculate_record_hash


class RangefinderImporter:
    def __init__(self):
        self.imported_hashes: Dict[str, str] = {}
        self.imported_records: Dict[str, RangefinderRecord] = {}

    def import_records(
        self,
        raw_records: List[Dict[str, Any]],
        source_batch: str,
        imported_by: str
    ) -> Tuple[List[RangefinderRecord], List[OperationLog], List[str]]:
        result_records: List[RangefinderRecord] = []
        logs: List[OperationLog] = []
        warnings: List[str] = []

        for idx, raw in enumerate(raw_records):
            record_hash = calculate_record_hash(raw)

            if record_hash in self.imported_hashes:
                duplicate_record = RangefinderRecord(
                    source_batch=source_batch,
                    obstacle_name=raw["obstacle_name"],
                    obstacle_type=raw.get("obstacle_type", "unknown"),
                    distance=raw["distance"],
                    angle=raw["angle"],
                    latitude=raw["latitude"],
                    longitude=raw["longitude"],
                    altitude=raw.get("altitude"),
                    raw_conclusion=raw["raw_conclusion"],
                    confidence=raw.get("confidence", 0.8),
                    imported_by=imported_by,
                    is_duplicate=True,
                    duplicate_of=self.imported_hashes[record_hash],
                    import_hash=record_hash
                )
                result_records.append(duplicate_record)
                warnings.append(
                    f"第{idx+1}条记录疑似重复，与已有记录{self.imported_hashes[record_hash][:8]}...匹配"
                )
                logs.append(OperationLog(
                    operator=imported_by,
                    action="duplicate_import_detected",
                    detail=f"测距仪记录{duplicate_record.record_id[:8]}为重复记录，源为{self.imported_hashes[record_hash][:8]}"
                ))
            else:
                record = RangefinderRecord(
                    source_batch=source_batch,
                    obstacle_name=raw["obstacle_name"],
                    obstacle_type=raw.get("obstacle_type", "unknown"),
                    distance=raw["distance"],
                    angle=raw["angle"],
                    latitude=raw["latitude"],
                    longitude=raw["longitude"],
                    altitude=raw.get("altitude"),
                    raw_conclusion=raw["raw_conclusion"],
                    confidence=raw.get("confidence", 0.8),
                    imported_by=imported_by,
                    is_duplicate=False,
                    import_hash=record_hash
                )
                result_records.append(record)
                self.imported_hashes[record_hash] = record.record_id
                self.imported_records[record.record_id] = record
                logs.append(OperationLog(
                    operator=imported_by,
                    action="rangefinder_record_imported",
                    detail=f"导入测距仪记录{record.record_id[:8]}: {record.obstacle_name}"
                ))

        return result_records, logs, warnings

    def get_record_by_id(self, record_id: str) -> RangefinderRecord:
        return self.imported_records.get(record_id)
