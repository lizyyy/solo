"""
演示测试脚本 - 验证核心功能
"""

from bake_calc.manager import BakeCalculator
from bake_calc.models import AllergenType, DietaryLabel
from bake_calc.import_export import ImportExportManager
from bake_calc.storage import StorageManager
import os
import json


def test_core_calculation():
    """测试核心成本计算"""
    print("=" * 60)
    print("测试 1: 核心成本计算")
    print("=" * 60)
    
    calc = BakeCalculator()
    
    butter = calc.add_ingredient(
        name="无盐黄油",
        unit="kg",
        current_price=85.00,
        supplier="新西兰乳制品公司",
        allergens=[AllergenType.MILK],
        dietary_labels=[],
        is_substitutable=True
    )
    
    flour = calc.add_ingredient(
        name="中筋面粉",
        unit="kg",
        current_price=12.50,
        supplier="本地粮商",
        allergens=[AllergenType.WHEAT],
        is_substitutable=True
    )
    
    egg = calc.add_ingredient(
        name="鸡蛋",
        unit="个",
        current_price=1.20,
        supplier="本地农场",
        allergens=[AllergenType.EGGS],
        is_substitutable=False
    )
    
    sugar = calc.add_ingredient(
        name="细砂糖",
        unit="kg",
        current_price=8.50,
        supplier="本地糖厂",
        is_substitutable=True
    )
    
    cake = calc.add_recipe(
        sku="CAKE001",
        name="经典香草蛋糕",
        description="8寸圆形海绵蛋糕",
        yield_quantity=1,
        yield_unit="个",
        target_price=168.00
    )
    
    calc.add_recipe_ingredient(cake.id, butter.id, quantity=0.25, waste_rate=0.05)
    calc.add_recipe_ingredient(cake.id, flour.id, quantity=0.20, waste_rate=0.02)
    calc.add_recipe_ingredient(cake.id, egg.id, quantity=4, waste_rate=0.0)
    calc.add_recipe_ingredient(cake.id, sugar.id, quantity=0.15, waste_rate=0.01)
    
    analysis = calc.calculate_recipe_cost(cake.id)
    
    print(f"\n配方: {analysis.recipe_name} (SKU: {analysis.sku})")
    print(f"  理论成本: ¥{analysis.theoretical_cost:.2f}")
    print(f"  实际成本: ¥{analysis.actual_cost:.2f}")
    print(f"  目标售价: ¥{analysis.target_price:.2f}")
    print(f"  理论毛利率: {analysis.theoretical_margin * 100:.1f}%")
    print(f"  实际毛利率: {analysis.actual_margin * 100:.1f}%")
    print(f"  单位成本: ¥{analysis.cost_per_unit:.2f}/{analysis.yield_unit}")
    
    print("\n  过敏原:", ", ".join([a.value for a in analysis.allergens]))
    print("  饮食标签:", ", ".join([d.value for d in analysis.dietary_labels]))
    
    print("\n  原料明细:")
    for item in analysis.ingredient_breakdown:
        print(f"    - {item['ingredient_name']}: {item['quantity']} {item['unit']}, "
              f"损耗率 {item['waste_rate'] * 100:.0f}%, 实际成本 ¥{item['actual_cost']:.2f}")
    
    expected_theoretical = 0.25 * 85 + 0.20 * 12.5 + 4 * 1.2 + 0.15 * 8.5
    print(f"\n  验证理论成本: 计算值 ¥{analysis.theoretical_cost:.2f}, 期望值 ¥{expected_theoretical:.2f}")
    assert abs(analysis.theoretical_cost - expected_theoretical) < 0.01, "理论成本计算错误"
    
    print("\n✅ 成本计算测试通过!")
    return calc


