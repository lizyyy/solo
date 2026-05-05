from typing import Dict, List, Any, Optional
from collections import defaultdict
from .base import BaseAnalyzer, AnalysisResult, Finding, Recommendation
from ..models.enums import AnalysisType, SeverityLevel


class ShardingHotspotAnalyzer(BaseAnalyzer):
    analysis_type = AnalysisType.SHARDING_HOTSPOT
    
    def analyze(self, inputs: Dict[str, Any]) -> AnalysisResult:
        db_profile = inputs.get("db_profile", {})
        config = self.config.get("sharding_hotspot", {})
        
        shard_count = config.get("shard_count", db_profile.get("shard_count", 4))
        hotspot_threshold = config.get("hotspot_threshold", 0.3)
        analyze_data = config.get("analyze_data_distribution", True)
        analyze_query = config.get("analyze_query_distribution", True)
        
        findings: List[Finding] = []
        recommendations: List[Recommendation] = []
        
        data_distribution = db_profile.get("data_distribution", self._generate_sample_distribution(shard_count))
        query_distribution = db_profile.get("query_distribution", self._generate_sample_query_distribution(shard_count))
        
        total_data = sum(data_distribution.values()) if data_distribution else 0
        total_queries = sum(query_distribution.values()) if query_distribution else 0
        
        metrics = {
            "shard_count": shard_count,
            "hotspot_threshold": hotspot_threshold,
            "total_records": total_data,
            "total_queries": total_queries,
            "data_distribution": data_distribution,
            "query_distribution": query_distribution,
            "data_imbalance_ratio": 0.0,
            "query_imbalance_ratio": 0.0
        }
        
        if analyze_data and total_data > 0:
            expected_per_shard = total_data / shard_count
            max_data = max(data_distribution.values()) if data_distribution else 0
            data_imbalance = (max_data - expected_per_shard) / expected_per_shard if expected_per_shard > 0 else 0
            metrics["data_imbalance_ratio"] = round(data_imbalance, 3)
            
            for shard_id, count in data_distribution.items():
                ratio = count / total_data
                if ratio > hotspot_threshold:
                    findings.append(Finding(
                        id=f"SH-DATA-{len(findings)}",
                        title=f"分片 {shard_id} 存在数据热点",
                        description=f"分片 {shard_id} 存储了 {ratio*100:.1f}% 的数据，超过热点阈值 {hotspot_threshold*100:.1f}%",
                        severity=SeverityLevel.CRITICAL if ratio > 0.5 else SeverityLevel.HIGH,
                        category="data_hotspot",
                        evidence={
                            "shard_id": shard_id,
                            "record_count": count,
                            "ratio": round(ratio, 3),
                            "threshold": hotspot_threshold
                        },
                        impact="数据热点可能导致存储不均衡和查询性能下降"
                    ))
            
            if len(data_distribution) > 1:
                min_data = min(data_distribution.values())
                max_data = max(data_distribution.values())
                if max_data > min_data * 3 and min_data > 0:
                    findings.append(Finding(
                        id="SH-DATA-IMBALANCE",
                        title="数据分布严重不均衡",
                        description=f"最大分片数据量是最小分片的 {max_data/min_data:.1f} 倍",
                        severity=SeverityLevel.HIGH,
                        category="data_imbalance",
                        evidence={
                            "max_count": max_data,
                            "min_count": min_data,
                            "ratio": round(max_data / min_data, 2)
                        },
                        impact="数据分布不均可能导致部分分片压力过大"
                    ))
        
        if analyze_query and total_queries > 0:
            expected_per_shard = total_queries / shard_count
            max_queries = max(query_distribution.values()) if query_distribution else 0
            query_imbalance = (max_queries - expected_per_shard) / expected_per_shard if expected_per_shard > 0 else 0
            metrics["query_imbalance_ratio"] = round(query_imbalance, 3)
            
            for shard_id, count in query_distribution.items():
                ratio = count / total_queries
                if ratio > hotspot_threshold:
                    findings.append(Finding(
                        id=f"SH-QUERY-{len(findings)}",
                        title=f"分片 {shard_id} 存在查询热点",
                        description=f"分片 {shard_id} 处理了 {ratio*100:.1f}% 的查询，超过热点阈值 {hotspot_threshold*100:.1f}%",
                        severity=SeverityLevel.CRITICAL if ratio > 0.5 else SeverityLevel.HIGH,
                        category="query_hotspot",
                        evidence={
                            "shard_id": shard_id,
                            "query_count": count,
                            "ratio": round(ratio, 3),
                            "threshold": hotspot_threshold
                        },
                        impact="查询热点可能导致系统性能瓶颈"
                    ))
        
        shard_key = db_profile.get("shard_key", "")
        if shard_key:
            if shard_key in ["id", "user_id", "order_id"]:
                if "created_at" in shard_key.lower() or "time" in shard_key.lower():
                    findings.append(Finding(
                        id="SH-KEY-TIME",
                        title="分片键选择可能存在问题",
                        description=f"使用时间字段 '{shard_key}' 作为分片键可能导致数据热点",
                        severity=SeverityLevel.MEDIUM,
                        category="shard_key",
                        evidence={"shard_key": shard_key},
                        impact="时间字段作为分片键可能导致最新数据集中在少数分片"
                    ))
        
        if not findings:
            findings.append(Finding(
                id="SH-INFO-001",
                title="分片分布良好",
                description="数据和查询在各分片上分布均衡，未发现明显热点",
                severity=SeverityLevel.INFO,
                category="status",
                evidence={
                    "shard_count": shard_count,
                    "data_imbalance_ratio": metrics["data_imbalance_ratio"],
                    "query_imbalance_ratio": metrics["query_imbalance_ratio"]
                },
                impact="分片架构运行良好"
            ))
        
        for finding in findings:
            if "DATA" in finding.id:
                recommendations.append(Recommendation(
                    id=f"R-{finding.id}",
                    finding_id=finding.id,
                    title="重新平衡数据分布",
                    description="考虑重新分片或调整分片键策略，使数据更均衡地分布",
                    priority="high",
                    estimated_effort="高",
                    expected_improvement="消除数据热点，提升整体性能"
                ))
            
            if "QUERY" in finding.id:
                recommendations.append(Recommendation(
                    id=f"R-{finding.id}",
                    finding_id=finding.id,
                    title="优化查询路由",
                    description="分析热点查询模式，考虑添加缓存或使用读写分离",
                    priority="high",
                    estimated_effort="中",
                    expected_improvement="缓解查询热点"
                ))
                recommendations.append(Recommendation(
                    id=f"R-{finding.id}-CACHE",
                    finding_id=finding.id,
                    title="添加缓存层",
                    description="为热点数据添加 Redis 等缓存层，减少数据库压力",
                    priority="medium",
                    estimated_effort="中",
                    expected_improvement="显著减少热点分片查询压力"
                ))
            
            if "IMBALANCE" in finding.id:
                recommendations.append(Recommendation(
                    id=f"R-{finding.id}",
                    finding_id=finding.id,
                    title="重新设计分片策略",
                    description="考虑使用一致性哈希或更均匀的分片算法",
                    priority="high",
                    estimated_effort="高",
                    expected_improvement="实现更均衡的数据分布"
                ))
        
        severity = self._calculate_severity(findings)
        
        return AnalysisResult(
            analysis_type=self.analysis_type,
            severity=severity,
            title="分库分表热点分析",
            description="分析分库分表架构中的数据热点和查询热点",
            findings=findings,
            recommendations=recommendations,
            metrics=metrics,
            raw_data={
                "db_profile": db_profile,
                "config": config
            }
        )
    
    def _generate_sample_distribution(self, shard_count: int) -> Dict[str, int]:
        import random
        distribution = {}
        base = 10000
        for i in range(shard_count):
            variation = random.randint(-int(base * 0.3), int(base * 0.3))
            distribution[f"shard_{i+1}"] = max(1000, base + variation)
        return distribution
    
    def _generate_sample_query_distribution(self, shard_count: int) -> Dict[str, int]:
        import random
        distribution = {}
        base = 5000
        for i in range(shard_count):
            variation = random.randint(-int(base * 0.4), int(base * 0.4))
            distribution[f"shard_{i+1}"] = max(500, base + variation)
        return distribution
