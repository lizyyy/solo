"""
核心业务服务
============

包含：
- 去重导入服务：重复导入不翻倍抽检数量
- 三步核心流程：导入→补看备注→补录更新
- 审计日志服务：生成可复盘记录和可重跑命令
"""

import hashlib
import json
import uuid
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime

from sqlalchemy.orm import Session

from .models import (
    ExDividendScreenshot, TaxRateRemark, ComplianceSpotCheck,
    CheckStatus, ChangeAction, ChangeHistory, AuditLog
)
from .boundary_rules import (
    check_institution_name_consistency,
    _create_review_task_for_name_inconsistency,
    _generate_rollback_command
)


# ==================== 去重导入服务 ====================

def _calculate_file_hash(content: str) -> str:
    """计算文件内容哈希，用于去重"""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def _generate_check_no() -> str:
    """生成抽检单号 CBC-20260603-XXXX"""
    date_str = datetime.now().strftime("%Y%m%d")
    suffix = uuid.uuid4().hex[:4].upper()
    return f"CBC-{date_str}-{suffix}"


def import_ex_dividend_screenshots(
    db: Session,
    screenshots_data: List[Dict[str, Any]],
    source_file: str,
    imported_by: str = "assistant_zhou"
) -> Dict[str, Any]:
    """
    导入除权日截图（第一步）

    去重规则：
    - 根据 source_file + ex_dividend_date + institution_name 联合去重
    - 同一来源文件中相同机构+日期的记录只保留一份
    - 重复导入时跳过已存在的记录，不创建新的抽检记录
    - 不把"跨境汇款合规抽检"数量翻倍

    返回导入结果统计
    """
    batch_id = uuid.uuid4().hex[:12]
    file_content = json.dumps(screenshots_data, ensure_ascii=False, sort_keys=True)
    file_hash = _calculate_file_hash(file_content)

    total = len(screenshots_data)
    created = 0
    skipped = 0
    spot_check_ids = []

    for item in screenshots_data:
        institution_name = item.get("institution_name", "").strip()
        ex_dividend_date = item.get("ex_dividend_date", "").strip()

        if not institution_name or not ex_dividend_date:
            skipped += 1
            continue

        existing = (
            db.query(ExDividendScreenshot)
            .filter(
                ExDividendScreenshot.source_file == source_file,
                ExDividendScreenshot.ex_dividend_date == ex_dividend_date,
                ExDividendScreenshot.institution_name == institution_name
            )
            .first()
        )

        if existing:
            skipped += 1
            existing_spot_check = (
                db.query(ComplianceSpotCheck)
                .filter(ComplianceSpotCheck.screenshot_id == existing.id)
                .first()
            )
            if existing_spot_check:
                spot_check_ids.append(existing_spot_check.id)
            continue

        screenshot = ExDividendScreenshot(
            source_file=source_file,
            source_file_hash=file_hash,
            institution_name=institution_name,
            ex_dividend_date=ex_dividend_date,
            dividend_amount=item.get("dividend_amount"),
            currency=item.get("currency"),
            raw_content=item,
            import_batch_id=batch_id,
            imported_by=imported_by
        )
        db.add(screenshot)
        db.flush()

        check_no = _generate_check_no()
        spot_check = ComplianceSpotCheck(
            check_no=check_no,
            screenshot_id=screenshot.id,
            institution_name_from_screenshot=institution_name,
            status=CheckStatus.IMPORTED
        )
        db.add(spot_check)
        db.flush()

        change = ChangeHistory(
            spot_check_id=spot_check.id,
            field_name="status",
            old_value=None,
            new_value=CheckStatus.IMPORTED.value,
            action=ChangeAction.CREATE,
            changed_by=imported_by,
            change_reason="除权日截图导入，创建抽检记录",
            rollback_command=None
        )
        db.add(change)
        db.flush()
        change.rollback_command = _generate_rollback_command(change.id)

        spot_check_ids.append(spot_check.id)
        created += 1

    db.commit()

    summary = (
        f"导入除权日截图: 共{total}条, 新建{created}条, 跳过{skipped}条 "
        f"(去重规则: 源文件+日期+机构名联合去重)"
    )

    rerun_cmd = (
        f"python -m cross_border_compliance.cli import-screenshots "
        f"--source-file '{source_file}' "
        f"--data-file DATA_FILE.json "
        f"--operator {imported_by}"
    )

    audit = AuditLog(
        operation="import_ex_dividend_screenshots",
        operator=imported_by,
        parameters={
            "source_file": source_file,
            "batch_id": batch_id,
            "total_count": total
        },
        result_summary=summary,
        rerun_command=rerun_cmd
    )
    db.add(audit)
    db.commit()

    return {
        "batch_id": batch_id,
        "total": total,
        "created": created,
        "skipped": skipped,
        "spot_check_ids": spot_check_ids,
        "summary": summary,
        "rerun_command": rerun_cmd
    }


