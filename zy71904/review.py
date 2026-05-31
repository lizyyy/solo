from typing import List, Dict, Optional
from collections import defaultdict
from datetime import datetime

from models import ProcessedRecord, RecordStatus, DuplicateReason, DrumRecord
from processor import RecordProcessor


class RecordReviewer:
    def __init__(self, processor: RecordProcessor):
        self.processor = processor

    def explain_record(self, record_id: str) -> Dict:
        record = self.processor.get_record_by_id(record_id)
        if not record:
            return {"error": "记录不存在"}

        explanation = {
            "record_id": record_id,
            "student": f"{record.record.student.name} ({record.record.student.student_id})",
            "section": record.record.student.section,
            "voice_part": record.record.student.voice_part,
            "practice_date": record.record.practice_date,
            "practice_content": record.record.practice_content,
            "status": record.status.value,
            "status_code": record.status.name,
            "processed_at": record.processed_at.isoformat(),
            "processed_by": record.processed_by,
            "batch_id": record.record.batch_id,
            "source_file": record.record.source_file,
        }

        if record.status == RecordStatus.DUPLICATE:
            explanation["duplicate_info"] = self._explain_duplicate(record)
        elif record.status == RecordStatus.CONFLICT:
            explanation["conflict_info"] = self._explain_conflict(record)
        elif record.status == RecordStatus.PROCESSED:
            explanation["validation_info"] = self._explain_valid(record)

        if record.review_notes:
            explanation["review_notes"] = record.review_notes

        return explanation

    def _explain_duplicate(self, record: ProcessedRecord) -> Dict:
        reason_explanations = {
            DuplicateReason.CONTENT_HASH_MATCH: "内容指纹完全匹配，可能是同一记录重复导入",
            DuplicateReason.SAME_BATCH: "同一批次内同学生同日重复记录",
            DuplicateReason.SAME_DATE_STUDENT: "同学生同日有多条练习记录",
            DuplicateReason.MANUAL_MARK: "人工审核标记为重复",
        }

        original_record = None
        if record.duplicate_of:
            original_record = self.processor.get_record_by_id(record.duplicate_of)

        return {
            "duplicate_reason": record.duplicate_reason.value if record.duplicate_reason else "未知",
            "reason_explanation": reason_explanations.get(record.duplicate_reason, "未知原因"),
            "duplicate_of": record.duplicate_of,
            "original_record_info": {
                "record_id": original_record.record.record_id,
                "imported_at": original_record.record.imported_at.isoformat(),
                "batch_id": original_record.record.batch_id,
                "source_file": original_record.record.source_file
            } if original_record else None,
            "content_hash": record.record.content_hash,
            "verification_hint": f"请比对原始记录[{record.duplicate_of}]的分数和备注，确认是否为真正的重复"
        }

    def _explain_conflict(self, record: ProcessedRecord) -> Dict:
        same_day_records = self.processor.check_same_day_practice(record.record)
        
        return {
            "conflict_type": "同日多练待确认",
            "same_day_count": len(same_day_records),
            "existing_records": [
                {
                    "record_id": r.record.record_id,
                    "practice_content": r.record.practice_content,
                    "overall_score": r.record.overall_score,
                    "imported_at": r.record.imported_at.isoformat(),
                    "batch_id": r.record.batch_id
                }
                for r in same_day_records
            ],
            "action_required": "请声部长或伴奏老师人工确认：\n1. 是否为同一练习重复统计\n2. 是否为同日多次有效练习",
            "resolution_path": "使用 resolve_conflict 命令标记为有效或重复"
        }

    def _explain_valid(self, record: ProcessedRecord) -> Dict:
        student_records = self.processor.get_records_by_student(record.record.student.unique_key())
        
        return {
            "validation_passed": True,
            "checks_performed": [
                "内容指纹唯一性检查 - 通过",
                "同批次同学生同日去重 - 通过",
                "同日多练检测 - 通过"
            ],
            "student_total_valid_records": len([r for r in student_records if r.status == RecordStatus.PROCESSED]),
            "content_hash": record.record.content_hash
        }

    def get_statistics(self) -> Dict:
        all_records = list(self.processor.processed_records.values())
        
        stats = {
            "total_records": len(all_records),
            "status_breakdown": {},
            "by_section": defaultdict(lambda: {"total": 0, "valid": 0, "duplicate": 0, "conflict": 0}),
            "by_date": defaultdict(lambda: {"total": 0, "valid": 0, "duplicate": 0}),
            "duplicate_reasons": defaultdict(int),
            "batches": defaultdict(int)
        }

        for record in all_records:
            status_key = record.status.value
            stats["status_breakdown"][status_key] = stats["status_breakdown"].get(status_key, 0) + 1
            
            section = record.record.student.section
            stats["by_section"][section]["total"] += 1
            if record.status == RecordStatus.PROCESSED:
                stats["by_section"][section]["valid"] += 1
            elif record.status == RecordStatus.DUPLICATE:
                stats["by_section"][section]["duplicate"] += 1
            elif record.status == RecordStatus.CONFLICT:
                stats["by_section"][section]["conflict"] += 1

            date = record.record.practice_date
            stats["by_date"][date]["total"] += 1
            if record.status == RecordStatus.PROCESSED:
                stats["by_date"][date]["valid"] += 1
            elif record.status == RecordStatus.DUPLICATE:
                stats["by_date"][date]["duplicate"] += 1

            if record.duplicate_reason:
                stats["duplicate_reasons"][record.duplicate_reason.value] += 1

            if record.record.batch_id:
                stats["batches"][record.record.batch_id] += 1

        stats["by_section"] = dict(stats["by_section"])
        stats["by_date"] = dict(sorted(stats["by_date"].items()))
        stats["duplicate_reasons"] = dict(stats["duplicate_reasons"])
        stats["batches"] = dict(stats["batches"])

        return stats

    def get_duplicate_chains(self) -> List[Dict]:
        chains = []
        processed = set()

        for record_id, record in self.processor.processed_records.items():
            if record_id in processed:
                continue
            
            if record.status == RecordStatus.DUPLICATE and record.duplicate_of:
                chain = self._build_duplicate_chain(record_id)
                if chain and chain["original_id"] not in processed:
                    chains.append(chain)
                    processed.update(chain["all_ids"])

        return chains

    def _build_duplicate_chain(self, start_id: str) -> Optional[Dict]:
        chain = []
        current_id = start_id
        visited = set()

        while current_id and current_id not in visited:
            visited.add(current_id)
            record = self.processor.get_record_by_id(current_id)
            if not record:
                break
            
            chain.append({
                "record_id": current_id,
                "student": record.record.student.name,
                "practice_date": record.record.practice_date,
                "status": record.status.value,
                "duplicate_of": record.duplicate_of,
                "batch_id": record.record.batch_id
            })

            if record.status != RecordStatus.DUPLICATE:
                break
            
            current_id = record.duplicate_of

        if not chain:
            return None

        original = chain[-1]
        duplicates = chain[:-1] if len(chain) > 1 else chain

        return {
            "original_id": original["record_id"],
            "original_info": original,
            "duplicate_count": len(duplicates),
            "duplicates": duplicates,
            "all_ids": [item["record_id"] for item in chain]
        }

    def get_conflicts_for_review(self) -> List[Dict]:
        conflicts = self.processor.get_records_by_status(RecordStatus.CONFLICT)
        return [self.explain_record(r.record_id) for r in conflicts]

    def get_student_history(self, student_key: str) -> Dict:
        records = self.processor.get_records_by_student(student_key)
        if not records:
            return {"error": "未找到该学生的记录"}

        student = records[0].record.student
        sorted_records = sorted(records, key=lambda r: r.record.practice_date)

        history = {
            "student_info": {
                "name": student.name,
                "student_id": student.student_id,
                "section": student.section,
                "voice_part": student.voice_part
            },
            "total_records": len(records),
            "valid_records": len([r for r in records if r.status == RecordStatus.PROCESSED]),
            "duplicate_records": len([r for r in records if r.status == RecordStatus.DUPLICATE]),
            "conflict_records": len([r for r in records if r.status == RecordStatus.CONFLICT]),
            "records_by_date": defaultdict(list)
        }

        for record in sorted_records:
            history["records_by_date"][record.record.practice_date].append({
                "record_id": record.record.record_id,
                "practice_content": record.record.practice_content,
                "overall_score": record.record.overall_score,
                "status": record.status.value,
                "status_code": record.status.name,
                "batch_id": record.record.batch_id
            })

        history["records_by_date"] = dict(history["records_by_date"])
        return history
