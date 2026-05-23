from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models import Grievance, ProcessingHistory, RuleLevel, GrievanceStatus


class RuleResult:
    def __init__(self, rule_name: str, rule_code: str, passed: bool, message: str, detail: Optional[Dict[str, Any]] = None):
        self.rule_name = rule_name
        self.rule_code = rule_code
        self.passed = passed
        self.message = message
        self.detail = detail or {}


class BaseRule(ABC):
    def __init__(self, db: Session):
        self.db = db

    @property
    @abstractmethod
    def rule_code(self) -> str:
        pass

    @property
    @abstractmethod
    def rule_name(self) -> str:
        pass

    @abstractmethod
    def evaluate(self, grievance: Grievance) -> RuleResult:
        pass

    def _create_history(self, grievance: Grievance, result: RuleResult) -> ProcessingHistory:
        history = ProcessingHistory(
            batch_id=grievance.batch_id,
            grievance_id=grievance.id,
            action="RULE_EVALUATION",
            rule_name=f"{self.rule_code} - {self.rule_name}",
            rule_result=result.passed,
            detail=result.message,
            operator="RULES_ENGINE"
        )
        self.db.add(history)
        return history


class OverdueDeclarationRule(BaseRule):
    @property
    def rule_code(self) -> str:
        return "RULE_001"

    @property
    def rule_name(self) -> str:
        return "超时申报检查"

    def evaluate(self, grievance: Grievance) -> RuleResult:
        if not grievance.flight_date or not grievance.apply_time:
            result = RuleResult(
                rule_name=self.rule_name,
                rule_code=self.rule_code,
                passed=False,
                message="缺少航班日期或申请时间，无法判断是否超时"
            )
        else:
            days_diff = (grievance.apply_time - grievance.flight_date).days
            is_overdue = days_diff > 45
            grievance.is_overdue = is_overdue
            if is_overdue:
                result = RuleResult(
                    rule_name=self.rule_name,
                    rule_code=self.rule_code,
                    passed=False,
                    message=f"超时申报：航班日期至申请时间间隔 {days_diff} 天，超过45天期限",
                    detail={"days_diff": days_diff, "limit_days": 45}
                )
            else:
                result = RuleResult(
                    rule_name=self.rule_name,
                    rule_code=self.rule_code,
                    passed=True,
                    message=f"申报及时：航班日期至申请时间间隔 {days_diff} 天",
                    detail={"days_diff": days_diff, "limit_days": 45}
                )
        self._create_history(grievance, result)
        return result


class ResponsibleFlightSegmentRule(BaseRule):
    @property
    def rule_code(self) -> str:
        return "RULE_002"

    @property
    def rule_name(self) -> str:
        return "责任航段检查"

    def evaluate(self, grievance: Grievance) -> RuleResult:
        has_responsible = False
        responsible_flights = []
        for flight in grievance.flights:
            if flight.is_responsible:
                has_responsible = True
                responsible_flights.append(flight.flight_no)
        grievance.is_responsible = has_responsible
        if has_responsible:
            result = RuleResult(
                rule_name=self.rule_name,
                rule_code=self.rule_code,
                passed=True,
                message=f"存在责任航段：{', '.join(responsible_flights)}",
                detail={"responsible_flights": responsible_flights}
            )
        else:
            result = RuleResult(
                rule_name=self.rule_name,
                rule_code=self.rule_code,
                passed=False,
                message="无责任航段",
                detail={"responsible_flights": []}
            )
        self._create_history(grievance, result)
        return result


class CompensationLimitRule(BaseRule):
    @property
    def rule_code(self) -> str:
        return "RULE_003"

    @property
    def rule_name(self) -> str:
        return "赔付上限校验"

    def _get_limit_by_level(self, level: RuleLevel) -> float:
        limits = {
            RuleLevel.A: 2000.0,
            RuleLevel.B: 500.0,
            RuleLevel.C: 200.0
        }
        return limits.get(level, 0.0)

    def evaluate(self, grievance: Grievance) -> RuleResult:
        if not grievance.rule_level:
            result = RuleResult(
                rule_name=self.rule_name,
                rule_code=self.rule_code,
                passed=False,
                message="未确定规则等级，无法进行赔付上限校验"
            )
        else:
            limit = self._get_limit_by_level(grievance.rule_level)
            apply_amount = grievance.apply_amount or 0.0
            if apply_amount > limit:
                grievance.final_amount = limit
                result = RuleResult(
                    rule_name=self.rule_name,
                    rule_code=self.rule_code,
                    passed=False,
                    message=f"申请金额 {apply_amount} 超过 {grievance.rule_level}级 赔付上限 {limit}，调整为 {limit}",
                    detail={"apply_amount": apply_amount, "limit": limit, "level": grievance.rule_level}
                )
            else:
                grievance.final_amount = apply_amount
                result = RuleResult(
                    rule_name=self.rule_name,
                    rule_code=self.rule_code,
                    passed=True,
                    message=f"申请金额 {apply_amount} 在 {grievance.rule_level}级 赔付上限 {limit} 范围内",
                    detail={"apply_amount": apply_amount, "limit": limit, "level": grievance.rule_level}
                )
        self._create_history(grievance, result)
        return result


