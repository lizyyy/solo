"""报告生成器"""

import csv
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional, Dict, Any, TextIO
from io import StringIO

from .models import (
    AnalysisResult, RiskIssue, RiskLevel, 
    TimeSlot, Booking, FaultRecord
)


class ReportGenerator:
    """报告生成器"""
    
    @staticmethod
    def generate_markdown_report(
        result: AnalysisResult,
        report_title: str = "实验室值班预约风险报告",
        include_available_slots: bool = True
    ) -> str:
        """生成Markdown格式的风险报告"""
        lines = []
        
        lines.append(f"# {report_title}")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        lines.append("## 一、概览")
        lines.append("")
        
        total_bookings = len(result.bookings)
        total_faults = len(result.faults)
        total_issues = len(result.issues)
        high_risk = result.high_risk_count
        medium_risk = result.medium_risk_count
        low_risk = result.low_risk_count
        
        lines.append("| 统计项 | 数量 |")
        lines.append("|--------|------|")
        lines.append(f"| 预约记录 | {total_bookings} |")
        lines.append(f"| 故障记录 | {total_faults} |")
        lines.append(f"| 风险问题 | {total_issues} |")
        lines.append(f"| - 高风险 | {high_risk} |")
        lines.append(f"| - 中风险 | {medium_risk} |")
        lines.append(f"| - 低风险 | {low_risk} |")
        lines.append("")
        
        if total_issues > 0:
            status_emoji = "⚠️" if high_risk == 0 else "🚨"
            status_text = "存在风险问题，请查看详细内容"
        else:
            status_emoji = "✅"
            status_text = "无风险问题"
        
        lines.append(f"**整体状态**: {status_emoji} {status_text}")
        lines.append("")
        
        if result.issues:
            lines.append("## 二、风险问题详情")
            lines.append("")
            
            issues_by_type: Dict[str, List[RiskIssue]] = {}
            for issue in result.issues:
                if issue.issue_type not in issues_by_type:
                    issues_by_type[issue.issue_type] = []
                issues_by_type[issue.issue_type].append(issue)
            
            for issue_type, issues in issues_by_type.items():
                high_count = sum(1 for i in issues if i.risk_level == RiskLevel.HIGH)
                lines.append(f"### {issue_type}")
                lines.append("")
                
                for idx, issue in enumerate(issues, 1):
                    risk_icon = ReportGenerator._get_risk_icon(issue.risk_level)
                    lines.append(f"{risk_icon} **{idx}. {issue.description}**")
                    lines.append("")
                    
                    if issue.affected_bookings:
                        lines.append("   **受影响的预约**:")
                        for booking in issue.affected_bookings:
                            lines.append(f"   - `{booking.id}`: {booking.user_name} 使用 {booking.instrument_name} ({booking.start_time.strftime('%Y-%m-%d %H:%M')} - {booking.end_time.strftime('%H:%M')})")
                        lines.append("")
                    
                    if issue.affected_faults:
                        lines.append("   **相关故障**:")
                        for fault in issue.affected_faults:
                            lines.append(f"   - `{fault.id}`: {fault.description} ({fault.start_time.strftime('%Y-%m-%d %H:%M')} - {fault.end_time.strftime('%H:%M')})")
                        lines.append("")
                
                lines.append("")
        
        if include_available_slots and result.available_slots:
            lines.append("## 三、可用时段")
            lines.append("")
            lines.append("以下是工作时间内可调整的候选时段（排除已有预约和故障期）：")
            lines.append("")
            
            slots_by_date: Dict[str, List[TimeSlot]] = {}
            for slot in result.available_slots:
                date_str = slot.start_time.strftime('%Y-%m-%d')
                if date_str not in slots_by_date:
                    slots_by_date[date_str] = []
                slots_by_date[date_str].append(slot)
            
            for date_str in sorted(slots_by_date.keys()):
                slots = slots_by_date[date_str]
                lines.append(f"### {date_str}")
                lines.append("")
                lines.append("| 仪器 | 开始时间 | 结束时间 | 时长 |")
                lines.append("|------|----------|----------|------|")
                
                for slot in slots:
                    duration = ReportGenerator._format_duration(slot.duration)
                    lines.append(f"| {slot.instrument_name} | {slot.start_time.strftime('%H:%M')} | {slot.end_time.strftime('%H:%M')} | {duration} |")
                
                lines.append("")
        
        lines.append("## 四、预约详情")
        lines.append("")
        
        if result.bookings:
            lines.append("| 预约ID | 仪器 | 用户 | 日期 | 开始时间 | 结束时间 | 时长 |")
            lines.append("|--------|------|------|------|----------|----------|------|")
            
            for booking in sorted(result.bookings, key=lambda b: b.start_time):
                duration = ReportGenerator._format_duration(booking.duration)
                lines.append(f"| {booking.id} | {booking.instrument_name} | {booking.user_name} | {booking.start_time.strftime('%Y-%m-%d')} | {booking.start_time.strftime('%H:%M')} | {booking.end_time.strftime('%H:%M')} | {duration} |")
        else:
            lines.append("暂无预约记录。")
        lines.append("")
        
        if result.faults:
            lines.append("## 五、故障记录")
            lines.append("")
            lines.append("| 故障ID | 仪器 | 开始时间 | 结束时间 | 严重程度 | 描述 |")
            lines.append("|--------|------|----------|----------|----------|------|")
            
            for fault in sorted(result.faults, key=lambda f: f.start_time):
                lines.append(f"| {fault.id} | {fault.instrument_name} | {fault.start_time.strftime('%Y-%m-%d %H:%M')} | {fault.end_time.strftime('%H:%M')} | {fault.severity} | {fault.description} |")
            
            lines.append("")
        
        return "\n".join(lines)
    
    @staticmethod
    def export_available_slots_to_csv(slots: List[TimeSlot], output_path: str) -> None:
        """导出可用时段到CSV文件"""
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow([
                '日期', '仪器ID', '仪器名称', '开始时间', '结束时间', '时长(分钟)', '时长(小时)'
            ])
            
            for slot in slots:
                duration_minutes = int(slot.duration.total_seconds() // 60)
                duration_hours = round(duration_minutes / 60, 2)
                
                writer.writerow([
                    slot.start_time.strftime('%Y-%m-%d'),
                    slot.instrument_id,
                    slot.instrument_name,
                    slot.start_time.strftime('%H:%M'),
                    slot.end_time.strftime('%H:%M'),
                    duration_minutes,
                    duration_hours
                ])
    
    @staticmethod
    def export_issues_to_csv(issues: List[RiskIssue], output_path: str) -> None:
        """导出风险问题到CSV文件"""
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow([
                '问题类型', '风险等级', '描述', '涉及预约ID', '涉及故障ID'
            ])
            
            for issue in issues:
                booking_ids = ','.join(b.id for b in issue.affected_bookings)
                fault_ids = ','.join(f.id for f in issue.affected_faults)
                
                writer.writerow([
                    issue.issue_type,
                    issue.risk_level.value,
                    issue.description,
                    booking_ids,
                    fault_ids
                ])
    
    @staticmethod
    def _get_risk_icon(level: RiskLevel) -> str:
        """获取风险等级对应的图标"""
        icons = {
            RiskLevel.HIGH: "🔴",
            RiskLevel.MEDIUM: "🟡",
            RiskLevel.LOW: "🟢"
        }
        return icons.get(level, "⚪")
    
    @staticmethod
    def _format_duration(td: timedelta) -> str:
        """格式化时长显示"""
        hours = int(td.total_seconds() // 3600)
        minutes = int((td.total_seconds() % 3600) // 60)
        
        if hours > 0 and minutes > 0:
            return f"{hours}h{minutes}m"
        elif hours > 0:
            return f"{hours}h"
        else:
            return f"{minutes}m"
