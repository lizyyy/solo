import csv
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any


class ReportGenerator:
    """报告生成器 - 生成 Markdown 交接报告和 CSV 问题清单"""
    
    def __init__(self, 
                 scan_results: Dict[str, Any],
                 validation_results: Dict[str, Any],
                 archive_plan: Optional[Dict[str, Any]] = None,
                 archive_results: Optional[Dict[str, Any]] = None):
        self.scan_results = scan_results
        self.validation_results = validation_results
        self.archive_plan = archive_plan
        self.archive_results = archive_results
    
    def generate_markdown_report(self, output_path: str) -> str:
        """生成 Markdown 交接报告"""
        report_lines = []
        
        report_lines.append("# 岩芯箱照片归档交接报告")
        report_lines.append("")
        report_lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append("")
        report_lines.append("---")
        report_lines.append("")
        
        report_lines.extend(self._generate_scan_summary_section())
        report_lines.append("")
        
        report_lines.extend(self._generate_validation_section())
        report_lines.append("")
        
        report_lines.extend(self._generate_archive_section())
        report_lines.append("")
        
        report_lines.extend(self._generate_photo_details_section())
        report_lines.append("")
        
        report_lines.extend(self._generate_issues_section())
        report_lines.append("")
        
        report_lines.extend(self._generate_notes_section())
        report_lines.append("")
        
        report_content = '\n'.join(report_lines)
        
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(report_content)
        
        return report_content
    
    def _generate_scan_summary_section(self) -> List[str]:
        """生成扫描摘要部分"""
        lines = []
        
        lines.append("## 1. 扫描摘要")
        lines.append("")
        
        scan_summary = self.scan_results.get('scan_summary', {}) if isinstance(self.scan_results, dict) else {}
        
        lines.append("| 项目 | 数量 |")
        lines.append("|------|------|")
        lines.append(f"| 总文件数 | {scan_summary.get('total_files', 0)} |")
        lines.append(f"| 照片文件 | {scan_summary.get('photo_count', 0)} |")
        lines.append(f"| CSV记录文件 | {scan_summary.get('csv_count', 0)} |")
        lines.append(f"| GPX轨迹文件 | {scan_summary.get('gpx_count', 0)} |")
        lines.append(f"| 文本备注文件 | {scan_summary.get('text_count', 0)} |")
        lines.append(f"| 其他文件 | {scan_summary.get('other_count', 0)} |")
        lines.append("")
        
        if scan_summary.get('source_directory'):
            lines.append(f"**源目录**: {scan_summary.get('source_directory')}")
            lines.append("")
        
        return lines
    
    def _generate_validation_section(self) -> List[str]:
        """生成校验结果部分"""
        lines = []
        
        lines.append("## 2. 数据校验结果")
        lines.append("")
        
        issue_summary = self.validation_results.get('issue_summary', {})
        total_issues = issue_summary.get('total', 0)
        
        if total_issues == 0:
            lines.append("✅ **所有数据校验通过，未发现问题**")
            lines.append("")
            return lines
        
        by_severity = issue_summary.get('by_severity', {})
        error_count = by_severity.get('error', 0)
        warning_count = by_severity.get('warning', 0)
        info_count = by_severity.get('info', 0)
        
        lines.append("### 2.1 问题统计")
        lines.append("")
        lines.append("| 严重程度 | 数量 |")
        lines.append("|----------|------|")
        lines.append(f"| 🔴 错误 | {error_count} |")
        lines.append(f"| 🟡 警告 | {warning_count} |")
        lines.append(f"| ℹ️ 提示 | {info_count} |")
        lines.append("")
        
        lines.append("### 2.2 问题类型分布")
        lines.append("")
        
        by_type = issue_summary.get('by_type', {})
        if by_type:
            for issue_type, count in by_type.items():
                lines.append(f"- **{self._translate_issue_type(issue_type)}**: {count} 个")
            lines.append("")
        
        lines.append(f"详细问题清单请查看 `issues.csv` 文件。")
        lines.append("")
        
        return lines
    
    def _translate_issue_type(self, issue_type: str) -> str:
        """翻译问题类型为中文"""
        translations = {
            'time_out_of_range': '时间超出范围',
            'location_mismatch': '位置不匹配',
            'depth_mismatch': '深度不匹配',
            'box_number_mismatch': '箱号不匹配',
            'hole_number_mismatch': '孔号不匹配',
            'note_id_mismatch': '备注编号不匹配',
            'missing_csv_record': '缺少CSV记录',
            'missing_note': '缺少备注',
            'duplicate_photo': '重复照片',
            'invalid_filename': '无效文件名',
        }
        return translations.get(issue_type, issue_type)
    
    def _generate_archive_section(self) -> List[str]:
        """生成归档部分"""
        lines = []
        
        lines.append("## 3. 归档计划")
        lines.append("")
        
        if not self.archive_plan:
            lines.append("⚠️ 尚未生成归档计划")
            lines.append("")
            return lines
        
        summary = self.archive_plan.get('summary', {})
        plan_id = self.archive_plan.get('plan_id', 'N/A')
        status = self.archive_plan.get('status', 'N/A')
        target_dir = self.archive_plan.get('target_directory', 'N/A')
        
        lines.append(f"**计划ID**: {plan_id}")
        lines.append("")
        lines.append(f"**状态**: {status}")
        lines.append("")
        lines.append(f"**目标目录**: {target_dir}")
        lines.append("")
        
        by_type = summary.get('by_type', {})
        by_hole = summary.get('by_hole', {})
        
        lines.append("### 3.1 归档项目统计")
        lines.append("")
        lines.append("| 类型 | 数量 |")
        lines.append("|------|------|")
        
        type_names = {
            'photo': '照片',
            'csv': 'CSV记录',
            'note': '备注',
            'gpx': 'GPX轨迹'
        }
        
        for item_type, count in by_type.items():
            display_name = type_names.get(item_type, item_type)
            lines.append(f"| {display_name} | {count} |")
        lines.append("")
        
        lines.append("### 3.2 按孔号分布")
        lines.append("")
        lines.append("| 孔号 | 项目数 |")
        lines.append("|------|--------|")
        
        for hole, count in by_hole.items():
            lines.append(f"| {hole} | {count} |")
        lines.append("")
        
        if self.archive_results:
            lines.append("### 3.3 归档执行结果")
            lines.append("")
            
            success = self.archive_results.get('success_count', 0)
            failed = self.archive_results.get('failed_count', 0)
            total = self.archive_results.get('total_count', 0)
            
            lines.append(f"**执行状态**: {self.archive_results.get('status', 'N/A')}")
            lines.append("")
            lines.append(f"- 成功: {success} 个")
            lines.append(f"- 失败: {failed} 个")
            lines.append(f"- 总计: {total} 个")
            lines.append("")
            
            if failed > 0:
                lines.append("⚠️ 部分项目归档失败，请查看详细日志。")
                lines.append("")
        
        return lines
    
    def _generate_photo_details_section(self) -> List[str]:
        """生成照片详情部分"""
        lines = []
        
        lines.append("## 4. 照片详情")
        lines.append("")
        
        validated_photos = self.validation_results.get('validated_photos', [])
        
        if not validated_photos:
            lines.append("无已校验的照片。")
            lines.append("")
            return lines
        
        hole_groups: Dict[str, List[Dict[str, Any]]] = {}
        for photo in validated_photos:
            hole = photo.get('hole_number', 'unknown')
            if hole not in hole_groups:
                hole_groups[hole] = []
            hole_groups[hole].append(photo)
        
        for hole, photos in hole_groups.items():
            lines.append(f"### 4.1 孔号: {hole}")
            lines.append("")
            
            photos_sorted = sorted(photos, key=lambda x: (x.get('box_number') or 0, x.get('depth_start') or 0))
            
            lines.append("| 箱号 | 深度区间 | 原始文件名 | 校验状态 | GPS坐标 |")
            lines.append("|------|----------|------------|----------|---------|")
            
            for photo in photos_sorted:
                box = photo.get('box_number') or '-'
                depth_start = photo.get('depth_start')
                depth_end = photo.get('depth_end')
                depth = f"{depth_start}-{depth_end}m" if depth_start and depth_end else '-'
                
                filename = photo.get('name', '-')
                status = photo.get('validation_status', 'unknown')
                status_icon = "✅" if status == 'valid' else "⚠️" if status == 'has_errors' else "❓"
                
                lat = photo.get('gps_latitude')
                lon = photo.get('gps_longitude')
                gps = f"{lat:.4f}, {lon:.4f}" if lat and lon else '-'
                
                lines.append(f"| {box} | {depth} | {filename} | {status_icon} {status} | {gps} |")
            
            lines.append("")
        
        return lines
    
    def _generate_issues_section(self) -> List[str]:
        """生成问题部分"""
        lines = []
        
        lines.append("## 5. 主要问题详情")
        lines.append("")
        
        issues = self.validation_results.get('issues', [])
        
        if not issues:
            lines.append("✅ 未发现问题。")
            lines.append("")
            return lines
        
        error_issues = [i for i in issues if i.get('severity') == 'error']
        warning_issues = [i for i in issues if i.get('severity') == 'warning']
        
        if error_issues:
            lines.append("### 5.1 错误问题 (必须处理)")
            lines.append("")
            
            for issue in error_issues[:10]:
                lines.append(f"**文件**: {issue.get('file_name', 'N/A')}")
                lines.append("")
                lines.append(f"**类型**: {self._translate_issue_type(issue.get('issue_type', 'unknown'))}")
                lines.append("")
                lines.append(f"**描述**: {issue.get('message', 'N/A')}")
                lines.append("")
                
                if issue.get('expected_value'):
                    lines.append(f"**期望**: {issue.get('expected_value')}")
                    lines.append("")
                if issue.get('actual_value'):
                    lines.append(f"**实际**: {issue.get('actual_value')}")
                    lines.append("")
                
                lines.append("---")
                lines.append("")
            
            if len(error_issues) > 10:
                lines.append(f"... 还有 {len(error_issues) - 10} 个错误问题，请查看 `issues.csv` 获取完整列表。")
                lines.append("")
        
        if warning_issues:
            lines.append("### 5.2 警告问题 (建议检查)")
            lines.append("")
            
            for issue in warning_issues[:5]:
                lines.append(f"- **{issue.get('file_name', 'N/A')}**: {issue.get('message', 'N/A')}")
                lines.append("")
            
            if len(warning_issues) > 5:
                lines.append(f"... 还有 {len(warning_issues) - 5} 个警告问题，请查看 `issues.csv` 获取完整列表。")
                lines.append("")
        
        return lines
    
    def _generate_notes_section(self) -> List[str]:
        """生成备注部分"""
        lines = []
        
        lines.append("## 6. 备注与说明")
        lines.append("")
        lines.append("### 6.1 使用说明")
        lines.append("")
        lines.append("1. 所有照片已按孔号、箱号、深度区间进行整理")
        lines.append("2. 数据校验结果已记录在 `review.json` 文件中")
        lines.append("3. 问题清单已导出为 `issues.csv`，包含所有发现的问题")
        lines.append("4. 如需撤销本次归档，可使用回滚功能")
        lines.append("")
        
        lines.append("### 6.2 目录结构说明")
        lines.append("")
        lines.append("```")
        lines.append("archive/")
        lines.append("├── ZK001/                    # 孔号目录")
        lines.append("│   ├── 箱号1/                # 箱号目录")
        lines.append("│   │   ├── photos/           # 照片文件")
        lines.append("│   │   ├── notes/            # 备注文件")
        lines.append("│   │   └── ZK001_箱1_取样记录.csv")
        lines.append("│   └── ...")
        lines.append("├── gps_traces/               # GPS轨迹文件")
        lines.append("├── manifest.json             # 归档清单")
        lines.append("└── rollback_log.json         # 回滚日志")
        lines.append("```")
        lines.append("")
        
        return lines
    
    def generate_issues_csv(self, output_path: str) -> None:
        """生成 CSV 问题清单"""
        issues = self.validation_results.get('issues', [])
        
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        fieldnames = [
            '序号', '严重程度', '问题类型', '文件名称', 
            '孔号', '箱号', '深度起始', '深度结束',
            '问题描述', '期望数值', '实际数值', '附加信息'
        ]
        
        with open(output_file, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for idx, issue in enumerate(issues, 1):
                row = {
                    '序号': idx,
                    '严重程度': self._translate_severity(issue.get('severity', '')),
                    '问题类型': self._translate_issue_type(issue.get('issue_type', '')),
                    '文件名称': issue.get('file_name', ''),
                    '孔号': issue.get('hole_number', '') or '',
                    '箱号': issue.get('box_number', '') or '',
                    '深度起始': issue.get('depth_start', '') or '',
                    '深度结束': issue.get('depth_end', '') or '',
                    '问题描述': issue.get('message', ''),
                    '期望数值': str(issue.get('expected_value', '')) if issue.get('expected_value') else '',
                    '实际数值': str(issue.get('actual_value', '')) if issue.get('actual_value') else '',
                    '附加信息': str(issue.get('additional_info', '')) if issue.get('additional_info') else '',
                }
                writer.writerow(row)
    
    def _translate_severity(self, severity: str) -> str:
        """翻译严重程度为中文"""
        translations = {
            'error': '错误',
            'warning': '警告',
            'info': '提示',
            'debug': '调试'
        }
        return translations.get(severity, severity)