# ==================== 第二步：补看税费率备注 ====================

def add_tax_rate_remark(
    db: Session,
    spot_check_id: int,
    remark_data: Dict[str, Any],
    operator: str = "assistant_zhou"
) -> Tuple[Optional[ComplianceSpotCheck], str]:
    """
    投研助理小周补看税费率备注（第二步）

    业务规则：
    - 关联到已有的抽检记录
    - 自动检测机构简称一致性
    - 不一致时不急着归正常，留待财务复核
    - 记录变更历史
    """
    spot_check = db.query(ComplianceSpotCheck).filter(
        ComplianceSpotCheck.id == spot_check_id
    ).first()
    if not spot_check:
        return None, f"抽检记录 {spot_check_id} 不存在"

    if spot_check.status != CheckStatus.IMPORTED:
        return None, f"当前状态 {spot_check.status.value} 不能添加备注"

    institution_name = remark_data.get("institution_name", "").strip()
    remark_content = remark_data.get("remark_content", "").strip()

    if not remark_content:
        return None, "备注内容不能为空"

    remark = TaxRateRemark(
        source_file=remark_data.get("source_file"),
        institution_name=institution_name,
        tax_rate=remark_data.get("tax_rate"),
        tax_type=remark_data.get("tax_type"),
        remark_content=remark_content,
        effective_date=remark_data.get("effective_date"),
        added_by=operator
    )
    db.add(remark)
    db.flush()

    spot_check.remark_id = remark.id
    spot_check.institution_name_from_remark = institution_name

    is_consistent, hint = check_institution_name_consistency(
        db,
        spot_check.institution_name_from_screenshot,
        institution_name
    )
    spot_check.institution_name_consistent = is_consistent

    old_status = spot_check.status.value
    if is_consistent:
        spot_check.status = CheckStatus.REMARK_ADDED
        new_status_value = CheckStatus.REMARK_ADDED.value
        status_reason = "机构简称一致，已添加备注"
    else:
        spot_check.status = CheckStatus.REVIEW_REQUIRED
        new_status_value = CheckStatus.REVIEW_REQUIRED.value
        status_reason = f"机构简称不一致: {hint}，留待财务复核"
        _create_review_task_for_name_inconsistency(db, spot_check)

    change_remark_id = ChangeHistory(
        spot_check_id=spot_check_id,
        field_name="remark_id",
        old_value=None,
        new_value=remark.id,
        action=ChangeAction.UPDATE,
        changed_by=operator,
        change_reason="补录税费率备注",
        rollback_command=None
    )
    change_institution = ChangeHistory(
        spot_check_id=spot_check_id,
        field_name="institution_name_from_remark",
        old_value=None,
        new_value=institution_name,
        action=ChangeAction.UPDATE,
        changed_by=operator,
        change_reason="从税费率备注提取机构名称",
        rollback_command=None
    )
    change_status = ChangeHistory(
        spot_check_id=spot_check_id,
        field_name="status",
        old_value=old_status,
        new_value=new_status_value,
        action=ChangeAction.UPDATE,
        changed_by=operator,
        change_reason=status_reason,
        rollback_command=None
    )
    change_consistent = ChangeHistory(
        spot_check_id=spot_check_id,
        field_name="institution_name_consistent",
        old_value=None,
        new_value=is_consistent,
        action=ChangeAction.UPDATE,
        changed_by=operator,
        change_reason=hint,
        rollback_command=None
    )
    db.add_all([change_remark_id, change_institution, change_status, change_consistent])
    db.flush()
    change_remark_id.rollback_command = _generate_rollback_command(change_remark_id.id)
    change_institution.rollback_command = _generate_rollback_command(change_institution.id)
    change_status.rollback_command = _generate_rollback_command(change_status.id)
    change_consistent.rollback_command = _generate_rollback_command(change_consistent.id)

    db.commit()
    db.refresh(spot_check)

    summary = f"已添加税费率备注: {status_reason}"

    rerun_cmd = (
        f"python -m cross_border_compliance.cli add-remark "
        f"--spot-check-id {spot_check_id} "
        f"--institution-name '{institution_name}' "
        f"--remark-content '{remark_content}' "
        f"--operator {operator}"
    )

    audit = AuditLog(
        operation="add_tax_rate_remark",
        operator=operator,
        parameters={
            "spot_check_id": spot_check_id,
            "institution_name": institution_name,
            "remark_content": remark_content
        },
        result_summary=summary,
        rerun_command=rerun_cmd
    )
    db.add(audit)
    db.commit()

    return spot_check, summary


