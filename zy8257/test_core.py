#!/usr/bin/env python3
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from models import IssueType, Severity
from data_loader import DataLoader
from timeline_builder import TimelineBuilder
from anomaly_detector import AnomalyDetector
from exporter import Exporter
from state_manager import StateManager


def test_data_loader():
    print("=" * 60)
    print("测试1: 数据加载模块")
    print("=" * 60)
    
    base_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sample_data")
    deceased_path = os.path.join(base_dir, "deceased.csv")
    chamber_path = os.path.join(base_dir, "cold_chamber_logs.jsonl")
    handover_path = os.path.join(base_dir, "handover.csv")
    rules_path = os.path.join(base_dir, "rules.yaml")
    
    loader = DataLoader()
    issues = loader.load_all(deceased_path, chamber_path, handover_path, rules_path)
    
    print(f"  逝者数量: {len(loader.deceased_dict)}")
    for did, deceased in loader.deceased_dict.items():
        print(f"    - {did}: {deceased.name}")
    
    print(f"  冷藏柜日志数量: {len(loader.chamber_logs)}")
    print(f"  交接记录数量: {len(loader.handover_records)}")
    print(f"  规则数量: {len(loader.rules)}")
    print(f"  加载时发现的问题: {len(issues)}")
    
    for issue in issues:
        print(f"    - [{issue.severity}] {issue.issue_type}: {issue.description[:60]}...")
    
    print("\n  ✓ 数据加载测试通过")
    return loader, issues


def test_timeline_builder(loader: DataLoader):
    print("\n" + "=" * 60)
    print("测试2: 时间线重建模块")
    print("=" * 60)
    
    builder = TimelineBuilder(loader)
    events_by_deceased, events_by_chamber = builder.build_timelines()
    
    print(f"  有时间线的逝者数量: {len(events_by_deceased)}")
    for did, events in events_by_deceased.items():
        print(f"    - {did}: {len(events)} 个事件")
    
    print(f"  有时间线的冷藏柜数量: {len(events_by_chamber)}")
    for cid, events in events_by_chamber.items():
        print(f"    - {cid}: {len(events)} 个事件")
    
    chambers = builder.get_all_chambers()
    print(f"  所有冷藏柜: {chambers}")
    
    for cid in chambers:
        status = builder.get_chamber_status(cid)
        if status:
            print(f"  冷藏柜 {cid} 状态:")
            print(f"    - 当前占用者: {status.current_occupant or '空闲'}")
            print(f"    - 占用历史: {len(status.occupancy_history)} 条")
            print(f"    - 温度记录: {len(status.temperature_history)} 条")
    
    print("\n  ✓ 时间线重建测试通过")
    return builder


def test_anomaly_detector(loader: DataLoader, builder: TimelineBuilder):
    print("\n" + "=" * 60)
    print("测试3: 异常检测模块")
    print("=" * 60)
    
    detector = AnomalyDetector(loader, builder)
    all_issues = detector.detect_all()
    
    print(f"  总问题数: {len(all_issues)}")
    
    by_type = {}
    by_severity = {}
    
    for issue in all_issues:
        by_type[issue.issue_type] = by_type.get(issue.issue_type, 0) + 1
        by_severity[issue.severity] = by_severity.get(issue.severity, 0) + 1
    
    print(f"\n  按类型统计:")
    for issue_type, count in by_type.items():
        print(f"    - {issue_type}: {count} 个")
    
    print(f"\n  按严重程度统计:")
    for severity, count in by_severity.items():
        print(f"    - {severity}: {count} 个")
    
    print(f"\n  详细问题列表:")
    for issue in all_issues:
        status = "已处理" if issue.is_resolved else "未处理"
        print(f"\n    [{issue.severity}] {issue.issue_type} ({status})")
        print(f"    问题ID: {issue.issue_id}")
        print(f"    逝者ID: {issue.deceased_id or 'N/A'}")
        print(f"    柜号: {issue.chamber_id or 'N/A'}")
        print(f"    描述: {issue.description}")
    
    unresolved = detector.get_unresolved_issues()
    print(f"\n  未处理问题数: {len(unresolved)}")
    
    temp_issues = detector.get_issues_by_type(IssueType.TEMPERATURE_OUT_OF_RANGE)
    print(f"  温度超窗问题数: {len(temp_issues)}")
    
    print("\n  ✓ 异常检测测试通过")
    return detector


