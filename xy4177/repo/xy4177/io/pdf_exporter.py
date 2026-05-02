# -*- coding: utf-8 -*-
"""
PDF导出器
"""

import io
from pathlib import Path
from typing import List, Optional
from reportlab.lib.pagesizes import letter, A4, landscape
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib.colors import black, gray, white, lightgray
from core.models import LabelPreview, LabelTemplate, SKUData, ValidationResult
from core.constants import ErrorLevel


class PDFExporter:
    """PDF导出器"""
    
    def __init__(self, page_size: str = 'A4', margin_mm: float = 10.0):
        self.page_size = A4 if page_size == 'A4' else letter
        self.margin = margin_mm * mm
    
    def _draw_label(
        self,
        c: canvas.Canvas,
        preview: LabelPreview,
        x: float,
        y: float,
        scale: float = 1.0
    ):
        """在PDF上绘制单个标签"""
        template = preview.template
        width = template.width_mm * mm * scale
        height = template.height_mm * mm * scale
        
        c.setStrokeColor(black)
        c.setLineWidth(1)
        c.rect(x, y - height, width, height)
        
        c.setStrokeColor(lightgray)
        c.setLineWidth(0.5)
        margin = template.margin_mm * mm * scale
        c.rect(x + margin, y - height + margin, width - 2 * margin, height - 2 * margin)
        
        data_dict = preview.sku_data.to_dict()
        c.setFillColor(black)
        
        for i, field in enumerate(template.fields[:5]):
            field_value = str(data_dict.get(field.name, ''))
            label_text = f"{field.name}: {field_value}"
            c.setFont("Helvetica", 8 * scale)
            c.drawString(x + 2 * mm, y - (i + 1) * 6 * mm - 2 * mm, label_text)
        
        c.setStrokeColor(gray)
        c.setLineWidth(0.5)
        c.rect(x + 5 * mm, y - height + 5 * mm, width - 10 * mm, 20 * mm)
        c.setFillColor(gray)
        c.setFont("Helvetica", 6)
        c.drawCentredString(x + width / 2, y - height + 12 * mm, "条码预览区域")
    
    def export_previews(
        self,
        previews: List[LabelPreview],
        output_path: str,
        labels_per_page: int = 6,
        include_errors: bool = True
    ):
        """导出标签预览到PDF"""
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        page_width, page_height = landscape(self.page_size)
        
        c = canvas.Canvas(str(path), pagesize=landscape(self.page_size))
        c.setTitle("标签预览")
        c.setAuthor("热敏标签排版预检台")
        
        cols = 3
        rows = 2
        label_width = (page_width - 2 * self.margin - (cols - 1) * 10 * mm) / cols
        label_height = (page_height - 2 * self.margin - (rows - 1) * 10 * mm) / rows
        
        for idx, preview in enumerate(previews):
            if idx > 0 and idx % labels_per_page == 0:
                c.showPage()
            
            page_idx = idx % labels_per_page
            col = page_idx % cols
            row = page_idx // cols
            
            x = self.margin + col * (label_width + 10 * mm)
            y = page_height - self.margin - row * (label_height + 10 * mm)
            
            template = preview.template
            scale = min(label_width / (template.width_mm * mm), 
                       label_height / (template.height_mm * mm))
            
            c.setFillColor(white)
            c.setStrokeColor(black)
            c.setLineWidth(1)
            c.rect(x, y - label_height, label_width, label_height, fill=1, stroke=1)
            
            actual_w = template.width_mm * mm * scale
            actual_h = template.height_mm * mm * scale
            offset_x = (label_width - actual_w) / 2
            offset_y = (label_height - actual_h) / 2
            
            self._draw_label(c, preview, x + offset_x, y - offset_y, scale)
            
            c.setFillColor(black)
            c.setFont("Helvetica-Bold", 10)
            c.drawString(x + 2 * mm, y - 2 * mm, f"箱号: {preview.sku_data.box_number}")
            
            c.setFont("Helvetica", 8)
            c.drawString(x + 2 * mm, y - label_height + 4 * mm, f"行号: {preview.sku_data.row_index}")
            
            if preview.validation_result:
                vr = preview.validation_result
                if vr.has_errors:
                    c.setFillColor((1, 0, 0))
                    c.drawRightString(x + label_width - 2 * mm, y - 2 * mm, f"错误: {len(vr.errors)}")
                elif vr.has_warnings:
                    c.setFillColor((1, 0.5, 0))
                    c.drawRightString(x + label_width - 2 * mm, y - 2 * mm, f"警告: {len(vr.warnings)}")
                else:
                    c.setFillColor((0, 0.6, 0))
                    c.drawRightString(x + label_width - 2 * mm, y - 2 * mm, "✓ 通过")
        
        c.save()
    
    def export_error_report(
        self,
        validation_results: List[ValidationResult],
        output_path: str
    ):
        """导出错误报告PDF"""
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        c = canvas.Canvas(str(path), pagesize=self.page_size)
        c.setTitle("校验错误报告")
        c.setAuthor("热敏标签排版预检台")
        
        page_width, page_height = self.page_size
        y = page_height - self.margin
        
        c.setFont("Helvetica-Bold", 18)
        c.drawCentredString(page_width / 2, y, "校验错误报告")
        y -= 30
        
        total_errors = sum(len(vr.errors) for vr in validation_results)
        total_warnings = sum(len(vr.warnings) for vr in validation_results)
        total_records = len(validation_results)
        valid_records = sum(1 for vr in validation_results if vr.is_valid)
        
        c.setFont("Helvetica", 12)
        c.drawString(self.margin, y, f"总记录数: {total_records}")
        y -= 15
        c.drawString(self.margin, y, f"通过记录: {valid_records}")
        y -= 15
        c.drawString(self.margin, y, f"错误总数: {total_errors}")
        y -= 15
        c.drawString(self.margin, y, f"警告总数: {total_warnings}")
        y -= 30
        
        c.setStrokeColor(black)
        c.setLineWidth(1)
        c.line(self.margin, y, page_width - self.margin, y)
        y -= 20
        
        for vr in validation_results:
            if not vr.has_errors and not vr.has_warnings:
                continue
            
            if y < self.margin + 50:
                c.showPage()
                y = page_height - self.margin
            
            c.setFont("Helvetica-Bold", 12)
            c.drawString(self.margin, y, f"箱号: {vr.sku_data.box_number} (行号: {vr.sku_data.row_index})")
            y -= 15
            
            c.setFont("Helvetica", 10)
            for error in vr.errors:
                c.setFillColor((1, 0, 0))
                c.drawString(self.margin + 10, y, f"[错误] {error.message}")
                y -= 12
            
            for warning in vr.warnings:
                c.setFillColor((1, 0.5, 0))
                c.drawString(self.margin + 10, y, f"[警告] {warning.message}")
                y -= 12
            
            c.setFillColor(black)
            y -= 10
        
        c.save()
