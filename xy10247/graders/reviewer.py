from datetime import datetime
from typing import Dict, Optional

from graders.models import SampleResult, ReviewStatus, SeverityLevel, ReviewInfo


class ReviewManager:
    def __init__(self, batch_manager):
        self.batch_manager = batch_manager
    
    def list_pending(self, batch_id: str) -> list:
        results = self.batch_manager.get_batch_results(batch_id)
        if not results:
            return []
        
        pending = []
        for sample_id, result_data in results.items():
            status = result_data.get('review_status', ReviewStatus.PENDING.value)
            if status == ReviewStatus.PENDING.value:
                pending.append({
                    'sample_id': sample_id,
                    'rule_grade': result_data.get('rule_grade', {}).get('grade'),
                    'rule_score': result_data.get('rule_grade', {}).get('score'),
                    'lesion_ratio': result_data.get('features', {}).get('area_features', {}).get('lesion_ratio'),
                    'lesion_color': result_data.get('features', {}).get('color_features', {}).get('color_category'),
                })
        
        return pending
    
    def approve(self, batch_id: str, sample_id: str, reviewer_id: str,
               comment: str = "") -> bool:
        results = self.batch_manager.get_batch_results(batch_id)
        if not results or sample_id not in results:
            return False
        
        result_data = results[sample_id]
        rule_grade = result_data.get('rule_grade', {}).get('grade')
        
        result_data['review_status'] = ReviewStatus.APPROVED.value
        result_data['review_info'] = {
            'reviewer_id': reviewer_id,
            'reviewed_at': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            'final_grade': rule_grade,
            'comment': comment or "确认规则分级结果"
        }
        result_data['final_grade'] = rule_grade
        result_data['version'] = result_data.get('version', 1)
        
        results[sample_id] = result_data
        self.batch_manager.save_batch_results(batch_id, results)
        self._update_batch_stats(batch_id)
        
        return True
    
    def reject(self, batch_id: str, sample_id: str, reviewer_id: str,
              comment: str = "") -> bool:
        results = self.batch_manager.get_batch_results(batch_id)
        if not results or sample_id not in results:
            return False
        
        result_data = results[sample_id]
        
        result_data['review_status'] = ReviewStatus.REJECTED.value
        result_data['review_info'] = {
            'reviewer_id': reviewer_id,
            'reviewed_at': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            'final_grade': None,
            'comment': comment or "驳回规则分级结果，需要重新评估"
        }
        result_data['final_grade'] = None
        result_data['version'] = result_data.get('version', 1)
        
        results[sample_id] = result_data
        self.batch_manager.save_batch_results(batch_id, results)
        self._update_batch_stats(batch_id)
        
        return True
    
    def modify(self, batch_id: str, sample_id: str, reviewer_id: str,
              new_grade: SeverityLevel, comment: str = "") -> bool:
        results = self.batch_manager.get_batch_results(batch_id)
        if not results or sample_id not in results:
            return False
        
        result_data = results[sample_id]
        rule_grade = result_data.get('rule_grade', {}).get('grade')
        
        result_data['review_status'] = ReviewStatus.MODIFIED.value
        result_data['review_info'] = {
            'reviewer_id': reviewer_id,
            'reviewed_at': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            'final_grade': new_grade.value,
            'comment': comment or f"原分级：{rule_grade}，修正为：{new_grade.value}"
        }
        result_data['final_grade'] = new_grade.value
        result_data['version'] = result_data.get('version', 1) + 1
        
        results[sample_id] = result_data
        self.batch_manager.save_batch_results(batch_id, results)
        self._update_batch_stats(batch_id)
        
        return True
    
    def get_sample_detail(self, batch_id: str, sample_id: str) -> Optional[Dict]:
        results = self.batch_manager.get_batch_results(batch_id)
        if not results or sample_id not in results:
            return None
        
        return results[sample_id]
    
    def _update_batch_stats(self, batch_id: str):
        results = self.batch_manager.get_batch_results(batch_id)
        if not results:
            return
        
        stats = {
            'total': len(results),
            'pending': 0,
            'approved': 0,
            'rejected': 0,
            'modified': 0
        }
        
        for result_data in results.values():
            status = result_data.get('review_status', ReviewStatus.PENDING.value)
            if status == ReviewStatus.PENDING.value:
                stats['pending'] += 1
            elif status == ReviewStatus.APPROVED.value:
                stats['approved'] += 1
            elif status == ReviewStatus.REJECTED.value:
                stats['rejected'] += 1
            elif status == ReviewStatus.MODIFIED.value:
                stats['modified'] += 1
        
        state = self.batch_manager.get_batch_state(batch_id) or {}
        state['review_stats'] = stats
        self.batch_manager.save_batch_state(batch_id, state)
