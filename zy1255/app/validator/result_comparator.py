import hashlib
import re
from typing import List, Dict, Any, Tuple, Optional, Set
from dataclasses import dataclass, field
from collections import defaultdict

from app.db.sqlite_manager import QueryResult, ExplainPlan


@dataclass
class ComparisonResult:
    passed: bool
    
    row_count_match: bool = True
    row_count_original: int = 0
    row_count_optimized: int = 0
    
    columns_match: bool = True
    columns_original: List[str] = field(default_factory=list)
    columns_optimized: List[str] = field(default_factory=list)
    
    order_sensitive: bool = False
    order_match: bool = True
    
    null_handling_match: bool = True
    null_aggregation_issues: List[str] = field(default_factory=list)
    
    join_row_count_match: bool = True
    join_issues: List[str] = field(default_factory=list)
    
    explain_differences: List[str] = field(default_factory=list)
    
    performance_comparison: Dict[str, Any] = field(default_factory=dict)
    
    mismatched_rows: List[Dict[str, Any]] = field(default_factory=list)
    sample_mismatches: List[Dict[str, Any]] = field(default_factory=list)
    
    error: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'passed': self.passed,
            'row_count_match': self.row_count_match,
            'row_count_original': self.row_count_original,
            'row_count_optimized': self.row_count_optimized,
            'columns_match': self.columns_match,
            'columns_original': self.columns_original,
            'columns_optimized': self.columns_optimized,
            'order_sensitive': self.order_sensitive,
            'order_match': self.order_match,
            'null_handling_match': self.null_handling_match,
            'null_aggregation_issues': self.null_aggregation_issues,
            'join_row_count_match': self.join_row_count_match,
            'join_issues': self.join_issues,
            'explain_differences': self.explain_differences,
            'performance_comparison': self.performance_comparison,
            'mismatched_rows_count': len(self.mismatched_rows),
            'sample_mismatches': self.sample_mismatches[:10],
            'error': self.error
        }


