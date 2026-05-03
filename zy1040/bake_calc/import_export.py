"""
导入导出模块 - CSV/JSON 导入导出，支持字段校验
"""

import json
import csv
from typing import Dict, List, Any, Tuple, Optional
from pathlib import Path
from datetime import datetime

from .models import (
    Ingredient, Recipe, RecipeIngredient, RecipeCostAnalysis,
    ReplacementResult, AllergenType, DietaryLabel
)
from .manager import BakeCalculator


class ImportExportManager:
    """导入导出管理器"""
    
    def __init__(self, calculator: BakeCalculator):
        self.calculator = calculator
    
    # ==================== 导入功能 ====================
    
    def validate_ingredient_row(self, row: Dict[str, Any], row_num: int) -> Tuple[bool, List[str]]:
        """校验单条原料数据"""
        errors = []
        warnings = []
        
        required_fields = ["name", "unit", "current_price", "supplier"]
        for field in required_fields:
            if field not in row or not row[field]:
                errors.append(f"第 {row_num} 行: 缺少必填字段 '{field}'")
        
        if "current_price" in row and row["current_price"]:
            try:
                price = float(row["current_price"])
                if price < 0:
                    errors.append(f"第 {row_num} 行: 价格不能为负数: {price}")
            except (ValueError, TypeError):
                errors.append(f"第 {row_num} 行: 价格格式无效: {row['current_price']}")
        
        if "allergens" in row and row["allergens"]:
            allergen_values = [a.value for a in AllergenType]
            allergen_list = str(row["allergens"]).split(",")
            for allergen in allergen_list:
                allergen = allergen.strip()
                if allergen and allergen not in allergen_values:
                    warnings.append(f"第 {row_num} 行: 未知过敏原类型 '{allergen}'，已忽略")
        
        if "dietary_labels" in row and row["dietary_labels"]:
            label_values = [d.value for d in DietaryLabel]
            label_list = str(row["dietary_labels"]).split(",")
            for label in label_list:
                label = label.strip()
                if label and label not in label_values:
                    warnings.append(f"第 {row_num} 行: 未知饮食标签 '{label}'，已忽略")
        
        is_valid = len(errors) == 0
        return is_valid, errors + [f"警告: {w}" for w in warnings]
    
    def import_ingredients_from_csv(self, filepath: str) -> Dict[str, Any]:
        """从 CSV 导入原料"""
        path = Path(filepath)
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {filepath}")
        
        results = {
            "success": 0,
            "failed": 0,
            "errors": [],
            "imported_ids": []
        }
        
        with open(path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            
            for row_num, row in enumerate(reader, start=2):
                is_valid, messages = self.validate_ingredient_row(row, row_num)
                
                for msg in messages:
                    if msg.startswith("警告:"):
                        results["errors"].append(msg)
                    else:
                        results["errors"].append(f"错误: {msg}")
                
                if not is_valid:
                    results["failed"] += 1
                    continue
                
                try:
                    allergens = []
                    if row.get("allergens"):
                        allergen_values = {a.value: a for a in AllergenType}
                        for a in str(row["allergens"]).split(","):
                            a = a.strip()
                            if a in allergen_values:
                                allergens.append(allergen_values[a])
                    
                    dietary_labels = []
                    if row.get("dietary_labels"):
                        label_values = {d.value: d for d in DietaryLabel}
                        for d in str(row["dietary_labels"]).split(","):
                            d = d.strip()
                            if d in label_values:
                                dietary_labels.append(label_values[d])
                    
                    is_substitutable = True
                    if row.get("is_substitutable"):
                        sub_val = str(row["is_substitutable"]).lower()
                        is_substitutable = sub_val not in ["false", "no", "0", ""]
                    
                    existing = self.calculator.find_ingredient_by_name(row["name"])
                    if existing:
                        ingredient = self.calculator.update_ingredient(
                            existing[0].id,
                            name=row["name"],
                            unit=row["unit"],
                            current_price=float(row["current_price"]),
                            supplier=row["supplier"],
                            allergens=allergens,
                            dietary_labels=dietary_labels,
                            is_substitutable=is_substitutable,
                            notes=row.get("notes", "")
                        )
                    else:
                        ingredient = self.calculator.add_ingredient(
                            name=row["name"],
                            unit=row["unit"],
                            current_price=float(row["current_price"]),
                            supplier=row["supplier"],
                            allergens=allergens,
                            dietary_labels=dietary_labels,
                            is_substitutable=is_substitutable,
                            notes=row.get("notes", "")
                        )
                    
                    results["imported_ids"].append(ingredient.id)
                    results["success"] += 1
                    
                except Exception as e:
                    results["failed"] += 1
                    results["errors"].append(f"错误: 第 {row_num} 行导入失败 - {str(e)}")
        
        return results
    
    def import_ingredients_from_json(self, filepath: str) -> Dict[str, Any]:
        """从 JSON 导入原料"""
        path = Path(filepath)
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {filepath}")
        
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        results = {
            "success": 0,
            "failed": 0,
            "errors": [],
            "imported_ids": []
        }
        
        ingredients_list = data.get("ingredients", []) if isinstance(data, dict) else data
        
        for i, item in enumerate(ingredients_list):
            row_num = i + 2
            
            is_valid, messages = self.validate_ingredient_row(item, row_num)
            for msg in messages:
                if msg.startswith("警告:"):
                    results["errors"].append(msg)
                else:
                    results["errors"].append(f"错误: {msg}")
            
            if not is_valid:
                results["failed"] += 1
                continue
            
            try:
                allergens = []
                if item.get("allergens"):
                    allergen_values = {a.value: a for a in AllergenType}
                    for a in item["allergens"]:
                        if isinstance(a, str) and a in allergen_values:
                            allergens.append(allergen_values[a])
                        elif isinstance(a, AllergenType):
                            allergens.append(a)
                
                dietary_labels = []
                if item.get("dietary_labels"):
                    label_values = {d.value: d for d in DietaryLabel}
                    for d in item["dietary_labels"]:
                        if isinstance(d, str) and d in label_values:
                            dietary_labels.append(label_values[d])
                        elif isinstance(d, DietaryLabel):
                            dietary_labels.append(d)
                
                existing = self.calculator.find_ingredient_by_name(item["name"])
                if existing:
                    ingredient = self.calculator.update_ingredient(
                        existing[0].id,
                        name=item["name"],
                        unit=item["unit"],
                        current_price=float(item["current_price"]),
                        supplier=item["supplier"],
                        allergens=allergens,
                        dietary_labels=dietary_labels,
                        is_substitutable=item.get("is_substitutable", True),
                        notes=item.get("notes", "")
                    )
                else:
                    ingredient = self.calculator.add_ingredient(
                        name=item["name"],
                        unit=item["unit"],
                        current_price=float(item["current_price"]),
                        supplier=item["supplier"],
                        allergens=allergens,
                        dietary_labels=dietary_labels,
                        is_substitutable=item.get("is_substitutable", True),
                        notes=item.get("notes", "")
                    )
                
                results["imported_ids"].append(ingredient.id)
                results["success"] += 1
                
            except Exception as e:
                results["failed"] += 1
                results["errors"].append(f"错误: 第 {row_num} 项导入失败 - {str(e)}")
        
        return results
    
    # ==================== 导出功能 ====================
    
    def export_ingredients_to_csv(self, filepath: str) -> str:
        """导出原料到 CSV"""
        ingredients = self.calculator.get_all_ingredients()
        
        rows = []
        for ing in ingredients:
            rows.append({
                "id": ing.id,
                "name": ing.name,
                "unit": ing.unit,
                "current_price": ing.current_price,
                "supplier": ing.supplier,
                "allergens": ",".join([a.value for a in ing.allergens]),
                "dietary_labels": ",".join([d.value for d in ing.dietary_labels]),
                "is_substitutable": "是" if ing.is_substitutable else "否",
                "substitute_ids": ",".join(ing.substitute_ids),
                "notes": ing.notes,
                "created_at": ing.created_at.strftime("%Y-%m-%d %H:%M:%S")
            })
        
        if not rows:
            fieldnames = [
                "id", "name", "unit", "current_price", "supplier",
                "allergens", "dietary_labels", "is_substitutable",
                "substitute_ids", "notes", "created_at"
            ]
            with open(filepath, "w", encoding="utf-8-sig", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
        else:
            with open(filepath, "w", encoding="utf-8-sig", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=rows[0].keys())
                writer.writeheader()
                writer.writerows(rows)
        
        return filepath
    
    def export_recipes_to_csv(self, filepath: str, include_ingredients: bool = True) -> str:
        """导出配方到 CSV"""
        recipes = self.calculator.get_all_recipes()
        
        if include_ingredients:
            rows = []
            for recipe in recipes:
                for ri in recipe.ingredients:
                    ing = self.calculator.get_ingredient(ri.ingredient_id)
                    ing_name = ing.name if ing else ri.ingredient_id
                    ing_unit = ing.unit if ing else ""
                    
                    rows.append({
                        "recipe_id": recipe.id,
                        "sku": recipe.sku,
                        "recipe_name": recipe.name,
                        "description": recipe.description,
                        "yield_quantity": recipe.yield_quantity,
                        "yield_unit": recipe.yield_unit,
                        "target_price": recipe.target_price,
                        "ingredient_id": ri.ingredient_id,
                        "ingredient_name": ing_name,
                        "quantity": ri.quantity,
                        "unit": ing_unit,
                        "waste_rate": ri.waste_rate,
                        "notes": recipe.notes
                    })
            
            if rows:
                with open(filepath, "w", encoding="utf-8-sig", newline="") as f:
                    writer = csv.DictWriter(f, fieldnames=rows[0].keys())
                    writer.writeheader()
                    writer.writerows(rows)
        else:
            rows = []
            for recipe in recipes:
                rows.append({
                    "recipe_id": recipe.id,
                    "sku": recipe.sku,
                    "name": recipe.name,
                    "description": recipe.description,
                    "yield_quantity": recipe.yield_quantity,
                    "yield_unit": recipe.yield_unit,
                    "target_price": recipe.target_price,
                    "ingredient_count": len(recipe.ingredients),
                    "notes": recipe.notes
                })
            
            if rows:
                with open(filepath, "w", encoding="utf-8-sig", newline="") as f:
                    writer = csv.DictWriter(f, fieldnames=rows[0].keys())
                    writer.writeheader()
                    writer.writerows(rows)
        
        return filepath
    
    def export_recipe_cost_analysis(
        self,
        recipe_id: str,
        filepath: str,
        format: str = "markdown"
    ) -> str:
        """导出配方成本分析
        
        支持格式: markdown, html, csv
        """
        analysis = self.calculator.calculate_recipe_cost(recipe_id)
        
        if format == "csv":
            return self._export_cost_analysis_csv(analysis, filepath)
        elif format == "html":
            return self._export_cost_analysis_html(analysis, filepath)
        else:
            return self._export_cost_analysis_markdown(analysis, filepath)
    
    def _export_cost_analysis_csv(self, analysis: RecipeCostAnalysis, filepath: str) -> str:
        """导出成本分析为 CSV"""
        summary_rows = [
            {"项目": "配方名称", "值": analysis.recipe_name},
            {"项目": "SKU", "值": analysis.sku},
            {"项目": "理论成本", "值": f"¥{analysis.theoretical_cost:.2f}"},
            {"项目": "实际成本", "值": f"¥{analysis.actual_cost:.2f}"},
            {"项目": "目标售价", "值": f"¥{analysis.target_price:.2f}"},
            {"项目": "理论毛利率", "值": f"{analysis.theoretical_margin * 100:.1f}%"},
            {"项目": "实际毛利率", "值": f"{analysis.actual_margin * 100:.1f}%"},
            {"项目": "产量", "值": f"{analysis.yield_quantity} {analysis.yield_unit}"},
            {"项目": "单位成本", "值": f"¥{analysis.cost_per_unit:.2f}/{analysis.yield_unit}"},
            {"项目": "过敏原", "值": ",".join([a.value for a in analysis.allergens])},
            {"项目": "饮食标签", "值": ",".join([d.value for d in analysis.dietary_labels])},
        ]
        
        summary_file = filepath.replace(".csv", "_summary.csv")
        with open(summary_file, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["项目", "值"])
            writer.writeheader()
            writer.writerows(summary_rows)
        
        breakdown_rows = []
        for item in analysis.ingredient_breakdown:
            breakdown_rows.append({
                "原料名称": item["ingredient_name"],
                "用量": f"{item['quantity']} {item['unit']}",
                "损耗率": f"{item['waste_rate'] * 100:.0f}%",
                "实际用量": f"{item['actual_quantity']:.2f} {item['unit']}",
                "单价": f"¥{item['unit_price']:.2f}/{item['unit']}",
                "理论成本": f"¥{item['cost']:.2f}",
                "实际成本": f"¥{item['actual_cost']:.2f}",
                "供应商": item["supplier"]
            })
        
        breakdown_file = filepath.replace(".csv", "_breakdown.csv")
        with open(breakdown_file, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=[
                "原料名称", "用量", "损耗率", "实际用量", 
                "单价", "理论成本", "实际成本", "供应商"
            ])
            writer.writeheader()
            writer.writerows(breakdown_rows)
        
        return summary_file
    
    def _export_cost_analysis_markdown(self, analysis: RecipeCostAnalysis, filepath: str) -> str:
        """导出成本分析为 Markdown"""
        lines = [
            f"# {analysis.recipe_name} 成本分析报告",
            "",
            f"> SKU: {analysis.sku}",
            f"> 分析时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "",
            "## 核心指标",
            "",
            "| 指标 | 数值 |",
            "|------|------|",
            f"| 理论成本 | ¥{analysis.theoretical_cost:.2f} |",
            f"| 实际成本 | ¥{analysis.actual_cost:.2f} |",
            f"| 目标售价 | ¥{analysis.target_price:.2f} |",
            f"| 理论毛利率 | {analysis.theoretical_margin * 100:.1f}% |",
            f"| 实际毛利率 | {analysis.actual_margin * 100:.1f}% |",
            "",
            "## 产量信息",
            "",
            f"- 批次产量: {analysis.yield_quantity} {analysis.yield_unit}",
            f"- 单位成本: ¥{analysis.cost_per_unit:.2f}/{analysis.yield_unit}",
            "",
            "## 原料成本明细",
            "",
            "| 原料 | 用量 | 损耗率 | 实际用量 | 单价 | 理论成本 | 实际成本 |",
            "|------|------|--------|----------|------|----------|----------|",
        ]
        
        for item in analysis.ingredient_breakdown:
            lines.append(
                f"| {item['ingredient_name']} | {item['quantity']} {item['unit']} | "
                f"{item['waste_rate'] * 100:.0f}% | {item['actual_quantity']:.2f} {item['unit']} | "
                f"¥{item['unit_price']:.2f}/{item['unit']} | ¥{item['cost']:.2f} | ¥{item['actual_cost']:.2f} |"
            )
        
        lines.extend([
            "",
            "## 过敏原信息",
            "",
        ])
        
        if analysis.allergens:
            for allergen in analysis.allergens:
                lines.append(f"- ⚠️ {allergen.value}")
        else:
            lines.append("- 无已知过敏原")
        
        lines.extend([
            "",
            "## 饮食标签",
            "",
        ])
        
        if analysis.dietary_labels:
            for label in analysis.dietary_labels:
                lines.append(f"- ✅ {label.value}")
        else:
            lines.append("- 无特殊饮食标签")
        
        lines.append("")
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        
        return filepath
    
    def _export_cost_analysis_html(self, analysis: RecipeCostAnalysis, filepath: str) -> str:
        """导出成本分析为 HTML"""
        html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{analysis.recipe_name} - 成本分析报告</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
        }}
        h1 {{
            color: #2c3e50;
            border-bottom: 2px solid #3498db;
            padding-bottom: 10px;
        }}
        .meta {{
            color: #7f8c8d;
            margin-bottom: 20px;
        }}
        h2 {{
            color: #34495e;
            margin-top: 30px;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
        }}
        th, td {{
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }}
        th {{
            background-color: #3498db;
            color: white;
        }}
        tr:nth-child(even) {{
            background-color: #f8f9fa;
        }}
        .highlight {{
            background-color: #fff3cd;
            padding: 2px 6px;
            border-radius: 4px;
        }}
        .success {{
            color: #27ae60;
        }}
        .warning {{
            color: #e67e22;
        }}
        ul {{
            line-height: 1.8;
        }}
    </style>
