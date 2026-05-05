from typing import Dict, List, Any, Optional
from collections import defaultdict
from .base import BaseAnalyzer, AnalysisResult, Finding, Recommendation
from ..models.enums import AnalysisType, SeverityLevel


class SlowSQLAnalyzer(BaseAnalyzer):
    analysis_type = AnalysisType.SLOW_SQL
    
    def analyze(self, inputs: Dict[str, Any]) -> AnalysisResult:
        slow_sql_log = inputs.get("slow_sql_log", "")
        config = self.config.get("slow_sql", {})
        
        slow_threshold = config.get("slow_query_threshold", 1.0)
        top_n = config.get("top_n_queries", 20)
        analyze_plan = config.get("analyze_execution_plan", True)
        
        findings: List[Finding] = []
        recommendations: List[Recommendation] = []
        
        queries = self._parse_slow_log(slow_sql_log, slow_threshold)
        
        metrics = {
            "total_slow_queries": len(queries),
            "slow_threshold_sec": slow_threshold,
            "avg_query_time": 0.0,
            "max_query_time": 0.0,
            "unique_patterns": 0,
            "top_n_analyzed": top_n
        }
        
        if queries:
            avg_time = sum(q.get("query_time", 0) for q in queries) / len(queries)
            max_time = max(q.get("query_time", 0) for q in queries)
            metrics["avg_query_time"] = round(avg_time, 3)
            metrics["max_query_time"] = round(max_time, 3)
            
            patterns = self._group_by_pattern(queries)
            metrics["unique_patterns"] = len(patterns)
        
        if len(queries) > 100:
            findings.append(Finding(
                id="SS-001",
                title="慢查询数量过多",
                description=f"共发现 {len(queries)} 条慢查询，超过阈值 100 条",
                severity=SeverityLevel.HIGH if len(queries) > 500 else SeverityLevel.MEDIUM,
                category="volume",
                evidence={
                    "count": len(queries),
                    "threshold": 100
                },
                impact="大量慢查询可能导致系统性能下降"
            ))
        
        if queries and max(q.get("query_time", 0) for q in queries) > 30:
            very_slow = [q for q in queries if q.get("query_time", 0) > 30]
            findings.append(Finding(
                id="SS-002",
                title="存在极端慢查询",
                description=f"发现 {len(very_slow)} 条查询执行时间超过 30 秒",
                severity=SeverityLevel.CRITICAL,
                category="extreme",
                evidence={
                    "count": len(very_slow),
                    "max_time": round(max(q.get("query_time", 0) for q in very_slow), 2)
                },
                impact="极端慢查询可能阻塞其他操作，严重影响系统性能"
            ))
        
        if queries:
            patterns = self._group_by_pattern(queries)
            for pattern, pattern_queries in list(patterns.items())[:5]:
                if len(pattern_queries) > 10:
                    avg_time = sum(q.get("query_time", 0) for q in pattern_queries) / len(pattern_queries)
                    findings.append(Finding(
                        id=f"SS-003-{len(findings)}",
                        title="高频慢查询模式",
                        description=f"相同模式的查询执行了 {len(pattern_queries)} 次，平均耗时 {avg_time:.2f} 秒",
                        severity=SeverityLevel.HIGH if avg_time > 10 else SeverityLevel.MEDIUM,
                        category="pattern",
                        evidence={
                            "pattern": pattern[:100] + "..." if len(pattern) > 100 else pattern,
                            "count": len(pattern_queries),
                            "avg_time": round(avg_time, 2)
                        },
                        impact="高频慢查询模式是优化的重点"
                    ))
        
        if analyze_plan and queries:
            full_scan_queries = [q for q in queries if self._likely_full_scan(q.get("sql", ""))]
            if len(full_scan_queries) > 0:
                findings.append(Finding(
                    id="SS-004",
                    title="疑似全表扫描",
                    description=f"发现 {len(full_scan_queries)} 条查询可能使用了全表扫描",
                    severity=SeverityLevel.HIGH,
                    category="execution_plan",
                    evidence={
                        "count": len(full_scan_queries),
                        "sample": full_scan_queries[0].get("sql", "")[:200] if full_scan_queries else ""
                    },
                    impact="全表扫描在大数据量表上性能极差"
                ))
        
        if not queries:
            findings.append(Finding(
                id="SS-INFO-001",
                title="未发现慢查询",
                description="未发现超过阈值的慢查询，当前配置表现良好",
                severity=SeverityLevel.INFO,
                category="status",
                evidence={"slow_threshold": slow_threshold},
                impact="系统查询性能表现良好"
            ))
        
        for finding in findings:
            if finding.id == "SS-001":
                recommendations.append(Recommendation(
                    id="R-SS-001",
                    finding_id=finding.id,
                    title="全面优化慢查询",
                    description="分析慢查询日志，识别并优化高频慢查询模式",
                    priority="high",
                    estimated_effort="高",
                    expected_improvement="显著提升系统性能"
                ))
            
            if finding.id == "SS-002":
                recommendations.append(Recommendation(
                    id="R-SS-002",
                    finding_id=finding.id,
                    title="优先优化极端慢查询",
                    description="重点分析执行时间超过 30 秒的查询，考虑添加索引或重构查询",
                    priority="critical",
                    estimated_effort="中",
                    expected_improvement="消除严重性能瓶颈"
                ))
            
            if "SS-003" in finding.id:
                recommendations.append(Recommendation(
                    id=f"R-{finding.id}",
                    finding_id=finding.id,
                    title="优化高频慢查询模式",
                    description="对高频慢查询模式添加缓存、优化索引或使用预编译语句",
                    priority="high",
                    estimated_effort="中",
                    expected_improvement="显著减少慢查询数量"
                ))
            
            if finding.id == "SS-004":
                recommendations.append(Recommendation(
                    id="R-SS-004",
                    finding_id=finding.id,
                    title="分析执行计划并添加索引",
                    description="使用 EXPLAIN 分析查询执行计划，为 WHERE 条件和 JOIN 字段添加适当索引",
                    priority="high",
                    estimated_effort="中",
                    expected_improvement="消除全表扫描，提升查询性能"
                ))
        
        severity = self._calculate_severity(findings)
        
        return AnalysisResult(
            analysis_type=self.analysis_type,
            severity=severity,
            title="慢SQL分析",
            description="分析慢查询日志，识别性能问题和优化机会",
            findings=findings,
            recommendations=recommendations,
            metrics=metrics,
            raw_data={
                "queries_count": len(queries),
                "config": config
            }
        )
    
    def _parse_slow_log(self, log_content: str, threshold: float) -> List[Dict[str, Any]]:
        queries = []
        if not log_content:
            return queries
        
        lines = log_content.split('\n')
        current_query = None
        query_time = 0
        lock_time = 0
        rows_sent = 0
        rows_examined = 0
        
        for line in lines:
            line = line.strip()
            if line.startswith('# Query_time:'):
                import re
                match = re.search(
                    r'Query_time:\s*([\d.]+)\s*Lock_time:\s*([\d.]+)\s*Rows_sent:\s*(\d+)\s*Rows_examined:\s*(\d+)',
                    line
                )
                if match:
                    query_time = float(match.group(1))
                    lock_time = float(match.group(2))
                    rows_sent = int(match.group(3))
                    rows_examined = int(match.group(4))
            elif line and not line.startswith('#') and not line.startswith('--'):
                if not current_query:
                    current_query = line
                else:
                    current_query += ' ' + line
            elif current_query:
                if query_time >= threshold:
                    queries.append({
                        "sql": current_query,
                        "query_time": query_time,
                        "lock_time": lock_time,
                        "rows_sent": rows_sent,
                        "rows_examined": rows_examined,
                        "pattern": self._extract_pattern(current_query)
                    })
                current_query = None
                query_time = 0
                lock_time = 0
                rows_sent = 0
                rows_examined = 0
        
        return queries
    
    def _extract_pattern(self, sql: str) -> str:
        import re
        pattern = re.sub(r"'[^']*'", "?", sql)
        pattern = re.sub(r'"[^"]*"', "?", pattern)
        pattern = re.sub(r'\b\d+\b', "?", pattern)
        pattern = re.sub(r'\s+', " ", pattern)
        return pattern.strip()
    
    def _group_by_pattern(self, queries: List[Dict]) -> Dict[str, List[Dict]]:
        patterns = defaultdict(list)
        for q in queries:
            pattern = q.get("pattern", q.get("sql", ""))
            patterns[pattern].append(q)
        return dict(patterns)
    
    def _likely_full_scan(self, sql: str) -> bool:
        sql_upper = sql.upper()
        if 'WHERE' not in sql_upper:
            return True
        if 'ORDER BY' in sql_upper and 'LIMIT' not in sql_upper:
            where_idx = sql_upper.find('WHERE')
            order_idx = sql_upper.find('ORDER BY')
            if where_idx < order_idx:
                between = sql_upper[where_idx:order_idx]
                if 'INDEX' not in between and 'KEY' not in between:
                    return True
        return False
