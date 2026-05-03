from datetime import datetime
from typing import List, Dict, Any, Optional

from metro_power_analyzer.rules.event_chain import Event, EventType
from metro_power_analyzer.rules.evaluator import EvaluationResult, ProtectionStatus


def export_review_report(file_path: str,
                         event_summary: Dict[str, Any],
                         evaluation_summary: Dict[str, Any],
                         events: List[Event],
                         evaluation_results: List[EvaluationResult],
                         sampling_metadata: Dict[str, Any] = None,
                         inventory_data: Dict[str, Any] = None,
                         settings_data: Dict[str, Any] = None) -> None:
    """
    导出审查报告到Markdown文件
    """
    results_map = {}
    for result in evaluation_results:
        results_map[result.event_id] = result
    
    report_lines = []
    
    report_lines.append("# 牵引变电所保护动作审查报告")
    report_lines.append("")
    report_lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    report_lines.append("")
    
    report_lines.append("## 事件摘要")
    report_lines.append("")
    
    if event_summary.get('total_events', 0) > 0:
        report_lines.append(f"- **事件总数**: {event_summary['total_events']}")
        report_lines.append(f"- **开始时间**: {event_summary['start_time'].strftime('%Y-%m-%d %H:%M:%S.%f')[:-3] if event_summary['start_time'] else 'N/A'}")
        report_lines.append(f"- **结束时间**: {event_summary['end_time'].strftime('%Y-%m-%d %H:%M:%S.%f')[:-3] if event_summary['end_time'] else 'N/A'}")
        
        duration = (event_summary['end_time'] - event_summary['start_time']).total_seconds() if event_summary['start_time'] and event_summary['end_time'] else 0
        report_lines.append(f"- **持续时间**: {duration:.3f} 秒")
        
        report_lines.append("")
        report_lines.append("### 事件类型分布")
        report_lines.append("")
        report_lines.append("| 事件类型 | 数量 |")
        report_lines.append("|----------|------|")
        for event_type, count in event_summary.get('event_types', {}).items():
            report_lines.append(f"| {event_type} | {count} |")
        
        report_lines.append("")
        report_lines.append("### 涉及装置")
        report_lines.append("")
        for device in event_summary.get('devices', []):
            report_lines.append(f"- {device}")
        
        if event_summary.get('out_of_order_count', 0) > 0:
            report_lines.append("")
            report_lines.append(f"⚠️ **警告**: 检测到 {event_summary['out_of_order_count']} 个乱序事件")
    else:
        report_lines.append("*无事件数据*")
    
    report_lines.append("")
    report_lines.append("---")
    report_lines.append("")
    
    report_lines.append("## 定值符合性评估")
    report_lines.append("")
    
    if evaluation_summary.get('total', 0) > 0:
        report_lines.append("### 评估统计")
        report_lines.append("")
        report_lines.append("| 状态 | 数量 | 百分比 |")
        report_lines.append("|------|------|--------|")
        
        total = evaluation_summary['total']
        for status_key in ['compliant', 'non_compliant', 'no_setting', 'uncertain']:
            count = evaluation_summary.get(status_key, 0)
            percentage = (count / total * 100) if total > 0 else 0
            
            status_name = {
                'compliant': '符合定值 ✓',
                'non_compliant': '不符合定值 ✗',
                'no_setting': '无对应定值 ⚠',
                'uncertain': '无法判断 ?',
            }.get(status_key, status_key)
            
            report_lines.append(f"| {status_name} | {count} | {percentage:.1f}% |")
        
        report_lines.append("")
        
        if evaluation_summary.get('non_compliant', 0) > 0:
            report_lines.append("### ❌ 不符合定值的事件")
            report_lines.append("")
            for result in evaluation_results:
                if result.status == ProtectionStatus.NON_COMPLIANT:
                    report_lines.append(f"**事件ID**: {result.event_id}")
                    report_lines.append(f"- **装置**: {result.device_name}")
                    report_lines.append(f"- **保护类型**: {result.protection_type}")
                    report_lines.append(f"- **动作值**: {result.action_value} {result.setting_unit}")
                    report_lines.append(f"- **定值**: {result.setting_value} {result.setting_unit}")
                    report_lines.append(f"- **详情**: {result.details}")
                    report_lines.append("")
        
        if evaluation_summary.get('no_setting', 0) > 0:
            report_lines.append("### ⚠️ 无对应定值的事件")
            report_lines.append("")
            for result in evaluation_results:
                if result.status == ProtectionStatus.NO_SETTING:
                    report_lines.append(f"- **事件ID**: {result.event_id}")
                    report_lines.append(f"  - **装置**: {result.device_name}")
                    report_lines.append(f"  - **保护类型**: {result.protection_type}")
                    report_lines.append(f"  - **详情**: {result.details}")
                    report_lines.append("")
    else:
        report_lines.append("*无评估数据*")
    
    report_lines.append("")
    report_lines.append("---")
    report_lines.append("")
    
    report_lines.append("## 事件时间线")
    report_lines.append("")
    
    if events:
        for i, event in enumerate(events, 1):
            result = results_map.get(event.id)
            time_str = event.timestamp.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3] if event.timestamp else 'N/A'
            
            status_icon = "?"
            status_text = "未评估"
            if result:
                if result.status == ProtectionStatus.COMPLIANT:
                    status_icon = "✓"
                    status_text = "符合定值"
                elif result.status == ProtectionStatus.NON_COMPLIANT:
                    status_icon = "✗"
                    status_text = "不符合定值"
                elif result.status == ProtectionStatus.NO_SETTING:
                    status_icon = "⚠"
                    status_text = "无定值"
            
            out_of_order_marker = " [乱序⚠]" if event.out_of_order else ""
            
            report_lines.append(f"### {i}. {time_str}{out_of_order_marker}")
            report_lines.append("")
            report_lines.append(f"- **事件类型**: {event.event_type.value if event.event_type else '未知'}")
            report_lines.append(f"- **装置**: {event.device_name}")
            report_lines.append(f"- **相别**: {event.phase or 'N/A'}")
            report_lines.append(f"- **动作值**: {event.action_value}")
            report_lines.append(f"- **定值**: {event.setting_value}")
            report_lines.append(f"- **评估状态**: {status_icon} {status_text}")
            
            if result and result.details:
                report_lines.append(f"- **评估详情**: {result.details}")
            
            if event.notes:
                report_lines.append(f"- **备注**: {event.notes}")
            
            report_lines.append("")
    else:
        report_lines.append("*无事件数据*")
    
    report_lines.append("")
    report_lines.append("---")
    report_lines.append("")
    
    if sampling_metadata and sampling_metadata.get('sample_count', 0) > 0:
        report_lines.append("## 录波采样数据")
        report_lines.append("")
        report_lines.append(f"- **采样点数**: {sampling_metadata['sample_count']}")
        report_lines.append(f"- **开始时间**: {sampling_metadata['start_time'].strftime('%Y-%m-%d %H:%M:%S.%f')[:-3] if sampling_metadata['start_time'] else 'N/A'}")
        report_lines.append(f"- **结束时间**: {sampling_metadata['end_time'].strftime('%Y-%m-%d %H:%M:%S.%f')[:-3] if sampling_metadata['end_time'] else 'N/A'}")
        report_lines.append(f"- **通道数**: {len(sampling_metadata.get('channels', []))}")
        report_lines.append(f"- **通道列表**: {', '.join(sampling_metadata.get('channels', []))}")
        
        gaps = sampling_metadata.get('gaps', [])
        if gaps:
            report_lines.append("")
            report_lines.append(f"⚠️ **采样缺口警告**: 检测到 {len(gaps)} 个采样缺口")
            for i, gap in enumerate(gaps[:5], 1):
                report_lines.append(f"  - 缺口 {i}: {gap['gap_ms']:.2f}ms (期望 {gap['expected_ms']:.2f}ms)")
            if len(gaps) > 5:
                report_lines.append(f"  - ... 还有 {len(gaps) - 5} 个缺口")
        
        report_lines.append("")
    
    report_lines.append("---")
    report_lines.append("")
    report_lines.append("*报告生成完毕*")
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(report_lines))
