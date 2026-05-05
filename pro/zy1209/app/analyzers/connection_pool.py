from typing import Dict, List, Any, Optional
from .base import BaseAnalyzer, AnalysisResult, Finding, Recommendation
from ..models.enums import AnalysisType, SeverityLevel


class ConnectionPoolAnalyzer(BaseAnalyzer):
    analysis_type = AnalysisType.CONNECTION_POOL
    
    def analyze(self, inputs: Dict[str, Any]) -> AnalysisResult:
        db_profile = inputs.get("db_profile", {})
        config = self.config.get("connection_pool", {})
        
        max_connections = config.get("max_connections", db_profile.get("max_connections", 100))
        current_connections = config.get("current_connections", db_profile.get("current_connections", 0))
        wait_timeout = config.get("wait_timeout", 28800)
        threshold = config.get("connection_usage_threshold", 0.8)
        
        findings: List[Finding] = []
        recommendations: List[Recommendation] = []
        
        usage_ratio = current_connections / max_connections if max_connections > 0 else 0
        
        metrics = {
            "max_connections": max_connections,
            "current_connections": current_connections,
            "usage_ratio": round(usage_ratio, 3),
            "wait_timeout": wait_timeout,
            "available_connections": max_connections - current_connections
        }
        
        if usage_ratio >= threshold:
            findings.append(Finding(
                id="CP-001",
                title="连接池使用率过高",
                description=f"当前连接池使用率为 {usage_ratio*100:.1f}%，超过阈值 {threshold*100:.1f}%",
                severity=SeverityLevel.HIGH if usage_ratio >= 0.9 else SeverityLevel.MEDIUM,
                category="capacity",
                evidence={
                    "current": current_connections,
                    "max": max_connections,
                    "usage_ratio": usage_ratio,
                    "threshold": threshold
                },
                impact="可能导致新连接请求被拒绝或等待超时"
            ))
        
        if wait_timeout < 300:
            findings.append(Finding(
                id="CP-002",
                title="连接等待超时时间过短",
                description=f"当前 wait_timeout 为 {wait_timeout} 秒，可能导致连接被过早释放",
                severity=SeverityLevel.MEDIUM,
                category="configuration",
                evidence={"wait_timeout": wait_timeout},
                impact="可能导致频繁的连接重建开销"
            ))
        
        if max_connections < 50:
            findings.append(Finding(
                id="CP-003",
                title="最大连接数配置偏低",
                description=f"当前最大连接数为 {max_connections}，对于高并发场景可能不足",
                severity=SeverityLevel.LOW,
                category="configuration",
                evidence={"max_connections": max_connections},
                impact="在流量高峰期可能成为性能瓶颈"
            ))
        
        active_connections = db_profile.get("active_connections", current_connections * 0.7)
        idle_connections = current_connections - active_connections
        idle_ratio = idle_connections / current_connections if current_connections > 0 else 0
        
        if idle_ratio > 0.5 and current_connections > 20:
            findings.append(Finding(
                id="CP-004",
                title="闲置连接过多",
                description=f"闲置连接占比 {idle_ratio*100:.1f}%，可能存在连接泄漏或配置不当",
                severity=SeverityLevel.MEDIUM,
                category="efficiency",
                evidence={
                    "idle_connections": idle_connections,
                    "total_connections": current_connections,
                    "idle_ratio": idle_ratio
                },
                impact="浪费数据库资源，可能影响其他连接的性能"
            ))
        
        for finding in findings:
            if finding.id == "CP-001":
                recommendations.append(Recommendation(
                    id="R-CP-001",
                    finding_id=finding.id,
                    title="增加最大连接数",
                    description="根据业务负载情况，适当增加 max_connections 配置",
                    priority="high",
                    estimated_effort="低",
                    expected_improvement="缓解连接池压力"
                ))
                recommendations.append(Recommendation(
                    id="R-CP-002",
                    finding_id=finding.id,
                    title="检查连接泄漏",
                    description="检查应用是否正确释放数据库连接，是否存在连接泄漏",
                    priority="high",
                    estimated_effort="中",
                    expected_improvement="释放闲置连接"
                ))
            
            if finding.id == "CP-002":
                recommendations.append(Recommendation(
                    id="R-CP-003",
                    finding_id=finding.id,
                    title="调整 wait_timeout",
                    description="建议将 wait_timeout 设置为合理值（如 28800 秒）",
                    priority="medium",
                    estimated_effort="低",
                    expected_improvement="减少连接重建开销"
                ))
            
            if finding.id == "CP-004":
                recommendations.append(Recommendation(
                    id="R-CP-004",
                    finding_id=finding.id,
                    title="配置连接池最小闲置数",
                    description="调整连接池的 min_idle 配置，避免闲置连接过多",
                    priority="medium",
                    estimated_effort="低",
                    expected_improvement="优化资源利用率"
                ))
        
        severity = self._calculate_severity(findings)
        
        return AnalysisResult(
            analysis_type=self.analysis_type,
            severity=severity,
            title="连接池容量分析",
            description="分析数据库连接池的容量配置和使用情况",
            findings=findings,
            recommendations=recommendations,
            metrics=metrics,
            raw_data={"db_profile": db_profile, "config": config}
        )
