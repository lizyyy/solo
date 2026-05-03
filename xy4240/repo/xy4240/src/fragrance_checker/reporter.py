"""
报告模块 - 负责导出 Markdown、CSV、JSON 格式的合规报告
"""

import csv
import json
import os
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from .models import (
    CalculationResult,
    CheckError,
    CheckResult,
    CheckWarning,
    Formula,
    IngredientCalculation,
)


class Reporter:
    """报告生成器"""
    
    def __init__(
        self,
        formula: Optional[Formula] = None,
        calculation_result: Optional[CalculationResult] = None,
        check_result: Optional[CheckResult] = None,
    ):
        """
        初始化报告生成器
        
        Args:
            formula: 配方数据
            calculation_result: 计算结果
            check_result: 检查结果
        """
        self.formula = formula
        self.calculation_result = calculation_result
        self.check_result = check_result
        self.generated_date = date.today()
    
    def generate_markdown(self) -> str:
        """生成 Markdown 格式报告"""
        lines = []
        
        # 标题
        lines.append("# 香精配方合规性报告")
        lines.append("")
        lines.append(f"**生成日期**: {self.generated_date.isoformat()}")
        lines.append("")
        
        # 配方信息
        if self.formula:
            lines.append("## 配方信息")
            lines.append("")
            lines.append(f"- **配方 ID**: {self.formula.id}")
            lines.append(f"- **配方名称**: {self.formula.name}")
            lines.append(f"- **版本**: {self.formula.version}")
            lines.append(f"- **创建日期**: {self.formula.created_date.isoformat()}")
            lines.append(f"- **原始总量**: {self.formula.total_amount} {self.formula.unit.value}")
            if self.formula.notes:
                lines.append(f"- **备注**: {self.formula.notes}")
            lines.append("")
        
        # 计算结果
        if self.calculation_result:
            lines.append("## 计算结果")
            lines.append("")
            lines.append(f"- **目标灌装量**: {self.calculation_result.target_amount} {self.calculation_result.target_unit.value}")
            lines.append(f"- **总成本**: ¥{self.calculation_result.total_cost:.2f}")
            lines.append(f"- **乙醇含量**: {self.calculation_result.ethanol_content:.2f}g ({self.calculation_result.ethanol_ratio*100:.1f}%)")
            lines.append(f"- **香精含量**: {self.calculation_result.fragrance_content:.2f}g ({self.calculation_result.fragrance_ratio*100:.1f}%)")
            lines.append("")
            
            # 原料明细
            lines.append("### 原料明细")
            lines.append("")
            lines.append("| 原料 ID | 原料名称 | 原用量 | 计算用量 | 占比 | 成本 |")
            lines.append("|---------|----------|--------|----------|------|------|")
            for ing in self.calculation_result.ingredient_details:
                cost_str = f"¥{ing.cost:.2f}" if ing.cost is not None else "-"
                lines.append(
                    f"| {ing.raw_material_id} | {ing.raw_material_name} | "
                    f"{ing.original_amount:.2f}{ing.original_unit.value} | "
                    f"{ing.calculated_amount:.4f}{ing.calculated_unit.value} | "
                    f"{ing.percentage*100:.2f}% | {cost_str} |"
                )
            lines.append("")
        
        # 检查结果
        if self.check_result:
            lines.append("## 合规性检查结果")
            lines.append("")
            
            if self.check_result.passed:
                lines.append("✅ **检查通过**")
            else:
                lines.append("❌ **检查未通过**")
            lines.append("")
            
            # 错误
            if self.check_result.errors:
                lines.append("### 错误")
                lines.append("")
                for i, error in enumerate(self.check_result.errors, 1):
                    lines.append(f"{i}. **[{error.code}]** {error.message}")
                    if error.context:
                        lines.append("   - 上下文: " + json.dumps(error.context, ensure_ascii=False))
                    lines.append("")
            
            # 警告
            if self.check_result.warnings:
                lines.append("### 警告")
                lines.append("")
                for i, warning in enumerate(self.check_result.warnings, 1):
                    lines.append(f"{i}. **[{warning.code}]** {warning.message}")
                    if warning.context:
                        lines.append("   - 上下文: " + json.dumps(warning.context, ensure_ascii=False))
                    lines.append("")
        
        # 标签建议
        if self.check_result and self.calculation_result:
            allergen_warnings = [
                w for w in self.check_result.warnings
                if w.code == "ALLERGEN_REPORTING_THRESHOLD"
            ]
            if allergen_warnings:
                lines.append("## 标签建议")
                lines.append("")
                lines.append("根据过敏原含量，建议在标签上标注以下成分：")
                lines.append("")
                for warning in allergen_warnings:
                    allergen_type = warning.context.get("allergen_type", "Unknown")
                    percentage = warning.context.get("total_percentage", 0)
                    lines.append(f"- **{allergen_type}** ({percentage*100:.2f}%)")
                lines.append("")
        
        return "\n".join(lines)
    
    def generate_csv(self, output_dir: str) -> List[str]:
        """
        生成 CSV 格式报告
        
        Args:
            output_dir: 输出目录
        
        Returns:
            List[str]: 生成的文件路径列表
        """
        generated_files = []
        
        # 确保输出目录存在
        os.makedirs(output_dir, exist_ok=True)
        
        # 1. 原料明细表
        if self.calculation_result:
            ingredients_path = os.path.join(output_dir, "ingredients.csv")
            with open(ingredients_path, 'w', encoding='utf-8', newline='') as f:
                writer = csv.writer(f)
                writer.writerow([
                    "原料 ID", "原料名称", "原用量", "原单位",
                    "计算用量(g)", "占比(%)", "成本(元)"
                ])
                for ing in self.calculation_result.ingredient_details:
                    writer.writerow([
                        ing.raw_material_id,
                        ing.raw_material_name,
                        f"{ing.original_amount:.4f}",
                        ing.original_unit.value,
                        f"{ing.calculated_amount:.4f}",
                        f"{ing.percentage*100:.2f}",
                        f"{ing.cost:.2f}" if ing.cost is not None else "",
                    ])
            generated_files.append(ingredients_path)
        
        # 2. 检查结果表
        if self.check_result:
            issues_path = os.path.join(output_dir, "issues.csv")
            with open(issues_path, 'w', encoding='utf-8', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(["类型", "错误码", "消息", "上下文"])
                
                for error in self.check_result.errors:
                    writer.writerow([
                        "错误",
                        error.code,
                        error.message,
                        json.dumps(error.context, ensure_ascii=False),
                    ])
                
                for warning in self.check_result.warnings:
                    writer.writerow([
                        "警告",
                        warning.code,
                        warning.message,
                        json.dumps(warning.context, ensure_ascii=False),
                    ])
            generated_files.append(issues_path)
        
        # 3. 摘要表
        summary_path = os.path.join(output_dir, "summary.csv")
        with open(summary_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(["项目", "值"])
            
            writer.writerow(["生成日期", self.generated_date.isoformat()])
            
            if self.formula:
                writer.writerow(["配方 ID", self.formula.id])
                writer.writerow(["配方名称", self.formula.name])
                writer.writerow(["版本", self.formula.version])
            
            if self.calculation_result:
                writer.writerow(["目标灌装量", f"{self.calculation_result.target_amount} {self.calculation_result.target_unit.value}"])
                writer.writerow(["总成本(元)", f"{self.calculation_result.total_cost:.2f}"])
                writer.writerow(["乙醇含量(g)", f"{self.calculation_result.ethanol_content:.2f}"])
                writer.writerow(["乙醇占比(%)", f"{self.calculation_result.ethanol_ratio*100:.1f}"])
                writer.writerow(["香精含量(g)", f"{self.calculation_result.fragrance_content:.2f}"])
                writer.writerow(["香精占比(%)", f"{self.calculation_result.fragrance_ratio*100:.1f}"])
            
            if self.check_result:
                writer.writerow(["检查结果", "通过" if self.check_result.passed else "未通过"])
                writer.writerow(["错误数量", str(len(self.check_result.errors))])
                writer.writerow(["警告数量", str(len(self.check_result.warnings))])
        
        generated_files.append(summary_path)
        
        return generated_files
    
    def generate_json(self) -> str:
        """生成 JSON 格式报告"""
        data: Dict[str, Any] = {
            "generated_date": self.generated_date.isoformat(),
        }
        
        # 配方信息
        if self.formula:
            data["formula"] = {
                "id": self.formula.id,
                "name": self.formula.name,
                "version": self.formula.version,
                "created_date": self.formula.created_date.isoformat(),
                "total_amount": self.formula.total_amount,
                "unit": self.formula.unit.value,
                "notes": self.formula.notes,
            }
        
        # 计算结果
        if self.calculation_result:
            data["calculation"] = {
                "formula_id": self.calculation_result.formula_id,
                "target_amount": self.calculation_result.target_amount,
                "target_unit": self.calculation_result.target_unit.value,
                "total_cost": self.calculation_result.total_cost,
                "ethanol_content": self.calculation_result.ethanol_content,
                "fragrance_content": self.calculation_result.fragrance_content,
                "ethanol_ratio": self.calculation_result.ethanol_ratio,
                "fragrance_ratio": self.calculation_result.fragrance_ratio,
                "ingredients": [
                    {
                        "raw_material_id": ing.raw_material_id,
                        "raw_material_name": ing.raw_material_name,
                        "original_amount": ing.original_amount,
                        "original_unit": ing.original_unit.value,
                        "calculated_amount": ing.calculated_amount,
                        "calculated_unit": ing.calculated_unit.value,
                        "cost": ing.cost,
                        "percentage": ing.percentage,
                    }
                    for ing in self.calculation_result.ingredient_details
                ],
            }
        
        # 检查结果
        if self.check_result:
            data["check"] = {
                "passed": self.check_result.passed,
                "errors": [
                    {
                        "code": e.code,
                        "message": e.message,
                        "severity": e.severity,
                        "context": e.context,
                    }
                    for e in self.check_result.errors
                ],
                "warnings": [
                    {
                        "code": w.code,
                        "message": w.message,
                        "severity": w.severity,
                        "context": w.context,
                    }
                    for w in self.check_result.warnings
                ],
            }
        
        return json.dumps(data, ensure_ascii=False, indent=2)
    
    def export_all(self, output_dir: str) -> Dict[str, List[str]]:
        """
        导出所有格式的报告
        
        Args:
            output_dir: 输出目录
        
        Returns:
            Dict[str, List[str]]: 格式到文件路径的映射
        """
        os.makedirs(output_dir, exist_ok=True)
        result: Dict[str, List[str]] = {}
        
        # Markdown
        md_content = self.generate_markdown()
        md_path = os.path.join(output_dir, "report.md")
        with open(md_path, 'w', encoding='utf-8') as f:
            f.write(md_content)
        result["markdown"] = [md_path]
        
        # CSV
        csv_files = self.generate_csv(output_dir)
        result["csv"] = csv_files
        
        # JSON
        json_content = self.generate_json()
        json_path = os.path.join(output_dir, "report.json")
        with open(json_path, 'w', encoding='utf-8') as f:
            f.write(json_content)
        result["json"] = [json_path]
        
        return result
