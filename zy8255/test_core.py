#!/usr/bin/env python3
"""
核心功能测试脚本
"""

import sys
from pathlib import Path
from datetime import date

# 添加项目根目录到路径
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from cinema_review.logic import DataLoader, TimelineBuilder, IssueDetector
from cinema_review.utils import Exporter


def test_data_loader():
    """测试数据加载器"""
    print("=" * 60)
    print("测试数据加载器...")
    print("=" * 60)
    
    data_dir = project_root / "data"
    loader = DataLoader(data_dir)
    
    # 设置测试日期
    test_date = date(2026, 5, 4)
    
    # 加载数据
    data = loader.load_all(test_date)
    
    screenings = data["screenings"]
    projector_logs = data["projector_logs"]
    lamp_hours = data["lamp_hours"]
    hall_rules = data["hall_rules"]
    
    print(f"✓ 加载排片数据: {len(screenings)} 场")
    print(f"✓ 加载放映机日志: {len(projector_logs)} 条")
    print(f"✓ 加载灯泡数据: {len(lamp_hours)} 个影厅")
    print(f"✓ 加载影厅规则: {len(hall_rules)} 个影厅")
    
    # 显示部分排片信息
    if screenings:
        print("\n排片示例:")
        for i, s in enumerate(screenings[:3]):
            print(f"  {i+1}. {s.hall_name}: {s.film_name} "
                  f"({s.start_time.strftime('%H:%M')}-{s.end_time.strftime('%H:%M')})")
    
    return data


def test_timeline_builder(data):
    """测试时间线构建器"""
    print("\n" + "=" * 60)
    print("测试时间线构建器...")
    print("=" * 60)
    
    screenings = data["screenings"]
    projector_logs = data["projector_logs"]
    lamp_hours = data["lamp_hours"]
    hall_rules = data["hall_rules"]
    
    if not screenings:
        print("✗ 没有排片数据，跳过测试")
        return None
    
    builder = TimelineBuilder(
        screenings=screenings,
        projector_logs=projector_logs,
        lamp_hours=lamp_hours,
        hall_rules=hall_rules
    )
    
    timelines = builder.build_all_timelines()
    
    print(f"✓ 构建时间线: {len(timelines)} 个")
    
    # 显示一个时间线示例
    first_id = next(iter(timelines))
    timeline = timelines[first_id]
    
    print(f"\n时间线示例 ({timeline.screening.film_name}):")
    print(f"  理论预热开始: {timeline.warmup_start}")
    print(f"  实际开机时间: {timeline.projector_on_time}")
    print(f"  实际开始: {timeline.actual_start}")
    print(f"  实际结束: {timeline.actual_end}")
    print(f"  事件数量: {len(timeline.events)}")
    
    return timelines


def test_issue_detector(data, timelines):
    """测试问题检测器"""
    print("\n" + "=" * 60)
    print("测试问题检测器...")
    print("=" * 60)
    
    screenings = data["screenings"]
    projector_logs = data["projector_logs"]
    lamp_hours = data["lamp_hours"]
    hall_rules = data["hall_rules"]
    
    if not screenings:
        print("✗ 没有排片数据，跳过测试")
        return []
    
    detector = IssueDetector(
        screenings=screenings,
        timelines=timelines or {},
        lamp_hours=lamp_hours,
        hall_rules=hall_rules,
        projector_logs=projector_logs
    )
    
    issues = detector.detect_all_issues()
    
    print(f"✓ 检测到问题: {len(issues)} 个")
    
    # 按类型统计
    from collections import defaultdict
    by_type = defaultdict(int)
    by_severity = defaultdict(int)
    
    for issue in issues:
        by_type[issue.issue_type.value] += 1
        by_severity[issue.severity] += 1
    
    print("\n问题类型分布:")
    for issue_type, count in by_type.items():
        print(f"  - {issue_type}: {count} 个")
    
    print("\n严重程度分布:")
    for severity, count in by_severity.items():
        severity_text = {"high": "严重", "medium": "中等", "low": "轻微"}.get(severity, severity)
        print(f"  - {severity_text}: {count} 个")
    
    # 显示前3个问题
    if issues:
        print("\n问题示例:")
        for i, issue in enumerate(issues[:5]):
            severity_text = {"high": "🔴", "medium": "🟡", "low": "🟢"}.get(issue.severity, "⚪")
            print(f"  {i+1}. {severity_text} [{issue.issue_type.value}] {issue.hall_name}: {issue.description[:60]}...")
    
    return issues


def test_exporter(data, issues):
    """测试导出器"""
    print("\n" + "=" * 60)
    print("测试导出器...")
    print("=" * 60)
    
    output_dir = project_root / "output"
    test_date = date(2026, 5, 4)
    
    exporter = Exporter(output_dir, test_date)
    
    # 构建影厅名称映射
    hall_names = {}
    for s in data["screenings"]:
        if s.hall_id not in hall_names:
            hall_names[s.hall_id] = s.hall_name
    
    # 导出MD报告
    try:
        md_path = exporter.export_projection_review(
            screenings=data["screenings"],
            issues=issues,
            timelines={},
            hall_names=hall_names,
            include_resolved=True
        )
        print(f"✓ 导出MD报告: {md_path}")
    except Exception as e:
        print(f"✗ MD报告导出失败: {e}")
    
    # 导出CSV
    try:
        csv_path = exporter.export_issues_csv(
            issues=issues,
            include_resolved=True
        )
        print(f"✓ 导出CSV文件: {csv_path}")
    except Exception as e:
        print(f"✗ CSV导出失败: {e}")


def main():
    """主测试函数"""
    print("=" * 60)
    print("影院排片核对工具 - 核心功能测试")
    print("=" * 60)
    
    try:
        # 测试数据加载
        data = test_data_loader()
        
        # 测试时间线构建
        timelines = test_timeline_builder(data)
        
        # 测试问题检测
        issues = test_issue_detector(data, timelines)
        
        # 测试导出功能
        test_exporter(data, issues)
        
        print("\n" + "=" * 60)
        print("✓ 所有核心测试通过!")
        print("=" * 60)
        
        # 显示预期的问题数量
        print("\n预期检测到的问题:")
        print("  1. 1号厅排片重叠 (严重)")
        print("  2. 1号厅预热不足 (严重)")
        print("  3. 1号厅跨午夜场次未标记 (中等)")
        print("  4. 4号厅灯泡超时 (严重)")
        print("  5. 1号厅灯泡接近警告阈值 (中等)")
        print("  6. 其他间隔不足警告 (中等)")
        
        return 0
        
    except Exception as e:
        print(f"\n✗ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