class PhotoEvidenceRule(BaseRule):
    @property
    def rule_code(self) -> str:
        return "RULE_004"

    @property
    def rule_name(self) -> str:
        return "照片证据检查"

    def evaluate(self, grievance: Grievance) -> RuleResult:
        valid_photos = [p for p in grievance.photo_indices if p.is_valid]
        photo_count = len(valid_photos)
        grievance.photo_count = photo_count
        grievance.has_photo_evidence = photo_count >= 2
        if photo_count >= 2:
            result = RuleResult(
                rule_name=self.rule_name,
                rule_code=self.rule_code,
                passed=True,
                message=f"照片证据充足：共 {photo_count} 张有效照片",
                detail={"photo_count": photo_count, "required": 2}
            )
        else:
            result = RuleResult(
                rule_name=self.rule_name,
                rule_code=self.rule_code,
                passed=False,
                message=f"照片证据不足：仅 {photo_count} 张有效照片，需要至少2张",
                detail={"photo_count": photo_count, "required": 2}
            )
        self._create_history(grievance, result)
        return result


class IncidentTypeRule(BaseRule):
    @property
    def rule_code(self) -> str:
        return "RULE_005"

    @property
    def rule_name(self) -> str:
        return "事件类型匹配"

    def _get_level_by_incident_type(self, incident_type: str) -> Optional[RuleLevel]:
        type_mapping = {
            "行李破损": RuleLevel.A,
            "行李丢失": RuleLevel.A,
            "行李延误": RuleLevel.B,
            "航班延误": RuleLevel.B,
            "航班取消": RuleLevel.B,
            "超售拒载": RuleLevel.A,
            "服务投诉": RuleLevel.C,
            "餐食问题": RuleLevel.C,
            "其他": RuleLevel.C
        }
        return type_mapping.get(incident_type)

    def evaluate(self, grievance: Grievance) -> RuleResult:
        incident_type = grievance.incident_type or ""
        level = self._get_level_by_incident_type(incident_type)
        if level:
            grievance.rule_level = level
            result = RuleResult(
                rule_name=self.rule_name,
                rule_code=self.rule_code,
                passed=True,
                message=f"事件类型 '{incident_type}' 匹配成功，确定为 {level}级",
                detail={"incident_type": incident_type, "level": level}
            )
        else:
            result = RuleResult(
                rule_name=self.rule_name,
                rule_code=self.rule_code,
                passed=False,
                message=f"未知事件类型 '{incident_type}'，无法确定规则等级",
                detail={"incident_type": incident_type, "level": None}
            )
        self._create_history(grievance, result)
        return result


class RulesEngine:
    def __init__(self, db: Session):
        self.db = db
        self.rules = [
            OverdueDeclarationRule(db),
            ResponsibleFlightSegmentRule(db),
            IncidentTypeRule(db),
            PhotoEvidenceRule(db),
            CompensationLimitRule(db)
        ]

    def evaluate_grievance(self, grievance: Grievance) -> List[RuleResult]:
        results = []
        for rule in self.rules:
            result = rule.evaluate(grievance)
            results.append(result)
        
        result_map = {r.rule_code: r for r in results}
        
        responsible_result = result_map.get("RULE_002")
        if responsible_result and not responsible_result.passed:
            grievance.status = GrievanceStatus.REJECTED
            self.db.commit()
            return results
        
        overdue_result = result_map.get("RULE_001")
        if overdue_result and not overdue_result.passed:
            days_diff = overdue_result.detail.get("days_diff", 0)
            if days_diff > 45:
                grievance.status = GrievanceStatus.REJECTED
                self.db.commit()
                return results
        
        photo_result = result_map.get("RULE_004")
        compensation_result = result_map.get("RULE_003")
        
        has_pending_issue = False
        if photo_result and not photo_result.passed:
            has_pending_issue = True
        if compensation_result and not compensation_result.passed:
            has_pending_issue = True
        if overdue_result and not overdue_result.passed:
            days_diff = overdue_result.detail.get("days_diff", 0)
            if days_diff <= 45:
                has_pending_issue = True
        
        if has_pending_issue:
            grievance.status = GrievanceStatus.PENDING
        else:
            grievance.status = GrievanceStatus.APPROVED
        
        self.db.commit()
        return results

    def evaluate_batch(self, grievances: List[Grievance]) -> Dict[str, List[RuleResult]]:
        batch_results = {}
        for grievance in grievances:
            results = self.evaluate_grievance(grievance)
            batch_results[grievance.grievance_no] = results
        return batch_results
