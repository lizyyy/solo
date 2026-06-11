from datetime import datetime
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, field

from models import (
    ChangeOrder,
    VersionHistory,
    Judgement,
    VisaNote,
    CoordinateOffset,
)


@dataclass
class JudgementDiff:
    item_code: str
    item_name: str
    original_judgement: str
    previous_final: str
    current_final: str
    modified_by: Optional[str]
    modified_at: Optional[datetime]
    modification_reason: Optional[str]
    is_new: bool = False
    is_removed: bool = False


@dataclass
class VersionDiff:
    version_from: int
    version_to: int
    timestamp_from: datetime
    timestamp_to: datetime
    operator_from: str
    operator_to: str
    change_summary: str
    judgement_diffs: List[JudgementDiff]
    visa_notes_added: List[VisaNote]
    visa_notes_removed: List[VisaNote]
    coordinate_offset_changed: Optional[Tuple[Optional[CoordinateOffset], Optional[CoordinateOffset]]]


@dataclass
class AuditTrailEntry:
    timestamp: datetime
    operator: str
    action: str
    item_code: Optional[str]
    before: str
    after: str
    reason: Optional[str]


class HistoryAuditor:
    def __init__(self, change_order: ChangeOrder):
        self.change_order = change_order

    def get_version_history(self) -> List[VersionHistory]:
        return sorted(
            self.change_order.version_history,
            key=lambda v: v.version
        )

    def compare_versions(
        self,
        version_from: int,
        version_to: int
    ) -> Optional[VersionDiff]:
        history = self.get_version_history()

        v_from = next((v for v in history if v.version == version_from), None)
        v_to = next((v for v in history if v.version == version_to), None)

        if not v_from or not v_to:
            return None

        judgement_diffs = self._compare_judgements(
            v_from.judgements_snapshot,
            v_to.judgements_snapshot
        )

        visa_added, visa_removed = self._compare_visa_notes(
            v_from.visa_notes_snapshot,
            v_to.visa_notes_snapshot
        )

        coord_change = self._compare_coordinate_offsets(
            v_from.coordinate_offset_snapshot,
            v_to.coordinate_offset_snapshot
        )

        return VersionDiff(
            version_from=version_from,
            version_to=version_to,
            timestamp_from=v_from.timestamp,
            timestamp_to=v_to.timestamp,
            operator_from=v_from.operator,
            operator_to=v_to.operator,
            change_summary=v_to.change_summary,
            judgement_diffs=judgement_diffs,
            visa_notes_added=visa_added,
            visa_notes_removed=visa_removed,
            coordinate_offset_changed=coord_change,
        )

    def get_judgement_history(
        self,
        item_code: str
    ) -> List[Tuple[int, datetime, str, Optional[str], Optional[str]]]:
        history = []

        for v in self.get_version_history():
            j = next(
                (j for j in v.judgements_snapshot if j.item_code == item_code),
                None
            )
            if j:
                history.append((
                    v.version,
                    v.timestamp,
                    j.final_judgement,
                    j.modified_by,
                    j.modification_reason,
                ))

        current = self.change_order.get_judgement_by_code(item_code)
        if current:
            history.append((
                self.change_order.current_version + 1,
                datetime.now(),
                current.final_judgement,
                current.modified_by,
                current.modification_reason,
            ))

        return history

    def get_full_audit_trail(self) -> List[AuditTrailEntry]:
        trail = []
        history = self.get_version_history()

        for i in range(len(history)):
            if i == 0:
                for j in history[i].judgements_snapshot:
                    trail.append(AuditTrailEntry(
                        timestamp=history[i].timestamp,
                        operator=history[i].operator,
                        action="初始化判断",
                        item_code=j.item_code,
                        before="（空）",
                        after=j.final_judgement,
                        reason=history[i].change_summary,
                    ))
                continue

            diff = self.compare_versions(history[i-1].version, history[i].version)
            if diff:
                for jd in diff.judgement_diffs:
                    if jd.is_new:
                        action = "新增判断"
                        before = "（空）"
                        after = jd.current_final
                    elif jd.is_removed:
                        action = "移除判断"
                        before = jd.previous_final
                        after = "（已移除）"
                    else:
                        if jd.modification_reason:
                            action = "人工调整判断"
                        else:
                            action = "更新判断"
                        before = jd.previous_final
                        after = jd.current_final

                    trail.append(AuditTrailEntry(
                        timestamp=history[i].timestamp,
                        operator=history[i].operator,
                        action=action,
                        item_code=jd.item_code,
                        before=before,
                        after=after,
                        reason=jd.modification_reason or history[i].change_summary,
                    ))

                for visa in diff.visa_notes_added:
                    trail.append(AuditTrailEntry(
                        timestamp=visa.created_at,
                        operator=visa.created_by,
                        action="新增现场签证",
                        item_code=None,
                        before="（无）",
                        after=visa.content,
                        reason=f"来源：{visa.source_doc}",
                    ))

                if diff.coordinate_offset_changed:
                    old, new = diff.coordinate_offset_changed
                    before_str = (
                        f"X={old.offset_x}, Y={old.offset_y}, Z={old.offset_z}"
                        if old else "（无）"
                    )
                    after_str = (
                        f"X={new.offset_x}, Y={new.offset_y}, Z={new.offset_z}"
                        if new else "（已清除）"
                    )
                    if old != new:
                        trail.append(AuditTrailEntry(
                            timestamp=history[i].timestamp,
                            operator=history[i].operator,
                            action="坐标偏移更新",
                            item_code=None,
                            before=before_str,
                            after=after_str,
                            reason=history[i].change_summary,
                        ))

        return sorted(trail, key=lambda t: t.timestamp)

    def get_overridden_judgements_report(self) -> str:
        overridden = [
            j for j in self.change_order.judgements
            if j.is_overridden
        ]

        if not overridden:
            return "无人工调整记录"

        lines = ["=== 人工调整历史记录（结构工程师老叶等）==="]
        for j in overridden:
            lines.append(f"\n分项：{j.item_code} {j.item_name}")
            lines.append(f"  原始判断：{j.original_judgement}")
            lines.append(f"  最终判断：{j.final_judgement}")
            lines.append(f"  调整人：{j.modified_by}")
            lines.append(f"  调整时间：{j.modified_at.strftime('%Y-%m-%d %H:%M') if j.modified_at else '未知'}")
            lines.append(f"  调整原因：{j.modification_reason}")

            hist = self.get_judgement_history(j.item_code)
            if len(hist) > 1:
                lines.append(f"  历史变更轨迹：")
                for ver, ts, val, op, reason in hist:
                    op_str = f"（{op}）" if op else ""
                    reason_str = f" - {reason}" if reason else ""
                    lines.append(f"    V{ver} [{ts.strftime('%H:%M')}]{op_str}: {val}{reason_str}")

        lines.append("\n⚠️ 下一班查看时，不仅能看到最终值，还能看到完整调整过程和原因。")
        return "\n".join(lines)

    def _compare_judgements(
        self,
        old: List[Judgement],
        new: List[Judgement]
    ) -> List[JudgementDiff]:
        diffs = []
        old_map = {j.item_code: j for j in old}
        new_map = {j.item_code: j for j in new}

        for code, j_new in new_map.items():
            if code not in old_map:
                diffs.append(JudgementDiff(
                    item_code=code,
                    item_name=j_new.item_name,
                    original_judgement=j_new.original_judgement,
                    previous_final="（新增）",
                    current_final=j_new.final_judgement,
                    modified_by=j_new.modified_by,
                    modified_at=j_new.modified_at,
                    modification_reason=j_new.modification_reason,
                    is_new=True,
                ))
            else:
                j_old = old_map[code]
                if j_old.final_judgement != j_new.final_judgement:
                    diffs.append(JudgementDiff(
                        item_code=code,
                        item_name=j_new.item_name,
                        original_judgement=j_new.original_judgement,
                        previous_final=j_old.final_judgement,
                        current_final=j_new.final_judgement,
                        modified_by=j_new.modified_by,
                        modified_at=j_new.modified_at,
                        modification_reason=j_new.modification_reason,
                    ))

        for code, j_old in old_map.items():
            if code not in new_map:
                diffs.append(JudgementDiff(
                    item_code=code,
                    item_name=j_old.item_name,
                    original_judgement=j_old.original_judgement,
                    previous_final=j_old.final_judgement,
                    current_final="（已移除）",
                    modified_by=None,
                    modified_at=None,
                    modification_reason=None,
                    is_removed=True,
                ))

        return diffs

    def _compare_visa_notes(
        self,
        old: List[VisaNote],
        new: List[VisaNote]
    ) -> Tuple[List[VisaNote], List[VisaNote]]:
        old_ids = {v.id for v in old}
        new_ids = {v.id for v in new}

        added = [v for v in new if v.id not in old_ids]
        removed = [v for v in old if v.id not in new_ids]

        return added, removed

    def _compare_coordinate_offsets(
        self,
        old: Optional[CoordinateOffset],
        new: Optional[CoordinateOffset]
    ) -> Optional[Tuple[Optional[CoordinateOffset], Optional[CoordinateOffset]]]:
        if old is None and new is None:
            return None
        if old is None or new is None:
            return (old, new)
        if (old.offset_x != new.offset_x or
            old.offset_y != new.offset_y or
            old.offset_z != new.offset_z):
            return (old, new)
        return None
