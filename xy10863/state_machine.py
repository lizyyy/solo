from datetime import datetime
from typing import Tuple
from sqlalchemy.orm import Session
from database import RestoreRecord, ChangeLog, ExecutionStep, Approval, VerificationResult


class RestoreState:
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    DRILL_STARTED = "drill_started"
    DRILL_COMPLETED = "drill_completed"
    DRILL_FAILED = "drill_failed"
    EXECUTION_STARTED = "execution_started"
    EXECUTION_IN_PROGRESS = "execution_in_progress"
    EXECUTION_FAILED = "execution_failed"
    VERIFICATION_PENDING = "verification_pending"
    VERIFICATION_IN_PROGRESS = "verification_in_progress"
    VERIFICATION_FAILED = "verification_failed"
    COMPLETED = "completed"
    ROLLBACK_PENDING = "rollback_pending"
    ROLLBACK_IN_PROGRESS = "rollback_in_progress"
    ROLLED_BACK = "rolled_back"
    CANCELLED = "cancelled"


STATUS_TRANSITIONS = {
    RestoreState.PENDING_APPROVAL: [RestoreState.APPROVED, RestoreState.REJECTED, RestoreState.CANCELLED],
    RestoreState.APPROVED: [RestoreState.DRILL_STARTED, RestoreState.EXECUTION_STARTED, RestoreState.CANCELLED],
    RestoreState.DRILL_STARTED: [RestoreState.DRILL_COMPLETED, RestoreState.DRILL_FAILED],
    RestoreState.DRILL_COMPLETED: [RestoreState.EXECUTION_STARTED, RestoreState.CANCELLED],
    RestoreState.DRILL_FAILED: [RestoreState.DRILL_STARTED, RestoreState.CANCELLED],
    RestoreState.EXECUTION_STARTED: [RestoreState.EXECUTION_IN_PROGRESS],
    RestoreState.EXECUTION_IN_PROGRESS: [RestoreState.EXECUTION_IN_PROGRESS, RestoreState.EXECUTION_FAILED, RestoreState.VERIFICATION_PENDING],
    RestoreState.EXECUTION_FAILED: [RestoreState.ROLLBACK_IN_PROGRESS, RestoreState.EXECUTION_STARTED],
    RestoreState.VERIFICATION_PENDING: [RestoreState.VERIFICATION_IN_PROGRESS],
    RestoreState.VERIFICATION_IN_PROGRESS: [RestoreState.VERIFICATION_FAILED, RestoreState.COMPLETED],
    RestoreState.VERIFICATION_FAILED: [RestoreState.ROLLBACK_IN_PROGRESS, RestoreState.VERIFICATION_IN_PROGRESS],
    RestoreState.COMPLETED: [RestoreState.ROLLBACK_IN_PROGRESS],
    RestoreState.ROLLBACK_IN_PROGRESS: [RestoreState.ROLLED_BACK, RestoreState.EXECUTION_FAILED],
    RestoreState.ROLLED_BACK: [RestoreState.EXECUTION_STARTED, RestoreState.CANCELLED],
    RestoreState.REJECTED: [],
    RestoreState.CANCELLED: [],
}


STATUS_DISPLAY = {
    RestoreState.PENDING_APPROVAL: {"label": "待审批", "color": "warning"},
    RestoreState.APPROVED: {"label": "已批准", "color": "info"},
    RestoreState.REJECTED: {"label": "已拒绝", "color": "danger"},
    RestoreState.DRILL_STARTED: {"label": "演练中", "color": "primary"},
    RestoreState.DRILL_COMPLETED: {"label": "演练完成", "color": "success"},
    RestoreState.DRILL_FAILED: {"label": "演练失败", "color": "danger"},
    RestoreState.EXECUTION_STARTED: {"label": "执行开始", "color": "primary"},
    RestoreState.EXECUTION_IN_PROGRESS: {"label": "执行中", "color": "primary"},
    RestoreState.EXECUTION_FAILED: {"label": "执行失败", "color": "danger"},
    RestoreState.VERIFICATION_PENDING: {"label": "待验证", "color": "warning"},
    RestoreState.VERIFICATION_IN_PROGRESS: {"label": "验证中", "color": "primary"},
    RestoreState.VERIFICATION_FAILED: {"label": "验证失败", "color": "danger"},
    RestoreState.COMPLETED: {"label": "已完成", "color": "success"},
    RestoreState.ROLLBACK_PENDING: {"label": "待回滚", "color": "warning"},
    RestoreState.ROLLBACK_IN_PROGRESS: {"label": "回滚中", "color": "primary"},
    RestoreState.ROLLED_BACK: {"label": "已回滚", "color": "info"},
    RestoreState.CANCELLED: {"label": "已取消", "color": "secondary"},
}


def can_transition(current_status: str, new_status: str) -> bool:
    allowed_statuses = STATUS_TRANSITIONS.get(current_status, [])
    return new_status in allowed_statuses


