"""
配方计算模块 - 负责用量换算、成本计算、比例分析
"""

from typing import Dict, List, Optional

from .models import (
    CalculationResult,
    Formula,
    FormulaIngredient,
    IngredientCalculation,
    RawMaterial,
    Unit,
)


class FormulaCalculator:
    """配方计算器"""
    
    def __init__(self, raw_materials: Dict[str, RawMaterial]):
        """
        初始化配方计算器
        
        Args:
            raw_materials: 原料字典，key 为原料 ID
        """
        self.raw_materials = raw_materials
    
    def calculate(
        self,
        formula: Formula,
        target_amount: float,
        target_unit: Unit = Unit.GRAM,
    ) -> CalculationResult:
        """
        计算配方按目标量的换算结果
        
        Args:
            formula: 原始配方
            target_amount: 目标总用量
            target_unit: 目标单位
        
        Returns:
            CalculationResult: 计算结果
        """
        # 1. 计算缩放比例
        original_total_grams = self._to_grams(formula.total_amount, formula.unit)
        target_total_grams = self._to_grams(target_amount, target_unit)
        scale_factor = target_total_grams / original_total_grams
        
        # 2. 计算每种原料的用量
        ingredient_details: List[IngredientCalculation] = []
        total_cost = 0.0
        total_ethanol_grams = 0.0
        total_fragrance_grams = 0.0
        
        for ingredient in formula.ingredients:
            # 获取原料信息
            raw_material = self.raw_materials.get(ingredient.raw_material_id)
            if not raw_material:
                # 如果原料不存在，使用默认值
                material_name = f"Unknown ({ingredient.raw_material_id})"
                is_ethanol = False
                is_fragrance = True
                unit_cost = None
                density = 1.0
            else:
                material_name = raw_material.name
                is_ethanol = raw_material.is_ethanol
                is_fragrance = raw_material.is_fragrance
                unit_cost = raw_material.unit_cost
                density = raw_material.density
            
            # 计算原始用量（克）
            original_grams = self._to_grams(ingredient.amount, ingredient.unit, density)
            
            # 计算缩放后的用量（克）
            calculated_grams = original_grams * scale_factor
            
            # 计算占比
            percentage = calculated_grams / target_total_grams if target_total_grams > 0 else 0.0
            
            # 计算成本
            cost: Optional[float] = None
            if unit_cost is not None:
                cost = calculated_grams * unit_cost
                total_cost += cost
            
            # 分类统计
            if is_ethanol:
                total_ethanol_grams += calculated_grams
            elif is_fragrance:
                total_fragrance_grams += calculated_grams
            
            # 创建原料计算结果
            ingredient_calc = IngredientCalculation(
                raw_material_id=ingredient.raw_material_id,
                raw_material_name=material_name,
                original_amount=ingredient.amount,
                original_unit=ingredient.unit,
                calculated_amount=calculated_grams,
                calculated_unit=Unit.GRAM,
                cost=cost,
                percentage=percentage,
            )
            ingredient_details.append(ingredient_calc)
        
        # 3. 计算比例
        ethanol_ratio = total_ethanol_grams / target_total_grams if target_total_grams > 0 else 0.0
        fragrance_ratio = total_fragrance_grams / target_total_grams if target_total_grams > 0 else 0.0
        
        # 4. 创建最终结果
        result = CalculationResult(
            formula_id=formula.id,
            target_amount=target_amount,
            target_unit=target_unit,
            total_cost=total_cost,
            ethanol_content=total_ethanol_grams,
            fragrance_content=total_fragrance_grams,
            ethanol_ratio=ethanol_ratio,
            fragrance_ratio=fragrance_ratio,
            ingredient_details=ingredient_details,
        )
        
        return result
    
    def _to_grams(
        self,
        amount: float,
        unit: Unit,
        density: float = 1.0,
    ) -> float:
        """
        将任意单位转换为克数
        
        Args:
            amount: 用量
            unit: 单位
            density: 密度（g/ml），仅用于体积单位转换
        
        Returns:
            float: 克数
        """
        if unit == Unit.GRAM:
            return amount
        elif unit == Unit.MILLIGRAM:
            return amount / 1000.0
        elif unit == Unit.KILOGRAM:
            return amount * 1000.0
        elif unit == Unit.MILLILITER:
            return amount * density
        elif unit == Unit.LITER:
            return amount * 1000 * density
        elif unit == Unit.DROP:
            # 假设1滴约0.05克
            return amount * 0.05
        elif unit == Unit.PERCENT:
            # 百分比单位不能直接转换
            raise ValueError("百分比单位不能直接转换为克数")
        return amount
    
    def convert_unit(
        self,
        amount: float,
        from_unit: Unit,
        to_unit: Unit,
        density: float = 1.0,
    ) -> float:
        """
        在不同单位之间转换
        
        Args:
            amount: 用量
            from_unit: 源单位
            to_unit: 目标单位
            density: 密度（g/ml）
        
        Returns:
            float: 转换后的用量
        """
        # 先转换为克
        grams = self._to_grams(amount, from_unit, density)
        
        # 再从克转换为目标单位
        if to_unit == Unit.GRAM:
            return grams
        elif to_unit == Unit.MILLIGRAM:
            return grams * 1000.0
        elif to_unit == Unit.KILOGRAM:
            return grams / 1000.0
        elif to_unit == Unit.MILLILITER:
            return grams / density if density > 0 else 0.0
        elif to_unit == Unit.LITER:
            return grams / (1000 * density) if density > 0 else 0.0
        elif to_unit == Unit.DROP:
            return grams / 0.05
        elif to_unit == Unit.PERCENT:
            raise ValueError("不能直接转换为百分比单位")
        return grams
    
    def get_allergen_summary(
        self,
        calculation_result: CalculationResult,
    ) -> Dict[str, float]:
        """
        计算过敏原含量摘要
        
        Args:
            calculation_result: 计算结果
        
        Returns:
            Dict[str, float]: 过敏原类型到总含量（百分比）的映射
        """
        allergen_summary: Dict[str, float] = {}
        
        for ingredient in calculation_result.ingredient_details:
            raw_material = self.raw_materials.get(ingredient.raw_material_id)
            if raw_material and raw_material.allergens:
                for allergen in raw_material.allergens:
                    allergen_name = allergen.value
                    if allergen_name not in allergen_summary:
                        allergen_summary[allergen_name] = 0.0
                    allergen_summary[allergen_name] += ingredient.percentage
        
        return allergen_summary
