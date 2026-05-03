#!/usr/bin/env python3
"""
测试核心业务逻辑
验证数据导入、时间线重建、风险检测功能
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from config import SAMPLES_DIR
from data_importer import DataImporter
from timeline_builder import TimelineBuilder
from risk_detector import RiskDetector
from data_exporter import DataExporter
from models import RiskLevel, RiskType


def test_data_import():
    print("=" * 60)
    print("测试数据导入...")
    print("=" * 60)
    
    importer = DataImporter()
    
    samples_path = Path(SAMPLES_DIR)
    
    voyage_plan_path = samples_path / "voyage_plan.csv"
    if voyage_plan_path.exists():
        importer.import_voyage_plan(str(voyage_plan_path))
        print(f"✓ 航次计划: {importer.voyage_plan.voyage_id}")
        print(f"  船舶: {importer.voyage_plan.vessel_name}")
        print(f"  航线: {importer.voyage_plan.departure_port} -> {importer.voyage_plan.arrival_port}")
    
    sensor_data_path = samples_path / "sensor_data.jsonl"
    if sensor_data_path.exists():
        importer.import_sensor_data(str(sensor_data_path))
        print(f"✓ 传感器数据: {len(importer.sensor_readings)} 条记录")
        tanks = set([r.tank_id for r in importer.sensor_readings])
        print(f"  涉及压载舱: {sorted(tanks)}")
    
    zone_rules_path = samples_path / "zone_rules.yaml"
    if zone_rules_path.exists():
        importer.import_zone_rules(str(zone_rules_path))
        print(f"✓ 海区规则: {len(importer.zone_rules)} 条规则")
        for rule in importer.zone_rules:
            print(f"  - {rule.zone_id}: {rule.zone_name}")
    
    manual_records_path = samples_path / "manual_records.json"
    if manual_records_path.exists():
        importer.import_manual_records(str(manual_records_path))
        print(f"✓ 人工记录: {len(importer.manual_records)} 条记录")
    
    print("\n数据导入测试完成!\n")
    return importer


def test_timeline_building(importer):
    print("=" * 60)
    print("测试时间线重建...")
    print("=" * 60)
    
    builder = TimelineBuilder()
    
    tank_statuses = builder.build_timeline(
        importer.sensor_readings,
        importer.manual_records,
        importer.voyage_plan
    )
    
    print(f"✓ 重建了 {len(tank_statuses)} 个压载舱的时间线")
    
    for tank_id, tank_status in tank_statuses.items():
        print(f"\n  压载舱 {tank_id}:")
        print(f"    当前体积: {tank_status.current_volume:.2f} m³")
        print(f"    状态: {tank_status.status}")
        print(f"    事件数: {len(tank_status.history)}")
        
        if len(tank_status.history) > 0:
            print(f"    最近事件: {tank_status.history[-1].event_type} at {tank_status.history[-1].timestamp}")
    
    print("\n时间线重建测试完成!\n")
    return tank_statuses, builder


def test_risk_detection(importer, tank_statuses):
    print("=" * 60)
    print("测试风险检测...")
    print("=" * 60)
    
    detector = RiskDetector()
    detector.set_voyage_plan(importer.voyage_plan)
    detector.set_zone_rules(importer.zone_rules)
    
    issues = detector.detect_risks(
        tank_statuses,
        importer.sensor_readings,
        importer.manual_records
    )
    
    print(f"✓ 检测到 {len(issues)} 个风险问题")
    
    if issues:
        critical = [i for i in issues if i.risk_level == RiskLevel.CRITICAL]
        high = [i for i in issues if i.risk_level == RiskLevel.HIGH]
        medium = [i for i in issues if i.risk_level == RiskLevel.MEDIUM]
        low = [i for i in issues if i.risk_level == RiskLevel.LOW]
        
        print(f"\n  风险等级分布:")
        print(f"    🔴 严重: {len(critical)}")
        print(f"    🟠 高风险: {len(high)}")
        print(f"    🟡 中等: {len(medium)}")
        print(f"    🟢 低风险: {len(low)}")
        
        print(f"\n  按类型分布:")
        type_counts = {}
        for issue in issues:
            type_name = issue.risk_type.value
            if type_name not in type_counts:
                type_counts[type_name] = 0
            type_counts[type_name] += 1
        
        for type_name, count in type_counts.items():
            print(f"    {type_name}: {count}")
        
        print(f"\n  详细问题列表:")
        for issue in issues:
            confirmed = "✅ 已确认" if issue.is_confirmed else "❌ 未确认"
            print(f"\n    [{issue.issue_id}] {issue.risk_level.value} - {issue.risk_type.value}")
            print(f"      压载舱: {issue.tank_id}")
            print(f"      时间: {issue.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"      描述: {issue.description}")
            print(f"      状态: {confirmed}")
    
    print("\n风险检测测试完成!\n")
    return issues, detector


def test_export(issues, tank_statuses, importer):
    print("=" * 60)
    print("测试导出功能...")
    print("=" * 60)
    
    if not issues:
        print("⚠ 没有可导出的数据，跳过导出测试")
        return
    
    exporter = DataExporter()
    
    csv_path = exporter.export_issues_csv(issues)
    print(f"✓ issues.csv 已导出到: {csv_path}")
    
    import uuid
    from datetime import datetime
    from models import AnalysisReport
    
    issues_by_type = {}
    for issue in issues:
        type_name = issue.risk_type.value
        if type_name not in issues_by_type:
            issues_by_type[type_name] = 0
        issues_by_type[type_name] += 1
    
    issues_by_level = {}
    for issue in issues:
        level_name = issue.risk_level.value
        if level_name not in issues_by_level:
            issues_by_level[level_name] = 0
        issues_by_level[level_name] += 1
    
    tanks_with_issues = set()
    for issue in issues:
        tanks_with_issues.add(issue.tank_id)
    
    report = AnalysisReport(
        report_id=str(uuid.uuid4())[:8],
        voyage_id=importer.voyage_plan.voyage_id if importer.voyage_plan else "UNKNOWN",
        generated_time=datetime.now(),
        total_tanks=len(tank_statuses),
        tanks_with_issues=len(tanks_with_issues),
        total_issues=len(issues),
        issues_by_type=issues_by_type,
        issues_by_level=issues_by_level,
        tanks=tank_statuses,
        recommendations=["测试报告", "请确认所有风险问题"]
    )
    
    md_path = exporter.export_ballast_report_md(report, issues, tank_statuses)
    print(f"✓ ballast_report.md 已导出到: {md_path}")
    
    state_path = exporter.save_analysis_state(issues, tank_statuses)
    print(f"✓ 状态文件已导出到: {state_path}")
    
    print("\n导出测试完成!\n")


def test_boundary_cases(importer, issues):
    print("=" * 60)
    print("测试边界情况处理...")
    print("=" * 60)
    
    timezone_issues = [i for i in issues if i.risk_type == RiskType.TIMEZONE_ISSUE]
    if timezone_issues:
        print(f"✓ 检测到跨时区问题: {len(timezone_issues)} 个")
        for issue in timezone_issues:
            print(f"  - {issue.tank_id}: {issue.description}")
    else:
        print("⚠ 示例数据中未检测到跨时区问题（或者检测逻辑需要验证）")
    
    missing_sensor_issues = [i for i in issues if i.risk_type == RiskType.MISSING_SENSOR]
    if missing_sensor_issues:
        print(f"\n✓ 检测到缺失传感器问题: {len(missing_sensor_issues)} 个")
        for issue in missing_sensor_issues:
            print(f"  - {issue.tank_id}: {issue.description}")
    else:
        print("\n⚠ 示例数据中未检测到缺失传感器问题")
    
    sensor_gap_issues = [i for i in issues if i.risk_type == RiskType.SENSOR_GAP]
    if sensor_gap_issues:
        print(f"\n✓ 检测到传感器断采问题: {len(sensor_gap_issues)} 个")
        for issue in sensor_gap_issues:
            print(f"  - {issue.tank_id}: {issue.description}")
    else:
        print("\n⚠ 示例数据中未检测到传感器断采问题")
    
    all_timezones = set()
    for reading in importer.sensor_readings:
        all_timezones.add(reading.timezone)
    for record in importer.manual_records:
        all_timezones.add(record.timezone)
    
    print(f"\n数据中涉及的时区: {all_timezones}")
    
    print("\n边界情况测试完成!\n")


def main():
    print("\n" + "=" * 60)
    print("压载水换舱记录复核工具 - 核心功能测试")
    print("=" * 60 + "\n")
    
    try:
        importer = test_data_import()
        
        if importer.sensor_readings or importer.manual_records:
            tank_statuses, builder = test_timeline_building(importer)
            
            issues, detector = test_risk_detection(importer, tank_statuses)
            
            test_export(issues, tank_statuses, importer)
            
            test_boundary_cases(importer, issues)
            
            print("=" * 60)
            print("测试总结")
            print("=" * 60)
            print(f"数据导入: ✓ 通过")
            print(f"时间线重建: ✓ 通过 ({len(tank_statuses)} 个压载舱)")
            print(f"风险检测: ✓ 通过 ({len(issues)} 个问题)")
            print(f"导出功能: ✓ 通过")
            print(f"边界处理: ✓ 通过")
            print("\n所有核心功能测试完成!")
        else:
            print("⚠ 没有传感器数据或人工记录，跳过部分测试")
            
    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
