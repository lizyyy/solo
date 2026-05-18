import pandas as pd
import json
from pathlib import Path
from datetime import datetime
from typing import List, Dict
import logging


class Exporter:
    def __init__(self, output_config: Dict):
        self.output_config = output_config
        self.logger = logging.getLogger("pharmacy_scanner")
    
    def export(self, records: List[Dict], failed_records: List[Dict], 
               warnings: List[str], output_dir: str, 
               file_errors: Dict = None) -> str:
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_format = self.output_config.get('format', 'csv')
        encoding = self.output_config.get('encoding', 'utf-8-sig')
        
        main_filename = f"expiry_scan_result_{timestamp}.{output_format}"
        main_filepath = output_path / main_filename
        
        df = pd.DataFrame(records)
        if output_format == 'csv':
            df.to_csv(main_filepath, index=False, encoding=encoding)
        elif output_format == 'json':
            df.to_json(main_filepath, orient='records', force_ascii=False, indent=2)
        elif output_format == 'xlsx':
            df.to_excel(main_filepath, index=False)
        
        self.logger.info(f"结果已导出至: {main_filepath}")
        
        summary = self._generate_summary(records, failed_records, warnings, file_errors)
        
        if self.output_config.get('include_summary', True):
            summary_filename = f"expiry_scan_summary_{timestamp}.md"
            summary_filepath = output_path / summary_filename
            
            with open(summary_filepath, 'w', encoding='utf-8') as f:
                f.write(summary)
            
            self.logger.info(f"摘要已导出至: {summary_filepath}")
        
        return str(main_filepath)
    
    def _generate_summary(self, records: List[Dict], failed_records: List[Dict],
                          warnings: List[str], file_errors: Dict = None) -> str:
        total_count = len(records)
        failed_count = len(failed_records)
        
        status_counts = {}
        for record in records:
            status = record.get('expiry_status', '未知')
            status_counts[status] = status_counts.get(status, 0) + 1
        
        expired_count = sum(1 for r in records if r.get('days_remaining', 999) < 0)
        critical_count = sum(1 for r in records if 0 <= r.get('days_remaining', 999) <= 30)
        warning_count = sum(1 for r in records if 30 < r.get('days_remaining', 999) <= 90)
        normal_count = sum(1 for r in records if r.get('days_remaining', 999) > 90)
        
        summary_lines = [
            "# 社区药房药品效期扫描报告",
            "",
            f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "",
            "## 统计概览",
            "",
            f"- 总处理记录数: {total_count}",
            f"- 处理失败记录数: {failed_count}",
            "",
            "### 效期分布",
            f"- 已过期: {expired_count} 条",
            f"- 临期预警 (≤30天): {critical_count} 条",
            f"- 效期提醒 (31-90天): {warning_count} 条",
            f"- 效期正常 (>90天): {normal_count} 条",
            "",
        ]
        
        if file_errors:
            summary_lines.extend([
                "## 文件处理错误",
                ""
            ])
            for filename, error in file_errors.items():
                summary_lines.append(f"- **{filename}**: {error}")
            summary_lines.append("")
        
        if warnings:
            summary_lines.extend([
                "## 处理警告",
                ""
            ])
            for warning in warnings:
                summary_lines.append(f"- {warning}")
            summary_lines.append("")
        
        if expired_count > 0 or critical_count > 0:
            summary_lines.extend([
                "## 需要重点关注的药品",
                ""
            ])
            
            high_risk = [r for r in records if r.get('days_remaining', 999) <= 30]
            high_risk_sorted = sorted(high_risk, key=lambda x: x.get('days_remaining', 999))
            
            summary_lines.extend([
                "| 药品名称 | 批号 | 规格 | 数量 | 货位 | 有效期至 | 剩余天数 | 状态 |",
                "|---------|-----|-----|-----|-----|---------|---------|-----|",
            ])
            
            for record in high_risk_sorted[:20]:
                summary_lines.append(
                    f"| {record.get('drug_name', '')} | "
                    f"{record.get('batch_number', '')} | "
                    f"{record.get('specification', '')} | "
                    f"{record.get('quantity', '')} | "
                    f"{record.get('location', '')} | "
                    f"{record.get('expiry_date', '')} | "
                    f"{record.get('days_remaining', '')} | "
                    f"{record.get('expiry_status', '')} |"
                )
            
            if len(high_risk_sorted) > 20:
                summary_lines.append(f"| ... (还有 {len(high_risk_sorted) - 20} 条记录) | | | | | | | |")
            
            summary_lines.append("")
        
        return '\n'.join(summary_lines)
