"""报告导出模块 - 生成统计报告和异常明细"""
import os
import csv
import json
from typing import List, Dict, Any, Optional
from datetime import datetime, date
from collections import defaultdict

from .models import (
    CheckinRecord, Student, Comment, Schedule, RecordStatus, AbnormalType,
    load_json, STUDENTS_FILE, RECORDS_FILE, COMMENTS_FILE, SCHEDULE_FILE,
    ensure_dirs
)


class ReportExporter:
    def __init__(self, output_dir: str = None):
        from .models import DATA_DIR
        self.output_dir = output_dir or os.path.join(DATA_DIR, "reports")
        ensure_dirs()
        os.makedirs(self.output_dir, exist_ok=True)

        self._students: List[Student] = []
        self._records: List[CheckinRecord] = []
        self._comments: List[Comment] = []
        self._schedules: List[Schedule] = []
        self._load_all()

    def _load_all(self):
        students_data = load_json(STUDENTS_FILE, [])
        self._students = [Student.from_dict(s) for s in students_data]

        records_data = load_json(RECORDS_FILE, [])
        self._records = [CheckinRecord.from_dict(r) for r in records_data]

        comments_data = load_json(COMMENTS_FILE, [])
        self._comments = [Comment.from_dict(c) for c in comments_data]

        schedules_data = load_json(SCHEDULE_FILE, [])
        self._schedules = [Schedule.from_dict(s) for s in schedules_data]

    def generate_daily_report(
        self,
        report_date: str,
        format: str = "text"
    ) -> str:
        records = [
            r for r in self._records
            if r.checkin_date == report_date
            and r.status != RecordStatus.MERGED
        ]

        if not records:
            return f"日期 {report_date} 无打卡记录"

        summary = self._build_summary(records, report_date)
        abnormal_details = self._build_abnormal_details(records)
        comment_status = self._build_comment_status(records, report_date)

        if format == "json":
            return self._export_json(report_date, summary, abnormal_details, comment_status)
        elif format == "csv":
            return self._export_csv(report_date, records)
        else:
            return self._export_text(report_date, summary, abnormal_details, comment_status)

    def _build_summary(
        self,
        records: List[CheckinRecord],
        report_date: str
    ) -> Dict[str, Any]:
        total = len(records)
        abnormal = [r for r in records if r.abnormal_types]
        normal = [r for r in records if not r.abnormal_types]

        ab_type_counts: Dict[str, int] = defaultdict(int)
        for r in abnormal:
            for ab_type in r.abnormal_types:
                ab_type_counts[ab_type.value] += 1

        makeup_records = [r for r in records if r.makeup.is_makeup]
        duplicate_groups = self._count_duplicates(records, report_date)

        avg_duration = sum(
            r.audio.duration_seconds for r in records
        ) / total if total > 0 else 0

        return {
            "report_date": report_date,
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "total_records": total,
            "normal_records": len(normal),
            "abnormal_records": len(abnormal),
            "abnormal_rate": round(len(abnormal) / total * 100, 1) if total > 0 else 0,
            "avg_duration_seconds": round(avg_duration, 1),
            "makeup_count": len(makeup_records),
            "duplicate_groups": duplicate_groups,
            "abnormal_type_counts": dict(ab_type_counts),
            "by_student": self._summary_by_student(records)
        }

    def _count_duplicates(
        self,
        records: List[CheckinRecord],
        report_date: str
    ) -> int:
        all_records = [
            r for r in self._records if r.checkin_date == report_date
        ]
        groups = defaultdict(list)
        for r in all_records:
            groups[(r.student_id, r.checkin_date)].append(r)
        return sum(1 for g in groups.values() if len(g) > 1)

    def _summary_by_student(
        self,
        records: List[CheckinRecord]
    ) -> List[Dict[str, Any]]:
        by_student: Dict[str, List[CheckinRecord]] = defaultdict(list)
        for r in records:
            by_student[r.student_id].append(r)

        result = []
        for student_id, student_records in by_student.items():
            student = self._find_student(student_id)
            abnormal_count = sum(
                1 for r in student_records if r.abnormal_types
            )
            result.append({
                "student_id": student_id,
                "student_name": student.name if student else "未知",
                "record_count": len(student_records),
                "abnormal_count": abnormal_count,
                "has_abnormal": abnormal_count > 0
            })
        return sorted(result, key=lambda x: (-x["abnormal_count"], x["student_name"]))

    def _build_abnormal_details(
        self,
        records: List[CheckinRecord]
    ) -> List[Dict[str, Any]]:
        abnormal_records = [r for r in records if r.abnormal_types]
        details = []

        for record in abnormal_records:
            student = self._find_student(record.student_id)
            details.append({
                "record_id": record.record_id,
                "student_id": record.student_id,
                "student_name": student.name if student else "未知",
                "checkin_time": record.checkin_time,
                "abnormal_types": [t.value for t in record.abnormal_types],
                "abnormal_details": record.abnormal_details,
                "audio_duration": record.audio.duration_seconds,
                "audio_volume": record.audio.avg_volume,
                "is_makeup": record.makeup.is_makeup,
                "makeup_reason": record.makeup.reason if record.makeup.is_makeup else None,
                "merged_from": record.merged_from if record.merged_from else None
            })

        return details

    def _build_comment_status(
        self,
        records: List[CheckinRecord],
        report_date: str
    ) -> Dict[str, Any]:
        commented_ids = {c.record_id for c in self._comments}
        commented = [r for r in records if r.record_id in commented_ids]
        uncommented = [r for r in records if r.record_id not in commented_ids]
        uncommented_abnormal = [
            r for r in uncommented if r.abnormal_types
        ]

        return {
            "commented_count": len(commented),
            "uncommented_count": len(uncommented),
            "uncommented_abnormal_count": len(uncommented_abnormal),
            "comment_rate": round(len(commented) / len(records) * 100, 1) if records else 0,
            "uncommented_records": [
                {
                    "record_id": r.record_id,
                    "student_name": self._find_student(r.student_id).name if self._find_student(r.student_id) else "未知",
                    "checkin_time": r.checkin_time,
                    "abnormal_types": [t.value for t in r.abnormal_types]
                }
                for r in uncommented
            ]
        }

    def _export_text(
        self,
        report_date: str,
        summary: Dict[str, Any],
        abnormal_details: List[Dict[str, Any]],
        comment_status: Dict[str, Any]
    ) -> str:
        lines = []
        lines.append("=" * 70)
        lines.append(f"钢琴练琴打卡日报 - {report_date}")
        lines.append(f"生成时间: {summary['generated_at']}")
        lines.append("=" * 70)
        lines.append("")

        lines.append("【总体统计】")
        lines.append(f"  总记录数: {summary['total_records']}")
        lines.append(f"  正常记录: {summary['normal_records']}")
        lines.append(f"  异常记录: {summary['abnormal_records']} ({summary['abnormal_rate']}%)")
        lines.append(f"  平均时长: {summary['avg_duration_seconds']}秒")
        lines.append(f"  补录记录: {summary['makeup_count']}")
        lines.append(f"  重复组: {summary['duplicate_groups']}")
        lines.append("")

        lines.append("【异常类型分布】")
        if summary["abnormal_type_counts"]:
            for ab_type, count in sorted(summary["abnormal_type_counts"].items()):
                type_name = self._get_abnormal_type_name(ab_type)
                lines.append(f"  {type_name}: {count}条")
        else:
            lines.append("  无异常")
        lines.append("")

        lines.append("【点评状态】")
        lines.append(f"  已点评: {comment_status['commented_count']}")
        lines.append(f"  待点评: {comment_status['uncommented_count']}")
        lines.append(f"  待点评(含异常): {comment_status['uncommented_abnormal_count']}")
        lines.append(f"  点评率: {comment_status['comment_rate']}%")
        lines.append("")

        lines.append("【学生明细】")
        for s in summary["by_student"]:
            status = "⚠️ 异常" if s["has_abnormal"] else "✅ 正常"
            lines.append(
                f"  {s['student_name']}({s['student_id']}): "
                f"{s['record_count']}条, 异常{s['abnormal_count']}条 {status}"
            )
        lines.append("")

        if abnormal_details:
            lines.append("【异常明细】")
            lines.append("-" * 70)
            for i, detail in enumerate(abnormal_details, 1):
                lines.append(f"{i}. {detail['student_name']} ({detail['checkin_time']})")
                lines.append(f"   记录ID: {detail['record_id']}")
                type_names = [
                    self._get_abnormal_type_name(t)
                    for t in detail["abnormal_types"]
                ]
                lines.append(f"   异常类型: {', '.join(type_names)}")
                for ab_detail in detail["abnormal_details"]:
                    lines.append(f"     - {ab_detail}")
                if detail["is_makeup"]:
                    lines.append(f"   补录理由: {detail['makeup_reason']}")
                lines.append("")
        else:
            lines.append("【异常明细】")
            lines.append("  今日无异常记录，表现优秀！")
            lines.append("")

        if comment_status["uncommented_records"]:
            lines.append("【待点评记录】")
            for i, r in enumerate(comment_status["uncommented_records"], 1):
                ab_info = ""
                if r["abnormal_types"]:
                    type_names = [
                        self._get_abnormal_type_name(t)
                        for t in r["abnormal_types"]
                    ]
                    ab_info = f" (异常: {', '.join(type_names)})"
                lines.append(
                    f"  {i}. {r['student_name']} - {r['checkin_time']}"
                    f"{ab_info}"
                )
            lines.append("")

        lines.append("=" * 70)

        report_text = "\n".join(lines)
        self._save_report(report_date, "txt", report_text)
        return report_text

    def _export_json(
        self,
        report_date: str,
        summary: Dict[str, Any],
        abnormal_details: List[Dict[str, Any]],
        comment_status: Dict[str, Any]
    ) -> str:
        report = {
            "summary": summary,
            "abnormal_details": abnormal_details,
            "comment_status": comment_status
        }
        json_str = json.dumps(report, ensure_ascii=False, indent=2)
        self._save_report(report_date, "json", json_str)
        return json_str

    def _export_csv(
        self,
        report_date: str,
        records: List[CheckinRecord]
    ) -> str:
        csv_path = os.path.join(
            self.output_dir, f"daily_report_{report_date}.csv"
        )

        with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f)
            writer.writerow([
                "学生ID", "学生姓名", "打卡日期", "打卡时间",
                "音频时长(秒)", "平均音量(dB)", "是否空白",
                "是否补录", "补录理由",
                "状态", "异常类型", "异常详情", "已点评"
            ])

            for record in records:
                student = self._find_student(record.student_id)
                is_commented = any(
                    c.record_id == record.record_id for c in self._comments
                )
                type_names = [
                    self._get_abnormal_type_name(t.value)
                    for t in record.abnormal_types
                ]
                writer.writerow([
                    record.student_id,
                    student.name if student else "未知",
                    record.checkin_date,
                    record.checkin_time,
                    record.audio.duration_seconds,
                    record.audio.avg_volume,
                    "是" if record.audio.is_blank else "否",
                    "是" if record.makeup.is_makeup else "否",
                    record.makeup.reason or "",
                    "异常" if record.abnormal_types else "正常",
                    "; ".join(type_names),
                    "; ".join(record.abnormal_details),
                    "是" if is_commented else "否"
                ])

        with open(csv_path, "r", encoding="utf-8-sig") as f:
            content = f.read()
        return content

    def _save_report(self, report_date: str, ext: str, content: str) -> str:
        file_path = os.path.join(
            self.output_dir,
            f"daily_report_{report_date}.{ext}"
        )
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        return file_path

    def _get_abnormal_type_name(self, type_value: str) -> str:
        names = {
            "blank_audio": "空白音频",
            "short_audio": "时长不足",
            "makeup_overdue": "补录超期",
            "duplicate": "重复上传",
            "invalid_reason": "理由无效",
            "low_quality": "质量过低"
        }
        return names.get(type_value, type_value)

    def _find_student(self, student_id: str) -> Optional[Student]:
        for s in self._students:
            if s.student_id == student_id:
                return s
        return None

    def export_student_report(
        self,
        student_id: str,
        start_date: str = None,
        end_date: str = None
    ) -> str:
        student = self._find_student(student_id)
        if not student:
            return f"学生不存在: {student_id}"

        records = [
            r for r in self._records
            if r.student_id == student_id
            and r.status != RecordStatus.MERGED
        ]

        if start_date:
            records = [r for r in records if r.checkin_date >= start_date]
        if end_date:
            records = [r for r in records if r.checkin_date <= end_date]

        if not records:
            return f"学生 {student.name} 无打卡记录"

        total_days = len(records)
        abnormal_days = sum(1 for r in records if r.abnormal_types)
        avg_duration = sum(r.audio.duration_seconds for r in records) / total_days

        lines = []
        lines.append("=" * 70)
        lines.append(f"学生练琴报告 - {student.name}")
        lines.append("=" * 70)
        lines.append(f"学生ID: {student.student_id}")
        lines.append(f"级别: {student.level}")
        lines.append(f"老师: {student.teacher}")
        lines.append(f"入学日期: {student.join_date}")
        lines.append("")
        lines.append(f"统计周期: {start_date or '开始'} ~ {end_date or '至今'}")
        lines.append(f"总打卡天数: {total_days}")
        lines.append(f"异常天数: {abnormal_days}")
        lines.append(f"平均时长: {avg_duration:.1f}秒")
        lines.append("")

        lines.append("【打卡明细】")
        for r in sorted(records, key=lambda x: x.checkin_date):
            status = "⚠️ 异常" if r.abnormal_types else "✅ 正常"
            makeup = " [补录]" if r.makeup.is_makeup else ""
            lines.append(
                f"  {r.checkin_date} {r.checkin_time}: "
                f"{r.audio.duration_seconds}秒 {status}{makeup}"
            )
            for detail in r.abnormal_details:
                lines.append(f"     - {detail}")

        report = "\n".join(lines)
        self._save_report(f"student_{student_id}", "txt", report)
        return report
