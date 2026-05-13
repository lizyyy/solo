from datetime import datetime
from typing import Dict, List, Optional
from .models import AdjustmentTarget, PartitionInfo, RiskAssessment


class AdjustmentPlan:
    def __init__(self):
        self._planned_adjustments: List[Dict] = []
        
    def create_plan(self, target: AdjustmentTarget, partition_info: PartitionInfo,
                   current_offset: int, consumer_online: bool,
                   consumers_needing_check: List) -> Dict:
        if consumer_online:
            return {
                'topic': target.topic,
                'partition': target.partition,
                'status': 'blocked',
                'reason': '消费者在线，禁止调整位点',
                'can_execute': False
            }
            
        valid_target = self._validate_target(target.target_offset, partition_info)
        risk = self._assess_risk(current_offset, valid_target, partition_info)
        
        plan = {
            'topic': target.topic,
            'partition': target.partition,
            'current_offset': current_offset,
            'requested_target': target.target_offset,
            'valid_target': valid_target,
            'risk_assessment': risk.to_dict(),
            'consumers_needing_idempotent_check': [c.to_dict() for c in consumers_needing_check],
            'is_idempotent': (current_offset == valid_target),
            'can_execute': True,
            'reason': target.reason,
            'created_at': datetime.now().isoformat()
        }
        
        self._planned_adjustments.append(plan)
        return plan
        
    def _validate_target(self, target: int, info: PartitionInfo) -> int:
        if target < info.earliest_offset:
            return info.earliest_offset
        elif target > info.latest_offset:
            return info.latest_offset
        return target
        
    def _assess_risk(self, current: int, target: int, info: PartitionInfo) -> RiskAssessment:
        duplicate_count = 0
        missing_count = 0
        
        if target < current:
            duplicate_count = current - target
        elif target > current:
            missing_count = target - current
            
        if missing_count > 0:
            risk_level = "high"
            details = f"将跳过 {missing_count} 条消息，存在数据丢失风险！"
        elif duplicate_count > 1000:
            risk_level = "high"
            details = f"将重复处理 {duplicate_count} 条消息，风险较高"
        elif duplicate_count > 100:
            risk_level = "medium"
            details = f"将重复处理 {duplicate_count} 条消息，请确保业务幂等"
        else:
            risk_level = "low"
            details = f"将重复处理 {duplicate_count} 条消息，风险较低"
            
        return RiskAssessment(
            topic=info.topic,
            partition=info.partition,
            duplicate_count=duplicate_count,
            missing_count=missing_count,
            risk_level=risk_level,
            details=details
        )
        
    def get_plan(self, topic: str, partition: int) -> Optional[Dict]:
        for plan in self._planned_adjustments:
            if plan['topic'] == topic and plan['partition'] == partition:
                return plan
        return None
        
    def get_all_plans(self) -> List[Dict]:
        return self._planned_adjustments
