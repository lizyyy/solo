from abc import ABC, abstractmethod
from typing import List, Tuple
from sqlalchemy.orm import Session

from models import Hazard, HazardStatus, HazardLevel
from schemas import RuleCheckResultCreate
from repositories import HazardRepository


class BaseRule(ABC):
    rule_code: str
    rule_name: str
    check_stage: str

    def __init__(self, db: Session):
        self.db = db
        self.hazard_repo = HazardRepository(db)

    @abstractmethod
    def check(self, hazard: Hazard) -> Tuple[bool, str]:
        pass

    def apply(self, hazard: Hazard) -> RuleCheckResultCreate:
        passed, message = self.check(hazard)
        return RuleCheckResultCreate(
            rule_code=self.rule_code,
            rule_name=self.rule_name,
            passed=passed,
            message=message,
            check_stage=self.check_stage
        )


class OverdueEscalationRule(BaseRule):
    rule_code = "OVERDUE_001"
    rule_name = "逾期升级规则"
    check_stage = "daily_check"

    def check(self, hazard: Hazard) -> Tuple[bool, str]:
        from datetime import datetime
        
        if hazard.status in [HazardStatus.CLOSED, HazardStatus.ESCALATED]:
            return True, "隐患已闭环或已升级，无需处理"
        
        if not hazard.deadline:
            return True, "未设置整改期限"
        
        now = datetime.utcnow()
        days_overdue = (now - hazard.deadline).days
        
        if days_overdue > 7:
            if hazard.level != HazardLevel.CRITICAL:
                hazard.level = HazardLevel.CRITICAL
                hazard.status = HazardStatus.ESCALATED
                return False, f"已逾期{days_overdue}天，升级为Critical等级并标记为已升级"
            return False, f"已逾期{days_overdue}天，已处于最高等级"
        elif days_overdue > 3:
            if hazard.level == HazardLevel.LOW:
                hazard.level = HazardLevel.MEDIUM
                return False, f"已逾期{days_overdue}天，升级为Medium等级"
            elif hazard.level == HazardLevel.MEDIUM:
                hazard.level = HazardLevel.HIGH
                return False, f"已逾期{days_overdue}天，升级为High等级"
            return False, f"已逾期{days_overdue}天"
        elif days_overdue > 0:
            return False, f"已逾期{days_overdue}天，请尽快处理"
        
        return True, "在整改期限内"


class PhotoRequiredRule(BaseRule):
    rule_code = "PHOTO_001"
    rule_name = "照片必传规则"
    check_stage = "close_check"

    def check(self, hazard: Hazard) -> Tuple[bool, str]:
        has_hazard_photos = len([p for p in hazard.photos if not p.is_deleted]) > 0
        has_rectification_photos = any(
            len(r.photos) > 0 for r in hazard.rectifications
        )
        has_recheck_photos = any(
            len(r.photos) > 0 for r in hazard.rechecks
        )
        
        if not has_hazard_photos:
            return False, "缺少隐患发现照片"
        
        if hazard.status == HazardStatus.RECHECKING and not has_rectification_photos:
            return False, "缺少整改过程照片"
        
        if hazard.status == HazardStatus.CLOSED:
            if not has_recheck_photos:
                return False, "缺少复查通过照片"
        
        return True, "照片齐全"


class DuplicateHazardMergeRule(BaseRule):
    rule_code = "DUPLICATE_001"
    rule_name = "重复隐患合并规则"
    check_stage = "import_check"

    def __init__(self, db: Session, time_window_days: int = 30):
        super().__init__(db)
        self.time_window_days = time_window_days

    def check(self, hazard: Hazard) -> Tuple[bool, str]:
        if not hazard.location or not hazard.title:
            return True, "位置或标题为空，无法检测重复"
        
        duplicates = self.hazard_repo.find_duplicates(
            location=hazard.location,
            title=hazard.title,
            time_window_days=self.time_window_days
        )
        
        duplicates = [d for d in duplicates if d.id != hazard.id]
        
        if duplicates:
            duplicate_codes = ", ".join([d.hazard_code for d in duplicates[:3]])
            if len(duplicates) > 3:
                duplicate_codes += f" 等{len(duplicates)}条"
            
            if not hazard.is_duplicate:
                self.hazard_repo.mark_as_duplicate(hazard.id, duplicates[0].id)
            
            return False, f"检测到重复隐患：{duplicate_codes}，已自动合并"
        
        return True, "未检测到重复隐患"


class ResponsiblePersonAssignedRule(BaseRule):
    rule_code = "RESPONSIBLE_001"
    rule_name = "责任人分配规则"
    check_stage = "assign_check"

    def check(self, hazard: Hazard) -> Tuple[bool, str]:
        if not hazard.responsible_person_id:
            return False, "未分配整改责任人"
        
        if not hazard.responsible_person:
            return False, "责任人不存在或已失效"
        
        return True, f"已分配责任人：{hazard.responsible_person.name}"


class RuleEngine:
    def __init__(self, db: Session):
        self.db = db
        self.hazard_repo = HazardRepository(db)
        self.rules = {
            "daily_check": [
                OverdueEscalationRule(db),
            ],
            "close_check": [
                PhotoRequiredRule(db),
                ResponsiblePersonAssignedRule(db),
            ],
            "import_check": [
                DuplicateHazardMergeRule(db),
                ResponsiblePersonAssignedRule(db),
            ],
            "recheck_check": [
                PhotoRequiredRule(db),
            ]
        }

    def check_hazard(self, hazard_id: int, stage: str = "close_check") -> List[RuleCheckResultCreate]:
        hazard = self.hazard_repo.get_by_id(hazard_id)
        if not hazard:
            return []
        
        results = []
        rules = self.rules.get(stage, [])
        
        for rule in rules:
            result = rule.apply(hazard)
            results.append(result)
            self.hazard_repo.add_rule_check_result(hazard_id, result)
        
        self.db.flush()
        return results

    def check_all_overdue(self) -> List[Tuple[int, List[RuleCheckResultCreate]]]:
        overdue_hazards = self.hazard_repo.get_overdue_hazards()
        results = []
        
        for hazard in overdue_hazards:
            check_results = self.check_hazard(hazard.id, "daily_check")
            results.append((hazard.id, check_results))
        
        self.db.commit()
        return results

    def can_close_hazard(self, hazard_id: int) -> Tuple[bool, List[str]]:
        results = self.check_hazard(hazard_id, "close_check")
        failed_messages = [r.message for r in results if not r.passed]
        return len(failed_messages) == 0, failed_messages

    def check_import_hazard(self, hazard_id: int) -> Tuple[bool, List[str]]:
        results = self.check_hazard(hazard_id, "import_check")
        failed_messages = [r.message for r in results if not r.passed]
        return len(failed_messages) == 0, failed_messages
