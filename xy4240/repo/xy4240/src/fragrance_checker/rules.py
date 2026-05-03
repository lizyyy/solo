"""
规则引擎模块 - 负责 IFRA 规则、过敏原规则、禁用物检查
"""

from typing import Dict, List, Optional, Tuple

from .models import (
    AllergenRule,
    AllergenType,
    CalculationResult,
    CheckError,
    CheckResult,
    CheckWarning,
    IFRARule,
    IngredientCalculation,
    RawMaterial,
    RawMaterialBatch,
    RuleSet,
)


class RuleEngine:
    """规则引擎"""
    
    def __init__(
        self,
        rule_set: RuleSet,
        raw_materials: Dict[str, RawMaterial],
    ):
        """
        初始化规则引擎
        
        Args:
            rule_set: 规则集合
            raw_materials: 原料字典
        """
        self.rule_set = rule_set
        self.raw_materials = raw_materials
        
        # 构建快速查找索引
        self._ifra_rules_by_material: Dict[str, List[IFRARule]] = {}
        for rule in rule_set.ifra_rules:
            if rule.raw_material_id not in self._ifra_rules_by_material:
                self._ifra_rules_by_material[rule.raw_material_id] = []
            self._ifra_rules_by_material[rule.raw_material_id].append(rule)
        
        self._allergen_rules_by_type: Dict[AllergenType, AllergenRule] = {}
        for rule in rule_set.allergen_rules:
            self._allergen_rules_by_type[rule.allergen_type] = rule
    
    def check(
        self,
        calculation_result: CalculationResult,
        batches: Optional[Dict[str, RawMaterialBatch]] = None,
    ) -> CheckResult:
        """
        执行完整的合规性检查
        
        Args:
            calculation_result: 计算结果
            batches: 批次字典（可选）
        
        Returns:
            CheckResult: 检查结果
        """
        warnings: List[CheckWarning] = []
        errors: List[CheckError] = []
        
        # 1. 检查禁用物质
        banned_errors = self._check_banned_substances(calculation_result)
        errors.extend(banned_errors)
        
        # 2. 检查 IFRA 限制
        ifra_warnings, ifra_errors = self._check_ifra_rules(calculation_result)
        warnings.extend(ifra_warnings)
        errors.extend(ifra_errors)
        
        # 3. 检查过敏原阈值
        allergen_warnings, allergen_errors = self._check_allergens(calculation_result)
        warnings.extend(allergen_warnings)
        errors.extend(allergen_errors)
        
        # 4. 检查批次（如果提供）
        if batches:
            batch_warnings, batch_errors = self._check_batches(
                calculation_result, batches
            )
            warnings.extend(batch_warnings)
            errors.extend(batch_errors)
        
        # 5. 检查单位混用
        unit_warnings = self._check_unit_consistency(calculation_result)
        warnings.extend(unit_warnings)
        
        # 6. 构建结果
        passed = len(errors) == 0
        result = CheckResult(
            passed=passed,
            warnings=warnings,
            errors=errors,
        )
        
        return result
    
    def _check_banned_substances(
        self,
        calculation_result: CalculationResult,
    ) -> List[CheckError]:
        """检查禁用物质"""
        errors: List[CheckError] = []
        
        for ingredient in calculation_result.ingredient_details:
            if ingredient.raw_material_id in self.rule_set.banned_substances:
                raw_material = self.raw_materials.get(ingredient.raw_material_id)
                material_name = raw_material.name if raw_material else ingredient.raw_material_id
                
                error = CheckError(
                    code="BANNED_SUBSTANCE",
                    message=f"使用了禁用物质: {material_name}",
                    context={
                        "raw_material_id": ingredient.raw_material_id,
                        "raw_material_name": material_name,
                        "amount": ingredient.calculated_amount,
                        "percentage": ingredient.percentage,
                    },
                )
                errors.append(error)
        
        return errors
    
    def _check_ifra_rules(
        self,
        calculation_result: CalculationResult,
    ) -> Tuple[List[CheckWarning], List[CheckError]]:
        """检查 IFRA 规则"""
        warnings: List[CheckWarning] = []
        errors: List[CheckError] = []
        
        for ingredient in calculation_result.ingredient_details:
            material_id = ingredient.raw_material_id
            if material_id not in self._ifra_rules_by_material:
                continue
            
            rules = self._ifra_rules_by_material[material_id]
            for rule in rules:
                raw_material = self.raw_materials.get(material_id)
                material_name = raw_material.name if raw_material else material_id
                
                if rule.limit_type == "banned":
                    error = CheckError(
                        code="IFRA_BANNED",
                        message=f"IFRA 规则: {material_name} 被禁止使用",
                        context={
                            "raw_material_id": material_id,
                            "raw_material_name": material_name,
                            "rule_type": rule.limit_type,
                            "notes": rule.notes,
                        },
                    )
                    errors.append(error)
                
                elif rule.limit_type == "max_concentration" and rule.limit_value is not None:
                    actual_percentage = ingredient.percentage
                    limit_percentage = rule.limit_value
                    
                    if actual_percentage > limit_percentage:
                        error = CheckError(
                            code="IFRA_LIMIT_EXCEEDED",
                            message=f"IFRA 超限: {material_name} 实际浓度 {actual_percentage*100:.2f}% 超过限制 {limit_percentage*100:.2f}%",
                            context={
                                "raw_material_id": material_id,
                                "raw_material_name": material_name,
                                "actual_percentage": actual_percentage,
                                "limit_percentage": limit_percentage,
                                "product_category": rule.product_category,
                            },
                        )
                        errors.append(error)
                    elif actual_percentage > limit_percentage * 0.8:
                        warning = CheckWarning(
                            code="IFRA_LIMIT_APPROACHING",
                            message=f"IFRA 接近限制: {material_name} 实际浓度 {actual_percentage*100:.2f}% 接近限制 {limit_percentage*100:.2f}%",
                            context={
                                "raw_material_id": material_id,
                                "raw_material_name": material_name,
                                "actual_percentage": actual_percentage,
                                "limit_percentage": limit_percentage,
                            },
                        )
                        warnings.append(warning)
        
        return warnings, errors
    
    def _check_allergens(
        self,
        calculation_result: CalculationResult,
    ) -> Tuple[List[CheckWarning], List[CheckError]]:
        """检查过敏原"""
        warnings: List[CheckWarning] = []
        errors: List[CheckError] = []
        
        # 计算每种过敏原的总含量
        allergen_totals: Dict[AllergenType, float] = {}
        
        for ingredient in calculation_result.ingredient_details:
            raw_material = self.raw_materials.get(ingredient.raw_material_id)
            if not raw_material or not raw_material.allergens:
                continue
            
            for allergen in raw_material.allergens:
                if allergen not in allergen_totals:
                    allergen_totals[allergen] = 0.0
                allergen_totals[allergen] += ingredient.percentage
        
        # 检查过敏原阈值
        for allergen_type, total_percentage in allergen_totals.items():
            rule = self._allergen_rules_by_type.get(allergen_type)
            
            # 默认报告阈值 0.1%
            reporting_threshold = rule.reporting_threshold if rule else 0.001
            restriction_limit = rule.restriction_limit if rule else None
            
            # 检查是否需要报告（超过阈值）
            if total_percentage >= reporting_threshold:
                warning = CheckWarning(
                    code="ALLERGEN_REPORTING_THRESHOLD",
                    message=f"过敏原需要标注: {allergen_type.value} 含量 {total_percentage*100:.2f}% 超过报告阈值 {reporting_threshold*100:.2f}%",
                    context={
                        "allergen_type": allergen_type.value,
                        "total_percentage": total_percentage,
                        "reporting_threshold": reporting_threshold,
                    },
                )
                warnings.append(warning)
            
            # 检查是否超过限制值
            if restriction_limit is not None and total_percentage > restriction_limit:
                error = CheckError(
                    code="ALLERGEN_LIMIT_EXCEEDED",
                    message=f"过敏原超限: {allergen_type.value} 含量 {total_percentage*100:.2f}% 超过限制 {restriction_limit*100:.2f}%",
                    context={
                        "allergen_type": allergen_type.value,
                        "total_percentage": total_percentage,
                        "restriction_limit": restriction_limit,
                    },
                )
                errors.append(error)
        
        return warnings, errors
    
    def _check_batches(
        self,
        calculation_result: CalculationResult,
        batches: Dict[str, RawMaterialBatch],
    ) -> Tuple[List[CheckWarning], List[CheckError]]:
        """检查批次信息"""
        warnings: List[CheckWarning] = []
        errors: List[CheckError] = []
        
        # 收集配方中使用的批次号
        used_batches: set = set()
        material_to_batch: Dict[str, List[str]] = {}
        
        # 首先从计算结果中获取批次信息（如果有）
        # 注意：CalculationResult 中没有批次信息，需要从原始配方获取
        # 这里简化处理：检查库存和过期
        
        # 按原料分组的批次
        material_batches: Dict[str, List[RawMaterialBatch]] = {}
        for batch_number, batch in batches.items():
            if batch.raw_material_id not in material_batches:
                material_batches[batch.raw_material_id] = []
            material_batches[batch.raw_material_id].append(batch)
        
        for ingredient in calculation_result.ingredient_details:
            material_id = ingredient.raw_material_id
            raw_material = self.raw_materials.get(material_id)
            material_name = raw_material.name if raw_material else material_id
            
            # 检查是否有可用批次
            if material_id not in material_batches:
                warning = CheckWarning(
                    code="NO_BATCH_AVAILABLE",
                    message=f"没有可用批次: {material_name}",
                    context={
                        "raw_material_id": material_id,
                        "raw_material_name": material_name,
                    },
                )
                warnings.append(warning)
                continue
            
            # 检查批次是否过期
            batch_list = material_batches[material_id]
            expired_batches = [b for b in batch_list if b.is_expired]
            valid_batches = [b for b in batch_list if not b.is_expired]
            
            if expired_batches and not valid_batches:
                error = CheckError(
                    code="ALL_BATCHES_EXPIRED",
                    message=f"所有批次已过期: {material_name}",
                    context={
                        "raw_material_id": material_id,
                        "raw_material_name": material_name,
                        "expired_batches": [b.batch_number for b in expired_batches],
                    },
                )
                errors.append(error)
            elif expired_batches:
                warning = CheckWarning(
                    code="SOME_BATCHES_EXPIRED",
                    message=f"部分批次已过期: {material_name} ({len(expired_batches)}/{len(batch_list)} 个批次过期)",
                    context={
                        "raw_material_id": material_id,
                        "raw_material_name": material_name,
                        "expired_batches": [b.batch_number for b in expired_batches],
                        "valid_batches": [b.batch_number for b in valid_batches],
                    },
                )
                warnings.append(warning)
            
            # 检查库存是否足够
            if valid_batches:
                total_available = sum(
                    b.quantity for b in valid_batches
                    if b.unit.value == "g"  # 简化：只考虑克为单位的
                )
                required = ingredient.calculated_amount
                
                if total_available < required:
                    warning = CheckWarning(
                        code="INSUFFICIENT_INVENTORY",
                        message=f"库存不足: {material_name} 需要 {required:.2f}g，可用 {total_available:.2f}g",
                        context={
                            "raw_material_id": material_id,
                            "raw_material_name": material_name,
                            "required": required,
                            "available": total_available,
                        },
                    )
                    warnings.append(warning)
            
            # 检查即将过期（30天内）
            soon_expiring = [
                b for b in valid_batches
                if b.days_until_expiry <= 30
            ]
            if soon_expiring:
                warning = CheckWarning(
                    code="BATCH_SOON_EXPIRY",
                    message=f"批次即将过期: {material_name} (剩余 {soon_expiring[0].days_until_expiry} 天)",
                    context={
                        "raw_material_id": material_id,
                        "raw_material_name": material_name,
                        "batch_number": soon_expiring[0].batch_number,
                        "days_until_expiry": soon_expiring[0].days_until_expiry,
                    },
                )
                warnings.append(warning)
        
        return warnings, errors
    
    def _check_unit_consistency(
        self,
        calculation_result: CalculationResult,
    ) -> List[CheckWarning]:
        """检查单位一致性"""
        warnings: List[CheckWarning] = []
        
        # 收集所有使用的单位
        units_used = set()
        for ingredient in calculation_result.ingredient_details:
            units_used.add(ingredient.original_unit.value)
        
        # 检查是否混用了质量单位和体积单位
        mass_units = {'g', 'mg', 'kg'}
        volume_units = {'ml', 'l', 'drop'}
        
        has_mass = any(u in mass_units for u in units_used)
        has_volume = any(u in volume_units for u in units_used)
        
        if has_mass and has_volume:
            warning = CheckWarning(
                code="MIXED_UNITS",
                message=f"混用了质量单位和体积单位: 已使用 {', '.join(units_used)}",
                context={
                    "units_used": list(units_used),
                    "mass_units": list(units_used & mass_units),
                    "volume_units": list(units_used & volume_units),
                },
            )
            warnings.append(warning)
        
        return warnings
