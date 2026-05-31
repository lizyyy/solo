import os
import json
import csv
from datetime import datetime
from typing import List, Dict, Optional
from collections import defaultdict

from models import ProcessedRecord, RecordStatus
from processor import RecordProcessor
from review import RecordReviewer


class SummaryExporter:
    def __init__(self, processor: RecordProcessor, reviewer: RecordReviewer, export_path: str = "./exports"):
        self.processor = processor
        self.reviewer = reviewer
        self.export_path = export_path
        self._ensure_export_path()

    def _ensure_export_path(self) -> None:
        if not os.path.exists(self.export_path):
            os.makedirs(self.export_path)

    def _get_export_filename(self, prefix: str, extension: str) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return f"{prefix}_{timestamp}.{extension}"

    def export_rehearsal_summary(self, start_date: str = None, end_date: str = None, 
                                  sections: List[str] = None, include_duplicates: bool = False) -> Dict:
        all_records = list(self.processor.processed_records.values())
        
        filtered = []
        for record in all_records:
            if start_date and record.record.practice_date < start_date:
                continue
            if end_date and record.record.practice_date > end_date:
                continue
            if sections and record.record.student.section not in sections:
                continue
            if not include_duplicates and record.status == RecordStatus.DUPLICATE:
                continue
            filtered.append(record)

        valid_records = [r for r in filtered if r.status == RecordStatus.PROCESSED]
        duplicate_records = [r for r in filtered if r.status == RecordStatus.DUPLICATE]
        conflict_records = [r for r in filtered if r.status == RecordStatus.CONFLICT]

        summary = {
            "export_info": {
                "exported_at": datetime.now().isoformat(),
                "date_range": {
                    "start": start_date,
                    "end": end_date
                },
                "sections_filter": sections,
                "include_duplicates": include_duplicates
            },
            "summary_counts": {
                "total_records_exported": len(filtered),
                "valid_records": len(valid_records),
                "duplicate_records": len(duplicate_records),
                "conflict_records": len(conflict_records)
            },
            "by_section": self._summarize_by_section(valid_records),
            "by_date": self._summarize_by_date(valid_records),
            "valid_records_detail": self._format_records_detail(valid_records),
            "duplicate_records_detail": self._format_duplicate_detail(duplicate_records),
            "conflict_records_detail": self._format_conflict_detail(conflict_records),
            "verification_notes": self._generate_verification_notes(filtered)
        }

        return summary

    def _summarize_by_section(self, records: List[ProcessedRecord]) -> Dict:
        section_stats = defaultdict(lambda: {
            "count": 0,
            "students": set(),
            "avg_score": 0,
            "total_score": 0,
            "by_voice_part": defaultdict(int)
        })

        for record in records:
            section = record.record.student.section
            voice_part = record.record.student.voice_part
            student_key = record.record.student.unique_key()
            
            section_stats[section]["count"] += 1
            section_stats[section]["students"].add(student_key)
            section_stats[section]["total_score"] += record.record.overall_score
            section_stats[section]["by_voice_part"][voice_part] += 1

        result = {}
        for section, stats in section_stats.items():
            result[section] = {
                "record_count": stats["count"],
                "unique_students": len(stats["students"]),
                "avg_overall_score": round(stats["total_score"] / stats["count"], 2) if stats["count"] > 0 else 0,
                "by_voice_part": dict(stats["by_voice_part"])
            }

        return result

    def _summarize_by_date(self, records: List[ProcessedRecord]) -> Dict:
        date_stats = defaultdict(lambda: {"count": 0, "sections": set()})
        
        for record in records:
            date = record.record.practice_date
            date_stats[date]["count"] += 1
            date_stats[date]["sections"].add(record.record.student.section)

        result = {}
        for date, stats in sorted(date_stats.items()):
            result[date] = {
                "record_count": stats["count"],
                "sections_involved": sorted(list(stats["sections"]))
            }

        return result

    def _format_records_detail(self, records: List[ProcessedRecord]) -> List[Dict]:
        return [
            {
                "record_id": r.record.record_id,
                "student_id": r.record.student.student_id,
                "student_name": r.record.student.name,
                "section": r.record.student.section,
                "voice_part": r.record.student.voice_part,
                "practice_date": r.record.practice_date,
                "practice_content": r.record.practice_content,
                "rhythm_accuracy": r.record.rhythm_accuracy,
                "tempo_stability": r.record.tempo_stability,
                "overall_score": r.record.overall_score,
                "teacher_notes": r.record.teacher_notes,
                "accompanist_notes": r.record.accompanist_notes,
                "content_hash": r.record.content_hash,
                "batch_id": r.record.batch_id
            }
            for r in records
        ]

    def _format_duplicate_detail(self, records: List[ProcessedRecord]) -> List[Dict]:
        result = []
        for r in records:
            original = None
            if r.duplicate_of:
                orig_rec = self.processor.get_record_by_id(r.duplicate_of)
                if orig_rec:
                    original = {
                        "record_id": orig_rec.record.record_id,
                        "student_name": orig_rec.record.student.name,
                        "practice_date": orig_rec.record.practice_date,
                        "batch_id": orig_rec.record.batch_id
                    }

            result.append({
                "record_id": r.record.record_id,
                "student_name": r.record.student.name,
                "practice_date": r.record.practice_date,
                "practice_content": r.record.practice_content,
                "duplicate_reason": r.duplicate_reason.value if r.duplicate_reason else "未知",
                "duplicate_of": r.duplicate_of,
                "original_record": original,
                "content_hash": r.record.content_hash,
                "verification_hint": f"请与记录[{r.duplicate_of}]比对分数和内容确认"
            })
        return result

    def _format_conflict_detail(self, records: List[ProcessedRecord]) -> List[Dict]:
        result = []
        for r in records:
            same_day = self.processor.check_same_day_practice(r.record)
            result.append({
                "record_id": r.record.record_id,
                "student_name": r.record.student.name,
                "practice_date": r.record.practice_date,
                "practice_content": r.record.practice_content,
                "overall_score": r.record.overall_score,
                "same_day_existing_count": len(same_day),
                "existing_records": [
                    {
                        "record_id": s.record.record_id,
                        "practice_content": s.record.practice_content,
                        "overall_score": s.record.overall_score,
                        "batch_id": s.record.batch_id
                    }
                    for s in same_day
                ],
                "action_required": "请人工确认是否为重复统计",
                "review_notes": r.review_notes
            })
        return result

    def _generate_verification_notes(self, all_records: List[ProcessedRecord]) -> List[str]:
        notes = [
            "【数据一致性说明】",
            "1. 所有有效记录均通过内容指纹校验，确保数据完整",
            "2. 重复记录保留但不计入统计，附原始记录ID可追溯",
            "3. 冲突记录需人工审核，不参与自动统计",
            "",
            "【复核指南】",
            "- 对数据有疑问时，可使用 record_id 调用 explain_record 查看完整校验过程",
            "- 重复记录可通过 content_hash 比对原始记录确认",
            "- 同日多练记录请检查练习内容和分数是否存在实质性差异",
            "",
            "【下一班交接】",
            f"- 本次导出共 {len(all_records)} 条记录",
            f"- 其中有效记录 {len([r for r in all_records if r.status == RecordStatus.PROCESSED])} 条",
            f"- 待审核冲突记录 {len([r for r in all_records if r.status == RecordStatus.CONFLICT])} 条",
            f"- 重复记录 {len([r for r in all_records if r.status == RecordStatus.DUPLICATE])} 条已标记排除"
        ]
        return notes

    def export_to_json(self, summary: Dict, filename: str = None) -> str:
        if not filename:
            filename = self._get_export_filename("rehearsal_summary", "json")
        
        filepath = os.path.join(self.export_path, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
        
        return filepath

    def export_to_csv(self, summary: Dict, filename: str = None) -> str:
        if not filename:
            filename = self._get_export_filename("rehearsal_summary", "csv")
        
        filepath = os.path.join(self.export_path, filename)
        
        with open(filepath, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            
            writer.writerow(["【排练小结 - 统计汇总】"])
            writer.writerow(["导出时间", summary["export_info"]["exported_at"]])
            writer.writerow(["日期范围", f"{summary['export_info']['date_range']['start']} - {summary['export_info']['date_range']['end']}"])
            writer.writerow([])
            
            writer.writerow(["【记录统计】"])
            counts = summary["summary_counts"]
            writer.writerow(["总记录数", counts["total_records_exported"]])
            writer.writerow(["有效记录", counts["valid_records"]])
            writer.writerow(["重复记录(已排除)", counts["duplicate_records"]])
            writer.writerow(["待审核冲突", counts["conflict_records"]])
            writer.writerow([])
            
            writer.writerow(["【各声部统计】"])
            writer.writerow(["声部", "记录数", "独立学生数", "平均分", "各声部分布"])
            for section, stats in summary["by_section"].items():
                voice_parts = ", ".join([f"{k}:{v}" for k, v in stats["by_voice_part"].items()])
                writer.writerow([
                    section,
                    stats["record_count"],
                    stats["unique_students"],
                    stats["avg_overall_score"],
                    voice_parts
                ])
            writer.writerow([])
            
            writer.writerow(["【有效记录明细】"])
            writer.writerow([
                "记录ID", "学号", "姓名", "声部", "声部长", "练习日期",
                "练习内容", "节奏准确率", "速度稳定性", "总分",
                "老师备注", "伴奏备注", "内容指纹", "批次ID"
            ])
            for record in summary["valid_records_detail"]:
                writer.writerow([
                    record["record_id"],
                    record["student_id"],
                    record["student_name"],
                    record["section"],
                    record["voice_part"],
                    record["practice_date"],
                    record["practice_content"],
                    record["rhythm_accuracy"],
                    record["tempo_stability"],
                    record["overall_score"],
                    record["teacher_notes"],
                    record["accompanist_notes"],
                    record["content_hash"],
                    record["batch_id"]
                ])
            
            if summary["duplicate_records_detail"]:
                writer.writerow([])
                writer.writerow(["【重复记录明细(不计入统计)】"])
                writer.writerow(["记录ID", "姓名", "练习日期", "重复原因", "原始记录ID", "内容指纹", "复核提示"])
                for record in summary["duplicate_records_detail"]:
                    writer.writerow([
                        record["record_id"],
                        record["student_name"],
                        record["practice_date"],
                        record["duplicate_reason"],
                        record["duplicate_of"],
                        record["content_hash"],
                        record["verification_hint"]
                    ])
            
            if summary["conflict_records_detail"]:
                writer.writerow([])
                writer.writerow(["【待审核冲突记录】"])
                writer.writerow(["记录ID", "姓名", "练习日期", "练习内容", "同日记录数", "处理建议"])
                for record in summary["conflict_records_detail"]:
                    writer.writerow([
                        record["record_id"],
                        record["student_name"],
                        record["practice_date"],
                        record["practice_content"],
                        record["same_day_existing_count"],
                        record["action_required"]
                    ])
            
            writer.writerow([])
            writer.writerow(["【复核说明】"])
            for note in summary["verification_notes"]:
                writer.writerow([note])
        
        return filepath

    def export_batch_summary(self, batch_id: str) -> Dict:
        batch_records = self.processor.get_records_by_batch(batch_id)
        if not batch_records:
            return {"error": "批次不存在"}

        summary = {
            "batch_id": batch_id,
            "exported_at": datetime.now().isoformat(),
            "total_records": len(batch_records),
            "new_records": len([r for r in batch_records if r.status == RecordStatus.PROCESSED]),
            "duplicate_records": len([r for r in batch_records if r.status == RecordStatus.DUPLICATE]),
            "conflict_records": len([r for r in batch_records if r.status == RecordStatus.CONFLICT]),
            "records": [
                {
                    "record_id": r.record_id,
                    "student_name": r.record.student.name,
                    "practice_date": r.record.practice_date,
                    "status": r.status.value,
                    "duplicate_of": r.duplicate_of,
                    "duplicate_reason": r.duplicate_reason.value if r.duplicate_reason else None
                }
                for r in batch_records
            ]
        }

        return summary

    def export_student_report(self, student_key: str) -> Dict:
        history = self.reviewer.get_student_history(student_key)
        if "error" in history:
            return history

        valid_records = [
            r for r in self.processor.get_records_by_student(student_key)
            if r.status == RecordStatus.PROCESSED
        ]

        if valid_records:
            avg_score = sum(r.record.overall_score for r in valid_records) / len(valid_records)
            avg_rhythm = sum(r.record.rhythm_accuracy for r in valid_records) / len(valid_records)
            avg_tempo = sum(r.record.tempo_stability for r in valid_records) / len(valid_records)
        else:
            avg_score = avg_rhythm = avg_tempo = 0

        history["performance_summary"] = {
            "avg_overall_score": round(avg_score, 2),
            "avg_rhythm_accuracy": round(avg_rhythm, 2),
            "avg_tempo_stability": round(avg_tempo, 2),
            "practice_days": len(history["records_by_date"])
        }

        return history
