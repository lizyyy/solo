from sqlalchemy.orm import Session
from typing import List, Dict, Any
import pandas as pd
from datetime import datetime
import json
from pathlib import Path

from app.models import AcceptanceRecord, FailedRecord
from app.models.audit import RecordStatus
from app.core.config import settings
from app.schemas import ExportRequest, RecordQuery
from app.services import AuditService


class ExportService:
    @staticmethod
    def export_records(db: Session, export_req: ExportRequest) -> Dict[str, Any]:
        query = RecordQuery()
        if export_req.start_date:
            query.start_date = export_req.start_date
        if export_req.end_date:
            query.end_date = export_req.end_date
        if not export_req.include_bad_data:
            query.is_bad_data = False

        records, total = AuditService.list_records(db, query, skip=0, limit=10000)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"acceptance_records_{timestamp}"

        data = []
        for record in records:
            data.append({
                "记录编号": record.record_no,
                "药房名称": record.pharmacy_name,
                "药房区域": record.pharmacy_region,
                "数据来源": record.source_type.value if record.source_type else "",
                "来源编号": record.source_ref or "",
                "药品名称": record.medicine_name,
                "药品编码": record.medicine_code or "",
                "批次号": record.batch_no,
                "有效期": record.expiry_date or "",
                "近效期天数": record.near_expiry_days or 0,
                "数量": record.quantity,
                "单位": record.unit or "",
                "状态": record.status.value if record.status else "",
                "是否有效": "是" if record.is_valid else "否",
                "是否坏数据": "是" if record.is_bad_data else "否",
                "创建时间": record.created_at.strftime("%Y-%m-%d %H:%M:%S") if record.created_at else "",
                "备注": record.notes or ""
            })

        df = pd.DataFrame(data)

        if export_req.format == "excel":
            filepath = settings.EXPORT_DIR / f"{filename}.xlsx"
            df.to_excel(filepath, index=False, sheet_name="验收记录")
            file_format = "xlsx"
        else:
            filepath = settings.EXPORT_DIR / f"{filename}.csv"
            df.to_csv(filepath, index=False, encoding="utf-8-sig")
            file_format = "csv"

        return {
            "success": True,
            "file_path": str(filepath),
            "file_name": filepath.name,
            "format": file_format,
            "total_records": total,
            "exported_records": len(data)
        }

    @staticmethod
    def export_failed_records(db: Session, export_req: ExportRequest) -> Dict[str, Any]:
        failed_records, total = AuditService.list_failed_records(db, resolved=None, skip=0, limit=10000)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"failed_records_{timestamp}"

        data = []
        for fr in failed_records:
            data.append({
                "失败记录ID": fr.id,
                "关联验收记录ID": fr.record_id,
                "验收记录编号": fr.record_no or "",
                "错误类型": fr.error_type,
                "错误信息": fr.error_message,
                "错误详情": fr.error_details or "",
                "失败时间": fr.failed_at.strftime("%Y-%m-%d %H:%M:%S") if fr.failed_at else "",
                "是否已解决": "是" if fr.resolved else "否",
                "解决人ID": fr.resolved_by or "",
                "解决时间": fr.resolved_at.strftime("%Y-%m-%d %H:%M:%S") if fr.resolved_at else "",
                "解决备注": fr.resolution_notes or ""
            })

        df = pd.DataFrame(data)

        if export_req.format == "excel":
            filepath = settings.EXPORT_DIR / f"{filename}.xlsx"
            df.to_excel(filepath, index=False, sheet_name="失败记录")
            file_format = "xlsx"
        else:
            filepath = settings.EXPORT_DIR / f"{filename}.csv"
            df.to_csv(filepath, index=False, encoding="utf-8-sig")
            file_format = "csv"

        return {
            "success": True,
            "file_path": str(filepath),
            "file_name": filepath.name,
            "format": file_format,
            "total_records": total,
            "exported_records": len(data)
        }

    @staticmethod
    def generate_report(db: Session) -> Dict[str, Any]:
        total_records = db.query(AcceptanceRecord).count()
        valid_records = db.query(AcceptanceRecord).filter(AcceptanceRecord.is_valid == True).count()
        bad_data_count = db.query(AcceptanceRecord).filter(AcceptanceRecord.is_bad_data == True).count()
        failed_count = db.query(FailedRecord).filter(FailedRecord.resolved == False).count()
        resolved_count = db.query(FailedRecord).filter(FailedRecord.resolved == True).count()

        status_stats = {}
        for status in RecordStatus:
            count = db.query(AcceptanceRecord).filter(AcceptanceRecord.status == status).count()
            status_stats[status.value] = count

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_data = {
            "report_title": "乡镇药房近效期验收回放链路报告",
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "summary": {
                "总记录数": total_records,
                "有效记录数": valid_records,
                "坏数据数量": bad_data_count,
                "待解决失败记录": failed_count,
                "已解决失败记录": resolved_count
            },
            "status_statistics": status_stats,
            "recent_failed_records": []
        }

        recent_failed, _ = AuditService.list_failed_records(db, resolved=False, skip=0, limit=10)
        for fr in recent_failed:
            report_data["recent_failed_records"].append({
                "record_no": fr.record_no,
                "error_type": fr.error_type,
                "error_message": fr.error_message,
                "failed_at": fr.failed_at.strftime("%Y-%m-%d %H:%M:%S") if fr.failed_at else ""
            })

        report_file = settings.EXPORT_DIR / f"report_{timestamp}.json"
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)

        return {
            "success": True,
            "report_file": str(report_file),
            "report_data": report_data
        }
