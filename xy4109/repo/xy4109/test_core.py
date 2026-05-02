#!/usr/bin/env python3
import sys
sys.path.insert(0, '.')

from water_activity_cli.models import (
    Ingredient, Recipe, FormulaIngredient, 
    WaterActivityTarget, BakingProfile, Unit
)
from water_activity_cli.calculator import (
    WaterActivityCalculator, MoistureConverter, UnitConverter
)
from water_activity_cli.validator import RecipeValidator
from decimal import Decimal

def test_models():
    print("=== 测试数据模型 ===")
    
    ing = Ingredient(
        name="面粉",
        moisture_content_wet=Decimal("0.12"),
        aw=Decimal("0.55"),
        notes="测试用面粉"
    )
    print(f"  ✓ 原料模型: {ing.name}")
    print(f"    湿基含水率: {ing.moisture_content_wet}")
    print(f"    干基含水率: {float(ing.dry_basis_moisture):.4f}")
    
    target = WaterActivityTarget(
        target_aw=Decimal("0.65"),
        safety_margin_aw=Decimal("0.02")
    )
    print(f"  ✓ 目标模型: target_aw={target.target_aw}")
    
    print("")

def test_converters():
    print("=== 测试单位和含水率换算 ===")
    
    print("  单位换算:")
    print(f"    1 kg = {float(UnitConverter.to_grams(Decimal('1'), Unit.KILOGRAM))} g")
    print(f"    1000 g = {float(UnitConverter.from_grams(Decimal('1000'), Unit.KILOGRAM))} kg")
    
    print("  含水率换算:")
    wet = Decimal("0.12")
    dry = MoistureConverter.wet_to_dry(wet)
    wet_back = MoistureConverter.dry_to_wet(dry)
    print(f"    湿基 12% -> 干基 {float(dry)*100:.2f}%")
    print(f"    干基 -> 湿基 {float(wet_back)*100:.2f}% (循环验证)")
    
    print("")

def test_calculator():
    print("=== 测试计算引擎 ===")
    
    ingredients_library = {
        "面粉": Ingredient(name="面粉", moisture_content_wet=Decimal("0.12"), aw=Decimal("0.55")),
        "白砂糖": Ingredient(name="白砂糖", moisture_content_wet=Decimal("0.005"), aw=Decimal("0.10")),
        "黄油": Ingredient(name="黄油", moisture_content_wet=Decimal("0.16"), aw=Decimal("0.90")),
        "鸡蛋": Ingredient(name="鸡蛋", moisture_content_wet=Decimal("0.76"), aw=Decimal("0.98")),
        "水": Ingredient(name="水", moisture_content_wet=Decimal("1.0"), aw=Decimal("1.0")),
    }
    print(f"  ✓ 原料库: {len(ingredients_library)} 种原料")
    
    recipe = Recipe(
        name="经典黄油曲奇",
        version="1.0",
        batch_size=1,
        batch_unit=Unit.KILOGRAM,
        ingredients=[
            FormulaIngredient(name="面粉", amount=250, unit=Unit.GRAM),
            FormulaIngredient(name="黄油", amount=180, unit=Unit.GRAM),
            FormulaIngredient(name="白砂糖", amount=120, unit=Unit.GRAM),
            FormulaIngredient(name="鸡蛋", amount=50, unit=Unit.GRAM),
        ],
        target=WaterActivityTarget(
            target_aw=Decimal("0.65"),
            safety_margin_aw=Decimal("0.02")
        ),
        baking_profile=BakingProfile(
            loss_percentage=Decimal("0.08"),
            loss_is_water_only=True
        ),
    )
    print(f"  ✓ 配方: {recipe.name} ({len(recipe.ingredients)} 种原料)")
    
    calculator = WaterActivityCalculator(ingredients_library)
    result = calculator.calculate(recipe)
    
    print(f"  ✓ 计算完成!")
    print(f"    总投料: {float(result.total_input_weight):.2f} g")
    print(f"    总干固物: {float(result.total_dry_solids):.2f} g")
    print(f"    总水分: {float(result.total_water_input):.2f} g")
    print(f"    初始含水率(湿基): {float(result.initial_moisture_wet_basis)*100:.2f}%")
    print(f"    烘烤损耗: {float(result.baking_loss_amount):.2f} g")
    print(f"    调整建议: {result.adjustment_direction} {float(result.water_adjustment_needed):.2f} g")
    print(f"    预期成品重量: {float(result.final_expected_weight):.2f} g")
    
    print("")

