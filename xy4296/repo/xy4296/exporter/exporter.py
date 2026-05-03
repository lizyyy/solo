#!/usr/bin/env python3
"""
导出模块
负责导出Markdown放行单、CSV风险清单和JSON审计包
"""

import csv
import json
import os
from datetime import datetime
from typing import Dict, List, Any, Optional
from pathlib import Path


class Exporter:
    """导出器类"""
    
    SEVERITY_DISPLAY = {
        'critical': '严重',
        'high': '高',
        'medium': '中',
        'warning': '警告',
        'low': '低'
    }
    
    STATUS_DISPLAY = {
        'pending': '待复核',
        'reviewed': '已复核',
        'approved': '已放行',
        'rejected': '已驳回'
    }
    
    CATEGORY_DISPLAY = {
        'no_fly_time': '禁飞时段',
        'wind_impact_zone': '风向影响区',
        'ammunition_expiry': '弹药库存',
        'qualification_expiry': '人员资质',
        'radar_threat': '雷达威胁'
    }
    
    def __init__(self):
        """初始化导出器"""
        pass
    
    def export_markdown_release_note(self, 
                                        session_data: Dict[str, Any],
                                        risks: List[Dict[str, Any]],
                                        parsed_data: Dict[str, Any],
                                        output_path: str) -> bool:
        """
        导出Markdown放行单
        
        Args:
            session_data: 会话数据
            risks: 风险列表
            parsed_data: 解析后的数据
            output_path: 输出文件路径
            
        Returns:
            是否导出成功
        """
        try:
            lines = []
            
            # 标题
            lines.append('# 人工增雨作业放行单')
            lines.append('')
            lines.append('---')
            lines.append('')
            
            # 基本信息
            lines.append('## 基本信息')
            lines.append('')
            
            session_id = session_data.get('session_id', '未知')
            operation_name = session_data.get('operation_name', '未命名作业')
            created_at = session_data.get('created_at')
            if isinstance(created_at, datetime):
                created_at_str = created_at.strftime('%Y-%m-%d %H:%M:%S')
            else:
                created_at_str = str(created_at)
            
            status = session_data.get('status', 'pending')
            status_display = self.STATUS_DISPLAY.get(status, status)
            
            lines.append(f'- **作业编号**: {session_id}')
            lines.append(f'- **作业名称**: {operation_name}')
            lines.append(f'- **创建时间**: {created_at_str}')
            lines.append(f'- **当前状态**: {status_display}')
            lines.append('')
            
            # 复核信息
            review_notes = session_data.get('review_notes', '')
            approval_notes = session_data.get('approval_notes', '')
            rejection_reason = session_data.get('rejection_reason', '')
            
            if review_notes:
                lines.append('## 复核意见')
                lines.append('')
                lines.append(review_notes)
                lines.append('')
            
            if approval_notes:
                lines.append('## 放行意见')
                lines.append('')
                lines.append(approval_notes)
                lines.append('')
            
            if rejection_reason:
                lines.append('## 驳回原因')
                lines.append('')
                lines.append(rejection_reason)
                lines.append('')
            
            # 风险评估
            lines.append('## 风险评估')
            lines.append('')
            
            if risks:
                # 按严重程度分组
                by_severity = {}
                for risk in risks:
                    severity = risk.get('severity', 'low')
                    if severity not in by_severity:
                        by_severity[severity] = []
                    by_severity[severity].append(risk)
                
                # 统计
                total_risks = len(risks)
                critical_count = len(by_severity.get('critical', []))
                high_count = len(by_severity.get('high', []))
                medium_count = len(by_severity.get('medium', []))
                warning_count = len(by_severity.get('warning', []))
                low_count = len(by_severity.get('low', []))
                
                lines.append(f'**总风险数**: {total_risks}')
                lines.append('')
                lines.append(f'- 严重风险: {critical_count}')
                lines.append(f'- 高风险: {high_count}')
                lines.append(f'- 中等风险: {medium_count}')
                lines.append(f'- 警告: {warning_count}')
                lines.append(f'- 低风险: {low_count}')
                lines.append('')
                
                # 详细风险列表
                lines.append('### 详细风险列表')
                lines.append('')
                
                # 按严重程度排序显示
                severity_order = ['critical', 'high', 'medium', 'warning', 'low']
                
                for severity in severity_order:
                    if severity in by_severity:
                        severity_name = self.SEVERITY_DISPLAY.get(severity, severity)
                        lines.append(f'#### {severity_name}风险')
                        lines.append('')
                        
                        for i, risk in enumerate(by_severity[severity], 1):
                            title = risk.get('title', '未知风险')
                            description = risk.get('description', '')
                            category = risk.get('category', 'unknown')
                            category_name = self.CATEGORY_DISPLAY.get(category, category)
                            
                            lines.append(f'**{i}. {title}**')
                            lines.append(f'- 类别: {category_name}')
                            lines.append(f'- 描述: {description}')
                            lines.append('')
            else:
                lines.append('未检测到风险。')
                lines.append('')
            
            # 数据来源
            data_sources = session_data.get('data_sources', [])
            if data_sources:
                lines.append('## 数据来源')
                lines.append('')
                for i, source in enumerate(data_sources, 1):
                    file_path = source.get('file_path', '未知')
                    data_type = source.get('data_type', '未知')
                    added_at = source.get('added_at', '')
                    lines.append(f'{i}. **{data_type}**: {file_path}')
                    if added_at:
                        lines.append(f'   - 导入时间: {added_at}')
                lines.append('')
            
            # 签名区域
            lines.append('---')
            lines.append('')
            lines.append('## 签名确认')
            lines.append('')
            lines.append('| 角色 | 签名 | 日期 |')
            lines.append('|------|------|------|')
            lines.append('| 复核人 | _______________ | _______________ |')
            lines.append('| 审批人 | _______________ | _______________ |')
            lines.append('')
            
            # 生成时间
            now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            lines.append(f'*文档生成时间: {now}*')
            
            # 写入文件
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write('\n'.join(lines))
            
            return True
        except Exception as e:
            print(f"导出Markdown放行单失败: {e}")
            return False
    
    def export_csv_risk_list(self, 
                               risks: List[Dict[str, Any]],
                               output_path: str) -> bool:
        """
        导出CSV风险清单
        
        Args:
            risks: 风险列表
            output_path: 输出文件路径
            
        Returns:
            是否导出成功
        """
        try:
            if not risks:
                # 创建空文件
                with open(output_path, 'w', encoding='utf-8', newline='') as f:
                    writer = csv.writer(f)
                    writer.writerow(['序号', '严重程度', '类别', '标题', '描述', '时间戳'])
                return True
            
            # 准备数据
            rows = []
            for i, risk in enumerate(risks, 1):
                severity = risk.get('severity', 'low')
                severity_name = self.SEVERITY_DISPLAY.get(severity, severity)
                category = risk.get('category', 'unknown')
                category_name = self.CATEGORY_DISPLAY.get(category, category)
                title = risk.get('title', '')
                description = risk.get('description', '')
                
                timestamp = risk.get('timestamp')
                if isinstance(timestamp, datetime):
                    timestamp_str = timestamp.strftime('%Y-%m-%d %H:%M:%S')
                else:
                    timestamp_str = str(timestamp)
                
                rows.append([
                    i,
                    severity_name,
                    category_name,
                    title,
                    description,
                    timestamp_str
                ])
            
            # 写入CSV
            with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.writer(f)
                # 写入表头
                writer.writerow(['序号', '严重程度', '类别', '标题', '描述', '时间戳'])
                # 写入数据
                writer.writerows(rows)
            
            return True
        except Exception as e:
            print(f"导出CSV风险清单失败: {e}")
            return False
    
    def export_json_audit_package(self,
                                    session_data: Dict[str, Any],
                                    risks: List[Dict[str, Any]],
                                    parsed_data: Dict[str, Any],
                                    output_path: str) -> bool:
        """
        导出JSON审计包
        
        Args:
            session_data: 会话数据
            risks: 风险列表
            parsed_data: 解析后的数据
            output_path: 输出文件路径
            
        Returns:
            是否导出成功
        """
        try:
            # 准备审计包数据
            audit_package = {
                'version': '1.0',
                'export_time': datetime.now().isoformat(),
                'session': self._serialize_for_json(session_data),
                'risks': self._serialize_risks_for_json(risks),
                'data_summary': self._create_data_summary(parsed_data),
                'metadata': {
                    'system_info': {
                        'application': '增雨作业放行盘',
                        'version': '1.0.0'
                    }
                }
            }
            
            # 写入JSON文件
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(audit_package, f, ensure_ascii=False, indent=2, default=str)
            
            return True
        except Exception as e:
            print(f"导出JSON审计包失败: {e}")
            return False
    
    def _serialize_for_json(self, data: Any) -> Any:
        """
        序列化数据为JSON兼容格式
        
        Args:
            data: 原始数据
            
        Returns:
            序列化后的数据
        """
        if isinstance(data, dict):
            return {k: self._serialize_for_json(v) for k, v in data.items()}
        elif isinstance(data, list):
            return [self._serialize_for_json(item) for item in data]
        elif isinstance(data, datetime):
            return data.isoformat()
        else:
            return data
    
    def _serialize_risks_for_json(self, risks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        序列化风险列表
        
        Args:
            risks: 风险列表
            
        Returns:
            序列化后的风险列表
        """
        serialized = []
        for risk in risks:
            serialized_risk = self._serialize_for_json(risk)
            # 添加显示名称
            severity = risk.get('severity', 'low')
            category = risk.get('category', 'unknown')
            serialized_risk['severity_name'] = self.SEVERITY_DISPLAY.get(severity, severity)
            serialized_risk['category_name'] = self.CATEGORY_DISPLAY.get(category, category)
            serialized.append(serialized_risk)
        return serialized
    
    def _create_data_summary(self, parsed_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        创建数据摘要
        
        Args:
            parsed_data: 解析后的数据
            
        Returns:
            数据摘要
        """
        summary = {
            'radar_data': {'count': len(parsed_data.get('radar_data', []))},
            'airspace_approvals': {'count': len(parsed_data.get('airspace_approvals', []))},
            'operation_points': {'count': len(parsed_data.get('operation_points', []))},
            'ammunition_inventory': {'count': len(parsed_data.get('ammunition_inventory', []))},
            'personnel_qualifications': {'count': len(parsed_data.get('personnel_qualifications', []))}
        }
        
        # 添加弹药统计
        ammunition = parsed_data.get('ammunition_inventory', [])
        if ammunition:
            total_quantity = sum(item.get('quantity', 0) for item in ammunition)
            summary['ammunition_inventory']['total_quantity'] = total_quantity
        
        return summary
    
    def generate_filename(self, base_name: str, extension: str, 
                          session_id: str = '') -> str:
        """
        生成文件名
        
        Args:
            base_name: 基础名称
            extension: 文件扩展名
            session_id: 会话ID
            
        Returns:
            生成的文件名
        """
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        if session_id:
            return f'{base_name}_{session_id}_{timestamp}.{extension}'
        else:
            return f'{base_name}_{timestamp}.{extension}'
