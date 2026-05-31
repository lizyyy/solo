#!/usr/bin/env python3
import os
import sys
import yaml
import json
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src import (
    EnergyDataPoint,
    FittingRecord,
    generate_data_hash,
    generate_record_id,
    HistoryManager,
    EnergyFitting,
    ConstraintChecker,
    VersionComparer,
    ResultExporter,
)


def load_config(config_path: str = "./config/constraints.yaml") -> dict:
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_data_from_csv(filepath: str) -> list:
    data_points = []
    with open(filepath, "r", encoding="utf-8") as f:
        next(f)
        for line in f:
            parts = line.strip().split(",")
            if len(parts) >= 2:
                data_points.append(EnergyDataPoint(
                    timestamp=float(parts[0]),
                    power=float(parts[1]),
                    label=parts[2] if len(parts) > 2 else None
                ))
    return data_points


def run_fitting(
    data_points: list,
    batch_id: str,
    material_id: str,
    operator: str,
    notes: str,
    config: dict
) -> FittingRecord:
    data_hash = generate_data_hash(data_points)
    
    fitting = EnergyFitting(config["algorithm_params"])
    fitting_result = fitting.fit(data_points)
    
    checker = ConstraintChecker(
        config["energy_constraints"],
        config["time_constraints"]
    )
    violations = checker.check_all(fitting_result)
    
    status = "warning" if violations else "success"
    for v in violations:
        if v.severity == "high":
            status = "error"
            break
    
    record = FittingRecord(
        record_id=generate_record_id(),
        batch_id=batch_id,
        material_id=material_id,
        timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        operator=operator,
        notes=notes,
        input_data_hash=data_hash,
        fitting_result=fitting_result,
        constraint_violations=violations,
        status=status,
    )
    
    return record


def print_record_summary(record: FittingRecord):
    print("\n" + "=" * 60)
    print("拟合完成")
    print("=" * 60)
    print(f"记录ID: {record.record_id}")
    print(f"版本: v{record.version}")
    print(f"状态: {record.status}")
    print(f"峰值数量: {len(record.fitting_result.peaks)}")
    print(f"谷值数量: {len(record.fitting_result.valleys)}")
    print(f"拟合误差: {record.fitting_result.fitting_error:.3f}")
    print(f"约束异常: {len(record.constraint_violations)} 项")
    
    if record.constraint_violations:
        print("\n异常详情:")
        for v in record.constraint_violations:
            severity_mark = {"high": "🔴", "medium": "🟡", "low": "🟢"}.get(v.severity, "⚪")
            print(f"  {severity_mark} {v.constraint_name}: {v.explanation[:60]}...")
    
    print("=" * 60 + "\n")


def main():
    config = load_config()
    history_mgr = HistoryManager()
    exporter = ResultExporter()
    comparer = VersionComparer()
    
    while True:
        print("\n" + "=" * 60)
        print("能耗峰谷拟合工具")
        print("=" * 60)
        print("1. 运行新的拟合")
        print("2. 查看历史记录列表")
        print("3. 查看单条记录详情")
        print("4. 查看版本历史")
        print("5. 导出模型说明")
        print("6. 导出全部汇总")
        print("0. 退出")
        print("-" * 60)
        
        choice = input("请选择操作: ").strip()
        
        if choice == "1":
            print("\n--- 运行新的拟合 ---")
            
            data_file = input("数据文件路径 (CSV): ").strip()
            if not os.path.exists(data_file):
                print(f"文件不存在: {data_file}")
                continue
            
            try:
                data_points = load_data_from_csv(data_file)
            except Exception as e:
                print(f"读取数据失败: {e}")
                continue
            
            batch_id = input("批次ID: ").strip() or "BATCH001"
            material_id = input("材料ID: ").strip() or "MAT001"
            operator = input("操作人员: ").strip() or "未知"
            notes = input("队员笔记: ").strip()
            
            data_hash = generate_data_hash(data_points)
            existing = history_mgr.find_by_hash(data_hash)
            
            if existing:
                print(f"\n⚠️  检测到相同数据已存在 (记录ID: {existing.record_id}, 版本: v{existing.version})")
                confirm = input("是否创建新版本? (y/n): ").strip().lower()
                if confirm != "y":
                    print("已取消")
                    continue
            
            record = run_fitting(data_points, batch_id, material_id, operator, notes, config)
            
            if existing:
                differences = comparer.compare_records(existing, record)
                if differences:
                    print("\n" + comparer.format_differences(differences))
            
            history_mgr.save_record(record)
            print_record_summary(record)
            
            do_export = input("是否导出模型说明? (y/n): ").strip().lower()
            if do_export == "y":
                export_path = exporter.export_record(record)
                print(f"已导出至: {export_path}")
        
        elif choice == "2":
            print("\n--- 历史记录列表 ---")
            summaries = history_mgr.get_all_records_summary()
            if not summaries:
                print("暂无记录")
                continue
            
            print(f"{'序号':<6} {'记录ID':<20} {'版本':<6} {'材料ID':<10} {'状态':<10} {'异常数':<8}")
            print("-" * 65)
            
            for i, s in enumerate(summaries[:20], 1):
                print(f"{i:<6} {s['record_id']:<20} v{s['version']:<5} {s['material_id']:<10} {s['status']:<10} {s['violation_count']:<8}")
            
            if len(summaries) > 20:
                print(f"... 共 {len(summaries)} 条记录")
        
        elif choice == "3":
            print("\n--- 查看记录详情 ---")
            record_id = input("输入记录ID: ").strip()
            record = history_mgr.load_record(record_id)
            
            if not record:
                print("记录不存在")
                continue
            
            print_record_summary(record)
            
            do_export = input("是否导出此记录的模型说明? (y/n): ").strip().lower()
            if do_export == "y":
                export_path = exporter.export_record(record)
                print(f"已导出至: {export_path}")
        
        elif choice == "4":
            print("\n--- 查看版本历史 ---")
            record_id = input("输入记录ID: ").strip()
            version_history = history_mgr.get_version_history(record_id)
            
            if not version_history:
                print("记录不存在")
                continue
            
            print(f"\n找到 {len(version_history)} 个版本:")
            for i, r in enumerate(version_history):
                print(f"  v{r.version}: {r.record_id} ({r.timestamp}) - {r.status}")
            
            if len(version_history) >= 2:
                do_compare = input("\n是否对比最新两个版本? (y/n): ").strip().lower()
                if do_compare == "y":
                    differences = comparer.compare_records(version_history[1], version_history[0])
                    print("\n" + comparer.format_differences(differences))
        
        elif choice == "5":
            print("\n--- 导出模型说明 ---")
            record_id = input("输入记录ID: ").strip()
            record = history_mgr.load_record(record_id)
            
            if not record:
                print("记录不存在")
                continue
            
            export_path = exporter.export_record(record)
            print(f"已导出至: {export_path}")
        
        elif choice == "6":
            print("\n--- 导出全部汇总 ---")
            all_summaries = history_mgr.get_all_records_summary()
            records = [history_mgr.load_record(s["record_id"]) for s in all_summaries]
            records = [r for r in records if r]
            
            export_path = exporter.export_summary(records)
            print(f"已导出至: {export_path}")
        
        elif choice == "0":
            print("再见!")
            break
        
        else:
            print("无效选择")


if __name__ == "__main__":
    main()
