import csv
from typing import List, Dict, Any
from datetime import datetime
from pathlib import Path
from sqlalchemy.orm import Session

from ..models import (
    Cleaner,
    CleaningRecord,
    Issue,
    Settlement,
    ImportError,
    AuditLog,
    RoomStatus,
    Photo,
    Rework,
)


class CSVExporter:
    def __init__(self, db: Session, output_dir: str = "./output"):
        self.db = db
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def _write_csv(self, filename: str, headers: List[str], rows: List[List[Any]]) -> str:
        filepath = self.output_dir / filename
        with open(filepath, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            writer.writerows(rows)
        return str(filepath)

    def export_settlements(self, month: str) -> str:
        settlements = self.db.query(Settlement).filter(Settlement.month == month).all()

        headers = ["保洁员", "保洁次数", "基础金额", "扣款总额", "实发金额", "是否已确认"]
        rows = []

        for s in settlements:
            cleaner = self.db.query(Cleaner).filter(Cleaner.id == s.cleaner_id).first()
            rows.append([
                cleaner.name if cleaner else "Unknown",
                s.total_cleanings,
                f"{s.base_amount:.2f}",
                f"{s.total_deductions:.2f}",
                f"{s.final_amount:.2f}",
                "是" if s.is_finalized else "否",
            ])

        filename = f"settlement_{month}_{datetime.now().strftime('%Y%m%d%H%M%S')}.csv"
        return self._write_csv(filename, headers, rows)

    def export_cleaning_records(self, start_date: datetime, end_date: datetime) -> str:
        records = (
            self.db.query(CleaningRecord)
            .filter(CleaningRecord.cleaning_date >= start_date, CleaningRecord.cleaning_date <= end_date)
            .order_by(CleaningRecord.cleaning_date)
            .all()
        )

        headers = ["房间号", "保洁日期", "保洁员", "开始时间", "结束时间", "时长(分钟)", "评分", "备注", "状态"]
        rows = []

        for r in records:
            cleaner = self.db.query(Cleaner).filter(Cleaner.id == r.cleaner_id).first()
            rows.append([
                r.room_number,
                r.cleaning_date.strftime("%Y-%m-%d"),
                cleaner.name if cleaner else "",
                r.start_time.strftime("%H:%M:%S") if r.start_time else "",
                r.end_time.strftime("%H:%M:%S") if r.end_time else "",
                r.duration_minutes or "",
                r.score or "",
                r.notes or "",
                r.status_record,
            ])

        filename = f"cleaning_records_{start_date.strftime('%Y%m%d')}_{end_date.strftime('%Y%m%d')}.csv"
        return self._write_csv(filename, headers, rows)

    def export_issues(self, start_date: datetime = None, end_date: datetime = None) -> str:
        query = self.db.query(Issue)
        if start_date:
            query = query.filter(Issue.reported_at >= start_date)
        if end_date:
            query = query.filter(Issue.reported_at <= end_date)

        issues = query.order_by(Issue.reported_at).all()

        headers = ["ID", "房间号", "保洁员", "问题类型", "描述", "扣款金额", "状态", "报告人", "报告时间", "复核人", "备注"]
        rows = []

        for issue in issues:
            record = self.db.query(CleaningRecord).filter(CleaningRecord.id == issue.cleaning_record_id).first()
            cleaner = None
            if record:
                cleaner = self.db.query(Cleaner).filter(Cleaner.id == record.cleaner_id).first()

            rows.append([
                issue.id,
                record.room_number if record else "",
                cleaner.name if cleaner else "",
                issue.issue_type,
                issue.description,
                f"{issue.deduction_amount:.2f}",
                issue.deduction_status,
                issue.reported_by or "",
                issue.reported_at.strftime("%Y-%m-%d %H:%M:%S") if issue.reported_at else "",
                issue.reviewer or "",
                issue.resolution_notes or "",
            ])

        filename = f"issues_{datetime.now().strftime('%Y%m%d%H%M%S')}.csv"
        return self._write_csv(filename, headers, rows)

    def export_import_errors(self) -> str:
        errors = self.db.query(ImportError).filter(ImportError.is_resolved == False).order_by(ImportError.created_at).all()

        headers = ["ID", "数据源", "文件", "行号", "错误信息", "建议修复", "原始数据", "导入时间"]
        rows = []

        for e in errors:
            rows.append([
                e.id,
                e.source_type,
                e.source_file,
                e.source_row or "",
                e.error_message,
                e.suggested_fix or "",
                str(e.raw_data) or "",
                e.created_at.strftime("%Y-%m-%d %H:%M:%S") if e.created_at else "",
            ])

        filename = f"import_errors_{datetime.now().strftime('%Y%m%d%H%M%S')}.csv"
        return self._write_csv(filename, headers, rows)

    def export_audit_logs(self, entity_type: str = None, start_date: datetime = None, end_date: datetime = None) -> str:
        query = self.db.query(AuditLog)
        if entity_type:
            query = query.filter(AuditLog.entity_type == entity_type)
        if start_date:
            query = query.filter(AuditLog.created_at >= start_date)
        if end_date:
            query = query.filter(AuditLog.created_at <= end_date)

        logs = query.order_by(AuditLog.created_at.desc()).all()

        headers = ["ID", "操作", "实体类型", "实体ID", "操作人", "操作时间"]
        rows = []

        for log in logs:
            rows.append([
                log.id,
                log.action,
                log.entity_type or "",
                log.entity_id or "",
                log.operator,
                log.created_at.strftime("%Y-%m-%d %H:%M:%S") if log.created_at else "",
            ])

        filename = f"audit_logs_{datetime.now().strftime('%Y%m%d%H%M%S')}.csv"
        return self._write_csv(filename, headers, rows)

    def export_detailed_settlement(self, cleaner_id: int, month: str) -> str:
        year, month_num = map(int, month.split("-"))
        start_date = datetime(year, month_num, 1)
        if month_num == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month_num + 1, 1)

        cleaner = self.db.query(Cleaner).filter(Cleaner.id == cleaner_id).first()
        if not cleaner:
            raise ValueError(f"Cleaner with id {cleaner_id} not found")

        records = (
            self.db.query(CleaningRecord)
            .filter(
                CleaningRecord.cleaner_id == cleaner_id,
                CleaningRecord.cleaning_date >= start_date,
                CleaningRecord.cleaning_date < end_date,
            )
            .order_by(CleaningRecord.cleaning_date)
            .all()
        )

        headers = ["日期", "房间号", "基础金额", "问题描述", "扣款金额", "备注"]
        rows = []

        base_rate = 100.0
        total_base = 0.0
        total_deductions = 0.0

        for record in records:
            issues = (
                self.db.query(Issue)
                .filter(
                    Issue.cleaning_record_id == record.id,
                    Issue.deduction_status.in_(["confirmed", "resolved"]),
                )
                .all()
            )

            if issues:
                for issue in issues:
                    rows.append([
                        record.cleaning_date.strftime("%Y-%m-%d"),
                        record.room_number,
                        f"{base_rate:.2f}",
                        issue.description,
                        f"{issue.deduction_amount:.2f}",
                        issue.issue_type,
                    ])
                    total_base += base_rate
                    total_deductions += issue.deduction_amount
            else:
                rows.append([
                    record.cleaning_date.strftime("%Y-%m-%d"),
                    record.room_number,
                    f"{base_rate:.2f}",
                    "",
                    "0.00",
                    "",
                ])
                total_base += base_rate

        rows.append([])
        rows.append(["合计", "", f"{total_base:.2f}", "", f"{total_deductions:.2f}", ""])
        rows.append(["实发金额", "", "", "", f"{total_base - total_deductions:.2f}", ""])

        filename = f"settlement_detail_{cleaner.name}_{month}.csv"
        return self._write_csv(filename, headers, rows)
