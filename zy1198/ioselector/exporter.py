"""
报告导出器 - 导出 Markdown 和 JSON 报告
"""
import json
from typing import Dict, Any, Optional, List
from datetime import datetime
from pathlib import Path

from .models import SimulationResult, AnalysisResult


class ReportExporter:
    """
    报告导出器
    
    支持导出：
    - Markdown 格式报告（适合阅读和分享）
    - JSON 格式报告（适合程序处理）
    """
    
    def export_markdown(self, 
                        result: SimulationResult, 
                        analysis: Optional[AnalysisResult] = None,
                        include_events: bool = True,
                        max_events: int = 100) -> str:
        """
        导出 Markdown 格式报告
        
        Args:
            result: 模拟结果
            analysis: 分析结果（可选）
            include_events: 是否包含事件时间线
            max_events: 最大显示事件数
            
        Returns:
            Markdown 格式字符串
        """
        lines = []
        
        # 标题
        lines.append(f"# IO Selector 模拟报告")
        lines.append("")
        lines.append(f"> 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        # 基本信息
        lines.append("## 基本信息")
        lines.append("")
        lines.append("| 项目 | 值 |")
        lines.append("|------|-----|")
        lines.append(f"| 用例名称 | {result.case_name} |")
        lines.append(f"| 选择器类型 | {result.selector_type.value.upper()} |")
        lines.append(f"| 触发模式 | {self._format_trigger_mode(result.trigger_mode.value)} |")
        lines.append(f"| 模拟时长 | {result.simulation_duration_ms if hasattr(result, 'simulation_duration_ms') else 'N/A'} ms |")
        lines.append(f"| 事件总数 | {len(result.events)} |")
        lines.append("")
        
        # 统计摘要
        lines.append("## 统计摘要")
        lines.append("")
        lines.append("### 唤醒统计")
        lines.append("")
        lines.append("| 指标 | 值 |")
        lines.append("|------|-----|")
        lines.append(f"| 总唤醒次数 | {result.total_wakeups} |")
        lines.append(f"| 有效唤醒 | {result.total_wakeups - result.unnecessary_wakeups} |")
        lines.append(f"| 无效唤醒 | {result.unnecessary_wakeups} |")
        if result.total_wakeups > 0:
            rate = (result.unnecessary_wakeups / result.total_wakeups) * 100
            lines.append(f"| 无效唤醒率 | {rate:.1f}% |")
        lines.append("")
        
        lines.append("### CPU 效率")
        lines.append("")
        lines.append("| 指标 | 值 |")
        lines.append("|------|-----|")
        lines.append(f"| CPU 空转次数 | {result.cpu_spins} |")
        lines.append(f"| fd 扫描次数 | {result.fd_scan_count} |")
        lines.append("")
        
        lines.append("### 问题统计")
        lines.append("")
        lines.append("| 指标 | 值 | 说明 |")
        lines.append("|------|-----|------|")
        lines.append(f"| 漏读次数 | {result.missed_reads} | ⚠️ 严重问题 |")
        lines.append(f"| 惊群事件 | {result.thundering_herd_count} | 性能问题 |")
        lines.append("")
        
        # Worker 统计
        if result.worker_stats:
            lines.append("## Worker 详细统计")
            lines.append("")
            lines.append("| Worker ID | 总唤醒 | 有效唤醒 | 无效唤醒 | 实际读取 |")
            lines.append("|-----------|--------|----------|----------|----------|")
            for worker_id, stats in sorted(result.worker_stats.items()):
                wakeups = stats.get('wakeup_count', 0)
                unnecessary = stats.get('unnecessary_wakeups', 0)
                actual = stats.get('actual_read_count', 0)
                valid = wakeups - unnecessary
                lines.append(f"| {worker_id} | {wakeups} | {valid} | {unnecessary} | {actual} |")
            lines.append("")
        
        # FD 统计
        if result.fd_stats:
            lines.append("## 连接详细统计")
            lines.append("")
            lines.append("| FD | 已读取 | 预期读取 | 剩余数据 | 惊群事件 |")
            lines.append("|----|--------|----------|----------|----------|")
            for fd, stats in sorted(result.fd_stats.items()):
                total_read = stats.get('total_read', 0)
                expected_read = stats.get('expected_read', 0)
                remaining = stats.get('remaining_data', 0)
                herd_count = stats.get('thundering_herd_count', 0)
                lines.append(f"| {fd} | {total_read} | {expected_read} | {remaining} | {herd_count} |")
            lines.append("")
        
        # 分析结果
        if analysis:
            lines.append("## 分析结果")
            lines.append("")
            
            # 总体评级
            rating_emoji = {
                "good": "✅",
                "warning": "⚠️",
                "danger": "❌"
            }.get(analysis.overall_rating, "ℹ️")
            
            rating_text = {
                "good": "良好",
                "warning": "警告",
                "danger": "危险"
            }.get(analysis.overall_rating, "未知")
            
            lines.append(f"### 总体评价: {rating_emoji} {rating_text}")
            lines.append("")
            lines.append("```")
            lines.append(analysis.summary)
            lines.append("```")
            lines.append("")
            
            # CPU 效率
            lines.append(f"### CPU 效率评分: {analysis.cpu_efficiency_score:.1f}/100")
            lines.append("")
            lines.append("#### CPU 空转分析")
            lines.append("```")
            lines.append(analysis.cpu_spin_analysis)
            lines.append("```")
            lines.append("")
            lines.append("#### 唤醒分析")
            lines.append("```")
            lines.append(analysis.unnecessary_wakeup_analysis)
            lines.append("```")
            lines.append("")
            
            # 漏读风险
            lines.append("### 漏读风险分析")
            lines.append("")
            lines.append(f"**风险评估**: {analysis.missed_read_risk}")
            lines.append("")
            if analysis.missed_read_suggestions:
                lines.append("**建议**:")
                lines.append("")
                for i, suggestion in enumerate(analysis.missed_read_suggestions, 1):
                    lines.append(f"{i}. {suggestion}")
                lines.append("")
            
            # 惊群分析
            lines.append("### 惊群效应分析")
            lines.append("")
            lines.append(f"**分析**: {analysis.thundering_herd_analysis}")
            lines.append("")
            if analysis.thundering_herd_suggestions:
                lines.append("**建议**:")
                lines.append("")
                for i, suggestion in enumerate(analysis.thundering_herd_suggestions, 1):
                    lines.append(f"{i}. {suggestion}")
                lines.append("")
            
            # 对比分析
            lines.append("### 技术对比")
            lines.append("")
            lines.append("```")
            lines.append(analysis.comparison_notes)
            lines.append("```")
            lines.append("")
        
        # 事件时间线
        if include_events and result.events:
            lines.append("## 事件时间线")
            lines.append("")
            
            events = result.events[:max_events]
            if len(result.events) > max_events:
                lines.append(f"> 仅显示前 {max_events} 条事件，共 {len(result.events)} 条")
                lines.append("")
            
            lines.append("| 时间(ms) | 类型 | FD | Worker | 详情 |")
            lines.append("|----------|------|-----|--------|------|")
            for event in events:
                worker = event.worker_id if event.worker_id is not None else "-"
                lines.append(f"| {event.timestamp_ms} | {event.event_type.value} | {event.fd} | {worker} | {self._escape_md(event.details)} |")
            lines.append("")
        
        # 术语解释
        lines.append("## 术语解释")
        lines.append("")
        lines.append("### 水平触发 (Level Triggered, LT)")
        lines.append("")
        lines.append("- 只要 fd 上有数据，就会持续通知")
        lines.append("- 可以分次读取数据")
        lines.append("- 安全，不容易漏读")
        lines.append("- 是 select/poll/epoll 的默认模式")
        lines.append("")
        
        lines.append("### 边缘触发 (Edge Triggered, ET)")
        lines.append("")
        lines.append("- 只在 fd 状态变化时通知一次")
        lines.append("- 必须一次性读完所有数据")
        lines.append("- 效率高，但容易漏读")
        lines.append("- 必须配合非阻塞 IO 使用")
        lines.append("")
        
        lines.append("### 惊群效应 (Thundering Herd)")
        lines.append("")
        lines.append("- 多个进程/线程等待同一事件")
        lines.append("- 事件发生时，所有等待者都被唤醒")
        lines.append("- 但只有一个能获取到资源，其他的是空转")
        lines.append("- 导致大量无效的上下文切换")
        lines.append("")
        
        lines.append("### EPOLLEXCLUSIVE")
        lines.append("")
        lines.append("- epoll 的一个标志位")
        lines.append("- 只唤醒一个等待的 worker")
        lines.append("- 有效避免惊群效应")
        lines.append("- Linux 4.5+ 支持")
        lines.append("")
        
        return "\n".join(lines)
    
    def export_json(self, 
                    result: SimulationResult, 
                    analysis: Optional[AnalysisResult] = None,
                    include_events: bool = True) -> str:
        """
        导出 JSON 格式报告
        
        Args:
            result: 模拟结果
            analysis: 分析结果（可选）
            include_events: 是否包含事件时间线
            
        Returns:
            JSON 格式字符串
        """
        data = {
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "case_name": result.case_name,
                "selector_type": result.selector_type.value,
                "trigger_mode": result.trigger_mode.value
            },
            "summary": {
                "total_wakeups": result.total_wakeups,
                "unnecessary_wakeups": result.unnecessary_wakeups,
                "cpu_spins": result.cpu_spins,
                "fd_scan_count": result.fd_scan_count,
                "missed_reads": result.missed_reads,
                "thundering_herd_count": result.thundering_herd_count
            },
            "worker_stats": result.worker_stats,
            "fd_stats": result.fd_stats
        }
        
        if include_events:
            data["events"] = [
                {
                    "timestamp_ms": e.timestamp_ms,
                    "event_type": e.event_type.value,
                    "fd": e.fd,
                    "worker_id": e.worker_id,
                    "details": e.details
                }
                for e in result.events
            ]
        
        if analysis:
            data["analysis"] = {
                "cpu_efficiency_score": analysis.cpu_efficiency_score,
                "cpu_spin_analysis": analysis.cpu_spin_analysis,
                "unnecessary_wakeup_analysis": analysis.unnecessary_wakeup_analysis,
                "missed_read_risk": analysis.missed_read_risk,
                "missed_read_suggestions": analysis.missed_read_suggestions,
                "thundering_herd_analysis": analysis.thundering_herd_analysis,
                "thundering_herd_suggestions": analysis.thundering_herd_suggestions,
                "comparison_notes": analysis.comparison_notes,
                "overall_rating": analysis.overall_rating,
                "summary": analysis.summary
            }
        
        return json.dumps(data, ensure_ascii=False, indent=2)
    
    def save_markdown(self, 
                      filepath: str,
                      result: SimulationResult,
                      analysis: Optional[AnalysisResult] = None,
                      include_events: bool = True,
                      max_events: int = 100) -> None:
        """
        保存 Markdown 报告到文件
        
        Args:
            filepath: 输出文件路径
            result: 模拟结果
            analysis: 分析结果
            include_events: 是否包含事件时间线
            max_events: 最大显示事件数
        """
        content = self.export_markdown(result, analysis, include_events, max_events)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    
    def save_json(self,
                  filepath: str,
                  result: SimulationResult,
                  analysis: Optional[AnalysisResult] = None,
                  include_events: bool = True) -> None:
        """
        保存 JSON 报告到文件
        
        Args:
            filepath: 输出文件路径
            result: 模拟结果
            analysis: 分析结果
            include_events: 是否包含事件时间线
        """
        content = self.export_json(result, analysis, include_events)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    
    def _format_trigger_mode(self, mode: str) -> str:
        """格式化触发模式显示"""
        if mode == "lt":
            return "水平触发 (LT)"
        elif mode == "et":
            return "边缘触发 (ET)"
        return mode
    
    def _escape_md(self, text: str) -> str:
        """转义 Markdown 特殊字符"""
        return text.replace('|', '\\|').replace('\n', ' ')
