import json
import csv
from datetime import datetime
from typing import List, Dict
import pandas as pd
from pathlib import Path

from .models import TraceResult, AnomalyType


class ReportExporter:
    @staticmethod
    def _serialize_datetime(obj):
        if isinstance(obj, datetime):
            return obj.strftime('%Y-%m-%d %H:%M:%S')
        raise TypeError(f"Type {type(obj)} not serializable")

    @staticmethod
    def export_json(results: List[TraceResult], output_path: str) -> None:
        data = []
        for result in results:
            result_dict = result.dict()
            result_dict['anomalies'] = [a.value for a in result.anomalies]
            data.append(result_dict)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=ReportExporter._serialize_datetime)

    @staticmethod
    def export_csv(results: List[TraceResult], output_path: str) -> None:
        with open(output_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow([
                '批次号', '耗材名称', '灭菌记录ID', '灭菌日期', '灭菌有效期',
                '使用记录ID', '使用日期', '治疗项目ID', '治疗日期',
                '患者ID', '患者姓名', '是否有效', '异常类型', '异常详情', '使用数量'
            ])
            
            for result in results:
                writer.writerow([
                    result.batch_id,
                    result.material_name,
                    result.sterilization_id or '',
                    result.sterilization_date.strftime('%Y-%m-%d %H:%M:%S') if result.sterilization_date else '',
                    result.sterilization_expiration.strftime('%Y-%m-%d %H:%M:%S') if result.sterilization_expiration else '',
                    result.usage_id or '',
                    result.usage_date.strftime('%Y-%m-%d %H:%M:%S') if result.usage_date else '',
                    result.treatment_id or '',
                    result.treatment_date.strftime('%Y-%m-%d %H:%M:%S') if result.treatment_date else '',
                    result.patient_id or '',
                    result.patient_name or '',
                    '是' if result.is_valid else '否',
                    ','.join([a.value for a in result.anomalies]),
                    '; '.join(result.anomaly_details),
                    result.quantity_used or ''
                ])

    @staticmethod
    def export_excel(results: List[TraceResult], output_path: str, stats: Dict = None) -> None:
        data = []
        for result in results:
            data.append({
                '批次号': result.batch_id,
                '耗材名称': result.material_name,
                '灭菌记录ID': result.sterilization_id or '',
                '灭菌日期': result.sterilization_date.strftime('%Y-%m-%d %H:%M:%S') if result.sterilization_date else '',
                '灭菌有效期': result.sterilization_expiration.strftime('%Y-%m-%d %H:%M:%S') if result.sterilization_expiration else '',
                '使用记录ID': result.usage_id or '',
                '使用日期': result.usage_date.strftime('%Y-%m-%d %H:%M:%S') if result.usage_date else '',
                '治疗项目ID': result.treatment_id or '',
                '治疗日期': result.treatment_date.strftime('%Y-%m-%d %H:%M:%S') if result.treatment_date else '',
                '患者ID': result.patient_id or '',
                '患者姓名': result.patient_name or '',
                '是否有效': '是' if result.is_valid else '否',
                '异常类型': ','.join([a.value for a in result.anomalies]),
                '异常详情': '; '.join(result.anomaly_details),
                '使用数量': result.quantity_used or ''
            })
        
        df = pd.DataFrame(data)
        
        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='追溯结果', index=False)
            
            if stats:
                stats_data = {
                    '统计项': [
                        '总追溯记录数', '有效记录数', '无效记录数', '总批次数量',
                        '总灭菌记录数', '总患者数', '总治疗项目数', '总使用记录数'
                    ],
                    '数值': [
                        stats['total_traces'],
                        stats['valid_count'],
                        stats['invalid_count'],
                        stats['total_batches'],
                        stats['total_sterilizations'],
                        stats['total_patients'],
                        stats['total_treatments'],
                        stats['total_usages']
                    ]
                }
                
                anomaly_stats = stats.get('anomaly_counts', {})
                for anomaly_type, count in anomaly_stats.items():
                    stats_data['统计项'].append(f'异常: {anomaly_type}')
                    stats_data['数值'].append(count)
                
                stats_df = pd.DataFrame(stats_data)
                stats_df.to_excel(writer, sheet_name='统计汇总', index=False)

    @staticmethod
    def export_text(results: List[TraceResult], output_path: str, stats: Dict = None) -> None:
        lines = []
        lines.append("=" * 80)
        lines.append("口腔耗材批次灭菌有效期患者追溯报告")
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("=" * 80)
        lines.append("")
        
        if stats:
            lines.append("【统计汇总】")
            lines.append(f"  总追溯记录数: {stats['total_traces']}")
            lines.append(f"  有效记录数: {stats['valid_count']}")
            lines.append(f"  无效记录数: {stats['invalid_count']}")
            lines.append(f"  总批次数量: {stats['total_batches']}")
            lines.append(f"  总灭菌记录数: {stats['total_sterilizations']}")
            lines.append(f"  总患者数: {stats['total_patients']}")
            lines.append(f"  总治疗项目数: {stats['total_treatments']}")
            lines.append(f"  总使用记录数: {stats['total_usages']}")
            
            anomaly_stats = stats.get('anomaly_counts', {})
            if anomaly_stats:
                lines.append("")
                lines.append("  异常统计:")
                for anomaly_type, count in anomaly_stats.items():
                    lines.append(f"    - {anomaly_type}: {count} 条")
            lines.append("")
        
        valid_results = [r for r in results if r.is_valid]
        invalid_results = [r for r in results if not r.is_valid]
        
        if invalid_results:
            lines.append("【异常记录详情】")
            lines.append("-" * 80)
            for i, result in enumerate(invalid_results, 1):
                lines.append(f"\n  异常记录 #{i}")
                lines.append(f"    批次号: {result.batch_id}")
                lines.append(f"    耗材名称: {result.material_name}")
                lines.append(f"    患者: {result.patient_name or '未知'} (ID: {result.patient_id or '未知'})")
                lines.append(f"    使用时间: {result.usage_date.strftime('%Y-%m-%d %H:%M:%S') if result.usage_date else '未使用'}")
                lines.append(f"    异常类型: {', '.join([a.value for a in result.anomalies])}")
                lines.append(f"    异常详情:")
                for detail in result.anomaly_details:
                    lines.append(f"      - {detail}")
            lines.append("")
        
        lines.append("【所有追溯记录】")
        lines.append("-" * 80)
        
        for i, result in enumerate(results, 1):
            status = "✓ 有效" if result.is_valid else "✗ 异常"
            lines.append(f"\n  记录 #{i} [{status}]")
            lines.append(f"    批次信息: {result.batch_id} - {result.material_name}")
            
            if result.sterilization_id:
                lines.append(f"    灭菌信息: {result.sterilization_id}")
                lines.append(f"      灭菌时间: {result.sterilization_date.strftime('%Y-%m-%d %H:%M:%S') if result.sterilization_date else ''}")
                lines.append(f"      有效期至: {result.sterilization_expiration.strftime('%Y-%m-%d %H:%M:%S') if result.sterilization_expiration else ''}")
            else:
                lines.append("    灭菌信息: 无")
            
            if result.usage_id:
                lines.append(f"    使用信息: {result.usage_id}")
                lines.append(f"      使用时间: {result.usage_date.strftime('%Y-%m-%d %H:%M:%S') if result.usage_date else ''}")
                lines.append(f"      使用数量: {result.quantity_used}")
            else:
                lines.append("    使用信息: 无")
            
            if result.patient_name:
                lines.append(f"    患者信息: {result.patient_name} (ID: {result.patient_id})")
                lines.append(f"      治疗项目: {result.treatment_id}")
                lines.append(f"      治疗时间: {result.treatment_date.strftime('%Y-%m-%d %H:%M:%S') if result.treatment_date else ''}")
            else:
                lines.append("    患者信息: 无")
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))

    @staticmethod
    def export_all_formats(results: List[TraceResult], output_dir: str, stats: Dict = None, prefix: str = "trace_report") -> None:
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        ReportExporter.export_json(results, f"{output_dir}/{prefix}_{timestamp}.json")
        ReportExporter.export_csv(results, f"{output_dir}/{prefix}_{timestamp}.csv")
        ReportExporter.export_excel(results, f"{output_dir}/{prefix}_{timestamp}.xlsx", stats)
        ReportExporter.export_text(results, f"{output_dir}/{prefix}_{timestamp}.txt", stats)
