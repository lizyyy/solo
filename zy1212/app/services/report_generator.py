from typing import List, Dict, Any, Optional
from datetime import datetime
import json
from app.schemas.common import (
    SLOStatusEnum,
)


class ReportGenerator:
    
    @staticmethod
    def format_number(num: Optional[float], decimals: int = 2) -> str:
        if num is None:
            return "N/A"
        if isinstance(num, int):
            return f"{num}"
        return f"{num:.{decimals}f}"
    
    @staticmethod
    def format_percent(ratio: Optional[float]) -> str:
        if ratio is None:
            return "N/A"
        return f"{ratio * 100:.2f}%"
    
    @staticmethod
    def generate_markdown_batch_report(
        project_name: str,
        batch: Dict[str, Any],
        monitoring_snapshots: Optional[List[Dict[str, Any]]] = None,
        slo_evaluation: Optional[Dict[str, Any]] = None,
        bottleneck_analysis: Optional[List[Dict[str, Any]]] = None,
        related_actions: Optional[List[Dict[str, Any]]] = None,
        recommendations: Optional[List[str]] = None,
    ) -> str:
        if monitoring_snapshots is None:
            monitoring_snapshots = []
        if recommendations is None:
            recommendations = []
        
        lines = []
        
        lines.append(f"# 压测批次复盘报告\n")
        lines.append(f"**项目**: {project_name}  \n")
        lines.append(f"**批次**: {batch.get('name', 'N/A')} (批次 #{batch.get('batch_number', 'N/A')})  \n")
        lines.append(f"**测试类型**: {batch.get('test_type', 'N/A')}  \n")
        lines.append(f"**环境**: {batch.get('environment', 'N/A')}  \n")
        
        start_time = batch.get('start_time')
        end_time = batch.get('end_time')
        if start_time and end_time:
            if isinstance(start_time, datetime):
                start_str = start_time.strftime('%Y-%m-%d %H:%M:%S')
            else:
                start_str = str(start_time)
            if isinstance(end_time, datetime):
                end_str = end_time.strftime('%Y-%m-%d %H:%M:%S')
            else:
                end_str = str(end_time)
            lines.append(f"**测试时段**: {start_str} - {end_str}  \n")
        
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        
        lines.append("## 1. 执行概览\n")
        lines.append("| 指标 | 数值 |\n")
        lines.append("|------|------|\n")
        lines.append(f"| 总请求数 | {batch.get('total_requests', 'N/A')} |\n")
        lines.append(f"| 成功请求数 | {batch.get('total_requests', 0) - batch.get('failed_requests', 0)} |\n")
        lines.append(f"| 失败请求数 | {batch.get('failed_requests', 'N/A')} |\n")
        lines.append(f"| 错误率 | {ReportGenerator.format_percent(batch.get('error_rate'))} |\n")
        lines.append(f"| 状态 | {batch.get('status', 'N/A')} |\n\n")
        
        lines.append("## 2. 性能指标\n")
        lines.append("### 2.1 QPS/TPS\n")
        lines.append("| 指标 | 数值 |\n")
        lines.append("|------|------|\n")
        lines.append(f"| QPS | {ReportGenerator.format_number(batch.get('qps'))} |\n")
        lines.append(f"| TPS | {ReportGenerator.format_number(batch.get('tps'))} |\n")
        lines.append(f"| 吞吐量 | {ReportGenerator.format_number(batch.get('throughput_bytes_per_sec'))} 字节/秒 |\n\n")
        
        lines.append("### 2.2 响应时间\n")
        lines.append("| 指标 | 数值 (ms) |\n")
        lines.append("|------|-----------|\n")
        lines.append(f"| 平均 | {ReportGenerator.format_number(batch.get('avg_response_time_ms'))} |\n")
        lines.append(f"| 最小 | {ReportGenerator.format_number(batch.get('min_response_time_ms'))} |\n")
        lines.append(f"| 最大 | {ReportGenerator.format_number(batch.get('max_response_time_ms'))} |\n")
        lines.append(f"| P50 | {ReportGenerator.format_number(batch.get('p50_response_time_ms'))} |\n")
        lines.append(f"| P95 | {ReportGenerator.format_number(batch.get('p95_response_time_ms'))} |\n")
        lines.append(f"| P99 | {ReportGenerator.format_number(batch.get('p99_response_time_ms'))} |\n\n")
        
        lines.append("### 2.3 容量利用率\n")
        lines.append("| 指标 | 数值 |\n")
        lines.append("|------|------|\n")
        lines.append(f"| 容量利用率 | {ReportGenerator.format_number(batch.get('capacity_utilization_percent'))}% |\n\n")
        
        if monitoring_snapshots:
            lines.append("## 3. 监控快照\n")
            for i, snapshot in enumerate(monitoring_snapshots, 1):
                lines.append(f"### 3.{i} {snapshot.get('name', '快照')}\n")
                lines.append("| 指标 | 数值 |\n")
                lines.append("|------|------|\n")
                
                snapshot_time = snapshot.get('snapshot_time')
                if snapshot_time:
                    if isinstance(snapshot_time, datetime):
                        time_str = snapshot_time.strftime('%Y-%m-%d %H:%M:%S')
                    else:
                        time_str = str(snapshot_time)
                    lines.append(f"| 快照时间 | {time_str} |\n")
                
                cpu_util = snapshot.get('cpu_utilization_percent')
                if cpu_util is not None:
                    lines.append(f"| CPU利用率 | {cpu_util:.2f}% |\n")
                
                memory_util = snapshot.get('memory_utilization_percent')
                if memory_util is not None:
                    lines.append(f"| 内存利用率 | {memory_util:.2f}% |\n")
                
                db_latency = snapshot.get('database_query_latency_ms')
                if db_latency is not None:
                    lines.append(f"| 数据库查询延迟 | {db_latency:.2f}ms |\n")
                
                cache_hit_rate = snapshot.get('cache_hit_rate')
                if cache_hit_rate is not None:
                    lines.append(f"| 缓存命中率 | {cache_hit_rate:.2f}% |\n")
                
                lines.append("\n")
        
        if slo_evaluation:
            lines.append("## 4. SLO 评估\n")
            
            status = slo_evaluation.get('status')
            status_icon = "✅" if status == SLOStatusEnum.passed else "⚠️" if status == SLOStatusEnum.warning else "❌"
            
            lines.append(f"**评估结果**: {status_icon} {slo_evaluation.get('summary', 'N/A')}\n\n")
            
            violations = slo_evaluation.get('violations', [])
            if violations:
                lines.append("### 4.1 违规项\n")
                for i, violation in enumerate(violations, 1):
                    lines.append(f"{i}. ❌ {violation}\n")
                lines.append("\n")
            
            warnings = slo_evaluation.get('warnings', [])
            if warnings:
                lines.append("### 4.2 警告项\n")
                for i, warning in enumerate(warnings, 1):
                    lines.append(f"{i}. ⚠️ {warning}\n")
                lines.append("\n")
        
        if bottleneck_analysis:
            lines.append("## 5. 瓶颈分析\n")
            
            for i, bottleneck in enumerate(bottleneck_analysis, 1):
                severity = bottleneck.get('severity', 'medium')
                severity_icon = "🔴" if severity == "critical" else "🟠" if severity == "high" else "🟡" if severity == "medium" else "🟢"
                
                lines.append(f"### 5.{i} {severity_icon} {bottleneck.get('bottleneck_type', '瓶颈')} - {severity.upper()}\n")
                lines.append(f"**描述**: {bottleneck.get('description', 'N/A')}\n\n")
                
                affected_metrics = bottleneck.get('affected_metrics', [])
                if affected_metrics:
                    lines.append(f"**影响指标**: {', '.join(affected_metrics)}\n\n")
                
                recommended_actions = bottleneck.get('recommended_actions', [])
                if recommended_actions:
                    lines.append("**建议行动**:\n")
                    for j, action in enumerate(recommended_actions, 1):
                        lines.append(f"{j}. {action}\n")
                lines.append("\n")
        
        if related_actions:
            lines.append("## 6. 关联调优动作\n")
            for i, action in enumerate(related_actions, 1):
                status = action.get('status', 'pending')
                status_icon = "⏳" if status == "pending" else "🔄" if status == "in_progress" else "✅" if status in ["implemented", "verified"] else "❌"
                
                lines.append(f"### 6.{i} {status_icon} {action.get('title', '调优动作')}\n")
                lines.append(f"**类型**: {action.get('action_type', 'N/A')}  \n")
                lines.append(f"**状态**: {status}  \n")
                lines.append(f"**优先级**: {action.get('priority', 'N/A')}  \n")
                
                description = action.get('description')
                if description:
                    lines.append(f"\n**描述**: {description}\n")
                
                assigned_to = action.get('assigned_to')
                if assigned_to:
                    lines.append(f"**负责人**: {assigned_to}  \n")
                
                lines.append("\n")
        
        if recommendations:
            lines.append("## 7. 建议与总结\n")
            lines.append("### 7.1 主要建议\n")
            for i, rec in enumerate(recommendations, 1):
                lines.append(f"{i}. {rec}\n")
            lines.append("\n")
        
        lines.append("---\n")
        lines.append(f"*报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*\n")
        
        return "\n".join(lines)
    
    @staticmethod
    def generate_markdown_baseline_comparison(
        project_name: str,
        baseline_batch: Dict[str, Any],
        current_batch: Dict[str, Any],
        comparison_result: Dict[str, Any],
    ) -> str:
        lines = []
        
        lines.append(f"# 基线对比报告\n")
        lines.append(f"**项目**: {project_name}\n\n")
        
        lines.append("## 1. 批次信息\n")
        lines.append("| 批次 | 名称 | 批次号 | 测试类型 | 环境 |\n")
        lines.append("|------|------|--------|----------|------|\n")
        lines.append(f"| 基线 | {baseline_batch.get('name', 'N/A')} | #{baseline_batch.get('batch_number', 'N/A')} | {baseline_batch.get('test_type', 'N/A')} | {baseline_batch.get('environment', 'N/A')} |\n")
        lines.append(f"| 当前 | {current_batch.get('name', 'N/A')} | #{current_batch.get('batch_number', 'N/A')} | {current_batch.get('test_type', 'N/A')} | {current_batch.get('environment', 'N/A')} |\n\n")
        
        overall_status = comparison_result.get('overall_status', 'stable')
        status_icon = "🚀" if overall_status == "improved" else "⚠️" if overall_status == "warning" else "🔴" if overall_status == "degraded" else "➡️"
        
        lines.append("## 2. 总体评估\n")
        lines.append(f"**状态**: {status_icon} {overall_status.upper()}\n")
        lines.append(f"**摘要**: {comparison_result.get('summary', 'N/A')}\n\n")
        
        lines.append("## 3. 指标对比\n")
        lines.append("| 指标 | 基线值 | 当前值 | 变化(%) | 状态 |\n")
        lines.append("|------|--------|--------|---------|------|\n")
        
        all_comparisons = comparison_result.get('all_comparisons', [])
        for comp in all_comparisons:
            change = comp.get('change_percent', 0)
            change_str = f"{change:+.2f}%"
            is_improvement = comp.get('is_improvement', False)
            status = "✅ 改善" if is_improvement else "❌ 下降"
            
            lines.append(f"| {comp.get('metric_name', 'N/A')} | {comp.get('baseline_value', 'N/A')} | {comp.get('current_value', 'N/A')} | {change_str} | {status} |\n")
        
        lines.append("\n")
        
        improvements = comparison_result.get('improvements', [])
        if improvements:
            lines.append("## 4. 改善项\n")
            for i, imp in enumerate(improvements, 1):
                change = imp.get('change_percent', 0)
                lines.append(f"{i}. ✅ **{imp.get('metric_name')}**: 基线 {imp.get('baseline_value')} → 当前 {imp.get('current_value')} ({change:+.2f}%)\n")
            lines.append("\n")
        
        regressions = comparison_result.get('regressions', [])
        if regressions:
            lines.append("## 5. 下降项\n")
            for i, reg in enumerate(regressions, 1):
                change = reg.get('change_percent', 0)
                lines.append(f"{i}. ❌ **{reg.get('metric_name')}**: 基线 {reg.get('baseline_value')} → 当前 {reg.get('current_value')} ({change:+.2f}%)\n")
            lines.append("\n")
        
        lines.append("---\n")
        lines.append(f"*报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*\n")
        
        return "\n".join(lines)
    
    @staticmethod
    def generate_full_review_report(
        project_name: str,
        project: Dict[str, Any],
        batches: List[Dict[str, Any]],
        machine_capacities: List[Dict[str, Any]],
        optimization_actions: List[Dict[str, Any]],
        slo_evaluation: Optional[Dict[str, Any]] = None,
        baseline_comparison: Optional[Dict[str, Any]] = None,
    ) -> str:
        lines = []
        
        lines.append(f"# 压测复盘完整报告\n")
        lines.append(f"## 项目概览\n")
        lines.append(f"**项目名称**: {project_name}\n")
        lines.append(f"**服务名称**: {project.get('service_name', 'N/A')}\n")
        lines.append(f"**环境**: {project.get('environment', 'N/A')}\n")
        lines.append(f"**描述**: {project.get('description', 'N/A')}\n\n")
        
        lines.append("## 测试执行摘要\n")
        lines.append(f"| 指标 | 数值 |\n")
        lines.append(f"|------|------|\n")
        lines.append(f"| 总压测批次 | {len(batches)} |\n")
        
        if batches:
            total_requests = sum(b.get('total_requests', 0) for b in batches)
            total_failed = sum(b.get('failed_requests', 0) for b in batches)
            avg_error_rate = total_failed / total_requests if total_requests > 0 else 0
            
            lines.append(f"| 总请求数 | {total_requests} |\n")
            lines.append(f"| 总失败请求 | {total_failed} |\n")
            lines.append(f"| 平均错误率 | {ReportGenerator.format_percent(avg_error_rate)} |\n")
        
        lines.append("\n")
        
        lines.append("## 机器容量\n")
        if machine_capacities:
            lines.append("| 机器名称 | 类型 | CPU核心 | 内存(GB) | 预估最大QPS |\n")
            lines.append("|----------|------|---------|-----------|-------------|\n")
            for mc in machine_capacities:
                lines.append(f"| {mc.get('name', 'N/A')} | {mc.get('machine_type', 'N/A')} | {mc.get('cpu_cores', 'N/A')} | {mc.get('memory_gb', 'N/A')} | {mc.get('max_qps_estimated', 'N/A')} |\n")
        else:
            lines.append("*暂无机器容量数据*\n")
        lines.append("\n")
        
        lines.append("## 调优动作跟踪\n")
        if optimization_actions:
            status_counts: Dict[str, int] = {}
            for action in optimization_actions:
                status = action.get('status', 'pending')
                status_counts[status] = status_counts.get(status, 0) + 1
            
            lines.append("### 状态统计\n")
            lines.append("| 状态 | 数量 |\n")
            lines.append("|------|------|\n")
            for status, count in status_counts.items():
                lines.append(f"| {status} | {count} |\n")
            lines.append("\n")
            
            lines.append("### 动作详情\n")
            for i, action in enumerate(optimization_actions, 1):
                status = action.get('status', 'pending')
                status_icon = "⏳" if status == "pending" else "🔄" if status == "in_progress" else "✅" if status in ["implemented", "verified"] else "❌"
                
                lines.append(f"{i}. {status_icon} **{action.get('title', '调优动作')}**\n")
                lines.append(f"   - 类型: {action.get('action_type', 'N/A')}\n")
                lines.append(f"   - 优先级: {action.get('priority', 'N/A')}\n")
                lines.append(f"   - 状态: {status}\n")
                if action.get('assigned_to'):
                    lines.append(f"   - 负责人: {action.get('assigned_to')}\n")
                lines.append("\n")
        else:
            lines.append("*暂无调优动作*\n")
        
        lines.append("---\n")
        lines.append(f"*报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*\n")
        
        return "\n".join(lines)
    
    @staticmethod
    def to_json(obj: Any) -> str:
        def default_converter(o):
            if isinstance(o, datetime):
                return o.isoformat()
            if hasattr(o, 'dict'):
                return o.dict()
            if hasattr(o, '__dict__'):
                return o.__dict__
            return str(o)
        
        return json.dumps(obj, default=default_converter, ensure_ascii=False, indent=2)
