from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime, date
import json
from .models import (
    Student, Course, Exam, DeferralApplication, Score, AuditLog,
    DeferralStatus, ExamStatus, ScoreStatus, AuditAction
)
from .schemas import (
    DeferralApplicationCreate, EligibilityCheckResult, ScoreBatchInput
)


class AuditService:
    @staticmethod
    def create_log(
        db: Session,
        resource_type: str,
        resource_id: int,
        action: AuditAction,
        old_value: Any = None,
        new_value: Any = None,
        operator_id: Optional[int] = None,
        operator_name: Optional[str] = None,
        comment: Optional[str] = None
    ) -> AuditLog:
        log = AuditLog(
            resource_type=resource_type,
            resource_id=resource_id,
            action=action,
            operator_id=operator_id,
            operator_name=operator_name,
            old_value=json.dumps(old_value, ensure_ascii=False) if old_value else None,
            new_value=json.dumps(new_value, ensure_ascii=False) if new_value else None,
            comment=comment
        )
        db.add(log)
        db.flush()
        return log


class DeferralApplicationService:
    @staticmethod
    def create_application(
        db: Session,
        data: DeferralApplicationCreate
    ) -> DeferralApplication:
        application = DeferralApplication(
            student_id=data.student_id,
            exam_id=data.exam_id,
            reason=data.reason,
            reason_type=data.reason_type,
            evidence_url=data.evidence_url,
            status=DeferralStatus.DRAFT
        )
        db.add(application)
        db.flush()
        
        AuditService.create_log(
            db=db,
            resource_type="DeferralApplication",
            resource_id=application.id,
            action=AuditAction.SUBMIT,
            old_value=None,
            new_value={"status": DeferralStatus.DRAFT},
            comment="创建缓考申请草稿"
        )
        return application
    
    @staticmethod
    def submit_application(
        db: Session,
        application_id: int
    ) -> DeferralApplication:
        application = db.query(DeferralApplication).filter(
            DeferralApplication.id == application_id
        ).first()
        
        if not application:
            raise ValueError("申请不存在")
        if application.status != DeferralStatus.DRAFT:
            raise ValueError("只有草稿状态的申请可以提交")
        
        old_status = application.status.value
        application.status = DeferralStatus.PENDING_REVIEW
        db.flush()
        
        AuditService.create_log(
            db=db,
            resource_type="DeferralApplication",
            resource_id=application.id,
            action=AuditAction.SUBMIT,
            old_value={"status": old_status},
            new_value={"status": application.status.value},
            comment="学生提交缓考申请"
        )
        return application
    
    @staticmethod
    def review_application(
        db: Session,
        application_id: int,
        approved: bool,
        review_comment: Optional[str] = None,
        reviewer_id: Optional[int] = None
    ) -> DeferralApplication:
        application = db.query(DeferralApplication).filter(
            DeferralApplication.id == application_id
        ).first()
        
        if not application:
            raise ValueError("申请不存在")
        if application.status != DeferralStatus.PENDING_REVIEW:
            raise ValueError("只有待审核状态的申请可以审核")
        
        old_status = application.status.value
        application.status = DeferralStatus.APPROVED if approved else DeferralStatus.REJECTED
        application.reviewer_id = reviewer_id
        application.review_comment = review_comment
        application.review_at = datetime.utcnow()
        db.flush()
        
        action = AuditAction.APPROVE if approved else AuditAction.REJECT
        AuditService.create_log(
            db=db,
            resource_type="DeferralApplication",
            resource_id=application.id,
            action=action,
            old_value={"status": old_status},
            new_value={"status": application.status.value, "comment": review_comment},
            operator_id=reviewer_id,
            comment="教务审核通过" if approved else "教务审核拒绝"
        )
        return application
    
    @staticmethod
    def cancel_application(
        db: Session,
        application_id: int,
        reason: Optional[str] = None
    ) -> DeferralApplication:
        application = db.query(DeferralApplication).filter(
            DeferralApplication.id == application_id
        ).first()
        
        if not application:
            raise ValueError("申请不存在")
        if application.status in [DeferralStatus.CANCELLED, DeferralStatus.COMPLETED, DeferralStatus.REJECTED]:
            raise ValueError("当前状态无法撤回")
        
        old_status = application.status.value
        application.status = DeferralStatus.CANCELLED
        db.flush()
        
        AuditService.create_log(
            db=db,
            resource_type="DeferralApplication",
            resource_id=application.id,
            action=AuditAction.CANCEL,
            old_value={"status": old_status},
            new_value={"status": DeferralStatus.CANCELLED.value, "reason": reason},
            comment=f"撤回缓考申请：{reason or '未说明原因'}"
        )
        return application


