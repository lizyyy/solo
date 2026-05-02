from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional, Dict, Any
import json
import csv
import io
from pathlib import Path

from models import (
    AnalysisResult, AnomalyEvent,
    OverThresholdWindow, SuddenPeak,
    SensorOfflinePeriod, ComplaintEvidence,
    AnomalyType, SeverityLevel
)
from utils.state_manager import ReviewState, StateManager


class ReportExporter:
    """报告导出器"""
    
    def __init__(self):
        self.export_time = datetime.now()
    
    def generate_markdown_report(self,
                                   analysis_result: AnalysisResult,
                                   review_state: Optional[ReviewState] = None,
                                   include_evidence: bool = True) -> str:
        """生成Markdown格式的复核报告"""
        lines = []
        
        lines.append("# 施工噪声投诉复核报告")
        lines.append("")
        lines.append(f"**报告生成时间**: {self.export_time.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"**分析ID**: {analysis_result.analysis_id}")
        lines.append("")
        
        lines.append("## 一、数据概览")
        lines.append("")
        
        lines.append("### 1.1 数据来源")
        lines.append(f"- 噪声监测站点: {', '.join(analysis_result.noise_data_sites) if analysis_result.noise_data_sites else '无'}")
        lines.append(f"- 气象监测站点: {', '.join(analysis_result.weather_data_sites) if analysis_result.weather_data_sites else '无'}")
        lines.append(f"- 投诉记录数: {analysis_result.total_complaints}")
        lines.append("")
        
        lines.append("### 1.2 阈值配置")
        threshold_config = analysis_result.threshold_config
        lines.append(f"- 昼间噪声阈值: {threshold_config.get('daytime_threshold', 60)} dB")
        lines.append(f"- 夜间噪声阈值: {threshold_config.get('nighttime_threshold', 50)} dB")
        lines.append(f"- 夜间时段: {threshold_config.get('nighttime_hours', '22:00 - 06:00')}")
        lines.append("")
        
        lines.append("## 二、异常事件统计")
        lines.append("")
        
        stats = analysis_result.statistics
        
        lines.append(f"### 2.1 总体异常")
        lines.append(f"- 总异常事件数: {stats.get('total_anomaly_events', 0)}")
        lines.append(f"- 超标窗口数: {stats.get('total_over_threshold_windows', 0)}")
        lines.append(f"- 突增峰值数: {stats.get('total_sudden_peaks', 0)}")
        lines.append(f"- 传感器离线次数: {stats.get('total_sensor_offlines', 0)}")
        lines.append("")
        
        if 'anomaly_by_type' in stats:
            lines.append("### 2.2 异常类型分布")
            lines.append("")
            lines.append("| 异常类型 | 数量 |")
            lines.append("|---------|------|")
            for anomaly_type, count in stats['anomaly_by_type'].items():
                type_name = self._get_anomaly_type_name(anomaly_type)
                lines.append(f"| {type_name} | {count} |")
            lines.append("")
        
        if 'site_statistics' in stats and stats['site_statistics']:
            lines.append("### 2.3 各站点统计")
            lines.append("")
            lines.append("| 站点 | 超标窗口 | 突增峰值 | 离线次数 | 最大超标(dB) | 最大突增(dB) |")
            lines.append("|------|---------|---------|---------|-------------|-------------|")
            for site_id, site_stats in stats['site_statistics'].items():
                lines.append(f"| {site_id} | "
                            f"{site_stats.get('over_threshold_windows', 0)} | "
                            f"{site_stats.get('sudden_peaks', 0)} | "
                            f"{site_stats.get('sensor_offlines', 0)} | "
                            f"{site_stats.get('max_exceedance', '-')} | "
                            f"{site_stats.get('max_peak_increase', '-')} |")
            lines.append("")
        
        lines.append("## 三、投诉复核情况")
        lines.append("")
        
        if 'complaint_recommendations' in stats:
            rec_stats = stats['complaint_recommendations']
            lines.append("### 3.1 复核建议分布")
            lines.append(f"- 建议确认: {rec_stats.get('confirmed', 0)}")
            lines.append(f"- 建议驳回: {rec_stats.get('dismissed', 0)}")
            lines.append(f"- 建议进一步核查: {rec_stats.get('further_review', 0)}")
            lines.append("")
        
        if analysis_result.complaint_evidences:
            lines.append("### 3.2 投诉详情")
            lines.append("")
            
            for idx, evidence in enumerate(analysis_result.complaint_evidences, 1):
                lines.append(f"#### 投诉 {idx}: {evidence.complaint_id}")
                lines.append(f"- 投诉时间: {evidence.complaint_time.strftime('%Y-%m-%d %H:%M:%S')}")
                lines.append(f"- 关联站点: {evidence.site_id}")
                lines.append(f"- 分析窗口: {evidence.analysis_window_start.strftime('%H:%M:%S')} - {evidence.analysis_window_end.strftime('%H:%M:%S')}")
                lines.append("")
                lines.append(f"**证据摘要**: {evidence.summary}")
                lines.append("")
                
                lines.append("**发现的问题**:")
                issues = []
                if evidence.has_exceedance:
                    issues.append(f"- 噪声超标: {evidence.exceedance_details.get('window_count', 0)}个窗口")
                if evidence.has_sudden_peak:
                    issues.append(f"- 突增峰值: {evidence.peak_details.get('peak_count', 0)}个峰值")
                if evidence.has_sensor_offline:
                    issues.append(f"- 传感器离线: {evidence.offline_details.get('offline_count', 0)}个时段")
                if evidence.has_weather_interference:
                    issues.append(f"- 天气干扰: 存在")
                
                if issues:
                    for issue in issues:
                        lines.append(issue)
                else:
                    lines.append("- 无明显异常")
                lines.append("")
                
                rec_text = self._get_recommendation_text(evidence.recommendation)
                lines.append(f"**复核建议**: {rec_text}")
                lines.append("")
                lines.append("---")
                lines.append("")
        
        if include_evidence and analysis_result.anomaly_events:
            lines.append("## 四、异常事件详情")
            lines.append("")
            
            for anomaly in analysis_result.anomaly_events:
                type_name = self._get_anomaly_type_name(anomaly.event_type.value)
                severity_name = self._get_severity_name(anomaly.severity.value)
                
                lines.append(f"### {type_name} - {anomaly.event_id}")
                lines.append(f"- 站点: {anomaly.site_id}")
                lines.append(f"- 时间: {anomaly.start_time.strftime('%Y-%m-%d %H:%M:%S')} - {anomaly.end_time.strftime('%H:%M:%S')}")
                lines.append(f"- 严重程度: {severity_name}")
                lines.append(f"- 描述: {anomaly.description}")
                
                if anomaly.related_complaints:
                    lines.append(f"- 关联投诉: {', '.join(anomaly.related_complaints)}")
                
                lines.append("")
        
        if review_state:
            lines.append("## 五、复核记录")
            lines.append("")
            
            review_stats = review_state.get_statistics()
            lines.append(f"- 复核人: {review_state.reviewer_name or '未指定'}")
            lines.append(f"- 已复核投诉数: {review_stats.get('total_complaints_reviewed', 0)}")
            lines.append(f"- 已验证异常数: {review_stats.get('total_anomalies_verified', 0)}")
            lines.append("")
            
            if review_state.complaint_reviews:
                lines.append("### 5.1 投诉复核详情")
                lines.append("")
                
                for complaint_id, review in review_state.complaint_reviews.items():
                    status_text = self._get_review_status_text(review.get('status', 'pending'))
                    lines.append(f"#### 投诉 {complaint_id}")
                    lines.append(f"- 复核状态: {status_text}")
                    lines.append(f"- 复核人: {review.get('reviewer_name', '-')}")
                    lines.append(f"- 复核时间: {review.get('reviewed_at', '-')}")
                    
                    if review.get('notes'):
                        lines.append(f"- 复核备注: {review['notes']}")
                    
                    lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*此报告由施工噪声投诉复核台自动生成*")
        
        return "\n".join(lines)
    
    def export_events_to_csv(self,
                              analysis_result: AnalysisResult,
                              output_path: Optional[str] = None) -> str:
        """导出事件表为CSV格式"""
        output = io.StringIO()
        
        fieldnames = [
            'event_id', 'event_type', 'site_id', 'start_time', 'end_time',
            'duration_minutes', 'severity', 'description', 'max_value',
            'threshold', 'increase_amount', 'related_complaints'
        ]
        
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        
        for window in analysis_result.over_threshold_windows:
            writer.writerow({
                'event_id': window.window_id,
                'event_type': 'over_threshold',
                'site_id': window.site_id,
                'start_time': window.start_time.strftime('%Y-%m-%d %H:%M:%S'),
                'end_time': window.end_time.strftime('%Y-%m-%d %H:%M:%S'),
                'duration_minutes': f"{window.duration_minutes:.2f}",
                'severity': 'high' if window.max_value - window.threshold > 10 else 'medium',
                'description': f'噪声超标: {window.max_value:.1f}dB > {window.threshold:.1f}dB',
                'max_value': f"{window.max_value:.1f}",
                'threshold': f"{window.threshold:.1f}",
                'increase_amount': '',
                'related_complaints': ','.join(window.related_complaints)
            })
        
        for peak in analysis_result.sudden_peaks:
            writer.writerow({
                'event_id': peak.peak_id,
                'event_type': 'sudden_peak',
                'site_id': peak.site_id,
                'start_time': peak.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                'end_time': (peak.timestamp.timestamp() + peak.duration_seconds).strftime('%Y-%m-%d %H:%M:%S'),
                'duration_minutes': f"{peak.duration_seconds/60:.2f}",
                'severity': 'critical' if peak.increase_amount > 25 else 'high' if peak.increase_amount > 20 else 'medium',
                'description': f'噪声突增: +{peak.increase_amount:.1f}dB',
                'max_value': f"{peak.peak_value:.1f}",
                'threshold': '',
                'increase_amount': f"{peak.increase_amount:.1f}",
                'related_complaints': ''
            })
        
        for offline in analysis_result.sensor_offline_periods:
            writer.writerow({
                'event_id': offline.period_id,
                'event_type': 'sensor_offline',
                'site_id': offline.site_id,
                'start_time': offline.start_time.strftime('%Y-%m-%d %H:%M:%S'),
                'end_time': offline.end_time.strftime('%Y-%m-%d %H:%M:%S'),
                'duration_minutes': f"{offline.duration_minutes:.2f}",
                'severity': 'high' if offline.duration_minutes > 60 else 'medium',
                'description': f'传感器离线: 缺失{offline.missing_count}个采样',
                'max_value': '',
                'threshold': '',
                'increase_amount': '',
                'related_complaints': ''
            })
        
        csv_content = output.getvalue()
        
        if output_path:
            with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
                f.write(csv_content)
        
        return csv_content
    
    def export_audit_package(self,
                               analysis_result: AnalysisResult,
                               review_state: Optional[ReviewState] = None,
                               output_path: Optional[str] = None) -> str:
        """导出JSON审计包"""
        audit_data = {
            'audit_export_time': self.export_time.isoformat(),
            'analysis_id': analysis_result.analysis_id,
            'analysis_time': analysis_result.analysis_time.isoformat(),
            'data_sources': {
                'noise_sites': analysis_result.noise_data_sites,
                'weather_sites': analysis_result.weather_data_sites,
                'total_complaints': analysis_result.total_complaints
            },
            'threshold_config': analysis_result.threshold_config,
            'statistics': analysis_result.statistics,
            'anomaly_events': [e.to_dict() for e in analysis_result.anomaly_events],
            'over_threshold_windows': [w.to_dict() for w in analysis_result.over_threshold_windows],
            'sudden_peaks': [p.to_dict() for p in analysis_result.sudden_peaks],
            'sensor_offline_periods': [o.to_dict() for o in analysis_result.sensor_offline_periods],
            'complaint_evidences': [e.to_dict() for e in analysis_result.complaint_evidences]
        }
        
        if review_state:
            audit_data['review_state'] = review_state.to_dict()
            audit_data['review_statistics'] = review_state.get_statistics()
        
        json_content = json.dumps(audit_data, ensure_ascii=False, indent=2, default=str)
        
        if output_path:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(json_content)
        
        return json_content
    
    def _get_anomaly_type_name(self, anomaly_type: str) -> str:
        """获取异常类型的中文名称"""
        type_names = {
            'over_threshold': '噪声超标',
            'sudden_peak': '突增峰值',
            'sensor_offline': '传感器离线',
            'missing_data': '数据缺失',
            'weather_interference': '天气干扰'
        }
        return type_names.get(anomaly_type, anomaly_type)
    
    def _get_severity_name(self, severity: str) -> str:
        """获取严重程度的中文名称"""
        severity_names = {
            'low': '低',
            'medium': '中',
            'high': '高',
            'critical': '严重'
        }
        return severity_names.get(severity, severity)
    
    def _get_recommendation_text(self, recommendation: str) -> str:
        """获取复核建议的中文文本"""
        rec_texts = {
            'confirmed': '确认超标 - 存在明确的噪声超标证据',
            'dismissed': '驳回 - 未发现明显噪声异常或存在天气干扰',
            'further_review': '进一步核查 - 存在离线时段或天气干扰，需现场核实'
        }
        return rec_texts.get(recommendation, recommendation)
    
    def _get_review_status_text(self, status: str) -> str:
        """获取复核状态的中文文本"""
        status_texts = {
            'pending': '待复核',
            'reviewing': '复核中',
            'confirmed': '已确认',
            'dismissed': '已驳回',
            'uncertain': '存疑'
        }
        return status_texts.get(status, status)
