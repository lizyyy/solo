from decimal import Decimal
from typing import Dict, List, Optional, Set

from water_activity_cli.models import (
    FormulaIngredient,
    Ingredient,
    Recipe,
    Unit,
    ValidationIssue,
    ValidationReport,
    WaterActivityTarget,
)
from water_activity_cli.calculator import MoistureConverter


class ValidationRule:
    def validate(self, recipe: Recipe, ingredient_library: Dict[str, Ingredient]) -> List[ValidationIssue]:
        raise NotImplementedError()


class UnitConsistencyRule(ValidationRule):
    def validate(self, recipe: Recipe, ingredient_library: Dict[str, Ingredient]) -> List[ValidationIssue]:
        issues = []
        units_used: Set[Unit] = set()
        
        for ing in recipe.ingredients:
            units_used.add(ing.unit)
        
        if len(units_used) > 1:
            unit_list = ", ".join([u.value for u in units_used])
            issues.append(ValidationIssue(
                level="warning",
                category="unit_mix",
                message=f"检测到多种单位混用: {unit_list}",
                location="ingredients",
                suggestion="建议统一使用相同单位，避免计算错误",
            ))
        
        for i, ing in enumerate(recipe.ingredients):
            if ing.unit == Unit.MILLIGRAM and ing.amount > Decimal("1000"):
                issues.append(ValidationIssue(
                    level="warning",
                    category="unit_scale",
                    message=f"原料 '{ing.name}' 使用毫克但数量较大",
                    location=f"ingredients[{i}]",
                    suggestion="考虑转换为克(1g=1000mg)以提高可读性",
                ))
        
        return issues


class IngredientDataRule(ValidationRule):
    def validate(self, recipe: Recipe, ingredient_library: Dict[str, Ingredient]) -> List[ValidationIssue]:
        issues = []
        
        for i, ing in enumerate(recipe.ingredients):
            in_library = ing.name in ingredient_library
            has_moisture_override = ing.moisture_override is not None
            
            if not in_library and not has_moisture_override:
                issues.append(ValidationIssue(
                    level="error",
                    category="missing_data",
                    message=f"原料 '{ing.name}' 不在原料库中且未指定含水率",
                    location=f"ingredients[{i}]",
                    suggestion=f"将 '{ing.name}' 添加到原料库，或在配方中使用 moisture_override 指定含水率",
                ))
            elif in_library and not has_moisture_override:
                lib_ing = ingredient_library[ing.name]
                if lib_ing.moisture_content_wet == Decimal("0"):
                    issues.append(ValidationIssue(
                        level="warning",
                        category="zero_moisture",
                        message=f"原料 '{ing.name}' 的含水率为0，可能不正确",
                        location=f"ingredients[{i}]",
                        suggestion="检查原料库数据，大多数食品原料都含有一定水分",
                    ))
        
        return issues


class TargetFeasibilityRule(ValidationRule):
    def validate(self, recipe: Recipe, ingredient_library: Dict[str, Ingredient]) -> List[ValidationIssue]:
        issues = []
        
        target = recipe.target
        
        if target.min_aw and target.max_aw:
            if target.min_aw >= target.max_aw:
                issues.append(ValidationIssue(
                    level="error",
                    category="invalid_bounds",
                    message=f"最低水分活度({target.min_aw}) >= 最高水分活度({target.max_aw})",
                    location="target",
                    suggestion="调整 min_aw 和 max_aw，确保 min_aw < max_aw",
                ))
        
        if target.min_aw and target.target_aw < target.min_aw:
            issues.append(ValidationIssue(
                level="error",
                category="target_out_of_range",
                message=f"目标水分活度({target.target_aw})低于最低允许值({target.min_aw})",
                location="target",
                suggestion="提高 target_aw 或降低 min_aw",
            ))
        
        if target.max_aw and target.target_aw > target.max_aw:
            issues.append(ValidationIssue(
                level="error",
                category="target_out_of_range",
                message=f"目标水分活度({target.target_aw})高于最高允许值({target.max_aw})",
                location="target",
                suggestion="降低 target_aw 或提高 max_aw",
            ))
        
        if target.target_aw < Decimal("0.2"):
            issues.append(ValidationIssue(
                level="warning",
                category="extreme_target",
                message=f"目标水分活度({target.target_aw})非常低，可能难以达到",
                location="target.target_aw",
                suggestion="确认目标是否合理，aw<0.2 通常需要特殊干燥工艺",
            ))
        
        if target.target_aw > Decimal("0.95"):
            issues.append(ValidationIssue(
                level="warning",
                category="extreme_target",
                message=f"目标水分活度({target.target_aw})非常高，可能存在微生物风险",
                location="target.target_aw",
                suggestion="确认目标是否合理，aw>0.95 适合多数微生物生长",
            ))
        
        return issues


