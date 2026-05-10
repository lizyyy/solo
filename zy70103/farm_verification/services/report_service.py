from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from datetime import datetime
import os
from ..models.report import VerificationReport, ReportStatus
from ..models.lesion import LesionRecord, LesionStatus
from ..models.batch import ImageBatch
from ..models.verification import VerificationRecord, VerificationResult
from ..models.grid import FarmGrid


class ReportService:
    def __init__(self):
        pass
    
    def _generate_report_code(self) -> str:
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        import random
        suffix = random.randint(1000, 9999)
        return f"BG{timestamp}{suffix}"
    
    def generate_batch_report(
        self,
        db: Session,
        batch_code: str,
        generated_by: str,
        report_name: Optional[str] = None
    ) -> VerificationReport:
        batch = db.query(ImageBatch).filter(
            ImageBatch.batch_code == batch_code
        ).first()
        
        if not batch:
            raise ValueError(f"批次【{batch_code}】不存在")
        
        lesions = db.query(LesionRecord).filter(
            LesionRecord.batch_id == batch.id
        ).all()
        
        total_count = len(lesions)
        confirmed_count = 0
        false_positive_count = 0
        pending_count = 0
        total_area_m2 = 0.0
        confirmed_area_m2 = 0.0
        
        grid_summary = {}
        crop_type_summary = {}
        lesion_type_summary = {}
        
        for lesion in lesions:
            total_area_m2 += lesion.estimated_area_m2 or 0
            
            if lesion.status == LesionStatus.CONFIRMED:
                confirmed_count += 1
                confirmed_area_m2 += lesion.estimated_area_m2 or 0
            elif lesion.status == LesionStatus.FALSE_POSITIVE:
                false_positive_count += 1
            elif lesion.status == LesionStatus.PENDING:
                pending_count += 1
            
            if lesion.grid_code:
                grid_key = lesion.grid_code
                if grid_key not in grid_summary:
                    grid_summary[grid_key] = {
                        "grid_code": lesion.grid_code,
                        "grid_name": lesion.grid_name,
                        "total_count": 0,
                        "confirmed_count": 0,
                        "false_positive_count": 0,
                        "total_area_m2": 0.0
                    }
                grid_summary[grid_key]["total_count"] += 1
                if lesion.status == LesionStatus.CONFIRMED:
                    grid_summary[grid_key]["confirmed_count"] += 1
                    grid_summary[grid_key]["total_area_m2"] += lesion.estimated_area_m2 or 0
                elif lesion.status == LesionStatus.FALSE_POSITIVE:
                    grid_summary[grid_key]["false_positive_count"] += 1
            
            if lesion.lesion_type:
                type_key = lesion.lesion_type
                if type_key not in lesion_type_summary:
                    lesion_type_summary[type_key] = {
                        "lesion_type": lesion.lesion_type,
                        "count": 0,
                        "area_m2": 0.0
                    }
                lesion_type_summary[type_key]["count"] += 1
                lesion_type_summary[type_key]["area_m2"] += lesion.estimated_area_m2 or 0
        
        verification_completed = confirmed_count + false_positive_count
        verification_rate = (verification_completed / total_count * 100) if total_count > 0 else 0
        false_positive_rate = (false_positive_count / verification_completed * 100) if verification_completed > 0 else 0
        
        if not report_name:
            report_name = f"{batch.batch_name}_病斑核验报告_{datetime.now().strftime('%Y%m%d')}"
        
        report = VerificationReport(
            report_code=self._generate_report_code(),
            report_name=report_name,
            batch_id=batch.id,
            batch_code=batch.batch_code,
            flight_date=batch.flight_date,
            flight_area=batch.flight_area,
            total_lesion_count=total_count,
            confirmed_count=confirmed_count,
            false_positive_count=false_positive_count,
            pending_count=pending_count,
            total_area_m2=round(total_area_m2, 2),
            confirmed_area_m2=round(confirmed_area_m2, 2),
            verification_rate=round(verification_rate, 2),
            false_positive_rate=round(false_positive_rate, 2),
            grid_summary=list(grid_summary.values()),
            crop_type_summary=list(crop_type_summary.values()),
            lesion_type_summary=list(lesion_type_summary.values()),
            status=ReportStatus.COMPLETED,
            generated_by=generated_by
        )
        
        db.add(report)
        db.commit()
        db.refresh(report)
        
        return report
    
    def get_report_by_code(
        self,
        db: Session,
        report_code: str
    ) -> Optional[VerificationReport]:
        return db.query(VerificationReport).filter(
            VerificationReport.report_code == report_code
        ).first()
    
    def list_reports(
        self,
        db: Session,
        page: int = 1,
        page_size: int = 20,
        batch_code: Optional[str] = None,
        status: Optional[ReportStatus] = None,
        generated_by: Optional[str] = None
    ) -> Dict[str, Any]:
        query = db.query(VerificationReport)
        
        if batch_code:
            query = query.filter(VerificationReport.batch_code == batch_code)
        
        if status:
            query = query.filter(VerificationReport.status == status)
        
        if generated_by:
            query = query.filter(VerificationReport.generated_by == generated_by)
        
        total = query.count()
        total_pages = (total + page_size - 1) // page_size
        
        items = query.order_by(VerificationReport.generated_at.desc()).offset(
            (page - 1) * page_size
        ).limit(page_size).all()
        
        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "items": items
        }
    
    def export_report_to_excel(
        self,
        db: Session,
        report_code: str,
        output_dir: str = "./exports"
    ) -> Dict[str, Any]:
        from openpyxl import Workbook
        from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
        
        report = self.get_report_by_code(db, report_code)
        if not report:
            raise ValueError(f"报告【{report_code}】不存在")
        
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
        
        filename = f"{report.report_name}_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
        filepath = os.path.join(output_dir, filename)
        
        wb = Workbook()
        
        ws_summary = wb.active
        ws_summary.title = "报告概览"
        
        header_font = Font(bold=True, size=12)
        header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
        header_font_white = Font(bold=True, size=12, color="FFFFFF")
        center_alignment = Alignment(horizontal="center", vertical="center")
        thin_border = Border(
            left=Side(style='thin'),
            right=Side(style='thin'),
            top=Side(style='thin'),
            bottom=Side(style='thin')
        )
        
        ws_summary["A1"] = "农田遥感病斑核验报告"
        ws_summary["A1"].font = Font(bold=True, size=16)
        ws_summary.merge_cells("A1:F1")
        
        ws_summary["A3"] = "报告编号"
        ws_summary["B3"] = report.report_code
        ws_summary["A4"] = "报告名称"
        ws_summary["B4"] = report.report_name
        ws_summary["A5"] = "批次编号"
        ws_summary["B5"] = report.batch_code
        ws_summary["A6"] = "飞行日期"
        ws_summary["B6"] = report.flight_date.strftime("%Y-%m-%d") if report.flight_date else ""
        ws_summary["A7"] = "飞行区域"
        ws_summary["B7"] = report.flight_area
        ws_summary["A8"] = "生成时间"
        ws_summary["B8"] = report.generated_at.strftime("%Y-%m-%d %H:%M:%S")
        ws_summary["A9"] = "生成人"
        ws_summary["B9"] = report.generated_by
        
        ws_summary["A11"] = "核验统计"
        ws_summary["A11"].font = header_font
        ws_summary.merge_cells("A11:B11")
        
        stats_headers = ["统计项", "数值"]
        for col, header in enumerate(stats_headers, 1):
            cell = ws_summary.cell(row=12, column=col, value=header)
            cell.font = header_font_white
            cell.fill = header_fill
            cell.alignment = center_alignment
            cell.border = thin_border
        
        stats_data = [
            ["疑似病斑总数", report.total_lesion_count],
            ["确认为病斑", report.confirmed_count],
            ["误报数量", report.false_positive_count],
            ["待核验数量", report.pending_count],
            ["病斑总面积(平方米)", round(report.total_area_m2, 2)],
            ["确认病斑面积(平方米)", round(report.confirmed_area_m2, 2)],
            ["核验完成率(%)", f"{report.verification_rate}%"],
            ["误报率(%)", f"{report.false_positive_rate}%"]
        ]
        
        for row_idx, data in enumerate(stats_data, 13):
            for col_idx, value in enumerate(data, 1):
                cell = ws_summary.cell(row=row_idx, column=col_idx, value=value)
                cell.border = thin_border
                cell.alignment = center_alignment
        
        if report.grid_summary:
            ws_grid = wb.create_sheet("地块维度明细")
            grid_headers = ["地块编号", "地块名称", "疑似病斑数", "确认病斑数", "误报数", "确认病斑面积(平方米)"]
            for col, header in enumerate(grid_headers, 1):
                cell = ws_grid.cell(row=1, column=col, value=header)
                cell.font = header_font_white
                cell.fill = header_fill
                cell.alignment = center_alignment
                cell.border = thin_border
            
            for row_idx, grid_data in enumerate(report.grid_summary, 2):
                ws_grid.cell(row=row_idx, column=1, value=grid_data.get("grid_code", "")).border = thin_border
                ws_grid.cell(row=row_idx, column=2, value=grid_data.get("grid_name", "")).border = thin_border
                ws_grid.cell(row=row_idx, column=3, value=grid_data.get("total_count", 0)).border = thin_border
                ws_grid.cell(row=row_idx, column=4, value=grid_data.get("confirmed_count", 0)).border = thin_border
                ws_grid.cell(row=row_idx, column=5, value=grid_data.get("false_positive_count", 0)).border = thin_border
                ws_grid.cell(row=row_idx, column=6, value=round(grid_data.get("total_area_m2", 0), 2)).border = thin_border
        
        if report.lesion_type_summary:
            ws_type = wb.create_sheet("病斑类型明细")
            type_headers = ["病斑类型", "数量", "面积(平方米)"]
            for col, header in enumerate(type_headers, 1):
                cell = ws_type.cell(row=1, column=col, value=header)
                cell.font = header_font_white
                cell.fill = header_fill
                cell.alignment = center_alignment
                cell.border = thin_border
            
            for row_idx, type_data in enumerate(report.lesion_type_summary, 2):
                ws_type.cell(row=row_idx, column=1, value=type_data.get("lesion_type", "")).border = thin_border
                ws_type.cell(row=row_idx, column=2, value=type_data.get("count", 0)).border = thin_border
                ws_type.cell(row=row_idx, column=3, value=round(type_data.get("area_m2", 0), 2)).border = thin_border
        
        batch = db.query(ImageBatch).filter(ImageBatch.id == report.batch_id).first()
        if batch:
            ws_lesions = wb.create_sheet("病斑记录明细")
            lesion_headers = [
                "病斑编号", "地块编号", "地块名称", "经度", "纬度", "病斑类型", 
                "AI置信度", "预估面积(平方米)", "严重程度", "当前状态", "创建时间"
            ]
            for col, header in enumerate(lesion_headers, 1):
                cell = ws_lesions.cell(row=1, column=col, value=header)
                cell.font = header_font_white
                cell.fill = header_fill
                cell.alignment = center_alignment
                cell.border = thin_border
            
            lesions = db.query(LesionRecord).filter(LesionRecord.batch_id == batch.id).all()
            for row_idx, lesion in enumerate(lesions, 2):
                ws_lesions.cell(row=row_idx, column=1, value=lesion.lesion_code).border = thin_border
                ws_lesions.cell(row=row_idx, column=2, value=lesion.grid_code or "").border = thin_border
                ws_lesions.cell(row=row_idx, column=3, value=lesion.grid_name or "").border = thin_border
                ws_lesions.cell(row=row_idx, column=4, value=lesion.longitude).border = thin_border
                ws_lesions.cell(row=row_idx, column=5, value=lesion.latitude).border = thin_border
                ws_lesions.cell(row=row_idx, column=6, value=lesion.lesion_type or "").border = thin_border
                ws_lesions.cell(row=row_idx, column=7, value=lesion.confidence_score or 0).border = thin_border
                ws_lesions.cell(row=row_idx, column=8, value=lesion.estimated_area_m2 or 0).border = thin_border
                ws_lesions.cell(row=row_idx, column=9, value=lesion.severity_level or "").border = thin_border
                ws_lesions.cell(row=row_idx, column=10, value=lesion.status.value if lesion.status else "").border = thin_border
                ws_lesions.cell(row=row_idx, column=11, value=lesion.created_at.strftime("%Y-%m-%d %H:%M:%S") if lesion.created_at else "").border = thin_border
        
        ws_summary.column_dimensions["A"].width = 20
        ws_summary.column_dimensions["B"].width = 30
        
        wb.save(filepath)
        
        report.export_file_path = filepath
        report.export_file_name = filename
        report.export_format = "xlsx"
        db.commit()
        
        return {
            "success": True,
            "report_code": report.report_code,
            "file_path": filepath,
            "file_name": filename,
            "business_message": f"报告导出成功：{filename}，包含概览、地块明细、病斑类型明细和病斑记录明细共4个工作表"
        }


report_service = ReportService()
