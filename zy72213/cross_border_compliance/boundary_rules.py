"""
边界规则引擎
============

所有规则代码化，避免口头约定。

机构简称不一致判定规则
----------------------
规则1: 空值判定
  - 任意一方为 None 或空字符串 → 不一致
  - 不自动填充，留待复核

规则2: 精确匹配
  - 完全相同（去除首尾空白后） → 一致
  - 区分中英文，不区分大小写

规则3: 别名映射匹配
  - 查询 institution_aliases 表
  - 两个名称映射到同一个 standard_name → 一致
  - 别名必须 is_active=True

规则4: 相似度判定
  - 编辑距离 > 阈值（默认2）→ 不一致
  - 仅用于提示，不自动判定为一致

修改规则
--------
规则1: 修改留痕
  - 每次修改必须记录 change_history
  - 必须填写 change_reason

规则2: 修改权限
  - assistant 只能修改 remark 相关字段
  - reviewer 可以修改 institution_name 和状态

规则3: 修改后状态
  - 修改机构名后自动变为 review_required
  - 必须重新复核

回滚规则
--------
规则1: 可回滚范围
  - 所有 update 操作均可回滚
  - create 操作可回滚为 delete

规则2: 回滚命令
  - 每次操作生成 rollback_command
  - 可直接执行回滚

规则3: 回滚后状态
  - 回滚后记录新的 change_history（action=rollback）
  - 不删除原历史记录
"""

from typing import Tuple, Optional, Dict, Any
from difflib import SequenceMatcher
from datetime import datetime

from sqlalchemy.orm import Session

from .models import (
    InstitutionAlias, ComplianceSpotCheck, ChangeHistory,
    ChangeAction, CheckStatus, ReviewTask, MaterialSource, TaxRateRemark
)


# ==================== 判定规则 ====================

SIMILARITY_THRESHOLD = 0.8


def normalize_name(name: Optional[str]) -> str:
    """标准化名称：去除首尾空白，转小写

    边界规则：不区分大小写，但区分中英文
    """
    if not name:
        return ""
    return name.strip().lower()


def check_institution_name_consistency(
    db: Session,
    name_from_screenshot: Optional[str],
    name_from_remark: Optional[str]
) -> Tuple[bool, str]:
    """
    判定机构简称是否一致

    返回: (是否一致, 判定说明)

    边界规则代码化，不靠口头约定：
    1. 空值 → 不一致
    2. 精确匹配 → 一致
    3. 别名映射匹配 → 一致
    4. 相似度低 → 不一致 + 提示
    """
    # 规则1: 空值判定
    if not name_from_screenshot or not name_from_remark:
        return False, "机构名称为空，留待财务复核"

    norm_screenshot = normalize_name(name_from_screenshot)
    norm_remark = normalize_name(name_from_remark)

    # 规则2: 精确匹配
    if norm_screenshot == norm_remark:
        return True, "精确匹配一致"

    # 规则3: 别名映射匹配
    std_screenshot = _get_standard_name(db, name_from_screenshot)
    std_remark = _get_standard_name(db, name_from_remark)

    if std_screenshot and std_remark and std_screenshot == std_remark:
        return True, f"通过别名映射一致，标准名称: {std_screenshot}"

    # 规则4: 相似度判定（仅提示，不自动一致）
    similarity = SequenceMatcher(None, norm_screenshot, norm_remark).ratio()
    if similarity >= SIMILARITY_THRESHOLD:
        hint = f"相似度{similarity:.0%}，可能是同一机构，留待财务复核确认"
    else:
        hint = f"相似度{similarity:.0%}，疑似不同机构，留待财务复核确认"

    return False, hint


def _get_standard_name(db: Session, alias_name: str) -> Optional[str]:
    """通过别名获取标准机构名

    边界规则：
    - 如果名称本身就是标准名（存在于 standard_name 字段），返回自身
    - 如果名称是别名，返回对应的 standard_name
    - 否则返回 None
    """
    norm_alias = normalize_name(alias_name)
    result = (
        db.query(InstitutionAlias)
        .filter(InstitutionAlias.is_active.is_(True))
        .all()
    )
    for row in result:
        if normalize_name(row.alias) == norm_alias:
            return row.standard_name
        if normalize_name(row.standard_name) == norm_alias:
            return row.standard_name
    return None