class BatchScalingRule(ValidationRule):
    def validate(self, recipe: Recipe, ingredient_library: Dict[str, Ingredient]) -> List[ValidationIssue]:
        issues = []
        
        batch_size = recipe.batch_size
        batch_unit = recipe.batch_unit
        
        total_ingredients_amount = Decimal("0")
        for ing in recipe.ingredients:
            total_ingredients_amount += ing.amount
        
        if total_ingredients_amount == Decimal("0"):
            return issues
        
        if batch_unit in [Unit.KILOGRAM, Unit.GRAM, Unit.MILLIGRAM]:
            first_ing_unit = recipe.ingredients[0].unit if recipe.ingredients else Unit.GRAM
            
            if batch_unit != first_ing_unit and len(recipe.ingredients) > 0:
                issues.append(ValidationIssue(
                    level="warning",
                    category="batch_unit_mismatch",
                    message=f"批次单位({batch_unit.value})与原料单位({first_ing_unit.value})不一致",
                    location="batch_unit",
                    suggestion="考虑将批次单位与原料单位保持一致",
                ))
        
        total_by_percent = sum(
            float(ing.amount) for ing in recipe.ingredients if ing.unit == Unit.PERCENT
        )
        if total_by_percent > 0 and abs(total_by_percent - 100) > 0.01:
            issues.append(ValidationIssue(
                level="warning",
                category="percent_sum",
                message=f"百分比原料总和({total_by_percent:.1f}%)不等于100%",
                location="ingredients",
                suggestion="调整百分比原料使其总和为100%，或使用重量单位",
            ))
        
        if batch_size > Decimal("1000") and batch_unit == Unit.KILOGRAM:
            issues.append(ValidationIssue(
                level="warning",
                category="large_batch",
                message=f"批次规模较大({batch_size}kg)，建议验证设备产能",
                location="batch_size",
                suggestion="确认混合、烘烤设备是否能处理该规模",
            ))
        
        if batch_size < Decimal("0.1") and batch_unit == Unit.KILOGRAM:
            issues.append(ValidationIssue(
                level="warning",
                category="small_batch",
                message=f"批次规模较小({batch_size}kg={float(batch_size)*1000}g)，称量误差可能影响结果",
                location="batch_size",
                suggestion="考虑扩大批次规模以提高精度，或使用更精确的称量设备",
            ))
        
        for i, ing in enumerate(recipe.ingredients):
            if ing.unit == Unit.MILLIGRAM and ing.amount < Decimal("10"):
                issues.append(ValidationIssue(
                    level="warning",
                    category="minuscule_amount",
                    message=f"原料 '{ing.name}' 用量极小({ing.amount}mg)，称量难度大",
                    location=f"ingredients[{i}]",
                    suggestion="考虑扩大批次规模，或使用预稀释/母料方式添加",
                ))
        
        return issues


class MoistureConsistencyRule(ValidationRule):
    def validate(self, recipe: Recipe, ingredient_library: Dict[str, Ingredient]) -> List[ValidationIssue]:
        issues = []
        
        for i, ing in enumerate(recipe.ingredients):
            if ing.moisture_override is not None:
                moisture = ing.moisture_override
                
                if moisture < Decimal("0") or moisture > Decimal("1"):
                    issues.append(ValidationIssue(
                        level="error",
                        category="invalid_moisture",
                        message=f"原料 '{ing.name}' 的含水率覆盖值({moisture})不在有效范围内",
                        location=f"ingredients[{i}].moisture_override",
                        suggestion="含水率应为0到1之间的小数，或0%到100%",
                    ))
                
                if moisture < Decimal("0.01"):
                    issues.append(ValidationIssue(
                        level="warning",
                        category="low_moisture",
                        message=f"原料 '{ing.name}' 的含水率({float(moisture)*100:.1f}%)异常低",
                        location=f"ingredients[{i}].moisture_override",
                        suggestion="确认数值是否正确，大多数食品原料含水量>1%",
                    ))
                
                if moisture > Decimal("0.95"):
                    issues.append(ValidationIssue(
                        level="warning",
                        category="high_moisture",
                        message=f"原料 '{ing.name}' 的含水率({float(moisture)*100:.1f}%)异常高",
                        location=f"ingredients[{i}].moisture_override",
                        suggestion="确认数值是否正确，接近纯水的原料罕见",
                    ))
            
            lib_ing = ingredient_library.get(ing.name)
            if lib_ing:
                if lib_ing.moisture_content_dry is not None:
                    calculated_wet = MoistureConverter.dry_to_wet(lib_ing.moisture_content_dry)
                    difference = abs(calculated_wet - lib_ing.moisture_content_wet)
                    if difference > Decimal("0.02"):
                        issues.append(ValidationIssue(
                            level="warning",
                            category="moisture_inconsistency",
                            message=f"原料 '{ing.name}' 的干基/湿基含水率不一致",
                            location=f"library[{ing.name}]",
                            suggestion=f"湿基={float(lib_ing.moisture_content_wet)*100:.1f}%，干基换算后={float(calculated_wet)*100:.1f}%，差值超过2%",
                        ))
        
        return issues


class RecipeValidator:
    def __init__(self, ingredient_library: Optional[Dict[str, Ingredient]] = None):
        self.ingredient_library = ingredient_library or {}
        self.rules: List[ValidationRule] = [
            UnitConsistencyRule(),
            IngredientDataRule(),
            TargetFeasibilityRule(),
            BatchScalingRule(),
            MoistureConsistencyRule(),
        ]
    
    def add_rule(self, rule: ValidationRule):
        self.rules.append(rule)
    
    def validate(self, recipe: Recipe) -> ValidationReport:
        all_issues: List[ValidationIssue] = []
        
        for rule in self.rules:
            issues = rule.validate(recipe, self.ingredient_library)
            all_issues.extend(issues)
        
        errors = [i for i in all_issues if i.level == "error"]
        warnings = [i for i in all_issues if i.level == "warning"]
        infos = [i for i in all_issues if i.level == "info"]
        
        summary = {
            "total": len(all_issues),
            "errors": len(errors),
            "warnings": len(warnings),
            "info": len(infos),
        }
        
        valid = len(errors) == 0
        
        return ValidationReport(
            valid=valid,
            issues=all_issues,
            summary=summary,
        )
