import json
from typing import Dict, Any, List, Optional
from datetime import datetime


class ReportExporter:
    def export_to_json(self, validation: Dict[str, Any]) -> str:
        return json.dumps(validation, indent=2, ensure_ascii=False)
    
    def export_to_markdown(self, validation: Dict[str, Any]) -> str:
        md = []
        
        md.append(f'# SQL 优化验证报告')
        md.append('')
        
        md.append(f'**验证名称**: {validation.get("name", "未命名")}')
        md.append(f'**验证 ID**: {validation.get("validation_id", "N/A")}')
        md.append(f'**状态**: {self._status_emoji(validation.get("status"))} {validation.get("status", "N/A")}')
        
        started_at = validation.get('started_at')
        completed_at = validation.get('completed_at')
        if started_at:
            md.append(f'**开始时间**: {started_at}')
        if completed_at:
            md.append(f'**结束时间**: {completed_at}')
        
        md.append('')
        md.append('---')
        md.append('')
        
        md.append('## 执行概览')
        md.append('')
        
        total = validation.get('total_cases', 0)
        passed = validation.get('passed_count', 0)
        failed = validation.get('failed_count', 0)
        error = validation.get('error_count', 0)
        
        md.append(f'- **总用例数**: {total}')
        md.append(f'- **通过**: {passed} ✅')
        md.append(f'- **失败**: {failed} ❌')
        md.append(f'- **错误**: {error} ⚠️')
        
        if total > 0:
            pass_rate = (passed / total) * 100
            md.append(f'- **通过率**: {pass_rate:.2f}%')
        
        md.append('')
        
        schema_imported = validation.get('schema_imported', False)
        data_imported = validation.get('data_imported', False)
        
        md.append(f'**Schema 导入**: {"成功" if schema_imported else "失败"}')
        md.append(f'**数据导入**: {"成功" if data_imported else "未导入或失败"}')
        
        md.append('')
        md.append('---')
        md.append('')
        
        cases = validation.get('cases', [])
        if cases:
            md.append('## 用例详情')
            md.append('')
            
            for i, case in enumerate(cases, 1):
                case_status = case.get('status', 'unknown')
                status_emoji = self._status_emoji(case_status)
                
                md.append(f'### {i}. {case.get("name", f"Case {i}")}')
                md.append(f'')
                md.append(f'**状态**: {status_emoji} {case_status}')
                md.append(f'**用例 ID**: {case.get("case_id", "N/A")}')
                
                if case.get('description'):
                    md.append(f'**描述**: {case["description"]}')
                
                if case.get('tags'):
                    md.append(f'**标签**: {", ".join(case["tags"])}')
                
                md.append('')
                md.append('#### SQL 对比')
                md.append('')
                
                md.append('**原始 SQL**:')
                md.append('```sql')
                md.append(case.get('original_sql', 'N/A'))
                md.append('```')
                md.append('')
                
                md.append('**优化后 SQL**:')
                md.append('```sql')
                md.append(case.get('optimized_sql', 'N/A'))
                md.append('```')
                md.append('')
                
                comparison = case.get('comparison_result')
                if comparison:
                    md.append('#### 对比结果')
                    md.append('')
                    
                    passed = comparison.get('passed', False)
                    md.append(f'**整体通过**: {"是" if passed else "否"}')
                    md.append('')
                    
                    md.append(f'- **行数匹配**: {"是" if comparison.get("row_count_match") else "否"}')
                    if not comparison.get('row_count_match'):
                        md.append(f'  - 原始: {comparison.get("row_count_original")} 行')
                        md.append(f'  - 优化后: {comparison.get("row_count_optimized")} 行')
                    
                    md.append(f'- **列结构匹配**: {"是" if comparison.get("columns_match") else "否"}')
                    
                    if comparison.get('order_sensitive'):
                        md.append(f'- **排序敏感**: 是')
                        md.append(f'- **顺序匹配**: {"是" if comparison.get("order_match") else "否"}')
                    
                    md.append(f'- **NULL 处理匹配**: {"是" if comparison.get("null_handling_match") else "否"}')
                    
                    null_issues = comparison.get('null_aggregation_issues', [])
                    if null_issues:
                        md.append('')
                        md.append('**NULL 聚合注意事项**:')
                        for issue in null_issues:
                            md.append(f'- {issue}')
                    
                    md.append(f'- **JOIN 行数匹配**: {"是" if comparison.get("join_row_count_match") else "否"}')
                    
                    join_issues = comparison.get('join_issues', [])
                    if join_issues:
                        md.append('')
                        md.append('**JOIN 问题**:')
                        for issue in join_issues:
                            md.append(f'- {issue}')
                    
                    explain_diffs = comparison.get('explain_differences', [])
                    if explain_diffs:
                        md.append('')
                        md.append('**EXPLAIN 差异**:')
                        for diff in explain_diffs:
                            md.append(f'- {diff}')
                    
                    perf = comparison.get('performance_comparison', {})
                    if perf:
                        md.append('')
                        md.append('**性能对比**:')
                        
                        orig_time = perf.get('original_time_ms', 0)
                        opt_time = perf.get('optimized_time_ms', 0)
                        
                        md.append(f'- 原始耗时: {orig_time:.2f}ms')
                        md.append(f'- 优化后耗时: {opt_time:.2f}ms')
                        
                        if perf.get('is_faster'):
                            speedup = perf.get('speedup_ratio', 1)
                            md.append(f'- **性能提升**: {speedup:.2f}x ⚡')
                        else:
                            time_diff = perf.get('time_diff_ms', 0)
                            md.append(f'- **性能下降**: 慢了 {time_diff:.2f}ms ⚠️')
                    
                    sample_mismatches = comparison.get('sample_mismatches', [])
                    if sample_mismatches:
                        md.append('')
                        md.append('**数据不一致样本** (最多显示 10 条):')
                        md.append('')
                        
                        for mismatch in sample_mismatches[:10]:
                            md.append(f'- **行 {mismatch.get("row_index", "?")}**:')
                            md.append('  - 原始:')
                            md.append('  ```json')
                            md.append(json.dumps(mismatch.get('original', {}), indent=2, ensure_ascii=False))
                            md.append('  ```')
                            md.append('  - 优化后:')
                            md.append('  ```json')
                            md.append(json.dumps(mismatch.get('optimized', {}), indent=2, ensure_ascii=False))
                            md.append('  ```')
                            md.append('')
                
                suggestions = case.get('suggestions', [])
                if suggestions:
                    md.append('')
                    md.append('#### 优化建议')
                    md.append('')
                    for suggestion in suggestions:
                        md.append(f'- {suggestion}')
                
                error_msg = case.get('error_message')
                if error_msg:
                    md.append('')
                    md.append('#### 错误信息')
                    md.append('')
                    md.append('```')
                    md.append(error_msg)
                    md.append('```')
                
                md.append('')
                md.append('---')
                md.append('')
        
        if validation.get('error_message'):
            md.append('## 全局错误')
            md.append('')
            md.append('```')
            md.append(validation['error_message'])
            md.append('```')
            md.append('')
        
        md.append('---')
        md.append('')
        md.append(f'*报告生成时间: {datetime.now().isoformat()}*')
        md.append('')
        
        return '\n'.join(md)
    
    def _status_emoji(self, status: Optional[str]) -> str:
        if not status:
            return '❓'
        
        status_lower = status.lower()
        if status_lower == 'passed':
            return '✅'
        elif status_lower == 'failed':
            return '❌'
        elif status_lower == 'error':
            return '⚠️'
        elif status_lower == 'running':
            return '🔄'
        elif status_lower == 'pending':
            return '⏳'
        elif status_lower == 'manually_confirmed':
            return '✓'
        else:
            return '❓'
