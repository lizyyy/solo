"""Report generator for performance analysis results."""

from datetime import datetime
from typing import Dict, Any, List
from collections import defaultdict
import json

from ..database import Session, Event, Metric, Sample, Analysis
from ..analyzers.timeline_analyzer import EVENT_TYPES


SEVERITY_ORDER = {'critical': 0, 'warning': 1, 'info': 2}
SEVERITY_NAMES = {'critical': '严重', 'warning': '警告', 'info': '信息'}
SEVERITY_ICONS = {'critical': '🔴', 'warning': '🟡', 'info': '🔵'}


def generate_report(db, session: Session) -> str:
    """Generate a human-readable text report.
    
    Args:
        db: Database session
        session: Session to generate report for
    
    Returns:
        Text report as string
    """
    events = db.query(Event).filter_by(session_id=session.id).order_by(Event.timestamp).all()
    analyses = db.query(Analysis).filter_by(session_id=session.id).order_by(Analysis.started_at.desc()).all()
    samples = db.query(Sample).filter_by(session_id=session.id).all()
    
    report = []
    
    report.append("=" * 80)
    report.append(f"性能分析报告")
    report.append("=" * 80)
    report.append("")
    
    report.append(f"会话名称: {session.name}")
    report.append(f"会话描述: {session.description or '无'}")
    report.append(f"创建时间: {session.created_at}")
    if session.start_time:
        report.append(f"时间范围: {session.start_time} - {session.end_time}")
    report.append("")
    
    report.append("-" * 80)
    report.append("一、采样文件")
    report.append("-" * 80)
    report.append("")
    
    if samples:
        for sample in samples:
            report.append(f"  [{sample.sample_type}] {sample.file_path}")
            report.append(f"      导入时间: {sample.imported_at}")
        report.append("")
    else:
        report.append("  无采样文件")
        report.append("")
    
    report.append("-" * 80)
    report.append("二、分析摘要")
    report.append("-" * 80)
    report.append("")
    
    if events:
        by_severity = defaultdict(int)
        by_type = defaultdict(int)
        
        for event in events:
            by_severity[event.severity] += 1
            by_type[event.event_type] += 1
        
        report.append(f"总计检测到 {len(events)} 个异常事件:")
        report.append("")
        report.append("  按严重程度:")
        for severity in ['critical', 'warning', 'info']:
            if severity in by_severity:
                icon = SEVERITY_ICONS.get(severity, '')
                name = SEVERITY_NAMES.get(severity, severity)
                report.append(f"    {icon} {name}: {by_severity[severity]} 个")
        report.append("")
        
        report.append("  按事件类型:")
        for event_type, count in sorted(by_type.items()):
            type_name = EVENT_TYPES.get(event_type, event_type)
            report.append(f"    - {type_name}: {count} 个")
        report.append("")
    else:
        report.append("  未检测到异常事件")
        report.append("")
    
    if analyses:
        latest = analyses[0]
        report.append(f"最新分析: {latest.started_at}")
        report.append(f"分析摘要: {latest.summary or '无'}")
        report.append("")
    
    report.append("-" * 80)
    report.append("三、事件时间线")
    report.append("-" * 80)
    report.append("")
    
    if events:
        events_sorted = sorted(events, key=lambda e: (SEVERITY_ORDER.get(e.severity, 999), e.timestamp))
        
        for event in events_sorted:
            icon = SEVERITY_ICONS.get(event.severity, '')
            severity_name = SEVERITY_NAMES.get(event.severity, event.severity)
            type_name = EVENT_TYPES.get(event.event_type, event.event_type)
            
            time_str = event.timestamp.strftime("%Y-%m-%d %H:%M:%S")
            if event.end_timestamp:
                end_str = event.end_timestamp.strftime("%H:%M:%S")
                time_str += f" - {end_str}"
            
            report.append(f"{icon} [{severity_name.upper()}] {type_name}")
            report.append(f"    时间: {time_str}")
            report.append(f"    标题: {event.title}")
            if event.description:
                report.append(f"    描述: {event.description}")
            report.append("")
    else:
        report.append("  无事件")
        report.append("")
    
    report.append("-" * 80)
    report.append("四、诊断结论")
    report.append("-" * 80)
    report.append("")
    
    conclusion = generate_diagnosis(db, session, events)
    for line in conclusion.split('\n'):
        report.append(f"  {line}")
    report.append("")
    
    report.append("=" * 80)
    
    return "\n".join(report)


