import csv
import io
import json
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from water_activity_cli.models import CalculationResult, ExportPackage, ValidationReport, Unit


class DecimalEncoder(json.JSONEncoder):
    def default(self, obj: Any) -> Any:
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


class MarkdownReporter:
    @staticmethod
    def generate(
        result: CalculationResult,
        validation_report: Optional[ValidationReport] = None,
        recipe_name: str = "",
    ) -> str:
        lines = []
        
        lines.append(f"# 水分活度配方校算报告")
        lines.append("")
        lines.append(f"**配方名称**: {result.recipe_name}")
        lines.append(f"**计算时间**: {result.timestamp}")
        lines.append("")
        
        lines.append("## 一、输入概览")
        lines.append("")
        lines.append("| 项目 | 数值 |")
        lines.append("|------|------|")
        lines.append(f"| 总投料量 | {float(result.total_input_weight):.2f} {result.total_input_weight_unit.value} |")
        lines.append(f"| 总干固物 | {float(result.total_dry_solids):.2f} g |")
        lines.append(f"| 总水分输入 | {float(result.total_water_input):.2f} g |")
        lines.append("")
        lines.append("### 初始含水率")
        lines.append("")
        lines.append(f"- **湿基**: {float(result.initial_moisture_wet_basis) * 100:.2f}%")
        lines.append(f"- **干基**: {float(result.initial_moisture_dry_basis) * 100:.2f}%")
        if result.initial_aw_estimate:
            lines.append(f"- **估算初始aw**: {float(result.initial_aw_estimate):.4f}")
        lines.append("")
        
        lines.append("## 二、烘烤损耗分析")
        lines.append("")
        lines.append("| 项目 | 数值 |")
        lines.append("|------|------|")
        lines.append(f"| 总损耗量 | {float(result.baking_loss_amount):.2f} g |")
        lines.append(f"| - 水分损耗 | {float(result.baking_water_loss):.2f} g |")
        lines.append(f"| - 干物质损耗 | {float(result.baking_solids_loss):.2f} g |")
        lines.append("")
        lines.append("### 烘烤后状态")
        lines.append("")
        lines.append(f"- **剩余水分**: {float(result.water_after_baking):.2f} g")
        lines.append(f"- **烘烤后总重**: {float(result.total_after_baking):.2f} g")
        lines.append(f"- **烘烤后含水率(湿基)**: {float(result.moisture_after_baking_wet) * 100:.2f}%")
        lines.append(f"- **烘烤后含水率(干基)**: {float(result.moisture_after_baking_dry) * 100:.2f}%")
        if result.aw_after_baking:
            lines.append(f"- **估算烘烤后aw**: {float(result.aw_after_baking):.4f}")
        lines.append("")
        
        lines.append("## 三、目标与调整")
        lines.append("")
        lines.append("### 目标参数")
        lines.append("")
        lines.append(f"- **目标水分活度 (aw)**: {float(result.final_aw):.4f}")
        lines.append(f"- **目标含水率(湿基)**: {float(result.target_moisture_wet_basis) * 100:.2f}%")
        lines.append(f"- **目标含水率(干基)**: {float(result.target_moisture_dry_basis) * 100:.2f}%")
        lines.append("")
        
        lines.append("### 调整建议")
        lines.append("")
        if result.adjustment_direction == "add":
            lines.append(f"⚠️ **需要补水**: {float(result.water_adjustment_needed):.2f} g")
        elif result.adjustment_direction == "remove":
            lines.append(f"⚠️ **需要排水/延长烘烤**: 需额外去除 {float(result.water_adjustment_needed):.2f} g 水分")
        else:
            lines.append("✅ **无需调整**: 当前水分已接近目标")
        lines.append("")
        
        lines.append("## 四、最终预测")
        lines.append("")
        lines.append("| 项目 | 数值 |")
        lines.append("|------|------|")
        lines.append(f"| 预期成品重量 | {float(result.final_expected_weight):.2f} g |")
        lines.append(f"| 预期成品含水率(湿基) | {float(result.final_moisture_wet) * 100:.2f}% |")
        lines.append(f"| 预期成品含水率(干基) | {float(result.final_moisture_dry) * 100:.2f}% |")
        lines.append(f"| 预期成品aw | {float(result.final_aw):.4f} |")
        lines.append("")
        
        if result.warnings:
            lines.append("## 五、警告事项")
            lines.append("")
            for i, warning in enumerate(result.warnings, 1):
                lines.append(f"{i}. ⚠️ {warning}")
            lines.append("")
        
        if validation_report and not validation_report.valid:
            lines.append("## 六、校验问题")
            lines.append("")
            for issue in validation_report.issues:
                level_icon = "❌" if issue.level == "error" else "⚠️"
                lines.append(f"- {level_icon} **[{issue.level.upper()}]** [{issue.category}]")
                lines.append(f"  {issue.message}")
                if issue.location:
                    lines.append(f"  - 位置: {issue.location}")
                if issue.suggestion:
                    lines.append(f"  - 建议: {issue.suggestion}")
                lines.append("")
        
        lines.append("---")
        lines.append(f"*报告由水分活度配方校算器生成*")
        
        return "\n".join(lines)