class EligibilityService:
    @staticmethod
    def check_eligibility(
        db: Session,
        student_id: int,
        exam_id: int
    ) -> EligibilityCheckResult:
        student = db.query(Student).filter(Student.id == student_id).first()
        exam = db.query(Exam).filter(Exam.id == exam_id).first()
        
        if not student or not exam:
            raise ValueError("学生或考试不存在")
        
        course = db.query(Course).filter(Course.id == exam.course_id).first()
        
        reasons = []
        warnings = []
        eligible = True
        
        existing_approved = db.query(DeferralApplication).filter(
            DeferralApplication.student_id == student_id,
            DeferralApplication.exam_id == exam_id,
            DeferralApplication.status.in_([
                DeferralStatus.APPROVED,
                DeferralStatus.PENDING_REVIEW,
                DeferralStatus.RESCHEDULED
            ])
        ).first()
        
        if existing_approved:
            eligible = False
            reasons.append("已存在该学生对该考试的有效缓考申请")
        
        course_scores = db.query(Score).filter(
            Score.student_id == student_id,
            Score.exam_id == exam_id
        ).all()
        
        for score in course_scores:
            if score.score_status in [ScoreStatus.LOCKED, ScoreStatus.PUBLISHED]:
                eligible = False
                reasons.append("该考试成绩已锁定或已发布，无法申请缓考")
        
        if exam.status != ExamStatus.SCHEDULED:
            eligible = False
            reasons.append("考试已开始或已结束，无法申请缓考")
        
        if exam.is_makeup:
            warnings.append("这是补考，缓考后将无法再次缓考")
        
        student_past = db.query(DeferralApplication).filter(
            DeferralApplication.student_id == student_id,
            DeferralApplication.status == DeferralStatus.APPROVED
        ).count()
        
        if student_past >= 3:
            warnings.append("该学生本学期已申请过3次缓考，请重点审核")
        
        return EligibilityCheckResult(
            eligible=eligible,
            reasons=reasons,
            warnings=warnings,
            student_name=student.name,
            course_name=course.course_name if course else None
        )


class ExamRescheduleService:
    @staticmethod
    def reschedule_exams(
        db: Session,
        application_ids: List[int],
        exam_date: date,
        start_time: str,
        end_time: str,
        classroom: Optional[str] = None,
        batch_key: Optional[str] = None
    ) -> Dict[str, Any]:
        applications = db.query(DeferralApplication).filter(
            DeferralApplication.id.in_(application_ids),
            DeferralApplication.status == DeferralStatus.APPROVED
        ).all()
        
        if len(applications) != len(application_ids):
            raise ValueError("部分申请不存在或状态不是已通过")
        
        if not applications:
            raise ValueError("没有需要排考场的申请")
        
        course_id = applications[0].exam.course_id
        for app in applications:
            if app.exam.course_id != course_id:
                raise ValueError("所有申请必须属于同一门课程")
        
        existing_makeup = db.query(Exam).filter(
            Exam.is_makeup == True,
            Exam.related_original_exam_id == applications[0].exam_id,
            Exam.exam_date == exam_date,
            Exam.start_time == start_time
        ).first()
        
        if existing_makeup:
            makeup_exam = existing_makeup
        else:
            makeup_exam = Exam(
                course_id=course_id,
                exam_type="makeup",
                exam_date=exam_date,
                start_time=start_time,
                end_time=end_time,
                classroom=classroom,
                is_makeup=True,
                related_original_exam_id=applications[0].exam_id,
                status=ExamStatus.SCHEDULED
            )
            db.add(makeup_exam)
            db.flush()
            
            AuditService.create_log(
                db=db,
                resource_type="Exam",
                resource_id=makeup_exam.id,
                action=AuditAction.MAKEUP_CREATE,
                old_value=None,
                new_value={
                    "exam_date": str(exam_date),
                    "classroom": classroom,
                    "applications_count": len(applications)
                },
                comment="创建补考考场"
            )
        
        for app in applications:
            old_makeup_id = app.assigned_makeup_exam_id
            old_status = app.status.value
            
            app.assigned_makeup_exam_id = makeup_exam.id
            app.status = DeferralStatus.RESCHEDULED
            app.batch_key = batch_key
            
            ScoreService.ensure_score_exists(db, app.student_id, app.exam_id)
            
            old_score = db.query(Score).filter(
                Score.student_id == app.student_id,
                Score.exam_id == app.exam_id
            ).first()
            
            if old_score:
                old_score.score_status = ScoreStatus.ABSENT
                old_score.batch_key = batch_key
            
            AuditService.create_log(
                db=db,
                resource_type="DeferralApplication",
                resource_id=app.id,
                action=AuditAction.RESCHEDULE,
                old_value={
                    "assigned_makeup_exam_id": old_makeup_id,
                    "status": old_status
                },
                new_value={
                    "assigned_makeup_exam_id": makeup_exam.id,
                    "status": DeferralStatus.RESCHEDULED.value,
                    "batch_key": batch_key
                },
                comment=f"分配到补考考场 {makeup_exam.id}"
            )
        
        return {
            "makeup_exam_id": makeup_exam.id,
            "applications_updated": len(applications)
        }


