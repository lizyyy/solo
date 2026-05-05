from typing import Dict, List, Any, Optional
from .base import BaseAnalyzer, AnalysisResult, Finding, Recommendation
from ..models.enums import AnalysisType, SeverityLevel


class ReadWriteSplitAnalyzer(BaseAnalyzer):
    analysis_type = AnalysisType.READ_WRITE_SPLIT
    
    def analyze(self, inputs: Dict[str, Any]) -> AnalysisResult:
        db_profile = inputs.get("db_profile", {})
        slow_sql_log = inputs.get("slow_sql_log", "")
        config = self.config.get("read_write_split", {})
        
        read_ratio = config.get("read_ratio", 0.8)
        master_write_ratio = config.get("master_write_ratio", 0.95)
        analyze_route_efficiency = config.get("analyze_read_route_efficiency", True)
        
        findings: List[Finding] = []
        recommendations: List[Recommendation] = []
        
        actual_read_ratio = db_profile.get("read_ratio", read_ratio)
        actual_master_write = db_profile.get("master_write_ratio", master_write_ratio)
        slave_read_count = db_profile.get("slave_read_count", 0)
        master_read_count = db_profile.get("master_read_count", 0)
        total_reads = slave_read_count + master_read_count
        
        metrics = {
            "expected_read_ratio": read_ratio,
            "actual_read_ratio": actual_read_ratio,
            "expected_master_write_ratio": master_write_ratio,
            "actual_master_write_ratio": actual_master_write,
            "slave_read_count": slave_read_count,
            "master_read_count": master_read_count,
            "total_reads": total_reads,
            "slave_utilization": slave_read_count / total_reads if total_reads > 0 else 0
        }
        
        if total_reads > 0:
            slave_util = slave_read_count / total_reads
            if slave_util < 0.5:
                findings.append(Finding(
                    id="RWS-001",
                    title="从库利用率偏低",
                    description=f"从库仅处理了 {slave_util*100:.1f}% 的读请求，未充分发挥读写分离优势",
                    severity=SeverityLevel.HIGH if slave_util < 0.3 else SeverityLevel.MEDIUM,
                    category="utilization",
                    evidence={
                        "slave_reads": slave_read_count,
                        "master_reads": master_read_count,
                        "slave_utilization": round(slave_util, 3)
                    },
                    impact="主库承担过多读压力，可能成为性能瓶颈"
                ))
        
        if actual_read_ratio < read_ratio * 0.8:
            findings.append(Finding(
                id="RWS-002",
                title="实际读比例低于预期",
                description=f"预期读比例为 {read_ratio*100:.1f}%，实际仅为 {actual_read_ratio*100:.1f}%",
                severity=SeverityLevel.MEDIUM,
                category="ratio",
                evidence={
                    "expected": read_ratio,
                    "actual": actual_read_ratio,
                    "gap": round(read_ratio - actual_read_ratio, 3)
                },
                impact="写操作比例过高可能导致主库压力过大"
            ))
        
        if analyze_route_efficiency and total_reads > 0:
            misrouted_reads = db_profile.get("misrouted_reads", master_read_count * 0.3)
            if misrouted_reads > 0:
                misroute_ratio = misrouted_reads / total_reads
                findings.append(Finding(
                    id="RWS-003",
                    title="读请求路由错误",
                    description=f"有 {misrouted_reads} 条读请求错误地路由到了主库，占比 {misroute_ratio*100:.1f}%",
                    severity=SeverityLevel.HIGH if misroute_ratio > 0.2 else SeverityLevel.MEDIUM,
                    category="routing",
                    evidence={
                        "misrouted_count": misrouted_reads,
                        "total_reads": total_reads,
                        "ratio": round(misroute_ratio, 3)
                    },
                    impact="增加主库压力，浪费从库资源"
                ))
        
        slow_reads_on_master = db_profile.get("slow_reads_on_master", 0)
        if slow_reads_on_master > 0:
            findings.append(Finding(
                id="RWS-004",
                title="主库上存在慢读查询",
                description=f"发现 {slow_reads_on_master} 条慢查询在主库上执行，这些查询应该路由到从库",
                severity=SeverityLevel.HIGH,
                category="slow_read",
                evidence={"slow_reads_on_master": slow_reads_on_master},
                impact="主库慢读可能阻塞写操作"
            ))
        
        replication_lag = db_profile.get("replication_lag_ms", 0)
        if replication_lag > 1000:
            findings.append(Finding(
                id="RWS-005",
                title="主从延迟过高",
                description=f"主从复制延迟为 {replication_lag}ms，超过阈值 1000ms",
                severity=SeverityLevel.HIGH if replication_lag > 5000 else SeverityLevel.MEDIUM,
                category="replication",
                evidence={
                    "lag_ms": replication_lag,
                    "threshold_ms": 1000
                },
                impact="可能导致读一致性问题，影响业务逻辑"
            ))
        
        slave_availability = db_profile.get("slave_availability", 1.0)
        if slave_availability < 0.95:
            findings.append(Finding(
                id="RWS-006",
                title="从库可用性不足",
                description=f"从库可用性为 {slave_availability*100:.1f}%，低于阈值 95%",
                severity=SeverityLevel.HIGH if slave_availability < 0.8 else SeverityLevel.MEDIUM,
                category="availability",
                evidence={
                    "availability": round(slave_availability, 3),
                    "threshold": 0.95
                },
                impact="从库故障时无法自动切换，影响系统可靠性"
            ))
        
        if not findings:
            findings.append(Finding(
                id="RWS-INFO-001",
                title="读写分离配置良好",
                description="读写分离配置和运行状态良好，从库利用率正常",
                severity=SeverityLevel.INFO,
                category="status",
                evidence={
                    "slave_utilization": metrics["slave_utilization"],
                    "read_ratio": actual_read_ratio
                },
                impact="读写分离架构运行正常"
            ))
        
        for finding in findings:
            if finding.id == "RWS-001":
                recommendations.append(Recommendation(
                    id="R-RWS-001",
                    finding_id=finding.id,
                    title="优化读路由策略",
                    description="检查应用层读路由逻辑，确保读请求正确路由到从库",
                    priority="high",
                    estimated_effort="中",
                    expected_improvement="提升从库利用率，减轻主库压力"
                ))
                recommendations.append(Recommendation(
                    id="R-RWS-002",
                    finding_id=finding.id,
                    title="检查连接池配置",
                    description="检查从库连接池配置，确保有足够的连接处理读请求",
                    priority="medium",
                    estimated_effort="低",
                    expected_improvement="优化连接分配"
                ))
            
            if finding.id == "RWS-003":
                recommendations.append(Recommendation(
                    id="R-RWS-003",
                    finding_id=finding.id,
                    title="修复路由逻辑",
                    description="检查并修复应用层的读写分离路由逻辑",
                    priority="high",
                    estimated_effort="中",
                    expected_improvement="确保读请求正确路由"
                ))
            
            if finding.id == "RWS-005":
                recommendations.append(Recommendation(
                    id="R-RWS-004",
                    finding_id=finding.id,
                    title="优化主从复制",
                    description="检查主从复制配置，考虑使用并行复制或优化网络",
                    priority="high",
                    estimated_effort="高",
                    expected_improvement="降低主从延迟"
                ))
                recommendations.append(Recommendation(
                    id="R-RWS-005",
                    finding_id=finding.id,
                    title="实现延迟感知路由",
                    description="在应用层实现延迟感知路由，延迟过高时切换到主库",
                    priority="medium",
                    estimated_effort="中",
                    expected_improvement="避免读到过期数据"
                ))
        
        severity = self._calculate_severity(findings)
        
        return AnalysisResult(
            analysis_type=self.analysis_type,
            severity=severity,
            title="读写分离路由分析",
            description="分析读写分离架构的配置和运行状态",
            findings=findings,
            recommendations=recommendations,
            metrics=metrics,
            raw_data={
                "db_profile": db_profile,
                "config": config
            }
        )
