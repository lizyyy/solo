#!/usr/bin/env python3
"""测试时间漂移检测功能"""

from datetime import datetime, timedelta
from cold_chain import (
    TemperatureReading, VehicleRoute, SignoffRecord,
    Batch, ThresholdRule, Node, ColdChainAnalyzer
)

def test_time_drift_detection():
    print("=" * 60)
    print("测试时间漂移检测功能")
    print("=" * 60)
    print()
    
    analyzer = ColdChainAnalyzer()
    
    # 测试1: 乱序数据
    print("测试1: 检测时间乱序")
    out_of_order_temps = [
        TemperatureReading("S001", "V001", "2024-01-15 10:00:00", 5.0),
        TemperatureReading("S001", "V001", "2024-01-15 09:30:00", 5.1),
        TemperatureReading("S001", "V001", "2024-01-15 09:00:00", 5.2),
    ]
    
    drifts = analyzer.detect_time_drifts(out_of_order_temps, [], [])
    print(f"  乱序数据检测到 {len(drifts)} 个时间漂移")
    for d in drifts:
        print(f"    - 类型: {d.drift_type}, 偏差: {round(d.estimated_drift_seconds, 1)}秒")
    assert len(drifts) > 0, "应该检测到乱序"
    print("  ✓ 通过")
    print()
    
    # 测试2: 长间隔数据
    print("测试2: 检测数据长间隔")
    long_gap_temps = [
        TemperatureReading("S001", "V002", "2024-01-15 09:00:00", 5.0),
        TemperatureReading("S001", "V002", "2024-01-15 09:30:00", 5.1),
        TemperatureReading("S001", "V002", "2024-01-15 12:00:00", 5.2),
        TemperatureReading("S001", "V002", "2024-01-15 12:30:00", 5.3),
    ]
    
    drifts = analyzer.detect_time_drifts(long_gap_temps, [], [])
    print(f"  长间隔数据检测到 {len(drifts)} 个时间漂移")
    for d in drifts:
        print(f"    - 类型: {d.drift_type}, 偏差: {round(d.estimated_drift_seconds/60, 1)}分钟")
    
    has_long_gap = any(d.drift_type == "数据长间隔" for d in drifts)
    assert has_long_gap, "应该检测到长间隔"
    print("  ✓ 通过")
    print()
    
    # 测试3: 正常数据不应检测到漂移
    print("测试3: 正常数据不应检测到漂移")
    normal_temps = [
        TemperatureReading("S001", "V003", "2024-01-15 09:00:00", 5.0),
        TemperatureReading("S001", "V003", "2024-01-15 09:30:00", 5.1),
        TemperatureReading("S001", "V003", "2024-01-15 10:00:00", 5.2),
        TemperatureReading("S001", "V003", "2024-01-15 10:30:00", 5.3),
    ]
    
    drifts = analyzer.detect_time_drifts(normal_temps, [], [])
    print(f"  正常数据检测到 {len(drifts)} 个时间漂移")
    
    # 正常数据可能检测到间隔异常（如果间隔不是很规律），但不应该检测到乱序或长间隔
    has_bad_types = any(d.drift_type in ["时间乱序", "数据长间隔"] for d in drifts)
    assert not has_bad_types, "正常数据不应检测到乱序或长间隔"
    print("  ✓ 通过")
    print()
    
    print("=" * 60)
    print("所有测试通过！")
    print("=" * 60)

if __name__ == "__main__":
    test_time_drift_detection()
