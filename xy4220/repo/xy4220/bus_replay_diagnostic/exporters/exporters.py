"""
导出模块 - 用于导出Markdown故障报告、CSV异常片段和JSON审计包
"""
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field, asdict
from datetime import datetime
import json
import csv
import os


def _get_attr(obj: Any, key: str, default: Any = None) -> Any:
    """
    获取属性，支持字典和对象
    
    Args:
        obj: 字典或对象
        key: 属性名/键名
        default: 默认值
        
    Returns:
        属性值
    """
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


@dataclass
class ExportContext:
    """导出上下文"""
    project_name: str = "未知项目"
    analysis_time: str = ""
    total_frames: int = 0
    total_sensors: int = 0
    total_commands: int = 0
    time_range: Dict[str, float] = field(default_factory=dict)
    anomalies: List[Any] = field(default_factory=list)
    state_transitions: List[Any] = field(default_factory=list)
    synchronization_info: Dict[str, Any] = field(default_factory=dict)
    additional_info: Dict[str, Any] = field(default_factory=dict)


class MarkdownExporter:
    """Markdown故障报告导出器"""
    
    def __init__(self):
        """初始化Markdown导出器"""
        pass
    
    def export(self, context: ExportContext, output_path: str):
        """
        导出Markdown故障报告
        
        Args:
            context: 导出上下文
            output_path: 输出文件路径
        """
        markdown_content = self._generate_report(context)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(markdown_content)
        
        print(f"Markdown报告已导出到: {output_path}")
    
    def _generate_report(self, context: ExportContext) -> str:
        """
        生成Markdown报告内容
        
        Args:
            context: 导出上下文
            
        Returns:
            Markdown内容字符串
        """
        lines = []
        
        # 标题
        lines.append("# 总线回放诊断报告")
        lines.append("")
        lines.append(f"**项目名称**: {context.project_name}")
        lines.append(f"**分析时间**: {context.analysis_time}")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        # 概览
        lines.append("## 1. 数据概览")
        lines.append("")
        lines.append("### 1.1 数据统计")
        lines.append("")
        lines.append("| 数据类型 | 数量 |")
        lines.append("|----------|------|")
        lines.append(f"| CAN帧 | {context.total_frames} |")
        lines.append(f"| 传感器数据 | {context.total_sensors} |")
        lines.append(f"| 控制指令 | {context.total_commands} |")
        lines.append("")
        
        if context.time_range:
            lines.append("### 1.2 时间范围")
            lines.append("")
            lines.append(f"- **开始时间**: {context.time_range.get('start', 'N/A')} 秒")
            lines.append(f"- **结束时间**: {context.time_range.get('end', 'N/A')} 秒")
            lines.append(f"- **持续时间**: {context.time_range.get('duration', 'N/A')} 秒")
            lines.append("")
        
        # 同步信息
        if context.synchronization_info:
            lines.append("## 2. 时钟同步分析")
            lines.append("")
            
            sync_quality = context.synchronization_info.get('synchronization_quality', 0)
            lines.append(f"### 2.1 同步质量: {sync_quality:.2%}")
            lines.append("")
            
            drift_info = context.synchronization_info.get('drift_info', {})
            if drift_info:
                lines.append("### 2.2 各数据源漂移情况")
                lines.append("")
                lines.append("| 数据源 | 平均漂移 | 最大漂移 | 同步状态 |")
                lines.append("|--------|----------|----------|----------|")
                
                for source, info in drift_info.items():
                    avg_drift = info.get('average_drift', 0)
                    max_drift = info.get('max_drift', 0)
                    is_synced = info.get('is_synchronized', False)
                    status = "✓ 已同步" if is_synced else "✗ 未同步"
                    
                    lines.append(f"| {source} | {avg_drift:.6f}s | {max_drift:.6f}s | {status} |")
                lines.append("")
        
        # 异常分析
        lines.append("## 3. 异常分析")
        lines.append("")
        
        if context.anomalies:
            # 按严重程度分类
            severity_counts = {}
            type_counts = {}
            
            for anomaly in context.anomalies:
                severity = getattr(anomaly, 'severity', 'unknown')
                severity_value = severity.value if hasattr(severity, 'value') else str(severity)
                severity_counts[severity_value] = severity_counts.get(severity_value, 0) + 1
                
                anomaly_type = getattr(anomaly, 'anomaly_type', 'unknown')
                type_value = anomaly_type.value if hasattr(anomaly_type, 'value') else str(anomaly_type)
                type_counts[type_value] = type_counts.get(type_value, 0) + 1
            
            lines.append("### 3.1 异常统计")
            lines.append("")
            lines.append(f"**总异常数**: {len(context.anomalies)}")
            lines.append("")
            
            lines.append("#### 按严重程度")
            lines.append("")
            for severity, count in severity_counts.items():
                lines.append(f"- **{severity}**: {count} 个")
            lines.append("")
            
            lines.append("#### 按异常类型")
            lines.append("")
            for anomaly_type, count in type_counts.items():
                lines.append(f"- **{anomaly_type}**: {count} 个")
            lines.append("")
            
            # 详细异常列表
            lines.append("### 3.2 异常详情")
            lines.append("")
            
            # 按严重程度排序
            sorted_anomalies = sorted(
                context.anomalies,
                key=lambda x: self._severity_order(getattr(x, 'severity', 'unknown'))
            )
            
            for i, anomaly in enumerate(sorted_anomalies, 1):
                severity = getattr(anomaly, 'severity', 'unknown')
                severity_value = severity.value if hasattr(severity, 'value') else str(severity)
                anomaly_type = getattr(anomaly, 'anomaly_type', 'unknown')
                type_value = anomaly_type.value if hasattr(anomaly_type, 'value') else str(anomaly_type)
                timestamp = getattr(anomaly, 'timestamp', 'N/A')
                description = getattr(anomaly, 'description', '无描述')
                source = getattr(anomaly, 'source', '未知')
                
                lines.append(f"#### 3.2.{i} [{severity_value.upper()}] {type_value}")
                lines.append("")
                lines.append(f"- **时间戳**: {timestamp} 秒")
                lines.append(f"- **来源**: {source}")
                lines.append(f"- **描述**: {description}")
                
                # 异常数据
                data = getattr(anomaly, 'data', {})
                if data:
                    lines.append("")
                    lines.append("**详细数据**:")
                    lines.append("")
                    lines.append("```json")
                    lines.append(json.dumps(data, indent=2, ensure_ascii=False, default=str))
                    lines.append("```")
                
                lines.append("")
            
        else:
            lines.append("### 3.1 异常统计")
            lines.append("")
            lines.append("**未检测到异常**")
            lines.append("")
        
        # 状态机分析
        if context.state_transitions:
            lines.append("## 4. 状态机分析")
            lines.append("")
            
            # 按节点分组
            node_transitions = {}
            for transition in context.state_transitions:
                node_id = _get_attr(transition, 'node_id', 'unknown')
                if node_id not in node_transitions:
                    node_transitions[node_id] = []
                node_transitions[node_id].append(transition)
            
            for node_id, transitions in node_transitions.items():
                lines.append(f"### 4.1 节点: {node_id}")
                lines.append("")
                lines.append(f"**状态转换次数**: {len(transitions)}")
                lines.append("")
                
                if transitions:
                    lines.append("| 时间戳 | 从状态 | 到状态 | 触发事件 |")
                    lines.append("|--------|--------|--------|----------|")
                    
                    for transition in transitions:
                        timestamp = _get_attr(transition, 'timestamp', 'N/A')
                        from_state = _get_attr(transition, 'from_state', 'unknown')
                        to_state = _get_attr(transition, 'to_state', 'unknown')
                        trigger = _get_attr(transition, 'trigger', 'unknown')
                        
                        if isinstance(timestamp, (int, float)):
                            timestamp_str = f"{timestamp:.6f}s"
                        else:
                            timestamp_str = str(timestamp)
                        
                        lines.append(f"| {timestamp_str} | {from_state} | {to_state} | {trigger} |")
                    
                    lines.append("")
        
        # 附加信息
        if context.additional_info:
            lines.append("## 5. 附加信息")
            lines.append("")
            
            for key, value in context.additional_info.items():
                lines.append(f"### 5.1 {key}")
                lines.append("")
                if isinstance(value, dict):
                    lines.append("```json")
                    lines.append(json.dumps(value, indent=2, ensure_ascii=False, default=str))
                    lines.append("```")
                else:
                    lines.append(str(value))
                lines.append("")
        
        # 页脚
        lines.append("---")
        lines.append("")
        lines.append(f"*报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*")
        
        return "\n".join(lines)
    
    def _severity_order(self, severity) -> int:
        """
        获取严重程度的排序值
        
        Args:
            severity: 严重程度
            
        Returns:
            排序值，越小越严重
        """
        severity_value = severity.value if hasattr(severity, 'value') else str(severity)
        order = {
            'critical': 0,
            'high': 1,
            'medium': 2,
            'low': 3,
            'unknown': 4
        }
        return order.get(severity_value.lower(), 4)