def validate_transition(db: Session, record_id: int, new_status: str, operator: str) -> Tuple[bool, str]:
    record = db.query(RestoreRecord).filter(RestoreRecord.id == record_id).first()
    if not record:
        return False, "记录不存在"
    
    if not can_transition(record.status, new_status):
        return False, f"不允许从 {record.status} 转换到 {new_status}"
    
    if new_status in [RestoreState.APPROVED, RestoreState.REJECTED]:
        approval = db.query(Approval).filter(
            Approval.record_id == record_id,
            Approval.approval_type == "main",
            Approval.approver == operator
        ).first()
        if not approval:
            return False, "需要先创建审批记录"
    
    return True, "验证通过"


def transition_status(db: Session, record_id: int, new_status: str, operator: str, comment: str = None) -> Tuple[bool, str, RestoreRecord]:
    is_valid, message = validate_transition(db, record_id, new_status, operator)
    if not is_valid:
        return False, message, None
    
    record = db.query(RestoreRecord).filter(RestoreRecord.id == record_id).first()
    old_status = record.status
    
    change_log = ChangeLog(
        record_id=record_id,
        action="status_change",
        previous_status=old_status,
        new_status=new_status,
        changed_by=operator,
        comment=comment
    )
    db.add(change_log)
    
    record.status = new_status
    record.updated_at = datetime.utcnow()
    
    if new_status == RestoreState.COMPLETED:
        record.completed_at = datetime.utcnow()
        record.rollback_available = True
    
    db.commit()
    db.refresh(record)
    
    return True, "状态转换成功", record


def initialize_execution_steps(db: Session, record_id: int, is_drill: bool = False):
    steps = [
        {"step_number": 1, "step_name": "环境检查", "description": "检查目标环境可用性和资源配置"},
        {"step_number": 2, "step_name": "备份验证", "description": "验证备份文件完整性和可用性"},
        {"step_number": 3, "step_name": "数据准备", "description": "准备恢复所需的临时资源"},
        {"step_number": 4, "step_name": "执行恢复", "description": "执行数据库恢复操作"},
        {"step_number": 5, "step_name": "数据校验", "description": "校验恢复后的数据一致性"},
    ]
    
    if is_drill:
        for step in steps:
            step["step_name"] = f"[演练] {step['step_name']}"
    
    for step_data in steps:
        step = ExecutionStep(
            record_id=record_id,
            **step_data
        )
        db.add(step)
    
    db.commit()


def initialize_verification_items(db: Session, record_id: int):
    verifications = [
        {"verification_type": "data_count", "description": "数据行数校验", "expected_value": "与备份点一致"},
        {"verification_type": "data_integrity", "description": "关键数据完整性校验", "expected_value": "全部通过"},
        {"verification_type": "schema_check", "description": "数据库结构校验", "expected_value": "结构一致"},
        {"verification_type": "application_connect", "description": "应用连接测试", "expected_value": "连接成功"},
    ]
    
    for v_data in verifications:
        verification = VerificationResult(
            record_id=record_id,
            **v_data
        )
        db.add(verification)
    
    db.commit()


def get_available_actions(status: str) -> list:
    actions = []
    transitions = STATUS_TRANSITIONS.get(status, [])
    
    if RestoreState.APPROVED in transitions:
        actions.append({"action": "approve", "label": "批准", "style": "success"})
    if RestoreState.REJECTED in transitions:
        actions.append({"action": "reject", "label": "拒绝", "style": "danger"})
    if RestoreState.DRILL_STARTED in transitions:
        actions.append({"action": "start_drill", "label": "开始演练", "style": "primary"})
    if RestoreState.DRILL_COMPLETED in transitions:
        actions.append({"action": "complete_drill", "label": "完成演练", "style": "success"})
    if RestoreState.EXECUTION_STARTED in transitions:
        actions.append({"action": "start_execution", "label": "开始执行", "style": "primary"})
    if RestoreState.VERIFICATION_PENDING in transitions:
        actions.append({"action": "finish_execution", "label": "完成执行", "style": "success"})
    if RestoreState.VERIFICATION_IN_PROGRESS in transitions:
        actions.append({"action": "start_verification", "label": "开始验证", "style": "primary"})
    if RestoreState.COMPLETED in transitions:
        actions.append({"action": "complete_verification", "label": "完成验证", "style": "success"})
    if RestoreState.ROLLBACK_IN_PROGRESS in transitions:
        actions.append({"action": "start_rollback", "label": "开始回滚", "style": "warning"})
    if RestoreState.ROLLED_BACK in transitions:
        actions.append({"action": "complete_rollback", "label": "完成回滚", "style": "info"})
    if RestoreState.CANCELLED in transitions:
        actions.append({"action": "cancel", "label": "取消", "style": "secondary"})
    if RestoreState.EXECUTION_STARTED in transitions and status not in [RestoreState.APPROVED, RestoreState.DRILL_COMPLETED]:
        actions.append({"action": "retry_execution", "label": "重试执行", "style": "primary"})
    
    return actions
