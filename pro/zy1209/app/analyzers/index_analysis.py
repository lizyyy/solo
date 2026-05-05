from typing import Dict, List, Any, Optional, Set
from .base import BaseAnalyzer, AnalysisResult, Finding, Recommendation
from ..models.enums import AnalysisType, SeverityLevel


class IndexAnalysisAnalyzer(BaseAnalyzer):
    analysis_type = AnalysisType.INDEX_ANALYSIS
    
    def analyze(self, inputs: Dict[str, Any]) -> AnalysisResult:
        schema_sql = inputs.get("schema_sql", "")
        slow_sql_log = inputs.get("slow_sql_log", "")
        config = self.config.get("index_analysis", {})
        
        analyze_missing = config.get("analyze_missing_indexes", True)
        analyze_redundant = config.get("analyze_redundant_indexes", True)
        analyze_unused = config.get("analyze_unused_indexes", True)
        usage_threshold = config.get("usage_threshold", 0.01)
        
        findings: List[Finding] = []
        recommendations: List[Recommendation] = []
        
        tables = self._parse_schema(schema_sql)
        slow_queries = self._parse_slow_queries(slow_sql_log)
        
        metrics = {
            "total_tables": len(tables),
            "total_indexes": sum(len(t.get("indexes", [])) for t in tables),
            "slow_queries_analyzed": len(slow_queries),
            "missing_indexes_candidates": 0,
            "redundant_indexes_candidates": 0,
            "unused_indexes_candidates": 0
        }
        
        if analyze_missing:
            missing_findings = self._analyze_missing_indexes(tables, slow_queries)
            findings.extend(missing_findings)
            metrics["missing_indexes_candidates"] = len(missing_findings)
        
        if analyze_redundant:
            redundant_findings = self._analyze_redundant_indexes(tables)
            findings.extend(redundant_findings)
            metrics["redundant_indexes_candidates"] = len(redundant_findings)
        
        if analyze_unused:
            unused_findings = self._analyze_unused_indexes(tables, usage_threshold)
            findings.extend(unused_findings)
            metrics["unused_indexes_candidates"] = len(unused_findings)
        
        for finding in findings:
            if "missing" in finding.id.lower():
                recommendations.append(Recommendation(
                    id=f"R-{finding.id}",
                    finding_id=finding.id,
                    title="添加缺失索引",
                    description=f"为表 {finding.evidence.get('table', 'unknown')} 添加建议的索引",
                    priority="high" if finding.severity in [SeverityLevel.CRITICAL, SeverityLevel.HIGH] else "medium",
                    estimated_effort="中",
                    expected_improvement="提升查询性能"
                ))
            
            if "redundant" in finding.id.lower():
                recommendations.append(Recommendation(
                    id=f"R-{finding.id}",
                    finding_id=finding.id,
                    title="删除冗余索引",
                    description=f"删除表 {finding.evidence.get('table', 'unknown')} 中的冗余索引",
                    priority="medium",
                    estimated_effort="低",
                    expected_improvement="减少维护开销，提升写入性能"
                ))
            
            if "unused" in finding.id.lower():
                recommendations.append(Recommendation(
                    id=f"R-{finding.id}",
                    finding_id=finding.id,
                    title="评估未使用索引",
                    description=f"评估表 {finding.evidence.get('table', 'unknown')} 中未使用的索引是否需要保留",
                    priority="low",
                    estimated_effort="低",
                    expected_improvement="减少维护开销"
                ))
        
        severity = self._calculate_severity(findings)
        
        return AnalysisResult(
            analysis_type=self.analysis_type,
            severity=severity,
            title="索引分析",
            description="分析索引的缺失、冗余和未使用情况",
            findings=findings,
            recommendations=recommendations,
            metrics=metrics,
            raw_data={
                "tables": tables,
                "slow_queries_count": len(slow_queries),
                "config": config
            }
        )
    
    def _parse_schema(self, schema_sql: str) -> List[Dict[str, Any]]:
        tables = []
        if not schema_sql:
            return tables
        
        lines = schema_sql.split('\n')
        current_table = None
        indexes = []
        
        for line in lines:
            line = line.strip()
            if line.upper().startswith('CREATE TABLE'):
                if current_table:
                    tables.append({
                        "name": current_table,
                        "columns": [],
                        "indexes": indexes
                    })
                current_table = self._extract_table_name(line)
                indexes = []
            elif 'INDEX' in line.upper() and current_table:
                index_info = self._parse_index(line)
                if index_info:
                    indexes.append(index_info)
        
        if current_table:
            tables.append({
                "name": current_table,
                "columns": [],
                "indexes": indexes
            })
        
        return tables
    
    def _extract_table_name(self, line: str) -> str:
        import re
        match = re.search(r'CREATE TABLE\s+[IF NOT EXISTS\s]*([`"\']?[\w]+[`"\']?)', line, re.IGNORECASE)
        if match:
            name = match.group(1).strip('`"\'')
            return name
        return "unknown"
    
    def _parse_index(self, line: str) -> Optional[Dict[str, Any]]:
        import re
        line_upper = line.upper()
        
        index_type = "INDEX"
        if "UNIQUE" in line_upper:
            index_type = "UNIQUE"
        elif "PRIMARY" in line_upper:
            index_type = "PRIMARY"
        elif "FULLTEXT" in line_upper:
            index_type = "FULLTEXT"
        
        columns_match = re.search(r'\(([^)]+)\)', line)
        columns = []
        if columns_match:
            cols = columns_match.group(1).split(',')
            columns = [c.strip().strip('`"\'') for c in cols]
        
        if not columns:
            return None
        
        return {
            "type": index_type,
            "columns": columns,
            "usage": 0.5
        }
    
    def _parse_slow_queries(self, slow_sql_log: str) -> List[Dict[str, Any]]:
        queries = []
        if not slow_sql_log:
            return queries
        
        lines = slow_sql_log.split('\n')
        current_query = None
        query_time = 0
        
        for line in lines:
            line = line.strip()
            if line.startswith('# Query_time:'):
                import re
                match = re.search(r'Query_time:\s*([\d.]+)', line)
                if match:
                    query_time = float(match.group(1))
            elif line and not line.startswith('#') and not line.startswith('--'):
                if not current_query:
                    current_query = line
                else:
                    current_query += ' ' + line
            elif current_query:
                if query_time > 1:
                    queries.append({
                        "sql": current_query,
                        "query_time": query_time,
                        "tables_used": self._extract_tables_from_query(current_query)
                    })
                current_query = None
                query_time = 0
        
        return queries
    
    def _extract_tables_from_query(self, sql: str) -> List[str]:
        import re
        tables = []
        patterns = [
            r'FROM\s+([\w,`"\s]+)(?:\s+WHERE|\s+LIMIT|\s+ORDER|\s+GROUP|\s+JOIN|\s*$)',
            r'JOIN\s+([\w`"]+)\s+ON',
            r'UPDATE\s+([\w`"]+)\s+SET',
            r'INSERT INTO\s+([\w`"]+)\s*\(',
            r'DELETE FROM\s+([\w`"]+)\s+WHERE'
        ]
        
        sql_upper = sql.upper()
        for pattern in patterns:
            matches = re.findall(pattern, sql, re.IGNORECASE)
            for match in matches:
                parts = match.split(',')
                for part in parts:
                    table = part.strip().strip('`"\'')
                    if table and table not in tables:
                        tables.append(table)
        
        return tables
    
    def _analyze_missing_indexes(self, tables: List[Dict], slow_queries: List[Dict]) -> List[Finding]:
        findings = []
        finding_count = 0
        
        for query in slow_queries:
            tables_used = query.get("tables_used", [])
            query_time = query.get("query_time", 0)
            
            for table_name in tables_used:
                table = next((t for t in tables if t["name"].lower() == table_name.lower()), None)
                if not table:
                    continue
                
                indexes = table.get("indexes", [])
                has_primary = any(i["type"] == "PRIMARY" for i in indexes)
                
                if query_time > 5 and not has_primary and len(indexes) < 2:
                    finding_count += 1
                    findings.append(Finding(
                        id=f"IDX-MISS-{finding_count:03d}",
                        title=f"表 {table_name} 可能缺少索引",
                        description=f"查询耗时 {query_time} 秒，表 {table_name} 索引数量不足",
                        severity=SeverityLevel.HIGH if query_time > 10 else SeverityLevel.MEDIUM,
                        category="missing_index",
                        evidence={
                            "table": table_name,
                            "query_time": query_time,
                            "index_count": len(indexes),
                            "has_primary": has_primary
                        },
                        impact="慢查询可能由于缺少索引导致"
                    ))
        
        if not tables:
            findings.append(Finding(
                id="IDX-MISS-001",
                title="未提供表结构信息",
                description="未提供 schema.sql，无法进行详细的索引分析",
                severity=SeverityLevel.LOW,
                category="configuration",
                evidence={},
                impact="索引分析结果可能不完整"
            ))
        
        return findings
    
    def _analyze_redundant_indexes(self, tables: List[Dict]) -> List[Finding]:
        findings = []
        finding_count = 0
        
        for table in tables:
            indexes = table.get("indexes", [])
            table_name = table.get("name", "unknown")
            
            for i, idx1 in enumerate(indexes):
                for j, idx2 in enumerate(indexes[i+1:], start=i+1):
                    cols1 = set(idx1["columns"])
                    cols2 = set(idx2["columns"])
                    
                    if cols1 == cols2:
                        finding_count += 1
                        findings.append(Finding(
                            id=f"IDX-RED-{finding_count:03d}",
                            title=f"表 {table_name} 存在重复索引",
                            description=f"两个索引包含相同的列: {', '.join(cols1)}",
                            severity=SeverityLevel.MEDIUM,
                            category="redundant_index",
                            evidence={
                                "table": table_name,
                                "index1_type": idx1["type"],
                                "index2_type": idx2["type"],
                                "columns": list(cols1)
                            },
                            impact="重复索引增加写入开销和存储成本"
                        ))
                    
                    if cols1.issubset(cols2) and cols1 != cols2:
                        if idx1["type"] == "INDEX" and idx2["type"] == "INDEX":
                            finding_count += 1
                            findings.append(Finding(
                                id=f"IDX-RED-{finding_count:03d}",
                                title=f"表 {table_name} 存在前缀冗余索引",
                                description=f"索引包含列 {', '.join(cols1)} 是另一个索引 {', '.join(cols2)} 的前缀",
                                severity=SeverityLevel.LOW,
                                category="redundant_index",
                                evidence={
                                    "table": table_name,
                                    "prefix_index_columns": list(cols1),
                                    "full_index_columns": list(cols2)
                                },
                                impact="前缀索引可能是冗余的"
                            ))
        
        return findings
    
    def _analyze_unused_indexes(self, tables: List[Dict], threshold: float) -> List[Finding]:
        findings = []
        finding_count = 0
        
        for table in tables:
            indexes = table.get("indexes", [])
            table_name = table.get("name", "unknown")
            
            for idx in indexes:
                usage = idx.get("usage", 0.5)
                if usage < threshold and idx["type"] == "INDEX":
                    finding_count += 1
                    findings.append(Finding(
                        id=f"IDX-UNUSED-{finding_count:03d}",
                        title=f"表 {table_name} 存在使用率低的索引",
                        description=f"索引在列 {', '.join(idx['columns'])} 上使用率较低",
                        severity=SeverityLevel.LOW,
                        category="unused_index",
                        evidence={
                            "table": table_name,
                            "index_columns": idx["columns"],
                            "usage_ratio": usage,
                            "threshold": threshold
                        },
                        impact="未使用的索引增加维护开销"
                    ))
        
        return findings
