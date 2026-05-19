import os
import uuid
from datetime import datetime
from typing import List, Dict
from collections import defaultdict
from sqlalchemy.orm import Session
from app.models.checklist import (
    ReleaseChecklist,
    Artifact,
    MigrationScript,
    RollbackStep,
    MissingLevel,
)
from app.models.report import CheckReport, CheckReportItem, ReportStatus
from app.models.audit import AuditLog
from app.schemas.report import OwnerSummary


def validate_artifacts_existence(artifacts: List[Artifact]) -> List[Dict]:
    issues = []
    for artifact in artifacts:
        if artifact.path and not os.path.exists(artifact.path):
            issues.append(
                {
                    "level": MissingLevel.CRITICAL,
                    "category": "artifact",
                    "item_name": artifact.name,
                    "description": f"制品文件不存在: {artifact.path}",
                    "owner": None,
                }
            )
        artifact.exists = os.path.exists(artifact.path) if artifact.path else False
        artifact.checked_at = datetime.utcnow()
    return issues


def check_migration_scripts(migration_scripts: List[MigrationScript], owner: str) -> List[Dict]:
    issues = []
    if not migration_scripts:
        issues.append(
            {
                "level": MissingLevel.CRITICAL,
                "category": "migration",
                "item_name": "迁移脚本清单",
                "description": "未提供任何数据库迁移脚本",
                "owner": owner,
            }
        )
    else:
        for script in migration_scripts:
            if not script.rollback_available:
                issues.append(
                    {
                        "level": MissingLevel.HIGH,
                        "category": "migration",
                        "item_name": script.name,
                        "description": f"迁移脚本缺少回滚方案: {script.name}",
                        "owner": owner,
                    }
                )
            if script.path and not os.path.exists(script.path):
                issues.append(
                    {
                        "level": MissingLevel.CRITICAL,
                        "category": "migration",
                        "item_name": script.name,
                        "description": f"迁移脚本文件不存在: {script.path}",
                        "owner": owner,
                    }
                )
    return issues


def check_rollback_steps(rollback_steps: List[RollbackStep], owner: str) -> List[Dict]:
    issues = []
    if not rollback_steps:
        issues.append(
            {
                "level": MissingLevel.CRITICAL,
                "category": "rollback",
                "item_name": "回滚步骤清单",
                "description": "未提供任何发布回滚步骤",
                "owner": owner,
            }
        )
    else:
        for step in rollback_steps:
            if not step.owner:
                issues.append(
                    {
                        "level": MissingLevel.MEDIUM,
                        "category": "rollback",
                        "item_name": f"步骤{step.step_order}",
                        "description": f"回滚步骤缺少负责人: {step.description}",
                        "owner": owner,
                    }
                )
    return issues


def generate_check_report(db: Session, checklist_id: int, generated_by: str) -> CheckReport:
    checklist = db.query(ReleaseChecklist).filter(ReleaseChecklist.id == checklist_id).first()
    if not checklist:
        raise ValueError(f"Checklist {checklist_id} not found")

    report_no = f"RPT-{checklist_id}-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6]}"
    report = CheckReport(
        checklist_id=checklist_id,
        report_no=report_no,
        status=ReportStatus.GENERATED,
        generated_by=generated_by,
    )
    db.add(report)
    db.flush()

    all_issues = []

    artifact_issues = validate_artifacts_existence(checklist.artifacts)
    all_issues.extend(artifact_issues)

    migration_issues = check_migration_scripts(checklist.migration_scripts, checklist.owner)
    all_issues.extend(migration_issues)

    rollback_issues = check_rollback_steps(checklist.rollback_steps, checklist.owner)
    all_issues.extend(rollback_issues)

    critical_count = sum(1 for issue in all_issues if issue["level"] == MissingLevel.CRITICAL)
    high_count = sum(1 for issue in all_issues if issue["level"] == MissingLevel.HIGH)
    medium_count = sum(1 for issue in all_issues if issue["level"] == MissingLevel.MEDIUM)
    low_count = sum(1 for issue in all_issues if issue["level"] == MissingLevel.LOW)

    report.total_issues = len(all_issues)
    report.critical_count = critical_count
    report.high_count = high_count
    report.medium_count = medium_count
    report.low_count = low_count

    summary_parts = [
        f"发布版本: {checklist.version}",
        f"问题总数: {len(all_issues)}",
        f"严重: {critical_count}, 高: {high_count}, 中: {medium_count}, 低: {low_count}",
    ]
    report.summary = "\n".join(summary_parts)

    for issue in all_issues:
        report_item = CheckReportItem(
            report_id=report.id,
            missing_level=issue["level"],
            category=issue["category"],
            item_name=issue["item_name"],
            description=issue["description"],
            owner=issue["owner"],
            fixed=False,
        )
        db.add(report_item)

    db.commit()
    db.refresh(report)
    return report


