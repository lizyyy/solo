# -*- coding: utf-8 -*-
"""
证件照影楼交付前复核工具 - 导出模块
负责导出Markdown交付清单和JSON审计包
"""

import os
import json
from datetime import datetime
from typing import Dict, List, Any, Optional
from config import EXPORT_DIR, EXPORT_CONFIG, OUTPUT_DIR, ISSUE_TYPES
from utils import logger, save_json_file, JSONEncoder, DateTimeHelper
from storage import ReviewStorage


class MarkdownExporter:
    """
    Markdown交付清单导出器
    """
    
    def __init__(self, storage: ReviewStorage = None):
        """
        初始化导出器
        
        Args:
            storage: 存储实例
        """
        self.storage = storage or ReviewStorage()
        self.export_dir = EXPORT_DIR
        
        if not os.path.exists(self.export_dir):
            os.makedirs(self.export_dir)
    
    def generate_delivery_checklist(self, session_id: int, 
                                    output_path: str = None) -> str:
        """
        生成交付清单Markdown
        
        Args:
            session_id: 会话ID
            output_path: 输出文件路径（可选）
            
        Returns:
            生成的文件路径
        """
        logger.info(f"开始生成交付清单Markdown，会话ID: {session_id}")
        
        session = self.storage.get_session(session_id)
        if not session:
            raise ValueError(f"会话不存在: {session_id}")
        
        stats = self.storage.get_statistics(session_id)
        all_issues = self.storage.get_issues_by_session(session_id)
        orders = self.storage.get_orders_by_session(session_id)
        
        md_content = self._build_markdown(session, stats, all_issues, orders)
        
        if not output_path:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"交付清单_{session.get('session_name', '未命名')}_{timestamp}.md"
            output_path = os.path.join(self.export_dir, filename)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(md_content)
        
        file_size = os.path.getsize(output_path)
        self.storage.record_export(session_id, 'markdown', output_path, file_size)
        
        logger.info(f"交付清单Markdown已生成: {output_path}")
        return output_path
    
    def _build_markdown(self, session: Dict, stats: Dict, 
                       issues: List[Dict], orders: List[Dict]) -> str:
        """
        构建Markdown内容
        """
        lines = []
        
        lines.append(f"# 证件照交付复核清单")
        lines.append("")
        
        lines.append("## 基本信息")
        lines.append("")
        lines.append(f"- **复核会话**: {session.get('session_name', '未命名')}")
        lines.append(f"- **开始时间**: {session.get('start_time', '未知')}")
        lines.append(f"- **结束时间**: {session.get('end_time', '进行中')}")
        lines.append(f"- **生成时间**: {DateTimeHelper.format_datetime(datetime.now())}")
        lines.append("")
        
        lines.append("## 统计概览")
        lines.append("")
        
        lines.append("### 订单统计")
        lines.append("")
        lines.append(f"- **总订单数**: {stats.get('total_orders', 0)}")
        lines.append(f"- **总问题数**: {stats.get('total_issues', 0)}")
        lines.append(f"- **已解决问题**: {stats.get('resolved_issues', 0)}")
        lines.append(f"- **未解决问题**: {stats.get('unresolved_issues', 0)}")
        lines.append("")
        
        lines.append("### 问题严重程度分布")
        lines.append("")
        
        severity_stats = stats.get('issues_by_severity', {})
        severity_order = ['critical', 'high', 'medium', 'low']
        severity_names = {
            'critical': '严重',
            'high': '高',
            'medium': '中',
            'low': '低'
        }
        
        for severity in severity_order:
            count = severity_stats.get(severity, 0)
            name = severity_names.get(severity, severity)
            lines.append(f"- **{name}**: {count} 个")
        
        lines.append("")
        
        lines.append("### 问题类型分布")
        lines.append("")
        
        type_stats = stats.get('issues_by_type', [])
        if type_stats:
            for item in type_stats:
                lines.append(f"- **{item.get('name', item.get('type', '未知'))}**: {item.get('count', 0)} 个")
        else:
            lines.append("- 无问题")
        
        lines.append("")
        
        lines.append("## 问题详情")
        lines.append("")
        
        if not issues:
            lines.append("✅ **恭喜！本次复核未发现任何问题**")
            lines.append("")
        else:
            issues_by_severity: Dict[str, List[Dict]] = {}
            for issue in issues:
                severity = issue.get('severity', 'medium')
                if severity not in issues_by_severity:
                    issues_by_severity[severity] = []
                issues_by_severity[severity].append(issue)
            
            for severity in severity_order:
                if severity not in issues_by_severity:
                    continue
                
                sev_issues = issues_by_severity[severity]
                sev_name = severity_names.get(severity, severity)
                icon = "🔴" if severity == 'critical' else "🟠" if severity == 'high' else "🟡" if severity == 'medium' else "🟢"
                
                lines.append(f"### {icon} {sev_name}级别问题 ({len(sev_issues)} 个)")
                lines.append("")
                
                for i, issue in enumerate(sev_issues, 1):
                    resolved = issue.get('resolved', False)
                    status_icon = "✅" if resolved else "❌"
                    lines.append(f"#### {status_icon} 问题 {i}: {issue.get('issue_name', '未知问题')}")
                    lines.append("")
                    lines.append(f"- **订单号**: {issue.get('order_id', '未知')}")
                    lines.append(f"- **检测时间**: {issue.get('detected_time', '未知')}")
                    lines.append(f"- **状态**: {'已解决' if resolved else '未解决'}")
                    
                    if resolved:
                        lines.append(f"- **解决时间**: {issue.get('resolved_time', '未知')}")
                        lines.append(f"- **处理人**: {issue.get('resolved_by', '未知')}")
                        if issue.get('resolution_notes'):
                            lines.append(f"- **解决备注**: {issue.get('resolution_notes')}")
                    
                    details = issue.get('details', {})
                    if details:
                        lines.append(f"- **详细信息**:")
                        lines.append("")
                        lines.append("```json")
                        lines.append(json.dumps(details, ensure_ascii=False, indent=2, default=str))
                        lines.append("```")
                    
                    notes = self.storage.get_notes_by_issue(issue.get('id'))
                    if notes:
                        lines.append(f"- **备注**:")
                        for note in notes:
                            lines.append(f"  - [{note.get('created_at')}] {note.get('author')}: {note.get('content')}")
                    
                    lines.append("")
        
        lines.append("## 订单清单")
        lines.append("")
        
        if orders:
            lines.append("| 订单号 | 客户姓名 | 尺寸 | 背景色 | 优先级 | 问题数 |")
            lines.append("|--------|----------|------|--------|--------|--------|")
            
            for order in orders:
                order_id = order.get('order_id', '')
                order_issues = self.storage.get_issues_by_order(order_id, session.get('id'))
                issue_count = len(order_issues)
                
                sizes = order.get('sizes', [])
                sizes_str = ", ".join(sizes) if isinstance(sizes, list) else str(sizes)
                
                issue_status = "⚠️" if issue_count > 0 else "✅"
                
                lines.append(f"| {order_id} | {order.get('customer_name', '')} | {sizes_str} | {order.get('background', '')} | {order.get('priority', '普通')} | {issue_status} {issue_count} |")
        else:
            lines.append("无订单数据")
        
        lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*本文档由证件照交付复核工具自动生成*")
        
        return "\n".join(lines)


