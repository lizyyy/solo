"""
输出模块
负责生成问题CSV和Markdown复盘报告
"""
import csv
import json
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from .config import Issue, PhotoMetadata, ISSUE_TYPES, ISSUE_SEVERITY


class OutputGenerator:
    """输出生成器"""
    
    def __init__(self, output_dir: str):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def export_issues_csv(self, issues: List[Issue], 
                          filename: str = "issues.csv") -> Path:
        """导出问题到CSV文件"""
        csv_path = self.output_dir / filename
        
        with open(csv_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            
            # 写入表头
            writer.writerow([
                '问题类型',
                '严重程度',
                '门店编码',
                '点位',
                '问题描述',
                '原始文件名',
                '原始路径',
                '详细信息',
                '检测时间'
            ])
            
            # 写入数据
            for issue in issues:
                issue_type_desc = ISSUE_TYPES.get(issue.issue_type, issue.issue_type)
                severity_desc = ISSUE_SEVERITY.get(issue.severity, issue.severity)
                
                filename = issue.photo_metadata.filename if issue.photo_metadata else ''
                original_path = issue.photo_metadata.original_path if issue.photo_metadata else ''
                
                # 将details转换为可读字符串
                details_str = json.dumps(issue.details, ensure_ascii=False) if issue.details else ''
                
                writer.writerow([
                    issue_type_desc,
                    severity_desc,
                    issue.store_code or '',
                    issue.checkpoint or '',
                    issue.message,
                    filename,
                    original_path,
                    details_str,
                    datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                ])
        
        return csv_path
    
    def generate_markdown_report(self, 
                                 issues: List[Issue],
                                 photos: List[PhotoMetadata],
                                 statistics: Dict,
                                 issue_statistics: Dict,
                                 batch_id: str = None,
                                 filename: str = "report.md") -> Path:
        """生成Markdown复盘报告"""
        md_path = self.output_dir / filename
        
        # 按问题类型分组
        issues_by_type = defaultdict(list)
        for issue in issues:
            issues_by_type[issue.issue_type].append(issue)
        
        # 按门店分组
        issues_by_store = defaultdict(list)
        for issue in issues:
            store = issue.store_code or 'UNKNOWN'
            issues_by_store[store].append(issue)
        
        # 按严重程度分组
        issues_by_severity = defaultdict(list)
        for issue in issues:
            issues_by_severity[issue.severity].append(issue)
        
        # 生成报告内容
        lines = []
        
        # 标题
        lines.append('# 巡检照片整理复盘报告')
        lines.append('')
        lines.append(f'**生成时间**: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
        if batch_id:
            lines.append(f'**批次ID**: {batch_id}')
        lines.append('')
        
        # 概览
        lines.append('## 一、处理概览')
        lines.append('')
        
        # 照片统计
        lines.append('### 1.1 照片统计')
        lines.append('')
        lines.append(f'- 总处理照片数: {len(photos)}')
        lines.append(f'- 归档照片数: {statistics.get("total_photos", 0)}')
        
        if statistics.get("by_store"):
            lines.append('')
            lines.append('**按门店分布**:')
            lines.append('')
            lines.append('| 门店编码 | 照片数量 |')
            lines.append('|---------|---------|')
            for store, count in sorted(statistics.get("by_store", {}).items()):
                lines.append(f'| {store} | {count} |')
        
        lines.append('')
        
        # 问题统计
        lines.append('### 1.2 问题统计')
        lines.append('')
        lines.append(f'- 总问题数: {len(issues)}')
        
        if issues_by_severity:
            lines.append('')
            lines.append('**按严重程度分布**:')
            lines.append('')
            for severity in ['critical', 'warning', 'info']:
                if severity in issues_by_severity:
                    count = len(issues_by_severity[severity])
                    desc = ISSUE_SEVERITY.get(severity, severity)
                    lines.append(f'- **{desc}**: {count} 个')
        
        if issues_by_type:
            lines.append('')
            lines.append('**按问题类型分布**:')
            lines.append('')
            lines.append('| 问题类型 | 数量 | 说明 |')
            lines.append('|---------|------|------|')
            for issue_type, issue_list in sorted(issues_by_type.items()):
                desc = ISSUE_TYPES.get(issue_type, issue_type)
                lines.append(f'| {issue_type} | {len(issue_list)} | {desc} |')
        
        lines.append('')
        
        # 详细问题
        lines.append('## 二、详细问题分析')
        lines.append('')
        
        # 严重问题
        if 'critical' in issues_by_severity:
            lines.append('### 2.1 严重问题')
            lines.append('')
            for issue in issues_by_severity['critical']:
                lines.append(f'#### {issue.message}')
                lines.append('')
                lines.append(f'- **门店**: {issue.store_code or "未知"}')
                lines.append(f'- **点位**: {issue.checkpoint or "未知"}')
                if issue.photo_metadata:
                    lines.append(f'- **文件名**: {issue.photo_metadata.filename}')
                if issue.details:
                    lines.append(f'- **详情**: {json.dumps(issue.details, ensure_ascii=False)}')
                lines.append('')
        
        # 警告问题
        if 'warning' in issues_by_severity:
            lines.append('### 2.2 警告问题')
            lines.append('')
            for issue in issues_by_severity['warning']:
                lines.append(f'#### {issue.message}')
                lines.append('')
                lines.append(f'- **门店**: {issue.store_code or "未知"}')
                lines.append(f'- **点位**: {issue.checkpoint or "未知"}')
                if issue.photo_metadata:
                    lines.append(f'- **文件名**: {issue.photo_metadata.filename}')
                if issue.details:
                    lines.append(f'- **详情**: {json.dumps(issue.details, ensure_ascii=False)}')
                lines.append('')
        
        # 信息问题
        if 'info' in issues_by_severity:
            lines.append('### 2.3 信息提示')
            lines.append('')
            for issue in issues_by_severity['info']:
                lines.append(f'- {issue.message}')
            lines.append('')
        
        # 按门店汇总
        lines.append('## 三、按门店汇总')
        lines.append('')
        
        for store, store_issues in sorted(issues_by_store.items()):
            if store == 'UNKNOWN':
                store_display = '未知门店'
            else:
                store_display = store
            
            lines.append(f'### 3.1 门店: {store_display}')
            lines.append('')
            lines.append(f'- 问题总数: {len(store_issues)}')
            
            # 按类型统计
            type_count = defaultdict(int)
            for issue in store_issues:
                type_count[issue.issue_type] += 1
            
            if type_count:
                lines.append('')
                lines.append('**问题类型分布**:')
                for issue_type, count in type_count.items():
                    desc = ISSUE_TYPES.get(issue_type, issue_type)
                    lines.append(f'- {desc}: {count} 个')
            
            lines.append('')
        
        # 建议和行动项
        lines.append('## 四、建议与行动项')
        lines.append('')
        
        # 基于问题类型生成建议
        if 'missing_photo' in issues_by_type:
            lines.append('### 4.1 缺拍问题')
            lines.append('')
            lines.append('以下点位缺少照片，请安排补拍:')
            lines.append('')
            for issue in issues_by_type['missing_photo']:
                lines.append(f'- [ ] 门店 {issue.store_code} - 点位 {issue.checkpoint}')
            lines.append('')
        
        if 'time_deviation' in issues_by_type:
            lines.append('### 4.2 时间偏差问题')
            lines.append('')
            lines.append('以下照片拍摄时间不在规定巡检窗口内:')
            lines.append('')
            for issue in issues_by_type['time_deviation']:
                deviation = issue.details.get('deviation_minutes', 0) if issue.details else 0
                if deviation < 0:
                    time_desc = f'早了 {-deviation} 分钟'
                else:
                    time_desc = f'晚了 {deviation} 分钟'
                if issue.photo_metadata:
                    lines.append(f'- 门店 {issue.store_code or "未知"}: {issue.photo_metadata.filename} ({time_desc})')
                else:
                    lines.append(f'- 门店 {issue.store_code or "未知"}: {time_desc}')
            lines.append('')
            lines.append('**建议**: 提醒巡检人员在规定时间窗口内完成巡检。')
            lines.append('')
        
        if 'duplicate_photo' in issues_by_type:
            lines.append('### 4.3 重复照片问题')
            lines.append('')
            lines.append('以下照片为重复照片，已跳过归档:')
            lines.append('')
            for issue in issues_by_type['duplicate_photo']:
                if issue.photo_metadata:
                    lines.append(f'- {issue.photo_metadata.filename}')
            lines.append('')
        
        if 'no_exif' in issues_by_type:
            lines.append('### 4.4 EXIF缺失问题')
            lines.append('')
            lines.append('以下照片缺少EXIF时间信息:')
            lines.append('')
            for issue in issues_by_type['no_exif']:
                if issue.photo_metadata:
                    lines.append(f'- {issue.photo_metadata.filename}')
            lines.append('')
            lines.append('**建议**: 检查拍摄设备的时间设置，确保照片包含正确的EXIF信息。')
            lines.append('')
        
        # 总结
        lines.append('## 五、总结')
        lines.append('')
        
        critical_count = len(issues_by_severity.get('critical', []))
        warning_count = len(issues_by_severity.get('warning', []))
        info_count = len(issues_by_severity.get('info', []))
        
        if critical_count > 0:
            lines.append(f'**⚠️ 需要立即处理**: 存在 {critical_count} 个严重问题（主要是缺拍）。')
        else:
            lines.append('✅ 无严重问题。')
        
        if warning_count > 0:
            lines.append(f'**⚠️ 需要关注**: 存在 {warning_count} 个警告问题。')
        
        lines.append('')
        lines.append('---')
        lines.append('')
        lines.append('*报告由巡检照片整理工具自动生成*')
        
        # 写入文件
        with open(md_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
        
        return md_path
    
    def export_photos_csv(self, photos: List[PhotoMetadata],
                          filename: str = "photos_index.csv") -> Path:
        """导出照片索引到CSV"""
        csv_path = self.output_dir / filename
        
        with open(csv_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            
            # 写入表头
            writer.writerow([
                '原始文件名',
                '原始路径',
                '文件大小(字节)',
                '门店编码',
                '点位',
                '拍摄时间',
                'EXIF时间',
                '文件名时间',
                '文件哈希',
                '是否重复',
                '重复来源'
            ])
            
            # 写入数据
            for photo in photos:
                writer.writerow([
                    photo.filename,
                    photo.original_path,
                    photo.size,
                    photo.determined_store_code or '',
                    photo.determined_checkpoint or '',
                    photo.determined_time or '',
                    photo.exif_time or '',
                    photo.filename_time or '',
                    photo.file_hash or '',
                    '是' if photo.is_duplicate else '否',
                    photo.duplicate_of or ''
                ])
        
        return csv_path