class ScoreService:
    @staticmethod
    def ensure_score_exists(db: Session, student_id: int, exam_id: int) -> Score:
        score = db.query(Score).filter(
            Score.student_id == student_id,
            Score.exam_id == exam_id
        ).first()
        
        if not score:
            score = Score(
                student_id=student_id,
                exam_id=exam_id,
                score_status=ScoreStatus.EMPTY
            )
            db.add(score)
            db.flush()
        
        return score
    
    @staticmethod
    def batch_import_scores(
        db: Session,
        exam_id: int,
        scores_data: List[Dict],
        batch_key: Optional[str] = None
    ) -> List[Score]:
        exam = db.query(Exam).filter(Exam.id == exam_id).first()
        if not exam:
            raise ValueError("考试不存在")
        
        if exam.status in [ExamStatus.LOCKED, ExamStatus.PUBLISHED]:
            raise ValueError("考试已锁定或已发布，无法导入成绩")
        
        if batch_key:
            existing = db.query(Score).filter(
                Score.exam_id == exam_id,
                Score.batch_key == batch_key
            ).all()
            if existing:
                raise ValueError(f"批次号 {batch_key} 已使用，请使用新的批次号或确认是否重跑")
        
        results = []
        for data in scores_data:
            student_id = data["student_id"]
            score_value = data.get("score_value")
            
            score = ScoreService.ensure_score_exists(db, student_id, exam_id)
            
            if score.score_status == ScoreStatus.LOCKED:
                continue
            
            old_value = {
                "score_value": score.score_value,
                "status": score.score_status.value
            }
            
            score.score_value = score_value
            score.score_status = ScoreStatus.PENDING
            score.batch_key = batch_key
            db.flush()
            
            AuditService.create_log(
                db=db,
                resource_type="Score",
                resource_id=score.id,
                action=AuditAction.CORRECT if score.is_rescore else AuditAction.SUBMIT,
                old_value=old_value,
                new_value={
                    "score_value": score_value,
                    "status": ScoreStatus.PENDING.value,
                    "batch_key": batch_key
                },
                comment=f"批量导入成绩，批次号：{batch_key}"
            )
            results.append(score)
        
        return results
    
    @staticmethod
    def lock_scores_by_exam(
        db: Session,
        exam_id: int,
        operator_id: int
    ) -> int:
        exam = db.query(Exam).filter(Exam.id == exam_id).first()
        if not exam:
            raise ValueError("考试不存在")
        
        locked_count = 0
        scores = db.query(Score).filter(
            Score.exam_id == exam_id,
            Score.score_status.in_([ScoreStatus.PENDING, ScoreStatus.EMPTY])
        ).all()
        
        for score in scores:
            old_status = score.score_status.value
            score.score_status = ScoreStatus.LOCKED
            score.locked_by = operator_id
            score.locked_at = datetime.utcnow()
            locked_count += 1
            
            AuditService.create_log(
                db=db,
                resource_type="Score",
                resource_id=score.id,
                action=AuditAction.SCORE_LOCK,
                old_value={"status": old_status},
                new_value={"status": ScoreStatus.LOCKED.value},
                operator_id=operator_id,
                comment="锁定成绩"
            )
        
        exam.status = ExamStatus.LOCKED
        db.flush()
        
        return locked_count
    
    @staticmethod
    def unlock_score(
        db: Session,
        score_id: int,
        operator_id: int,
        reason: str
    ) -> Score:
        score = db.query(Score).filter(Score.id == score_id).first()
        if not score:
            raise ValueError("成绩不存在")
        
        if score.score_status == ScoreStatus.PUBLISHED:
            raise ValueError("已发布的成绩不能直接解锁，请走成绩更正流程")
        
        old_value = {
            "status": score.score_status.value,
            "locked_by": score.locked_by
        }
        
        score.score_status = ScoreStatus.PENDING
        
        AuditService.create_log(
            db=db,
            resource_type="Score",
            resource_id=score.id,
            action=AuditAction.SCORE_UNLOCK,
            old_value=old_value,
            new_value={"status": ScoreStatus.PENDING.value},
            operator_id=operator_id,
            comment=f"解锁成绩，原因：{reason}"
        )
        return score
    
    @staticmethod
    def rescore(
        db: Session,
        score_id: int,
        new_score: float,
        operator_id: int,
        reason: str
    ) -> Score:
        original = db.query(Score).filter(Score.id == score_id).first()
        if not original:
            raise ValueError("原始成绩不存在")
        
        new_score_record = Score(
            student_id=original.student_id,
            exam_id=original.exam_id,
            score_value=new_score,
            score_status=ScoreStatus.PENDING,
            is_rescore=True,
            original_score_id=original.id,
            recorded_by=operator_id
        )
        db.add(new_score_record)
        db.flush()
        
        original.score_status = ScoreStatus.RETAKED
        
        AuditService.create_log(
            db=db,
            resource_type="Score",
            resource_id=score_id,
            action=AuditAction.RESCORE,
            old_value={"score_value": original.score_value},
            new_value={"new_score_id": new_score_record.id, "score_value": new_score},
            operator_id=operator_id,
            comment=f"成绩更正：{reason}"
        )
        
        return new_score_record