class JSONExporter:
    """
    JSON审计包导出器
    """
    
    def __init__(self, storage: ReviewStorage = None):
        """
        初始化导出器
        
        Args:
            storage: 存储实例
        """
        self.storage = storage or ReviewStorage()
        self.export_dir = EXPORT_DIR
        
        if not os.path.exists(self.export_dir):
            os.makedirs(self.export_dir)
    
    def generate_audit_package(self, session_id: int, 
                               output_path: str = None) -> str:
        """
        生成JSON审计包
        
        Args:
            session_id: 会话ID
            output_path: 输出文件路径（可选）
            
        Returns:
            生成的文件路径
        """
        logger.info(f"开始生成JSON审计包，会话ID: {session_id}")
        
        session = self.storage.get_session(session_id)
        if not session:
            raise ValueError(f"会话不存在: {session_id}")
        
        audit_package = self._build_audit_package(session, session_id)
        
        if not output_path:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"审计包_{session.get('session_name', '未命名')}_{timestamp}.json"
            output_path = os.path.join(self.export_dir, filename)
        
        save_json_file(output_path, audit_package)
        
        file_size = os.path.getsize(output_path)
        self.storage.record_export(session_id, 'json', output_path, file_size)
        
        logger.info(f"JSON审计包已生成: {output_path}")
        return output_path
    
    def _build_audit_package(self, session: Dict, session_id: int) -> Dict[str, Any]:
        """
        构建审计包数据
        """
        stats = self.storage.get_statistics(session_id)
        issues = self.storage.get_issues_by_session(session_id)
        orders = self.storage.get_orders_by_session(session_id)
        
        orders_with_details = []
        for order in orders:
            order_id = order.get('order_id')
            order_issues = self.storage.get_issues_by_order(order_id, session_id)
            order_notes = self.storage.get_notes_by_order(order_id, session_id)
            
            orders_with_details.append({
                "order": order,
                "issues": order_issues,
                "notes": order_notes,
                "issue_count": len(order_issues)
            })
        
        audit_package = {
            "version": "1.0",
            "generated_at": datetime.now(),
            "session": {
                "id": session.get('id'),
                "name": session.get('session_name'),
                "start_time": session.get('start_time'),
                "end_time": session.get('end_time'),
                "status": session.get('status'),
                "notes": session.get('notes')
            },
            "statistics": {
                "total_orders": stats.get('total_orders', 0),
                "total_issues": stats.get('total_issues', 0),
                "resolved_issues": stats.get('resolved_issues', 0),
                "unresolved_issues": stats.get('unresolved_issues', 0),
                "issues_by_severity": stats.get('issues_by_severity', {}),
                "issues_by_type": stats.get('issues_by_type', [])
            },
            "issues": issues,
            "orders": orders_with_details,
            "issue_types_info": ISSUE_TYPES
        }
        
        return audit_package
    
    def export_full_database(self, output_path: str = None) -> str:
        """
        导出完整数据库为JSON（用于备份）
        
        Args:
            output_path: 输出文件路径
            
        Returns:
            生成的文件路径
        """
        logger.info("开始导出完整数据库备份")
        
        sessions = self.storage.get_all_sessions(limit=1000)
        
        full_export = {
            "version": "1.0",
            "export_type": "full_backup",
            "generated_at": datetime.now(),
            "sessions": []
        }
        
        for session in sessions:
            session_id = session.get('id')
            try:
                audit_package = self._build_audit_package(session, session_id)
                full_export["sessions"].append(audit_package)
            except Exception as e:
                logger.error(f"导出会话 {session_id} 失败: {e}")
        
        if not output_path:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"完整备份_{timestamp}.json"
            output_path = os.path.join(self.export_dir, filename)
        
        save_json_file(output_path, full_export)
        
        logger.info(f"完整数据库备份已生成: {output_path}")
        return output_path