class CSVReporter:
    @staticmethod
    def generate(
        result: CalculationResult,
        validation_report: Optional[ValidationReport] = None,
    ) -> List[Dict[str, Any]]:
        rows = []
        
        rows.append({
            "category": "input",
            "parameter": "total_input_weight",
            "value": float(result.total_input_weight),
            "unit": result.total_input_weight_unit.value,
            "description": "总投料量",
        })
        rows.append({
            "category": "input",
            "parameter": "total_dry_solids",
            "value": float(result.total_dry_solids),
            "unit": "g",
            "description": "总干固物",
        })
        rows.append({
            "category": "input",
            "parameter": "total_water_input",
            "value": float(result.total_water_input),
            "unit": "g",
            "description": "总水分输入",
        })
        rows.append({
            "category": "input",
            "parameter": "initial_moisture_wet_basis",
            "value": float(result.initial_moisture_wet_basis),
            "unit": "decimal",
            "description": "初始湿基含水率",
        })
        rows.append({
            "category": "input",
            "parameter": "initial_moisture_dry_basis",
            "value": float(result.initial_moisture_dry_basis),
            "unit": "decimal",
            "description": "初始干基含水率",
        })
        if result.initial_aw_estimate:
            rows.append({
                "category": "input",
                "parameter": "initial_aw_estimate",
                "value": float(result.initial_aw_estimate),
                "unit": "aw",
                "description": "估算初始水分活度",
            })
        
        rows.append({
            "category": "baking",
            "parameter": "total_loss",
            "value": float(result.baking_loss_amount),
            "unit": "g",
            "description": "总损耗量",
        })
        rows.append({
            "category": "baking",
            "parameter": "water_loss",
            "value": float(result.baking_water_loss),
            "unit": "g",
            "description": "水分损耗",
        })
        rows.append({
            "category": "baking",
            "parameter": "solids_loss",
            "value": float(result.baking_solids_loss),
            "unit": "g",
            "description": "干物质损耗",
        })
        rows.append({
            "category": "baking",
            "parameter": "water_after_baking",
            "value": float(result.water_after_baking),
            "unit": "g",
            "description": "烘烤后剩余水分",
        })
        rows.append({
            "category": "baking",
            "parameter": "total_after_baking",
            "value": float(result.total_after_baking),
            "unit": "g",
            "description": "烘烤后总重",
        })
        
        rows.append({
            "category": "target",
            "parameter": "target_aw",
            "value": float(result.final_aw),
            "unit": "aw",
            "description": "目标水分活度",
        })
        rows.append({
            "category": "target",
            "parameter": "target_moisture_wet",
            "value": float(result.target_moisture_wet_basis),
            "unit": "decimal",
            "description": "目标湿基含水率",
        })
        rows.append({
            "category": "target",
            "parameter": "target_moisture_dry",
            "value": float(result.target_moisture_dry_basis),
            "unit": "decimal",
            "description": "目标干基含水率",
        })
        
        rows.append({
            "category": "adjustment",
            "parameter": "adjustment_direction",
            "value": result.adjustment_direction,
            "unit": "",
            "description": "调整方向",
        })
        rows.append({
            "category": "adjustment",
            "parameter": "water_adjustment_needed",
            "value": float(result.water_adjustment_needed),
            "unit": "g",
            "description": "需调整水量",
        })
        
        rows.append({
            "category": "final",
            "parameter": "final_expected_weight",
            "value": float(result.final_expected_weight),
            "unit": "g",
            "description": "预期成品重量",
        })
        rows.append({
            "category": "final",
            "parameter": "final_moisture_wet",
            "value": float(result.final_moisture_wet),
            "unit": "decimal",
            "description": "最终湿基含水率",
        })
        rows.append({
            "category": "final",
            "parameter": "final_moisture_dry",
            "value": float(result.final_moisture_dry),
            "unit": "decimal",
            "description": "最终干基含水率",
        })
        rows.append({
            "category": "final",
            "parameter": "final_aw",
            "value": float(result.final_aw),
            "unit": "aw",
            "description": "最终水分活度",
        })
        
        return rows


