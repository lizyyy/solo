from typing import List, Dict, Optional
from datetime import datetime

from .base_validator import BaseValidator, ValidationContext
from models import ValidationIssue, IssueType, IssueSeverity, ScreeningResult, Student
from config import FREQUENCIES


class ChannelValidator(BaseValidator):
    def __init__(self):
        super().__init__()
    
    def validate(self, context: ValidationContext) -> List[ValidationIssue]:
        self.issues.clear()
        
        for result in context.screening_results:
            self._check_channel_swap(result, context)
            self._check_inconsistent_thresholds(result, context)
        
        return self.issues
    
    def _check_channel_swap(self, result: ScreeningResult, context: ValidationContext) -> None:
        student = context.get_student_by_id(result.student_id)
        student_name = student.name if student else "未知姓名"
        
        left_thresholds = result.left_ear_thresholds
        right_thresholds = result.right_ear_thresholds
        
        if not left_thresholds or not right_thresholds:
            return
        
        common_freqs = set(left_thresholds.keys()) & set(right_thresholds.keys())
        if not common_freqs:
            return
        
        swap_indicators = 0
        swap_details = {}
        
        for freq in common_freqs:
            left = left_thresholds.get(freq)
            right = right_thresholds.get(freq)
            
            if left is None or right is None:
                continue
            
            if left > 40 and right <= 20:
                swap_indicators += 1
                swap_details[freq] = {
                    "left": left,
                    "right": right,
                    "pattern": "left_poor_right_good"
                }
            elif right > 40 and left <= 20:
                swap_indicators += 1
                swap_details[freq] = {
                    "left": left,
                    "right": right,
                    "pattern": "right_poor_left_good"
                }
            
            if abs(left - right) > 25:
                swap_indicators += 0.5
        
        if swap_indicators >= 2:
            self._add_issue(
                issue_type=IssueType.CHANNEL_SWAPPED,
                severity=IssueSeverity.HIGH,
                title=f"学生 {student_name} 可能存在左右耳通道接反",
                description=f"学生 {student_name} (ID: {result.student_id}) 的听力阈值模式显示可能存在左右耳通道接反。检测到 {swap_indicators} 个可疑指标。建议：1) 重新核对设备通道连接；2) 比较双耳阈值模式；3) 如有必要重新测试。",
                student_id=result.student_id,
                screening_id=result.screening_id,
                details={
                    "student_name": student_name,
                    "swap_indicators_count": swap_indicators,
                    "left_thresholds": {str(k): v for k, v in left_thresholds.items()},
                    "right_thresholds": {str(k): v for k, v in right_thresholds.items()},
                    "frequency_analysis": swap_details
                },
                source_file=result.source_file
            )
    
    def _check_inconsistent_thresholds(self, result: ScreeningResult, context: ValidationContext) -> None:
        student = context.get_student_by_id(result.student_id)
        student_name = student.name if student else "未知姓名"
        
        left_max = result.get_left_ear_max_threshold()
        right_max = result.get_right_ear_max_threshold()
        
        if left_max is not None and right_max is not None:
            if result.left_ear_status and result.right_ear_status:
                from models import ScreeningStatus
                
                left_should_be_refer = left_max > 25
                right_should_be_refer = right_max > 25
                
                left_is_refer = result.left_ear_status in [ScreeningStatus.REFER, ScreeningStatus.INVALID]
                right_is_refer = result.right_ear_status in [ScreeningStatus.REFER, ScreeningStatus.INVALID]
                
                if left_should_be_refer and not left_is_refer:
                    self._add_issue(
                        issue_type=IssueType.INVALID_DATA,
                        severity=IssueSeverity.MEDIUM,
                        title=f"学生 {student_name} 左耳结果与阈值不一致",
                        description=f"学生 {student_name} (ID: {result.student_id}) 左耳最大阈值为 {left_max} dB，但结果标记为 '{result.left_ear_status.value if result.left_ear_status else '未知'}'。阈值超过 25 dB 通常应标记为转诊/异常。",
                        student_id=result.student_id,
                        screening_id=result.screening_id,
                        details={
                            "student_name": student_name,
                            "ear": "left",
                            "max_threshold": left_max,
                            "status": result.left_ear_status.value if result.left_ear_status else None,
                            "thresholds": {str(k): v for k, v in result.left_ear_thresholds.items()}
                        },
                        source_file=result.source_file
                    )
                
                if right_should_be_refer and not right_is_refer:
                    self._add_issue(
                        issue_type=IssueType.INVALID_DATA,
                        severity=IssueSeverity.MEDIUM,
                        title=f"学生 {student_name} 右耳结果与阈值不一致",
                        description=f"学生 {student_name} (ID: {result.student_id}) 右耳最大阈值为 {right_max} dB，但结果标记为 '{result.right_ear_status.value if result.right_ear_status else '未知'}'。阈值超过 25 dB 通常应标记为转诊/异常。",
                        student_id=result.student_id,
                        screening_id=result.screening_id,
                        details={
                            "student_name": student_name,
                            "ear": "right",
                            "max_threshold": right_max,
                            "status": result.right_ear_status.value if result.right_ear_status else None,
                            "thresholds": {str(k): v for k, v in result.right_ear_thresholds.items()}
                        },
                        source_file=result.source_file
                    )


def validate_channels(context: ValidationContext) -> List[ValidationIssue]:
    validator = ChannelValidator()
    return validator.validate(context)
