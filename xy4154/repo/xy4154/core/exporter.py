"""
导入导出模块
支持导出 Markdown 交接单、CSV 异常表和 JSON 审计包
"""

import csv
import json
import os
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
from collections import defaultdict

from .models import (
    Exhibit, ScanRecord, PhotoRecord, Anomaly, ReviewComment, ProjectData
)


class MarkdownExporter:
    """Markdown交接单导出器"""
    
    @staticmethod
    def export(project_data: ProjectData, output_path: str, 
               include_photos: bool = True) -> str:
        """
        导出Markdown格式的交接单
        
        Args:
            project_data: 项目数据
            output_path: 输出文件路径
            include_photos: 是否包含照片信息
            
        Returns:
            str: 生成的Markdown内容
        """
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        # 按箱号分组扫描记录
        box_scans: Dict[str, List[ScanRecord]] = defaultdict(list)
        for scan in project_data.scan_records:
            box_scans[scan.box_number].append(scan)
        
        # 统计信息
        total_exhibits = len(project_data.exhibits)
        scanned_exhibits = len(set(s.exhibit_id for s in project_data.scan_records))
        total_boxes = len(box_scans)
        total_anomalies = len(project_data.anomalies)
        unresolved_anomalies = len(project_data.get_unresolved_anomalies())
        
        # 构建Markdown内容
        md_content = []
        
        # 标题
        md_content.append(f"# 撤展装箱交接单")
        md_content.append(f"")
        md_content.append(f"**项目名称**: {project_data.project_name}")
        md_content.append(f"**导出时间**: {now}")
        md_content.append(f"")
        
        # 统计概览
        md_content.append(f"## 一、统计概览")
        md_content.append(f"")
        md_content.append(f"| 指标 | 数值 |")
        md_content.append(f"|------|------|")
        md_content.append(f"| 展品总数 | {total_exhibits} |")
        md_content.append(f"| 已扫描展品 | {scanned_exhibits} |")
        md_content.append(f"| 使用箱子数 | {total_boxes} |")
        md_content.append(f"| 检测异常数 | {total_anomalies} |")
        md_content.append(f"| 未解决异常 | {unresolved_anomalies} |")
        md_content.append(f"")
        
        # 装箱清单（按箱号）
        md_content.append(f"## 二、装箱清单")
        md_content.append(f"")
        
        for box_number in sorted(box_scans.keys()):
            scans = box_scans[box_number]
            md_content.append(f"### 箱号: {box_number}")
            md_content.append(f"")
            md_content.append(f"| 展品编号 | 展品名称 | 扫描时间 | 操作人 | 签名确认 | 缓冲确认 |")
            md_content.append(f"|----------|----------|----------|--------|----------|----------|")
            
            for scan in sorted(scans, key=lambda s: s.scan_time):
                exhibit = project_data.get_exhibit_by_id(scan.exhibit_id)
                exhibit_name = exhibit.name if exhibit else "未知"
                scan_time_str = scan.scan_time.strftime('%Y-%m-%d %H:%M:%S')
                signature = "✓" if scan.has_signature else "✗"
                buffer = "✓" if scan.buffer_verified else "✗"
                
                md_content.append(f"| {scan.exhibit_id} | {exhibit_name} | {scan_time_str} | {scan.operator} | {signature} | {buffer} |")
            
            md_content.append(f"")
        
        # 漏扫展品列表
        missing_scans = [e for e in project_data.exhibits 
                         if e.exhibit_id not in set(s.exhibit_id for s in project_data.scan_records)]
        if missing_scans:
            md_content.append(f"## 三、漏扫展品清单")
            md_content.append(f"")
            md_content.append(f"| 展品编号 | 展品名称 | 类别 | 是否易碎 | 备注 |")
            md_content.append(f"|----------|----------|------|----------|------|")
            
            for exhibit in missing_scans:
                fragile = "是" if exhibit.is_fragile else "否"
                md_content.append(f"| {exhibit.exhibit_id} | {exhibit.name} | {exhibit.category or '-'} | {fragile} | {exhibit.notes or '-'} |")
            
            md_content.append(f"")
        
        # 异常列表
        if project_data.anomalies:
            md_content.append(f"## 四、异常清单")
            md_content.append(f"")
            
            # 按严重程度分组
            severity_order = ['critical', 'high', 'medium', 'low']
            severity_names = {
                'critical': '严重',
                'high': '高',
                'medium': '中',
                'low': '低'
            }
            
            for severity in severity_order:
                anomalies = [a for a in project_data.anomalies if a.severity == severity]
                if not anomalies:
                    continue
                
                md_content.append(f"### {severity_names[severity]}级异常")
                md_content.append(f"")
                md_content.append(f"| 异常类型 | 关联展品 | 关联箱号 | 状态 | 描述 |")
                md_content.append(f"|----------|----------|----------|------|------|")
                
                for anomaly in anomalies:
                    status = "已解决" if anomaly.is_resolved else "未解决"
                    md_content.append(f"| {anomaly.anomaly_type} | {anomaly.exhibit_id or '-'} | {anomaly.box_number or '-'} | {status} | {anomaly.description[:50]}... |")
                
                md_content.append(f"")
        
        # 复核意见
        if project_data.review_comments:
            md_content.append(f"## 五、复核意见")
            md_content.append(f"")
            
            # 按异常分组
            comment_by_anomaly: Dict[str, List[ReviewComment]] = defaultdict(list)
            for comment in project_data.review_comments:
                comment_by_anomaly[comment.anomaly_id].append(comment)
            
            for anomaly_id, comments in comment_by_anomaly.items():
                # 找到对应的异常
                anomaly = next((a for a in project_data.anomalies if a.anomaly_id == anomaly_id), None)
                if anomaly:
                    md_content.append(f"### 异常: {anomaly.anomaly_type}")
                    md_content.append(f"")
                    md_content.append(f"> {anomaly.description}")
                    md_content.append(f"")
                
                for comment in sorted(comments, key=lambda c: c.review_time):
                    time_str = comment.review_time.strftime('%Y-%m-%d %H:%M:%S')
                    approved = "通过" if comment.is_approved else "未通过"
                    follow_up = "需要跟进" if comment.follow_up_required else "无需跟进"
                    
                    md_content.append(f"**{comment.reviewer}** ({time_str}) - {approved} / {follow_up}")
                    md_content.append(f"")
                    md_content.append(f"> {comment.comment}")
                    md_content.append(f"")
        
        # 照片清单
        if include_photos and project_data.photo_records:
            md_content.append(f"## 六、照片证据清单")
            md_content.append(f"")
            md_content.append(f"| 文件名 | 文件大小 | 拍摄时间 | 关联展品 | 关联箱号 |")
            md_content.append(f"|----------|----------|----------|----------|----------|")
            
            for photo in project_data.photo_records:
                size_str = MarkdownExporter._format_file_size(photo.file_size)
                time_str = photo.capture_time.strftime('%Y-%m-%d %H:%M:%S') if photo.capture_time else "-"
                exhibits = ', '.join(photo.exhibit_references) or "-"
                boxes = ', '.join(photo.box_references) or "-"
                
                md_content.append(f"| {photo.file_name} | {size_str} | {time_str} | {exhibits} | {boxes} |")
            
            md_content.append(f"")
        
        # 页脚
        md_content.append(f"---")
        md_content.append(f"")
        md_content.append(f"*此交接单由撤展装箱核验台系统自动生成*")
        
        # 写入文件
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write('\n'.join(md_content))
        
        return '\n'.join(md_content)
    
    @staticmethod
    def _format_file_size(size_bytes: int) -> str:
        """格式化文件大小"""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size_bytes < 1024:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024
        return f"{size_bytes:.1f} TB"