</head>
<body>
    <h1>{analysis.recipe_name}</h1>
    <div class="meta">
        SKU: {analysis.sku} | 分析时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
    </div>
    
    <h2>核心指标</h2>
    <table>
        <tr><th>指标</th><th>数值</th></tr>
        <tr><td>理论成本</td><td><strong>¥{analysis.theoretical_cost:.2f}</strong></td></tr>
        <tr><td>实际成本</td><td><strong>¥{analysis.actual_cost:.2f}</strong></td></tr>
        <tr><td>目标售价</td><td>¥{analysis.target_price:.2f}</td></tr>
        <tr><td>理论毛利率</td><td class="{'success' if analysis.theoretical_margin > 0.4 else 'warning'}">{analysis.theoretical_margin * 100:.1f}%</td></tr>
        <tr><td>实际毛利率</td><td class="{'success' if analysis.actual_margin > 0.4 else 'warning'}">{analysis.actual_margin * 100:.1f}%</td></tr>
    </table>
    
    <h2>产量信息</h2>
    <p>批次产量: <strong>{analysis.yield_quantity} {analysis.yield_unit}</strong></p>
    <p>单位成本: <strong>¥{analysis.cost_per_unit:.2f}/{analysis.yield_unit}</strong></p>
    
    <h2>原料成本明细</h2>
    <table>
        <tr>
            <th>原料</th><th>用量</th><th>损耗率</th><th>实际用量</th>
            <th>单价</th><th>理论成本</th><th>实际成本</th>
        </tr>
