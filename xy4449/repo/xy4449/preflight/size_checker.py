from datetime import datetime
from typing import List, Dict, Any, Optional
import os

from models import PreflightCheck, PreflightStatus, CuttingTemplate


class SizeChecker:
    def __init__(self, templates: List[CuttingTemplate] = None):
        self.templates = templates or []
    
    def check_size(self, work_order, pdf_reader=None) -> PreflightCheck:
        check_name = "Size Matching Check"
        check_type = "size"
        
        pdf_width = getattr(work_order, 'paper_width', None)
        pdf_height = getattr(work_order, 'paper_height', None)
        
        if pdf_width is None or pdf_height is None:
            if pdf_reader:
                pdf_width, pdf_height = self._extract_page_size(pdf_reader)
                if pdf_width:
                    work_order.paper_width = pdf_width
                if pdf_height:
                    work_order.paper_height = pdf_height
        
        if pdf_width is None or pdf_height is None:
            return PreflightCheck(
                check_name=check_name,
                check_type=check_type,
                status=PreflightStatus.WARNING,
                message="无法获取PDF尺寸信息，无法进行尺寸检查",
                details={"note": "工单中未指定纸张尺寸，且无法从PDF提取"},
                severity="normal"
            )
        
        template_id = getattr(work_order, 'cutting_template_id', None)
        
        if template_id:
            template = self._find_template_by_id(template_id)
            if template:
                return self._check_against_template(
                    work_order, template, pdf_width, pdf_height
                )
            else:
                return PreflightCheck(
                    check_name=check_name,
                    check_type=check_type,
                    status=PreflightStatus.WARNING,
                    message=f"指定的裁切模板不存在: {template_id}",
                    details={
                        "pdf_width": pdf_width,
                        "pdf_height": pdf_height,
                        "requested_template": template_id
                    },
                    severity="normal"
                )
        
        matching_templates = self._find_matching_templates(pdf_width, pdf_height)
        
        if not matching_templates:
            return PreflightCheck(
                check_name=check_name,
                check_type=check_type,
                status=PreflightStatus.WARNING,
                message=f"未找到匹配的裁切模板 (尺寸: {pdf_width}x{pdf_height}mm)",
                details={
                    "pdf_width": pdf_width,
                    "pdf_height": pdf_height,
                    "available_templates": [
                        {"id": t.id, "name": t.name, "width": t.paper_width, "height": t.paper_height}
                        for t in self.templates
                    ]
                },
                severity="normal"
            )
        
        work_order.paper_width = pdf_width
        work_order.paper_height = pdf_height
        
        if len(matching_templates) == 1:
            template = matching_templates[0]
            work_order.cutting_template_id = template.id
            
            return PreflightCheck(
                check_name=check_name,
                check_type=check_type,
                status=PreflightStatus.PASSED,
                message=f"找到匹配的裁切模板: {template.name}",
                details={
                    "pdf_width": pdf_width,
                    "pdf_height": pdf_height,
                    "matched_template": {
                        "id": template.id,
                        "name": template.name,
                        "width": template.paper_width,
                        "height": template.paper_height,
                        "waste_percentage": template.waste_percentage
                    }
                },
                severity="normal"
            )
        else:
            return PreflightCheck(
                check_name=check_name,
                check_type=check_type,
                status=PreflightStatus.WARNING,
                message=f"找到 {len(matching_templates)} 个匹配的裁切模板，需人工确认",
                details={
                    "pdf_width": pdf_width,
                    "pdf_height": pdf_height,
                    "matching_templates": [
                        {"id": t.id, "name": t.name, "waste_percentage": t.waste_percentage}
                        for t in matching_templates
                    ]
                },
                severity="normal"
            )
    
    def _check_against_template(
        self,
        work_order,
        template: CuttingTemplate,
        pdf_width: float,
        pdf_height: float
    ) -> PreflightCheck:
        check_name = "Size Matching Check"
        check_type = "size"
        
        if template.matches_paper_size(pdf_width, pdf_height):
            return PreflightCheck(
                check_name=check_name,
                check_type=check_type,
                status=PreflightStatus.PASSED,
                message=f"PDF尺寸与裁切模板匹配: {template.name}",
                details={
                    "pdf_width": pdf_width,
                    "pdf_height": pdf_height,
                    "template": {
                        "id": template.id,
                        "name": template.name,
                        "width": template.paper_width,
                        "height": template.paper_height
                    }
                },
                severity="normal"
            )
        else:
            return PreflightCheck(
                check_name=check_name,
                check_type=check_type,
                status=PreflightStatus.FAILED,
                message=f"PDF尺寸与指定的裁切模板不匹配",
                details={
                    "pdf_width": pdf_width,
                    "pdf_height": pdf_height,
                    "required_template": {
                        "id": template.id,
                        "name": template.name,
                        "width": template.paper_width,
                        "height": template.paper_height
                    },
                    "mismatch_details": {
                        "expected": f"{template.paper_width}x{template.paper_height}mm",
                        "actual": f"{pdf_width}x{pdf_height}mm"
                    }
                },
                severity="high"
            )
    
    def _find_template_by_id(self, template_id: str) -> Optional[CuttingTemplate]:
        for template in self.templates:
            if template.id == template_id:
                return template
        return None
    
    def _find_matching_templates(
        self,
        width: float,
        height: float
    ) -> List[CuttingTemplate]:
        matching = []
        for template in self.templates:
            if template.matches_paper_size(width, height):
                matching.append(template)
        return matching
    
    def _extract_page_size(self, pdf_reader) -> tuple:
        try:
            if hasattr(pdf_reader, 'pages') and len(pdf_reader.pages) > 0:
                page = pdf_reader.pages[0]
                if hasattr(page, 'mediabox'):
                    mediabox = page.mediabox
                    
                    pdf_width = float(mediabox.width)
                    pdf_height = float(mediabox.height)
                    
                    width_mm = round(pdf_width * 25.4 / 72, 2)
                    height_mm = round(pdf_height * 25.4 / 72, 2)
                    
                    return width_mm, height_mm
        except Exception:
            pass
        
        return None, None
