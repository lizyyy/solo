import os
import uuid
from datetime import datetime
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
import xlsxwriter
from app.models import ConsumableRecord, StatusHistory, ReplayException, AuditLog
from app.config import settings
from loguru import logger


class ExportService:
    def __init__(self, db: Session):
        self.db = db
        self._ensure_directories()

    def _ensure_directories(self):
        os.makedirs(settings.EXPORT_DIR, exist_ok=True)

    def _generate_export_filename(self, prefix: str) -> str:
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        unique_id = str(uuid.uuid4())[:6].upper()
        return f"{prefix}_{timestamp}_{unique_id}.xlsx"

    def export_consumable_records(
        self,
        filters: Optional[Dict[str, Any]] = None,
        operator: str = "system"
    ) -> Dict[str, Any]:
        filename = self._generate_export_filename("耗材记录")
        filepath = os.path.join(settings.EXPORT_DIR, filename)

        query = self.db.query(ConsumableRecord)
        
        if filters:
            if filters.get("data_source"):
                query = query.filter(ConsumableRecord.data_source == filters["data_source"])
            if filters.get("current_status"):
                query = query.filter(ConsumableRecord.current_status == filters["current_status"])
            if filters.get("is_duplicate") is not None:
                query = query.filter(ConsumableRecord.is_duplicate == filters["is_duplicate"])
        
        records = query.all()

        workbook = xlsxwriter.Workbook(filepath)
        
        header_format = workbook.add_format({
            'bold': True,
            'bg_color': '#4472C4',
            'font_color': 'white',
            'border': 1
        })
        
        normal_format = workbook.add_format({'border': 1})
        duplicate_format = workbook.add_format({'border': 1, 'bg_color': '#FFC7CE'})

        worksheet = workbook.add_worksheet("耗材记录明细")
        
        headers = [
            "记录编号", "耗材名称", "规格型号", "数量", "单位", "批号",
            "有效期", "供应商", "数据来源", "当前状态", "实验室", "课题组",
            "是否重复", "原始文件名", "原始行号", "缺去向原因",
            "借用损耗混合", "创建人", "创建时间"
        ]
        
        for col, header in enumerate(headers):
            worksheet.write(0, col, header, header_format)
            worksheet.set_column(col, col, 15)

        for row_idx, record in enumerate(records, start=1):
            row_format = duplicate_format if record.is_duplicate else normal_format
            
            data = [
                record.record_no,
                record.consumable_name,
                record.specification,
                record.quantity,
                record.unit,
                record.batch_no,
                record.expire_date.strftime("%Y-%m-%d") if record.expire_date else "",
                record.supplier,
                record.data_source,
                record.current_status,
                record.lab,
                record.research_group,
                "是" if record.is_duplicate else "否",
                record.original_file_name,
                record.original_row_number,
                record.missing_direction_reason or "",
                "是" if record.borrow_loss_mixed else "否",
                record.created_by,
                record.created_at.strftime("%Y-%m-%d %H:%M:%S") if record.created_at else ""
            ]
            
            for col, value in enumerate(data):
                worksheet.write(row_idx, col, value, row_format)

        summary_sheet = workbook.add_worksheet("数据汇总")
        
        summary_headers = ["统计项", "数量"]
        for col, header in enumerate(summary_headers):
            summary_sheet.write(0, col, header, header_format)
            summary_sheet.set_column(col, col, 25)

        status_stats = {}
        source_stats = {}
        for record in records:
            status_stats[record.current_status] = status_stats.get(record.current_status, 0) + 1
            source_stats[record.data_source] = source_stats.get(record.data_source, 0) + 1

        summary_data = [
            ["总记录数", len(records)],
            ["重复记录数", sum(1 for r in records if r.is_duplicate)],
            ["", ""],
            ["按状态统计:", ""],
        ]
        
        for status, count in status_stats.items():
            summary_data.append([f"  {status}", count])
        
        summary_data.append(["", ""])
        summary_data.append(["按来源统计:", ""])
        
        for source, count in source_stats.items():
            summary_data.append([f"  {source}", count])

        for row_idx, (label, value) in enumerate(summary_data, start=1):
            summary_sheet.write(row_idx, 0, label, normal_format)
            summary_sheet.write(row_idx, 1, value, normal_format)

        workbook.close()

        logger.info(f"导出耗材记录完成: {filename}, 共 {len(records)} 条记录")

        return {
            "filename": filename,
            "filepath": filepath,
            "record_count": len(records),
            "operator": operator,
            "export_time": datetime.now().isoformat()
        }

    def export_record_history(
        self,
        record_id: int,
        operator: str = "system"
    ) -> Dict[str, Any]:
        record = self.db.query(ConsumableRecord).filter(
            ConsumableRecord.id == record_id
        ).first()
        
        if not record:
            raise ValueError(f"记录不存在: {record_id}")

        filename = self._generate_export_filename(f"记录详情_{record.record_no}")
        filepath = os.path.join(settings.EXPORT_DIR, filename)

        workbook = xlsxwriter.Workbook(filepath)
        
        header_format = workbook.add_format({
            'bold': True,
            'bg_color': '#4472C4',
            'font_color': 'white',
            'border': 1
        })
        
        normal_format = workbook.add_format({'border': 1})

        info_sheet = workbook.add_worksheet("基本信息")
        
        info_data = [
            ["记录编号", record.record_no],
            ["耗材名称", record.consumable_name],
            ["规格型号", record.specification],
            ["数量", record.quantity],
            ["单位", record.unit],
            ["批号", record.batch_no],
            ["有效期", record.expire_date.strftime("%Y-%m-%d") if record.expire_date else ""],
            ["供应商", record.supplier],
            ["数据来源", record.data_source],
            ["当前状态", record.current_status],
            ["实验室", record.lab],
            ["课题组", record.research_group],
            ["是否重复", "是" if record.is_duplicate else "否"],
            ["原始文件名", record.original_file_name],
            ["原始行号", record.original_row_number],
            ["缺去向原因", record.missing_direction_reason or ""],
            ["借用损耗混合", "是" if record.borrow_loss_mixed else "否"],
            ["创建人", record.created_by],
            ["创建时间", record.created_at.strftime("%Y-%m-%d %H:%M:%S") if record.created_at else ""],
        ]
        
        for row_idx, (label, value) in enumerate(info_data):
            info_sheet.write(row_idx, 0, label, header_format)
            info_sheet.write(row_idx, 1, value, normal_format)
        
        info_sheet.set_column(0, 0, 20)
        info_sheet.set_column(1, 1, 40)

        status_sheet = workbook.add_worksheet("状态变更历史")
        
        status_headers = ["序号", "原状态", "新状态", "变更原因", "操作者", "变更时间", "备注"]
        for col, header in enumerate(status_headers):
            status_sheet.write(0, col, header, header_format)
            status_sheet.set_column(col, col, 15)

        for row_idx, history in enumerate(record.status_history, start=1):
            data = [
                row_idx,
                history.from_status,
                history.to_status,
                history.change_reason,
                history.operator,
                history.change_time.strftime("%Y-%m-%d %H:%M:%S") if history.change_time else "",
                history.remark or ""
            ]
            for col, value in enumerate(data):
                status_sheet.write(row_idx, col, value, normal_format)

        if record.import_evidence:
            evidence_sheet = workbook.add_worksheet("导入证据")
            
            evidence_sheet.write(0, 0, "来源文件名", header_format)
            evidence_sheet.write(0, 1, record.import_evidence.source_file_name, normal_format)
            evidence_sheet.write(1, 0, "来源行号", header_format)
            evidence_sheet.write(1, 1, record.import_evidence.source_row_number, normal_format)
            evidence_sheet.write(2, 0, "是否人工改判", header_format)
            evidence_sheet.write(2, 1, "是" if record.import_evidence.is_manual_corrected else "否", normal_format)
            
            evidence_sheet.set_column(0, 0, 20)
            evidence_sheet.set_column(1, 1, 50)

        audit_sheet = workbook.add_worksheet("审计日志")
        
        audit_headers = ["序号", "操作动作", "模块", "操作者", "操作时间", "差异数据", "备注"]
        for col, header in enumerate(audit_headers):
            audit_sheet.write(0, col, header, header_format)
            audit_sheet.set_column(col, col, 15)

        for row_idx, log in enumerate(record.audit_logs, start=1):
            data = [
                row_idx,
                log.action,
                log.module,
                log.operator,
                log.action_time.strftime("%Y-%m-%d %H:%M:%S") if log.action_time else "",
                str(log.diff_data) if log.diff_data else "",
                log.remark or ""
            ]
            for col, value in enumerate(data):
                audit_sheet.write(row_idx, col, value, normal_format)

        workbook.close()

        logger.info(f"导出记录详情完成: {filename}, 记录ID: {record_id}")

        return {
            "filename": filename,
            "filepath": filepath,
            "record_id": record_id,
            "record_no": record.record_no,
            "operator": operator,
            "export_time": datetime.now().isoformat()
        }

    def export_exceptions(
        self,
        status_filter: Optional[str] = None,
        operator: str = "system"
    ) -> Dict[str, Any]:
        filename = self._generate_export_filename("回放异常")
        filepath = os.path.join(settings.EXPORT_DIR, filename)

        query = self.db.query(ReplayException)
        
        if status_filter:
            query = query.filter(ReplayException.status == status_filter)
        
        exceptions = query.order_by(ReplayException.created_at.desc()).all()

        workbook = xlsxwriter.Workbook(filepath)
        
        header_format = workbook.add_format({
            'bold': True,
            'bg_color': '#C00000',
            'font_color': 'white',
            'border': 1
        })
        
        normal_format = workbook.add_format({'border': 1})

        worksheet = workbook.add_worksheet("异常列表")
        
        headers = [
            "异常编号", "异常类型", "异常描述", "关联记录ID",
            "状态", "处理方案", "处理人", "处理时间", "创建时间"
        ]
        
        for col, header in enumerate(headers):
            worksheet.write(0, col, header, header_format)
            worksheet.set_column(col, col, 20)

        for row_idx, exc in enumerate(exceptions, start=1):
            data = [
                exc.exception_code,
                exc.exception_type,
                exc.description,
                str(exc.related_record_ids) if exc.related_record_ids else "",
                exc.status,
                exc.resolution or "",
                exc.resolved_by or "",
                exc.resolved_at.strftime("%Y-%m-%d %H:%M:%S") if exc.resolved_at else "",
                exc.created_at.strftime("%Y-%m-%d %H:%M:%S") if exc.created_at else ""
            ]
            
            for col, value in enumerate(data):
                worksheet.write(row_idx, col, value, normal_format)

        diff_sheet = workbook.add_worksheet("修正前后对比")
        
        diff_headers = [
            "异常编号", "字段", "修正前", "修正后", "处理方案"
        ]
        
        for col, header in enumerate(diff_headers):
            diff_sheet.write(0, col, header, header_format)
            diff_sheet.set_column(col, col, 25)

        row_idx = 1
        for exc in exceptions:
            if exc.before_correction and exc.after_correction:
                all_keys = set(exc.before_correction.keys()) | set(exc.after_correction.keys())
                
                for key in all_keys:
                    before = exc.before_correction.get(key, "")
                    after = exc.after_correction.get(key, "")
                    
                    if before != after:
                        diff_sheet.write(row_idx, 0, exc.exception_code, normal_format)
                        diff_sheet.write(row_idx, 1, key, normal_format)
                        diff_sheet.write(row_idx, 2, str(before), normal_format)
                        diff_sheet.write(row_idx, 3, str(after), normal_format)
                        diff_sheet.write(row_idx, 4, exc.resolution or "", normal_format)
                        row_idx += 1

        workbook.close()

        logger.info(f"导出回放异常完成: {filename}, 共 {len(exceptions)} 条异常")

        return {
            "filename": filename,
            "filepath": filepath,
            "exception_count": len(exceptions),
            "operator": operator,
            "export_time": datetime.now().isoformat()
        }
