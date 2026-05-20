from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional, Dict, Set
from app.models import ResetRequest, LabSpace, BaseSnapshot, RetainedFile, RecoveryLog, StudentChange
from app.models.reset_request import ResetStatus
from app.models.recovery_log import LogLevel
from app.schemas import ResetRequestCreate, ResetStatusUpdate


class ResetService:
    VALID_TRANSITIONS: Dict[ResetStatus, Set[ResetStatus]] = {
        ResetStatus.PENDING: {ResetStatus.APPROVED, ResetStatus.CANCELLED, ResetStatus.BLOCKED},
        ResetStatus.APPROVED: {ResetStatus.PROCESSING, ResetStatus.CANCELLED, ResetStatus.BLOCKED},
        ResetStatus.PROCESSING: {ResetStatus.SUCCESS, ResetStatus.FAILED},
        ResetStatus.SUCCESS: set(),
        ResetStatus.FAILED: {ResetStatus.PENDING},
        ResetStatus.BLOCKED: {ResetStatus.PENDING, ResetStatus.CANCELLED},
        ResetStatus.CANCELLED: {ResetStatus.PENDING},
    }

    PERMISSION_REQUIRED = {
        "create": ["student", "assistant", "teacher", "admin"],
        "approve": ["assistant", "teacher", "admin"],
        "process": ["assistant", "teacher", "admin"],
        "block": ["teacher", "admin"],
        "cancel": ["assistant", "teacher", "admin"],
    }

    def __init__(self, db: Session):
        self.db = db

    def check_duplicate_reset(self, lab_space_id: int) -> bool:
        active_statuses = [ResetStatus.PENDING, ResetStatus.APPROVED, ResetStatus.PROCESSING]
        existing = self.db.query(ResetRequest).filter(
            ResetRequest.lab_space_id == lab_space_id,
            ResetRequest.status.in_(active_statuses)
        ).first()
        return existing is not None

    def check_permission(self, user_role: str, action: str) -> bool:
        required_roles = self.PERMISSION_REQUIRED.get(action, [])
        return user_role in required_roles

    def can_transition(self, from_status: ResetStatus, to_status: ResetStatus) -> bool:
        return to_status in self.VALID_TRANSITIONS.get(from_status, set())

    def get_available_transitions(self, current_status: ResetStatus) -> List[ResetStatus]:
        return list(self.VALID_TRANSITIONS.get(current_status, set()))

    def create_reset_request(self, request: ResetRequestCreate, user_role: str = "student") -> ResetRequest:
        if not self.check_permission(user_role, "create"):
            raise PermissionError(f"角色 {user_role} 无权限创建重置申请")

        if self.check_duplicate_reset(request.lab_space_id):
            raise ValueError("该实验空间已有进行中的重置申请")

        db_request = ResetRequest(**request.model_dump())
        self.db.add(db_request)
        self.db.flush()

        self._add_log(db_request.id, LogLevel.INFO, "重置申请已创建", 
                     f"申请人: {request.requested_by_name}, 原因: {request.reason}, 角色: {user_role}")

        lab_space = self.db.query(LabSpace).filter(LabSpace.id == request.lab_space_id).first()
        if lab_space:
            self._identify_submissions(db_request.id, lab_space.id)

        self.db.commit()
        self.db.refresh(db_request)
        return db_request

    def _identify_submissions(self, reset_request_id: int, lab_space_id: int):
        changes = self.db.query(StudentChange).filter(
            StudentChange.lab_space_id == lab_space_id,
            StudentChange.is_submission == True
        ).all()

        for change in changes:
            retained = RetainedFile(
                reset_request_id=reset_request_id,
                file_path=change.file_path,
                reason="学员提交文件",
                is_submission=True,
                retained_path=f"/retained/{reset_request_id}/{change.file_path}"
            )
            self.db.add(retained)

    def update_status(self, request_id: int, status_update: ResetStatusUpdate, user_role: str = "assistant") -> ResetRequest:
        request = self.db.query(ResetRequest).filter(ResetRequest.id == request_id).first()
        if not request:
            raise ValueError("重置申请不存在")

        target_status = status_update.status
        old_status = request.status

        if not self.can_transition(old_status, target_status):
            raise ValueError(f"无法从 {old_status.value} 状态流转到 {target_status.value}")

        action = self._get_action_for_status(target_status)
        if not self.check_permission(user_role, action):
            raise PermissionError(f"角色 {user_role} 无权限执行 {action} 操作")

        request.status = target_status
        request.status_reason = status_update.status_reason

        if target_status == ResetStatus.APPROVED:
            request.approved_by = status_update.approved_by
            request.approved_at = datetime.utcnow()
            self._add_log(request_id, LogLevel.INFO, "申请已批准", 
                         f"批准人: {status_update.approved_by}, 角色: {user_role}, 备注: {status_update.status_reason}")

        elif target_status == ResetStatus.PROCESSING:
            request.started_at = datetime.utcnow()
            self._add_log(request_id, LogLevel.INFO, "开始执行重置", f"操作人角色: {user_role}")

        elif target_status == ResetStatus.SUCCESS:
            request.completed_at = datetime.utcnow()
            self._add_log(request_id, LogLevel.INFO, "重置成功", f"操作人角色: {user_role}")

        elif target_status == ResetStatus.FAILED:
            request.completed_at = datetime.utcnow()
            self._add_log(request_id, LogLevel.ERROR, "重置失败", status_update.status_reason or "未知错误")

        elif target_status == ResetStatus.BLOCKED:
            self._add_log(request_id, LogLevel.WARNING, "重置被拦截", 
                         f"操作人角色: {user_role}, 原因: {status_update.status_reason or '安全拦截'}")

        elif target_status == ResetStatus.CANCELLED:
            self._add_log(request_id, LogLevel.INFO, "申请已取消", 
                         f"操作人角色: {user_role}, 原因: {status_update.status_reason or '用户取消'}")

        self.db.commit()
        self.db.refresh(request)
        return request

    def _get_action_for_status(self, status: ResetStatus) -> str:
        action_map = {
            ResetStatus.APPROVED: "approve",
            ResetStatus.PROCESSING: "process",
            ResetStatus.BLOCKED: "block",
            ResetStatus.CANCELLED: "cancel",
        }
        return action_map.get(status, "process")

    def _add_log(self, reset_request_id: int, level: LogLevel, message: str, details: str = None):
        log = RecoveryLog(
            reset_request_id=reset_request_id,
            level=level,
            message=message,
            details=details
        )
        self.db.add(log)

    def get_request(self, request_id: int) -> Optional[ResetRequest]:
        return self.db.query(ResetRequest).filter(ResetRequest.id == request_id).first()

    def get_all_requests(self, status: Optional[ResetStatus] = None) -> List[ResetRequest]:
        query = self.db.query(ResetRequest)
        if status:
            query = query.filter(ResetRequest.status == status)
        return query.order_by(ResetRequest.created_at.desc()).all()

    def get_request_logs(self, request_id: int) -> List[RecoveryLog]:
        return self.db.query(RecoveryLog).filter(
            RecoveryLog.reset_request_id == request_id
        ).order_by(RecoveryLog.created_at.asc()).all()

    def get_retained_files(self, request_id: int) -> List[RetainedFile]:
        return self.db.query(RetainedFile).filter(
            RetainedFile.reset_request_id == request_id
        ).all()

    def export_report(self, request_id: int) -> dict:
        request = self.get_request(request_id)
        if not request:
            raise ValueError("重置申请不存在")

        lab_space = self.db.query(LabSpace).filter(LabSpace.id == request.lab_space_id).first()
        snapshot = self.db.query(BaseSnapshot).filter(BaseSnapshot.id == request.snapshot_id).first()
        logs = self.get_request_logs(request_id)
        retained_files = self.get_retained_files(request_id)

        status_explanation = self._get_status_explanation(request.status, request.status_reason)

        report = {
            "request_id": request.id,
            "lab_space": {
                "id": lab_space.id if lab_space else None,
                "name": lab_space.name if lab_space else None,
                "student_id": lab_space.student_id if lab_space else None,
                "student_name": lab_space.student_name if lab_space else None,
            },
            "snapshot": {
                "id": snapshot.id if snapshot else None,
                "name": snapshot.name if snapshot else None,
            },
            "request_info": {
                "requested_by": request.requested_by,
                "requested_by_name": request.requested_by_name,
                "reason": request.reason,
                "created_at": request.created_at.isoformat(),
            },
            "status": {
                "current": request.status.value,
                "explanation": status_explanation,
                "reason": request.status_reason,
                "approved_by": request.approved_by,
                "approved_at": request.approved_at.isoformat() if request.approved_at else None,
                "started_at": request.started_at.isoformat() if request.started_at else None,
                "completed_at": request.completed_at.isoformat() if request.completed_at else None,
            },
            "timeline": [
                {
                    "time": log.created_at.isoformat(),
                    "level": log.level.value,
                    "message": log.message,
                    "details": log.details
                } for log in logs
            ],
            "retained_files": [
                {
                    "file_path": f.file_path,
                    "reason": f.reason,
                    "is_submission": f.is_submission
                } for f in retained_files
            ],
            "status_history": self._build_status_history(logs)
        }
        return report

    def _get_status_explanation(self, status: ResetStatus, reason: str = None) -> str:
        explanations = {
            ResetStatus.PENDING: "申请已创建，等待助教审批",
            ResetStatus.APPROVED: "申请已获批准，等待执行",
            ResetStatus.PROCESSING: "正在执行重置操作，恢复快照并保留提交文件",
            ResetStatus.SUCCESS: "重置成功完成，实验环境已恢复到指定快照，学员提交文件已被安全保留",
            ResetStatus.FAILED: f"重置失败: {reason or '执行过程中发生错误'}",
            ResetStatus.BLOCKED: f"重置被拦截: {reason or '安全规则触发拦截'}",
            ResetStatus.CANCELLED: f"申请已取消: {reason or '用户主动取消'}"
        }
        return explanations.get(status, "未知状态")

    def _build_status_history(self, logs: List[RecoveryLog]) -> List[dict]:
        history = []
        for log in logs:
            if any(keyword in log.message for keyword in ["创建", "批准", "执行", "成功", "失败", "拦截", "取消"]):
                history.append({
                    "time": log.created_at.isoformat(),
                    "event": log.message,
                    "details": log.details
                })
        return history

    def create_sample_data(self):
        lab_spaces = [
            LabSpace(name="Python实验环境-001", student_id="S2024001", 
                     student_name="张三", course_id="CS101", path="/labs/python/001"),
            LabSpace(name="Python实验环境-002", student_id="S2024002", 
                     student_name="李四", course_id="CS101", path="/labs/python/002"),
            LabSpace(name="Java实验环境-001", student_id="S2024003", 
                     student_name="王五", course_id="CS201", path="/labs/java/001"),
        ]
        for ls in lab_spaces:
            self.db.add(ls)
        self.db.flush()

        snapshots = [
            BaseSnapshot(lab_space_id=lab_spaces[0].id, name="基础环境v1.0", 
                        description="课程初始环境", path="/snapshots/python/base-v1", is_base=True),
            BaseSnapshot(lab_space_id=lab_spaces[1].id, name="基础环境v1.0", 
                        description="课程初始环境", path="/snapshots/python/base-v1", is_base=True),
            BaseSnapshot(lab_space_id=lab_spaces[2].id, name="Java基础环境", 
                        description="Java课程初始环境", path="/snapshots/java/base", is_base=True),
        ]
        for s in snapshots:
            self.db.add(s)
        self.db.flush()

        changes = [
            StudentChange(lab_space_id=lab_spaces[0].id, file_path="assignment1.py", 
                         change_type="modify", is_submission=True, description="第一次作业提交"),
            StudentChange(lab_space_id=lab_spaces[0].id, file_path="notes.txt", 
                         change_type="add", is_submission=False, description="学员笔记"),
            StudentChange(lab_space_id=lab_spaces[1].id, file_path="final_project.py", 
                         change_type="add", is_submission=True, description="期末项目提交"),
        ]
        for c in changes:
            self.db.add(c)
        self.db.flush()

        request1 = ResetRequest(
            lab_space_id=lab_spaces[0].id,
            snapshot_id=snapshots[0].id,
            requested_by="TA001",
            requested_by_name="李助教",
            reason="学员误删系统文件，需要恢复基础环境",
            status=ResetStatus.SUCCESS,
            status_reason="重置完成",
            approved_by="Teacher001",
            approved_at=datetime.utcnow(),
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow()
        )
        self.db.add(request1)
        self.db.flush()

        retained1 = RetainedFile(
            reset_request_id=request1.id,
            file_path="assignment1.py",
            reason="学员提交文件-第一次作业",
            is_submission=True,
            retained_path=f"/retained/{request1.id}/assignment1.py"
        )
        self.db.add(retained1)

        request2 = ResetRequest(
            lab_space_id=lab_spaces[1].id,
            snapshot_id=snapshots[1].id,
            requested_by="TA002",
            requested_by_name="王助教",
            reason="环境配置混乱",
            status=ResetStatus.BLOCKED,
            status_reason="检测到该空间2小时内已重置过，为防止误操作被拦截",
            approved_by="Teacher001",
            approved_at=datetime.utcnow()
        )
        self.db.add(request2)
        self.db.flush()

        request3 = ResetRequest(
            lab_space_id=lab_spaces[2].id,
            snapshot_id=snapshots[2].id,
            requested_by="TA001",
            requested_by_name="李助教",
            reason="编译环境损坏",
            status=ResetStatus.PENDING
        )
        self.db.add(request3)
        self.db.flush()

        for req in [request1, request2, request3]:
            self._add_log(req.id, LogLevel.INFO, "重置申请已创建", 
                         f"申请人: {req.requested_by_name}, 原因: {req.reason}")
            if req.status != ResetStatus.PENDING:
                self._add_log(req.id, LogLevel.INFO, "申请已批准", f"批准人: {req.approved_by}")
            if req.status == ResetStatus.PROCESSING or req.status == ResetStatus.SUCCESS:
                self._add_log(req.id, LogLevel.INFO, "开始执行重置", "正在恢复快照并保留提交文件")
            if req.status == ResetStatus.SUCCESS:
                self._add_log(req.id, LogLevel.INFO, "重置成功", "实验环境已恢复，提交文件已保留")
            elif req.status == ResetStatus.BLOCKED:
                self._add_log(req.id, LogLevel.WARNING, "重置被拦截", req.status_reason)

        self.db.commit()