class CSVExporter:
    """CSV异常表导出器"""
    
    @staticmethod
    def export_anomalies(project_data: ProjectData, output_path: str,
                          include_resolved: bool = False) -> int:
        """
        导出异常记录为CSV
        
        Args:
            project_data: 项目数据
            output_path: 输出文件路径
            include_resolved: 是否包含已解决的异常
            
        Returns:
            int: 导出的记录数
        """
        # 过滤异常
        anomalies = project_data.anomalies
        if not include_resolved:
            anomalies = [a for a in anomalies if not a.is_resolved]
        
        if not anomalies:
            return 0
        
        # 准备输出路径
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        # 定义表头
        fieldnames = [
            '异常ID', '异常类型', '严重程度', '展品编号', '箱号',
            '扫描记录ID', '照片ID', '描述', '处理建议',
            '检测时间', '状态', '解决人', '解决时间', '解决备注'
        ]
        
        severity_names = {
            'critical': '严重',
            'high': '高',
            'medium': '中',
            'low': '低'
        }
        
        with open(output_file, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for anomaly in anomalies:
                row = {
                    '异常ID': anomaly.anomaly_id[:8],
                    '异常类型': anomaly.anomaly_type,
                    '严重程度': severity_names.get(anomaly.severity, anomaly.severity),
                    '展品编号': anomaly.exhibit_id or '',
                    '箱号': anomaly.box_number or '',
                    '扫描记录ID': anomaly.scan_id or '',
                    '照片ID': anomaly.photo_id or '',
                    '描述': anomaly.description.replace('\n', ' '),
                    '处理建议': anomaly.suggestion,
                    '检测时间': anomaly.detected_time.strftime('%Y-%m-%d %H:%M:%S'),
                    '状态': '已解决' if anomaly.is_resolved else '未解决',
                    '解决人': anomaly.resolved_by or '',
                    '解决时间': anomaly.resolved_time.strftime('%Y-%m-%d %H:%M:%S') if anomaly.resolved_time else '',
                    '解决备注': anomaly.resolution_notes
                }
                writer.writerow(row)
        
        return len(anomalies)
    
    @staticmethod
    def export_box_manifest(project_data: ProjectData, output_path: str) -> int:
        """
        导出装箱清单为CSV
        
        Args:
            project_data: 项目数据
            output_path: 输出文件路径
            
        Returns:
            int: 导出的记录数
        """
        # 按箱号分组
        box_scans: Dict[str, List[ScanRecord]] = defaultdict(list)
        for scan in project_data.scan_records:
            box_scans[scan.box_number].append(scan)
        
        if not box_scans:
            return 0
        
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        fieldnames = [
            '箱号', '展品编号', '展品名称', '扫描时间', '操作人',
            '温度', '湿度', '签名确认', '缓冲确认', '备注'
        ]
        
        total_records = 0
        with open(output_file, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for box_number in sorted(box_scans.keys()):
                scans = sorted(box_scans[box_number], key=lambda s: s.scan_time)
                
                for scan in scans:
                    exhibit = project_data.get_exhibit_by_id(scan.exhibit_id)
                    exhibit_name = exhibit.name if exhibit else "未知"
                    
                    row = {
                        '箱号': box_number,
                        '展品编号': scan.exhibit_id,
                        '展品名称': exhibit_name,
                        '扫描时间': scan.scan_time.strftime('%Y-%m-%d %H:%M:%S'),
                        '操作人': scan.operator,
                        '温度': f"{scan.temperature}°C" if scan.temperature else '',
                        '湿度': f"{scan.humidity}%" if scan.humidity else '',
                        '签名确认': '是' if scan.has_signature else '否',
                        '缓冲确认': '是' if scan.buffer_verified else '否',
                        '备注': scan.notes
                    }
                    writer.writerow(row)
                    total_records += 1
        
        return total_records


class JSONExporter:
    """JSON审计包导出器"""
    
    @staticmethod
    def export_audit_package(project_data: ProjectData, output_path: str,
                              include_raw_data: bool = True) -> Dict[str, Any]:
        """
        导出完整的审计包为JSON
        
        Args:
            project_data: 项目数据
            output_path: 输出文件路径
            include_raw_data: 是否包含原始数据（展品、扫描记录等）
            
        Returns:
            Dict[str, Any]: 导出的JSON数据
        """
        now = datetime.now()
        
        # 构建审计包数据
        audit_package = {
            'metadata': {
                'project_name': project_data.project_name,
                'export_time': now.isoformat(),
                'export_version': '1.0.0',
                'system': '撤展装箱核验台'
            },
            'summary': {
                'total_exhibits': len(project_data.exhibits),
                'scanned_exhibits': len(set(s.exhibit_id for s in project_data.scan_records)),
                'total_scans': len(project_data.scan_records),
                'total_photos': len(project_data.photo_records),
                'total_anomalies': len(project_data.anomalies),
                'unresolved_anomalies': len(project_data.get_unresolved_anomalies()),
                'total_comments': len(project_data.review_comments)
            },
            'anomalies': [a.to_dict() for a in project_data.anomalies],
            'review_comments': [c.to_dict() for c in project_data.review_comments]
        }
        
        if include_raw_data:
            audit_package['raw_data'] = {
                'exhibits': [e.to_dict() for e in project_data.exhibits],
                'scan_records': [s.to_dict() for s in project_data.scan_records],
                'photo_records': [p.to_dict() for p in project_data.photo_records]
            }
        
        # 写入文件
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(audit_package, f, ensure_ascii=False, indent=2)
        
        return audit_package


class DataExporter:
    """统一导出器 - 封装所有导出功能"""
    
    def __init__(self, project_data: ProjectData):
        self.project_data = project_data
    
    def export_markdown(self, output_path: str, include_photos: bool = True) -> str:
        """导出Markdown交接单"""
        return MarkdownExporter.export(self.project_data, output_path, include_photos)
    
    def export_anomalies_csv(self, output_path: str, include_resolved: bool = False) -> int:
        """导出异常表CSV"""
        return CSVExporter.export_anomalies(self.project_data, output_path, include_resolved)
    
    def export_box_manifest_csv(self, output_path: str) -> int:
        """导出装箱清单CSV"""
        return CSVExporter.export_box_manifest(self.project_data, output_path)
    
    def export_audit_json(self, output_path: str, include_raw_data: bool = True) -> Dict[str, Any]:
        """导出JSON审计包"""
        return JSONExporter.export_audit_package(self.project_data, output_path, include_raw_data)
    
    def export_all(self, output_dir: str, base_name: Optional[str] = None) -> Dict[str, str]:
        """
        导出所有格式的文件
        
        Args:
            output_dir: 输出目录
            base_name: 基础文件名（不含扩展名），默认使用项目名称
            
        Returns:
            Dict[str, str]: 各格式的输出路径
        """
        if base_name is None:
            # 使用项目名称作为基础名，移除非法字符
            base_name = re.sub(r'[\\/:*?"<>|]', '_', self.project_data.project_name)
        
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        paths = {}
        
        # Markdown交接单
        md_path = str(output_path / f"{base_name}_交接单.md")
        self.export_markdown(md_path)
        paths['markdown'] = md_path
        
        # 异常表CSV
        anomalies_path = str(output_path / f"{base_name}_异常表.csv")
        self.export_anomalies_csv(anomalies_path, include_resolved=True)
        paths['anomalies_csv'] = anomalies_path
        
        # 装箱清单CSV
        manifest_path = str(output_path / f"{base_name}_装箱清单.csv")
        self.export_box_manifest_csv(manifest_path)
        paths['manifest_csv'] = manifest_path
        
        # JSON审计包
        json_path = str(output_path / f"{base_name}_审计包.json")
        self.export_audit_json(json_path)
        paths['audit_json'] = json_path
        
        return paths
