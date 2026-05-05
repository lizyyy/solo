"""报告导出器"""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
from dataclasses import asdict

from .models import SimulationResult
from .analyzer import ResultAnalyzer


class ReportExporter:
    """报告导出器"""
    
    def __init__(self, result: SimulationResult):
        self.result = result
        self.analyzer = ResultAnalyzer(result)
    
    def export_json(self, pretty: bool = True) -> str:
        """导出 JSON 格式报告"""
        full_analysis = self.analyzer.get_full_analysis()
        
        # 添加完整时间线
        full_analysis["full_timeline"] = [
            {
                "timestamp": e.timestamp,
                "event_type": e.event_type,
                "worker_id": e.worker_id,
                "task_id": e.task_id,
                "details": e.details,
            }
            for e in self.result.timeline
        ]
        
        if pretty:
            return json.dumps(full_analysis, indent=2, ensure_ascii=False, default=str)
        return json.dumps(full_analysis, ensure_ascii=False, default=str)
    
    def export_markdown(self, include_timeline: bool = False) -> str:
        """导出 Markdown 格式报告"""
        overview = self.analyzer.get_overview()
        worker_details = self.analyzer.get_worker_utilization_details()
        queue_analysis = self.analyzer.get_queue_analysis()
        bottleneck_analysis = self.analyzer.get_bottleneck_analysis()
        suggestions = self.analyzer.get_suggestions_summary()
        
        md = []
        
        # 标题
        md.append("# 线程池模拟报告")
        md.append("")
        md.append(f"**生成时间**: {self._get_timestamp()}")
        md.append("")
        
        # 概览
        md.append("## 1. 模拟概览")
        md.append("")
        
        # 配置摘要
        md.append("### 配置摘要")
        md.append("")
        md.append("| 参数 | 值 |")
        md.append("|------|-----|")
        md.append(f"| Worker 数量 | {self.result.config.worker_count} |")
        md.append(f"| 本地队列容量 | {self.result.config.local_queue_capacity} |")
        md.append(f"| 全局队列容量 | {self.result.config.global_queue_capacity} |")
        md.append(f"| 工作窃取 | {'启用' if self.result.config.use_work_stealing else '禁用'} |")
        md.append(f"| 背压策略 | {self.result.config.backpressure_strategy} |")
        md.append(f"| 模拟时长 | {self.result.config.simulation_duration} |")
        md.append(f"| 随机种子 | {self.result.config.seed or '未设置'} |")
        md.append("")
        
        # 关键指标
        md.append("### 关键指标")
        md.append("")
        md.append("| 指标 | 值 |")
        md.append("|------|-----|")
        md.append(f"| 总任务数 | {overview['total_tasks']} |")
        md.append(f"| 已完成 | {overview['completed_tasks']} |")
        md.append(f"| 已丢弃 | {overview['dropped_tasks']} |")
        md.append(f"| 饥饿任务 | {overview['starved_tasks']} |")
        md.append(f"| 成功率 | {overview['success_rate']:.1%} |")
        md.append(f"| 吞吐量 | {overview['throughput']:.2f} 任务/单位时间 |")
        md.append(f"| 平均等待时间 | {overview['avg_wait_time']:.2f} |")
        md.append(f"| 平均周转时间 | {overview['avg_turnaround_time']:.2f} |")
        md.append(f"| 平均 Worker 利用率 | {overview['avg_worker_utilization']:.1%} |")
        md.append("")
        
        # Worker 详情
        md.append("## 2. Worker 详细统计")
        md.append("")
        
        if worker_details:
            md.append("| Worker ID | 名称 | 状态 | 完成任务 | 窃取任务 | 窃取成功率 | 忙碌时间 | 空闲时间 | 利用率 | 本地队列 |")
            md.append("|-----------|------|------|----------|----------|------------|----------|----------|--------|----------|")
            for w in worker_details:
                md.append(
                    f"| {w['worker_id']} | {w['worker_name']} | {w['state']} | "
                    f"{w['tasks_completed']} | {w['tasks_stolen']} | "
                    f"{w['steal_success_rate']:.1%} | {w['busy_time']:.2f} | "
                    f"{w['idle_time']:.2f} | {w['utilization']:.1%} | "
                    f"{w['local_queue_size']}/{w['local_queue_capacity']} |"
                )
        else:
            md.append("*无 Worker 数据*")
        md.append("")
        
        # 队列分析
        md.append("## 3. 队列分析")
        md.append("")
        
        global_q = queue_analysis["global_queue"]
        md.append("### 全局队列")
        md.append("")
        md.append("| 指标 | 值 |")
        md.append("|------|-----|")
        md.append(f"| 当前大小 | {global_q['current_size']} |")
        md.append(f"| 容量 | {global_q['capacity']} |")
        md.append(f"| 利用率 | {global_q['utilization']:.1%} |")
        md.append(f"| 入队任务数 | {global_q['tasks_queued']} |")
        md.append(f"| 丢弃任务数 | {global_q['tasks_dropped']} |")
        md.append("")
        
        if queue_analysis["local_queues"]:
            md.append("### 本地队列")
            md.append("")
            md.append("| Worker ID | 当前大小 | 容量 | 利用率 |")
            md.append("|-----------|----------|------|--------|")
            for lq in queue_analysis["local_queues"]:
                md.append(
                    f"| {lq['worker_id']} | {lq['current_size']} | "
                    f"{lq['capacity']} | {lq['utilization']:.1%} |"
                )
            md.append("")
        
        md.append(f"**背压策略**: {queue_analysis['backpressure_strategy']}")
        md.append("")
        
        # 瓶颈分析
        md.append("## 4. 瓶颈分析")
        md.append("")
        
        bottlenecks = bottleneck_analysis["bottlenecks"]
        if bottlenecks:
            for b in bottlenecks:
                severity_icon = self._get_severity_icon(b["severity"])
                md.append(f"### {severity_icon} {b['description']}")
                md.append("")
                md.append(f"- **类型**: {b['type']}")
                md.append(f"- **严重程度**: {b['severity']}")
                
                details = b["details"]
                for key, value in details.items():
                    if key != "suggestion":
                        md.append(f"- **{key}**: {value}")
                
                if "suggestion" in details:
                    md.append("")
                    md.append(f"**建议**: {details['suggestion']}")
                md.append("")
        else:
            md.append("*未检测到明显瓶颈*")
        md.append("")
        
        # 调优建议
        md.append("## 5. 调优建议")
        md.append("")
        
        if suggestions:
            for i, s in enumerate(suggestions, 1):
                severity_icon = self._get_severity_icon(s["severity"])
                md.append(f"### {severity_icon} 建议 {i}: {s['suggestion']}")
                md.append("")
                md.append(f"- **类别**: {s['category']}")
                md.append(f"- **严重程度**: {s['severity']}")
                md.append(f"- **当前值**: {s['current_value']}")
                md.append(f"- **推荐值**: {s['recommended_value']}")
                md.append(f"- **预期改进**: {s['expected_improvement']}")
                md.append("")
        else:
            md.append("*无调优建议，当前配置表现良好*")
        md.append("")
        
        # 时间线（可选）
        if include_timeline:
            timeline_summary = self.analyzer.get_timeline_summary(max_events=50)
            if timeline_summary:
                md.append("## 6. 事件时间线（摘要）")
                md.append("")
                md.append("| 时间 | 事件类型 | Worker | 任务 | 详情 |")
                md.append("|------|----------|--------|------|------|")
                for event in timeline_summary:
                    details_str = str(event["details"]) if event["details"] else ""
                    md.append(
                        f"| {event['timestamp']:.2f} | {event['event_type']} | "
                        f"{event['worker_id'] or '-'} | {event['task_id'] or '-'} | {details_str[:50]} |"
                    )
                md.append("")
        
        # 页脚
        md.append("---")
        md.append("")
        md.append(f"*由 tpsim 线程池模拟器生成*")
        
        return "\n".join(md)
    
    def _get_severity_icon(self, severity: str) -> str:
        """获取严重程度图标"""
        icons = {
            "critical": "🔴",
            "warning": "🟡",
            "info": "🔵",
        }
        return icons.get(severity, "⚪")
    
    def _get_timestamp(self) -> str:
        """获取当前时间戳"""
        from datetime import datetime
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    def export_to_file(self, file_path: Union[str, Path], format: str = "markdown",
                       include_timeline: bool = False, pretty: bool = True):
        """导出到文件
        
        Args:
            file_path: 输出文件路径
            format: 输出格式 ('markdown', 'json')
            include_timeline: 是否包含详细时间线（仅 Markdown）
            pretty: 是否美化输出（仅 JSON）
        """
        file_path = Path(file_path)
        
        if format == "json":
            content = self.export_json(pretty=pretty)
        else:  # markdown
            content = self.export_markdown(include_timeline=include_timeline)
        
        # 确保目录存在
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(content, encoding="utf-8")
