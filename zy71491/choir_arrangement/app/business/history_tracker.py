from typing import Optional
from sqlalchemy.orm import Session
from app.models import ArrangementHistory


class HistoryTracker:
    def __init__(self, db: Session):
        self.db = db

    def log_change(self, rehearsal_id: int, action_type: str,
                   field_name: Optional[str] = None,
                   old_value: Optional[str] = None,
                   new_value: Optional[str] = None,
                   changed_by: Optional[str] = None,
                   reason: Optional[str] = None):
        history_entry = ArrangementHistory(
            rehearsal_id=rehearsal_id,
            action_type=action_type,
            field_name=field_name,
            old_value=str(old_value) if old_value is not None else None,
            new_value=str(new_value) if new_value is not None else None,
            changed_by=changed_by,
            reason=reason
        )
        self.db.add(history_entry)
        self.db.commit()
        self.db.refresh(history_entry)
        return history_entry

    def log_arrangement_create(self, rehearsal_id: int, member_id: int,
                               position_row: int, position_col: int,
                               is_manual: bool = False):
        self.log_change(
            rehearsal_id=rehearsal_id,
            action_type="arrangement_create",
            field_name="arrangement",
            old_value=None,
            new_value=f"member_id={member_id}, position=({position_row},{position_col})",
            changed_by="system" if not is_manual else "manual",
            reason="自动排表" if not is_manual else "人工调整"
        )

    def log_arrangement_update(self, rehearsal_id: int, arrangement_id: int,
                               field_name: str, old_value: str, new_value: str,
                               is_manual: bool = False):
        self.log_change(
            rehearsal_id=rehearsal_id,
            action_type="arrangement_update",
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            changed_by="system" if not is_manual else "manual",
            reason=f"更新排表项[{arrangement_id}]的{field_name}"
        )

    def log_arrangement_delete(self, rehearsal_id: int, arrangement_id: int,
                               member_id: int, is_manual: bool = False):
        self.log_change(
            rehearsal_id=rehearsal_id,
            action_type="arrangement_delete",
            field_name="arrangement",
            old_value=f"arrangement_id={arrangement_id}, member_id={member_id}",
            new_value=None,
            changed_by="system" if not is_manual else "manual",
            reason="删除排表项"
        )

    def log_status_change(self, rehearsal_id: int, old_status: str, new_status: str,
                          changed_by: str = "system"):
        self.log_change(
            rehearsal_id=rehearsal_id,
            action_type="status_change",
            field_name="status",
            old_value=old_status,
            new_value=new_status,
            changed_by=changed_by,
            reason="排练状态变更"
        )

    def log_manual_override(self, rehearsal_id: int, field_name: str,
                            old_value: str, new_value: str, reason: str = None):
        self.log_change(
            rehearsal_id=rehearsal_id,
            action_type="manual_override",
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            changed_by="manual",
            reason=reason or "人工覆盖系统推荐"
        )

    def get_history(self, rehearsal_id: int = None, action_type: str = None, limit: int = 100):
        query = self.db.query(ArrangementHistory)

        if rehearsal_id:
            query = query.filter(ArrangementHistory.rehearsal_id == rehearsal_id)
        if action_type:
            query = query.filter(ArrangementHistory.action_type == action_type)

        query = query.order_by(ArrangementHistory.created_at.desc()).limit(limit)
        return query.all()
