from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
from ..models.models import (
    GrayRelease,
    GrayEffectCheck,
    GrayEffectStatus,
    TermRule,
    RuleStatus,
    TermLibraryVersion
)
from ..schemas.schemas import GrayReleaseCreate, GrayEffectCheckCreate
from .audit_service import AuditService


class GrayReleaseService:
    def start_gray_release(self, db: Session, gray_data: GrayReleaseCreate) -> GrayRelease:
        rule = db.query(TermRule).filter(TermRule.id == gray_data.rule_id).first()
        if not rule:
            raise ValueError(f"规则不存在: id={gray_data.rule_id}")

        if rule.status != RuleStatus.PENDING_GRAY:
            raise ValueError(
                f"只有「待灰度」状态的规则才能开始灰度发布，当前状态为: {self._get_status_display(rule.status)}"
            )

        active_gray = (
            db.query(GrayRelease)
            .filter(
                GrayRelease.rule_id == gray_data.rule_id,
                GrayRelease.is_active == True
            )
            .first()
        )
        if active_gray:
            raise ValueError(
                f"该规则已有活跃的灰度发布（ID: {active_gray.id}），请先停止后再开始新的灰度。"
            )

        if gray_data.version_id:
            version = db.query(TermLibraryVersion).filter(TermLibraryVersion.id == gray_data.version_id).first()
            if not version:
                raise ValueError(f"词库版本不存在: id={gray_data.version_id}")

        gray = GrayRelease(
            rule_id=gray_data.rule_id,
            version_id=gray_data.version_id,
            traffic_percentage=gray_data.traffic_percentage,
            is_active=True,
            effect_status=GrayEffectStatus.PENDING,
            created_by=gray_data.created_by,
            start_time=datetime.utcnow()
        )
        
        db.add(gray)
        db.flush()

        old_status = rule.status
        rule.status = RuleStatus.IN_GRAY
        rule.current_gray_id = gray.id

        AuditService.log_transition(
            db=db,
            rule_id=rule.id,
            action="START_GRAY",
            from_status=old_status,
            to_status=RuleStatus.IN_GRAY,
            actor=gray_data.created_by,
            reason=f"开始灰度发布，流量比例: {gray_data.traffic_percentage}%",
            details={
                "gray_release_id": gray.id,
                "traffic_percentage": gray_data.traffic_percentage,
                "version_id": gray_data.version_id
            }
        )

        return gray

    def stop_gray_release(
        self,
        db: Session,
        gray_id: int,
        actor: str,
        reason: Optional[str] = None
    ) -> GrayRelease:
        gray = db.query(GrayRelease).filter(GrayRelease.id == gray_id).first()
        if not gray:
            raise ValueError(f"灰度发布不存在: id={gray_id}")

        if not gray.is_active:
            raise ValueError(f"该灰度发布已停止，状态为: {self._get_effect_status_display(gray.effect_status)}")

        rule = db.query(TermRule).filter(TermRule.id == gray.rule_id).first()
        if not rule:
            raise ValueError(f"关联规则不存在: id={gray.rule_id}")

        gray.is_active = False
        gray.stopped_at = datetime.utcnow()
        gray.stopped_by = actor
        gray.end_time = datetime.utcnow()

        old_status = rule.status
        rule.status = RuleStatus.ROLLED_BACK
        rule.current_gray_id = None

        AuditService.log_transition(
            db=db,
            rule_id=rule.id,
            action="ROLLBACK",
            from_status=old_status,
            to_status=RuleStatus.ROLLED_BACK,
            actor=actor,
            reason=reason or "灰度发布已停止",
            details={
                "gray_release_id": gray.id,
                "stop_reason": reason
            }
        )

        return gray

    def add_effect_check(self, db: Session, check_data: GrayEffectCheckCreate) -> GrayEffectCheck:
        gray = db.query(GrayRelease).filter(GrayRelease.id == check_data.gray_release_id).first()
        if not gray:
            raise ValueError(f"灰度发布不存在: id={check_data.gray_release_id}")

        if not gray.is_active:
            raise ValueError(f"该灰度发布已停止，无法添加效果回查。")

        check = GrayEffectCheck(
            gray_release_id=check_data.gray_release_id,
            check_type=check_data.check_type,
            search_term=check_data.search_term,
            expected_result=check_data.expected_result,
            actual_result=check_data.actual_result,
            passed=check_data.passed,
            checked_by=check_data.checked_by,
            checked_at=datetime.utcnow(),
            comments=check_data.comments
        )
        
        db.add(check)
        db.flush()
        return check

    def approve_gray_release(self, db: Session, gray_id: int, actor: str, comment: Optional[str] = None) -> GrayRelease:
        gray = db.query(GrayRelease).filter(GrayRelease.id == gray_id).first()
        if not gray:
            raise ValueError(f"灰度发布不存在: id={gray_id}")

        if not gray.is_active:
            raise ValueError(f"该灰度发布已停止，状态为: {self._get_effect_status_display(gray.effect_status)}")

        checks = (
            db.query(GrayEffectCheck)
            .filter(GrayEffectCheck.gray_release_id == gray_id)
            .all()
        )
        
        if not checks:
            raise ValueError("灰度发布没有效果回查记录，请先添加效果回查后再审批。")

        failed_checks = [c for c in checks if not c.passed]
        if failed_checks:
            raise ValueError(
                f"存在 {len(failed_checks)} 个效果回查未通过，无法审批通过。"
                f"请先修复问题后重新回查。"
            )

        rule = db.query(TermRule).filter(TermRule.id == gray.rule_id).first()
        if not rule:
            raise ValueError(f"关联规则不存在: id={gray.rule_id}")

        old_status = rule.status
        gray.is_active = False
        gray.effect_status = GrayEffectStatus.PASSED
        gray.effect_comment = comment or "灰度效果验证通过"
        gray.stopped_at = datetime.utcnow()
        gray.stopped_by = actor
        gray.end_time = datetime.utcnow()

        rule.status = RuleStatus.PRODUCTION
        rule.current_gray_id = None

        AuditService.log_transition(
            db=db,
            rule_id=rule.id,
            action="APPROVE_GRAY",
            from_status=old_status,
            to_status=RuleStatus.PRODUCTION,
            actor=actor,
            reason=comment or "灰度效果验证通过，全量发布",
            details={
                "gray_release_id": gray.id,
                "check_count": len(checks),
                "passed_count": len([c for c in checks if c.passed])
            }
        )

        return gray

    def reject_gray_release(self, db: Session, gray_id: int, actor: str, comment: Optional[str] = None) -> GrayRelease:
        gray = db.query(GrayRelease).filter(GrayRelease.id == gray_id).first()
        if not gray:
            raise ValueError(f"灰度发布不存在: id={gray_id}")

        if not gray.is_active:
            raise ValueError(f"该灰度发布已停止，状态为: {self._get_effect_status_display(gray.effect_status)}")

        rule = db.query(TermRule).filter(TermRule.id == gray.rule_id).first()
        if not rule:
            raise ValueError(f"关联规则不存在: id={gray.rule_id}")

        old_status = rule.status
        gray.is_active = False
        gray.effect_status = GrayEffectStatus.FAILED
        gray.effect_comment = comment or "灰度效果验证不通过"
        gray.stopped_at = datetime.utcnow()
        gray.stopped_by = actor
        gray.end_time = datetime.utcnow()

        rule.status = RuleStatus.GRAY_REJECTED
        rule.current_gray_id = None

        AuditService.log_transition(
            db=db,
            rule_id=rule.id,
            action="REJECT_GRAY",
            from_status=old_status,
            to_status=RuleStatus.GRAY_REJECTED,
            actor=actor,
            reason=comment or "灰度效果验证不通过",
            details={
                "gray_release_id": gray.id,
                "reject_comment": comment
            }
        )

        return gray

    def get_gray_release(self, db: Session, gray_id: int) -> Optional[GrayRelease]:
        return db.query(GrayRelease).filter(GrayRelease.id == gray_id).first()

    def list_gray_releases(
        self,
        db: Session,
        rule_id: Optional[int] = None,
        is_active: Optional[bool] = None,
        effect_status: Optional[GrayEffectStatus] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[GrayRelease]:
        query = db.query(GrayRelease)
        
        if rule_id:
            query = query.filter(GrayRelease.rule_id == rule_id)
        if is_active is not None:
            query = query.filter(GrayRelease.is_active == is_active)
        if effect_status:
            query = query.filter(GrayRelease.effect_status == effect_status)
        
        return query.order_by(GrayRelease.created_at.desc()).offset(offset).limit(limit).all()

    def list_effect_checks(self, db: Session, gray_id: int) -> List[GrayEffectCheck]:
        return (
            db.query(GrayEffectCheck)
            .filter(GrayEffectCheck.gray_release_id == gray_id)
            .order_by(GrayEffectCheck.checked_at.desc())
            .all()
        )

    def get_active_gray_count(self, db: Session) -> int:
        return (
            db.query(GrayRelease)
            .filter(GrayRelease.is_active == True)
            .count()
        )

    def _get_status_display(self, status: RuleStatus) -> str:
        displays = {
            RuleStatus.DRAFT: "草稿",
            RuleStatus.PENDING_REVIEW: "待审核",
            RuleStatus.REVIEW_REJECTED: "审核驳回",
            RuleStatus.PENDING_GRAY: "待灰度",
            RuleStatus.IN_GRAY: "灰度中",
            RuleStatus.GRAY_REJECTED: "灰度不通过",
            RuleStatus.PRODUCTION: "生产生效",
            RuleStatus.ROLLED_BACK: "已回滚",
            RuleStatus.DEPRECATED: "已废弃"
        }
        return displays.get(status, status.value)

    def _get_effect_status_display(self, status: GrayEffectStatus) -> str:
        displays = {
            GrayEffectStatus.PENDING: "待验证",
            GrayEffectStatus.PASSED: "已通过",
            GrayEffectStatus.FAILED: "未通过"
        }
        return displays.get(status, status.value)
