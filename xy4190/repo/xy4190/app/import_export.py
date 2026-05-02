"""导入导出模块 - Markdown报告、CSV异常清单、JSON审计包"""

import pandas as pd
import numpy as np
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any, Union
from dataclasses import asdict, is_dataclass
from enum import Enum

from .data_parser import TemperatureRecord, DoorEvent, CalibrationRecord, BatchRecord
from .rules_engine import AnomalySegment, AnomalyType, AnomalySeverity, RuleConfig
from .metrics import TemperatureMetrics, DoorMetrics, BatchExposureMetrics


class EnhancedJSONEncoder(json.JSONEncoder):
    """增强JSON编码器"""
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, Enum):
            return obj.value
        if isinstance(obj, Path):
            return str(obj)
        if isinstance(obj, pd.Timestamp):
            return obj.isoformat()
        if isinstance(obj, (np.integer, np.int64)):
            return int(obj)
        if isinstance(obj, (np.floating, np.float64)):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if is_dataclass(obj):
            return asdict(obj)
        return super().default(obj)


class ReportGenerator:
    """报告生成器"""
    
    def __init__(self):
        self.report_title = "疫苗冷链温控偏航复盘报告"
    
    def generate_markdown_report(
        self,
        analysis_data: Dict[str, Any],
        include_anomalies: bool = True,
        include_metrics: bool = True,
        include_batches: bool = True,
        include_reviews: bool = True
    ) -> str:
        """生成Markdown格式报告"""
        now = datetime.now()
        
        lines = []
        
        lines.append(f"# {self.report_title}")
        lines.append("")
        lines.append(f"**生成时间**: {now.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        summary_stats = self._calculate_summary_stats(analysis_data)
        lines.append("## 一、分析概览")
        lines.append("")
        lines.append("### 1.1 基本信息")
        lines.append("")
        lines.append(f"- **分析设备数**: {summary_stats.get('device_count', 0)} 台")
        lines.append(f"- **温度记录总数**: {summary_stats.get('total_records', 0)} 条")
        lines.append(f"- **开门事件数**: {summary_stats.get('door_event_count', 0)} 次")
        lines.append(f"- **运输批次**: {summary_stats.get('batch_count', 0)} 批")
        lines.append("")
        
        lines.append("### 1.2 异常统计")
        lines.append("")
        anomaly_summary = summary_stats.get('anomaly_summary', {})
        if anomaly_summary:
            lines.append("| 异常类型 | 数量 | 严重程度分布 |")
            lines.append("|----------|------|--------------|")
            for anomaly_type, counts in anomaly_summary.items():
                low = counts.get('low', 0)
                medium = counts.get('medium', 0)
                high = counts.get('high', 0)
                critical = counts.get('critical', 0)
                total = counts.get('total', 0)
                severity_str = f"低:{low} 中:{medium} 高:{high} 严重:{critical}"
                lines.append(f"| {self._format_anomaly_type(anomaly_type)} | {total} | {severity_str} |")
        else:
            lines.append("本次分析未检测到异常。")
        lines.append("")
        
        if include_metrics:
            lines.append("---")
            lines.append("")
            lines.append("## 二、设备指标统计")
            lines.append("")
            
            temp_metrics = analysis_data.get('temperature_metrics', {})
            if temp_metrics:
                lines.append("### 2.1 温度统计")
                lines.append("")
                lines.append("| 设备ID | 记录数 | 均值(°C) | 最小值(°C) | 最大值(°C) | 标准差(°C) | 波动(%) |")
                lines.append("|--------|--------|-----------|------------|------------|------------|---------|")
                
                for device_id, metrics in temp_metrics.items():
                    if isinstance(metrics, TemperatureMetrics):
                        lines.append(
                            f"| {device_id} | {metrics.valid_records}/{metrics.total_records} | "
                            f"{metrics.mean_temp:.2f} | {metrics.min_temp:.2f} | {metrics.max_temp:.2f} | "
                            f"{metrics.std_temp:.2f} | {metrics.fluctuation_rate:.1f}% |"
                        )
                    elif isinstance(metrics, dict):
                        lines.append(
                            f"| {device_id} | {metrics.get('valid_records', 'N/A')}/{metrics.get('total_records', 'N/A')} | "
                            f"{metrics.get('mean_temp', 'N/A'):.2f} | {metrics.get('min_temp', 'N/A'):.2f} | "
                            f"{metrics.get('max_temp', 'N/A'):.2f} | {metrics.get('std_temp', 'N/A'):.2f} | "
                            f"{metrics.get('fluctuation_rate', 'N/A'):.1f}% |"
                        )
                lines.append("")
            
            door_metrics = analysis_data.get('door_metrics', {})
            if door_metrics:
                lines.append("### 2.2 开门统计")
                lines.append("")
                lines.append("| 设备ID | 开门次数 | 总时长(分钟) | 平均时长(秒) | 最长时长(秒) | 长时间开门数 |")
                lines.append("|--------|----------|--------------|--------------|--------------|--------------|")
                
                for device_id, metrics in door_metrics.items():
                    if isinstance(metrics, DoorMetrics):
                        lines.append(
                            f"| {device_id} | {metrics.total_openings} | "
                            f"{metrics.total_duration_seconds/60:.1f} | {metrics.avg_duration_seconds:.1f} | "
                            f"{metrics.max_duration_seconds:.1f} | {metrics.long_openings_count} |"
                        )
                    elif isinstance(metrics, dict):
                        lines.append(
                            f"| {device_id} | {metrics.get('total_openings', 0)} | "
                            f"{metrics.get('total_duration_seconds', 0)/60:.1f} | "
                            f"{metrics.get('avg_duration_seconds', 0):.1f} | "
                            f"{metrics.get('max_duration_seconds', 0):.1f} | "
                            f"{metrics.get('long_openings_count', 0)} |"
                        )
                lines.append("")
        
        if include_anomalies:
            lines.append("---")
            lines.append("")
            lines.append("## 三、异常详情")
            lines.append("")
            
            anomalies = analysis_data.get('anomalies', [])
            if anomalies:
                critical_anomalies = [a for a in anomalies if self._get_severity(a) == 'critical']
                high_anomalies = [a for a in anomalies if self._get_severity(a) == 'high']
                medium_anomalies = [a for a in anomalies if self._get_severity(a) == 'medium']
                low_anomalies = [a for a in anomalies if self._get_severity(a) == 'low']
                
                if critical_anomalies:
                    lines.append("### 3.1 严重异常 (CRITICAL)")
                    lines.append("")
                    lines.append("| 异常ID | 设备ID | 类型 | 开始时间 | 结束时间 | 持续时间 | 描述 | 重叠批次 |")
                    lines.append("|--------|--------|------|----------|----------|----------|------|----------|")
                    for anomaly in critical_anomalies:
                        lines.append(self._format_anomaly_row(anomaly))
                    lines.append("")
                
                if high_anomalies:
                    lines.append("### 3.2 高危异常 (HIGH)")
                    lines.append("")
                    lines.append("| 异常ID | 设备ID | 类型 | 开始时间 | 结束时间 | 持续时间 | 描述 | 重叠批次 |")
                    lines.append("|--------|--------|------|----------|----------|----------|------|----------|")
                    for anomaly in high_anomalies:
                        lines.append(self._format_anomaly_row(anomaly))
                    lines.append("")
                
                if medium_anomalies:
                    lines.append("### 3.3 中等异常 (MEDIUM)")
                    lines.append("")
                    lines.append("| 异常ID | 设备ID | 类型 | 开始时间 | 结束时间 | 持续时间 | 描述 | 重叠批次 |")
                    lines.append("|--------|--------|------|----------|----------|----------|------|----------|")
                    for anomaly in medium_anomalies:
                        lines.append(self._format_anomaly_row(anomaly))
                    lines.append("")
                
                if low_anomalies:
                    lines.append("### 3.4 一般异常 (LOW)")
                    lines.append("")
                    lines.append("| 异常ID | 设备ID | 类型 | 开始时间 | 结束时间 | 持续时间 | 描述 | 重叠批次 |")
                    lines.append("|--------|--------|------|----------|----------|----------|------|----------|")
                    for anomaly in low_anomalies:
                        lines.append(self._format_anomaly_row(anomaly))
                    lines.append("")
            else:
                lines.append("本次分析未检测到异常。")
                lines.append("")
        
        if include_batches:
            lines.append("---")
            lines.append("")
            lines.append("## 四、批次暴露风险")
            lines.append("")
            
            batch_metrics = analysis_data.get('batch_metrics', {})
            if batch_metrics:
                lines.append("| 批次号 | 产品名称 | 设备ID | 总时长(分钟) | 开门暴露(分钟) | 异常暴露(分钟) | 风险等级 |")
                lines.append("|--------|----------|--------|--------------|----------------|----------------|----------|")
                
                for batch_id, metrics in batch_metrics.items():
                    if isinstance(metrics, BatchExposureMetrics):
                        risk_color = self._get_risk_color(metrics.risk_level)
                        lines.append(
                            f"| {batch_id} | {metrics.product_name} | {metrics.device_id} | "
                            f"{metrics.total_exposure_duration_seconds/60:.1f} | "
                            f"{metrics.exposure_during_open_doors_seconds/60:.1f} | "
                            f"{metrics.exposure_during_temperature_anomalies_seconds/60:.1f} | "
                            f"{metrics.risk_level.upper()} |"
                        )
                    elif isinstance(metrics, dict):
                        lines.append(
                            f"| {batch_id} | {metrics.get('product_name', 'N/A')} | {metrics.get('device_id', 'N/A')} | "
                            f"{metrics.get('total_exposure_duration_seconds', 0)/60:.1f} | "
                            f"{metrics.get('exposure_during_open_doors_seconds', 0)/60:.1f} | "
                            f"{metrics.get('exposure_during_temperature_anomalies_seconds', 0)/60:.1f} | "
                            f"{metrics.get('risk_level', 'normal').upper()} |"
                        )
                lines.append("")
            else:
                lines.append("本次分析无批次数据。")
                lines.append("")
        
        if include_reviews:
            lines.append("---")
            lines.append("")
            lines.append("## 五、人工复核记录")
            lines.append("")
            
            reviews = analysis_data.get('reviews', [])
            if reviews:
                lines.append("| 异常ID | 复核时间 | 复核原因 | 备注 | 复核人 |")
                lines.append("|--------|----------|----------|------|--------|")
                
                for review in reviews:
                    review_time = review.get('review_datetime', review.get('review_timestamp', 'N/A'))
                    if isinstance(review_time, datetime):
                        review_time = review_time.strftime('%Y-%m-%d %H:%M:%S')
                    
                    lines.append(
                        f"| {review.get('anomaly_id', 'N/A')} | {review_time} | "
                        f"{review.get('review_reason', 'N/A')} | "
                        f"{review.get('review_notes', '')} | "
                        f"{review.get('reviewed_by', 'N/A')} |"
                    )
                lines.append("")
            else:
                lines.append("本次分析无人工复核记录。")
                lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("## 六、规则配置")
        lines.append("")
        
        config = analysis_data.get('config', {})
        if config:
            lines.append("| 配置项 | 当前值 | 说明 |")
            lines.append("|--------|--------|------|")
            lines.append(f"| 温度上限阈值 | {config.get('upper_temp_threshold', 8.0)}°C | 超温判定阈值 |")
            lines.append(f"| 温度下限阈值 | {config.get('lower_temp_threshold', 2.0)}°C | 低温判定阈值 |")
            lines.append(f"| 连续超温窗口 | {config.get('continuous_overtemp_window_minutes', 15)}分钟 | 连续超温判定窗口 |")
            lines.append(f"| 连续低温窗口 | {config.get('continuous_undertemp_window_minutes', 15)}分钟 | 连续低温判定窗口 |")
            lines.append(f"| 数据缺失阈值 | {config.get('missing_data_threshold_minutes', 30)}分钟 | 数据缺失判定阈值 |")
            lines.append(f"| 温度骤变阈值 | {config.get('rapid_change_threshold', 2.0)}°C | 温度快速变化判定阈值 |")
            lines.append(f"| 长时间开门阈值 | {config.get('long_door_opening_seconds', 180)}秒 | 长时间开门判定阈值 |")
        lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*报告由温控偏航复盘板自动生成*")
        
        return "\n".join(lines)
    
    def _calculate_summary_stats(self, analysis_data: Dict) -> Dict:
        """计算汇总统计"""
        stats = {}
        
        temp_metrics = analysis_data.get('temperature_metrics', {})
        stats['device_count'] = len(temp_metrics)
        
        total_records = 0
        for device_id, metrics in temp_metrics.items():
            if isinstance(metrics, TemperatureMetrics):
                total_records += metrics.total_records
            elif isinstance(metrics, dict):
                total_records += metrics.get('total_records', 0)
        stats['total_records'] = total_records
        
        stats['door_event_count'] = len(analysis_data.get('door_events', []))
        stats['batch_count'] = len(analysis_data.get('batch_metrics', {}))
        
        anomalies = analysis_data.get('anomalies', [])
        anomaly_summary = defaultdict(lambda: defaultdict(int))
        
        for anomaly in anomalies:
            anomaly_type = self._get_anomaly_type(anomaly)
            severity = self._get_severity(anomaly)
            
            anomaly_summary[anomaly_type]['total'] += 1
            anomaly_summary[anomaly_type][severity] += 1
        
        stats['anomaly_summary'] = dict(anomaly_summary)
        
        return stats
    
    def _format_anomaly_type(self, anomaly_type: str) -> str:
        """格式化异常类型名称"""
        type_names = {
            'over_temperature': '超温',
            'under_temperature': '低温',
            'continuous_overtemp': '连续超温',
            'continuous_undertemp': '连续低温',
            'missing_data': '数据缺失',
            'rapid_change': '温度骤变',
            'door_open_too_long': '长时间开门',
            'sensor_drift': '探头漂移'
        }
        return type_names.get(anomaly_type, anomaly_type)
    
    def _get_anomaly_type(self, anomaly) -> str:
        """获取异常类型"""
        if isinstance(anomaly, AnomalySegment):
            if isinstance(anomaly.anomaly_type, AnomalyType):
                return anomaly.anomaly_type.value
            return str(anomaly.anomaly_type)
        elif isinstance(anomaly, dict):
            return anomaly.get('anomaly_type', 'unknown')
        return 'unknown'
    
    def _get_severity(self, anomaly) -> str:
        """获取异常严重程度"""
        if isinstance(anomaly, AnomalySegment):
            if isinstance(anomaly.severity, AnomalySeverity):
                return anomaly.severity.value
            return str(anomaly.severity)
        elif isinstance(anomaly, dict):
            return anomaly.get('severity', 'low')
        return 'low'
    
    def _format_anomaly_row(self, anomaly) -> str:
        """格式化异常表格行"""
        if isinstance(anomaly, AnomalySegment):
            anomaly_id = anomaly.anomaly_id
            device_id = anomaly.device_id
            anomaly_type = self._format_anomaly_type(self._get_anomaly_type(anomaly))
            start_time = anomaly.start_time.strftime('%Y-%m-%d %H:%M') if anomaly.start_time else 'N/A'
            end_time = anomaly.end_time.strftime('%Y-%m-%d %H:%M') if anomaly.end_time else 'N/A'
            duration = f"{anomaly.duration_seconds/60:.1f}分钟"
            description = anomaly.description.replace('|', ' ')
            batch_overlaps = ', '.join(anomaly.batch_overlaps) if anomaly.batch_overlaps else '-'
        elif isinstance(anomaly, dict):
            anomaly_id = anomaly.get('anomaly_id', 'N/A')
            device_id = anomaly.get('device_id', 'N/A')
            anomaly_type = self._format_anomaly_type(anomaly.get('anomaly_type', 'unknown'))
            start_time = anomaly.get('start_time', 'N/A')
            if isinstance(start_time, str):
                start_time = start_time[:16]
            end_time = anomaly.get('end_time', 'N/A')
            if isinstance(end_time, str):
                end_time = end_time[:16]
            duration = f"{anomaly.get('duration_seconds', 0)/60:.1f}分钟"
            description = anomaly.get('description', '').replace('|', ' ')
            batch_overlaps = ', '.join(anomaly.get('batch_overlaps', [])) or '-'
        else:
            return "| N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |"
        
        return f"| {anomaly_id} | {device_id} | {anomaly_type} | {start_time} | {end_time} | {duration} | {description} | {batch_overlaps} |"
    
    def _get_risk_color(self, risk_level: str) -> str:
        """获取风险等级颜色"""
        colors = {
            'normal': '🟢',
            'medium': '🟡',
            'high': '🔴'
        }
        return colors.get(risk_level, '⚪')


class AnomalyCSVExporter:
    """异常清单CSV导出器"""
    
    def export_to_dataframe(
        self,
        anomalies: List[Any],
        include_reviews: bool = True
    ) -> pd.DataFrame:
        """导出异常为DataFrame"""
        rows = []
        
        for anomaly in anomalies:
            if isinstance(anomaly, AnomalySegment):
                row = {
                    '异常ID': anomaly.anomaly_id,
                    '设备ID': anomaly.device_id,
                    '异常类型': self._format_anomaly_type(anomaly.anomaly_type),
                    '严重程度': anomaly.severity.value.upper() if hasattr(anomaly.severity, 'value') else str(anomaly.severity),
                    '开始时间': anomaly.start_time.strftime('%Y-%m-%d %H:%M:%S') if anomaly.start_time else '',
                    '结束时间': anomaly.end_time.strftime('%Y-%m-%d %H:%M:%S') if anomaly.end_time else '',
                    '持续时间(分钟)': round(anomaly.duration_seconds / 60, 2),
                    '最小值(°C)': anomaly.min_value,
                    '最大值(°C)': anomaly.max_value,
                    '平均值(°C)': anomaly.mean_value,
                    '描述': anomaly.description,
                    '重叠批次': ', '.join(anomaly.batch_overlaps) if anomaly.batch_overlaps else '',
                    '已复核': '是' if anomaly.reviewed else '否',
                    '复核原因': anomaly.review_reason if anomaly.reviewed else '',
                    '复核备注': anomaly.review_notes if anomaly.reviewed else '',
                    '复核人': anomaly.reviewed_by if anomaly.reviewed else '',
                    '复核时间': anomaly.reviewed_at.strftime('%Y-%m-%d %H:%M:%S') if anomaly.reviewed_at else ''
                }
            elif isinstance(anomaly, dict):
                row = {
                    '异常ID': anomaly.get('anomaly_id', ''),
                    '设备ID': anomaly.get('device_id', ''),
                    '异常类型': self._format_anomaly_type(anomaly.get('anomaly_type', '')),
                    '严重程度': anomaly.get('severity', '').upper(),
                    '开始时间': anomaly.get('start_time', ''),
                    '结束时间': anomaly.get('end_time', ''),
                    '持续时间(分钟)': round(anomaly.get('duration_seconds', 0) / 60, 2),
                    '最小值(°C)': anomaly.get('min_value'),
                    '最大值(°C)': anomaly.get('max_value'),
                    '平均值(°C)': anomaly.get('mean_value'),
                    '描述': anomaly.get('description', ''),
                    '重叠批次': ', '.join(anomaly.get('batch_overlaps', [])) if anomaly.get('batch_overlaps') else '',
                    '已复核': '是' if anomaly.get('reviewed') else '否',
                    '复核原因': anomaly.get('review_reason', ''),
                    '复核备注': anomaly.get('review_notes', ''),
                    '复核人': anomaly.get('reviewed_by', ''),
                    '复核时间': anomaly.get('reviewed_at', '')
                }
            else:
                continue
            
            rows.append(row)
        
        return pd.DataFrame(rows)
    
    def export_to_csv(
        self,
        anomalies: List[Any],
        output_path: str,
        include_reviews: bool = True
    ) -> str:
        """导出异常为CSV文件"""
        df = self.export_to_dataframe(anomalies, include_reviews)
        df.to_csv(output_path, index=False, encoding='utf-8-sig')
        return output_path
    
    def _format_anomaly_type(self, anomaly_type) -> str:
        """格式化异常类型"""
        type_names = {
            'over_temperature': '超温',
            'under_temperature': '低温',
            'continuous_overtemp': '连续超温',
            'continuous_undertemp': '连续低温',
            'missing_data': '数据缺失',
            'rapid_change': '温度骤变',
            'door_open_too_long': '长时间开门',
            'sensor_drift': '探头漂移'
        }
        
        if hasattr(anomaly_type, 'value'):
            anomaly_type = anomaly_type.value
        
        return type_names.get(str(anomaly_type), str(anomaly_type))


class AuditPackageExporter:
    """审计包导出器"""
    
    def export_audit_package(
        self,
        analysis_data: Dict[str, Any],
        output_path: str,
        include_raw_data: bool = False
    ) -> str:
        """导出完整审计包"""
        package = {
            'export_metadata': {
                'export_time': datetime.now().isoformat(),
                'version': '1.0',
                'package_type': 'temperature_monitor_audit'
            },
            'analysis_summary': {},
            'anomalies': [],
            'metrics': {},
            'config': {},
            'reviews': []
        }
        
        summary = {
            'device_count': len(analysis_data.get('temperature_metrics', {})),
            'anomaly_count': len(analysis_data.get('anomalies', [])),
            'batch_count': len(analysis_data.get('batch_metrics', {})),
            'door_event_count': len(analysis_data.get('door_events', []))
        }
        package['analysis_summary'] = summary
        
        anomalies = analysis_data.get('anomalies', [])
        anomaly_dicts = []
        for anomaly in anomalies:
            if isinstance(anomaly, AnomalySegment):
                anomaly_dicts.append(anomaly.to_dict())
            elif isinstance(anomaly, dict):
                anomaly_dicts.append(anomaly)
        package['anomalies'] = anomaly_dicts
        
        metrics = {
            'temperature_metrics': {},
            'door_metrics': {},
            'batch_metrics': {}
        }
        
        temp_metrics = analysis_data.get('temperature_metrics', {})
        for device_id, m in temp_metrics.items():
            if isinstance(m, TemperatureMetrics):
                metrics['temperature_metrics'][device_id] = {
                    'device_id': m.device_id,
                    'total_records': m.total_records,
                    'valid_records': m.valid_records,
                    'missing_records': m.missing_records,
                    'min_temp': m.min_temp,
                    'max_temp': m.max_temp,
                    'mean_temp': m.mean_temp,
                    'median_temp': m.median_temp,
                    'std_temp': m.std_temp,
                    'fluctuation_rate': m.fluctuation_rate,
                    'duration_hours': m.duration_hours
                }
            elif isinstance(m, dict):
                metrics['temperature_metrics'][device_id] = m
        
        door_metrics = analysis_data.get('door_metrics', {})
        for device_id, m in door_metrics.items():
            if isinstance(m, DoorMetrics):
                metrics['door_metrics'][device_id] = {
                    'device_id': m.device_id,
                    'total_openings': m.total_openings,
                    'total_duration_seconds': m.total_duration_seconds,
                    'avg_duration_seconds': m.avg_duration_seconds,
                    'max_duration_seconds': m.max_duration_seconds,
                    'long_openings_count': m.long_openings_count
                }
            elif isinstance(m, dict):
                metrics['door_metrics'][device_id] = m
        
        batch_metrics = analysis_data.get('batch_metrics', {})
        for batch_id, m in batch_metrics.items():
            if isinstance(m, BatchExposureMetrics):
                metrics['batch_metrics'][batch_id] = {
                    'batch_id': m.batch_id,
                    'product_name': m.product_name,
                    'device_id': m.device_id,
                    'total_exposure_duration_seconds': m.total_exposure_duration_seconds,
                    'exposure_during_open_doors_seconds': m.exposure_during_open_doors_seconds,
                    'exposure_during_temperature_anomalies_seconds': m.exposure_during_temperature_anomalies_seconds,
                    'door_events_overlap': m.door_events_overlap,
                    'temperature_anomalies_overlap': m.temperature_anomalies_overlap,
                    'risk_level': m.risk_level
                }
            elif isinstance(m, dict):
                metrics['batch_metrics'][batch_id] = m
        
        package['metrics'] = metrics
        
        config = analysis_data.get('config', {})
        if isinstance(config, RuleConfig):
            package['config'] = asdict(config)
        else:
            package['config'] = config
        
        package['reviews'] = analysis_data.get('reviews', [])
        
        if include_raw_data:
            package['raw_data'] = {
                'temperature_records': analysis_data.get('raw_temperature_records', []),
                'door_events': analysis_data.get('raw_door_events', []),
                'calibration_records': analysis_data.get('raw_calibration_records', []),
                'batch_records': analysis_data.get('raw_batch_records', [])
            }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(package, f, cls=EnhancedJSONEncoder, ensure_ascii=False, indent=2)
        
        return output_path
