from typing import List, Dict, Set
from collections import defaultdict
from datetime import datetime
from .models import (
    DatabaseState, Conflict, ConflictType, VinylRecord,
    Source, CleaningStatus, generate_id
)


class ConflictDetector:
    def __init__(self, db_state: DatabaseState):
        self.db = db_state

    def detect_all(self) -> List[Conflict]:
        conflicts = []
        conflicts.extend(self.detect_duplicate_record_ids())
        conflicts.extend(self.detect_duplicate_catalog_numbers())
        conflicts.extend(self.detect_scratch_overlaps())
        conflicts.extend(self.detect_missing_listening_tests())
        conflicts.extend(self.detect_missing_customers())
        return conflicts

    def detect_duplicate_record_ids(self) -> List[Conflict]:
        conflicts = []
        record_id_sources: Dict[str, List[str]] = defaultdict(list)

        for source_id, source in self.db.sources.items():
            if source.source_type.value == "vinyl_record":
                for record in source.raw_data.get("records", []):
                    rid = record.get("record_id")
                    if rid:
                        record_id_sources[rid].append(source_id)

        for rid, source_ids in record_id_sources.items():
            if len(source_ids) > 1 and rid in self.db.vinyl_records:
                source_files = [self.db.sources[sid].file_name for sid in source_ids]
                conflict = Conflict(
                    conflict_id=generate_id("conf"),
                    conflict_type=ConflictType.DUPLICATE_RECORD_ID,
                    record_id=rid,
                    source_ids=source_ids,
                    message=f"唱片编号 {rid} 出现重复，涉及 {len(source_ids)} 个来源文件",
                    details={
                        "duplicate_id": rid,
                        "source_files": source_files,
                        "source_ids": source_ids,
                        "next_step": "请确认哪个是正确的原始记录，保留一个，其余标记为重复或合并数据",
                        "catalog_number": self.db.vinyl_records[rid].catalog_number
                    }
                )
                conflicts.append(conflict)
                self.db.conflicts.append(conflict)

        return conflicts

    def detect_duplicate_catalog_numbers(self) -> List[Conflict]:
        conflicts = []
        catalog_records: Dict[str, List[str]] = defaultdict(list)

        for rid, record in self.db.vinyl_records.items():
            if record.catalog_number:
                catalog_records[record.catalog_number].append(rid)

        for catalog, rids in catalog_records.items():
            if len(rids) > 1:
                source_ids = []
                for rid in rids:
                    src_id = self.db.vinyl_records[rid].source_id
                    if src_id not in source_ids:
                        source_ids.append(src_id)

                source_files = [self.db.sources[sid].file_name for sid in source_ids]
                conflict = Conflict(
                    conflict_id=generate_id("conf"),
                    conflict_type=ConflictType.DUPLICATE_CATALOG_NUMBER,
                    record_id=rids[0],
                    source_ids=source_ids,
                    message=f"目录号 {catalog} 对应 {len(rids)} 张不同唱片记录",
                    details={
                        "catalog_number": catalog,
                        "record_ids": rids,
                        "source_files": source_files,
                        "next_step": "检查是否同一张唱片被多次录入，或确为不同版本需区分目录号",
                        "artists": [self.db.vinyl_records[rid].artist for rid in rids],
                        "titles": [self.db.vinyl_records[rid].album_title for rid in rids]
                    }
                )
                conflicts.append(conflict)
                self.db.conflicts.append(conflict)

        return conflicts

    def detect_scratch_overlaps(self) -> List[Conflict]:
        conflicts = []
        record_scratches: Dict[str, List[str]] = defaultdict(list)

        for scratch_id, scratch in self.db.scratches.items():
            key = f"{scratch.record_id}|{scratch.side}|{scratch.location}"
            record_scratches[key].append(scratch_id)

        for key, scratch_ids in record_scratches.items():
            if len(scratch_ids) > 1:
                record_id = key.split("|")[0]
                source_ids = []
                scratch_details = []
                for sid in scratch_ids:
                    scratch = self.db.scratches[sid]
                    src_id = scratch.source_id
                    if src_id not in source_ids:
                        source_ids.append(src_id)
                    scratch_details.append({
                        "scratch_id": sid,
                        "severity": scratch.severity.value,
                        "description": scratch.description,
                        "source_file": self.db.sources[scratch.source_id].file_name,
                        "recorded_at": scratch.recorded_at.isoformat()
                    })

                source_files = [self.db.sources[sid].file_name for sid in source_ids]
                conflict = Conflict(
                    conflict_id=generate_id("conf"),
                    conflict_type=ConflictType.SCRATCH_OVERLAP,
                    record_id=record_id,
                    source_ids=source_ids,
                    message=f"唱片 {record_id} 的 {key.split('|')[1]} 面 {key.split('|')[2]} 位置有 {len(scratch_ids)} 条重复划痕记录",
                    details={
                        "location_key": key,
                        "scratch_ids": scratch_ids,
                        "scratch_details": scratch_details,
                        "source_files": source_files,
                        "severity_diff": len(set(s["severity"] for s in scratch_details)) > 1,
                        "next_step": "比对各来源的划痕照片和描述，确认是否同一划痕，严重程度以最新或最详细记录为准"
                    }
                )
                conflicts.append(conflict)
                self.db.conflicts.append(conflict)

        return conflicts

    def detect_missing_listening_tests(self) -> List[Conflict]:
        conflicts = []

        for rid, record in self.db.vinyl_records.items():
            if record.status in [CleaningStatus.CLEANED, CleaningStatus.COMPLETED]:
                if len(record.listening_tests) == 0:
                    source_id = record.source_id
                    source_file = self.db.sources[source_id].file_name

                    conflict = Conflict(
                        conflict_id=generate_id("conf"),
                        conflict_type=ConflictType.MISSING_LISTENING_TEST,
                        record_id=rid,
                        source_ids=[source_id],
                        message=f"唱片 {rid} ({record.catalog_number}) 状态为 {record.status.value}，但缺少试听记录",
                        details={
                            "record_id": rid,
                            "catalog_number": record.catalog_number,
                            "artist": record.artist,
                            "album_title": record.album_title,
                            "current_status": record.status.value,
                            "cleaning_count": record.total_cleanings,
                            "source_file": source_file,
                            "next_step": "补充清洗后试听记录，或确认唱片状态是否正确",
                            "missing_data": "listening_tests",
                            "required_for_status": ["cleaned", "completed"]
                        }
                    )
                    conflicts.append(conflict)
                    self.db.conflicts.append(conflict)

        return conflicts

    def detect_missing_customers(self) -> List[Conflict]:
        conflicts = []

        for rid, record in self.db.vinyl_records.items():
            if record.customer_id and record.customer_id not in self.db.customers:
                source_id = record.source_id
                source_file = self.db.sources[source_id].file_name

                conflict = Conflict(
                    conflict_id=generate_id("conf"),
                    conflict_type=ConflictType.MISSING_CUSTOMER,
                    record_id=rid,
                    source_ids=[source_id],
                    message=f"唱片 {rid} 关联的顾客 {record.customer_id} 不存在",
                    details={
                        "record_id": rid,
                        "catalog_number": record.catalog_number,
                        "missing_customer_id": record.customer_id,
                        "source_file": source_file,
                        "next_step": "导入顾客信息文件，或修正customer_id"
                    }
                )
                conflicts.append(conflict)
                self.db.conflicts.append(conflict)

        return conflicts

    def get_conflicts_by_record(self, record_id: str) -> List[Conflict]:
        return [c for c in self.db.conflicts if c.record_id == record_id]

    def get_unresolved_conflicts(self) -> List[Conflict]:
        return [c for c in self.db.conflicts if not c.resolved]

    def get_conflicts_by_type(self, ctype: ConflictType) -> List[Conflict]:
        return [c for c in self.db.conflicts if c.conflict_type == ctype]

    def get_source_conflict_summary(self) -> Dict[str, Dict]:
        summary = defaultdict(lambda: {"total": 0, "by_type": defaultdict(int)})
        for conflict in self.db.conflicts:
            for src_id in conflict.source_ids:
                summary[src_id]["total"] += 1
                summary[src_id]["by_type"][conflict.conflict_type.value] += 1
        return dict(summary)
