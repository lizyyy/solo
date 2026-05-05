from typing import List, Dict, Any, Optional
from datetime import datetime
from app.schemas.common import (
    BottleneckAnalysis,
    NextLoadTestPlan,
)


class BottleneckAnalyzer:
    
    @staticmethod
    def analyze_bottlenecks(
        batch_metrics: Dict[str, Any],
        monitoring_snapshots: Optional[List[Dict[str, Any]]] = None,
        slo_evaluation: Optional[Dict[str, Any]] = None
    ) -> List[BottleneckAnalysis]:
        bottlenecks = []
        
        if monitoring_snapshots is None:
            monitoring_snapshots = []
        
        cpu_high_threshold = 80
        cpu_critical_threshold = 90
        memory_high_threshold = 80
        memory_critical_threshold = 90
        
        for snapshot in monitoring_snapshots:
            cpu_util = snapshot.get("cpu_utilization_percent")
            if cpu_util is not None:
                if cpu_util >= cpu_critical_threshold:
                    bottlenecks.append(BottleneckAnalysis(
                        bottleneck_type="CPU",
                        severity="critical",
                        description=f"CPU利用率达到 {cpu_util:.2f}%，超过临界阈值 {cpu_critical_threshold}%",
                        affected_metrics=["qps", "response_time", "error_rate"],
                        recommended_actions=[
                            "增加 CPU 核心数",
                            "优化 CPU 密集型代码",
                            "增加服务实例数量",
                            "检查是否存在死循环或低效算法"
                        ]
                    ))
                elif cpu_util >= cpu_high_threshold:
                    bottlenecks.append(BottleneckAnalysis(
                        bottleneck_type="CPU",
                        severity="high",
                        description=f"CPU利用率达到 {cpu_util:.2f}%，超过阈值 {cpu_high_threshold}%",
                        affected_metrics=["qps", "response_time"],
                        recommended_actions=[
                            "优化 CPU 密集型代码",
                            "考虑增加服务实例",
                            "检查热点代码路径"
                        ]
                    ))
            
            memory_util = snapshot.get("memory_utilization_percent")
            if memory_util is not None:
                if memory_util >= memory_critical_threshold:
                    bottlenecks.append(BottleneckAnalysis(
                        bottleneck_type="Memory",
                        severity="critical",
                        description=f"内存利用率达到 {memory_util:.2f}%，超过临界阈值 {memory_critical_threshold}%",
                        affected_metrics=["response_time", "error_rate", "throughput"],
                        recommended_actions=[
                            "增加内存容量",
                            "检查内存泄漏",
                            "优化大对象创建",
                            "调整 JVM/GC 参数（如适用）"
                        ]
                    ))
                elif memory_util >= memory_high_threshold:
                    bottlenecks.append(BottleneckAnalysis(
                        bottleneck_type="Memory",
                        severity="high",
                        description=f"内存利用率达到 {memory_util:.2f}%，超过阈值 {memory_high_threshold}%",
                        affected_metrics=["response_time"],
                        recommended_actions=[
                            "检查内存使用情况",
                            "考虑优化对象创建和销毁",
                            "增加内存或调整配置"
                        ]
                    ))
            
            db_latency = snapshot.get("database_query_latency_ms")
            if db_latency is not None and db_latency > 100:
                bottlenecks.append(BottleneckAnalysis(
                    bottleneck_type="Database",
                    severity="high",
                    description=f"数据库查询延迟较高：{db_latency:.2f}ms",
                    affected_metrics=["response_time", "qps"],
                    recommended_actions=[
                        "优化 SQL 查询",
                        "添加适当的索引",
                        "检查数据库连接池配置",
                        "考虑引入缓存层",
                        "分析慢查询日志"
                    ]
                ))
            
            cache_hit_rate = snapshot.get("cache_hit_rate")
            if cache_hit_rate is not None and cache_hit_rate < 70:
                bottlenecks.append(BottleneckAnalysis(
                    bottleneck_type="Cache",
                    severity="medium",
                    description=f"缓存命中率较低：{cache_hit_rate:.2f}%",
                    affected_metrics=["response_time", "database_load"],
                    recommended_actions=[
                        "优化缓存 key 设计",
                        "调整缓存过期策略",
                        "增加缓存容量",
                        "检查热点数据缓存情况"
                    ]
                ))
        
        error_rate = batch_metrics.get("error_rate", 0)
        if error_rate > 0.05:
            bottlenecks.append(BottleneckAnalysis(
                bottleneck_type="ErrorRate",
                severity="high",
                description=f"错误率较高：{error_rate*100:.2f}%",
                affected_metrics=["tps", "availability"],
                recommended_actions=[
                    "分析错误日志",
                    "检查错误类型分布",
                    "排查是否有服务熔断或降级",
                    "验证错误处理逻辑"
                ]
            ))
        
        p95_response = batch_metrics.get("p95_response_time_ms")
        if p95_response is not None and p95_response > 1000:
            bottlenecks.append(BottleneckAnalysis(
                bottleneck_type="ResponseTime",
                severity="high",
                description=f"P95 响应时间较高：{p95_response:.2f}ms",
                affected_metrics=["user_experience", "slo_compliance"],
                recommended_actions=[
                    "分析慢请求分布",
                    "检查是否有阻塞调用",
                    "考虑异步处理非核心逻辑",
                    "优化关键路径"
                ]
            ))
        
        if not bottlenecks:
            bottlenecks.append(BottleneckAnalysis(
                bottleneck_type="None",
                severity="low",
                description="未发现明显的性能瓶颈",
                affected_metrics=[],
                recommended_actions=[
                    "继续监控性能指标",
                    "考虑更高压力的压测",
                    "优化现有测试覆盖率"
                ]
            ))
        
        return bottlenecks
    
    @staticmethod
    def generate_next_test_plan(
        batch_metrics: Dict[str, Any],
        bottlenecks: List[BottleneckAnalysis],
        baseline_comparison: Optional[Dict[str, Any]] = None,
        slo_evaluation: Optional[Dict[str, Any]] = None
    ) -> NextLoadTestPlan:
        suggested_changes = []
        expected_improvements = []
        
        critical_bottlenecks = [b for b in bottlenecks if b.severity == "critical"]
        high_bottlenecks = [b for b in bottlenecks if b.severity == "high"]
        
        for bottleneck in critical_bottlenecks:
            suggested_changes.extend(bottleneck.recommended_actions[:2])
        
        for bottleneck in high_bottlenecks:
            suggested_changes.extend(bottleneck.recommended_actions[:1])
        
        if "qps" in batch_metrics:
            current_qps = batch_metrics["qps"]
            if current_qps > 0:
                next_qps_target = current_qps * 1.5
                suggested_changes.append(f"考虑将目标 QPS 提升至 {next_qps_target:.0f}（当前 {current_qps:.0f} 的 1.5 倍）")
                expected_improvements.append("验证系统在更高压力下的表现")
        
        if baseline_comparison:
            status = baseline_comparison.get("overall_status")
            if status == "improved":
                suggested_changes.append("上一轮优化有效果，继续保持当前优化方向")
                expected_improvements.append("巩固并扩大优化成果")
            elif status == "degraded":
                suggested_changes.append("需要先解决上一轮出现的性能下降问题")
                expected_improvements.append("恢复到基线水平")
        
        if slo_evaluation and not slo_evaluation.get("passed", True):
            suggested_changes.append("需要优先解决 SLO 违规问题")
            expected_improvements.append("确保所有 SLO 指标符合要求")
        
        if not suggested_changes:
            suggested_changes = [
                "保持当前压测策略",
                "考虑更长时间的稳定性测试",
                "增加并发用户数进行压力测试"
            ]
        
        if not expected_improvements:
            expected_improvements = [
                "验证系统稳定性",
                "确认无性能回归",
                "建立新的性能基线"
            ]
        
        cpu_bottleneck = any(b.bottleneck_type == "CPU" and b.severity in ["critical", "high"] for b in bottlenecks)
        memory_bottleneck = any(b.bottleneck_type == "Memory" and b.severity in ["critical", "high"] for b in bottlenecks)
        
        if cpu_bottleneck or memory_bottleneck:
            recommended_test_type = "diagnostic"
            estimated_duration = 30
        elif len(bottlenecks) <= 1:
            recommended_test_type = "soak"
            estimated_duration = 120
        else:
            recommended_test_type = "stress"
            estimated_duration = 60
        
        return NextLoadTestPlan(
            suggested_changes=suggested_changes,
            expected_improvements=expected_improvements,
            recommended_test_type=recommended_test_type,
            estimated_duration_minutes=estimated_duration,
            notes=f"检测到 {len(critical_bottlenecks)} 个严重瓶颈，{len(high_bottlenecks)} 个高优先级瓶颈",
        )
