#!/usr/bin/env python3
"""庭审证据时间线核对器 - 完整流程演示脚本"""

import os
import sys

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from evidence_timeline.cli import EvidenceTimelineChecker
from evidence_timeline.exporters import MDExporter, CSVExporter, JSONExporter


def main():
    print("="*60)
    print("庭审证据时间线核对器 - 完整流程演示")
    print("="*60)
    
    # 创建检查器实例
    checker = EvidenceTimelineChecker()
    
    # ==================== 步骤1: 导入材料 ====================
    print("\n" + "="*60)
    print("步骤1: 导入材料文件")
    print("="*60)
    
    example_dir = os.path.join(os.path.dirname(__file__), 'examples')
    files_to_import = [
        os.path.join(example_dir, 'evidence_directory.csv'),
        os.path.join(example_dir, 'chat_records.json'),
        os.path.join(example_dir, 'key_dates.yaml'),
        os.path.join(example_dir, 'trial_transcript.txt')
    ]
    
    print(f"\n正在导入 {len(files_to_import)} 个文件...")
    
    stats = checker.import_files(files_to_import)
    
    print(f"\n导入完成：")
    print(f"  - 成功文件: {stats['success_files']}/{stats['total_files']}")
    print(f"  - 失败文件: {stats['failed_files']}")
    print(f"  - 总记录数: {stats['total_records']}")
    
    if stats['failures']:
        print(f"\n失败详情：")
        for failure in stats['failures']:
            print(f"  - {failure['file']}: {failure['error']}")
    
    # 查看统计信息
    stats_data = checker.get_statistics()
    print(f"\n数据统计：")
    data_labels = {
        'evidence': '证据目录',
        'chat': '聊天记录',
        'memo': '关键日期备忘',
        'transcript': '庭审笔录'
    }
    for data_type, count in stats_data['data'].items():
        label = data_labels.get(data_type, data_type)
        print(f"  - {label}: {count} 条")
    
    # ==================== 步骤2: 执行检查 ====================
    print("\n" + "="*60)
    print("步骤2: 执行规则检查")
    print("="*60)
    
    print("\n正在执行检查...")
    
    check_stats = checker.run_checks()
    
    print(f"\n检查完成：")
    print(f"  - 总问题数: {check_stats['total_issues']}")
    
    if check_stats['total_issues'] == 0:
        print("\n✅ 未发现任何问题！")
    else:
        print(f"\n按严重程度分布：")
        severity_labels = {
            'critical': '🔴 严重',
            'high': '🟠 高',
            'medium': '🟡 中',
            'low': '🟢 低',
            'info': 'ℹ️ 信息'
        }
        for severity, count in check_stats['by_severity'].items():
            label = severity_labels.get(severity, severity)
            print(f"  {label}: {count} 个")
        
        print(f"\n按规则分布：")
        for rule, count in check_stats['by_rule'].items():
            print(f"  - {rule}: {count} 个")
        
        # 列出问题详情
        print("\n" + "-"*60)
        print("问题详情：")
        print("-"*60)
        
        issues = checker.get_issues()
        for i, issue in enumerate(issues, 1):
            severity = issue.get('severity', 'unknown')
            label = severity_labels.get(severity, severity)
            print(f"\n{i}. [{label}] {issue.get('rule_name', '')}")
            print(f"   描述: {issue.get('description', '')}")
            print(f"   位置: {issue.get('location', '未知')}")
            if issue.get('evidence_id'):
                print(f"   关联证据: {issue.get('evidence_id')}")
    
    # ==================== 步骤3: 生成时间线 ====================
    print("\n" + "="*60)
    print("步骤3: 生成事件时间线")
    print("="*60)
    
    print("\n正在生成时间线...")
    
    timeline_stats = checker.generate_timeline()
    
    print(f"\n时间线生成完成：")
    print(f"  - 总事件数: {timeline_stats['total_events']}")
    
    if timeline_stats['total_events'] == 0:
        print("\n⚠️ 没有找到有时间戳的事件")
    else:
        print(f"\n按角色分布：")
        for role, count in timeline_stats['by_role'].items():
            print(f"  - {role}: {count} 个事件")
        
        # 展示时间线详情
        print("\n" + "-"*60)
        print("时间线详情（按角色分组）：")
        print("-"*60)
        
        timeline_by_role = checker.get_timeline_by_role()
        
        for role, events in timeline_by_role.items():
            print(f"\n{'='*60}")
            print(f"👤 {role}")
            print(f"{'='*60}")
            
            sorted_events = sorted(
                events,
                key=lambda x: x.get('timestamp') if x.get('timestamp') else ''
            )
            
            for event in sorted_events:
                timestamp = event.get('timestamp', '')
                if timestamp:
                    if hasattr(timestamp, 'strftime'):
                        time_str = timestamp.strftime('%Y-%m-%d %H:%M:%S')
                    else:
                        time_str = str(timestamp)
                else:
                    time_str = '未知时间'
                
                content = event.get('content', '无内容')
                print(f"\n  [{time_str}]")
                print(f"  {content[:100]}{'...' if len(content) > 100 else ''}")
    
    # ==================== 步骤4: 导出报告 ====================
    print("\n" + "="*60)
    print("步骤4: 导出报告")
    print("="*60)
    
    output_dir = os.path.join(os.path.dirname(__file__), 'output')
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"\n正在导出报告到: {output_dir}")
    
    statistics = checker.get_statistics()
    issues = checker.get_issues()
    timeline_by_role = checker.get_timeline_by_role()
    timeline = checker.get_timeline()
    
    # 导出Markdown报告
    print("\n导出Markdown报告...")
    md_exporter = MDExporter()
    md_path = os.path.join(output_dir, 'report.md')
    md_exporter.export_to_file(md_path, statistics, issues, timeline_by_role)
    print(f"  ✓ {md_path}")
    
    # 导出CSV报告
    print("\n导出CSV报告...")
    csv_exporter = CSVExporter()
    
    issues_csv_path = os.path.join(output_dir, 'issues.csv')
    csv_exporter.export_to_file(issues_csv_path, issues)
    print(f"  ✓ {issues_csv_path}")
    
    if timeline_by_role:
        timeline_csv_path = os.path.join(output_dir, 'timeline.csv')
        csv_exporter.export_timeline_to_csv(timeline_by_role, timeline_csv_path)
        print(f"  ✓ {timeline_csv_path}")
    
    # 导出JSON审计包
    print("\n导出JSON审计包...")
    json_exporter = JSONExporter()
    
    data = {
        'evidence': checker.storage.get_data('evidence'),
        'chat': checker.storage.get_data('chat'),
        'memo': checker.storage.get_data('memo'),
        'transcript': checker.storage.get_data('transcript')
    }
    
    audit_path = os.path.join(output_dir, 'audit.json')
    json_exporter.export_audit_package_to_file(
        audit_path, statistics, issues, timeline, data
    )
    print(f"  ✓ {audit_path}")
    
    # ==================== 总结 ====================
    print("\n" + "="*60)
    print("演示完成！")
    print("="*60)
    
    print(f"\n📁 生成的文件：")
    print(f"  - {os.path.join(output_dir, 'report.md')}")
    print(f"  - {os.path.join(output_dir, 'issues.csv')}")
    if timeline_by_role:
        print(f"  - {os.path.join(output_dir, 'timeline.csv')}")
    print(f"  - {os.path.join(output_dir, 'audit.json')}")
    
    print("\n📊 最终统计：")
    final_stats = checker.get_statistics()
    
    print(f"\n  数据导入情况：")
    for data_type, count in final_stats['data'].items():
        label = data_labels.get(data_type, data_type)
        print(f"    - {label}: {count} 条")
    
    print(f"\n  问题统计：")
    issue_stats = final_stats.get('issues', {})
    print(f"    - 总问题数: {issue_stats.get('total', 0)}")
    
    print(f"\n  时间线统计：")
    timeline_stats = final_stats.get('timeline', {})
    print(f"    - 总事件数: {timeline_stats.get('total_events', 0)}")
    
    print("\n" + "="*60)
    print("演示结束！您可以查看 output/ 目录下的报告文件。")
    print("="*60)


if __name__ == '__main__':
    main()