def add_institution_alias(
    db: Session,
    standard_name: str,
    alias: str,
    operator: str
) -> Tuple[bool, str]:
    """添加机构别名映射

    边界规则：
    - 同一别名不能映射到多个标准名
    - 添加后立即生效
    """
    norm_alias = normalize_name(alias)

    existing = (
        db.query(InstitutionAlias)
        .filter(InstitutionAlias.is_active.is_(True))
        .all()
    )
    for row in existing:
        if normalize_name(row.alias) == norm_alias:
            if row.standard_name != standard_name:
                return False, (
                    f"别名 '{alias}' 已映射到 '{row.standard_name}'，"
                    f"不能同时映射到 '{standard_name}'"
                )
            return True, "别名已存在，无需重复添加"

    new_alias = InstitutionAlias(
        standard_name=standard_name,
        alias=alias,
        is_active=True
    )
    db.add(new_alias)
    db.commit()
    return True, f"已添加别名映射: {alias} -> {standard_name}"


# ==================== 修改规则 ====================

def update_spot_check_field(
    db: Session,
    spot_check_id: int,
    field_name: str,
    new_value: Any,
    operator: str,
    change_reason: str
) -> Tuple[Optional[ComplianceSpotCheck], str]:
    """
    修改抽检记录字段

    边界规则：
    1. 必须填写 change_reason
    2. 记录 change_history
    3. 修改机构名后自动变为 review_required
    4. 生成 rollback_command
    """
    if not change_reason:
        return None, "修改必须填写原因(change_reason)"

    spot_check = db.query(ComplianceSpotCheck).filter(
        ComplianceSpotCheck.id == spot_check_id
    ).first()
    if not spot_check:
        return None, f"抽检记录 {spot_check_id} 不存在"

    old_value = getattr(spot_check, field_name, None)

    if old_value == new_value:
        return spot_check, "值未变化，无需修改"

    rollback_cmd = _generate_rollback_command(
        spot_check_id, field_name, old_value
    )

    change = ChangeHistory(
        spot_check_id=spot_check_id,
        field_name=field_name,
        old_value=old_value,
        new_value=new_value,
        action=ChangeAction.UPDATE,
        changed_by=operator,
        change_reason=change_reason,
        rollback_command=rollback_cmd
    )
    db.add(change)

    setattr(spot_check, field_name, new_value)

    if field_name.startswith("institution_name"):
        spot_check.status = CheckStatus.REVIEW_REQUIRED
        spot_check.institution_name_consistent = None
        _create_review_task_for_name_inconsistency(db, spot_check)

    db.commit()
    db.refresh(spot_check)

    return spot_check, f"已修改 {field_name}: {old_value} -> {new_value}"


def _generate_rollback_command(
    spot_check_id: int,
    field_name: str,
    old_value: Any
) -> str:
    """生成回滚命令"""
    value_str = f"'{old_value}'" if isinstance(old_value, str) else str(old_value)
    return (
        f"python -m cross_border_compliance.cli rollback "
        f"--spot-check-id {spot_check_id} "
        f"--field {field_name} "
        f"--value {value_str}"
    )


def _create_review_task_for_name_inconsistency(
    db: Session,
    spot_check: ComplianceSpotCheck
) -> ReviewTask:
    """机构简称不一致时创建复核任务"""
    task = ReviewTask(
        spot_check_id=spot_check.id,
        issue_type="institution_name_inconsistency",
        issue_description=(
            f"除权日截图机构: {spot_check.institution_name_from_screenshot}, "
            f"税费率备注机构: {spot_check.institution_name_from_remark}，"
            f"两者不一致，需财务复核"
        ),
        source_material_type=MaterialSource.EX_DIVIDEND_SCREENSHOT,
        source_material_id=spot_check.screenshot_id or 0,
        status="pending"
    )
    db.add(task)
    return task


# ==================== 回滚规则 ====================

