from datetime import datetime, timedelta
from typing import List, Optional, Tuple, Dict
from sqlalchemy.orm import Session
from ..models import (
    BorrowApplication, TimeoutRecord, TaskExecutionLog,
    ApplicationStatus, TimeoutLevel, StatusCorrectionType
)
from ..config import settings
from .status_service import StatusService


class TimeoutService:
    @staticmethod
    def _calculate_timeout_level(overdue_hours: float) -> Optional[TimeoutLevel]:
        if overdue_hours <= 0:
            return None
        
        if overdue_hours >= settings.TIMEOUT_LEVEL4_HOURS:
            return TimeoutLevel.LEVEL4
        elif overdue_hours >= settings.TIMEOUT_LEVEL3_HOURS:
            return TimeoutLevel.LEVEL3
        elif overdue_hours >= settings.TIMEOUT_LEVEL2_HOURS:
            return TimeoutLevel.LEVEL2
        elif overdue_hours >= settings.TIMEOUT_LEVEL1_HOURS:
            return TimeoutLevel.LEVEL1
        return None

    @staticmethod
    def _get_escalation_target(level: TimeoutLevel, application: BorrowApplication) -> str:
        targets = {
            TimeoutLevel.LEVEL1: application.applicant_name,
            TimeoutLevel.LEVEL2: f"{application.applicant_name}（直属领导）",
            TimeoutLevel.LEVEL3: f"{application.applicant_name}（部门负责人）",
            TimeoutLevel.LEVEL4: f"{application.applicant_name}（总经理）"
        }
        return targets.get(level, application.applicant_name)

    @staticmethod
    def _get_escalation_message(level: TimeoutLevel, application: BorrowApplication, overdue_hours: float) -> str:
        messages = {
            TimeoutLevel.LEVEL1: f"【提醒】申请单号{application.application_no}已超时{int(overdue_hours)}小时，请尽快归还印章并上传使用材料",
            TimeoutLevel.LEVEL2: f"【预警】申请单号{application.application_no}已超时{int(overdue_hours)}小时，超时等级升级至二级，请立即跟进处理",
            TimeoutLevel.LEVEL3: f"【警告】申请单号{application.application_no}已超时{int(overdue_hours)}小时，超时等级升级至三级，请部门负责人介入",
            TimeoutLevel.LEVEL4: f"【紧急】申请单号{application.application_no}已超时{int(overdue_hours)}小时，超时等级升级至最高级，请总经理关注"
        }
        return messages.get(level, "")

    @staticmethod
    def _should_escalate(current_level: Optional[TimeoutLevel], new_level: Optional[TimeoutLevel]) -> bool:
        if current_level == new_level:
            return False
        if current_level is None and new_level is not None:
            return True
        if current_level is not None and new_level is None:
            return False
        
        level_order = {
            TimeoutLevel.LEVEL1: 1,
            TimeoutLevel.LEVEL2: 2,
            TimeoutLevel.LEVEL3: 3,
            TimeoutLevel.LEVEL4: 4
        }
        return level_order.get(new_level, 0) > level_order.get(current_level, 0)

    @staticmethod
    def check_timeout_applications(
        db: Session,
        execution_time: Optional[datetime] = None
    ) -> Dict:
        execution_time = execution_time or datetime.now()
        
        log = TaskExecutionLog(
            task_name="check_timeout_applications",
            execution_time=execution_time,
            status="running"
        )
        db.add(log)
        db.flush()
        
        try:
            applications = db.query(BorrowApplication).filter(
                BorrowApplication.status.in_([ApplicationStatus.LENDED, ApplicationStatus.TIMEOUT])
            ).all()
            
            processed_count = 0
            failed_count = 0
            escalated_count = 0
            level1_count = 0
            level2_count = 0
            level3_count = 0
            level4_count = 0
            
            for app in applications:
                try:
                    overdue_seconds = (execution_time - app.planned_return_date).total_seconds()
                    overdue_hours = overdue_seconds / 3600
                    
                    new_level = TimeoutService._calculate_timeout_level(overdue_hours)
                    
                    should_escalate = TimeoutService._should_escalate(
                        app.current_timeout_level, new_level
                    )
                    
                    if new_level is not None and (should_escalate or app.status == ApplicationStatus.LENDED):
                        escalated_to = TimeoutService._get_escalation_target(new_level, app)
                        escalation_message = TimeoutService._get_escalation_message(new_level, app, overdue_hours)
                        
                        timeout_record = TimeoutRecord(
                            application_id=app.id,
                            timeout_level=new_level,
                            detected_at=execution_time,
                            overdue_hours=overdue_hours,
                            escalated_to=escalated_to,
                            escalation_message=escalation_message,
                            is_handled=False
                        )
                        db.add(timeout_record)
                        
                        level_counter = {
                            TimeoutLevel.LEVEL1: lambda: globals().update({'level1_count': level1_count + 1}),
                            TimeoutLevel.LEVEL2: lambda: globals().update({'level2_count': level2_count + 1}),
                            TimeoutLevel.LEVEL3: lambda: globals().update({'level3_count': level3_count + 1}),
                            TimeoutLevel.LEVEL4: lambda: globals().update({'level4_count': level4_count + 1})
                        }
                        if new_level == TimeoutLevel.LEVEL1:
                            level1_count += 1
                        elif new_level == TimeoutLevel.LEVEL2:
                            level2_count += 1
                        elif new_level == TimeoutLevel.LEVEL3:
                            level3_count += 1
                        elif new_level == TimeoutLevel.LEVEL4:
                            level4_count += 1
                        
                        new_status = ApplicationStatus.TIMEOUT
                        
                        previous_values = {
                            "status": app.status.value if app.status else None,
                            "timeout_level": app.current_timeout_level.value if app.current_timeout_level else None
                        }
                        
                        new_values = {
                            "status": new_status.value,
                            "timeout_level": new_level.value if new_level else None
                        }
                        
                        affected_fields = []
                        if app.status != new_status:
                            affected_fields.append("status")
                        if app.current_timeout_level != new_level:
                            affected_fields.append("current_timeout_level")
                        
                        StatusService.record_status_change(
                            db=db,
                            application=app,
                            new_status=new_status,
                            new_timeout_level=new_level,
                            operator="system",
                            reason=escalation_message,
                            correction_type=StatusCorrectionType.SYSTEM_AUTO,
                            affected_fields=affected_fields,
                            previous_values=previous_values,
                            new_values=new_values
                        )
                        
                        escalated_count += 1
                    
                    processed_count += 1
                    
                except Exception as e:
                    failed_count += 1
                    continue
            
            db.commit()
            
            log.status = "success"
            log.processed_count = processed_count
            log.failed_count = failed_count
            log.execution_details = {
                "escalated_count": escalated_count,
                "level1_count": level1_count,
                "level2_count": level2_count,
                "level3_count": level3_count,
                "level4_count": level4_count,
                "execution_time": execution_time.isoformat()
            }
            db.commit()
            
            return {
                "success": True,
                "message": f"超时检测完成：扫描{processed_count}笔外借申请，升级告警{escalated_count}笔",
                "data": {
                    "processed_count": processed_count,
                    "failed_count": failed_count,
                    "escalated_count": escalated_count,
                    "level1_count": level1_count,
                    "level2_count": level2_count,
                    "level3_count": level3_count,
                    "level4_count": level4_count
                }
            }
            
        except Exception as e:
            log.status = "failed"
            log.error_message = str(e)
            db.commit()
            
            raise e

    @staticmethod
    def get_pending_timeout_alerts(
        db: Session,
        level: Optional[TimeoutLevel] = None
    ) -> List[TimeoutRecord]:
        query = db.query(TimeoutRecord).filter(TimeoutRecord.is_handled == False)
        
        if level:
            query = query.filter(TimeoutRecord.timeout_level == level)
        
        return query.order_by(TimeoutRecord.detected_at.desc()).all()

    @staticmethod
    def handle_timeout_alert(
        db: Session,
        timeout_record_id: int,
        handled_by: str,
        handling_result: str
    ) -> Tuple[bool, str]:
        record = db.query(TimeoutRecord).filter(TimeoutRecord.id == timeout_record_id).first()
        
        if not record:
            return False, "超时告警记录不存在"
        
        if record.is_handled:
            return False, "该告警已处理"
        
        record.is_handled = True
        record.handled_by = handled_by
        record.handled_at = datetime.now()
        record.handling_result = handling_result
        
        db.commit()
        
        return True, f"超时告警已标记为已处理，处理人：{handled_by}"

    @staticmethod
    def get_task_execution_history(
        db: Session,
        task_name: Optional[str] = None,
        limit: int = 50
    ) -> List[TaskExecutionLog]:
        query = db.query(TaskExecutionLog)
        
        if task_name:
            query = query.filter(TaskExecutionLog.task_name == task_name)
        
        return query.order_by(TaskExecutionLog.execution_time.desc()).limit(limit).all()

    @staticmethod
    def retry_failed_task(
        db: Session,
        log_id: int
    ) -> Dict:
        log = db.query(TaskExecutionLog).filter(TaskExecutionLog.id == log_id).first()
        
        if not log:
            return {"success": False, "message": "任务执行记录不存在"}
        
        if log.status != "failed":
            return {"success": False, "message": "该任务未失败，无需重试"}
        
        if log.retry_attempt >= settings.MAX_RETRY_COUNT:
            return {
                "success": False,
                "message": f"已达到最大重试次数({settings.MAX_RETRY_COUNT})，请手动检查"
            }
        
        if log.task_name == "check_timeout_applications":
            return TimeoutService.check_timeout_applications(db)
        
        return {"success": False, "message": "未知任务类型"}