"""
        
        for item in analysis.ingredient_breakdown:
            html += f"""        <tr>
            <td>{item['ingredient_name']}</td>
            <td>{item['quantity']} {item['unit']}</td>
            <td>{item['waste_rate'] * 100:.0f}%</td>
            <td>{item['actual_quantity']:.2f} {item['unit']}</td>
            <td>¥{item['unit_price']:.2f}/{item['unit']}</td>
            <td>¥{item['cost']:.2f}</td>
            <td>¥{item['actual_cost']:.2f}</td>
        </tr>
"""
        
        allergen_html = ""
        if analysis.allergens:
            for a in analysis.allergens:
                allergen_html += f"            <li>⚠️ {a.value}</li>\n"
        else:
            allergen_html = "            <li>无已知过敏原</li>\n"
        
        label_html = ""
        if analysis.dietary_labels:
            for d in analysis.dietary_labels:
                label_html += f"            <li>✅ {d.value}</li>\n"
        else:
            label_html = "            <li>无特殊饮食标签</li>\n"
        
        html += f"""    </table>
    
    <h2>过敏原信息</h2>
    <ul>
{allergen_html}    </ul>
    
    <h2>饮食标签</h2>
    <ul>
{label_html}    </ul>
</body>
</html>
"""
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(html)
        
        return filepath
    
    def export_replacement_result(
        self,
        result: ReplacementResult,
        filepath: str,
        format: str = "markdown"
    ) -> str:
        """导出替换演练结果
        
        支持格式: markdown, html, csv
        """
        orig_ing = self.calculator.get_ingredient(result.original_ingredient_id)
        rep_ing = self.calculator.get_ingredient(result.replacement_ingredient_id)
        recipe = self.calculator.get_recipe(result.original_recipe_id)
        
        orig_name = orig_ing.name if orig_ing else result.original_ingredient_id
        rep_name = rep_ing.name if rep_ing else result.replacement_ingredient_id
        recipe_name = recipe.name if recipe else result.original_recipe_id
        
        if format == "html":
            return self._export_replacement_html(result, filepath, recipe_name, orig_name, rep_name)
        elif format == "csv":
            return self._export_replacement_csv(result, filepath, recipe_name, orig_name, rep_name)
        else:
            return self._export_replacement_markdown(result, filepath, recipe_name, orig_name, rep_name)
    
    def _export_replacement_markdown(
        self, result: ReplacementResult, filepath: str,
        recipe_name: str, orig_name: str, rep_name: str
    ) -> str:
        """导出替换结果为 Markdown"""
        lines = [
            f"# 原料替换演练报告",
            "",
            f"> 配方: {recipe_name}",
            f"> 替换时间: {result.created_at.strftime('%Y-%m-%d %H:%M:%S')}",
            f"> 推荐程度: {'✅ 推荐' if result.is_recommended else '❌ 不推荐'}",
            "",
            "## 替换概要",
            "",
            f"- 原原料: **{orig_name}**",
            f"- 替换为: **{rep_name}**",
            "",
            "## 成本变化",
            "",
            "| 指标 | 替换前 | 替换后 | 变化 |",
            "|------|--------|--------|------|",
            f"| 实际成本 | ¥{result.original_cost:.2f} | ¥{result.new_cost:.2f} | {result.cost_difference:+.2f} ({result.cost_difference_percentage:+.1f}%) |",
            f"| 毛利率 | {result.original_margin * 100:.1f}% | {result.new_margin * 100:.1f}% | {result.margin_difference * 100:+.1f}个百分点 |",
            "",
        ]
        
        if result.warnings:
            lines.extend([
                "## ⚠️ 警告信息",
                "",
            ])
            for warning in result.warnings:
                lines.append(f"- {warning}")
            lines.append("")
        
        lines.extend([
            "## 过敏原变化",
            "",
        ])
        
        if result.added_allergens:
            lines.append("### 新增过敏原:")
            for a in result.added_allergens:
                lines.append(f"- ⚠️ {a.value}")
        
        if result.removed_allergens:
            lines.append("")
            lines.append("### 移除过敏原:")
            for a in result.removed_allergens:
                lines.append(f"- ✅ {a.value}")
        
        if not result.added_allergens and not result.removed_allergens:
            lines.append("- 无变化")
        
        lines.extend([
            "",
            "## 饮食标签变化",
            "",
        ])
        
        if result.added_dietary_labels:
            lines.append("### 新增标签:")
            for d in result.added_dietary_labels:
                lines.append(f"- ✅ {d.value}")
        
        if result.removed_dietary_labels:
            lines.append("")
            lines.append("### 失去标签:")
            for d in result.removed_dietary_labels:
                lines.append(f"- ❌ {d.value}")
        
        if not result.added_dietary_labels and not result.removed_dietary_labels:
            lines.append("- 无变化")
        
        lines.append("")
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        
        return filepath
    
    def _export_replacement_html(
        self, result: ReplacementResult, filepath: str,
        recipe_name: str, orig_name: str, rep_name: str
    ) -> str:
        """导出替换结果为 HTML"""
        status_color = "#27ae60" if result.is_recommended else "#e74c3c"
        status_text = "✅ 推荐" if result.is_recommended else "❌ 不推荐"
        
        cost_diff_color = "#27ae60" if result.cost_difference < 0 else "#e74c3c"
        margin_diff_color = "#27ae60" if result.margin_difference > 0 else "#e74c3c"
        
        warnings_html = ""
        if result.warnings:
            warnings_html = f"""
    <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #856404; margin-top: 0;">⚠️ 警告信息</h3>
        <ul style="margin-bottom: 0;">
            {''.join([f'<li>{w}</li>' for w in result.warnings])}
        </ul>
    </div>
