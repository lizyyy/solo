"""关键场景漏讲检测"""

from typing import List

from narrtool.database.models import (
    CheckType,
    Severity,
    Narration,
)
from .base import BaseChecker, CheckResult


class MissingSceneChecker(BaseChecker):
    """关键场景漏讲检测"""
    
    def check(self, screening_id: int, session) -> List[CheckResult]:
        """执行检查"""
        results = []
        
        narrations = session.query(Narration).filter(
            Narration.screening_id == screening_id
        ).order_by(Narration.start_time).all()
        
        if not narrations:
            return results
        
        critical_narrations = [n for n in narrations if n.is_critical == 1]
        
        gaps = self._find_gaps(narrations)
        results.extend(self._check_adjacent_gaps(critical_narrations))
        
        return results
    
    def _find_gaps(self, narrations: List[Narration]) -> List:
        """找出所有未被口述覆盖的时间段"""
        gaps = []
        
        if len(narrations) < 2:
            return gaps
        
        sorted_narrations = sorted(narrations, key=lambda x: x.start_time)
        
        for i in range(len(sorted_narrations) - 1):
            current = sorted_narrations[i]
            next_narr = sorted_narrations[i + 1]
            
            gap_start = current.end_time
            gap_end = next_narr.start_time
            
            if gap_end > gap_start + 1.0:
                gaps.append({
                    "start": gap_start,
                    "end": gap_end,
                    "after_index": current.index,
                    "before_index": next_narr.index,
                })
        
        return gaps
    
    def _check_adjacent_gaps(self, critical_narrations: List[Narration]) -> List[CheckResult]:
        """检查关键场景之间的间隙和相邻问题"""
        results = []
        
        if not critical_narrations:
            return results
        
        for narration in critical_narrations:
            if not narration.text.strip():
                result = self._create_empty_critical_result(narration)
                results.append(result)
            elif len(narration.text.strip()) < 5:
                result = self._create_short_critical_result(narration)
                results.append(result)
        
        return results
    
    def _create_empty_critical_result(self, narration: Narration) -> CheckResult:
        """创建空关键场景检查结果"""
        description = (
            f"关键场景 #{narration.index} 内容为空。\n"
            f"  时间: {self._format_time(narration.start_time)} - {self._format_time(narration.end_time)}\n"
            f"  状态: 该标记为关键场景的段落没有口述内容"
        )
        
        return CheckResult(
            check_type=CheckType.MISSING_SCENE,
            severity=Severity.HIGH,
            description=description,
            related_ids=[narration.id],
            time_start=narration.start_time,
            time_end=narration.end_time,
        )
    
    def _create_short_critical_result(self, narration: Narration) -> CheckResult:
        """创建过短关键场景检查结果"""
        description = (
            f"关键场景 #{narration.index} 内容过短。\n"
            f"  时间: {self._format_time(narration.start_time)} - {self._format_time(narration.end_time)}\n"
            f"  当前内容: '{narration.text}'\n"
            f"  建议: 请检查是否遗漏了重要描述"
        )
        
        return CheckResult(
            check_type=CheckType.MISSING_SCENE,
            severity=Severity.MEDIUM,
            description=description,
            related_ids=[narration.id],
            time_start=narration.start_time,
            time_end=narration.end_time,
        )
    
    def _format_time(self, seconds: float) -> str:
        """格式化时间为 MM:SS 格式"""
        minutes = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{minutes:02d}:{secs:02d}"
