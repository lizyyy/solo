"""口述段落压住对白检测"""

from typing import List

from narrtool.database.models import (
    CheckType,
    Severity,
    Subtitle,
    Narration,
)
from .base import BaseChecker, CheckResult, time_overlap


class DialogueOverlapChecker(BaseChecker):
    """口述段落压住对白检测"""
    
    def __init__(self, allow_touch: bool = False):
        self.allow_touch = allow_touch
    
    def check(self, screening_id: int, session) -> List[CheckResult]:
        """执行检查"""
        results = []
        
        subtitles = session.query(Subtitle).filter(
            Subtitle.screening_id == screening_id
        ).order_by(Subtitle.start_time).all()
        
        narrations = session.query(Narration).filter(
            Narration.screening_id == screening_id
        ).order_by(Narration.start_time).all()
        
        if not subtitles or not narrations:
            return results
        
        for narration in narrations:
            for subtitle in subtitles:
                if time_overlap(
                    narration.start_time, narration.end_time,
                    subtitle.start_time, subtitle.end_time,
                    allow_touch=self.allow_touch
                ):
                    result = self._create_result(
                        narration, subtitle, screening_id
                    )
                    results.append(result)
        
        return results
    
    def _create_result(
        self,
        narration: Narration,
        subtitle: Subtitle,
        screening_id: int
    ) -> CheckResult:
        """创建检查结果"""
        overlap_start = max(narration.start_time, subtitle.start_time)
        overlap_end = min(narration.end_time, subtitle.end_time)
        overlap_duration = overlap_end - overlap_start
        
        if overlap_duration > 5.0:
            severity = Severity.HIGH
        elif overlap_duration > 2.0:
            severity = Severity.MEDIUM
        else:
            severity = Severity.LOW
        
        description = (
            f"口述段落 #{narration.index} 与字幕 #{subtitle.index} 发生重叠。\n"
            f"  口述时间: {self._format_time(narration.start_time)} - {self._format_time(narration.end_time)}\n"
            f"  口述内容: {narration.text[:50]}{'...' if len(narration.text) > 50 else ''}\n"
            f"  字幕时间: {self._format_time(subtitle.start_time)} - {self._format_time(subtitle.end_time)}\n"
            f"  字幕内容: {subtitle.text[:50]}{'...' if len(subtitle.text) > 50 else ''}\n"
            f"  重叠时长: {overlap_duration:.2f} 秒"
        )
        
        return CheckResult(
            check_type=CheckType.DIALOGUE_OVERLAP,
            severity=severity,
            description=description,
            related_ids=[narration.id, subtitle.id],
            time_start=overlap_start,
            time_end=overlap_end,
        )
    
    def _format_time(self, seconds: float) -> str:
        """格式化时间为 MM:SS 格式"""
        minutes = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{minutes:02d}:{secs:02d}"
