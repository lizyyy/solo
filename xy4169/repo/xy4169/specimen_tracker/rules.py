"""规则校验引擎

检测标本流转中的各种异常情况：
- 多部位混淆
- 缺照片
- 超时未回报
- 漏复核签名
- 缺标本袋
- 缺申请单CSV
- 信息不一致
"""

from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from collections import defaultdict

from .models import (
    Specimen, SpecimenStatus, Anomaly, AnomalyType, SpecimenEvent
)


class ValidationRule(ABC):
    """校验规则基类"""
    
    @property
    @abstractmethod
    def rule_name(self) -> str:
        """规则名称"""
        pass
    
    @property
    @abstractmethod
    def anomaly_type(self) -> AnomalyType:
        """对应的异常类型"""
        pass
    
    @property
    @abstractmethod
    def severity(self) -> str:
        """严重程度: high, medium, low"""
        pass
    
    @abstractmethod
    def check(self, specimens: List[Specimen], 
              current_time: Optional[datetime] = None) -> List[Anomaly]:
        """执行校验，返回检测到的异常列表"""
        pass


class MissingPhotoRule(ValidationRule):
    """缺照片检查规则"""
    
    rule_name = "缺照片检查"
    anomaly_type = AnomalyType.MISSING_PHOTO
    severity = "high"
    
    def check(self, specimens: List[Specimen], 
              current_time: Optional[datetime] = None) -> List[Anomaly]:
        anomalies = []
        current_time = current_time or datetime.now()
        
        for specimen in specimens:
            if (specimen.status != SpecimenStatus.RELEASED and
                specimen.photo_count == 0):
                anomaly = Anomaly(
                    specimen_id=specimen.id if specimen.id else 0,
                    anomaly_type=self.anomaly_type,
                    description=f"标本 '{specimen.specimen_no}' (患者: {specimen.patient_name}) 尚未拍照",
                    severity=self.severity,
                    detected_at=current_time,
                )
                anomalies.append(anomaly)
        
        return anomalies


class TimeoutRule(ValidationRule):
    """超时未回报检查规则"""
    
    rule_name = "超时未回报检查"
    anomaly_type = AnomalyType.TIMEOUT
    severity = "high"
    
    FROZEN_SECTION_TIMEOUT_MINUTES = 30
    
    def check(self, specimens: List[Specimen], 
              current_time: Optional[datetime] = None) -> List[Anomaly]:
        anomalies = []
        current_time = current_time or datetime.now()
        
        for specimen in specimens:
            if specimen.status == SpecimenStatus.RELEASED:
                continue
            
            due_time = specimen.due_time
            if due_time is None:
                due_time = specimen.registered_at + timedelta(
                    minutes=self.FROZEN_SECTION_TIMEOUT_MINUTES
                )
            
            if current_time > due_time:
                minutes_overdue = int((current_time - due_time).total_seconds() / 60)
                anomaly = Anomaly(
                    specimen_id=specimen.id if specimen.id else 0,
                    anomaly_type=self.anomaly_type,
                    description=(f"标本 '{specimen.specimen_no}' (患者: {specimen.patient_name}) "
                               f"超时 {minutes_overdue} 分钟未回报"),
                    severity=self.severity,
                    detected_at=current_time,
                )
                anomalies.append(anomaly)
        
        return anomalies


class MissingReviewRule(ValidationRule):
    """漏复核签名检查规则"""
    
    rule_name = "漏复核签名检查"
    anomaly_type = AnomalyType.MISSING_REVIEW
    severity = "high"
    
    def check(self, specimens: List[Specimen], 
              current_time: Optional[datetime] = None) -> List[Anomaly]:
        anomalies = []
        current_time = current_time or datetime.now()
        
        for specimen in specimens:
            if (specimen.status == SpecimenStatus.PENDING_REVIEW and
                not specimen.reviewed_by):
                anomaly = Anomaly(
                    specimen_id=specimen.id if specimen.id else 0,
                    anomaly_type=self.anomaly_type,
                    description=f"标本 '{specimen.specimen_no}' (患者: {specimen.patient_name}) 等待复核但无签名",
                    severity=self.severity,
                    detected_at=current_time,
                )
                anomalies.append(anomaly)
        
        return anomalies


class MissingSpecimenBagRule(ValidationRule):
    """缺标本袋检查规则"""
    
    rule_name = "缺标本袋检查"
    anomaly_type = AnomalyType.MISSING_SPECIMEN_BAG
    severity = "medium"
    
    def check(self, specimens: List[Specimen], 
              current_time: Optional[datetime] = None) -> List[Anomaly]:
        anomalies = []
        current_time = current_time or datetime.now()
        
        for specimen in specimens:
            if (specimen.status != SpecimenStatus.RELEASED and
                not specimen.has_specimen_bag):
                anomaly = Anomaly(
                    specimen_id=specimen.id if specimen.id else 0,
                    anomaly_type=self.anomaly_type,
                    description=f"标本 '{specimen.specimen_no}' (患者: {specimen.patient_name}) 缺少标本袋",
                    severity=self.severity,
                    detected_at=current_time,
                )
                anomalies.append(anomaly)
        
        return anomalies


