"""
报告导出模块
支持导出 Markdown 交付单、CSV 问题清单和 JSON 证据包
"""

import csv
import json
import os
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime
from dataclasses import asdict

# 导入内部模块
from .validator import ValidationResult, ValidationIssue, ValidationSeverity, ValidationCategory
from .state_store import StateStore, MaterialStatus, MaterialState


class MarkdownExporter:
    """Markdown交付单导出器"""
    
    def __init__(self, 
                 state_store: StateStore = None,
                 validation_result: ValidationResult = None,
                 project_info: Dict[str, Any] = None):
        """
        初始化Markdown导出器
        
        Args:
            state_store: 状态存储器
            validation_result: 校验结果
            project_info: 项目信息
        """
        self.state_store = state_store
        self.validation_result = validation_result
        self.project_info = project_info or {}
    
    def export(self, output_path: str) -> bool:
        """
        导出Markdown交付单
        
        Args:
            output_path: 输出文件路径
            
        Returns:
            是否导出成功
        """
        try:
            content = self._generate_content()
            
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            return True
        except Exception as e:
            print(f"导出Markdown时出错: {e}")
            return False
    
    def _generate_content(self) -> str:
        """生成Markdown内容"""
        lines = []
        
        # 标题
        lines.append("# 野外录音交付整理箱 - 交付单")
        lines.append("")
        lines.append(f"> 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        # 项目信息
        lines.append("## 项目概览")
        lines.append("")
        
        if self.project_info:
            for key, value in self.project_info.items():
                lines.append(f"- **{key}**: {value}")
            lines.append("")
        
        # 统计信息
        if self.state_store:
            stats = self.state_store.get_statistics()
            lines.append("### 素材统计")
            lines.append("")
            lines.append(f"- **总素材数**: {stats['total_materials']}")
            lines.append(f"- **可用素材**: {stats['status_breakdown']['available']}")
            lines.append(f"- **需返录**: {stats['status_breakdown']['need_rerecord']}")
            lines.append(f"- **含隐私**: {stats['status_breakdown']['has_privacy']}")
            lines.append(f"- **待处理**: {stats['status_breakdown']['pending']}")
            lines.append("")
            lines.append(f"- **环境声**: {stats['track_types']['environment']}")
            lines.append(f"- **补录声**: {stats['track_types']['wild_track']}")
            lines.append("")
        
        # 校验结果
        if self.validation_result:
            lines.append("### 校验结果摘要")
            lines.append("")
            lines.append(f"- **总问题数**: {self.validation_result.total_issues}")
            lines.append(f"- **错误**: {self.validation_result.error_count}")
            lines.append(f"- **警告**: {self.validation_result.warning_count}")
            lines.append(f"- **提示**: {self.validation_result.info_count}")
            lines.append("")
        
        # 可用素材列表
        if self.state_store:
            lines.append("---")
            lines.append("")
            lines.append("## 素材详情")
            lines.append("")
            
            # 按状态分组
            for status in [MaterialStatus.AVAILABLE, MaterialStatus.NEED_RERECORD, 
                          MaterialStatus.HAS_PRIVACY, MaterialStatus.PENDING]:
                materials = self.state_store.get_all_materials(status_filter=status)
                if not materials:
                    continue
                
                status_name = {
                    MaterialStatus.AVAILABLE: "可用素材",
                    MaterialStatus.NEED_RERECORD: "需返录素材",
                    MaterialStatus.HAS_PRIVACY: "含隐私素材",
                    MaterialStatus.PENDING: "待处理素材"
                }.get(status, status.value)
                
                lines.append(f"### {status_name} ({len(materials)})")
                lines.append("")
                
                # 表格
                lines.append("| 文件名 | 状态 | 环境声 | 补录声 | 备注 |")
                lines.append("|---------|------|--------|--------|------|")
                
                for material in materials:
                    env_mark = "✓" if material.is_environment else ""
                    wild_mark = "✓" if material.is_wild_track else ""
                    notes = material.manual_notes[:50] + "..." if len(material.manual_notes) > 50 else material.manual_notes
                    
                    lines.append(f"| {material.file_name} | {material.status.value} | {env_mark} | {wild_mark} | {notes} |")
                
                lines.append("")
        
        # 问题详情（如果有校验结果）
        if self.validation_result and self.validation_result.all_issues:
            lines.append("---")
            lines.append("")
            lines.append("## 问题详情")
            lines.append("")
            
            # 按类别分组
            for category, issues in self.validation_result.issues_by_category.items():
                if not issues:
                    continue
                
                category_name = {
                    ValidationCategory.NAMING: "命名问题",
                    ValidationCategory.DURATION: "时长问题",
                    ValidationCategory.SAMPLE_RATE: "采样率问题",
                    ValidationCategory.TIMECODE: "时间码问题",
                    ValidationCategory.NOTES: "备注问题",
                    ValidationCategory.DUPLICATE: "重复文件",
                    ValidationCategory.MISSING: "缺失问题",
                    ValidationCategory.PRIVACY: "隐私相关",
                    ValidationCategory.TECHNICAL: "技术参数问题"
                }.get(category, category.value)
                
                lines.append(f"### {category_name} ({len(issues)})")
                lines.append("")
                
                for issue in issues:
                    severity_icon = {
                        ValidationSeverity.ERROR: "🔴",
                        ValidationSeverity.WARNING: "🟡",
                        ValidationSeverity.INFO: "🔵"
                    }.get(issue.severity, "")
                    
                    lines.append(f"{severity_icon} **{issue.message}**")
                    if issue.file_name:
                        lines.append(f"   - 文件: `{issue.file_name}`")
                    if issue.actual_value:
                        lines.append(f"   - 当前值: {issue.actual_value}")
                    if issue.suggestion:
                        lines.append(f"   - 建议: {issue.suggestion}")
                    lines.append("")
        
        # 页脚
        lines.append("---")
        lines.append("")
        lines.append("> 此文档由「野外录音交付整理箱」自动生成")
        lines.append(f"> 版本: 1.0.0")
        
        return "\n".join(lines)


class CSVExporter:
    """CSV问题清单导出器"""
    
    def __init__(self, validation_result: ValidationResult = None):
        """
        初始化CSV导出器
        
        Args:
            validation_result: 校验结果
        """
        self.validation_result = validation_result
    
    def export(self, output_path: str) -> bool:
        """
        导出CSV问题清单
        
        Args:
            output_path: 输出文件路径
            
        Returns:
            是否导出成功
        """
        try:
            if not self.validation_result:
                print("没有校验结果可导出")
                return False
            
            with open(output_path, 'w', newline='', encoding='utf-8-sig') as f:
                writer = csv.writer(f)
                
                # 写入表头
                headers = [
                    '问题ID', '严重程度', '类别', '消息', 
                    '文件名', '文件路径', '字段名',
                    '期望值', '实际值', '建议',
                    '时间戳'
                ]
                writer.writerow(headers)
                
                # 写入数据
                for issue in self.validation_result.all_issues:
                    row = [
                        issue.issue_id,
                        issue.severity.value,
                        issue.category.value,
                        issue.message,
                        issue.file_name,
                        issue.file_path,
                        issue.field_name,
                        issue.expected_value,
                        issue.actual_value,
                        issue.suggestion,
                        issue.timestamp
                    ]
                    writer.writerow(row)
            
            return True
        except Exception as e:
            print(f"导出CSV时出错: {e}")
            return False
    
    def export_materials_csv(self, state_store: StateStore, output_path: str) -> bool:
        """
        导出素材状态CSV
        
        Args:
            state_store: 状态存储器
            output_path: 输出文件路径
            
        Returns:
            是否导出成功
        """
        try:
            if not state_store:
                return False
            
            materials = state_store.get_all_materials()
            
            with open(output_path, 'w', newline='', encoding='utf-8-sig') as f:
                writer = csv.writer(f)
                
                # 写入表头
                headers = [
                    '文件名', '文件路径', '状态',
                    '环境声', '补录声', '标签', '备注',
                    '创建时间', '修改时间'
                ]
                writer.writerow(headers)
                
                # 写入数据
                for material in materials:
                    row = [
                        material.file_name,
                        material.file_path,
                        material.status.value,
                        '是' if material.is_environment else '否',
                        '是' if material.is_wild_track else '否',
                        ','.join(material.manual_tags),
                        material.manual_notes,
                        material.created_time,
                        material.modified_time
                    ]
                    writer.writerow(row)
            
            return True
        except Exception as e:
            print(f"导出素材CSV时出错: {e}")
            return False


class JSONExporter:
    """JSON证据包导出器"""
    
    def __init__(self, 
                 state_store: StateStore = None,
                 validation_result: ValidationResult = None,
                 scan_summary: Dict[str, Any] = None,
                 field_logs: List[Any] = None):
        """
        初始化JSON导出器
        
        Args:
            state_store: 状态存储器
            validation_result: 校验结果
            scan_summary: 扫描摘要
            field_logs: 场记数据
        """
        self.state_store = state_store
        self.validation_result = validation_result
        self.scan_summary = scan_summary
        self.field_logs = field_logs
    
    def export(self, output_path: str, include_full_metadata: bool = False) -> bool:
        """
        导出JSON证据包
        
        Args:
            output_path: 输出文件路径
            include_full_metadata: 是否包含完整元数据
            
        Returns:
            是否导出成功
        """
        try:
            evidence = self._build_evidence_package(include_full_metadata)
            
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(evidence, f, ensure_ascii=False, indent=2)
            
            return True
        except Exception as e:
            print(f"导出JSON时出错: {e}")
            return False
    
    def _build_evidence_package(self, include_full_metadata: bool) -> Dict[str, Any]:
        """
        构建证据包
        
        Args:
            include_full_metadata: 是否包含完整元数据
            
        Returns:
            证据包字典
        """
        evidence = {
            'package_info': {
                'version': '1.0.0',
                'generated_at': datetime.now().isoformat(),
                'tool_name': '野外录音交付整理箱'
            },
            'scan_summary': self.scan_summary or {},
            'validation_summary': self._get_validation_summary(),
            'materials': self._get_materials_data(include_full_metadata),
            'field_logs': self._get_field_logs_data(),
            'statistics': self._get_statistics()
        }
        
        return evidence
    
    def _get_validation_summary(self) -> Dict[str, Any]:
        """获取校验摘要"""
        if not self.validation_result:
            return {}
        
        # 转换类别枚举为字符串
        issues_by_category = {}
        for category, issues in self.validation_result.issues_by_category.items():
            issues_by_category[category.value] = [
                self._issue_to_dict(issue) for issue in issues
            ]
        
        issues_by_file = {}
        for file_name, issues in self.validation_result.issues_by_file.items():
            issues_by_file[file_name] = [
                self._issue_to_dict(issue) for issue in issues
            ]
        
        return {
            'total_files': self.validation_result.total_files,
            'total_issues': self.validation_result.total_issues,
            'error_count': self.validation_result.error_count,
            'warning_count': self.validation_result.warning_count,
            'info_count': self.validation_result.info_count,
            'issues_by_category': issues_by_category,
            'issues_by_file': issues_by_file,
            'all_issues': [self._issue_to_dict(issue) for issue in self.validation_result.all_issues]
        }
    
    def _issue_to_dict(self, issue: ValidationIssue) -> Dict[str, Any]:
        """转换问题对象为字典"""
        return {
            'issue_id': issue.issue_id,
            'category': issue.category.value,
            'severity': issue.severity.value,
            'message': issue.message,
            'file_name': issue.file_name,
            'file_path': issue.file_path,
            'field_name': issue.field_name,
            'expected_value': issue.expected_value,
            'actual_value': issue.actual_value,
            'suggestion': issue.suggestion,
            'metadata': issue.metadata,
            'timestamp': issue.timestamp
        }
    
    def _get_materials_data(self, include_full_metadata: bool) -> List[Dict[str, Any]]:
        """获取素材数据"""
        if not self.state_store:
            return []
        
        materials = []
        for material in self.state_store.get_all_materials():
            material_dict = {
                'file_path': material.file_path,
                'file_name': material.file_name,
                'file_hash': material.file_hash,
                'status': material.status.value,
                'manual_tags': material.manual_tags,
                'manual_notes': material.manual_notes,
                'is_environment': material.is_environment,
                'is_wild_track': material.is_wild_track,
                'linked_scene': material.linked_scene,
                'linked_shot': material.linked_shot,
                'linked_take': material.linked_take,
                'created_time': material.created_time,
                'modified_time': material.modified_time
            }
            
            if include_full_metadata:
                material_dict['metadata'] = material.metadata
            
            materials.append(material_dict)
        
        return materials
    
    def _get_field_logs_data(self) -> List[Dict[str, Any]]:
        """获取场记数据"""
        if not self.field_logs:
            return []
        
        logs_data = []
        for log in self.field_logs:
            # 尝试转换场记对象为字典
            if hasattr(log, '__dict__'):
                log_dict = {}
                for key, value in log.__dict__.items():
                    if key == 'entries':
                        # 转换条目列表
                        entries_data = []
                        for entry in value:
                            if hasattr(entry, '__dict__'):
                                entry_dict = {k: v for k, v in entry.__dict__.items() 
                                             if k != 'raw_data'}
                                entries_data.append(entry_dict)
                            else:
                                entries_data.append(str(entry))
                        log_dict['entries'] = entries_data
                    else:
                        log_dict[key] = value
                logs_data.append(log_dict)
            else:
                logs_data.append(str(log))
        
        return logs_data
    
    def _get_statistics(self) -> Dict[str, Any]:
        """获取统计信息"""
        stats = {
            'generated_at': datetime.now().isoformat()
        }
        
        if self.state_store:
            store_stats = self.state_store.get_statistics()
            stats['materials'] = store_stats
        
        if self.validation_result:
            stats['validation'] = {
                'total_issues': self.validation_result.total_issues,
                'errors': self.validation_result.error_count,
                'warnings': self.validation_result.warning_count,
                'infos': self.validation_result.info_count
            }
        
        return stats


def export_markdown_delivery(
    output_path: str,
    state_store: StateStore = None,
    validation_result: ValidationResult = None,
    project_info: Dict[str, Any] = None
) -> bool:
    """
    便捷函数：导出Markdown交付单
    
    Args:
        output_path: 输出路径
        state_store: 状态存储器
        validation_result: 校验结果
        project_info: 项目信息
        
    Returns:
        是否成功
    """
    exporter = MarkdownExporter(state_store, validation_result, project_info)
    return exporter.export(output_path)


def export_csv_issues(
    output_path: str,
    validation_result: ValidationResult
) -> bool:
    """
    便捷函数：导出CSV问题清单
    
    Args:
        output_path: 输出路径
        validation_result: 校验结果
        
    Returns:
        是否成功
    """
    exporter = CSVExporter(validation_result)
    return exporter.export(output_path)


def export_json_evidence(
    output_path: str,
    state_store: StateStore = None,
    validation_result: ValidationResult = None,
    scan_summary: Dict[str, Any] = None,
    field_logs: List[Any] = None,
    include_full_metadata: bool = False
) -> bool:
    """
    便捷函数：导出JSON证据包
    
    Args:
        output_path: 输出路径
        state_store: 状态存储器
        validation_result: 校验结果
        scan_summary: 扫描摘要
        field_logs: 场记数据
        include_full_metadata: 是否包含完整元数据
        
    Returns:
        是否成功
    """
    exporter = JSONExporter(state_store, validation_result, scan_summary, field_logs)
    return exporter.export(output_path, include_full_metadata)