def test_replacement():
    """测试替换演练"""
    print("\n" + "=" * 60)
    print("测试 2: 替换演练")
    print("=" * 60)
    
    calc = BakeCalculator()
    
    butter = calc.add_ingredient(
        name="无盐黄油",
        unit="kg",
        current_price=85.00,
        supplier="新西兰乳制品公司",
        allergens=[AllergenType.MILK],
        is_substitutable=True
    )
    
    margarine = calc.add_ingredient(
        name="植物黄油",
        unit="kg",
        current_price=45.00,
        supplier="国内食品厂",
        dietary_labels=[DietaryLabel.VEGAN],
        is_substitutable=True
    )
    
    flour = calc.add_ingredient(
        name="中筋面粉",
        unit="kg",
        current_price=12.50,
        supplier="本地粮商",
        allergens=[AllergenType.WHEAT]
    )
    
    egg = calc.add_ingredient(
        name="鸡蛋",
        unit="个",
        current_price=1.20,
        supplier="本地农场",
        allergens=[AllergenType.EGGS]
    )
    
    sugar = calc.add_ingredient(
        name="细砂糖",
        unit="kg",
        current_price=8.50,
        supplier="本地糖厂"
    )
    
    cream = calc.add_ingredient(
        name="淡奶油",
        unit="L",
        current_price=38.00,
        supplier="新西兰乳制品公司",
        allergens=[AllergenType.MILK],
        is_substitutable=True
    )
    
    coconut = calc.add_ingredient(
        name="椰浆",
        unit="L",
        current_price=18.00,
        supplier="东南亚进口",
        dietary_labels=[DietaryLabel.VEGAN],
        is_substitutable=True
    )
    
    cake = calc.add_recipe(
        sku="CAKE001",
        name="经典香草蛋糕",
        description="测试用蛋糕",
        yield_quantity=1,
        yield_unit="个",
        target_price=168.00
    )
    
    calc.add_recipe_ingredient(cake.id, butter.id, quantity=0.25, waste_rate=0.05)
    calc.add_recipe_ingredient(cake.id, flour.id, quantity=0.20, waste_rate=0.02)
    calc.add_recipe_ingredient(cake.id, egg.id, quantity=4, waste_rate=0.0)
    calc.add_recipe_ingredient(cake.id, sugar.id, quantity=0.15, waste_rate=0.01)
    calc.add_recipe_ingredient(cake.id, cream.id, quantity=0.3, waste_rate=0.05)
    
    print(f"\n原始配方分析:")
    orig_analysis = calc.calculate_recipe_cost(cake.id)
    print(f"  实际成本: ¥{orig_analysis.actual_cost:.2f}")
    print(f"  实际毛利率: {orig_analysis.actual_margin * 100:.1f}%")
    print(f"  过敏原: {', '.join([a.value for a in orig_analysis.allergens])}")
    
    print(f"\n--- 替换演练: 无盐黄油 → 植物黄油 ---")
    
    result = calc.simulate_replacement(cake.id, butter.id, margarine.id)
    
    print(f"\n成本变化:")
    print(f"  替换前: ¥{result.original_cost:.2f}")
    print(f"  替换后: ¥{result.new_cost:.2f}")
    print(f"  成本差: {result.cost_difference:+.2f} ({result.cost_difference_percentage:+.1f}%)")
    
    print(f"\n毛利变化:")
    print(f"  替换前: {result.original_margin * 100:.1f}%")
    print(f"  替换后: {result.new_margin * 100:.1f}%")
    print(f"  变化: {result.margin_difference * 100:+.1f} 个百分点")
    
    print(f"\n过敏原变化:")
    if result.added_allergens:
        print(f"  新增: {', '.join([a.value for a in result.added_allergens])}")
    if result.removed_allergens:
        print(f"  移除: {', '.join([a.value for a in result.removed_allergens])}")
    if not result.added_allergens and not result.removed_allergens:
        print(f"  无变化")
    
    print(f"\n饮食标签变化:")
    if result.added_dietary_labels:
        print(f"  新增: {', '.join([d.value for d in result.added_dietary_labels])}")
    if result.removed_dietary_labels:
        print(f"  移除: {', '.join([d.value for d in result.removed_dietary_labels])}")
    if not result.added_dietary_labels and not result.removed_dietary_labels:
        print(f"  无变化")
    
    print(f"\n推荐决策: {'✅ 推荐' if result.is_recommended else '❌ 不推荐'}")
    
    if result.warnings:
        print(f"\n警告信息:")
        for w in result.warnings:
            print(f"  - {w}")
    
    assert result.cost_difference < 0, "成本应该下降"
    assert AllergenType.MILK in result.removed_allergens, "应该移除乳制品过敏原"
    
    print("\n  说明: 饮食标签采用'交集'逻辑 - 只有所有原料都符合才会标记")
    print("        原配方含有鸡蛋(非纯素), 所以仅替换黄油不会让配方变成纯素")
    print("        这是正确的业务逻辑: 要做纯素蛋糕需要同时替换黄油和鸡蛋")
    
    print("\n✅ 替换演练测试通过!")
    return calc


