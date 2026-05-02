from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
import csv
import json
import io
from io import StringIO

from models import Pottery, SpliceGroup, Issue, AuditLog, Version
from app import db


class ExportService:
    
    @staticmethod
    def generate_markdown_review_form(group: SpliceGroup,
                                       include_issues: bool = True) -> str:
        potteries = group.get_potteries()
        issues = group.issues.all() if include_issues else []
        
        md_lines = []
        
        md_lines.append(f"# 陶片拼接复核单")
        md_lines.append("")
        md_lines.append(f"**复核单号**: {group.group_id}")
        md_lines.append(f"**拼接组名称**: {group.name or '未命名'}")
        md_lines.append(f"**当前状态**: {group.status}")
        md_lines.append(f"**创建时间**: {group.created_at.strftime('%Y-%m-%d %H:%M:%S') if group.created_at else '-'}")
        md_lines.append("")
        
        md_lines.append("## 一、拼接组信息")
        md_lines.append("")
        md_lines.append(f"**描述**: {group.description or '无描述'}")
        md_lines.append("")
        md_lines.append(f"**人工拼接猜测证据**:")
        md_lines.append("")
        md_lines.append(f"> {group.guess_evidence or '未提供证据描述'}")
        md_lines.append("")
        
        if group.guess_submitted_by:
            md_lines.append(f"**提交人**: {group.guess_submitted_by}")
        if group.guess_submitted_at:
            md_lines.append(f"**提交时间**: {group.guess_submitted_at.strftime('%Y-%m-%d %H:%M:%S')}")
        md_lines.append("")
        
        md_lines.append("## 二、陶片列表")
        md_lines.append("")
        
        if potteries:
            md_lines.append("| 陶片编号 | 探方 | 层位 | 方号 | 纹饰 | 胎土 | 状态 |")
            md_lines.append("|----------|------|------|------|------|------|------|")
            
            for pottery in potteries:
                md_lines.append(
                    f"| {pottery.pottery_id} | {pottery.trench} | {pottery.layer} | "
                    f"{pottery.square or '-'} | {pottery.decoration or '-'} | "
                    f"{pottery.paste_type or '-'} | {pottery.status} |"
                )
        else:
            md_lines.append("*暂无陶片*")
        md_lines.append("")
        
        md_lines.append("### 2.1 陶片拼接关联详情")
        md_lines.append("")
        
        for assoc in group.associations:
            pottery = assoc.pottery
            if pottery:
                md_lines.append(f"#### {pottery.pottery_id}")
                md_lines.append("")
                md_lines.append(f"- **边缘位置**: {assoc.edge_position or '未指定'}")
                md_lines.append(f"- **边缘尺寸**: {assoc.edge_length or '未测量'} cm")
                md_lines.append(f"- **匹配置信度**: {assoc.match_confidence or '未评估'}")
                if assoc.match_notes:
                    md_lines.append(f"- **匹配备注**: {assoc.match_notes}")
                md_lines.append("")
        
        md_lines.append("## 三、测量数据汇总")
        md_lines.append("")
        
        if potteries:
            md_lines.append("| 陶片编号 | 长度(cm) | 宽度(cm) | 厚度(cm) | 重量(g) |")
            md_lines.append("|----------|----------|----------|----------|---------|")
            
            for pottery in potteries:
                md_lines.append(
                    f"| {pottery.pottery_id} | "
                    f"{pottery.length or '-'} | "
                    f"{pottery.width or '-'} | "
                    f"{pottery.thickness or '-'} | "
                    f"{pottery.weight or '-'} |"
                )
        md_lines.append("")
        
        if include_issues and issues:
            md_lines.append("## 四、规则校验问题")
            md_lines.append("")
            
            severity_order = ['critical', 'high', 'medium', 'low', 'warning']
            sorted_issues = sorted(
                issues,
                key=lambda x: severity_order.index(x.severity) if x.severity in severity_order else 999
            )
            
            for issue in sorted_issues:
                severity_icon = {
                    'critical': '🔴',
                    'high': '🟠',
                    'medium': '🟡',
                    'low': '🟢',
                    'warning': '⚠️'
                }.get(issue.severity, '⚪')
                
                md_lines.append(f"### {severity_icon} {issue.title}")
                md_lines.append("")
                md_lines.append(f"**问题类型**: {issue.issue_type}")
                md_lines.append(f"**严重程度**: {issue.severity}")
                md_lines.append("")
                md_lines.append(f"**描述**: {issue.description}")
                md_lines.append("")
                if issue.rule_name:
                    md_lines.append(f"**触发规则**: {issue.rule_name}")
                if issue.notes:
                    md_lines.append(f"**备注**: {issue.notes}")
                md_lines.append("")
        
        md_lines.append("## 五、复核记录")
        md_lines.append("")
        
        if group.review_result:
            md_lines.append(f"**复核结果**: {group.review_result}")
            md_lines.append(f"**复核人**: {group.reviewed_by or '未记录'}")
            md_lines.append(f"**复核时间**: {group.reviewed_at.strftime('%Y-%m-%d %H:%M:%S') if group.reviewed_at else '-'}")
            if group.review_notes:
                md_lines.append("")
                md_lines.append("**复核意见**:")
                md_lines.append("")
                md_lines.append(f"> {group.review_notes}")
        else:
            md_lines.append("*暂无复核记录*")
        md_lines.append("")
        
        md_lines.append("---")
        md_lines.append("")
        md_lines.append(f"**文档生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        md_lines.append(f"**版本号**: v{group.version}")
        
        return "\n".join(md_lines)
    
    @staticmethod
    def generate_issues_csv(issues: List[Issue]) -> Tuple[str, str]:
        output = StringIO()
        writer = csv.writer(output)
        
        headers = [
            '问题ID', '问题类型', '严重程度', '标题', '描述',
            '关联陶片编号', '关联拼接组编号', '规则名称',
            '状态', '创建时间', '检测人'
        ]
        writer.writerow(headers)
        
        for issue in issues:
            row = [
                issue.id,
                issue.issue_type or '',
                issue.severity or '',
                issue.title or '',
                issue.description or '',
                issue.pottery.pottery_id if issue.pottery else '',
                issue.splice_group.group_id if issue.splice_group else '',
                issue.rule_name or '',
                issue.status or '',
                issue.created_at.strftime('%Y-%m-%d %H:%M:%S') if issue.created_at else '',
                issue.detected_by or ''
            ]
            writer.writerow(row)
        
        csv_content = output.getvalue()
        output.close()
        
        filename = f"issues_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        
        return csv_content, filename
    
    @staticmethod
    def generate_audit_json(audit_logs: List[AuditLog],
                           include_versions: bool = False,
                           versions: Optional[List[Version]] = None) -> Tuple[str, str]:
        audit_data = {
            'export_info': {
                'export_time': datetime.now().isoformat(),
                'log_count': len(audit_logs),
                'version_count': len(versions) if versions else 0
            },
            'audit_logs': [],
            'versions': []
        }
        
        for log in audit_logs:
            log_dict = log.to_dict()
            try:
                if log.old_values:
                    log_dict['old_values'] = json.loads(log.old_values)
                if log.new_values:
                    log_dict['new_values'] = json.loads(log.new_values)
            except json.JSONDecodeError:
                pass
            audit_data['audit_logs'].append(log_dict)
        
        if include_versions and versions:
            for version in versions:
                version_dict = version.to_dict()
                try:
                    if version_dict.get('data'):
                        version_dict['data'] = json.loads(version_dict['data'])
                except json.JSONDecodeError:
                    pass
                audit_data['versions'].append(version_dict)
        
        json_content = json.dumps(audit_data, ensure_ascii=False, indent=2, default=str)
        filename = f"audit_package_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        return json_content, filename
    
    @staticmethod
    def generate_pottery_export(potteries: List[Pottery],
                                format: str = 'json') -> Tuple[str, str]:
        if format == 'csv':
            return ExportService._generate_pottery_csv(potteries)
        else:
            return ExportService._generate_pottery_json(potteries)
    
    @staticmethod
    def _generate_pottery_json(potteries: List[Pottery]) -> Tuple[str, str]:
        data = {
            'export_time': datetime.now().isoformat(),
            'count': len(potteries),
            'potteries': [p.to_dict(include_issues=True) for p in potteries]
        }
        
        json_content = json.dumps(data, ensure_ascii=False, indent=2, default=str)
        filename = f"pottery_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        return json_content, filename
    
    @staticmethod
    def _generate_pottery_csv(potteries: List[Pottery]) -> Tuple[str, str]:
        output = StringIO()
        writer = csv.writer(output)
        
        headers = [
            '陶片编号', '探方', '层位', '方号',
            '长度(cm)', '宽度(cm)', '厚度(cm)', '重量(g)',
            '纹饰', '胎土', '颜色',
            '照片路径', '状态', '备注',
            '创建时间', '更新时间', '版本号'
        ]
        writer.writerow(headers)
        
        for p in potteries:
            row = [
                p.pottery_id or '',
                p.trench or '',
                p.layer or '',
                p.square or '',
                p.length or '',
                p.width or '',
                p.thickness or '',
                p.weight or '',
                p.decoration or '',
                p.paste_type or '',
                p.color or '',
                p.photo_path or '',
                p.status or '',
                p.notes or '',
                p.created_at.strftime('%Y-%m-%d %H:%M:%S') if p.created_at else '',
                p.updated_at.strftime('%Y-%m-%d %H:%M:%S') if p.updated_at else '',
                p.version or 1
            ]
            writer.writerow(row)
        
        csv_content = output.getvalue()
        output.close()
        
        filename = f"pottery_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        
        return csv_content, filename
    
    @staticmethod
    def generate_group_export(groups: List[SpliceGroup],
                              format: str = 'json') -> Tuple[str, str]:
        if format == 'csv':
            return ExportService._generate_group_csv(groups)
        else:
            return ExportService._generate_group_json(groups)
    
    @staticmethod
    def _generate_group_json(groups: List[SpliceGroup]) -> Tuple[str, str]:
        data = {
            'export_time': datetime.now().isoformat(),
            'count': len(groups),
            'groups': [g.to_dict(include_potteries=True, include_issues=True) for g in groups]
        }
        
        json_content = json.dumps(data, ensure_ascii=False, indent=2, default=str)
        filename = f"group_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        return json_content, filename
    
    @staticmethod
    def _generate_group_csv(groups: List[SpliceGroup]) -> Tuple[str, str]:
        output = StringIO()
        writer = csv.writer(output)
        
        headers = [
            '拼接组编号', '名称', '描述', '状态',
            '陶片数量', '陶片编号列表',
            '提交人', '提交时间',
            '复核人', '复核时间', '复核结果',
            '创建时间', '版本号'
        ]
        writer.writerow(headers)
        
        for g in groups:
            pottery_ids = g.get_pottery_ids()
            row = [
                g.group_id or '',
                g.name or '',
                g.description or '',
                g.status or '',
                len(pottery_ids),
                ','.join(pottery_ids),
                g.guess_submitted_by or '',
                g.guess_submitted_at.strftime('%Y-%m-%d %H:%M:%S') if g.guess_submitted_at else '',
                g.reviewed_by or '',
                g.reviewed_at.strftime('%Y-%m-%d %H:%M:%S') if g.reviewed_at else '',
                g.review_result or '',
                g.created_at.strftime('%Y-%m-%d %H:%M:%S') if g.created_at else '',
                g.version or 1
            ]
            writer.writerow(row)
        
        csv_content = output.getvalue()
        output.close()
        
        filename = f"group_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        
        return csv_content, filename
    
    @staticmethod
    def generate_validation_report(results: Dict[str, Any]) -> str:
        md_lines = []
        
        md_lines.append("# 规则校验报告")
        md_lines.append("")
        md_lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        md_lines.append("")
        
        summary = results.get('summary', {})
        
        md_lines.append("## 一、校验汇总")
        md_lines.append("")
        md_lines.append(f"- **检查陶片数**: {summary.get('total_potteries', 0)}")
        md_lines.append(f"- **检查拼接组数**: {summary.get('total_groups', 0)}")
        md_lines.append(f"- **发现问题陶片**: {summary.get('potteries_with_issues', 0)}")
        md_lines.append(f"- **发现问题拼接组**: {summary.get('groups_with_issues', 0)}")
        md_lines.append(f"- **问题总数**: {summary.get('total_issues', 0)}")
        md_lines.append("")
        
        severity_counts = summary.get('severity_counts', {})
        if severity_counts:
            md_lines.append("### 问题严重程度分布")
            md_lines.append("")
            md_lines.append("| 严重程度 | 数量 |")
            md_lines.append("|----------|------|")
            for severity, count in severity_counts.items():
                if count > 0:
                    md_lines.append(f"| {severity} | {count} |")
            md_lines.append("")
        
        pottery_results = results.get('pottery_results', {})
        if pottery_results:
            md_lines.append("## 二、陶片校验详情")
            md_lines.append("")
            
            for pottery_id, result in pottery_results.items():
                issues = result.get('issues', [])
                if issues:
                    md_lines.append(f"### {pottery_id}")
                    md_lines.append("")
                    
                    for issue in issues:
                        severity = issue.get('severity', 'warning')
                        md_lines.append(f"- **[{severity}]** {issue.get('title', '未命名问题')}")
                        md_lines.append(f"  {issue.get('description', '无描述')}")
                        md_lines.append("")
        
        group_results = results.get('group_results', {})
        if group_results:
            md_lines.append("## 三、拼接组校验详情")
            md_lines.append("")
            
            for group_id, result in group_results.items():
                issues = result.get('issues', [])
                if issues:
                    md_lines.append(f"### {group_id}")
                    md_lines.append("")
                    
                    for issue in issues:
                        severity = issue.get('severity', 'warning')
                        md_lines.append(f"- **[{severity}]** {issue.get('title', '未命名问题')}")
                        md_lines.append(f"  {issue.get('description', '无描述')}")
                        md_lines.append("")
        
        return "\n".join(md_lines)
