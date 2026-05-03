import csv
import os
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import asdict

from models import (
    Deceased, ColdChamberLog, HandoverRecord, Rule,
    TimelineEvent, ChamberStatus, Issue, IssueType, Severity
)
from data_loader import DataLoader
from timeline_builder import TimelineBuilder
from anomaly_detector import AnomalyDetector


class Exporter:
    def __init__(
        self, 
        data_loader: DataLoader, 
        timeline_builder: TimelineBuilder,
        anomaly_detector: AnomalyDetector
    ):
        self.data_loader = data_loader
        self.timeline_builder = timeline_builder
        self.anomaly_detector = anomaly_detector

    def export_issues_csv(self, file_path: str, issues: Optional[List[Issue]] = None) -> bool:
        if issues is None:
            issues = self.anomaly_detector.all_issues
        
        if not issues:
            return False
        
        try:
            with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.writer(f)
                
                headers = [
                    '问题ID', '问题类型', '严重程度', '逝者ID', '柜号',
                    '开始时间', '结束时间', '是否已处理', '处理人',
                    '处理时间', '问题描述', '处理备注'
                ]
                writer.writerow(headers)
                
                for issue in issues:
                    row = [
                        issue.issue_id,
                        issue.issue_type,
                        issue.severity,
                        issue.deceased_id or '',
                        issue.chamber_id or '',
                        issue.start_time.strftime('%Y-%m-%d %H:%M:%S') if issue.start_time else '',
                        issue.end_time.strftime('%Y-%m-%d %H:%M:%S') if issue.end_time else '',
                        '是' if issue.is_resolved else '否',
                        issue.resolved_by or '',
                        issue.resolved_at.strftime('%Y-%m-%d %H:%M:%S') if issue.resolved_at else '',
                        issue.description,
                        issue.resolve_notes or ''
                    ]
                    writer.writerow(row)
            
            return True
        except Exception as e:
            print(f"导出issues.csv失败: {e}")
            return False

    def export_chamber_review_md(self, file_path: str) -> bool:
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write("# 冷藏柜流转审核报告\n\n")
                f.write(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
                f.write("---\n\n")
                
                all_issues = self.anomaly_detector.all_issues
                unresolved = [i for i in all_issues if not i.is_resolved]
                resolved = [i for i in all_issues if i.is_resolved]
                
                f.write("## 问题概览\n\n")
                f.write(f"- 总问题数: {len(all_issues)}\n")
                f.write(f"- 未处理: {len(unresolved)}\n")
                f.write(f"- 已处理: {len(resolved)}\n\n")
                
                issue_type_counts: Dict[str, int] = {}
                for issue in all_issues:
                    issue_type_counts[issue.issue_type] = issue_type_counts.get(issue.issue_type, 0) + 1
                
                if issue_type_counts:
                    f.write("### 按类型统计\n\n")
                    for issue_type, count in issue_type_counts.items():
                        f.write(f"- {issue_type}: {count} 个\n")
                    f.write("\n")
                
                severity_counts: Dict[str, int] = {}
                for issue in all_issues:
                    severity_counts[issue.severity] = severity_counts.get(issue.severity, 0) + 1
                
                if severity_counts:
                    f.write("### 按严重程度统计\n\n")
                    for severity in ['严重', '高', '中', '低']:
                        if severity in severity_counts:
                            f.write(f"- {severity}: {severity_counts[severity]} 个\n")
                    f.write("\n")
                
                f.write("---\n\n")
                
                chambers = self.timeline_builder.get_all_chambers()
                
                f.write("## 冷藏柜状态详情\n\n")
                
                for chamber_id in chambers:
                    f.write(f"### 冷藏柜: {chamber_id}\n\n")
                    
                    status = self.timeline_builder.get_chamber_status(chamber_id)
                    if status:
                        if status.current_occupant:
                            f.write(f"- 当前占用者: {status.current_occupant}\n")
                            if status.current_start_time:
                                f.write(f"- 入柜时间: {status.current_start_time.strftime('%Y-%m-%d %H:%M:%S')}\n")
                        else:
                            f.write("- 当前状态: 空闲\n")
                        
                        if status.occupancy_history:
                            f.write(f"\n#### 占用历史 ({len(status.occupancy_history)} 条记录)\n\n")
                            for idx, occ in enumerate(status.occupancy_history, 1):
                                start_str = occ['start_time'].strftime('%Y-%m-%d %H:%M:%S') if occ['start_time'] else 'N/A'
                                end_str = occ['end_time'].strftime('%Y-%m-%d %H:%M:%S') if occ['end_time'] else '进行中'
                                f.write(f"{idx}. 逝者: {occ['deceased_id']}, 入柜: {start_str}, 出柜: {end_str}\n")
                        
                        if status.temperature_history:
                            f.write(f"\n#### 温度记录 (最近10条)\n\n")
                            recent_temps = status.temperature_history[-10:]
                            for temp in recent_temps:
                                time_str = temp['timestamp'].strftime('%Y-%m-%d %H:%M:%S')
                                f.write(f"- {time_str}: {temp['temperature']}°C (操作员: {temp.get('operator', 'N/A')})\n")
                        f.write("\n")
                    
                    chamber_issues = self.anomaly_detector.get_issues_by_chamber(chamber_id)
                    if chamber_issues:
                        f.write(f"#### 相关问题 ({len(chamber_issues)} 个)\n\n")
                        for issue in chamber_issues:
                            status_mark = "[已处理]" if issue.is_resolved else "[未处理]"
                            f.write(f"- {status_mark} **{issue.issue_type}** ({issue.severity}): {issue.description}\n")
                        f.write("\n")
                    
                    f.write("---\n\n")
                
                if unresolved:
                    f.write("## 未处理问题详情\n\n")
                    
                    for issue in unresolved:
                        f.write(f"### 问题: {issue.issue_id}\n\n")
                        f.write(f"- 类型: {issue.issue_type}\n")
                        f.write(f"- 严重程度: {issue.severity}\n")
                        f.write(f"- 柜号: {issue.chamber_id or 'N/A'}\n")
                        f.write(f"- 逝者ID: {issue.deceased_id or 'N/A'}\n")
                        if issue.start_time:
                            f.write(f"- 开始时间: {issue.start_time.strftime('%Y-%m-%d %H:%M:%S')}\n")
                        if issue.end_time:
                            f.write(f"- 结束时间: {issue.end_time.strftime('%Y-%m-%d %H:%M:%S')}\n")
                        f.write(f"- 描述: {issue.description}\n\n")
                
                if resolved:
                    f.write("## 已处理问题记录\n\n")
                    
                    for issue in resolved:
                        f.write(f"- **{issue.issue_id}**: {issue.issue_type} ({issue.severity})\n")
                        f.write(f"  - 处理人: {issue.resolved_by or 'N/A'}\n")
                        f.write(f"  - 处理时间: {issue.resolved_at.strftime('%Y-%m-%d %H:%M:%S') if issue.resolved_at else 'N/A'}\n")
                        f.write(f"  - 处理备注: {issue.resolve_notes or '无'}\n\n")
                
                f.write("---\n\n")
                f.write("## 备注\n\n")
                f.write("- 请定期检查温度超窗和重叠占用等严重问题\n")
                f.write("- 跨午夜问题需要与交班值班员确认归属日期\n")
                f.write("- 所有处理记录请妥善保存以便日后查阅\n")
            
            return True
        except Exception as e:
            print(f"导出chamber_review.md失败: {e}")
            return False

    def export_deceased_timeline(self, file_path: str, deceased_id: str) -> bool:
        timeline = self.timeline_builder.get_deceased_timeline(deceased_id)
        if not timeline:
            return False
        
        deceased = self.data_loader.deceased_dict.get(deceased_id)
        
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(f"# 逝者时间线: {deceased_id}\n\n")
                
                if deceased:
                    f.write(f"## 基本信息\n\n")
                    f.write(f"- 姓名: {deceased.name}\n")
                    f.write(f"- 性别: {deceased.gender}\n")
                    if deceased.birth_date:
                        f.write(f"- 出生日期: {deceased.birth_date.strftime('%Y-%m-%d')}\n")
                    if deceased.death_date:
                        f.write(f"- 死亡日期: {deceased.death_date.strftime('%Y-%m-%d')}\n")
                    if deceased.cause_of_death:
                        f.write(f"- 死亡原因: {deceased.cause_of_death}\n")
                    f.write("\n")
                
                f.write("## 时间线记录\n\n")
                
                for event in timeline:
                    f.write(f"### {event.timestamp.strftime('%Y-%m-%d %H:%M:%S')}\n\n")
                    f.write(f"- 事件类型: {event.event_type}\n")
                    f.write(f"- 柜号: {event.chamber_id or 'N/A'}\n")
                    
                    details = event.details
                    if details.get("temperature") is not None:
                        f.write(f"- 温度: {details['temperature']}°C\n")
                    if details.get("operator"):
                        f.write(f"- 操作员: {details['operator']}\n")
                    if details.get("handover_type"):
                        f.write(f"- 交接类型: {details['handover_type']}\n")
                    if details.get("from_chamber"):
                        f.write(f"- 从柜号: {details['from_chamber']}\n")
                    if details.get("to_chamber"):
                        f.write(f"- 到柜号: {details['to_chamber']}\n")
                    if details.get("is_signed") is not None:
                        f.write(f"- 已签收: {'是' if details['is_signed'] else '否'}\n")
                    if details.get("remarks"):
                        f.write(f"- 备注: {details['remarks']}\n")
                    
                    f.write("\n")
                
                issues = self.anomaly_detector.get_issues_by_deceased(deceased_id)
                if issues:
                    f.write("## 相关问题\n\n")
                    for issue in issues:
                        status_mark = "[已处理]" if issue.is_resolved else "[未处理]"
                        f.write(f"- {status_mark} **{issue.issue_type}** ({issue.severity}): {issue.description}\n")
            
            return True
        except Exception as e:
            print(f"导出逝者时间线失败: {e}")
            return False
