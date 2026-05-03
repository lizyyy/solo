from typing import List, Optional
from datetime import datetime

from .base_validator import BaseValidator, ValidationContext
from models import ValidationIssue, IssueType, IssueSeverity, ScreeningResult, Student
from config import (
    THRESHOLD_NORMAL_MIN,
    THRESHOLD_NORMAL_MAX,
    THRESHOLD_MILD_MIN,
    THRESHOLD_MILD_MAX,
    THRESHOLD_MODERATE_MIN,
    THRESHOLD_MODERATE_MAX,
    THRESHOLD_SEVERE_MIN,
    THRESHOLD_SEVERE_MAX,
    THRESHOLD_PROFOUND_MIN,
    THRESHOLD_EXTREME_MIN,
    THRESHOLD_EXTREME_MAX,
    FREQUENCIES
)


class ThresholdValidator(BaseValidator):
    def __init__(self):
        super().__init__()
    
    def validate(self, context: ValidationContext) -> List[ValidationIssue]:
        self.issues.clear()
        
        for result in context.screening_results:
            self._validate_threshold_extremes(result, context)
            self._validate_threshold_anomalies(result, context)
        
        return self.issues
    
    def _validate_threshold_extremes(self, result: ScreeningResult, context: ValidationContext) -> None:
        student = context.get_student_by_id(result.student_id)
        student_name = student.name if student else "未知姓名"
        
        for freq in FREQUENCIES:
            left_thresh = result.left_ear_thresholds.get(freq)
            right_thresh = result.right_ear_thresholds.get(freq)
            
            if left_thresh is not None:
                if left_thresh < THRESHOLD_EXTREME_MIN or left_thresh > THRESHOLD_EXTREME_MAX:
                    self._add_issue(
                        issue_type=IssueType.THRESHOLD_EXTREME,
                        severity=IssueSeverity.HIGH,
                        title=f"学生 {student_name} 左耳 {freq}Hz 阈值异常",
                        description=f"学生 {student_name} (ID: {result.student_id}) 左耳 {freq}Hz 阈值为 {left_thresh} dB，超出合理范围 [{THRESHOLD_EXTREME_MIN}, {THRESHOLD_EXTREME_MAX}]。可能是输入错误或设备故障。",
                        student_id=result.student_id,
                        screening_id=result.screening_id,
                        details={
                            "student_name": student_name,
                            "ear": "left",
                            "frequency": freq,
                            "threshold": left_thresh,
                            "min_valid": THRESHOLD_EXTREME_MIN,
                            "max_valid": THRESHOLD_EXTREME_MAX
                        },
                        source_file=result.source_file
                    )
            
            if right_thresh is not None:
                if right_thresh < THRESHOLD_EXTREME_MIN or right_thresh > THRESHOLD_EXTREME_MAX:
                    self._add_issue(
                        issue_type=IssueType.THRESHOLD_EXTREME,
                        severity=IssueSeverity.HIGH,
                        title=f"学生 {student_name} 右耳 {freq}Hz 阈值异常",
                        description=f"学生 {student_name} (ID: {result.student_id}) 右耳 {freq}Hz 阈值为 {right_thresh} dB，超出合理范围 [{THRESHOLD_EXTREME_MIN}, {THRESHOLD_EXTREME_MAX}]。可能是输入错误或设备故障。",
                        student_id=result.student_id,
                        screening_id=result.screening_id,
                        details={
                            "student_name": student_name,
                            "ear": "right",
                            "frequency": freq,
                            "threshold": right_thresh,
                            "min_valid": THRESHOLD_EXTREME_MIN,
                            "max_valid": THRESHOLD_EXTREME_MAX
                        },
                        source_file=result.source_file
                    )
    
    def _validate_threshold_anomalies(self, result: ScreeningResult, context: ValidationContext) -> None:
        student = context.get_student_by_id(result.student_id)
        student_name = student.name if student else "未知姓名"
        
        left_valid = {f: t for f, t in result.left_ear_thresholds.items() if t is not None}
        right_valid = {f: t for f, t in result.right_ear_thresholds.items() if t is not None}
        
        if len(left_valid) >= 2:
            self._check_unusual_pattern(result, left_valid, "left", student_name, context)
        
        if len(right_valid) >= 2:
            self._check_unusual_pattern(result, right_valid, "right", student_name, context)
        
        if len(left_valid) >= 2 and len(right_valid) >= 2:
            self._check_asymmetry(result, left_valid, right_valid, student_name, context)
    
    def _check_unusual_pattern(self, result: ScreeningResult, thresholds: dict, 
                                ear: str, student_name: str, context: ValidationContext) -> None:
        freq_order = sorted(thresholds.keys())
        
        for i in range(len(freq_order) - 1):
            freq1 = freq_order[i]
            freq2 = freq_order[i + 1]
            thresh1 = thresholds[freq1]
            thresh2 = thresholds[freq2]
            
            if thresh1 is not None and thresh2 is not None:
                diff = abs(thresh1 - thresh2)
                if diff >= 20:
                    ear_name = "左耳" if ear == "left" else "右耳"
                    self._add_issue(
                        issue_type=IssueType.THRESHOLD_ANOMALY,
                        severity=IssueSeverity.MEDIUM,
                        title=f"学生 {student_name} {ear_name} 相邻频率阈值差异过大",
                        description=f"学生 {student_name} (ID: {result.student_id}) {ear_name} 在 {freq1}Hz ({thresh1} dB) 和 {freq2}Hz ({thresh2} dB) 的阈值差异为 {diff} dB，超过正常变异范围。",
                        student_id=result.student_id,
                        screening_id=result.screening_id,
                        details={
                            "student_name": student_name,
                            "ear": ear,
                            "frequency1": freq1,
                            "threshold1": thresh1,
                            "frequency2": freq2,
                            "threshold2": thresh2,
                            "difference": diff
                        },
                        source_file=result.source_file
                    )
        
        for freq, thresh in thresholds.items():
            if thresh is not None and thresh > THRESHOLD_NORMAL_MAX:
                severity = IssueSeverity.LOW
                if thresh > THRESHOLD_SEVERE_MAX:
                    severity = IssueSeverity.HIGH
                elif thresh > THRESHOLD_MODERATE_MAX:
                    severity = IssueSeverity.MEDIUM
                
                ear_name = "左耳" if ear == "left" else "右耳"
                hearing_level = self._get_hearing_level(thresh)
                
                self._add_issue(
                    issue_type=IssueType.THRESHOLD_ANOMALY,
                    severity=severity,
                    title=f"学生 {student_name} {ear_name} {freq}Hz 阈值异常（{hearing_level}）",
                    description=f"学生 {student_name} (ID: {result.student_id}) {ear_name} {freq}Hz 阈值为 {thresh} dB，属于{hearing_level}范围。正常阈值应 ≤ {THRESHOLD_NORMAL_MAX} dB。",
                    student_id=result.student_id,
                    screening_id=result.screening_id,
                    details={
                        "student_name": student_name,
                        "ear": ear,
                        "frequency": freq,
                        "threshold": thresh,
                        "hearing_level": hearing_level,
                        "normal_max": THRESHOLD_NORMAL_MAX
                    },
                    source_file=result.source_file
                )
    
    def _check_asymmetry(self, result: ScreeningResult, left: dict, right: dict,
                          student_name: str, context: ValidationContext) -> None:
        common_freqs = set(left.keys()) & set(right.keys())
        
        for freq in common_freqs:
            left_thresh = left[freq]
            right_thresh = right[freq]
            
            if left_thresh is not None and right_thresh is not None:
                diff = abs(left_thresh - right_thresh)
                if diff >= 15:
                    better_ear = "左耳" if left_thresh < right_thresh else "右耳"
                    worse_ear = "右耳" if left_thresh < right_thresh else "左耳"
                    better_thresh = min(left_thresh, right_thresh)
                    worse_thresh = max(left_thresh, right_thresh)
                    
                    self._add_issue(
                        issue_type=IssueType.THRESHOLD_ANOMALY,
                        severity=IssueSeverity.MEDIUM,
                        title=f"学生 {student_name} {freq}Hz 双耳阈值不对称",
                        description=f"学生 {student_name} (ID: {result.student_id}) {freq}Hz 双耳阈值差异为 {diff} dB。{better_ear}: {better_thresh} dB，{worse_ear}: {worse_thresh} dB。双耳差异超过 15 dB 可能提示单侧听力损失。",
                        student_id=result.student_id,
                        screening_id=result.screening_id,
                        details={
                            "student_name": student_name,
                            "frequency": freq,
                            "left_threshold": left_thresh,
                            "right_threshold": right_thresh,
                            "difference": diff,
                            "better_ear": better_ear,
                            "worse_ear": worse_ear
                        },
                        source_file=result.source_file
                    )
    
    def _get_hearing_level(self, threshold: int) -> str:
        if threshold <= THRESHOLD_NORMAL_MAX:
            return "正常"
        elif threshold <= THRESHOLD_MILD_MAX:
            return "轻度听力损失"
        elif threshold <= THRESHOLD_MODERATE_MAX:
            return "中度听力损失"
        elif threshold <= THRESHOLD_SEVERE_MAX:
            return "重度听力损失"
        else:
            return "极重度听力损失"


def validate_thresholds(context: ValidationContext) -> List[ValidationIssue]:
    validator = ThresholdValidator()
    return validator.validate(context)
