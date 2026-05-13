from datetime import datetime
from typing import Dict, List, Optional
from .models import VerificationResult


class Verifier:
    def __init__(self):
        self._verification_history: List[VerificationResult] = []
        
    def verify_offset(self, topic: str, partition: int, expected_offset: int,
                     actual_offset: Optional[int]) -> VerificationResult:
        if actual_offset is None:
            result = VerificationResult(
                topic=topic,
                partition=partition,
                expected_offset=expected_offset,
                actual_offset=-1,
                is_correct=False,
                message=f"分区 {topic}-{partition} 不存在或无法获取位点"
            )
        elif actual_offset == expected_offset:
            result = VerificationResult(
                topic=topic,
                partition=partition,
                expected_offset=expected_offset,
                actual_offset=actual_offset,
                is_correct=True,
                message=f"位点验证通过，当前位点 {actual_offset} 等于预期值"
            )
        else:
            result = VerificationResult(
                topic=topic,
                partition=partition,
                expected_offset=expected_offset,
                actual_offset=actual_offset,
                is_correct=False,
                message=f"位点验证失败：预期 {expected_offset}，实际 {actual_offset}"
            )
            
        self._verification_history.append(result)
        return result
        
    def verify_adjustment_range(self, topic: str, partition: int,
                               earliest_offset: int, latest_offset: int,
                               target_offset: int) -> Dict:
        is_valid = earliest_offset <= target_offset <= latest_offset
        
        if is_valid:
            message = f"目标位点 {target_offset} 在有效范围 [{earliest_offset}, {latest_offset}] 内"
        elif target_offset < earliest_offset:
            message = f"目标位点 {target_offset} 小于最早位点 {earliest_offset}"
        else:
            message = f"目标位点 {target_offset} 大于最新位点 {latest_offset}"
            
        return {
            'topic': topic,
            'partition': partition,
            'target_offset': target_offset,
            'earliest_offset': earliest_offset,
            'latest_offset': latest_offset,
            'is_valid': is_valid,
            'message': message
        }
        
    def get_verification_history(self, topic: Optional[str] = None,
                                partition: Optional[int] = None) -> List[VerificationResult]:
        history = self._verification_history
        if topic:
            history = [h for h in history if h.topic == topic]
        if partition is not None:
            history = [h for h in history if h.partition == partition]
        return history
        
    def get_summary(self) -> Dict:
        total = len(self._verification_history)
        passed = sum(1 for r in self._verification_history if r.is_correct)
        failed = total - passed
        
        return {
            'total': total,
            'passed': passed,
            'failed': failed,
            'success_rate': (passed / total * 100) if total > 0 else 0
        }