# ==================== 第三步：补录记录更新 ====================

def update_spot_check_record(
    db: Session,
    spot_check_id: int,
    update_data: Dict[str, Any],
    operator: str = "assistant_zhou"
) -> Tuple[Optional[ComplianceSpotCheck], str]:
    """
    补录记录更新（第三步）

    业务规则：
    - 只能更新 check_result 等非核心字段
    - 更新机构名会触发重新复核
    - 记录每次更新的变更历史
    - 单条备注修改也要能看出改前改后差别
    """
    spot_check = db.query(ComplianceSpotCheck).filter(
        ComplianceSpotCheck.id == spot_check_id
    ).first()
    if not spot_check:
        return None, f"抽检记录 {spot_check_id} 不存在"

    allowed_statuses = [
        CheckStatus.REMARK_ADDED,
        CheckStatus.REVIEWED,
        CheckStatus.REJECTED
    ]
    if spot_check.status not in allowed_statuses:
        return None, (
            f"当前状态 {spot_check.status.value} 不能更新记录, "
            f"需处于 {[s.value for s in allowed_statuses]} 之一"
        )

    updatable_fields = ["check_result"]
    changes_made = []

    for field_name in updatable_fields:
        if field_name in update_data:
            new_value = update_data[field_name]
            old_value = getattr(spot_check, field_name, None)

            if old_value == new_value:
                continue

            change_reason = update_data.get(
                f"{field_name}_reason",
                f"补录更新{field_name}"
            )

            change = ChangeHistory(
                spot_check_id=spot_check_id,
                field_name=field_name,
                old_value=old_value,
                new_value=new_value,
                action=ChangeAction.UPDATE,
                changed_by=operator,
                change_reason=change_reason,
                rollback_command=None
            )
            db.add(change)
            db.flush()
            change.rollback_command = _generate_rollback_command(change.id)

            setattr(spot_check, field_name, new_value)
            changes_made.append(f"{field_name}: {old_value} -> {new_value}")

    if not changes_made:
        return spot_check, "没有可更新的字段或值未变化"

    if spot_check.status == CheckStatus.REVIEWED:
        old_status = spot_check.status.value
        spot_check.status = CheckStatus.COMPLETED

        change_status = ChangeHistory(
            spot_check_id=spot_check_id,
            field_name="status",
            old_value=old_status,
            new_value=CheckStatus.COMPLETED.value,
            action=ChangeAction.UPDATE,
            changed_by=operator,
            change_reason="补录完成，流程结束",
            rollback_command=None
        )
        db.add(change_status)
        db.flush()
        change_status.rollback_command = _generate_rollback_command(change_status.id)
        changes_made.append(f"status: {old_status} -> completed")

    db.commit()
    db.refresh(spot_check)

    summary = f"已更新抽检记录: {'; '.join(changes_made)}"

    check_result_val = update_data.get("check_result", "")
    rerun_cmd = (
        f"python -m cross_border_compliance.cli update-record "
        f"--spot-check-id {spot_check_id} "
        f"--check-result '{check_result_val}' "
        f"--operator {operator}"
    )

    audit = AuditLog(
        operation="update_spot_check_record",
        operator=operator,
        parameters={"spot_check_id": spot_check_id, "update_data": update_data},
        result_summary=summary,
        rerun_command=rerun_cmd
    )
    db.add(audit)
    db.commit()

    return spot_check, summary


