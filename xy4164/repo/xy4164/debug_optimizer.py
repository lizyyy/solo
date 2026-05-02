#!/usr/bin/env python3
"""调试脚本 - 检查优化器和校验问题"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lighting_previewer.validators import CSVParser, DataValidator
from lighting_previewer.optimizer import LightPlanOptimizer
from lighting_previewer.models import IssueSeverity


def main():
    print("=" * 60)
    print("调试 - 检查优化器和校验问题")
    print("=" * 60)
    print()
    
    examples_dir = os.path.join(os.path.dirname(__file__), "examples")
    
    print("[1] 解析数据...")
    parser = CSVParser()
    
    zones_path = os.path.join(examples_dir, "crop_zones.csv")
    zones = parser.parse_crop_zones(zones_path)
    print(f"  分区数: {len(zones)}")
    for z in zones:
        print(f"    {z.zone_id}: 目标DLI={z.light_threshold.target_dli}, "
              f"传感器={z.sensor_id}, 灯谱={z.led_spectrum_id}")
    
    spectra_path = os.path.join(examples_dir, "led_spectra.csv")
    spectra = parser.parse_led_spectra(spectra_path)
    print(f"\n  灯谱数: {len(spectra)}")
    for s in spectra:
        print(f"    {s.spectrum_id}: 蓝={s.blue_ratio:.2%}, 红={s.red_ratio:.2%}, "
              f"蓝红比={s.blue_red_ratio:.2f}")
        print(f"      通道数: {len(s.channels)}")
        for ch in s.channels:
            print(f"        {ch.wavelength_range} ({ch.wavelength_nm}nm): {ch.intensity_ratio:.2%}")
    
    sensor_path = os.path.join(examples_dir, "sensor_data.csv")
    sensors = parser.parse_sensor_data(sensor_path)
    print(f"\n  传感器数: {len(sensors)}")
    for s in sensors:
        hourly = s.get_daily_ppfd_profile()
        daylight_ppfd = [hourly.get(h, 0) for h in range(6, 18)]
        avg_daylight = sum(daylight_ppfd) / len(daylight_ppfd)
        print(f"    {s.sensor_id}: 读数={len(s.readings)}, 白天平均PPFD={avg_daylight:.1f}")
    
    price_path = os.path.join(examples_dir, "electricity_price.csv")
    prices = parser.parse_electricity_price(price_path)
    print(f"\n  电价方案数: {len(prices)}")
    for p in prices:
        print(f"    {p.price_id}: 时段数={len(p.tiers)}")
        for t in p.tiers:
            print(f"      {t.tier_name}: {t.start_time.strftime('%H:%M')}-{t.end_time.strftime('%H:%M')}, "
                  f"{t.price_per_kwh:.2f}元/kWh")
    
    print()
    print("[2] 数据校验...")
    validator = DataValidator()
    validation_result = validator.validate_all(
        zones=zones,
        spectra=spectra,
        sensors=sensors,
        prices=prices
    )
    
    print(f"  校验状态: {'通过' if validation_result.is_valid else '失败'}")
    print(f"  问题数: 严重={len(validation_result.critical_issues)}, "
          f"警告={len(validation_result.warning_issues)}")
    
    for issue in validation_result.issues:
        severity = "严重" if issue.severity == IssueSeverity.CRITICAL else (
            "警告" if issue.severity == IssueSeverity.WARNING else "信息"
        )
        print(f"    [{severity}] {issue.category.value}: {issue.message}")
        if issue.suggested_action:
            print(f"       建议: {issue.suggested_action}")
    
    print()
    print("[3] 检查优化器...")
    
    if validation_result.is_valid or True:
        print("  运行优化器...")
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
        print(f"  补光方案: {light_plan.plan_name}")
        print(f"  补光时段数: {len(light_plan.intervals)}")
        print(f"  预计能耗: {light_plan.total_estimated_energy:.2f} kWh")
        print(f"  预计成本: {light_plan.total_estimated_cost:.2f} 元")
        
        if light_plan.intervals:
            print("\n  补光时段详情:")
            for interval in light_plan.intervals:
                print(f"    分区{interval.zone_id}: {interval.start_hour:02d}:00-{interval.end_hour:02d}:00, "
                      f"功率={interval.power_percentage:.0f}%, "
                      f"优先级={interval.priority.value}")
        else:
            print("\n  ⚠️  没有生成任何补光时段！")
            
            print("\n  检查各分区DLI需求:")
            from lighting_previewer.calculators import DLICalculator
            dli_calc = DLICalculator()
            
            sensor_map = {s.sensor_id: s for s in sensors}
            spectrum_map = {s.spectrum_id: s for s in spectra}
            
            for z in zones:
                sensor = sensor_map.get(z.sensor_id)
                spectrum = spectrum_map.get(z.led_spectrum_id)
                
                natural_dli = 0.0
                if sensor:
                    natural_dli = dli_calc.calculate_natural_dli_from_sensor(
                        sensor,
                        photoperiod_start_hour=z.photoperiod_start.hour,
                        photoperiod_end_hour=z.photoperiod_end.hour
                    )
                
                target_dli = z.light_threshold.target_dli
                dli_deficit = max(0, target_dli - natural_dli)
                
                print(f"    分区{z.zone_id}:")
                print(f"      自然DLI: {natural_dli:.2f}")
                print(f"      目标DLI: {target_dli:.2f}")
                print(f"      DLI缺口: {dli_deficit:.2f}")
                print(f"      灯谱存在: {spectrum is not None}")
                if spectrum:
                    print(f"      灯谱PPFD: {spectrum.photon_flux_density:.1f}")
                
                if dli_deficit > 0 and spectrum:
                    required_ppfd = dli_calc.calculate_required_ppfd_for_dli(
                        dli_deficit, 12.0
                    )
                    print(f"      需要PPFD: {required_ppfd:.1f}")
                    print(f"      灯谱可提供: {spectrum.photon_flux_density:.1f}")
                    print(f"      充足: {spectrum.photon_flux_density >= required_ppfd}")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
