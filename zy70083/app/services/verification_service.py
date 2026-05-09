from typing import Tuple, List, Dict, Optional
from sqlalchemy.orm import Session
from ..models import (
    ApplicationRecord, FamilyMember, QualificationRule,
    VerificationRecord, ProcessingHistory, ApplicationStatus
)
from datetime import datetime


class VerificationService:
    @staticmethod
    def get_active_rule(db: Session, rule_id: Optional[int] = None) -> QualificationRule:
        if rule_id:
            rule = db.query(QualificationRule).filter(
                QualificationRule.id == rule_id,
                QualificationRule.is_active == True
            ).first()
            if rule:
                return rule
        return db.query(QualificationRule).filter(
            QualificationRule.is_active == True
        ).order_by(QualificationRule.id.desc()).first()

    @staticmethod
    def calculate_family_income(members: List[FamilyMember]) -> float:
        return sum(m.monthly_income or 0 for m in members)

    @staticmethod
    def calculate_family_size(members: List[FamilyMember]) -> int:
        return len(members)

    @staticmethod
    def calculate_income_per_person(family_income: float, family_size: int) -> float:
        if family_size == 0:
            return 0.0
        return family_income / family_size

    @staticmethod
    def calculate_total_housing_area(members: List[FamilyMember]) -> float:
        return sum(m.housing_area_contribution or 0 for m in members)

    @staticmethod
    def calculate_housing_area_per_person(total_area: float, family_size: int) -> float:
        if family_size == 0:
            return 0.0
        return total_area / family_size

    @staticmethod
    def get_min_social_insurance_months(members: List[FamilyMember]) -> int:
        valid_months = [m.social_insurance_months for m in members if m.social_insurance_months is not None]
        return min(valid_months) if valid_months else 0

    @staticmethod
    def verify_income(db: Session, application: ApplicationRecord, rule: QualificationRule) -> Tuple[bool, str, str]:
        family_income = VerificationService.calculate_family_income(application.family_members)
        family_size = VerificationService.calculate_family_size(application.family_members)
        income_per_person = VerificationService.calculate_income_per_person(family_income, family_size)

        details = {
            "family_income": family_income,
            "family_size": family_size,
            "income_per_person": income_per_person,
            "min_income_threshold": rule.min_income_threshold,
            "max_income_threshold": rule.max_income_threshold
        }

        if rule.max_income_threshold is not None and income_per_person > rule.max_income_threshold:
            return False, f"家庭人均月收入 {income_per_person:.2f} 元超过规则上限 {rule.max_income_threshold} 元", str(details)

        if rule.min_income_threshold is not None and income_per_person < rule.min_income_threshold:
            return False, f"家庭人均月收入 {income_per_person:.2f} 元低于规则下限 {rule.min_income_threshold} 元", str(details)

        return True, f"家庭人均月收入 {income_per_person:.2f} 元符合资格要求", str(details)

    @staticmethod
    def verify_social_insurance(db: Session, application: ApplicationRecord, rule: QualificationRule) -> Tuple[bool, str, str]:
        min_months = VerificationService.get_min_social_insurance_months(application.family_members)
        main_applicant = next((m for m in application.family_members if m.is_main_applicant), None)
        main_applicant_months = main_applicant.social_insurance_months if main_applicant else None

        details = {
            "main_applicant_months": main_applicant_months,
            "family_min_months": min_months,
            "required_months": rule.min_social_insurance_months
        }

        if rule.min_social_insurance_months is not None:
            if main_applicant_months is None:
                return False, "主申请人社保信息缺失", str(details)
            if main_applicant_months < rule.min_social_insurance_months:
                return False, f"主申请人社保缴纳 {main_applicant_months} 个月，低于要求的 {rule.min_social_insurance_months} 个月", str(details)

        return True, f"主申请人社保缴纳 {main_applicant_months or 0} 个月符合资格要求", str(details)

    @staticmethod
    def verify_housing_status(db: Session, application: ApplicationRecord, rule: QualificationRule) -> Tuple[bool, str, str]:
        total_area = VerificationService.calculate_total_housing_area(application.family_members)
        family_size = VerificationService.calculate_family_size(application.family_members)
        area_per_person = VerificationService.calculate_housing_area_per_person(total_area, family_size)

        details = {
            "total_housing_area": total_area,
            "family_size": family_size,
            "area_per_person": area_per_person,
            "max_area_per_person": rule.max_housing_area_per_person,
            "max_family_area": rule.max_family_housing_area
        }

        if rule.max_housing_area_per_person is not None and area_per_person > rule.max_housing_area_per_person:
            return False, f"家庭人均住房面积 {area_per_person:.2f} 平方米超过规则上限 {rule.max_housing_area_per_person} 平方米", str(details)

        if rule.max_family_housing_area is not None and total_area > rule.max_family_housing_area:
            return False, f"家庭总住房面积 {total_area:.2f} 平方米超过规则上限 {rule.max_family_housing_area} 平方米", str(details)

        return True, f"家庭住房状况符合资格要求", str(details)

    @staticmethod
    def create_verification_record(
        db: Session,
        application_id: int,
        verification_type: str,
        passed: bool,
        message: str,
        details: Optional[str] = None,
        verified_by: Optional[str] = None
    ) -> VerificationRecord:
        record = VerificationRecord(
            application_record_id=application_id,
            verification_type=verification_type,
            verification_status="completed",
            verification_result="passed" if passed else "failed",
            verification_message=message,
            details=details,
            verified_by=verified_by
        )
        db.add(record)
        db.flush()
        return record

    @staticmethod
    def create_processing_history(
        db: Session,
        application: ApplicationRecord,
        new_status: str,
        action: str,
        checkpoint: Optional[str] = None,
        operator: Optional[str] = None,
        remark: Optional[str] = None
    ) -> ProcessingHistory:
        history = ProcessingHistory(
            application_record_id=application.id,
            previous_status=application.current_status,
            new_status=new_status,
            checkpoint=checkpoint,
            action=action,
            operator=operator,
            remark=remark
        )
        db.add(history)
        db.flush()
        return history

    @staticmethod
    def run_full_verification(
        db: Session,
        application: ApplicationRecord,
        operator: Optional[str] = None
    ) -> Tuple[bool, List[Dict]]:
        rule = VerificationService.get_active_rule(db, application.applied_rule_id)
        if not rule:
            return False, [{"checkpoint": "rule_lookup", "passed": False, "message": "未找到有效的资格规则"}]

        results = []

        VerificationService.create_processing_history(
            db, application,
            new_status=ApplicationStatus.UNDER_REVIEW.value,
            action="开始资格核验",
            operator=operator
        )
        application.current_status = ApplicationStatus.UNDER_REVIEW.value
        db.flush()

        VerificationService.create_processing_history(
            db, application,
            new_status=ApplicationStatus.INCOME_VERIFICATION.value,
            action="收入资格核验",
            checkpoint="income_verification",
            operator=operator
        )
        application.current_status = ApplicationStatus.INCOME_VERIFICATION.value
        application.current_checkpoint = "income_verification"
        db.flush()

        income_passed, income_msg, income_details = VerificationService.verify_income(db, application, rule)
        VerificationService.create_verification_record(
            db, application.id, "income", income_passed, income_msg, income_details, operator
        )
        results.append({"checkpoint": "income_verification", "passed": income_passed, "message": income_msg})

        if not income_passed:
            VerificationService.create_processing_history(
                db, application,
                new_status=ApplicationStatus.REJECTED.value,
                action="收入核验未通过",
                checkpoint="income_verification",
                operator=operator,
                remark=income_msg
            )
            application.current_status = ApplicationStatus.REJECTED.value
            application.rejection_reason = income_msg
            db.commit()
            return False, results

        VerificationService.create_processing_history(
            db, application,
            new_status=ApplicationStatus.SOCIAL_INSURANCE_VERIFICATION.value,
            action="社保资格核验",
            checkpoint="social_insurance_verification",
            operator=operator
        )
        application.current_status = ApplicationStatus.SOCIAL_INSURANCE_VERIFICATION.value
        application.current_checkpoint = "social_insurance_verification"
        db.flush()

        insurance_passed, insurance_msg, insurance_details = VerificationService.verify_social_insurance(db, application, rule)
        VerificationService.create_verification_record(
            db, application.id, "social_insurance", insurance_passed, insurance_msg, insurance_details, operator
        )
        results.append({"checkpoint": "social_insurance_verification", "passed": insurance_passed, "message": insurance_msg})

        if not insurance_passed:
            VerificationService.create_processing_history(
                db, application,
                new_status=ApplicationStatus.REJECTED.value,
                action="社保核验未通过",
                checkpoint="social_insurance_verification",
                operator=operator,
                remark=insurance_msg
            )
            application.current_status = ApplicationStatus.REJECTED.value
            application.rejection_reason = insurance_msg
            db.commit()
            return False, results

        VerificationService.create_processing_history(
            db, application,
            new_status=ApplicationStatus.HOUSING_STATUS_VERIFICATION.value,
            action="住房状况核验",
            checkpoint="housing_status_verification",
            operator=operator
        )
        application.current_status = ApplicationStatus.HOUSING_STATUS_VERIFICATION.value
        application.current_checkpoint = "housing_status_verification"
        db.flush()

        housing_passed, housing_msg, housing_details = VerificationService.verify_housing_status(db, application, rule)
        VerificationService.create_verification_record(
            db, application.id, "housing_status", housing_passed, housing_msg, housing_details, operator
        )
        results.append({"checkpoint": "housing_status_verification", "passed": housing_passed, "message": housing_msg})

        if not housing_passed:
            VerificationService.create_processing_history(
                db, application,
                new_status=ApplicationStatus.REJECTED.value,
                action="住房核验未通过",
                checkpoint="housing_status_verification",
                operator=operator,
                remark=housing_msg
            )
            application.current_status = ApplicationStatus.REJECTED.value
            application.rejection_reason = housing_msg
            db.commit()
            return False, results

        VerificationService.create_processing_history(
            db, application,
            new_status=ApplicationStatus.VERIFIED.value,
            action="全部核验通过",
            checkpoint="all_verified",
            operator=operator
        )
        application.current_status = ApplicationStatus.VERIFIED.value
        application.current_checkpoint = None
        application.rejection_reason = None
        db.commit()

        return True, results

    @staticmethod
    def retry_verification(
        db: Session,
        application: ApplicationRecord,
        operator: Optional[str] = None,
        remark: Optional[str] = None
    ) -> Tuple[bool, str]:
        if application.current_status != ApplicationStatus.REJECTED.value:
            return False, f"当前状态为 {application.current_status}，只有拒绝状态可以重试"

        checkpoint = application.current_checkpoint

        VerificationService.create_processing_history(
            db, application,
            new_status=ApplicationStatus.UNDER_REVIEW.value,
            action="重新开始资格核验",
            checkpoint=checkpoint,
            operator=operator,
            remark=remark or f"从卡点 {checkpoint} 重新核验"
        )
        application.current_status = ApplicationStatus.UNDER_REVIEW.value
        application.rejection_reason = None
        db.flush()

        rule = VerificationService.get_active_rule(db, application.applied_rule_id)
        if not rule:
            return False, "未找到有效的资格规则"

        checkpoint_map = {
            "income_verification": (ApplicationStatus.INCOME_VERIFICATION, "income_verification"),
            "social_insurance_verification": (ApplicationStatus.INCOME_VERIFICATION, "income_verification"),
            "housing_status_verification": (ApplicationStatus.SOCIAL_INSURANCE_VERIFICATION, "social_insurance_verification")
        }

        if checkpoint in checkpoint_map:
            status, cp = checkpoint_map[checkpoint]
            application.current_status = status.value
            application.current_checkpoint = cp
            db.flush()

        passed, results = VerificationService.run_full_verification(db, application, operator)
        if passed:
            return True, "重新核验通过"
        return False, results[-1]["message"] if results else "核验失败"
