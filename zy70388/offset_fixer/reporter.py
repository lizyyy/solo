from datetime import datetime
from typing import Dict, List, Optional
from .models import OffsetStatus


class Reporter:
    def __init__(self):
        pass
        
    def generate_inspection_report(self, inspections: List[Dict]) -> Dict:
        normal = []
        future = []
        needs_rollback = []
        not_found = []
        
        for insp in inspections:
            status = insp.get('status')
            if status == OffsetStatus.NORMAL.value:
                normal.append(insp)
            elif status == OffsetStatus.FUTURE.value:
                future.append(insp)
            elif status == OffsetStatus.NEEDS_ROLLBACK.value:
                needs_rollback.append(insp)
            elif status == OffsetStatus.PARTITION_NOT_FOUND.value:
                not_found.append(insp)
                
        return {
            'report_type': 'inspection',
            'generated_at': datetime.now().isoformat(),
            'summary': {
                'total': len(inspections),
                'normal': len(normal),
                'future': len(future),
                'needs_rollback': len(needs_rollback),
                'not_found': len(not_found)
            },
            'details': {
                'normal_partitions': normal,
                'future_partitions': future,
                'needs_rollback_partitions': needs_rollback,
                'not_found_partitions': not_found
            },
            'recommendations': self._generate_inspection_recommendations(future, needs_rollback)
        }
        
    def _generate_inspection_recommendations(self, future: List[Dict], 
                                             needs_rollback: List[Dict]) -> List[str]:
        recommendations = []
        
        if future:
            for f in future:
                gap = f.get('current_offset', 0) - f.get('latest_offset', 0)
                recommendations.append(
                    f"分区 {f['topic']}-{f['partition']}: 位点超前 {gap} 条，建议回退到 {f['latest_offset']}"
                )
                
        if needs_rollback:
            for r in needs_rollback:
                recommendations.append(
                    f"分区 {r['topic']}-{r['partition']}: 位点落后，建议前移到 {r['earliest_offset']}"
                )
                
        if not recommendations:
            recommendations.append("所有分区位点正常，无需调整")
            
        return recommendations
        
    def generate_plan_report(self, plans: List[Dict]) -> Dict:
        executable = [p for p in plans if p.get('can_execute', False)]
        blocked = [p for p in plans if not p.get('can_execute', False)]
        
        total_duplicate = sum(
            p.get('risk_assessment', {}).get('duplicate_count', 0) for p in executable
        )
        total_missing = sum(
            p.get('risk_assessment', {}).get('missing_count', 0) for p in executable
        )
        high_risk = [
            p for p in executable 
            if p.get('risk_assessment', {}).get('risk_level') == 'high'
        ]
        
        consumers_need_check = []
        for p in executable:
            consumers = p.get('consumers_needing_idempotent_check', [])
            for c in consumers:
                if c not in consumers_need_check:
                    consumers_need_check.append(c)
                    
        return {
            'report_type': 'adjustment_plan',
            'generated_at': datetime.now().isoformat(),
            'summary': {
                'total_plans': len(plans),
                'executable': len(executable),
                'blocked': len(blocked),
                'high_risk': len(high_risk),
                'estimated_duplicate_messages': total_duplicate,
                'estimated_missing_messages': total_missing
            },
            'details': {
                'executable_plans': executable,
                'blocked_plans': blocked
            },
            'consumers_needing_idempotent_check': consumers_need_check,
            'recommendations': self._generate_plan_recommendations(executable, blocked, high_risk)
        }
        
    def _generate_plan_recommendations(self, executable: List[Dict], 
                                      blocked: List[Dict],
                                      high_risk: List[Dict]) -> List[str]:
        recommendations = []
        
        if blocked:
            for b in blocked:
                recommendations.append(
                    f"分区 {b['topic']}-{b['partition']}: {b.get('reason', '未知原因')}"
                )
                
        if high_risk:
            for h in high_risk:
                details = h.get('risk_assessment', {}).get('details', '')
                recommendations.append(
                    f"⚠️ 高风险：分区 {h['topic']}-{h['partition']} - {details}"
                )
                
        if executable and not high_risk:
            recommendations.append("所有可执行计划风险较低，可以继续执行")
            
        return recommendations
        
    def generate_verification_report(self, verifications: List[Dict],
                                    adjustment_history: List[Dict]) -> Dict:
        passed = [v for v in verifications if v.get('is_correct', False)]
        failed = [v for v in verifications if not v.get('is_correct', False)]
        
        return {
            'report_type': 'verification',
            'generated_at': datetime.now().isoformat(),
            'summary': {
                'total': len(verifications),
                'passed': len(passed),
                'failed': len(failed),
                'success_rate': (len(passed) / len(verifications) * 100) if verifications else 0
            },
            'details': {
                'passed_verifications': passed,
                'failed_verifications': failed
            },
            'adjustment_history': adjustment_history,
            'recommendations': self._generate_verification_recommendations(failed)
        }
        
    def _generate_verification_recommendations(self, failed: List[Dict]) -> List[str]:
        recommendations = []
        
        if failed:
            for f in failed:
                recommendations.append(
                    f"分区 {f['topic']}-{f['partition']}: {f.get('message', '验证失败')}"
                )
            recommendations.append("⚠️ 存在验证失败的分区，请检查位点是否正确移动")
        else:
            recommendations.append("所有验证通过，位点调整成功")
            
        return recommendations
        
    def generate_full_report(self, inspection_report: Dict, 
                            plan_report: Dict,
                            verification_report: Dict) -> Dict:
        return {
            'report_type': 'full',
            'generated_at': datetime.now().isoformat(),
            'inspection': inspection_report,
            'adjustment_plan': plan_report,
            'verification': verification_report,
            'overall_status': self._determine_overall_status(verification_report)
        }
        
    def _determine_overall_status(self, verification_report: Dict) -> str:
        summary = verification_report.get('summary', {})
        if summary.get('failed', 0) > 0:
            return 'failed'
        elif summary.get('total', 0) == 0:
            return 'no_verification'
        else:
            return 'success'
