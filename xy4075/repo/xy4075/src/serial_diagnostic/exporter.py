import json
import csv
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, Union
from pathlib import Path
from datetime import datetime
from collections import defaultdict

from .models import ParsedSession, ParsedFrame, ProtocolConfig
from .analyzer import AnalysisResult, Anomaly, AnomalyType, AnomalySeverity
from .replay import ReplayStats, ReplayEvent
from .state_machine import StateTransition
from .fault_injection import InjectionResult


class BaseExporter(ABC):
    @abstractmethod
    def export(self, output_path: Union[str, Path]) -> None:
        pass


class MarkdownExporter(BaseExporter):
    def __init__(self, analysis_result: AnalysisResult,
                 session: Optional[ParsedSession] = None,
                 replay_stats: Optional[ReplayStats] = None,
                 protocol_config: Optional[ProtocolConfig] = None):
        self.analysis = analysis_result
        self.session = session
        self.replay_stats = replay_stats
        self.config = protocol_config
        self._generate_time = datetime.now()
    
    def export(self, output_path: Union[str, Path]) -> None:
        path = Path(output_path)
        content = self._generate_content()
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
    
    def _generate_content(self) -> str:
        lines = []
        
        lines.append("# 串口协议诊断报告")
        lines.append("")
        lines.append(f"> 生成时间: {self._generate_time.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        lines.append("## 1. 概览")
        lines.append("")
        lines.append("### 1.1 会话信息")
        lines.append("")
        lines.append(f"| 项目 | 值 |")
        lines.append(f"|------|-----|")
        lines.append(f"| 会话ID | {self.analysis.session_id} |")
        lines.append(f"| 总帧数 | {self.analysis.total_frames} |")
        lines.append(f"| 有效帧 | {self.analysis.valid_frames} |")
        lines.append(f"| 无效帧 | {self.analysis.invalid_frames} |")
        lines.append(f"| 异常总数 | {self.analysis.anomaly_count} |")
        lines.append("")
        
        if self.session:
            lines.append("### 1.2 时间统计")
            lines.append("")
            lines.append(f"| 项目 | 值 |")
            lines.append(f"|------|-----|")
            lines.append(f"| 会话持续时间 | {self.session.duration:.3f} 秒 |")
            if self.session.duration > 0:
                lines.append(f"| 平均帧率 | {self.session.frame_count / self.session.duration:.2f} 帧/秒 |")
            lines.append("")
        
        lines.append("### 1.3 异常分布")
        lines.append("")
        
        if self.analysis.stats.get('by_type'):
            lines.append("#### 按类型分布")
            lines.append("")
            lines.append(f"| 异常类型 | 数量 |")
            lines.append(f"|----------|------|")
            for anomaly_type, count in self.analysis.stats['by_type'].items():
                lines.append(f"| {anomaly_type} | {count} |")
            lines.append("")
        
        if self.analysis.stats.get('by_severity'):
            lines.append("#### 按严重程度分布")
            lines.append("")
            lines.append(f"| 严重程度 | 数量 |")
            lines.append(f"|----------|------|")
            for severity, count in self.analysis.stats['by_severity'].items():
                lines.append(f"| {severity} | {count} |")
            lines.append("")
        
        critical_anomalies = self.analysis.get_critical_anomalies()
        high_anomalies = self.analysis.get_high_anomalies()
        
        if critical_anomalies or high_anomalies:
            lines.append("## 2. 关键异常")
            lines.append("")
            
            if critical_anomalies:
                lines.append("### 2.1 严重异常 (Critical)")
                lines.append("")
                for idx, anomaly in enumerate(critical_anomalies, 1):
                    lines.append(f"#### 异常 #{idx}: {anomaly.anomaly_type.value}")
                    lines.append("")
                    lines.append(f"- **时间戳**: {anomaly.timestamp:.6f}")
                    lines.append(f"- **帧索引**: {anomaly.frame_index}")
                    lines.append(f"- **严重程度**: {anomaly.severity.value}")
                    lines.append(f"- **描述**: {anomaly.message}")
                    if anomaly.details:
                        lines.append(f"- **详细信息**:")
                        for key, value in anomaly.details.items():
                            lines.append(f"  - {key}: {value}")
                    if anomaly.recommendations:
                        lines.append(f"- **建议**:")
                        for rec in anomaly.recommendations:
                            lines.append(f"  - {rec}")
                    lines.append("")
            
            if high_anomalies:
                lines.append("### 2.2 高优先级异常 (High)")
                lines.append("")
                for idx, anomaly in enumerate(high_anomalies, 1):
                    lines.append(f"#### 异常 #{idx}: {anomaly.anomaly_type.value}")
                    lines.append("")
                    lines.append(f"- **时间戳**: {anomaly.timestamp:.6f}")
                    lines.append(f"- **帧索引**: {anomaly.frame_index}")
                    lines.append(f"- **严重程度**: {anomaly.severity.value}")
                    lines.append(f"- **描述**: {anomaly.message}")
                    if anomaly.details:
                        lines.append(f"- **详细信息**:")
                        for key, value in anomaly.details.items():
                            lines.append(f"  - {key}: {value}")
                    if anomaly.recommendations:
                        lines.append(f"- **建议**:")
                        for rec in anomaly.recommendations:
                            lines.append(f"  - {rec}")
                    lines.append("")
        
        all_anomalies = [
            a for a in self.analysis.anomalies 
            if a.severity not in [AnomalySeverity.CRITICAL, AnomalySeverity.HIGH]
        ]
        
        if all_anomalies:
            lines.append("## 3. 其他异常")
            lines.append("")
            lines.append("| 序号 | 类型 | 严重程度 | 帧索引 | 描述 |")
            lines.append("|------|------|----------|--------|------|")
            for idx, anomaly in enumerate(all_anomalies, 1):
                frame_idx = anomaly.frame_index if anomaly.frame_index is not None else "-"
                lines.append(f"| {idx} | {anomaly.anomaly_type.value} | {anomaly.severity.value} | {frame_idx} | {anomaly.message[:60]}... |")
            lines.append("")
        
        if self.analysis.state_machine_history:
            lines.append("## 4. 状态机历史")
            lines.append("")
            lines.append("| 序号 | 源状态 | 目标状态 | 触发器 | 时间戳 | 有效 |")
            lines.append("|------|--------|----------|--------|--------|------|")
            for idx, trans in enumerate(self.analysis.state_machine_history, 1):
                valid = "✓" if trans.is_valid else "✗"
                lines.append(f"| {idx} | {trans.from_state} | {trans.to_state} | {trans.trigger} | {trans.timestamp:.6f} | {valid} |")
            lines.append("")
            
            invalid_trans = [t for t in self.analysis.state_machine_history if not t.is_valid]
            if invalid_trans:
                lines.append("### 4.1 无效状态迁移详情")
                lines.append("")
                for idx, trans in enumerate(invalid_trans, 1):
                    lines.append(f"#### 无效迁移 #{idx}")
                    lines.append("")
                    lines.append(f"- **源状态**: {trans.from_state}")
                    lines.append(f"- **目标状态**: {trans.to_state}")
                    lines.append(f"- **触发器**: {trans.trigger}")
                    lines.append(f"- **错误信息**: {trans.error_message}")
                    lines.append("")
        
        if self.replay_stats:
            lines.append("## 5. 回放统计")
            lines.append("")
            lines.append(f"| 项目 | 值 |")
            lines.append(f"|------|-----|")
            lines.append(f"| 总帧数 | {self.replay_stats.total_frames} |")
            lines.append(f"| 已处理帧数 | {self.replay_stats.processed_frames} |")
            lines.append(f"| 丢弃帧数 | {self.replay_stats.dropped_frames} |")
            lines.append(f"| 重复帧数 | {self.replay_stats.duplicated_frames} |")
            lines.append(f"| 损坏帧数 | {self.replay_stats.corrupted_frames} |")
            lines.append(f"| 超时次数 | {self.replay_stats.timeout_count} |")
            lines.append(f"| 状态迁移数 | {self.replay_stats.state_transitions} |")
            lines.append(f"| 无效迁移数 | {self.replay_stats.invalid_transitions} |")
            lines.append(f"| 命中断点数 | {self.replay_stats.breakpoints_hit} |")
            lines.append(f"| 注入故障数 | {self.replay_stats.injections_applied} |")
            lines.append(f"| 错误数 | {self.replay_stats.errors_count} |")
            if self.replay_stats.start_time and self.replay_stats.end_time:
                lines.append(f"| 回放耗时 | {self.replay_stats.duration:.3f} 秒 |")
            lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*此报告由串口协议回放诊断台自动生成*")
        
        return "\n".join(lines)


class CSVExporter(BaseExporter):
    def __init__(self, analysis_result: AnalysisResult):
        self.analysis = analysis_result
    
    def export(self, output_path: Union[str, Path]) -> None:
        path = Path(output_path)
        
        fieldnames = [
            'id', 'anomaly_type', 'severity', 'timestamp', 'frame_index',
            'related_frame_index', 'message', 'details_json',
            'recommendations_json'
        ]
        
        with open(path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for idx, anomaly in enumerate(self.analysis.anomalies, 1):
                row = {
                    'id': idx,
                    'anomaly_type': anomaly.anomaly_type.value,
                    'severity': anomaly.severity.value,
                    'timestamp': anomaly.timestamp,
                    'frame_index': anomaly.frame_index if anomaly.frame_index is not None else '',
                    'related_frame_index': anomaly.related_frame_index if anomaly.related_frame_index is not None else '',
                    'message': anomaly.message,
                    'details_json': json.dumps(anomaly.details, ensure_ascii=False),
                    'recommendations_json': json.dumps(anomaly.recommendations, ensure_ascii=False),
                }
                writer.writerow(row)


class JSONExporter(BaseExporter):
    def __init__(self, analysis_result: AnalysisResult,
                 session: Optional[ParsedSession] = None,
                 replay_stats: Optional[ReplayStats] = None,
                 replay_events: Optional[List[ReplayEvent]] = None,
                 injection_results: Optional[List[InjectionResult]] = None,
                 state_transitions: Optional[List[StateTransition]] = None):
        self.analysis = analysis_result
        self.session = session
        self.replay_stats = replay_stats
        self.replay_events = replay_events
        self.injection_results = injection_results
        self.state_transitions = state_transitions
    
    def export(self, output_path: Union[str, Path]) -> None:
        path = Path(output_path)
        data = self._generate_data()
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False, default=str)
    
    def _generate_data(self) -> Dict[str, Any]:
        data: Dict[str, Any] = {
            'version': '1.0',
            'generated_at': datetime.now().isoformat(),
            'session_id': self.analysis.session_id,
            'analysis': {
                'total_frames': self.analysis.total_frames,
                'valid_frames': self.analysis.valid_frames,
                'invalid_frames': self.analysis.invalid_frames,
                'anomaly_count': self.analysis.anomaly_count,
                'stats': self.analysis.stats,
                'anomalies': [
                    {
                        'type': a.anomaly_type.value,
                        'severity': a.severity.value,
                        'timestamp': a.timestamp,
                        'frame_index': a.frame_index,
                        'related_frame_index': a.related_frame_index,
                        'message': a.message,
                        'details': a.details,
                        'recommendations': a.recommendations
                    }
                    for a in self.analysis.anomalies
                ]
            }
        }
        
        if self.session:
            data['session'] = {
                'session_id': self.session.session_id,
                'start_time': self.session.start_time,
                'end_time': self.session.end_time,
                'duration': self.session.duration,
                'frame_count': self.session.frame_count,
                'metadata': self.session.metadata,
                'frames': [
                    {
                        'timestamp': f.timestamp,
                        'direction': f.direction.value,
                        'slave_address': f.slave_address,
                        'function_code': f.function_code,
                        'register_address': f.register_address,
                        'register_count': f.register_count,
                        'raw_data_hex': f.raw_data.hex() if f.raw_data else None,
                        'data_hex': f.data.hex() if f.data else None,
                        'crc': f.crc,
                        'valid': f.validation_result.is_valid if f.validation_result else None,
                        'errors': f.validation_result.errors if f.validation_result else [],
                        'warnings': f.validation_result.warnings if f.validation_result else [],
                        'metadata': f.metadata
                    }
                    for f in self.session.frames
                ]
            }
        
        if self.replay_stats:
            data['replay_stats'] = {
                'total_frames': self.replay_stats.total_frames,
                'processed_frames': self.replay_stats.processed_frames,
                'dropped_frames': self.replay_stats.dropped_frames,
                'duplicated_frames': self.replay_stats.duplicated_frames,
                'corrupted_frames': self.replay_stats.corrupted_frames,
                'timeout_count': self.replay_stats.timeout_count,
                'state_transitions': self.replay_stats.state_transitions,
                'invalid_transitions': self.replay_stats.invalid_transitions,
                'breakpoints_hit': self.replay_stats.breakpoints_hit,
                'injections_applied': self.replay_stats.injections_applied,
                'errors_count': self.replay_stats.errors_count,
                'start_time': self.replay_stats.start_time,
                'end_time': self.replay_stats.end_time,
                'duration': self.replay_stats.duration
            }
        
        if self.replay_events:
            data['replay_events'] = [
                {
                    'event_type': e.event_type,
                    'timestamp': e.timestamp,
                    'frame_index': e.frame_index,
                    'message': e.message,
                    'metadata': e.metadata
                }
                for e in self.replay_events
            ]
        
        if self.injection_results:
            data['injection_results'] = [
                {
                    'frame_index': r.frame_index,
                    'fault_type': r.fault_type.value,
                    'config_name': r.config_name,
                    'applied': r.applied,
                    'message': r.message
                }
                for r in self.injection_results
            ]
        
        if self.state_transitions:
            data['state_transitions'] = [
                {
                    'from_state': t.from_state,
                    'to_state': t.to_state,
                    'trigger': t.trigger,
                    'timestamp': t.timestamp,
                    'type': t.transition_type.value,
                    'is_valid': t.is_valid,
                    'error_message': t.error_message
                }
                for t in self.state_transitions
            ]
        
        return data


class ReportExporter:
    def __init__(self, analysis_result: AnalysisResult,
                 session: Optional[ParsedSession] = None,
                 replay_stats: Optional[ReplayStats] = None,
                 replay_events: Optional[List[ReplayEvent]] = None,
                 injection_results: Optional[List[InjectionResult]] = None,
                 state_transitions: Optional[List[StateTransition]] = None,
                 protocol_config: Optional[ProtocolConfig] = None):
        self.analysis = analysis_result
        self.session = session
        self.replay_stats = replay_stats
        self.replay_events = replay_events
        self.injection_results = injection_results
        self.state_transitions = state_transitions
        self.config = protocol_config
    
    def export_markdown(self, output_path: Union[str, Path]) -> None:
        exporter = MarkdownExporter(
            self.analysis, self.session, self.replay_stats, self.config
        )
        exporter.export(output_path)
    
    def export_csv(self, output_path: Union[str, Path]) -> None:
        exporter = CSVExporter(self.analysis)
        exporter.export(output_path)
    
    def export_json(self, output_path: Union[str, Path]) -> None:
        exporter = JSONExporter(
            self.analysis, self.session, self.replay_stats,
            self.replay_events, self.injection_results, self.state_transitions
        )
        exporter.export(output_path)
    
    def export_all(self, base_path: Union[str, Path]) -> Dict[str, Path]:
        base = Path(base_path)
        paths = {}
        
        md_path = base.with_suffix('.md')
        self.export_markdown(md_path)
        paths['markdown'] = md_path
        
        csv_path = base.with_suffix('.csv')
        self.export_csv(csv_path)
        paths['csv'] = csv_path
        
        json_path = base.with_suffix('.json')
        self.export_json(json_path)
        paths['json'] = json_path
        
        return paths