# ==================== 审计复盘服务 ====================

def get_audit_timeline(
    db: Session,
    spot_check_id: Optional[int] = None,
    limit: int = 100
) -> List[Dict[str, Any]]:
    """
    获取审计时间线，用于复盘

    返回可复盘的记录，每条包含可重新执行的命令
    """
    query = db.query(AuditLog).order_by(AuditLog.created_at.desc())

    if spot_check_id:
        query = query.filter(
            AuditLog.parameters.op("->>")("spot_check_id") == str(spot_check_id)
        )

    logs = query.limit(limit).all()

    result = []
    for log in logs:
        result.append({
            "id": log.id,
            "operation": log.operation,
            "operator": log.operator,
            "parameters": log.parameters,
            "result_summary": log.result_summary,
            "rerun_command": log.rerun_command,
            "created_at": log.created_at.strftime("%Y-%m-%d %H:%M:%S")
        })

    return result


def get_rerun_commands(
    db: Session,
    spot_check_id: int
) -> List[Dict[str, Any]]:
    """
    获取指定抽检记录的所有可重跑命令

    返回一份可重新跑的命令清单，用于重现整个流程
    """
    logs = (
        db.query(AuditLog)
        .order_by(AuditLog.created_at.asc())
        .all()
    )

    commands = []
    for log in logs:
        params = log.parameters or {}
        if params.get("spot_check_id") == spot_check_id or \
           params.get("batch_id"):
            commands.append({
                "step": len(commands) + 1,
                "operation": log.operation,
                "command": log.rerun_command,
                "description": log.result_summary,
                "timestamp": log.created_at.strftime("%Y-%m-%d %H:%M:%S")
            })

    return commands


def get_spot_check_detail(
    db: Session,
    spot_check_id: int
) -> Dict[str, Any]:
    """获取抽检记录完整详情，包含所有关联数据"""
    from .boundary_rules import get_change_history_diff
    from .boundary_rules import get_source_material_for_visualization

    spot_check = db.query(ComplianceSpotCheck).filter(
        ComplianceSpotCheck.id == spot_check_id
    ).first()
    if not spot_check:
        return {"error": "抽检记录不存在"}

    result = {
        "id": spot_check.id,
        "check_no": spot_check.check_no,
        "status": spot_check.status.value,
        "institution_name_from_screenshot": spot_check.institution_name_from_screenshot,
        "institution_name_from_remark": spot_check.institution_name_from_remark,
        "institution_name_consistent": spot_check.institution_name_consistent,
        "check_result": spot_check.check_result,
        "reviewed_by": spot_check.reviewed_by,
        "reviewed_at": spot_check.reviewed_at.strftime("%Y-%m-%d %H:%M:%S") if spot_check.reviewed_at else None,
        "created_at": spot_check.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        "updated_at": spot_check.updated_at.strftime("%Y-%m-%d %H:%M:%S"),
        "change_history": get_change_history_diff(db, spot_check_id),
        "source_materials": get_source_material_for_visualization(db, spot_check_id),
        "review_tasks": []
    }

    for task in spot_check.review_tasks:
        result["review_tasks"].append({
            "id": task.id,
            "issue_type": task.issue_type,
            "issue_description": task.issue_description,
            "status": task.status,
            "resolution": task.resolution,
            "created_at": task.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "resolved_at": task.resolved_at.strftime("%Y-%m-%d %H:%M:%S") if task.resolved_at else None
        })

    return result