def test_validator():
    print("=== 测试校验规则 ===")
    
    ingredients_library = {
        "面粉": Ingredient(name="面粉", moisture_content_wet=Decimal("0.12")),
    }
    
    good_recipe = Recipe(
        name="有效配方",
        batch_size=1,
        batch_unit=Unit.KILOGRAM,
        ingredients=[FormulaIngredient(name="面粉", amount=100, unit=Unit.GRAM)],
        target=WaterActivityTarget(target_aw=Decimal("0.65")),
    )
    
    validator = RecipeValidator(ingredients_library)
    report = validator.validate(good_recipe)
    
    print(f"  有效配方校验: {'通过' if report.valid else '失败'}")
    print(f"    问题数: {report.summary['total']}")
    
    bad_recipe = Recipe(
        name="无效配方",
        batch_size=1,
        batch_unit=Unit.KILOGRAM,
        ingredients=[FormulaIngredient(name="未知原料", amount=100, unit=Unit.GRAM)],
        target=WaterActivityTarget(target_aw=Decimal("0.65")),
    )
    
    bad_report = validator.validate(bad_recipe)
    print(f"  无效配方校验: {'通过' if bad_report.valid else '失败 (预期)'}")
    print(f"    问题数: {bad_report.summary['total']}")
    print(f"    错误数: {bad_report.summary['errors']}")
    
    print("")

def test_reporter():
    print("=== 测试报告导出 ===")
    
    from water_activity_cli.reporter import MarkdownReporter, CSVReporter, JSONReporter
    
    ingredients_library = {
        "面粉": Ingredient(name="面粉", moisture_content_wet=Decimal("0.12")),
        "水": Ingredient(name="水", moisture_content_wet=Decimal("1.0")),
    }
    
    recipe = Recipe(
        name="测试配方",
        batch_size=1,
        batch_unit=Unit.KILOGRAM,
        ingredients=[
            FormulaIngredient(name="面粉", amount=500, unit=Unit.GRAM),
            FormulaIngredient(name="水", amount=100, unit=Unit.GRAM),
        ],
        target=WaterActivityTarget(target_aw=Decimal("0.65")),
    )
    
    calculator = WaterActivityCalculator(ingredients_library)
    result = calculator.calculate(recipe)
    
    markdown = MarkdownReporter.generate(result)
    print(f"  ✓ Markdown 报告: {len(markdown)} 字符")
    assert "水分活度" in markdown or "water activity" in markdown.lower() or "测试配方" in markdown
    
    csv_rows = CSVReporter.generate(result)
    print(f"  ✓ CSV 数据: {len(csv_rows)} 行")
    assert len(csv_rows) > 0
    
    json_data = JSONReporter.generate(result)
    print(f"  ✓ JSON 数据: {len(str(json_data))} 字符")
    assert "recipe_name" in json_data
    assert "input" in json_data
    assert "final" in json_data
    
    print("")

def main():
    print("=" * 60)
    print("水分活度配方校算器 - 核心测试")
    print("=" * 60)
    print("")
    
    try:
        test_models()
        test_converters()
        test_calculator()
        test_validator()
        test_reporter()
        
        print("=" * 60)
        print("✓ 所有核心测试通过!")
        print("=" * 60)
        return 0
        
    except Exception as e:
        print(f"\n✗ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