class ReportService:
    @staticmethod
    def get_summary(db: Session) -> Dict[str, int]:
        return {
            "total_applications": db.query(DeferralApplication).count(),
            "pending_review": db.query(DeferralApplication).filter(
                DeferralApplication.status == DeferralStatus.PENDING_REVIEW
            ).count(),
            "approved": db.query(DeferralApplication).filter(
                DeferralApplication.status == DeferralStatus.APPROVED
            ).count(),
            "rejected": db.query(DeferralApplication).filter(
                DeferralApplication.status == DeferralStatus.REJECTED
            ).count(),
            "cancelled": db.query(DeferralApplication).filter(
                DeferralApplication.status == DeferralStatus.CANCELLED
            ).count(),
            "makeup_exams_created": db.query(Exam).filter(
                Exam.is_makeup == True
            ).count(),
            "students_with_makeup": db.query(DeferralApplication).filter(
                DeferralApplication.status == DeferralStatus.RESCHEDULED
            ).distinct(DeferralApplication.student_id).count(),
            "scores_locked": db.query(Score).filter(
                Score.score_status == ScoreStatus.LOCKED
            ).count(),
            "scores_published": db.query(Score).filter(
                Score.score_status == ScoreStatus.PUBLISHED
            ).count()
        }
    
    @staticmethod
    def get_daily_report(db: Session, target_date: date) -> Dict[str, Any]:
        from sqlalchemy import func
        
        start_dt = datetime.combine(target_date, datetime.min.time())
        end_dt = datetime.combine(target_date, datetime.max.time())
        
        new_applications = db.query(DeferralApplication).filter(
            DeferralApplication.created_at >= start_dt,
            DeferralApplication.created_at <= end_dt
        ).count()
        
        reviewed = db.query(AuditLog).filter(
            AuditLog.action.in_([AuditAction.APPROVE, AuditAction.REJECT]),
            AuditLog.created_at >= start_dt,
            AuditLog.created_at <= end_dt
        ).count()
        
        approved = db.query(AuditLog).filter(
            AuditLog.action == AuditAction.APPROVE,
            AuditLog.created_at >= start_dt,
            AuditLog.created_at <= end_dt
        ).count()
        
        rejected = db.query(AuditLog).filter(
            AuditLog.action == AuditAction.REJECT,
            AuditLog.created_at >= start_dt,
            AuditLog.created_at <= end_dt
        ).count()
        
        makeup_scheduled = db.query(Exam).filter(
            Exam.is_makeup == True,
            Exam.created_at >= start_dt,
            Exam.created_at <= end_dt
        ).count()
        
        return {
            "date": target_date,
            "new_applications": new_applications,
            "reviewed_applications": reviewed,
            "approved_today": approved,
            "rejected_today": rejected,
            "makeup_exams_scheduled": makeup_scheduled
        }