class MissingCsvRule(ValidationRule):
    """缺申请单CSV检查规则"""
    
    rule_name = "缺申请单CSV检查"
    anomaly_type = AnomalyType.MISSING_CSV
    severity = "medium"
    
    def check(self, specimens: List[Specimen], 
              current_time: Optional[datetime] = None) -> List[Anomaly]:
        anomalies = []
        current_time = current_time or datetime.now()
        
        for specimen in specimens:
            if (specimen.status != SpecimenStatus.RELEASED and
                not specimen.has_csv):
                anomaly = Anomaly(
                    specimen_id=specimen.id if specimen.id else 0,
                    anomaly_type=self.anomaly_type,
                    description=f"标本 '{specimen.specimen_no}' (患者: {specimen.patient_name}) 缺少申请单CSV",
                    severity=self.severity,
                    detected_at=current_time,
                )
                anomalies.append(anomaly)
        
        return anomalies


class MultiPartConfusionRule(ValidationRule):
    """多部位混淆检查规则
    
    检测同一患者有多个部位标本时可能发生的混淆风险。
    """
    
    rule_name = "多部位混淆检查"
    anomaly_type = AnomalyType.MULTI_PART_CONFUSION
    severity = "high"
    
    def check(self, specimens: List[Specimen], 
              current_time: Optional[datetime] = None) -> List[Anomaly]:
        anomalies = []
        current_time = current_time or datetime.now()
        
        patient_specimens: Dict[str, List[Specimen]] = defaultdict(list)
        
        for specimen in specimens:
            if specimen.status != SpecimenStatus.RELEASED:
                key = specimen.patient_id or specimen.patient_name
                if key:
                    patient_specimens[key].append(specimen)
        
        for key, specs in patient_specimens.items():
            if len(specs) > 1:
                locations = [s.location for s in specs if s.location]
                if len(set(locations)) > 1:
                    specimen_nos = ", ".join([s.specimen_no for s in specs])
                    locations_str = ", ".join(set(locations))
                    patient_name = specs[0].patient_name
                    
                    for specimen in specs:
                        anomaly = Anomaly(
                            specimen_id=specimen.id if specimen.id else 0,
                            anomaly_type=self.anomaly_type,
                            description=(f"患者 '{patient_name}' 有多个部位标本 ({specimen_nos})，"
                                      f"部位: {locations_str}，存在混淆风险"),
                            severity=self.severity,
                            detected_at=current_time,
                        )
                        anomalies.append(anomaly)
        
        return anomalies


class InconsistentInfoRule(ValidationRule):
    """信息不一致检查规则
    
    检查同一患者的不同标本之间信息是否一致。
    """
    
    rule_name = "信息不一致检查"
    anomaly_type = AnomalyType.INCONSISTENT_INFO
    severity = "medium"
    
    def check(self, specimens: List[Specimen], 
              current_time: Optional[datetime] = None) -> List[Anomaly]:
        anomalies = []
        current_time = current_time or datetime.now()
        
        patient_specimens: Dict[str, List[Specimen]] = defaultdict(list)
        
        for specimen in specimens:
            key = specimen.patient_id or specimen.patient_name
            if key:
                patient_specimens[key].append(specimen)
        
        for key, specs in patient_specimens.items():
            if len(specs) > 1:
                patient_names = set(s.patient_name for s in specs if s.patient_name)
                if len(patient_names) > 1:
                    for specimen in specs:
                        anomaly = Anomaly(
                            specimen_id=specimen.id if specimen.id else 0,
                            anomaly_type=self.anomaly_type,
                            description=(f"同一患者ID '{key}' 对应不同姓名: "
                                      f"{', '.join(patient_names)}"),
                            severity=self.severity,
                            detected_at=current_time,
                        )
                        anomalies.append(anomaly)
        
        return anomalies


class RulesEngine:
    """规则校验引擎
    
    管理所有校验规则的执行，提供统一的校验接口。
    """
    
    DEFAULT_RULES = [
        MissingPhotoRule(),
        TimeoutRule(),
        MissingReviewRule(),
        MissingSpecimenBagRule(),
        MissingCsvRule(),
        MultiPartConfusionRule(),
        InconsistentInfoRule(),
    ]
    
    def __init__(self, rules: Optional[List[ValidationRule]] = None):
        self._rules = rules if rules is not None else list(self.DEFAULT_RULES)
        self._anomalies_cache: List[Anomaly] = []
    
    def validate_all(self, specimens: List[Specimen],
                     current_time: Optional[datetime] = None) -> List[Anomaly]:
        """执行所有规则校验
        
        Args:
            specimens: 标本列表
            current_time: 当前时间，用于超时计算
            
        Returns:
            检测到的异常列表
        """
        all_anomalies = []
        
        for rule in self._rules:
            try:
                anomalies = rule.check(specimens, current_time)
                all_anomalies.extend(anomalies)
            except Exception:
                continue
        
        self._anomalies_cache = all_anomalies
        return all_anomalies
    
    def get_anomalies_by_type(self, anomaly_type: AnomalyType) -> List[Anomaly]:
        """按类型获取缓存的异常"""
        return [a for a in self._anomalies_cache if a.anomaly_type == anomaly_type]
    
    def get_anomalies_by_severity(self, severity: str) -> List[Anomaly]:
        """按严重程度获取缓存的异常"""
        return [a for a in self._anomalies_cache if a.severity == severity]
    
    def add_rule(self, rule: ValidationRule):
        """添加新的校验规则"""
        self._rules.append(rule)
    
    def remove_rule(self, rule_name: str):
        """移除指定名称的校验规则"""
        self._rules = [r for r in self._rules if r.rule_name != rule_name]
    
    @property
    def rules(self) -> List[ValidationRule]:
        """获取所有注册的规则"""
        return list(self._rules)