class ResultComparator:
    def __init__(self, max_sample_rows: int = 100):
        self.max_sample_rows = max_sample_rows
    
    def normalize_value(self, value: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, float):
            return round(value, 9)
        if isinstance(value, str):
            return value.strip()
        return value
    
    def hash_row(self, row: Tuple[Any, ...], columns: List[str], 
                 ignore_column_order: bool = True) -> str:
        if ignore_column_order:
            sorted_pairs = sorted(zip(columns, row))
            normalized = tuple((k, self.normalize_value(v)) for k, v in sorted_pairs)
        else:
            normalized = tuple(self.normalize_value(v) for v in row)
        
        return hashlib.md5(str(normalized).encode()).hexdigest()
    
    def detect_order_sensitivity(self, sql: str) -> bool:
        sql_upper = sql.upper().strip()
        
        has_order_by = bool(re.search(r'\bORDER\s+BY\b', sql_upper))
        has_limit = bool(re.search(r'\bLIMIT\s+\d+', sql_upper))
        has_window = bool(re.search(r'\bOVER\s*\(', sql_upper))
        
        return has_order_by or has_limit or has_window
    
    def detect_null_aggregation(self, sql: str) -> List[str]:
        issues = []
        sql_upper = sql.upper()
        
        agg_functions = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX']
        for agg in agg_functions:
            if re.search(rf'{agg}\s*\(\s*\*\s*\)', sql_upper):
                issues.append(f'{agg}(*) 可能受 NULL 处理影响')
            
            if re.search(rf'{agg}\s*\(\s*DISTINCT', sql_upper):
                issues.append(f'{agg}(DISTINCT ...) 可能受 NULL 处理影响')
        
        if re.search(r'\bGROUP\s+BY\b', sql_upper):
            issues.append('GROUP BY 操作中 NULL 值会被归为一组')
        
        return issues
    
    def compare_results(
        self,
        original_result: QueryResult,
        optimized_result: QueryResult,
        original_sql: str = '',
        optimized_sql: str = '',
        original_explain: Optional[ExplainPlan] = None,
        optimized_explain: Optional[ExplainPlan] = None
    ) -> ComparisonResult:
        
        result = ComparisonResult(passed=True)
        
        if original_result.error:
            result.error = f'原始 SQL 执行错误: {original_result.error}'
            result.passed = False
            return result
        
        if optimized_result.error:
            result.error = f'优化后 SQL 执行错误: {optimized_result.error}'
            result.passed = False
            return result
        
        result.row_count_original = original_result.row_count
        result.row_count_optimized = optimized_result.row_count
        
        if original_result.row_count != optimized_result.row_count:
            result.row_count_match = False
            result.passed = False
        
        result.columns_original = original_result.columns
        result.columns_optimized = optimized_result.columns
        
        if set(original_result.columns) != set(optimized_result.columns):
            result.columns_match = False
            result.passed = False
        
        result.order_sensitive = (
            self.detect_order_sensitivity(original_sql) or 
            self.detect_order_sensitivity(optimized_sql)
        )
        
        if result.order_sensitive and original_result.rows != optimized_result.rows:
            result.order_match = False
            result.passed = False
        
        original_rows_set = defaultdict(int)
        for row in original_result.rows:
            row_hash = self.hash_row(row, original_result.columns)
            original_rows_set[row_hash] += 1
        
        optimized_rows_set = defaultdict(int)
        for row in optimized_result.rows:
            row_hash = self.hash_row(row, optimized_result.columns)
            optimized_rows_set[row_hash] += 1
        
        if original_rows_set != optimized_rows_set:
            result.passed = False
            
            all_hashes = set(original_rows_set.keys()) | set(optimized_rows_set.keys())
            for h in all_hashes:
                orig_count = original_rows_set.get(h, 0)
                opt_count = optimized_rows_set.get(h, 0)
                if orig_count != opt_count:
                    result.mismatched_rows.append({
                        'hash': h,
                        'original_count': orig_count,
                        'optimized_count': opt_count
                    })
        
        if result.mismatched_rows and original_result.rows:
            sample_original = original_result.rows[:5]
            sample_optimized = optimized_result.rows[:5]
            
            for i, (orig, opt) in enumerate(zip(sample_original, sample_optimized)):
                orig_dict = dict(zip(original_result.columns, orig))
                opt_dict = dict(zip(optimized_result.columns, opt))
                if orig_dict != opt_dict:
                    result.sample_mismatches.append({
                        'row_index': i,
                        'original': orig_dict,
                        'optimized': opt_dict
                    })
        
        original_null_issues = self.detect_null_aggregation(original_sql)
        optimized_null_issues = self.detect_null_aggregation(optimized_sql)
        
        if original_null_issues or optimized_null_issues:
            result.null_aggregation_issues = list(set(original_null_issues + optimized_null_issues))
            
            has_count_star = any('COUNT(*)' in issue for issue in result.null_aggregation_issues)
            if has_count_star and (original_result.row_count != optimized_result.row_count):
                result.null_handling_match = False
                result.passed = False
        
        result.join_issues = []
        join_keywords = [r'\bJOIN\b', r'\bLEFT\s+JOIN\b', r'\bRIGHT\s+JOIN\b', 
                         r'\bINNER\s+JOIN\b', r'\bFULL\s+JOIN\b']
        
        has_join_original = any(re.search(pattern, original_sql.upper()) for pattern in join_keywords)
        has_join_optimized = any(re.search(pattern, optimized_sql.upper()) for pattern in join_keywords)
        
        if has_join_original or has_join_optimized:
            if original_result.row_count != optimized_result.row_count:
                result.join_issues.append('JOIN 结果行数不一致，可能存在连接条件问题')
                result.join_row_count_match = False
                result.passed = False
        
        if original_explain and optimized_explain:
            result.explain_differences = self.compare_explain_plans(
                original_explain, optimized_explain
            )
        
        result.performance_comparison = {
            'original_time_ms': original_result.execution_time_ms,
            'optimized_time_ms': optimized_result.execution_time_ms,
            'speedup_ratio': (
                original_result.execution_time_ms / optimized_result.execution_time_ms
                if optimized_result.execution_time_ms > 0 else float('inf')
            ),
            'time_diff_ms': optimized_result.execution_time_ms - original_result.execution_time_ms,
            'is_faster': optimized_result.execution_time_ms < original_result.execution_time_ms
        }
        
        return result
    
    def compare_explain_plans(
        self, 
        original: ExplainPlan, 
        optimized: ExplainPlan
    ) -> List[str]:
        differences = []
        
        if original.estimated_rows and optimized.estimated_rows:
            row_diff = abs(original.estimated_rows - optimized.estimated_rows)
            if row_diff > 0:
                differences.append(
                    f'估计行数差异: 原始={original.estimated_rows}, 优化后={optimized.estimated_rows}'
                )
        
        original_tables = set()
        optimized_tables = set()
        
        for step in original.steps:
            if 'detail' in step:
                tables = re.findall(r'\b(SCAN|SEARCH)\s+(\w+)', str(step['detail']))
                for _, table in tables:
                    original_tables.add(table)
        
        for step in optimized.steps:
            if 'detail' in step:
                tables = re.findall(r'\b(SCAN|SEARCH)\s+(\w+)', str(step['detail']))
                for _, table in tables:
                    optimized_tables.add(table)
        
        if original_tables != optimized_tables:
            differences.append(
                f'访问的表不同: 原始={original_tables}, 优化后={optimized_tables}'
            )
        
        original_scan = any('SCAN' in str(s.get('detail', '')) for s in original.steps)
        optimized_scan = any('SCAN' in str(s.get('detail', '')) for s in optimized.steps)
        
        if original_scan and not optimized_scan:
            differences.append('优化后使用了索引查找 (SEARCH) 替代全表扫描 (SCAN)')
        elif not original_scan and optimized_scan:
            differences.append('警告: 优化后使用了全表扫描 (SCAN)')
        
        return differences
    
    def generate_optimization_suggestions(
        self, 
        comparison: ComparisonResult,
        original_sql: str,
        optimized_sql: str
    ) -> List[str]:
        suggestions = []
        
        if not comparison.passed:
            suggestions.append('⚠️ 验证失败: 原始 SQL 和优化后 SQL 结果不等价')
            
            if not comparison.row_count_match:
                suggestions.append(
                    f'  - 行数不匹配: 原始={comparison.row_count_original}, '
                    f'优化后={comparison.row_count_optimized}'
                )
            
            if not comparison.columns_match:
                suggestions.append('  - 列结构不匹配')
            
            if comparison.sample_mismatches:
                suggestions.append('  - 存在数据不一致的行')
        
        if comparison.performance_comparison.get('is_faster', False):
            speedup = comparison.performance_comparison.get('speedup_ratio', 1)
            if speedup > 1.5:
                suggestions.append(f'✅ 性能提升: 速度提升 {speedup:.2f}x')
        else:
            time_diff = comparison.performance_comparison.get('time_diff_ms', 0)
            if time_diff > 10:
                suggestions.append(f'⚠️ 性能下降: 优化后慢了 {time_diff:.2f}ms')
        
        if comparison.explain_differences:
            for diff in comparison.explain_differences:
                if 'SEARCH' in diff and 'SCAN' in diff:
                    suggestions.append(f'💡 索引优化: {diff}')
        
        if comparison.null_aggregation_issues:
            for issue in comparison.null_aggregation_issues:
                suggestions.append(f'⚠️ NULL 处理注意: {issue}')
        
        if comparison.join_issues:
            for issue in comparison.join_issues:
                suggestions.append(f'⚠️ JOIN 问题: {issue}')
        
        return suggestions
