#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src import *


def demo():
    print("=" * 60)
    print("能耗峰谷拟合工具 - 功能演示")
    print("=" * 60)
    
    config = {
        "energy_constraints": {
            "max_peak_power": 550.0,
            "min_valley_power": 100.0,
            "max_peak_valley_ratio": 5.0,
            "min_peak_valley_ratio": 1.5,
            "max_fitting_error": 10.0,
        },
        "time_constraints": {
            "min_peak_interval": 2,
            "min_valley_interval": 2,
            "peak_valley_min_distance": 1,
        },
        "algorithm_params": {
            "window_size": 5,
            "poly_order": 3,
            "smoothing_factor": 0.1,
            "peak_prominence": 0.15,
            "valley_prominence": 0.15,
        },
    }
    
    data_points = [
        EnergyDataPoint(timestamp=0.0, power=120.0),
        EnergyDataPoint(timestamp=0.5, power=180.0),
        EnergyDataPoint(timestamp=1.0, power=250.0),
        EnergyDataPoint(timestamp=1.5, power=320.0),
        EnergyDataPoint(timestamp=2.0, power=280.0),
        EnergyDataPoint(timestamp=2.5, power=200.0),
        EnergyDataPoint(timestamp=3.0, power=150.0),
        EnergyDataPoint(timestamp=3.5, power=220.0),
        EnergyDataPoint(timestamp=4.0, power=350.0),
        EnergyDataPoint(timestamp=4.5, power=480.0),
        EnergyDataPoint(timestamp=5.0, power=420.0),
        EnergyDataPoint(timestamp=5.5, power=300.0),
        EnergyDataPoint(timestamp=6.0, power=200.0),
        EnergyDataPoint(timestamp=6.5, power=280.0),
        EnergyDataPoint(timestamp=7.0, power=380.0),
        EnergyDataPoint(timestamp=7.5, power=520.0),
        EnergyDataPoint(timestamp=8.0, power=450.0),
        EnergyDataPoint(timestamp=8.5, power=320.0),
        EnergyDataPoint(timestamp=9.0, power=220.0),
        EnergyDataPoint(timestamp=9.5, power=300.0),
        EnergyDataPoint(timestamp=10.0, power=400.0),
        EnergyDataPoint(timestamp=10.5, power=550.0),
        EnergyDataPoint(timestamp=11.0, power=480.0),
        EnergyDataPoint(timestamp=11.5, power=350.0),
        EnergyDataPoint(timestamp=12.0, power=250.0),
    ]
    
    print("\n1. 测试峰谷拟合算法...")
    fitting = EnergyFitting(config["algorithm_params"])
    result = fitting.fit(data_points)
    print(f"   检测到 {len(result.peaks)} 个峰值, {len(result.valleys)} 个谷值")
    print(f"   拟合误差: {result.fitting_error:.3f}")
    
    print("\n2. 测试约束检查...")
    checker = ConstraintChecker(config["energy_constraints"], config["time_constraints"])
    violations = checker.check_all(result)
    print(f"   发现 {len(violations)} 项约束异常")
    for v in violations[:3]:
        print(f"   - {v.constraint_name}: {v.explanation[:50]}...")
    
    print("\n3. 测试历史记录管理...")
    history_mgr = HistoryManager("./test_history")
    data_hash = generate_data_hash(data_points)
    
    from datetime import datetime
    record = FittingRecord(
        record_id=generate_record_id(),
        batch_id="DEMO_BATCH",
        material_id="DEMO_MAT",
        timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        operator="demo_user",
        notes="测试数据: 队员笔记第一版",
        input_data_hash=data_hash,
        fitting_result=result,
        constraint_violations=violations,
        status="warning",
    )
    
    record_id = history_mgr.save_record(record)
    print(f"   记录已保存, ID: {record_id}")
    
    print("\n4. 测试版本对比功能...")
    new_data_points = data_points.copy()
    new_data_points[-1] = EnergyDataPoint(timestamp=12.0, power=280.0)
    
    new_result = fitting.fit(new_data_points)
    new_violations = checker.check_all(new_result)
    
    new_record = FittingRecord(
        record_id=generate_record_id(),
        batch_id="DEMO_BATCH",
        material_id="DEMO_MAT",
        timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        operator="demo_user",
        notes="测试数据: 队员笔记第二版, 修正了最后一个数据点",
        input_data_hash=generate_data_hash(new_data_points),
        fitting_result=new_result,
        constraint_violations=new_violations,
        status="warning",
    )
    
    comparer = VersionComparer()
    differences = comparer.compare_records(record, new_record)
    print(comparer.format_differences(differences))
    
    print("\n5. 测试导出功能...")
    exporter = ResultExporter("./test_exports")
    export_path = exporter.export_record(record)
    print(f"   模型说明已导出至: {export_path}")
    
    print("\n" + "=" * 60)
    print("演示完成!")
    print("=" * 60)


if __name__ == "__main__":
    demo()