def rollback_change(
    db: Session,
    change_history_id: int,
    operator: str
) -> Tuple[Optional[ComplianceSpotCheck], str]:
    """
    回滚指定变更

    边界规则：
    1. 回滚本身也记录为一条 change_history
    2. 不删除原历史记录
    3. 回滚后状态根据字段自动调整
    """
    change = db.query(ChangeHistory).filter(
        ChangeHistory.id == change_history_id
    ).first()
    if not change:
        return None, f"变更记录 {change_history_id} 不存在"

    spot_check = db.query(ComplianceSpotCheck).filter(
        ComplianceSpotCheck.id == change.spot_check_id
    ).first()
    if not spot_check:
        return None, f"关联抽检记录不存在"

    current_value = getattr(spot_check, change.field_name, None)

    rollback_change = ChangeHistory(
        spot_check_id=change.spot_check_id,
        field_name=change.field_name,
        old_value=current_value,
        new_value=change.old_value,
        action=ChangeAction.ROLLBACK,
        changed_by=operator,
        change_reason=f"回滚变更 #{change_history_id}",
        rollback_command=_generate_rollback_command(
            change.spot_check_id, change.field_name, current_value
        )
    )
    db.add(rollback_change)

    setattr(spot_check, change.field_name, change.old_value)
    db.commit()
    db.refresh(spot_check)

    return spot_check, (
        f"已回滚字段 {change.field_name}: "
        f"{current_value} -> {change.old_value}"
    )


def get_change_history_diff(
    db: Session,
    spot_check_id: int
) -> Dict[str, Any]:
    """
    获取抽检记录的变更历史对比

    返回改前改后的差别，用于历史追溯
    """
    changes = (
        db.query(ChangeHistory)
        .filter(ChangeHistory.spot_check_id == spot_check_id)
        .order_by(ChangeHistory.created_at.asc())
        .all()
    )

    result = {
        "spot_check_id": spot_check_id,
        "total_changes": len(changes),
        "changes": []
    }

    for change in changes:
        result["changes"].append({
            "id": change.id,
            "field": change.field_name,
            "action": change.action.value,
            "old_value": change.old_value,
            "new_value": change.new_value,
            "changed_by": change.changed_by,
            "change_reason": change.change_reason,
            "created_at": change.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "rollback_command": change.rollback_command
        })

    return result


# ==================== 复核规则 ====================

