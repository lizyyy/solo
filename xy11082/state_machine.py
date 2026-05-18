from typing import Dict, List, Optional, Tuple
from datetime import datetime
from schemas import QueueStatus, UserRole
from models import QueueEntry, StatusHistory, SamePotGroup, User, Prescription as models_Prescription


class StateTransitionError(Exception):
    def __init__(self, rule_id: str, message: str):
        self.rule_id = rule_id
        self.message = message
        super().__init__(f"[{rule_id}] {message}")


class StateMachine:
    TRANSITION_MAP: Dict[str, Dict[str, List[str]]] = {
        "待排队": {
            "排队登记": ["已排队"],
            "取消": ["已取消"],
        },
        "已排队": {
            "分配锅次": ["已分配锅次"],
            "申请取消": ["已排队"],
            "确认取消": ["已取消"],
            "标记异常": ["异常"],
        },
        "已分配锅次": {
            "开始煎煮": ["煎煮中"],
            "申请取消": ["已分配锅次"],
            "确认取消": ["已取消"],
            "标记异常": ["异常"],
        },
        "煎煮中": {
            "完成煎煮": ["煎煮完成"],
            "标记异常": ["异常"],
        },
        "煎煮完成": {
            "开始包装": ["包装中"],
            "标记异常": ["异常"],
        },
        "包装中": {
            "完成包装": ["已完成"],
            "标记异常": ["异常"],
        },
        "已完成": {},
        "已取消": {},
        "异常": {
            "处理异常": ["已排队", "已分配锅次", "已取消", "煎煮中"],
        },
    }

    ROLE_PERMISSIONS: Dict[str, List[str]] = {
        "现场负责人": [
            "排队登记", "分配锅次", "开始煎煮", "完成煎煮",
            "开始包装", "完成包装", "申请取消", "标记异常"
        ],
        "后台复核人": [
            "确认取消", "处理异常"
        ],
        "操作员": [
            "排队登记", "开始煎煮", "完成煎煮", "开始包装", "完成包装"
        ],
    }

    RULES = [
        {"id": "R001", "desc": "状态流转必须符合预定义的状态转换图"},
        {"id": "R002", "desc": "操作必须在角色权限范围内"},
        {"id": "R003", "desc": "已完成状态不可逆转"},
        {"id": "R004", "desc": "已取消状态不可逆转"},
        {"id": "R005", "desc": "同锅合煎组中任一处方申请取消需标记整个组"},
        {"id": "R006", "desc": "确认取消必须由后台复核人执行"},
        {"id": "R007", "desc": "异常处理必须由后台复核人执行"},
        {"id": "R008", "desc": "煎煮开始后不可直接取消，需先标记异常"},
        {"id": "R009", "desc": "同锅合煎组状态必须保持一致"},
        {"id": "R010", "desc": "所有状态变更必须记录操作者、时间和来源"},
    ]

    def __init__(self, db_session):
        self.db = db_session

    def _get_user_role(self, username: str) -> str:
        user = self.db.query(User).filter(User.username == username).first()
        if not user:
            raise StateTransitionError("R002", f"用户 {username} 不存在")
        return user.role

    def _validate_role_permission(self, role: str, action: str):
        allowed_actions = self.ROLE_PERMISSIONS.get(role, [])
        if action not in allowed_actions:
            raise StateTransitionError(
                "R002",
                f"角色 {role} 不允许执行操作 {action}。允许的操作: {allowed_actions}"
            )

    def _validate_transition(self, current_status: str, action: str, target_status: Optional[str] = None):
        if current_status in ["已完成", "已取消"]:
            raise StateTransitionError(
                "R003" if current_status == "已完成" else "R004",
                f"{current_status}状态不可进行任何操作"
            )

        valid_transitions = self.TRANSITION_MAP.get(current_status, {})
        if action not in valid_transitions:
            allowed_actions = list(valid_transitions.keys())
            raise StateTransitionError(
                "R001",
                f"当前状态 {current_status} 不允许执行操作 {action}。允许的操作: {allowed_actions}"
            )

        allowed_targets = valid_transitions[action]
        if target_status and target_status not in allowed_targets:
            raise StateTransitionError(
                "R001",
                f"操作 {action} 不允许从 {current_status} 转换到 {target_status}。允许的目标状态: {allowed_targets}"
            )

        return allowed_targets[0] if target_status is None else target_status

    def _check_same_pot_consistency(self, queue_entry: QueueEntry, new_status: str) -> Tuple[bool, str]:
        if not queue_entry.is_same_pot or not queue_entry.same_pot_group_id:
            return True, ""

        group_entries = self.db.query(QueueEntry).filter(
            QueueEntry.same_pot_group_id == queue_entry.same_pot_group_id,
            QueueEntry.status != "已取消"
        ).all()

        for entry in group_entries:
            if entry.id != queue_entry.id:
                if entry.status != new_status and new_status not in ["异常", "已取消"]:
                    return False, f"同锅合煎组状态不一致: 处方 {entry.queue_no} 当前状态为 {entry.status}，无法统一转换为 {new_status}"

        return True, ""

    def _update_same_pot_group_status(self, group_id: str, new_status: str, performed_by: str, notes: str = None):
        group = self.db.query(SamePotGroup).filter(SamePotGroup.group_id == group_id).first()
        if group:
            group.status = new_status

        group_entries = self.db.query(QueueEntry).filter(
            QueueEntry.same_pot_group_id == group_id,
            QueueEntry.status.notin_(["已取消", "已完成"])
        ).all()

        for entry in group_entries:
            old_status = entry.status
            entry.status = new_status
            entry.updated_by = performed_by
            entry.updated_at = datetime.now()

            history = StatusHistory(
                queue_entry_id=entry.id,
                from_status=old_status,
                to_status=new_status,
                action="同锅组同步",
                performed_by=performed_by,
                performed_by_role=self._get_user_role(performed_by),
                notes=notes or "同锅合煎组状态同步更新"
            )
            self.db.add(history)

    def _record_history(self, queue_entry: QueueEntry, action: str, performed_by: str, notes: str = None):
        role = self._get_user_role(performed_by)
        history = StatusHistory(
            queue_entry_id=queue_entry.id,
            from_status=queue_entry.status,
            to_status=queue_entry.status,
            action=action,
            performed_by=performed_by,
            performed_by_role=role,
            notes=notes
        )
        self.db.add(history)
        return history

    def transition(self, queue_entry: QueueEntry, action: str, performed_by: str,
                   target_status: Optional[str] = None, notes: str = None, **kwargs) -> QueueEntry:
        role = self._get_user_role(performed_by)
        self._validate_role_permission(role, action)

        old_status = queue_entry.status
        new_status = self._validate_transition(old_status, action, target_status)

        if action in ["申请取消", "确认取消"]:
            if old_status in ["煎煮中", "煎煮完成", "包装中"]:
                raise StateTransitionError(
                    "R008",
                    f"煎煮开始后不可直接取消，需先标记异常。当前状态: {old_status}"
                )

        if action == "确认取消":
            if role != "后台复核人":
                raise StateTransitionError("R006", "确认取消必须由后台复核人执行")
            if not queue_entry.cancellation_requested:
                raise StateTransitionError("R006", "确认取消前必须先申请取消")

        if action == "处理异常" and role != "后台复核人":
            raise StateTransitionError("R007", "异常处理必须由后台复核人执行")

        if queue_entry.is_same_pot and queue_entry.same_pot_group_id:
            consistent, msg = self._check_same_pot_consistency(queue_entry, new_status)
            if not consistent:
                raise StateTransitionError("R009", msg)

        queue_entry.status = new_status
        queue_entry.updated_by = performed_by
        queue_entry.updated_at = datetime.now()

        if action == "申请取消":
            queue_entry.cancellation_requested = True
            queue_entry.cancellation_requested_by = performed_by
            queue_entry.cancellation_requested_at = datetime.now()
            queue_entry.cancellation_reason = kwargs.get("reason", "")

            if queue_entry.is_same_pot and queue_entry.same_pot_group_id:
                self._mark_same_pot_group_cancellation(queue_entry.same_pot_group_id, performed_by)

        if action == "标记异常":
            queue_entry.exception_flag = True
            queue_entry.exception_notes = kwargs.get("exception_notes", "")

        history = StatusHistory(
            queue_entry_id=queue_entry.id,
            from_status=old_status,
            to_status=new_status,
            action=action,
            performed_by=performed_by,
            performed_by_role=role,
            notes=notes
        )
        self.db.add(history)

        if queue_entry.is_same_pot and queue_entry.same_pot_group_id and new_status not in ["异常", "已取消"]:
            self._update_same_pot_group_status(
                queue_entry.same_pot_group_id, new_status, performed_by, notes
            )

        self.db.flush()
        return queue_entry

    def _mark_same_pot_group_cancellation(self, group_id: str, performed_by: str):
        group_entries = self.db.query(QueueEntry).filter(
            QueueEntry.same_pot_group_id == group_id,
            QueueEntry.cancellation_requested == False,
            QueueEntry.status.notin_(["已取消", "已完成"])
        ).all()

        for entry in group_entries:
            entry.cancellation_requested = True
            entry.cancellation_requested_by = performed_by
            entry.cancellation_requested_at = datetime.now()
            entry.cancellation_reason = "同锅合煎组有处方申请取消，整组标记待取消"
            self._record_history(entry, "同锅组取消标记", performed_by, "同锅合煎组取消标记同步")

    def get_allowed_actions(self, queue_entry: QueueEntry, username: str) -> List[str]:
        role = self._get_user_role(username)
        valid_transitions = self.TRANSITION_MAP.get(queue_entry.status, {})
        allowed_by_state = list(valid_transitions.keys())
        allowed_by_role = self.ROLE_PERMISSIONS.get(role, [])
        return list(set(allowed_by_state) & set(allowed_by_role))

    def validate_same_pot_assignment(self, pot_id: int, decoction_type: str) -> Tuple[bool, str]:
        existing = self.db.query(QueueEntry).filter(
            QueueEntry.pot_id == pot_id,
            QueueEntry.status.in_(["已分配锅次", "煎煮中"]),
            QueueEntry.is_same_pot == True
        ).first()

        if existing:
            prescription = self.db.query(models_Prescription).filter(
                models_Prescription.id == existing.prescription_id
            ).first()
            if prescription and prescription.decoction_type != decoction_type:
                return False, f"同锅合煎要求煎煮类型一致。锅内现有处方为 {prescription.decoction_type}，新处方为 {decoction_type}"

        return True, ""
