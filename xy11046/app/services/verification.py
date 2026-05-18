from datetime import datetime, date
from typing import List, Tuple, Optional
from app.models.schemas import (
    MealVoucher, VerificationStatus, CertificateStatus,
    SubsidyLevel, VerificationResult
)
from app.services.database import db


class VerificationRule:
    def __init__(self, rule_id: str, rule_name: str, description: str):
        self.rule_id = rule_id
        self.rule_name = rule_name
        self.description = description

    def check(self, voucher: MealVoucher) -> Tuple[bool, Optional[str]]:
        raise NotImplementedError


class IDCardFormatRule(VerificationRule):
    def __init__(self):
        super().__init__("R001", "身份证格式校验", "检查身份证号格式是否正确")

    def check(self, voucher: MealVoucher) -> Tuple[bool, Optional[str]]:
        id_card = voucher.id_card
        if len(id_card) != 18:
            return False, "身份证号长度应为18位"
        return True, None


class ExpireDateRule(VerificationRule):
    def __init__(self):
        super().__init__("R002", "有效期校验", "检查助餐券是否在有效期内")

    def check(self, voucher: MealVoucher) -> Tuple[bool, Optional[str]]:
        today = date.today()
        if voucher.expire_date < today:
            return False, f"助餐券已过期，有效期至{voucher.expire_date}"
        return True, None


class SubsidyLevelMatchRule(VerificationRule):
    def __init__(self):
        super().__init__("R003", "补贴等级匹配校验", "检查补贴等级与申请人条件是否匹配")

    def check(self, voucher: MealVoucher) -> Tuple[bool, Optional[str]]:
        if voucher.subsidy_level == SubsidyLevel.LEVEL_A:
            if voucher.elderly_age and voucher.elderly_age >= 80:
                return True, None
            if voucher.low_income_cert:
                return True, None
            return False, "A级补贴需要80岁以上老人或低保户证明"
        elif voucher.subsidy_level == SubsidyLevel.LEVEL_B:
            if voucher.elderly_age and voucher.elderly_age >= 70:
                return True, None
            if voucher.disability_cert:
                return True, None
            return False, "B级补贴需要70岁以上老人或残疾人证明"
        return True, None


class RequiredDocumentsRule(VerificationRule):
    def __init__(self):
        super().__init__("R004", "必备材料校验", "检查必备申请材料是否齐全")

    def check(self, voucher: MealVoucher) -> Tuple[bool, Optional[str]]:
        missing = []
        if not voucher.household_registry:
            missing.append("户口本")
        if not voucher.income_proof:
            missing.append("收入证明")
        
        if voucher.applicant_type == "老年人":
            if not voucher.elderly_cert:
                missing.append("老年证")
        
        if voucher.applicant_type == "残疾人":
            if not voucher.disability_cert:
                missing.append("残疾证")
        
        if voucher.applicant_type == "低保户":
            if not voucher.low_income_cert:
                missing.append("低保证")
        
        if missing:
            return False, f"缺少必备材料: {', '.join(missing)}"
        return True, None


class DiningPointValidityRule(VerificationRule):
    def __init__(self):
        super().__init__("R005", "助餐点有效性校验", "检查助餐点编号是否有效")

    def check(self, voucher: MealVoucher) -> Tuple[bool, Optional[str]]:
        valid_codes = {"DP001", "DP002", "DP003", "DP004", "DP005"}
        if voucher.dining_point_code not in valid_codes:
            return False, f"助餐点编号{voucher.dining_point_code}无效"
        return True, None


class VerificationService:
    def __init__(self):
        self.rules: List[VerificationRule] = [
            IDCardFormatRule(),
            ExpireDateRule(),
            SubsidyLevelMatchRule(),
            RequiredDocumentsRule(),
            DiningPointValidityRule()
        ]

    def get_required_materials(self, voucher: MealVoucher) -> List[str]:
        required = ["户口本", "收入证明"]
        if voucher.applicant_type == "老年人":
            required.append("老年证")
        if voucher.applicant_type == "残疾人":
            required.append("残疾证")
        if voucher.applicant_type == "低保户":
            required.append("低保证")
        
        missing = []
        if not voucher.household_registry:
            missing.append("户口本")
        if not voucher.income_proof:
            missing.append("收入证明")
        if voucher.applicant_type == "老年人" and not voucher.elderly_cert:
            missing.append("老年证")
        if voucher.applicant_type == "残疾人" and not voucher.disability_cert:
            missing.append("残疾证")
        if voucher.applicant_type == "低保户" and not voucher.low_income_cert:
            missing.append("低保证")
        
        return missing

    def check_monthly_report_consistency(self, voucher: MealVoucher) -> bool:
        report_key = f"{voucher.issue_date.year}-{voucher.issue_date.month:02d}"
        report = db.get_monthly_report(report_key)
        if report is None:
            return True
        if voucher.voucher_no in report.get("voucher_list", []):
            return voucher.subsidy_level == report.get("subsidy_levels", {}).get(voucher.voucher_no, voucher.subsidy_level)
        return True

    def is_old_voucher_usable(self, voucher: MealVoucher) -> bool:
        if len(voucher.subsidy_level_history) <= 1:
            return True
        today = date.today()
        if voucher.issue_date <= today <= voucher.expire_date:
            return True
        return False

    def verify_voucher(self, voucher_no: str, verifier: str, remark: Optional[str] = None) -> Tuple[VerificationResult, List[str]]:
        voucher = db.get_voucher(voucher_no)
        if not voucher:
            raise ValueError(f"助餐券{voucher_no}不存在")

        failed_rules = []
        all_passed = True

        for rule in self.rules:
            passed, msg = rule.check(voucher)
            if not passed:
                all_passed = False
                failed_rules.append(f"{rule.rule_id}[{rule.rule_name}]: {msg}")

        required_materials = self.get_required_materials(voucher)
        monthly_consistent = self.check_monthly_report_consistency(voucher)
        old_voucher_usable = self.is_old_voucher_usable(voucher)

        if all_passed:
            status = VerificationStatus.VERIFIED
            cert_status = CertificateStatus.VALID
        elif required_materials:
            status = VerificationStatus.SUPPLEMENT
            cert_status = CertificateStatus.VALID
        else:
            status = VerificationStatus.REJECTED
            cert_status = CertificateStatus.CANCELLED

        original_subsidy_level = voucher.subsidy_level_history[0] if len(voucher.subsidy_level_history) > 0 else None

        db.update_voucher(
            voucher_no,
            verification_status=status,
            certificate_status=cert_status,
            verification_time=datetime.now(),
            verifier=verifier,
            verification_remark=remark
        )

        result = VerificationResult(
            voucher_no=voucher.voucher_no,
            id_card=voucher.id_card,
            name=voucher.name,
            status=status,
            certificate_status=cert_status,
            subsidy_level=voucher.subsidy_level,
            original_subsidy_level=original_subsidy_level,
            required_materials=required_materials,
            verification_remark=remark,
            monthly_report_consistent=monthly_consistent,
            old_voucher_usable=old_voucher_usable
        )

        return result, failed_rules

    def update_subsidy_level(self, voucher_no: str, new_level: SubsidyLevel, operator: str) -> MealVoucher:
        voucher = db.get_voucher(voucher_no)
        if not voucher:
            raise ValueError(f"助餐券{voucher_no}不存在")
        
        new_history = voucher.subsidy_level_history + [new_level]
        updated = db.update_voucher(
            voucher_no,
            subsidy_level=new_level,
            subsidy_level_history=new_history,
            operator=operator
        )
        return updated


verification_service = VerificationService()
