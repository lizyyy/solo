from datetime import datetime
from typing import List, Dict, Any, Optional
import os
import uuid

from pypdf import PdfReader

from models import (
    WorkOrder, WorkOrderStatus,
    PaperStock,
    MaintenanceRecord,
    CuttingTemplate,
    PreflightResult, PreflightCheck, PreflightStatus
)
from preflight import (
    FontChecker,
    PaperChecker,
    SizeChecker,
    MachineChecker
)


class PreflightEngine:
    def __init__(
        self,
        paper_stocks: List[PaperStock] = None,
        maintenance_records: List[MaintenanceRecord] = None,
        templates: List[CuttingTemplate] = None
    ):
        self.paper_stocks = paper_stocks or []
        self.maintenance_records = maintenance_records or []
        self.templates = templates or []
        
        self.font_checker = FontChecker()
        self.paper_checker = PaperChecker(paper_stocks)
        self.size_checker = SizeChecker(templates)
        self.machine_checker = MachineChecker(maintenance_records)
    
    def run_preflight(
        self,
        work_order: WorkOrder,
        pdf_reader: Optional[PdfReader] = None
    ) -> PreflightResult:
        result_id = f"PF{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        result = PreflightResult(
            id=result_id,
            work_order_id=work_order.id,
            started_at=datetime.now()
        )
        
        if pdf_reader is None and os.path.exists(work_order.file_path):
            try:
                pdf_reader = PdfReader(work_order.file_path)
                work_order.page_count = len(pdf_reader.pages)
            except Exception as e:
                work_order.add_note(f"无法读取PDF文件: {str(e)}")
        
        work_order.status = WorkOrderStatus.PREFLIGHT_RUNNING
        
        font_check = self.font_checker.check_fonts(work_order, pdf_reader)
        result.add_check(font_check)
        result.font_check = font_check.status
        
        if font_check.status == PreflightStatus.FAILED:
            result.missing_fonts = work_order.missing_fonts
        
        paper_check = self.paper_checker.check_paper(work_order)
        result.add_check(paper_check)
        result.paper_check = paper_check.status
        
        if paper_check.details:
            result.required_paper = paper_check.details.get("required_paper")
            result.paper_quantity_required = paper_check.details.get("required_quantity")
            result.paper_quantity_available = paper_check.details.get("available_quantity")
            result.paper_available = paper_check.status == PreflightStatus.PASSED
        
        size_check = self.size_checker.check_size(work_order, pdf_reader)
        result.add_check(size_check)
        result.size_check = size_check.status
        
        if size_check.status == PreflightStatus.FAILED and size_check.details:
            result.size_mismatch_details = size_check.details.get("mismatch_details")
        
        machine_check = self.machine_checker.check_machine(work_order)
        result.add_check(machine_check)
        result.machine_check = machine_check.status
        
        if machine_check.status == PreflightStatus.FAILED and machine_check.details:
            conflicts = machine_check.details.get("conflicts", [])
            result.conflicting_maintenance = [c.get("maintenance_id") for c in conflicts]
            result.machine_conflicts = [c.get("machine_name") for c in conflicts]
        
        result.mark_complete()
        
        if result.status == PreflightStatus.PASSED:
            work_order.status = WorkOrderStatus.PREFLIGHT_PASSED
        elif result.status == PreflightStatus.WARNING:
            work_order.status = WorkOrderStatus.REVIEW_PENDING
        else:
            work_order.status = WorkOrderStatus.PREFLIGHT_FAILED
        
        work_order.add_note(
            f"预检完成: 状态={result.status.value}, 得分={result.overall_score:.1f}分, 风险等级={result.risk_level}"
        )
        
        return result
    
    def update_paper_stocks(self, stocks: List[PaperStock]):
        self.paper_stocks = stocks
        self.paper_checker = PaperChecker(stocks)
    
    def update_maintenance_records(self, records: List[MaintenanceRecord]):
        self.maintenance_records = records
        self.machine_checker = MachineChecker(records)
    
    def update_templates(self, templates: List[CuttingTemplate]):
        self.templates = templates
        self.size_checker = SizeChecker(templates)
    
    def run_quick_check(
        self,
        work_order: WorkOrder,
        check_fonts: bool = True,
        check_paper: bool = True,
        check_size: bool = True,
        check_machine: bool = True
    ) -> Dict[str, Any]:
        results = {}
        pdf_reader = None
        
        if os.path.exists(work_order.file_path):
            try:
                pdf_reader = PdfReader(work_order.file_path)
            except Exception:
                pass
        
        if check_fonts:
            check = self.font_checker.check_fonts(work_order, pdf_reader)
            results["font_check"] = {
                "status": check.status.value,
                "message": check.message,
                "passed": check.status == PreflightStatus.PASSED
            }
        
        if check_paper:
            check = self.paper_checker.check_paper(work_order)
            results["paper_check"] = {
                "status": check.status.value,
                "message": check.message,
                "passed": check.status == PreflightStatus.PASSED
            }
        
        if check_size:
            check = self.size_checker.check_size(work_order, pdf_reader)
            results["size_check"] = {
                "status": check.status.value,
                "message": check.message,
                "passed": check.status == PreflightStatus.PASSED
            }
        
        if check_machine:
            check = self.machine_checker.check_machine(work_order)
            results["machine_check"] = {
                "status": check.status.value,
                "message": check.message,
                "passed": check.status == PreflightStatus.PASSED
            }
        
        all_passed = all(
            r.get("passed", False) for r in results.values()
        )
        
        results["overall"] = {
            "passed": all_passed,
            "check_count": len(results) - 1
        }
        
        return results


def run_preflight(
    work_order: WorkOrder,
    paper_stocks: List[PaperStock] = None,
    maintenance_records: List[MaintenanceRecord] = None,
    templates: List[CuttingTemplate] = None
) -> PreflightResult:
    engine = PreflightEngine(
        paper_stocks=paper_stocks,
        maintenance_records=maintenance_records,
        templates=templates
    )
    return engine.run_preflight(work_order)