class Exporter:
    """
    统一导出器
    整合Markdown和JSON导出功能
    """
    
    def __init__(self, storage: ReviewStorage = None):
        """
        初始化统一导出器
        
        Args:
            storage: 存储实例
        """
        self.storage = storage or ReviewStorage()
        self.markdown_exporter = MarkdownExporter(self.storage)
        self.json_exporter = JSONExporter(self.storage)
    
    def export_all(self, session_id: int, 
                   output_dir: str = None) -> Dict[str, str]:
        """
        导出所有格式
        
        Args:
            session_id: 会话ID
            output_dir: 输出目录（可选）
            
        Returns:
            {格式: 文件路径} 字典
        """
        logger.info(f"开始导出所有格式，会话ID: {session_id}")
        
        results = {}
        
        try:
            md_path = self.markdown_exporter.generate_delivery_checklist(session_id)
            results['markdown'] = md_path
        except Exception as e:
            logger.error(f"导出Markdown失败: {e}")
            results['markdown_error'] = str(e)
        
        try:
            json_path = self.json_exporter.generate_audit_package(session_id)
            results['json'] = json_path
        except Exception as e:
            logger.error(f"导出JSON失败: {e}")
            results['json_error'] = str(e)
        
        return results
    
    def export_markdown(self, session_id: int, output_path: str = None) -> str:
        """
        导出Markdown交付清单
        
        Args:
            session_id: 会话ID
            output_path: 输出路径
            
        Returns:
            文件路径
        """
        return self.markdown_exporter.generate_delivery_checklist(session_id, output_path)
    
    def export_json(self, session_id: int, output_path: str = None) -> str:
        """
        导出JSON审计包
        
        Args:
            session_id: 会话ID
            output_path: 输出路径
            
        Returns:
            文件路径
        """
        return self.json_exporter.generate_audit_package(session_id, output_path)
    
    def backup_database(self, output_path: str = None) -> str:
        """
        备份完整数据库
        
        Args:
            output_path: 输出路径
            
        Returns:
            文件路径
        """
        return self.json_exporter.export_full_database(output_path)
