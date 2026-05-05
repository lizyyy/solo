from typing import Dict, Any, List, Optional
from datetime import datetime
import json


class MarkdownReport:
    """Markdown 报告生成器"""
    
    def __init__(self, config: Dict = None):
        self.config = config or {}
    
    def generate(self,
                 task_data: Dict,
                 comparison_results: List[Dict],
                 differences: List[Dict],
                 confirmations: List[Dict] = None) -> str:
        """生成 Markdown 报告"""
        confirmations = confirmations or []
        
        lines = []
        
        lines.append(f'# RPC 迁移评审报告: {task_data.get("name", "未命名任务")}')
        lines.append('')
        lines.append(f'**生成时间**: {datetime.utcnow().isoformat()}')
        lines.append(f'**任务状态**: {task_data.get("status", "unknown")}')
        if task_data.get('description'):
            lines.append(f'**描述**: {task_data["description"]}')
        lines.append('')
        
        lines.append('## 1. 概览')
        lines.append('')
        
        total_comparisons = len(comparison_results)
        matched_comparisons = sum(1 for r in comparison_results if r.get('is_match', False))
        total_differences = len(differences)
        critical_differences = sum(1 for d in differences if d.get('severity') == 'critical')
        warning_differences = sum(1 for d in differences if d.get('severity') == 'warning')
        resolved_differences = sum(1 for d in differences if d.get('is_resolved', False))
        
        lines.append('| 指标 | 值 |')
        lines.append('|------|-----|')
        lines.append(f'| 总对比项 | {total_comparisons} |')
        lines.append(f'| 匹配项 | {matched_comparisons} |')
        lines.append(f'| 总差异数 | {total_differences} |')
        lines.append(f'| 严重差异 | {critical_differences} |')
        lines.append(f'| 警告差异 | {warning_differences} |')
        lines.append(f'| 已解决差异 | {resolved_differences} |')
        lines.append('')
        
        lines.append('## 2. 详细差异')
        lines.append('')
        
        if not differences:
            lines.append('✅ **无差异发现**')
            lines.append('')
        else:
            critical_diffs = [d for d in differences if d.get('severity') == 'critical']
            warning_diffs = [d for d in differences if d.get('severity') == 'warning']
            info_diffs = [d for d in differences if d.get('severity') == 'info']
            
            if critical_diffs:
                lines.append('### 2.1 严重差异 (Critical)')
                lines.append('')
                for i, diff in enumerate(critical_diffs, 1):
                    lines.append(f'#### 差异 #{i}: {diff.get("difference_type", "unknown")}')
                    lines.append('')
                    lines.append(f'**状态**: {"✅ 已解决" if diff.get("is_resolved") else "❌ 未解决"}')
                    lines.append(f'**描述**: {diff.get("description", "")}')
                    lines.append('')
                    
                    legacy_val = diff.get('legacy_value')
                    grpc_val = diff.get('grpc_value')
                    
                    if legacy_val is not None:
                        lines.append(f'**老 RPC 值**:')
                        lines.append('```json')
                        lines.append(json.dumps(legacy_val, ensure_ascii=False, indent=2))
                        lines.append('```')
                        lines.append('')
                    
                    if grpc_val is not None:
                        lines.append(f'**gRPC 值**:')
                        lines.append('```json')
                        lines.append(json.dumps(grpc_val, ensure_ascii=False, indent=2))
                        lines.append('```')
                        lines.append('')
                    
                    if diff.get('suggestion'):
                        lines.append(f'**建议**: {diff["suggestion"]}')
                        lines.append('')
                    
                    lines.append('---')
                    lines.append('')
            
            if warning_diffs:
                lines.append('### 2.2 警告差异 (Warning)')
                lines.append('')
                for i, diff in enumerate(warning_diffs, 1):
                    lines.append(f'#### 差异 #{i}: {diff.get("difference_type", "unknown")}')
                    lines.append('')
                    lines.append(f'**状态**: {"✅ 已解决" if diff.get("is_resolved") else "⚠️ 未解决"}')
                    lines.append(f'**描述**: {diff.get("description", "")}')
                    lines.append('')
                    
                    if diff.get('suggestion'):
                        lines.append(f'**建议**: {diff["suggestion"]}')
                        lines.append('')
                    
                    lines.append('---')
                    lines.append('')
            
            if info_diffs:
                lines.append('### 2.3 信息差异 (Info)')
                lines.append('')
                for i, diff in enumerate(info_diffs, 1):
                    lines.append(f'#### 差异 #{i}: {diff.get("difference_type", "unknown")}')
                    lines.append('')
                    lines.append(f'**描述**: {diff.get("description", "")}')
                    lines.append('')
                    lines.append('---')
                    lines.append('')
        
        lines.append('## 3. 人工确认记录')
        lines.append('')
        
        if not confirmations:
            lines.append('暂无人工确认记录')
            lines.append('')
        else:
            for i, conf in enumerate(confirmations, 1):
                lines.append(f'### 确认 #{i}')
                lines.append('')
                lines.append(f'**确认人**: {conf.get("confirmed_by", "unknown")}')
                lines.append(f'**确认类型**: {conf.get("confirmation_type", "unknown")}')
                lines.append(f'**时间**: {conf.get("created_at", "")}')
                if conf.get('comment'):
                    lines.append(f'**评论**: {conf["comment"]}')
                lines.append('')
                lines.append('---')
                lines.append('')
        
        lines.append('## 4. 对比详情')
        lines.append('')
        
        comparison_types = {}
        for result in comparison_results:
            comp_type = result.get('comparison_type', 'unknown')
            if comp_type not in comparison_types:
                comparison_types[comp_type] = []
            comparison_types[comp_type].append(result)
        
        for comp_type, results in comparison_types.items():
            lines.append(f'### 4.1 {comp_type} 对比')
            lines.append('')
            
            matched = sum(1 for r in results if r.get('is_match', False))
            total = len(results)
            
            lines.append(f'**匹配情况**: {matched}/{total} ({matched/total*100:.1f}%)')
            lines.append('')
            
            for i, result in enumerate(results, 1):
                status = '✅' if result.get('is_match') else '❌'
                lines.append(f'{status} 对比 #{i}')
                lines.append('')
                
                if not result.get('is_match'):
                    issues = result.get('issues', [])
                    for issue in issues:
                        lines.append(f'- **{issue.get("severity", "warning")}**: {issue.get("message", "")}')
                    lines.append('')
                
                lines.append('')
            
            lines.append('---')
            lines.append('')
        
        return '\n'.join(lines)