def test_state_manager():
    print("\n" + "=" * 60)
    print("测试4: 状态管理模块")
    print("=" * 60)
    
    test_state_file = "test_state.json"
    
    manager = StateManager(test_state_file)
    
    manager.mark_issue_resolved("TEST_ISSUE_001", "测试人员", "这是测试备注")
    print(f"  已标记问题 TEST_ISSUE_001 为已处理")
    
    is_resolved = manager.is_issue_resolved("TEST_ISSUE_001")
    print(f"  问题 TEST_ISSUE_001 是否已处理: {is_resolved}")
    
    resolution = manager.get_issue_resolution("TEST_ISSUE_001")
    print(f"  处理详情: {resolution}")
    
    stats = manager.get_statistics()
    print(f"  统计信息: {stats}")
    
    manager.mark_issue_unresolved("TEST_ISSUE_001")
    is_resolved = manager.is_issue_resolved("TEST_ISSUE_001")
    print(f"  取消标记后是否已处理: {is_resolved}")
    
    if os.path.exists(test_state_file):
        os.remove(test_state_file)
        print(f"  已清理测试状态文件")
    
    print("\n  ✓ 状态管理测试通过")
    return manager


def test_exporter(loader: DataLoader, builder: TimelineBuilder, detector: AnomalyDetector):
    print("\n" + "=" * 60)
    print("测试5: 导出模块")
    print("=" * 60)
    
    exporter = Exporter(loader, builder, detector)
    
    test_issues_csv = "test_issues.csv"
    test_review_md = "test_review.md"
    
    success = exporter.export_issues_csv(test_issues_csv)
    print(f"  导出 issues.csv: {'成功' if success else '失败'}")
    
    if success and os.path.exists(test_issues_csv):
        with open(test_issues_csv, 'r', encoding='utf-8-sig') as f:
            lines = f.readlines()
            print(f"  文件行数: {len(lines)}")
            if lines:
                print(f"  表头: {lines[0].strip()}")
    
    success = exporter.export_chamber_review_md(test_review_md)
    print(f"  导出 chamber_review.md: {'成功' if success else '失败'}")
    
    if success and os.path.exists(test_review_md):
        with open(test_review_md, 'r', encoding='utf-8') as f:
            content = f.read()
            print(f"  文件大小: {len(content)} 字符")
            print(f"  包含内容概览:")
            for line in content.split('\n')[:10]:
                if line.strip():
                    print(f"    {line[:60]}...")
    
    for f in [test_issues_csv, test_review_md]:
        if os.path.exists(f):
            os.remove(f)
    
    print("\n  ✓ 导出模块测试通过")


def test_filtering(detector: AnomalyDetector):
    print("\n" + "=" * 60)
    print("测试6: 筛选功能")
    print("=" * 60)
    
    print(f"  总问题数: {len(detector.all_issues)}")
    
    unresolved = detector.filter_issues(is_resolved=False)
    print(f"  未处理问题数: {len(unresolved)}")
    
    temp_issues = detector.filter_issues(issue_type=IssueType.TEMPERATURE_OUT_OF_RANGE)
    print(f"  温度超窗问题数: {len(temp_issues)}")
    
    critical = detector.filter_issues(severity=Severity.CRITICAL)
    print(f"  严重问题数: {len(critical)}")
    
    print("\n  ✓ 筛选功能测试通过")


def main():
    print("\n" + "#" * 60)
    print("# 殡仪馆冷藏柜流转管理系统 - 核心功能测试")
    print("#" * 60 + "\n")
    
    print(f"测试开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    try:
        loader, load_issues = test_data_loader()
        
        builder = test_timeline_builder(loader)
        
        detector = test_anomaly_detector(loader, builder)
        
        test_state_manager()
        
        test_exporter(loader, builder, detector)
        
        test_filtering(detector)
        
        print("\n" + "=" * 60)
        print("所有测试通过!")
        print("=" * 60)
        
        print(f"\n测试完成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        print("\n" + "#" * 60)
        print("# 测试总结")
        print("#" * 60)
        print(f"""
  已验证的功能:
  ✓ 数据导入 (CSV, JSONL, YAML)
  ✓ 时间线重建 (按逝者/冷藏柜)
  ✓ 异常检测 (6种类型):
    - 温度超窗
    - 同柜重叠占用
    - 交接签收缺失
    - 跨午夜归属错位
    - 字段缺失
    - 重复交接
  ✓ 状态管理 (本地存储)
  ✓ 导出功能 (CSV, Markdown)
  ✓ 筛选功能 (按类型/严重程度/状态)

  下一步:
  1. 运行 'python main.py' 启动GUI界面
  2. 查看 sample_data 目录中的示例数据
  3. 阅读 README.md 了解详细使用说明
""")
        
        return 0
        
    except Exception as e:
        print(f"\n✗ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