def generate_diagnosis(db, session: Session, events: List[Event]) -> str:
    """Generate a diagnosis conclusion based on events."""
    if not events:
        return "系统运行正常，未检测到性能异常。"
    
    conclusions = []
    
    critical_events = [e for e in events if e.severity == 'critical']
    warning_events = [e for e in events if e.severity == 'warning']
    
    if critical_events:
        conclusions.append(f"【严重】检测到 {len(critical_events)} 个严重问题，需要立即关注:")
        for event in critical_events[:5]:
            type_name = EVENT_TYPES.get(event.event_type, event.event_type)
            conclusions.append(f"  - {type_name}: {event.title}")
        conclusions.append("")
    
    if warning_events:
        conclusions.append(f"【警告】检测到 {len(warning_events)} 个潜在问题:")
        for event in warning_events[:5]:
            type_name = EVENT_TYPES.get(event.event_type, event.event_type)
            conclusions.append(f"  - {type_name}: {event.title}")
        conclusions.append("")
    
    by_type = defaultdict(list)
    for event in events:
        by_type[event.event_type].append(event)
    
    recommendations = []
    
    if 'cpu_spike' in by_type:
        cpu_events = by_type['cpu_spike']
        recommendations.append("【CPU】检测到 CPU 使用率飙高，建议:")
        recommendations.append("  - 检查是否有异常进程占用 CPU")
        recommendations.append("  - 查看是否有死循环或计算密集型任务")
        recommendations.append("  - 考虑使用 perf top 分析热点函数")
        recommendations.append("")
    
    if 'io_wait' in by_type:
        io_events = by_type['io_wait']
        recommendations.append("【IO】检测到 IO Wait 瓶颈，建议:")
        recommendations.append("  - 检查磁盘使用率和健康状态")
        recommendations.append("  - 分析哪个进程在进行大量 IO")
        recommendations.append("  - 考虑使用更快的存储或优化 IO 模式")
        recommendations.append("")
    
    if 'network_block' in by_type:
        net_events = by_type['network_block']
        recommendations.append("【网络】检测到网络连接问题，建议:")
        recommendations.append("  - 检查网络带宽和延迟")
        recommendations.append("  - 查看是否有连接泄漏或 TIME_WAIT 堆积")
        recommendations.append("  - 检查防火墙和网络配置")
        recommendations.append("")
    
    if 'syscall_block' in by_type:
        sys_events = by_type['syscall_block']
        recommendations.append("【系统调用】检测到系统调用阻塞，建议:")
        recommendations.append("  - 分析 strace 输出中的慢系统调用")
        recommendations.append("  - 检查是否有锁竞争 (futex 调用频繁)")
        recommendations.append("  - 考虑优化同步机制")
        recommendations.append("")
    
    if 'hotspot' in by_type:
        hot_events = by_type['hotspot']
        recommendations.append("【热点】检测到热点函数，建议:")
        recommendations.append("  - 使用火焰图分析调用栈")
        recommendations.append("  - 优化高频调用的函数")
        recommendations.append("  - 考虑算法优化或缓存策略")
        recommendations.append("")
    
    if recommendations:
        conclusions.append("【建议措施】")
        conclusions.extend(recommendations)
    
    if not conclusions:
        return "系统运行正常。"
    
    return "\n".join(conclusions)


def export_json(db, session: Session, output_path: str):
    """Export analysis report as JSON.
    
    Args:
        db: Database session
        session: Session to export
        output_path: Path to output JSON file
    """
    events = db.query(Event).filter_by(session_id=session.id).order_by(Event.timestamp).all()
    analyses = db.query(Analysis).filter_by(session_id=session.id).order_by(Analysis.started_at.desc()).all()
    samples = db.query(Sample).filter_by(session_id=session.id).all()
    
    report_data = {
        'session': {
            'id': session.id,
            'name': session.name,
            'description': session.description,
            'created_at': session.created_at.isoformat() if session.created_at else None,
            'start_time': session.start_time.isoformat() if session.start_time else None,
            'end_time': session.end_time.isoformat() if session.end_time else None,
        },
        'samples': [],
        'analyses': [],
        'events': [],
        'summary': {},
        'generated_at': datetime.utcnow().isoformat(),
    }
    
    for sample in samples:
        report_data['samples'].append({
            'id': sample.id,
            'sample_type': sample.sample_type,
            'file_path': sample.file_path,
            'imported_at': sample.imported_at.isoformat() if sample.imported_at else None,
        })
    
    for analysis in analyses:
        report_data['analyses'].append({
            'id': analysis.id,
            'analysis_type': analysis.analysis_type,
            'started_at': analysis.started_at.isoformat() if analysis.started_at else None,
            'completed_at': analysis.completed_at.isoformat() if analysis.completed_at else None,
            'summary': analysis.summary,
        })
    
    by_severity = defaultdict(int)
    by_type = defaultdict(int)
    
    for event in events:
        by_severity[event.severity] += 1
        by_type[event.event_type] += 1
        
        report_data['events'].append({
            'id': event.id,
            'event_type': event.event_type,
            'event_type_name': EVENT_TYPES.get(event.event_type, event.event_type),
            'severity': event.severity,
            'severity_name': SEVERITY_NAMES.get(event.severity, event.severity),
            'timestamp': event.timestamp.isoformat() if event.timestamp else None,
            'end_timestamp': event.end_timestamp.isoformat() if event.end_timestamp else None,
            'title': event.title,
            'description': event.description,
        })
    
    report_data['summary'] = {
        'total_events': len(events),
        'by_severity': dict(by_severity),
        'by_type': dict(by_type),
    }
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(report_data, f, ensure_ascii=False, indent=2)