def review_institution_name(
    db: Session,
    spot_check_id: int,
    approved: bool,
    reviewer: str,
    resolution: str,
    standard_name: Optional[str] = None
) -> Tuple[Optional[ComplianceSpotCheck], str]:
    """
    财务复核机构简称不一致

    边界规则：
    - approved=True 且提供 standard_name: 更新为标准名，状态变为 reviewed
    - approved=True 且无 standard_name: 确认当前名称正确，状态变为 reviewed
    - approved=False: 状态变为 rejected，可重新修改
    - 不急着归正常，必须经过此步骤
    """
    spot_check = db.query(ComplianceSpotCheck).filter(
        ComplianceSpotCheck.id == spot_check_id
    ).first()
    if not spot_check:
        return None, f"抽检记录 {spot_check_id} 不存在"

    if spot_check.status != CheckStatus.REVIEW_REQUIRED:
        return None, f"当前状态 {spot_check.status.value} 无需复核"

    task = (
        db.query(ReviewTask)
        .filter(ReviewTask.spot_check_id == spot_check_id)
        .filter(ReviewTask.status == "pending")
        .order_by(ReviewTask.created_at.desc())
        .first()
    )

    if approved:
        if standard_name:
            name_screenshot = standard_name
            name_remark = standard_name
            reason = f"复核通过，统一为标准名: {standard_name}"
        else:
            name_screenshot = spot_check.institution_name_from_screenshot
            name_remark = spot_check.institution_name_from_remark
            reason = "复核通过，确认当前名称正确"

        change_screenshot = ChangeHistory(
            spot_check_id=spot_check_id,
            field_name="institution_name_from_screenshot",
            old_value=spot_check.institution_name_from_screenshot,
            new_value=name_screenshot,
            action=ChangeAction.REVIEW_APPROVE,
            changed_by=reviewer,
            change_reason=reason,
            rollback_command=_generate_rollback_command(
                spot_check_id, "institution_name_from_screenshot",
                spot_check.institution_name_from_screenshot
            )
        )
        change_remark = ChangeHistory(
            spot_check_id=spot_check_id,
            field_name="institution_name_from_remark",
            old_value=spot_check.institution_name_from_remark,
            new_value=name_remark,
            action=ChangeAction.REVIEW_APPROVE,
            changed_by=reviewer,
            change_reason=reason,
            rollback_command=_generate_rollback_command(
                spot_check_id, "institution_name_from_remark",
                spot_check.institution_name_from_remark
            )
        )
        db.add_all([change_screenshot, change_remark])

        spot_check.institution_name_from_screenshot = name_screenshot
        spot_check.institution_name_from_remark = name_remark
        spot_check.institution_name_consistent = True
        spot_check.status = CheckStatus.REVIEWED
        spot_check.reviewed_by = reviewer
        spot_check.reviewed_at = datetime.now()

        if task:
            task.status = "approved"
            task.resolution = f"{reason}. {resolution}"
            task.resolved_at = datetime.now()

        msg = f"复核通过: {reason}"

    else:
        change = ChangeHistory(
            spot_check_id=spot_check_id,
            field_name="status",
            old_value=spot_check.status.value,
            new_value=CheckStatus.REJECTED.value,
            action=ChangeAction.REVIEW_REJECT,
            changed_by=reviewer,
            change_reason=resolution,
            rollback_command=_generate_rollback_command(
                spot_check_id, "status", spot_check.status.value
            )
        )
        db.add(change)

        spot_check.status = CheckStatus.REJECTED
        spot_check.reviewed_by = reviewer
        spot_check.reviewed_at = datetime.now()

        if task:
            task.status = "rejected"
            task.resolution = resolution
            task.resolved_at = datetime.now()

        msg = f"复核驳回: {resolution}"

    db.commit()
    db.refresh(spot_check)

    return spot_check, msg


# ==================== 3D/图表展示 复核跳转规则 ====================

def get_source_material_for_visualization(
    db: Session,
    spot_check_id: int
) -> Dict[str, Any]:
    """
    3D/图表展示时，点击不一致项获取原始材料路径

    边界规则：
    - 不能只剩漂亮画面，必须能回溯原始材料
    - 返回除权日截图或税费率备注的完整信息
    """
    spot_check = db.query(ComplianceSpotCheck).filter(
        ComplianceSpotCheck.id == spot_check_id
    ).first()
    if not spot_check:
        return {"error": "抽检记录不存在"}

    result = {
        "spot_check_id": spot_check_id,
        "check_no": spot_check.check_no,
        "institution_consistent": spot_check.institution_name_consistent,
        "screenshot": None,
        "remark": None
    }

    if spot_check.screenshot:
        result["screenshot"] = {
            "id": spot_check.screenshot.id,
            "source_file": spot_check.screenshot.source_file,
            "institution_name": spot_check.screenshot.institution_name,
            "ex_dividend_date": spot_check.screenshot.ex_dividend_date,
            "dividend_amount": spot_check.screenshot.dividend_amount,
            "imported_at": spot_check.screenshot.imported_at.strftime("%Y-%m-%d %H:%M:%S")
        }

    if spot_check.remark:
        result["remark"] = {
            "id": spot_check.remark.id,
            "source_file": spot_check.remark.source_file,
            "institution_name": spot_check.remark.institution_name,
            "tax_rate": spot_check.remark.tax_rate,
            "remark_content": spot_check.remark.remark_content,
            "added_at": spot_check.remark.added_at.strftime("%Y-%m-%d %H:%M:%S")
        }

    if not spot_check.institution_name_consistent:
        result["jump_recommendation"] = {
            "action": "navigate_to_source",
            "source_type": "screenshot" if result["screenshot"] else "remark",
            "source_id": spot_check.screenshot_id or spot_check.remark_id,
            "hint": "点击查看原始除权日截图或税费率备注进行复核"
        }

    return result