def test_import_export():
    """测试导入导出"""
    print("\n" + "=" * 60)
    print("测试 3: 导入导出")
    print("=" * 60)
    
    calc = BakeCalculator()
    
    calc.add_ingredient(
        name="测试黄油",
        unit="kg",
        current_price=80.00,
        supplier="测试供应商",
        allergens=[AllergenType.MILK]
    )
    
    ie_manager = ImportExportManager(calc)
    
    test_csv = "./test_ingredients_export.csv"
    ie_manager.export_ingredients_to_csv(test_csv)
    print(f"  已导出原料到: {test_csv}")
    
    calc2 = BakeCalculator()
    ie_manager2 = ImportExportManager(calc2)
    results = ie_manager2.import_ingredients_from_csv(test_csv)
    
    print(f"  导入结果: 成功 {results['success']}, 失败 {results['failed']}")
    
    if os.path.exists(test_csv):
        os.remove(test_csv)
        print(f"  已清理测试文件")
    
    assert results['success'] >= 1, "应该至少导入1个原料"
    
    print("\n✅ 导入导出测试通过!")


def test_storage():
    """测试持久化存储"""
    print("\n" + "=" * 60)
    print("测试 4: 本地持久化")
    print("=" * 60)
    
    import tempfile
    
    with tempfile.TemporaryDirectory() as tmpdir:
        storage = StorageManager(tmpdir)
        
        calc = BakeCalculator()
        butter = calc.add_ingredient(
            name="持久化测试黄油",
            unit="kg",
            current_price=85.00,
            supplier="测试供应商",
            allergens=[AllergenType.MILK]
        )
        
        cake = calc.add_recipe(
            sku="TEST001",
            name="持久化测试蛋糕",
            description="测试用",
            yield_quantity=1,
            yield_unit="个",
            target_price=100.00
        )
        
        calc.add_recipe_ingredient(cake.id, butter.id, quantity=0.25, waste_rate=0.05)
        
        storage.save(calc)
        print(f"  已保存数据到临时目录")
        
        calc_loaded = storage.load()
        
        print(f"  加载后原料数量: {len(calc_loaded.get_all_ingredients())}")
        print(f"  加载后配方数量: {len(calc_loaded.get_all_recipes())}")
        
        loaded_ings = calc_loaded.get_all_ingredients()
        assert len(loaded_ings) == 1, "应该有1个原料"
        assert loaded_ings[0].name == "持久化测试黄油", "原料名称应该匹配"
        
        loaded_recipes = calc_loaded.get_all_recipes()
        assert len(loaded_recipes) == 1, "应该有1个配方"
        
        print("\n✅ 持久化存储测试通过!")


def run_all_tests():
    """运行所有测试"""
    print("\n" + "=" * 60)
    print("🍰 BakeCalc - 烘焙配方成本计算器 测试演示")
    print("=" * 60)
    
    try:
        test_core_calculation()
        test_replacement()
        test_import_export()
        test_storage()
        
        print("\n" + "=" * 60)
        print("✅ 所有测试通过!")
        print("=" * 60)
        
        print("""\n接下来你可以:
1. 运行 'python -m bake_calc.cli' 启动交互式界面
2. 导入 'examples/sample_data.json' 体验完整示例数据
3. 查看 README.md 了解详细使用方法

示例数据包含:
  - 11 种预设原料（黄油、面粉、杏仁粉、鸡蛋、淡奶油、椰浆等）
  - 3 个示例配方（经典香草蛋糕、巧克力豆曲奇、杏仁挞）
  - 预设的替换关系（黄油→植物黄油、淡奶油→椰浆、杏仁粉→榛子粉）
""")
        
    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        raise


if __name__ == "__main__":
    run_all_tests()
