
import hashlib
import json
from datetime import datetime
from typing import Optional, Dict, Any, List

from config import Config


class BucketingService:
    
    @staticmethod
    def compute_bucket(user_key: str, experiment_id: str, 
                       salt: Optional[str] = None) -> int:
        if salt is None:
            salt = experiment_id
        
        combined = f"{salt}:{user_key}"
        hash_value = hashlib.sha256(combined.encode('utf-8')).hexdigest()
        
        bucket = int(hash_value[:16], 16) % Config.BUCKET_COUNT
        return bucket
    
    @staticmethod
    def get_treatment_for_bucket(bucket: int, treatments: List[Dict]) -> Optional[Dict]:
        for treatment in treatments:
            if treatment['bucket_start'] <= bucket <= treatment['bucket_end']:
                return treatment
        return None


class VersionFreezeService:
    
    @staticmethod
    def validate_freeze_ready(version, existing_assignments_count: int) -> Dict[str, Any]:
        issues = []
        
        if version.is_frozen:
            issues.append('版本已冻结')
        
        if not version.effective_start:
            issues.append('缺少生效开始时间')
        
        treatments = version.treatments
        if not treatments:
            issues.append('未配置实验分组')
        else:
            total_percent = sum(t.traffic_percent for t in treatments)
            if abs(total_percent - 100.0) > 0.01:
                issues.append(f'流量分配总和应为100%，当前为{total_percent}%')
            
            control_count = sum(1 for t in treatments if t.is_control)
            if control_count == 0:
                issues.append('缺少对照组')
        
        return {
            'ready': len(issues) == 0,
            'issues': issues,
            'existing_assignments': existing_assignments_count
        }
    
    @staticmethod
    def can_unfreeze(version, elapsed_hours: float, 
                     assignments_count: int) -> Dict[str, Any]:
        issues = []
        
        if not version.is_frozen:
            issues.append('版本未冻结')
        
        if elapsed_hours > 24 and assignments_count > 100:
            issues.append(f'冻结超过24小时且已分配{assignments_count}个用户，不支持撤销')
        
        return {
            'can_unfreeze': len(issues) == 0,
            'issues': issues
        }


class ConflictDetectionService:
    
    @staticmethod
    def check_version_conflict(new_version, old_version, 
                               new_treatments: List[Dict], 
                               old_treatments: List[Dict]) -> Dict[str, Any]:
        conflicts = []
        
        if new_version.bucket_strategy != old_version.bucket_strategy:
            conflicts.append({
                'type': 'strategy_changed',
                'field': 'bucket_strategy',
                'old': old_version.bucket_strategy,
                'new': new_version.bucket_strategy,
                'severity': 'high',
                'description': '分桶策略变更将导致所有用户重新分桶'
            })
        
        if new_version.bucket_count != old_version.bucket_count:
            conflicts.append({
                'type': 'bucket_count_changed',
                'field': 'bucket_count',
                'old': old_version.bucket_count,
                'new': new_version.bucket_count,
                'severity': 'high',
                'description': '分桶数量变更将改变哈希取模结果'
            })
        
        old_map = {t['name']: t for t in old_treatments}
        new_map = {t['name']: t for t in new_treatments}
        
        all_names = set(old_map.keys()) | set(new_map.keys())
        
        for name in all_names:
            if name not in old_map:
                conflicts.append({
                    'type': 'treatment_added',
                    'treatment': name,
                    'severity': 'medium',
                    'description': f'新增分组 {name}'
                })
            elif name not in new_map:
                conflicts.append({
                    'type': 'treatment_removed',
                    'treatment': name,
                    'severity': 'high',
                    'description': f'删除现有分组 {name}'
                })
            else:
                old_t = old_map[name]
                new_t = new_map[name]
                
                if old_t['bucket_start'] != new_t['bucket_start'] or old_t['bucket_end'] != new_t['bucket_end']:
                    conflicts.append({
                        'type': 'bucket_range_changed',
                        'treatment': name,
                        'old_range': f'{old_t["bucket_start"]}-{old_t["bucket_end"]}',
                        'new_range': f'{new_t["bucket_start"]}-{new_t["bucket_end"]}',
                        'severity': 'high',
                        'description': f'分组 {name} 的分桶范围变更'
                    })
                
                if old_t.get('is_control', False) != new_t.get('is_control', False):
                    conflicts.append({
                        'type': 'control_changed',
                        'treatment': name,
                        'severity': 'critical',
                        'description': f'分组 {name} 的对照组标记变更'
                    })
        
        return {
            'has_conflicts': len(conflicts) > 0,
            'conflicts': conflicts,
            'high_severity_count': sum(1 for c in conflicts if c['severity'] in ['high', 'critical']),
            'critical_count': sum(1 for c in conflicts if c['severity'] == 'critical')
        }


class RetryPolicy:
    
    @staticmethod
    def get_next_retry_delay(retry_count: int) -> float:
        delay = Config.RETRY_INITIAL_DELAY * (2 ** retry_count)
        return min(delay, Config.RETRY_MAX_DELAY)
    
    @staticmethod
    def should_retry(status: str, retry_count: int) -> bool:
        if retry_count >= Config.RETRY_MAX_ATTEMPTS:
            return False
        if status in ['success', 'cancelled']:
            return False
        return True


class AttributionService:
    
    @staticmethod
    def attribute_metric(user_id: str, event_time: datetime, 
                         versions: List[Any]) -> Optional[Dict[str, Any]]:
        for version in versions:
            if version.is_frozen:
                if version.effective_start and event_time < version.effective_start:
                    continue
                
                if version.effective_end and event_time > version.effective_end:
                    continue
                
                from app.models import UserAssignment
                assignment = UserAssignment.query.filter_by(
                    version_id=version.id,
                    user_id=user_id
                ).first()
                
                if assignment:
                    return {
                        'version_id': version.id,
                        'version_number': version.version_number,
                        'treatment_name': assignment.treatment_name,
                        'bucket_number': assignment.bucket_number,
                        'attribution_method': 'explicit_assignment'
                    }
        
        for version in reversed(versions):
            if version.is_frozen and version.effective_start:
                if version.effective_start <= event_time:
                    if not version.effective_end or event_time <= version.effective_end:
                        bucket = BucketingService.compute_bucket(
                            user_id, version.experiment_id
                        )
                        
                        treatments = [t.to_dict() for t in version.treatments]
                        treatment = BucketingService.get_treatment_for_bucket(bucket, treatments)
                        
                        if treatment:
                            return {
                                'version_id': version.id,
                                'version_number': version.version_number,
                                'treatment_name': treatment['name'],
                                'bucket_number': bucket,
                                'attribution_method': 'backfill_hash'
                            }
        
        return None
