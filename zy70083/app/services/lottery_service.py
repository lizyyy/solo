from typing import Optional, List, Dict, Tuple
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from datetime import datetime
from ..models import (
    ApplicationRecord, LotteryPool, ObjectionRecord,
    ProcessingHistory, ApplicationStatus
)
from .verification_service import VerificationService


class LotteryService:
    @staticmethod
    def create_lottery_pool(
        db: Session,
        pool_id: str,
        pool_name: str,
        lottery_year: int,
        lottery_batch: int,
        total_quota: int,
        announcement_date: Optional[datetime] = None
    ) -> LotteryPool:
        existing = db.query(LotteryPool).filter(LotteryPool.pool_id == pool_id).first()
        if existing:
            raise ValueError(f"摇号池 {pool_id} 已存在")

        pool = LotteryPool(
            pool_id=pool_id,
            pool_name=pool_name,
            lottery_year=lottery_year,
            lottery_batch=lottery_batch,
            total_quota=total_quota,
            announcement_date=announcement_date
        )
        db.add(pool)
        db.commit()
        db.refresh(pool)
        return pool

    @staticmethod
    def lock_for_lottery(
        db: Session,
        application: ApplicationRecord,
        pool_id: str,
        operator: Optional[str] = None
    ) -> Tuple[bool, str]:
        if application.current_status != ApplicationStatus.VERIFIED.value:
            return False, f"当前状态为 {application.current_status}，只有已核验通过的申请可以锁定"

        pool = db.query(LotteryPool).filter(
            LotteryPool.pool_id == pool_id,
            LotteryPool.is_active == True
        ).first()
        if not pool:
            return False, f"摇号池 {pool_id} 不存在或已关闭"

        if pool.locked_count >= pool.total_quota:
            return False, f"摇号池 {pool_id} 名额已满"

        VerificationService.create_processing_history(
            db, application,
            new_status=ApplicationStatus.LOTTERY_LOCKED.value,
            action="摇号资格锁定",
            checkpoint="lottery_lock",
            operator=operator,
            remark=f"锁定到摇号池 {pool_id}"
        )
        application.current_status = ApplicationStatus.LOTTERY_LOCKED.value
        application.lottery_pool_id = pool_id
        application.lottery_locked_at = func.now()
        pool.locked_count += 1
        db.commit()
        return True, f"已成功锁定到摇号池 {pool_id}"

    @staticmethod
    def start_public_announcement(
        db: Session,
        pool_id: str,
        operator: Optional[str] = None
    ) -> Tuple[bool, str]:
        pool = db.query(LotteryPool).filter(
            LotteryPool.pool_id == pool_id,
            LotteryPool.is_active == True
        ).first()
        if not pool:
            return False, f"摇号池 {pool_id} 不存在或已关闭"

        applications = db.query(ApplicationRecord).filter(
            ApplicationRecord.lottery_pool_id == pool_id,
            ApplicationRecord.current_status == ApplicationStatus.LOTTERY_LOCKED.value
        ).all()

        for app in applications:
            VerificationService.create_processing_history(
                db, app,
                new_status=ApplicationStatus.PUBLIC_ANNOUNCEMENT.value,
                action="进入公示期",
                checkpoint="public_announcement",
                operator=operator
            )
            app.current_status = ApplicationStatus.PUBLIC_ANNOUNCEMENT.value
            app.public_announcement_at = func.now()

        db.commit()
        return True, f"摇号池 {pool_id} 的 {len(applications)} 个申请已进入公示期"

    @staticmethod
    def submit_objection(
        db: Session,
        application_id: int,
        objector_name: str,
        objector_contact: str,
        objection_content: str
    ) -> Tuple[bool, str, Optional[ObjectionRecord]]:
        application = db.query(ApplicationRecord).filter(
            ApplicationRecord.id == application_id
        ).first()
        if not application:
            return False, "申请记录不存在", None

        if application.current_status not in [
            ApplicationStatus.PUBLIC_ANNOUNCEMENT.value,
            ApplicationStatus.OBJECTION_RAISED.value
        ]:
            return False, f"当前状态为 {application.current_status}，只有公示期的申请可以提交异议", None

        objection = ObjectionRecord(
            application_record_id=application_id,
            objector_name=objector_name,
            objector_contact=objector_contact,
            objection_content=objection_content
        )
        db.add(objection)

        if application.current_status == ApplicationStatus.PUBLIC_ANNOUNCEMENT.value:
            VerificationService.create_processing_history(
                db, application,
                new_status=ApplicationStatus.OBJECTION_RAISED.value,
                action="收到公示异议",
                checkpoint="objection_raised",
                remark=f"异议人：{objector_name}"
            )
            application.current_status = ApplicationStatus.OBJECTION_RAISED.value

        db.commit()
        db.refresh(objection)
        return True, "异议提交成功", objection

    @staticmethod
    def handle_objection(
        db: Session,
        objection_id: int,
        handling_remark: str,
        handling_result: str,
        operator: Optional[str] = None
    ) -> Tuple[bool, str]:
        objection = db.query(ObjectionRecord).filter(
            ObjectionRecord.id == objection_id
        ).first()
        if not objection:
            return False, "异议记录不存在"

        if objection.handling_status != "pending":
            return False, f"异议已被处理，状态为 {objection.handling_status}"

        application = db.query(ApplicationRecord).filter(
            ApplicationRecord.id == objection.application_record_id
        ).first()
        if not application:
            return False, "关联的申请记录不存在"

        objection.handling_status = "completed"
        objection.handling_remark = handling_remark
        objection.handling_result = handling_result
        objection.handled_at = func.now()

        if handling_result == "objection_justified":
            VerificationService.create_processing_history(
                db, application,
                new_status=ApplicationStatus.REJECTED.value,
                action="异议成立，资格取消",
                checkpoint="objection_handled",
                operator=operator,
                remark=handling_remark
            )
            application.current_status = ApplicationStatus.REJECTED.value
            application.rejection_reason = f"公示异议成立：{handling_remark}"
        else:
            VerificationService.create_processing_history(
                db, application,
                new_status=ApplicationStatus.OBJECTION_RESOLVED.value,
                action="异议不成立，恢复公示",
                checkpoint="objection_resolved",
                operator=operator,
                remark=handling_remark
            )
            application.current_status = ApplicationStatus.OBJECTION_RESOLVED.value

        db.commit()
        return True, "异议处理完成"

    @staticmethod
    def finalize_result(
        db: Session,
        pool_id: str,
        operator: Optional[str] = None
    ) -> Tuple[bool, str, Dict]:
        pool = db.query(LotteryPool).filter(
            LotteryPool.pool_id == pool_id,
            LotteryPool.is_active == True
        ).first()
        if not pool:
            return False, f"摇号池 {pool_id} 不存在或已关闭", {}

        valid_applications = db.query(ApplicationRecord).filter(
            ApplicationRecord.lottery_pool_id == pool_id,
            ApplicationRecord.current_status.in_([
                ApplicationStatus.PUBLIC_ANNOUNCEMENT.value,
                ApplicationStatus.OBJECTION_RESOLVED.value
            ])
        ).all()

        rejected_applications = db.query(ApplicationRecord).filter(
            ApplicationRecord.lottery_pool_id == pool_id,
            ApplicationRecord.current_status == ApplicationStatus.REJECTED.value
        ).all()

        for app in valid_applications:
            VerificationService.create_processing_history(
                db, app,
                new_status=ApplicationStatus.FINAL_RESULT.value,
                action="摇号资格最终确认",
                checkpoint="final_result",
                operator=operator
            )
            app.current_status = ApplicationStatus.FINAL_RESULT.value
            app.final_result = "qualified"
            pool.selected_count += 1

        pool.is_active = False
        db.commit()

        return True, "摇号结果确认完成", {
            "pool_id": pool_id,
            "qualified_count": len(valid_applications),
            "rejected_count": len(rejected_applications),
            "total_count": pool.locked_count
        }

    @staticmethod
    def get_application_status_detail(
        db: Session,
        application_id: int
    ) -> Optional[Dict]:
        application = db.query(ApplicationRecord).filter(
            ApplicationRecord.id == application_id
        ).first()
        if not application:
            return None

        last_history = db.query(ProcessingHistory).filter(
            ProcessingHistory.application_record_id == application_id
        ).order_by(ProcessingHistory.created_at.desc()).first()

        can_retry = application.current_status == ApplicationStatus.REJECTED.value
        retry_suggestion = None

        if can_retry:
            checkpoint = application.current_checkpoint
            suggestion_map = {
                "income_verification": "请更新家庭成员收入信息后重试",
                "social_insurance_verification": "请补充或更新社保缴纳证明后重试",
                "housing_status_verification": "请更新住房信息后重试",
                "objection_handled": "公示异议已取消资格，如需重新申请请提交新的申请"
            }
            retry_suggestion = suggestion_map.get(checkpoint, "请检查申请材料后重试")

        return {
            "application_number": application.application_number,
            "current_status": application.current_status,
            "current_checkpoint": application.current_checkpoint,
            "rejection_reason": application.rejection_reason,
            "last_processing_action": last_history.action if last_history else None,
            "last_processing_time": last_history.created_at if last_history else None,
            "can_retry": can_retry,
            "retry_suggestion": retry_suggestion
        }

    @staticmethod
    def get_processing_history(
        db: Session,
        application_id: int,
        limit: int = 20
    ) -> List[ProcessingHistory]:
        return db.query(ProcessingHistory).filter(
            ProcessingHistory.application_record_id == application_id
        ).order_by(ProcessingHistory.created_at.desc()).limit(limit).all()
