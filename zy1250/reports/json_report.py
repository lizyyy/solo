from typing import Dict, Any, List, Optional
from datetime import datetime
import json


class JsonReport:
    """JSON 报告生成器"""
    
    def __init__(self, config: Dict = None):
        self.config = config or {}
    
    def generate(self,
                 task_data: Dict,
                 comparison_results: List[Dict],
                 differences: List[Dict],
                 confirmations: List[Dict] = None) -> str:
        """生成 JSON 报告"""
        confirmations = confirmations or []
        
        total_comparisons = len(comparison_results)
        matched_comparisons = sum(1 for r in comparison_results if r.get('is_match', False))
        total_differences = len(differences)
        critical_differences = sum(1 for d in differences if d.get('severity') == 'critical')
        warning_differences = sum(1 for d in differences if d.get('severity') == 'warning')
        info_differences = sum(1 for d in differences if d.get('severity') == 'info')
        resolved_differences = sum(1 for d in differences if d.get('is_resolved', False))
        
        comparison_summary = {}
        for result in comparison_results:
            comp_type = result.get('comparison_type', 'unknown')
            if comp_type not in comparison_summary:
                comparison_summary[comp_type] = {
                    'total': 0,
                    'matched': 0,
                    'issues': []
                }
            
            comparison_summary[comp_type]['total'] += 1
            if result.get('is_match'):
                comparison_summary[comp_type]['matched'] += 1
            
            issues = result.get('issues', [])
            for issue in issues:
                comparison_summary[comp_type]['issues'].append({
                    'severity': issue.get('severity', 'warning'),
                    'message': issue.get('message', ''),
                    'field_path': issue.get('field_path', '')
                })
        
        report = {
            'report_type': 'rpc_migration_review',
            'generated_at': datetime.utcnow().isoformat(),
            'task': {
                'id': task_data.get('id'),
                'name': task_data.get('name'),
                'description': task_data.get('description', ''),
                'status': task_data.get('status', 'unknown'),
                'created_at': task_data.get('created_at')
            },
            'summary': {
                'total_comparisons': total_comparisons,
                'matched_comparisons': matched_comparisons,
                'match_rate': matched_comparisons / total_comparisons if total_comparisons > 0 else 0,
                'total_differences': total_differences,
                'critical_differences': critical_differences,
                'warning_differences': warning_differences,
                'info_differences': info_differences,
                'resolved_differences': resolved_differences,
                'unresolved_differences': total_differences - resolved_differences
            },
            'comparison_summary': comparison_summary,
            'differences': [
                {
                    'id': d.get('id'),
                    'difference_type': d.get('difference_type'),
                    'severity': d.get('severity'),
                    'description': d.get('description'),
                    'legacy_value': d.get('legacy_value'),
                    'grpc_value': d.get('grpc_value'),
                    'suggestion': d.get('suggestion'),
                    'is_resolved': d.get('is_resolved'),
                    'resolved_by': d.get('resolved_by'),
                    'resolved_at': d.get('resolved_at'),
                    'created_at': d.get('created_at')
                }
                for d in differences
            ],
            'comparison_results': comparison_results,
            'confirmations': [
                {
                    'id': c.get('id'),
                    'confirmed_by': c.get('confirmed_by'),
                    'confirmation_type': c.get('confirmation_type'),
                    'comment': c.get('comment'),
                    'created_at': c.get('created_at')
                }
                for c in confirmations
            ]
        }
        
        return json.dumps(report, ensure_ascii=False, indent=2, default=str)
