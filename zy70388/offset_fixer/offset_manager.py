from datetime import datetime
from typing import Dict, List, Optional, Tuple
from .models import PartitionInfo, AdjustmentTarget, AdjustmentResult, OffsetStatus


class OffsetManager:
    def __init__(self):
        self._offsets: Dict[Tuple[str, int], int] = {}
        self._history: List[Dict] = []
        
    def get_current_offset(self, topic: str, partition: int) -> Optional[int]:
        return self._offsets.get((topic, partition))
        
    def set_current_offset(self, topic: str, partition: int, offset: int):
        self._offsets[(topic, partition)] = offset
        
    def inspect(self, topic: str, partition: int, partition_info: PartitionInfo) -> Dict:
        current = self.get_current_offset(topic, partition)
        if current is None:
            return {
                'topic': topic,
                'partition': partition,
                'status': OffsetStatus.PARTITION_NOT_FOUND.value,
                'current_offset': None,
                'message': f'分区 {topic}-{partition} 不存在或位点未记录'
            }
        
        status = self._calculate_status(current, partition_info)
        analysis = self._analyze_status(current, partition_info, status)
        
        return {
            'topic': topic,
            'partition': partition,
            'current_offset': current,
            'earliest_offset': partition_info.earliest_offset,
            'latest_offset': partition_info.latest_offset,
            'status': status.value,
            'analysis': analysis
        }
        
    def _calculate_status(self, current: int, info: PartitionInfo) -> OffsetStatus:
        if current > info.latest_offset:
            return OffsetStatus.FUTURE
        elif current < info.earliest_offset:
            return OffsetStatus.NEEDS_ROLLBACK
        else:
            return OffsetStatus.NORMAL
            
    def _analyze_status(self, current: int, info: PartitionInfo, status: OffsetStatus) -> str:
        if status == OffsetStatus.FUTURE:
            gap = current - info.latest_offset
            return f"位点在未来 {gap} 条消息之后，需要回退到 {info.latest_offset}"
        elif status == OffsetStatus.NEEDS_ROLLBACK:
            gap = info.earliest_offset - current
            return f"位点早于最早消息，需要前移到 {info.earliest_offset}"
        else:
            return "位点正常，位于 [earliest, latest] 范围内"
            
    def plan_adjustment(self, target: AdjustmentTarget, partition_info: PartitionInfo,
                        consumer_online: bool) -> Dict:
        current = self.get_current_offset(target.topic, target.partition)
        if current is None:
            return {
                'success': False,
                'error': f'分区 {target.topic}-{target.partition} 不存在',
                'risk': None
            }
            
        if consumer_online:
            return {
                'success': False,
                'error': f'消费者在线，禁止调整位点 {target.topic}-{target.partition}',
                'risk': None
            }
            
        target_offset = target.target_offset
        if target_offset < partition_info.earliest_offset:
            target_offset = partition_info.earliest_offset
        elif target_offset > partition_info.latest_offset:
            target_offset = partition_info.latest_offset
            
        risk = self._calculate_risk(current, target_offset, partition_info)
        
        return {
            'success': True,
            'current_offset': current,
            'target_offset': target_offset,
            'is_idempotent': (current == target_offset),
            'risk': risk,
            'recommendation': self._generate_recommendation(current, target_offset, risk)
        }
        
    def _calculate_risk(self, current: int, target: int, info: PartitionInfo) -> Dict:
        duplicate_count = 0
        missing_count = 0
        risk_level = "low"
        
        if target < current:
            duplicate_count = current - target
            if duplicate_count > 1000:
                risk_level = "high"
            elif duplicate_count > 100:
                risk_level = "medium"
        elif target > current:
            missing_count = target - current
            if missing_count > 0:
                risk_level = "high"
                
        return {
            'duplicate_count': duplicate_count,
            'missing_count': missing_count,
            'risk_level': risk_level
        }
        
    def _generate_recommendation(self, current: int, target: int, risk: Dict) -> str:
        if current == target:
            return "当前位点已等于目标位点，无需调整（幂等）"
        elif target < current:
            return f"回退位点，将重复处理 {risk['duplicate_count']} 条消息，请确保业务幂等"
        else:
            return f"前移位点，将跳过 {risk['missing_count']} 条消息，这可能导致数据丢失！"
            
    def execute_adjustment(self, target: AdjustmentTarget, operator: str,
                          partition_info: PartitionInfo, consumer_online: bool) -> AdjustmentResult:
        current = self.get_current_offset(target.topic, target.partition)
        
        if current is None:
            return AdjustmentResult(
                success=False,
                message=f'分区 {target.topic}-{target.partition} 不存在',
                operator=operator,
                timestamp=datetime.now()
            )
            
        if consumer_online:
            return AdjustmentResult(
                success=False,
                message=f'消费者在线，禁止调整位点',
                operator=operator,
                timestamp=datetime.now()
            )
            
        if current == target.target_offset:
            return AdjustmentResult(
                success=True,
                message='位点已在目标位置，幂等操作',
                before_offset=current,
                after_offset=current,
                operator=operator,
                timestamp=datetime.now()
            )
            
        before_offset = current
        self.set_current_offset(target.topic, target.partition, target.target_offset)
        
        self._history.append({
            'topic': target.topic,
            'partition': target.partition,
            'before': before_offset,
            'after': target.target_offset,
            'operator': operator,
            'timestamp': datetime.now().isoformat(),
            'reason': target.reason
        })
        
        return AdjustmentResult(
            success=True,
            message='位点调整成功',
            before_offset=before_offset,
            after_offset=target.target_offset,
            operator=operator,
            timestamp=datetime.now()
        )
        
    def get_history(self, topic: Optional[str] = None, 
                   partition: Optional[int] = None) -> List[Dict]:
        history = self._history
        if topic:
            history = [h for h in history if h['topic'] == topic]
        if partition is not None:
            history = [h for h in history if h['partition'] == partition]
        return history