"""
        
        html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>原料替换演练报告</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
        }}
        h1 {{ color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }}
        .meta {{ color: #7f8c8d; margin-bottom: 20px; }}
        .status-badge {{
            display: inline-block;
            padding: 8px 16px;
            border-radius: 20px;
            color: white;
            font-weight: bold;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
        }}
        th, td {{
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }}
        th {{ background-color: #3498db; color: white; }}
        tr:nth-child(even) {{ background-color: #f8f9fa; }}
        .positive {{ color: #27ae60; font-weight: bold; }}
        .negative {{ color: #e74c3c; font-weight: bold; }}
        ul {{ line-height: 1.8; }}
        .added-allergen {{ background-color: #ffdddd; }}
        .removed-allergen {{ background-color: #ddffdd; }}
    </style>
</head>
<body>
    <h1>原料替换演练报告</h1>
    <div class="meta">
        配方: <strong>{recipe_name}</strong> | 
        替换时间: {result.created_at.strftime('%Y-%m-%d %H:%M:%S')}
    </div>
    
    <p>推荐程度: <span class="status-badge" style="background-color: {status_color};">{status_text}</span></p>
    
    <h2>替换概要</h2>
    <p><strong>原原料:</strong> {orig_name} → <strong>替换为:</strong> {rep_name}</p>
    
    <h2>成本变化</h2>
    <table>
        <tr><th>指标</th><th>替换前</th><th>替换后</th><th>变化</th></tr>
        <tr>
            <td>实际成本</td>
            <td>¥{result.original_cost:.2f}</td>
            <td>¥{result.new_cost:.2f}</td>
            <td class="{'positive' if result.cost_difference < 0 else 'negative'}">
                {result.cost_difference:+.2f} ({result.cost_difference_percentage:+.1f}%)
            </td>
        </tr>
        <tr>
            <td>毛利率</td>
            <td>{result.original_margin * 100:.1f}%</td>
            <td>{result.new_margin * 100:.1f}%</td>
            <td class="{'positive' if result.margin_difference > 0 else 'negative'}">
                {result.margin_difference * 100:+.1f}个百分点
            </td>
        </tr>
    </table>
{warnings_html}
    <h2>过敏原变化</h2>
"""
        
        if result.added_allergens:
            html += "    <h3>新增过敏原:</h3>\n    <ul>\n"
            for a in result.added_allergens:
                html += f"        <li style=\"color: #e74c3c;\">⚠️ {a.value}</li>\n"
            html += "    </ul>\n"
        
        if result.removed_allergens:
            html += "    <h3>移除过敏原:</h3>\n    <ul>\n"
            for a in result.removed_allergens:
                html += f"        <li style=\"color: #27ae60;\">✅ {a.value}</li>\n"
            html += "    </ul>\n"
        
        if not result.added_allergens and not result.removed_allergens:
            html += "    <p>无变化</p>\n"
        
        html += """
    <h2>饮食标签变化</h2>
"""
        
        if result.added_dietary_labels:
            html += "    <h3>新增标签:</h3>\n    <ul>\n"
            for d in result.added_dietary_labels:
                html += f"        <li style=\"color: #27ae60;\">✅ {d.value}</li>\n"
            html += "    </ul>\n"
        
        if result.removed_dietary_labels:
            html += "    <h3>失去标签:</h3>\n    <ul>\n"
            for d in result.removed_dietary_labels:
                html += f"        <li style=\"color: #e74c3c;\">❌ {d.value}</li>\n"
            html += "    </ul>\n"
        
        if not result.added_dietary_labels and not result.removed_dietary_labels:
            html += "    <p>无变化</p>\n"
        
        html += "</body>\n</html>"
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(html)
        
        return filepath
    
    def _export_replacement_csv(
        self, result: ReplacementResult, filepath: str,
        recipe_name: str, orig_name: str, rep_name: str
    ) -> str:
        """导出替换结果为 CSV"""
        summary_rows = [
            {"项目": "配方", "值": recipe_name},
            {"项目": "原原料", "值": orig_name},
            {"项目": "替换为", "值": rep_name},
            {"项目": "推荐替换", "值": "是" if result.is_recommended else "否"},
            {"项目": "替换前成本", "值": f"¥{result.original_cost:.2f}"},
            {"项目": "替换后成本", "值": f"¥{result.new_cost:.2f}"},
            {"项目": "成本变化", "值": f"{result.cost_difference:+.2f} ({result.cost_difference_percentage:+.1f}%)"},
            {"项目": "替换前毛利率", "值": f"{result.original_margin * 100:.1f}%"},
            {"项目": "替换后毛利率", "值": f"{result.new_margin * 100:.1f}%"},
            {"项目": "毛利率变化", "值": f"{result.margin_difference * 100:+.1f}个百分点"},
        ]
        
        with open(filepath, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["项目", "值"])
            writer.writeheader()
            writer.writerows(summary_rows)
        
        return filepath
    
    def export_allergen_list(self, filepath: str) -> str:
        """导出所有配方的过敏原清单"""
        recipes = self.calculator.get_all_recipes()
        
        rows = []
        for recipe in recipes:
            analysis = self.calculator.calculate_recipe_cost(recipe.id)
            rows.append({
                "SKU": recipe.sku,
                "产品名称": recipe.name,
                "过敏原": ",".join([a.value for a in analysis.allergens]) if analysis.allergens else "无",
                "饮食标签": ",".join([d.value for d in analysis.dietary_labels]) if analysis.dietary_labels else "无",
                "实际成本": f"¥{analysis.actual_cost:.2f}",
                "目标售价": f"¥{analysis.target_price:.2f}",
                "实际毛利率": f"{analysis.actual_margin * 100:.1f}%"
            })
        
        if rows:
            with open(filepath, "w", encoding="utf-8-sig", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=rows[0].keys())
                writer.writeheader()
                writer.writerows(rows)
        else:
            with open(filepath, "w", encoding="utf-8-sig", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=[
                    "SKU", "产品名称", "过敏原", "饮食标签", 
                    "实际成本", "目标售价", "实际毛利率"
                ])
                writer.writeheader()
        
        return filepath
