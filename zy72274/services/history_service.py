from typing import List, Dict, Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from models import ChangeHistory, CADLayer, InspectionPhoto
from boundary_rules import BoundaryRuleEngine, BoundaryCheckResult


class HistoryService:
    """
    变更历史服务
    ======================================
    核心约束 RULE_003: 备注修改可追溯
    - 修改 layer_remark 或 layer_name 时自动记录
    - 完整保留 old_value 和 new_value（含备注）
    - 支持回滚
    - 回滚本身也会被记录
    """

    def __init__(self, db: Session):
        self.db = db

    def _record_change(
        self,
        photo_id: Optional[int],
        profile_id: Optional[int],
        field_name: str,
        old_value: str,
        new_value: str,
        changed_by: str,
        change_reason: str,
        can_rollback: bool = True
    ) -> ChangeHistory:
        history = ChangeHistory(
            photo_id=photo_id,
            profile_id=profile_id,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            changed_by=changed_by,
            change_reason=change_reason,
            rollback_possible=can_rollback
        )
        self.db.add(history)
        self.db.flush()
        return history

    def update_cad_layer_remark(
        self,
        layer_id: int,
        new_remark: str,
        new_layer_name: Optional[str],
        changed_by: str,
        change_reason: str
    ) -> Tuple[CADLayer, List[BoundaryCheckResult]]:
        layer = self.db.query(CADLayer).filter(CADLayer.id == layer_id).first()
        if not layer:
            raise ValueError(f"CAD图层 {layer_id} 不存在")

        check_results: List[BoundaryCheckResult] = []

        if new_layer_name is not None:
            name_result = BoundaryRuleEngine.check_remark_change(
                "layer_name", layer.layer_name, new_layer_name
            )
            check_results.append(name_result)

            if name_result.can_rollback:
                self._record_change(
                    photo_id=layer.photo_id,
                    profile_id=None,
                    field_name="layer_name",
                    old_value=layer.layer_name,
                    new_value=new_layer_name,
                    changed_by=changed_by,
                    change_reason=change_reason,
                    can_rollback=True
                )
                layer.layer_name = new_layer_name

        if new_remark is not None:
            remark_result = BoundaryRuleEngine.check_remark_change(
                "layer_remark", layer.layer_remark or "", new_remark
            )
            check_results.append(remark_result)

            if remark_result.can_rollback:
                self._record_change(
                    photo_id=layer.photo_id,
                    profile_id=None,
                    field_name="layer_remark",
                    old_value=layer.layer_remark or "",
                    new_value=new_remark,
                    changed_by=changed_by,
                    change_reason=change_reason,
                    can_rollback=True
                )
                layer.layer_remark = new_remark
                layer.has_remark = bool(new_remark)

        layer.reviewed_by = changed_by
        layer.reviewed_at = datetime.utcnow()

        self.db.commit()
        return layer, check_results

    def get_photo_history(self, photo_id: int) -> List[Dict]:
        histories = self.db.query(ChangeHistory).filter(
            ChangeHistory.photo_id == photo_id
        ).order_by(ChangeHistory.created_at.desc()).all()

        result = []
        for h in histories:
            result.append({
                "history_id": h.id,
                "field_name": h.field_name,
                "old_value": h.old_value,
                "new_value": h.new_value,
                "changed_by": h.changed_by,
                "change_reason": h.change_reason,
                "created_at": h.created_at,
                "rollback_possible": h.rollback_possible,
                "rolled_back": h.rolled_back,
                "rollback_from_id": h.rollback_from_id
            })
        return result

    def compare_history(self, history_id: int) -> Dict:
        history = self.db.query(ChangeHistory).filter(
            ChangeHistory.id == history_id
        ).first()

        if not history:
            raise ValueError(f"历史记录 {history_id} 不存在")

        return {
            "field_name": history.field_name,
            "change_at": history.created_at,
            "changed_by": history.changed_by,
            "change_reason": history.change_reason,
            "before": {
                "value": history.old_value,
                "preview": self._get_value_preview(history.old_value)
            },
            "after": {
                "value": history.new_value,
                "preview": self._get_value_preview(history.new_value)
            },
            "diff": self._generate_diff(history.old_value or "", history.new_value or "")
        }

    def _get_value_preview(self, value: Optional[str]) -> str:
        if not value:
            return "(空)"
        if len(value) <= 100:
            return value
        return value[:97] + "..."

    def _generate_diff(self, old: str, new: str) -> str:
        old_lines = old.split("\n") if old else []
        new_lines = new.split("\n") if new else []

        diff_lines = []
        max_lines = max(len(old_lines), len(new_lines))
        for i in range(max_lines):
            o = old_lines[i] if i < len(old_lines) else ""
            n = new_lines[i] if i < len(new_lines) else ""
            if o != n:
                if o:
                    diff_lines.append(f"- {o}")
                if n:
                    diff_lines.append(f"+ {n}")

        return "\n".join(diff_lines) if diff_lines else "(无差异)"

    def rollback(self, history_id: int, rolled_back_by: str) -> ChangeHistory:
        history = self.db.query(ChangeHistory).filter(
            ChangeHistory.id == history_id
        ).first()

        if not history:
            raise ValueError(f"历史记录 {history_id} 不存在")

        if not history.rollback_possible:
            raise ValueError(f"历史记录 {history_id} 不可回滚")

        if history.rolled_back:
            raise ValueError(f"历史记录 {history_id} 已被回滚")

        if history.field_name == "layer_remark":
            layer = self.db.query(CADLayer).filter(
                CADLayer.photo_id == history.photo_id
            ).first()
            if layer:
                layer.layer_remark = history.old_value
                layer.has_remark = bool(history.old_value)
                layer.reviewed_by = rolled_back_by
                layer.reviewed_at = datetime.utcnow()

        elif history.field_name == "layer_name":
            layer = self.db.query(CADLayer).filter(
                CADLayer.photo_id == history.photo_id
            ).first()
            if layer:
                layer.layer_name = history.old_value

        history.rolled_back = True

        rollback_record = self._record_change(
            photo_id=history.photo_id,
            profile_id=history.profile_id,
            field_name=history.field_name,
            old_value=history.new_value,
            new_value=history.old_value,
            changed_by=rolled_back_by,
            change_reason=f"回滚历史记录 #{history_id}",
            can_rollback=True
        )
        rollback_record.rollback_from_id = history_id

        self.db.commit()
        return rollback_record