class JSONReporter:
    @staticmethod
    def generate(
        result: CalculationResult,
        validation_report: Optional[ValidationReport] = None,
    ) -> Dict[str, Any]:
        data = {
            "recipe_name": result.recipe_name,
            "timestamp": result.timestamp,
            "input": {
                "total_input_weight": float(result.total_input_weight),
                "total_input_weight_unit": result.total_input_weight_unit.value,
                "total_dry_solids": float(result.total_dry_solids),
                "total_water_input": float(result.total_water_input),
                "initial_moisture_wet_basis": float(result.initial_moisture_wet_basis),
                "initial_moisture_dry_basis": float(result.initial_moisture_dry_basis),
            },
            "baking": {
                "total_loss": float(result.baking_loss_amount),
                "water_loss": float(result.baking_water_loss),
                "solids_loss": float(result.baking_solids_loss),
                "water_after_baking": float(result.water_after_baking),
                "total_after_baking": float(result.total_after_baking),
                "moisture_after_baking_wet": float(result.moisture_after_baking_wet),
                "moisture_after_baking_dry": float(result.moisture_after_baking_dry),
            },
            "target": {
                "target_aw": float(result.final_aw),
                "target_moisture_wet_basis": float(result.target_moisture_wet_basis),
                "target_moisture_dry_basis": float(result.target_moisture_dry_basis),
            },
            "adjustment": {
                "direction": result.adjustment_direction,
                "water_amount_grams": float(result.water_adjustment_needed),
            },
            "final": {
                "expected_weight_grams": float(result.final_expected_weight),
                "moisture_wet_basis": float(result.final_moisture_wet),
                "moisture_dry_basis": float(result.final_moisture_dry),
                "aw": float(result.final_aw),
            },
            "warnings": result.warnings,
            "safety_checks": result.safety_checks,
        }
        
        if result.initial_aw_estimate:
            data["input"]["initial_aw_estimate"] = float(result.initial_aw_estimate)
        if result.aw_after_baking:
            data["baking"]["aw_after_baking"] = float(result.aw_after_baking)
        
        if validation_report:
            data["validation"] = {
                "valid": validation_report.valid,
                "summary": validation_report.summary,
                "issues": [
                    {
                        "level": i.level,
                        "category": i.category,
                        "message": i.message,
                        "location": i.location,
                        "suggestion": i.suggestion,
                    }
                    for i in validation_report.issues
                ],
            }
        
        return data


class ReportExporter:
    @staticmethod
    def export_package(
        result: CalculationResult,
        validation_report: Optional[ValidationReport] = None,
    ) -> ExportPackage:
        markdown = MarkdownReporter.generate(result, validation_report)
        csv_content = CSVReporter.generate(result, validation_report)
        json_content = JSONReporter.generate(result, validation_report)
        
        return ExportPackage(
            markdown=markdown,
            csv_content=csv_content,
            json_content=json_content,
        )
    
    @staticmethod
    def write_to_files(
        package: ExportPackage,
        output_dir: Union[str, Path],
        base_name: str = "calculation_report",
    ) -> List[Path]:
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        written_files = []
        
        md_path = output_path / f"{base_name}.md"
        md_path.write_text(package.markdown, encoding="utf-8")
        written_files.append(md_path)
        
        csv_path = output_path / f"{base_name}.csv"
        fieldnames = ["category", "parameter", "value", "unit", "description"]
        with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(package.csv_content)
        written_files.append(csv_path)
        
        json_path = output_path / f"{base_name}.json"
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(package.json_content, f, cls=DecimalEncoder, indent=2, ensure_ascii=False)
        written_files.append(json_path)
        
        return written_files
