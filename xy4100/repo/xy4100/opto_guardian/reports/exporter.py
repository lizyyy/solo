"""报告导出器 - 支持Markdown/CSV/JSON格式"""

import csv
import json
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Optional

from ..models.validation import (
    BatchValidationResult,
    ValidationResult,
    ValidationSeverity,
)
from ..services.planning_service import ProcessingPlanResult


class ExportFormat(str, Enum):
    """导出格式"""
    MARKDOWN = "markdown"
    CSV = "csv"
    JSON = "json"


class ReportExporter:
    """报告导出器"""
    
    def __init__(self, work_dir: Optional[Path] = None):
        self.work_dir = work_dir or Path.cwd()
    
    def export_validation_result(
        self,
        result: ValidationResult,
        output_path: Path,
        format: ExportFormat = ExportFormat.MARKDOWN,
    ) -> Path:
        """导出单个校验结果
        
        Args:
            result: 校验结果
            output_path: 输出路径
            format: 导出格式
            
        Returns:
            输出文件路径
        """
        if format == ExportFormat.MARKDOWN:
            return self._export_validation_markdown(result, output_path)
        elif format == ExportFormat.CSV:
            return self._export_validation_csv([result], output_path)
        elif format == ExportFormat.JSON:
            return self._export_validation_json(result, output_path)
        else:
            raise ValueError(f"不支持的导出格式: {format}")
    
    def export_batch_result(
        self,
        batch_result: BatchValidationResult,
        output_path: Path,
        format: ExportFormat = ExportFormat.MARKDOWN,
    ) -> Path:
        """导出批量校验结果
        
        Args:
            batch_result: 批量校验结果
            output_path: 输出路径
            format: 导出格式
            
        Returns:
            输出文件路径
        """
        if format == ExportFormat.MARKDOWN:
            return self._export_batch_markdown(batch_result, output_path)
        elif format == ExportFormat.CSV:
            return self._export_validation_csv(batch_result.results, output_path)
        elif format == ExportFormat.JSON:
            return self._export_batch_json(batch_result, output_path)
        else:
            raise ValueError(f"不支持的导出格式: {format}")
    
    def export_processing_plan(
        self,
        plan: ProcessingPlanResult,
        output_path: Path,
        format: ExportFormat = ExportFormat.MARKDOWN,
    ) -> Path:
        """导出加工计划
        
        Args:
            plan: 加工计划
            output_path: 输出路径
            format: 导出格式
            
        Returns:
            输出文件路径
        """
        if format == ExportFormat.MARKDOWN:
            return self._export_plan_markdown(plan, output_path)
        elif format == ExportFormat.CSV:
            return self._export_plan_csv(plan, output_path)
        elif format == ExportFormat.JSON:
            return self._export_plan_json(plan, output_path)
        else:
            raise ValueError(f"不支持的导出格式: {format}")
    
    def _export_validation_markdown(
        self,
        result: ValidationResult,
        output_path: Path,
    ) -> Path:
        """导出校验结果为Markdown"""
        content = result.get_markdown_report()
        
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(content)
        
        return output_path
    
    def _export_batch_markdown(
        self,
        batch: BatchValidationResult,
        output_path: Path,
    ) -> Path:
        """导出批量校验结果为Markdown"""
        lines = []
        
        lines.append(f"# 批量校验报告\n")
        lines.append(f"- **批次ID**: {batch.batch_id}")
        lines.append(f"- **总订单数**: {batch.total_orders}")
        lines.append(f"- **通过**: {batch.passed_count}")
        lines.append(f"- **未通过**: {batch.failed_count}")
        lines.append(f"- **总错误**: {batch.total_errors}")
        lines.append(f"- **总警告**: {batch.total_warnings}")
        lines.append(f"- **校验时间**: {batch.started_at.strftime('%Y-%m-%d %H:%M:%S')}\n")
        
        if batch.failed_count > 0:
            lines.append("## ❌ 未通过订单详情\n")
            
            for result in batch.get_failed_orders():
                lines.append(f"### 订单 {result.order_id}\n")
                lines.append(f"- **错误数**: {result.error_count}")
                lines.append(f"- **警告数**: {result.warning_count}\n")
                
                errors = result.get_issues_by_severity(ValidationSeverity.ERROR)
                criticals = result.get_issues_by_severity(ValidationSeverity.CRITICAL)
                
                if criticals or errors:
                    lines.append("#### 错误\n")
                    for issue in criticals + errors:
                        lines.append(f"- **[{issue.category.value}]** {issue.message}")
                        if issue.detail:
                            lines.append(f"  - 详情: {issue.detail}")
                        if issue.suggested_fix:
                            lines.append(f"  - 建议: {issue.suggested_fix}")
                    lines.append("")
        
        lines.append("## 📊 详细结果\n")
        
        for result in batch.results:
            status = "✅" if result.passed else "❌"
            lines.append(f"### {status} 订单 {result.order_id}\n")
            lines.append(f"- 错误: {result.error_count}, 警告: {result.warning_count}, 信息: {result.info_count}\n")
            
            if result.issues:
                for issue in result.issues:
                    icon = "❌" if issue.severity in [ValidationSeverity.ERROR, ValidationSeverity.CRITICAL] else "⚠️" if issue.severity == ValidationSeverity.WARNING else "ℹ️"
                    lines.append(f"{icon} **[{issue.category.value}]** {issue.message}")
                lines.append("")
        
        content = "\n".join(lines)
        
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(content)
        
        return output_path
    
    def _export_validation_csv(
        self,
        results: list[ValidationResult],
        output_path: Path,
    ) -> Path:
        """导出校验结果为CSV"""
        rows = []
        
        for result in results:
            base_row = {
                "order_id": result.order_id,
                "prescription_id": result.prescription_id,
                "passed": "是" if result.passed else "否",
                "error_count": result.error_count,
                "warning_count": result.warning_count,
                "info_count": result.info_count,
                "checked_at": result.checked_at.isoformat(),
            }
            
            if result.issues:
                for issue in result.issues:
                    row = base_row.copy()
                    row.update({
                        "issue_category": issue.category.value,
                        "issue_severity": issue.severity.value,
                        "issue_message": issue.message,
                        "issue_detail": issue.detail or "",
                        "issue_location": issue.location or "",
                        "issue_affected_field": issue.affected_field or "",
                        "issue_suggested_fix": issue.suggested_fix or "",
                    })
                    rows.append(row)
            else:
                base_row.update({
                    "issue_category": "",
                    "issue_severity": "",
                    "issue_message": "",
                    "issue_detail": "",
                    "issue_location": "",
                    "issue_affected_field": "",
                    "issue_suggested_fix": "",
                })
                rows.append(base_row)
        
        fieldnames = [
            "order_id", "prescription_id", "passed",
            "error_count", "warning_count", "info_count",
            "checked_at",
            "issue_category", "issue_severity", "issue_message",
            "issue_detail", "issue_location", "issue_affected_field",
            "issue_suggested_fix",
        ]
        
        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        
        return output_path
    
    def _export_validation_json(
        self,
        result: ValidationResult,
        output_path: Path,
    ) -> Path:
        """导出校验结果为JSON"""
        data = result.to_dict()
        
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        return output_path
    
    def _export_batch_json(
        self,
        batch: BatchValidationResult,
        output_path: Path,
    ) -> Path:
        """导出批量校验结果为JSON"""
        data = {
            "summary": batch.get_summary(),
            "results": [r.to_dict() for r in batch.results],
        }
        
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        return output_path
    
    def _export_plan_markdown(
        self,
        plan: ProcessingPlanResult,
        output_path: Path,
    ) -> Path:
        """导出加工计划为Markdown"""
        lines = []
        
        lines.append(f"# 加工计划 - {plan.prescription_id}\n")
        lines.append(f"- **计划ID**: {plan.plan_id}")
        lines.append(f"- **生成时间**: {plan.created_at.strftime('%Y-%m-%d %H:%M:%S')}\n")
        
        lines.append("## 👁️ 处方详情\n")
        
        for eye_key, eye_name in [("right_eye", "右眼"), ("left_eye", "左眼")]:
            eye_data = getattr(plan, eye_key, {})
            if not eye_data:
                continue
            
            lines.append(f"### {eye_name}\n")
            
            sphere = eye_data.get("sphere", 0)
            cylinder = eye_data.get("cylinder", 0)
            axis = eye_data.get("axis")
            add = eye_data.get("add")
            
            power_str = f"球镜 {sphere:+}D"
            if abs(cylinder) > 0.001:
                power_str += f" 柱镜 {cylinder:+}D"
                if axis is not None:
                    power_str += f" 轴位 {axis}°"
            if add:
                power_str += f" 下加光 +{add}D"
            
            lines.append(f"- **度数**: {power_str}")
            lines.append(f"- **格式**: {eye_data.get('format', '负柱镜')}\n")
            
            recommended = eye_data.get("recommended_lens")
            if recommended:
                lines.append("#### 推荐镜片\n")
                lines.append(f"- **类型**: {recommended.get('lens_type')}")
                lines.append(f"- **材质**: {recommended.get('material')}")
                if recommended.get('brand'):
                    lines.append(f"- **品牌**: {recommended.get('brand')}")
                lines.append(f"- **直径**: {recommended.get('diameter')}mm")
                lines.append(f"- **库存**: {recommended.get('quantity_available')}片")
                if recommended.get('unit_price'):
                    lines.append(f"- **单价**: ¥{recommended.get('unit_price')}")
                lines.append("")
            
            alternatives = eye_data.get("alternative_lenses", [])
            if alternatives:
                lines.append("#### 替代镜片\n")
                for i, alt in enumerate(alternatives[:3], 1):
                    lines.append(f"{i}. {alt.get('lens_type')} / {alt.get('material')}")
                    if alt.get('closest_sphere') is not None:
                        lines.append(f"   - 建议度数: 球镜{alt.get('closest_sphere')}D, 柱镜{alt.get('closest_cylinder')}D")
                lines.append("")
        
        if plan.pd_adjustment:
            lines.append("## 📏 瞳距调整\n")
            pd_adj = plan.pd_adjustment
            lines.append(f"- **镜框几何中心距(BC)**: {pd_adj.get('box_center_distance')}mm")
            lines.append(f"- **右眼移心量**: {pd_adj.get('right_deviation'):.1f}mm")
            lines.append(f"- **左眼移心量**: {pd_adj.get('left_deviation'):.1f}mm")
            
            notes = pd_adj.get('notes', [])
            if notes:
                lines.append(f"- **说明**:")
                for note in notes:
                    lines.append(f"  - {note}")
            lines.append("")
        
        if plan.ph_adjustment:
            lines.append("## 📐 瞳高信息\n")
            ph_adj = plan.ph_adjustment
            lines.append(f"- **右眼瞳高**: {ph_adj.get('right_ph')}mm")
            lines.append(f"- **左眼瞳高**: {ph_adj.get('left_ph')}mm")
            lines.append(f"- **镜片高度**: {ph_adj.get('lens_height')}mm")
            lines.append(f"- **右眼比例**: {ph_adj.get('right_ratio')*100:.0f}%")
            lines.append(f"- **左眼比例**: {ph_adj.get('left_ratio')*100:.0f}%\n")
        
        if plan.estimated_lens_diameter:
            lines.append("## 🔍 镜片直径估算\n")
            diam = plan.estimated_lens_diameter
            lines.append(f"- **右眼所需直径**: {diam.get('right_eye'):.1f}mm")
            lines.append(f"- **左眼所需直径**: {diam.get('left_eye'):.1f}mm")
            lines.append(f"- **镜框宽度**: {diam.get('frame_eye_size')}mm\n")
        
        if plan.warnings:
            lines.append("## ⚠️ 警告\n")
            for warning in plan.warnings:
                lines.append(f"- {warning}")
            lines.append("")
        
        if plan.suggestions:
            lines.append("## 💡 建议\n")
            for suggestion in plan.suggestions:
                lines.append(f"- {suggestion}")
            lines.append("")
        
        if plan.total_estimated_cost:
            lines.append("## 💰 费用估算\n")
            lines.append(f"- **预估总成本**: ¥{plan.total_estimated_cost:.0f}\n")
        
        lines.append(f"## 📅 加工周期\n")
        lines.append(f"- **预估加工天数**: {plan.estimated_processing_days} 天\n")
        
        content = "\n".join(lines)
        
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(content)
        
        return output_path
    
    def _export_plan_csv(
        self,
        plan: ProcessingPlanResult,
        output_path: Path,
    ) -> Path:
        """导出加工计划为CSV"""
        rows = []
        
        base_row = {
            "plan_id": plan.plan_id,
            "prescription_id": plan.prescription_id,
            "created_at": plan.created_at.isoformat(),
            "estimated_cost": plan.total_estimated_cost or "",
            "estimated_days": plan.estimated_processing_days,
        }
        
        for eye_key, eye_name in [("right_eye", "右眼"), ("left_eye", "左眼")]:
            eye_data = getattr(plan, eye_key, {})
            if not eye_data:
                continue
            
            row = base_row.copy()
            row.update({
                "eye": eye_name,
                "sphere": eye_data.get("sphere"),
                "cylinder": eye_data.get("cylinder"),
                "axis": eye_data.get("axis") or "",
                "add": eye_data.get("add") or "",
                "format": eye_data.get("format"),
            })
            
            recommended = eye_data.get("recommended_lens")
            if recommended:
                row.update({
                    "recommended_lens_type": recommended.get("lens_type"),
                    "recommended_material": recommended.get("material"),
                    "recommended_brand": recommended.get("brand") or "",
                    "recommended_diameter": recommended.get("diameter"),
                    "recommended_quantity": recommended.get("quantity_available"),
                    "recommended_price": recommended.get("unit_price") or "",
                })
            
            rows.append(row)
        
        fieldnames = [
            "plan_id", "prescription_id", "created_at",
            "eye", "sphere", "cylinder", "axis", "add", "format",
            "recommended_lens_type", "recommended_material", "recommended_brand",
            "recommended_diameter", "recommended_quantity", "recommended_price",
            "estimated_cost", "estimated_days",
        ]
        
        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        
        return output_path
    
    def _export_plan_json(
        self,
        plan: ProcessingPlanResult,
        output_path: Path,
    ) -> Path:
        """导出加工计划为JSON"""
        data = plan.to_dict()
        
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        return output_path
