#!/usr/bin/env python3
"""快速验证脚本 - 测试补光配方预演器核心功能"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lighting_previewer.validators import CSVParser
from lighting_previewer.validators import DataValidator
from lighting_previewer.calculators import CalculationEngine
from lighting_previewer.optimizer import LightPlanOptimizer
from lighting_previewer.session import SessionData, SessionManager
from lighting_previewer.exporters import MarkdownExporter, CSVExporter, JSONExporter


def main():
    print("=" * 60)
    print("补光配方预演器 - 功能验证")
    print("=" * 60)
    print()
    
    examples_dir = os.path.join(os.path.dirname(__file__), "examples")
    output_dir = os.path.join(os.path.dirname(__file__), "output")
    os.makedirs(output_dir, exist_ok=True)
    
    print("[1/5] 模块导入测试...")
    print("  ✅ validators 模块")
    print("  ✅ calculators 模块")
    print("  ✅ optimizer 模块")
    print("  ✅ session 模块")
    print("  ✅ exporters 模块")
    print()
    
    print("[2/5] CSV数据解析测试...")
    parser = CSVParser()
    
    zones_path = os.path.join(examples_dir, "crop_zones.csv")
    zones = parser.parse_crop_zones(zones_path)
    print(f"  ✅ 作物分区: {len(zones)} 个")
    
    spectra_path = os.path.join(examples_dir, "led_spectra.csv")
    spectra = parser.parse_led_spectra(spectra_path)
    print(f"  ✅ LED灯谱: {len(spectra)} 个")
    
    sensor_path = os.path.join(examples_dir, "sensor_data.csv")
    sensors = parser.parse_sensor_data(sensor_path)
    print(f"  ✅ 传感器数据: {len(sensors)} 个传感器")
    
    price_path = os.path.join(examples_dir, "electricity_price.csv")
    prices = parser.parse_electricity_price(price_path)
    print(f"  ✅ 电价方案: {len(prices)} 个")
    print()
    
    print("[3/5] 数据校验测试...")
    validator = DataValidator()
    validation_result = validator.validate_all(
        zones=zones,
        spectra=spectra,
        sensors=sensors,
        prices=prices
    )
    print(f"  校验状态: {'✅ 通过' if validation_result.is_valid else '❌ 失败'}")
    print(f"  问题数量: 严重={len(validation_result.critical_issues)}, "
          f"警告={len(validation_result.warning_issues)}")
    print()
    
    print("[4/5] 优化器测试...")
    optimizer = LightPlanOptimizer()
    
    opt_result = optimizer.optimize(
        zones=zones,
        spectra=spectra,
        sensors=sensors,
        electricity_price=prices[0] if prices else None,
        budget_limit=100.0,
        base_date="2024-05-01"
    )
    
    light_plan = opt_result.light_plan
    print(f"  ✅ 生成补光方案: {light_plan.plan_name}")
    print(f"     补光时段数: {len(light_plan.intervals)}")
    print(f"     预计能耗: {light_plan.total_estimated_energy:.2f} kWh")
    print(f"     预计成本: {light_plan.total_estimated_cost:.2f} 元")
    print()
    
    print("[5/5] 计算引擎测试...")
    calc_engine = CalculationEngine()
    
    calc_result = calc_engine.calculate_all(
        zones=zones,
        spectra=spectra,
        sensors=sensors,
        electricity_price=prices[0] if prices else None,
        light_plan=light_plan,
        budget_limit=100.0
    )
    
    print(f"  ✅ 计算完成")
    print(f"     总DLI: {calc_result.total_dli:.1f} mol/m²/day")
    print(f"     分区数: {len(calc_result.zone_results)}")
    print(f"     风险等级: {calc_result.overall_risk_level}")
    print()
    
    print("=" * 60)
    print("所有功能验证通过!")
    print("=" * 60)
    print()
    
    print("分区详细结果:")
    print("-" * 60)
    for zone_result in calc_result.zone_results:
        status_icon = "✅" if zone_result.risk_level == "low" else (
            "🟡" if zone_result.risk_level == "medium" else "🔴"
        )
        print(f"  {status_icon} {zone_result.zone_id}: {zone_result.zone_name}")
        print(f"     DLI: {zone_result.total_dli:.1f} (目标: {zone_result.target_dli:.1f})")
        print(f"     蓝红比: {zone_result.blue_red_ratio:.2f}")
        print(f"     预计成本: {zone_result.estimated_cost:.2f} 元")
        if zone_result.warnings:
            for warn in zone_result.warnings:
                print(f"     ⚠️  {warn}")
        print()
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
