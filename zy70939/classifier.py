from typing import Tuple
from datetime import datetime
from models import (
    MaterialSubmitRequest, MaterialCategory, FollowUpType,
    CategoryResult
)
from storage import storage


CONTRAINDICATION_DRUGS = {
    "硝酸甘油": ["西地那非", "伟哥"],
    "华法林": ["阿司匹林", "布洛芬"],
    "二甲双胍": ["造影剂"],
    "他汀类": ["红霉素", "克拉霉素"],
}


def check_contraindication(drugs: list) -> Tuple[bool, str]:
    drug_set = set(drugs)
    for main_drug, contraindicated in CONTRAINDICATION_DRUGS.items():
        if main_drug in drug_set:
            conflict = drug_set.intersection(contraindicated)
            if conflict:
                return True, f"{main_drug} 与 {', '.join(conflict)} 存在配伍禁忌"
    return False, ""


def check_required_fields(request: MaterialSubmitRequest) -> Tuple[bool, str]:
    missing = []
    if not request.diagnosis.strip():
        missing.append("诊断信息")
    if not request.drugs or len(request.drugs) == 0:
        missing.append("购药清单")
    if not request.pharmacy_name.strip():
        missing.append("药店名称")
    if missing:
        return False, f"缺少必填字段: {', '.join(missing)}"
    return True, ""


def check_patient_info(request: MaterialSubmitRequest) -> Tuple[bool, str]:
    issues = []
    if not request.age:
        issues.append("年龄")
    if not request.gender:
        issues.append("性别")
    if issues:
        return False, f"患者信息不完整: {', '.join(issues)}"
    return True, ""


def classify_material(
    request: MaterialSubmitRequest,
    processed_by: str
) -> CategoryResult:
    if request.follow_up_type == FollowUpType.CONTRAINDICATION_BLOCK:
        has_conflict, conflict_reason = check_contraindication(request.drugs)
        if has_conflict:
            return CategoryResult(
                category=MaterialCategory.BLOCKED,
                reason=conflict_reason,
                follow_up_type=FollowUpType.CONTRAINDICATION_BLOCK,
                suggested_action="立即拦截，联系医师调整用药方案",
                processed_at=datetime.now(),
                processed_by=processed_by
            )

    fields_ok, fields_reason = check_required_fields(request)
    if not fields_ok:
        return CategoryResult(
            category=MaterialCategory.PENDING_SUPPLEMENT,
            reason=fields_reason,
            follow_up_type=request.follow_up_type,
            suggested_action="联系患者补充相关材料后重新提交",
            processed_at=datetime.now(),
            processed_by=processed_by
        )

    patient_ok, patient_reason = check_patient_info(request)
    if not patient_ok:
        return CategoryResult(
            category=MaterialCategory.PENDING_SUPPLEMENT,
            reason=patient_reason,
            follow_up_type=request.follow_up_type,
            suggested_action="补充患者基础信息",
            processed_at=datetime.now(),
            processed_by=processed_by
        )

    if request.follow_up_type == FollowUpType.POST_PURCHASE:
        action = "按计划进行购药后随访，确认用药依从性和不良反应"
    elif request.follow_up_type == FollowUpType.RETURN_VISIT:
        action = "提醒患者按时复诊，监测病情变化"
    else:
        action = "常规随访"

    return CategoryResult(
        category=MaterialCategory.NORMAL,
        reason="材料完整，信息齐全，符合随访要求",
        follow_up_type=request.follow_up_type,
        suggested_action=action,
        processed_at=datetime.now(),
        processed_by=processed_by
    )