def export_markdown(db, session: Session, output_path: str):
    """Export analysis report as Markdown.
    
    Args:
        db: Database session
        session: Session to export
        output_path: Path to output Markdown file
    """
    events = db.query(Event).filter_by(session_id=session.id).order_by(Event.timestamp).all()
    analyses = db.query(Analysis).filter_by(session_id=session.id).order_by(Analysis.started_at.desc()).all()
    samples = db.query(Sample).filter_by(session_id=session.id).all()
    
    lines = []
    
    lines.append(f"# 性能分析报告")
    lines.append("")
    lines.append(f"> 生成时间: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("")
    
    lines.append("## 会话信息")
    lines.append("")
    lines.append("| 字段 | 值 |")
    lines.append("|------|-----|")
    lines.append(f"| 会话名称 | {session.name} |")
    lines.append(f"| 描述 | {session.description or '无'} |")
    lines.append(f"| 创建时间 | {session.created_at} |")
    if session.start_time:
        lines.append(f"| 时间范围 | {session.start_time} - {session.end_time} |")
    lines.append("")
    
    lines.append("## 采样文件")
    lines.append("")
    if samples:
        lines.append("| 类型 | 文件路径 | 导入时间 |")
        lines.append("|------|----------|----------|")
        for sample in samples:
            lines.append(f"| {sample.sample_type} | `{sample.file_path}` | {sample.imported_at} |")
    else:
        lines.append("无采样文件")
    lines.append("")
    
    lines.append("## 分析摘要")
    lines.append("")
    
    if events:
        by_severity = defaultdict(int)
        by_type = defaultdict(int)
        
        for event in events:
            by_severity[event.severity] += 1
            by_type[event.event_type] += 1
        
        lines.append(f"**总计检测到 {len(events)} 个异常事件**")
        lines.append("")
        
        lines.append("### 按严重程度")
        lines.append("")
        lines.append("| 严重程度 | 数量 |")
        lines.append("|----------|------|")
        for severity in ['critical', 'warning', 'info']:
            if severity in by_severity:
                icon = SEVERITY_ICONS.get(severity, '')
                name = SEVERITY_NAMES.get(severity, severity)
                lines.append(f"| {icon} {name} | {by_severity[severity]} |")
        lines.append("")
        
        lines.append("### 按事件类型")
        lines.append("")
        lines.append("| 事件类型 | 数量 |")
        lines.append("|----------|------|")
        for event_type, count in sorted(by_type.items()):
            type_name = EVENT_TYPES.get(event_type, event_type)
            lines.append(f"| {type_name} | {count} |")
        lines.append("")
    else:
        lines.append("未检测到异常事件")
        lines.append("")
    
    if analyses:
        latest = analyses[0]
        lines.append("### 最新分析")
        lines.append("")
        lines.append(f"- 分析时间: {latest.started_at}")
        lines.append(f"- 摘要: {latest.summary or '无'}")
        lines.append("")
    
    lines.append("## 事件时间线")
    lines.append("")
    
    if events:
        events_sorted = sorted(events, key=lambda e: (SEVERITY_ORDER.get(e.severity, 999), e.timestamp))
        
        for event in events_sorted:
            icon = SEVERITY_ICONS.get(event.severity, '')
            severity_name = SEVERITY_NAMES.get(event.severity, event.severity)
            type_name = EVENT_TYPES.get(event.event_type, event.event_type)
            
            time_str = event.timestamp.strftime("%Y-%m-%d %H:%M:%S")
            if event.end_timestamp:
                end_str = event.end_timestamp.strftime("%H:%M:%S")
                time_str += f" - {end_str}"
            
            lines.append(f"### {icon} {severity_name.upper()}: {type_name}")
            lines.append("")
            lines.append(f"- **时间**: {time_str}")
            lines.append(f"- **标题**: {event.title}")
            if event.description:
                lines.append(f"- **描述**: {event.description}")
            lines.append("")
    else:
        lines.append("无事件")
        lines.append("")
    
    lines.append("## 诊断结论")
    lines.append("")
    
    conclusion = generate_diagnosis(db, session, events)
    lines.append("```")
    for line in conclusion.split('\n'):
        lines.append(line)
    lines.append("```")
    lines.append("")
    
    lines.append("---")
    lines.append("")
    lines.append("*报告由 perf-debugger 生成*")
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("\n".join(lines))