class CSVExporter:
    """CSV异常片段导出器"""
    
    def __init__(self):
        """初始化CSV导出器"""
        pass
    
    def export(self, anomalies: List[Any], output_path: str, 
               include_related_frames: bool = True):
        """
        导出CSV异常片段
        
        Args:
            anomalies: 异常列表
            output_path: 输出文件路径
            include_related_frames: 是否包含相关帧
        """
        if not anomalies:
            print("没有异常可导出")
            return
        
        # 准备CSV数据
        rows = []
        
        # 表头
        headers = [
            "anomaly_id",
            "anomaly_type",
            "severity",
            "timestamp",
            "source",
            "description",
            "data_json"
        ]
        
        if include_related_frames:
            headers.append("related_frames_json")
        
        for anomaly in anomalies:
            row = {
                "anomaly_id": _get_attr(anomaly, 'anomaly_id', ''),
                "anomaly_type": self._get_enum_value(_get_attr(anomaly, 'anomaly_type', '')),
                "severity": self._get_enum_value(_get_attr(anomaly, 'severity', '')),
                "timestamp": _get_attr(anomaly, 'timestamp', ''),
                "source": _get_attr(anomaly, 'source', ''),
                "description": _get_attr(anomaly, 'description', ''),
                "data_json": json.dumps(_get_attr(anomaly, 'data', {}), ensure_ascii=False, default=str)
            }
            
            if include_related_frames:
                related_frames = _get_attr(anomaly, 'related_frames', [])
                # 简化相关帧数据
                simplified_frames = []
                for frame in related_frames:
                    simplified = {
                        "timestamp": _get_attr(frame, 'timestamp', None),
                        "can_id": _get_attr(frame, 'can_id', None),
                        "dlc": _get_attr(frame, 'dlc', None),
                        "data": _get_attr(frame, 'data', None)
                    }
                    simplified_frames.append(simplified)
                
                row["related_frames_json"] = json.dumps(simplified_frames, ensure_ascii=False, default=str)
            
            rows.append(row)
        
        # 写入CSV文件
        with open(output_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            writer.writerows(rows)
        
        print(f"CSV异常片段已导出到: {output_path}")
    
    def _get_enum_value(self, enum_obj) -> str:
        """
        获取枚举值
        
        Args:
            enum_obj: 枚举对象或字符串
            
        Returns:
            字符串值
        """
        if hasattr(enum_obj, 'value'):
            return enum_obj.value
        return str(enum_obj)


class JSONExporter:
    """JSON审计包导出器"""
    
    def __init__(self):
        """初始化JSON导出器"""
        pass
    
    def export(self, context: ExportContext, output_path: str, 
               include_raw_data: bool = False):
        """
        导出JSON审计包
        
        Args:
            context: 导出上下文
            output_path: 输出文件路径
            include_raw_data: 是否包含原始数据
        """
        audit_package = self._build_audit_package(context, include_raw_data)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(audit_package, f, indent=2, ensure_ascii=False, default=str)
        
        print(f"JSON审计包已导出到: {output_path}")
    
    def _build_audit_package(self, context: ExportContext, 
                              include_raw_data: bool) -> Dict[str, Any]:
        """
        构建审计包
        
        Args:
            context: 导出上下文
            include_raw_data: 是否包含原始数据
            
        Returns:
            审计包字典
        """
        package = {
            "version": "1.0.0",
            "generated_at": datetime.now().isoformat(),
            "project_info": {
                "name": context.project_name,
                "analysis_time": context.analysis_time
            },
            "data_summary": {
                "total_frames": context.total_frames,
                "total_sensors": context.total_sensors,
                "total_commands": context.total_commands,
                "time_range": context.time_range
            },
            "synchronization": self._simplify_sync_info(context.synchronization_info),
            "anomalies": self._simplify_anomalies(context.anomalies),
            "state_transitions": self._simplify_transitions(context.state_transitions)
        }
        
        if include_raw_data:
            package["raw_data"] = {
                "additional_info": context.additional_info
            }
        
        return package
    
    def _simplify_sync_info(self, sync_info: Dict[str, Any]) -> Dict[str, Any]:
        """
        简化同步信息
        
        Args:
            sync_info: 原始同步信息
            
        Returns:
            简化后的同步信息
        """
        if not sync_info:
            return {}
        
        simplified = {
            "reference_source": sync_info.get('reference_source'),
            "synchronization_quality": sync_info.get('synchronization_quality'),
            "time_range": sync_info.get('time_range'),
            "drift_info": {}
        }
        
        drift_info = sync_info.get('drift_info', {})
        for source, info in drift_info.items():
            simplified["drift_info"][source] = {
                "source_name": _get_attr(info, 'source_name'),
                "average_drift": _get_attr(info, 'average_drift'),
                "max_drift": _get_attr(info, 'max_drift'),
                "min_drift": _get_attr(info, 'min_drift'),
                "total_drift": _get_attr(info, 'total_drift'),
                "drift_rate": _get_attr(info, 'drift_rate'),
                "is_synchronized": _get_attr(info, 'is_synchronized')
            }
        
        return simplified
    
    def _simplify_anomalies(self, anomalies: List[Any]) -> List[Dict[str, Any]]:
        """
        简化异常列表
        
        Args:
            anomalies: 原始异常列表
            
        Returns:
            简化后的异常列表
        """
        simplified = []
        
        for anomaly in anomalies:
            item = {
                "anomaly_id": _get_attr(anomaly, 'anomaly_id', ''),
                "anomaly_type": self._get_enum_value(_get_attr(anomaly, 'anomaly_type', '')),
                "severity": self._get_enum_value(_get_attr(anomaly, 'severity', '')),
                "timestamp": _get_attr(anomaly, 'timestamp', None),
                "source": _get_attr(anomaly, 'source', ''),
                "description": _get_attr(anomaly, 'description', ''),
                "data": _get_attr(anomaly, 'data', {})
            }
            simplified.append(item)
        
        return simplified
    
    def _simplify_transitions(self, transitions: List[Any]) -> List[Dict[str, Any]]:
        """
        简化状态转换列表
        
        Args:
            transitions: 原始状态转换列表
            
        Returns:
            简化后的状态转换列表
        """
        simplified = []
        
        for transition in transitions:
            item = {
                "node_id": _get_attr(transition, 'node_id', ''),
                "timestamp": _get_attr(transition, 'timestamp', None),
                "from_state": _get_attr(transition, 'from_state', ''),
                "to_state": _get_attr(transition, 'to_state', ''),
                "trigger": _get_attr(transition, 'trigger', ''),
                "data": _get_attr(transition, 'data', {})
            }
            simplified.append(item)
        
        return simplified
    
    def _get_enum_value(self, enum_obj) -> str:
        """
        获取枚举值
        
        Args:
            enum_obj: 枚举对象或字符串
            
        Returns:
            字符串值
        """
        if hasattr(enum_obj, 'value'):
            return enum_obj.value
        return str(enum_obj)


class ExporterManager:
    """导出管理器"""
    
    def __init__(self):
        """初始化导出管理器"""
        self.markdown_exporter = MarkdownExporter()
        self.csv_exporter = CSVExporter()
        self.json_exporter = JSONExporter()
    
    def export_all(self, context: ExportContext, output_dir: str,
                   markdown_filename: str = "diagnostic_report.md",
                   csv_filename: str = "anomalies.csv",
                   json_filename: str = "audit_package.json"):
        """
        导出所有格式
        
        Args:
            context: 导出上下文
            output_dir: 输出目录
            markdown_filename: Markdown文件名
            csv_filename: CSV文件名
            json_filename: JSON文件名
        """
        # 确保输出目录存在
        os.makedirs(output_dir, exist_ok=True)
        
        # 导出Markdown报告
        markdown_path = os.path.join(output_dir, markdown_filename)
        self.markdown_exporter.export(context, markdown_path)
        
        # 导出CSV异常片段
        csv_path = os.path.join(output_dir, csv_filename)
        self.csv_exporter.export(context.anomalies, csv_path)
        
        # 导出JSON审计包
        json_path = os.path.join(output_dir, json_filename)
        self.json_exporter.export(context, json_path)
        
        print(f"\n所有文件已导出到目录: {output_dir}")