def get_report(db: Session, report_id: int) -> CheckReport:
    return db.query(CheckReport).filter(CheckReport.id == report_id).first()


def get_reports_by_checklist(db: Session, checklist_id: int) -> List[CheckReport]:
    return db.query(CheckReport).filter(CheckReport.checklist_id == checklist_id).all()


def manual_fix_report_item(
    db: Session,
    report_id: int,
    item_id: int,
    fixed: bool,
    fixed_by: str,
    fix_note: str = None,
) -> CheckReportItem:
    item = (
        db.query(CheckReportItem)
        .filter(CheckReportItem.id == item_id, CheckReportItem.report_id == report_id)
        .first()
    )
    if not item:
        raise ValueError(f"Report item {item_id} not found")

    item.fixed = fixed
    item.fixed_at = datetime.utcnow()
    item.fixed_by = fixed_by
    item.fix_note = fix_note

    report = db.query(CheckReport).filter(CheckReport.id == report_id).first()
    report.status = ReportStatus.MANUALLY_FIXED

    audit_log = AuditLog(
        checklist_id=report.checklist_id,
        action="MANUAL_FIX",
        operator=fixed_by,
        original_data=f"item_id={item_id}, fixed={not fixed}",
        conclusion=fix_note or f"Item marked as {'fixed' if fixed else 'not fixed'}",
    )
    db.add(audit_log)
    db.commit()
    db.refresh(item)
    return item


def summarize_by_owner(db: Session, report_id: int) -> List[OwnerSummary]:
    report = get_report(db, report_id)
    if not report:
        return []

    summary_map = defaultdict(lambda: OwnerSummary(owner=""))

    for item in report.items:
        owner = item.owner or "未分配"
        if not summary_map[owner].owner:
            summary_map[owner].owner = owner

        summary_map[owner].total += 1
        if item.missing_level == MissingLevel.CRITICAL:
            summary_map[owner].critical_count += 1
        elif item.missing_level == MissingLevel.HIGH:
            summary_map[owner].high_count += 1
        elif item.missing_level == MissingLevel.MEDIUM:
            summary_map[owner].medium_count += 1
        elif item.missing_level == MissingLevel.LOW:
            summary_map[owner].low_count += 1

    return list(summary_map.values())


def export_report_to_text(db: Session, report_id: int) -> str:
    report = get_report(db, report_id)
    if not report:
        return ""

    lines = [
        "=" * 60,
        f"发布核对报告: {report.report_no}",
        "=" * 60,
        f"生成时间: {report.generated_at}",
        f"生成人: {report.generated_by}",
        f"状态: {report.status}",
        "",
        f"问题汇总:",
        f"  总数: {report.total_issues}",
        f"  严重: {report.critical_count}",
        f"  高危: {report.high_count}",
        f"  中等: {report.medium_count}",
        f"  低危: {report.low_count}",
        "",
        "问题详情:",
        "-" * 60,
    ]

    level_order = [MissingLevel.CRITICAL, MissingLevel.HIGH, MissingLevel.MEDIUM, MissingLevel.LOW]
    for level in level_order:
        level_items = [item for item in report.items if item.missing_level == level]
        if level_items:
            lines.append(f"\n[{level.value.upper()}] 级别问题 ({len(level_items)}个):")
            for i, item in enumerate(level_items, 1):
                status = "✓ 已修复" if item.fixed else "✗ 待修复"
                lines.append(f"  {i}. [{item.category}] {item.item_name}")
                lines.append(f"     描述: {item.description}")
                lines.append(f"     负责人: {item.owner or '未分配'}")
                lines.append(f"     状态: {status}")
                if item.fixed:
                    lines.append(f"     处理人: {item.fixed_by}, 备注: {item.fix_note or '无'}")

    lines.extend(["", "=" * 60, report.summary or ""])

    return "\n".join(lines)
