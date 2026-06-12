from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum


class RecordStatus(str, Enum):
    NORMAL = "正常"
    NEEDS_REVIEW = "待复核"
    SUPPLEMENTED = "已补录"
    OLD_STANDARD = "旧口径"
    PENDING_CORRECTION = "待整改"


class CorrectionSource(str, Enum):
    RAMP_SUPPLEMENT = "坡道补录"
    REDLINE_NOTE = "红线图备注"
    MANUAL = "人工修正"
    RERUN = "重跑验证"


@dataclass
class StateSnapshot:
    """状态快照：记录每一步操作前后的完整状态，用于反查和追溯"""
    time: str
    action: str
    operator: str
    before_score: Optional[float] = None
    after_score: Optional[float] = None
    before_status: Optional[str] = None
    after_status: Optional[str] = None
    before_redline_note: Optional[str] = None
    after_redline_note: Optional[str] = None
    before_suggestion: Optional[str] = None
    after_suggestion: Optional[str] = None
    change_reason: Optional[str] = None
    detail: str = ""

    def to_display_dict(self) -> Dict[str, Any]:
        result = {
            "时间": self.time,
            "操作": self.action,
            "操作人": self.operator,
        }
        if self.before_score is not None and self.after_score is not None:
            if self.before_score != self.after_score:
                result["评分变化"] = f"{self.before_score:.1f} → {self.after_score:.1f}"
            else:
                result["评分"] = f"{self.after_score:.1f} (未变化)"
        if self.before_status and self.after_status:
            if self.before_status != self.after_status:
                result["状态变化"] = f"{self.before_status} → {self.after_status}"
            else:
                result["状态"] = self.after_status
        if self.before_redline_note is not None or self.after_redline_note is not None:
            result["红线图备注变化"] = self._format_change(
                self.before_redline_note, self.after_redline_note, "无备注"
            )
        if self.change_reason:
            result["修改原因"] = self.change_reason
        if self.detail:
            result["详情"] = self.detail
        return result

    @staticmethod
    def _format_change(before: Optional[str], after: Optional[str], empty_label: str) -> str:
        b = before if before else empty_label
        a = after if after else empty_label
        if b == a:
            return f"{a} (未变化)"
        return f"【改前】{b}  →  【改后】{a}"


@dataclass
class CorrectionDetail:
    """修正记录的结构化详情，不只是字符串"""
    source: str
    operator: str
    time: str
    content: str
    before_score: Optional[float] = None
    after_score: Optional[float] = None
    before_status: Optional[str] = None
    after_status: Optional[str] = None
    before_redline: Optional[str] = None
    after_redline: Optional[str] = None
    change_reason: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        d = {
            "source": self.source,
            "content": self.content,
            "operator": self.operator,
            "time": self.time,
        }
        if self.before_score is not None:
            d["before_score"] = self.before_score
        if self.after_score is not None:
            d["after_score"] = self.after_score
        if self.before_status:
            d["before_status"] = self.before_status
        if self.after_status:
            d["after_status"] = self.after_status
        if self.before_redline is not None:
            d["before_redline"] = self.before_redline
        if self.after_redline is not None:
            d["after_redline"] = self.after_redline
        if self.change_reason:
            d["change_reason"] = self.change_reason
        return d


@dataclass
class RedlineNoteHistory:
    """红线图备注修改历史"""
    time: str
    operator: str
    before_note: Optional[str]
    after_note: str
    change_reason: str

    def to_display(self) -> str:
        b = self.before_note if self.before_note else "无"
        return (
            f"[{self.time}] {self.operator}\n"
            f"  改前备注: {b}\n"
            f"  改后备注: {self.after_note}\n"
            f"  修改原因: {self.change_reason}"
        )


@dataclass
class BuildingSetbackRecord:
    record_id: str
    building_name: str
    address: str
    bus_card_time: str
    initial_score: float
    current_score: float = 0.0
    status: RecordStatus = RecordStatus.NORMAL
    redline_note: Optional[str] = None
    ramp_supplemented: bool = False
    corrections: List[Dict[str, Any]] = field(default_factory=list)
    history: List[Dict[str, Any]] = field(default_factory=list)
    suggestion: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    state_snapshots: List[StateSnapshot] = field(default_factory=list)
    correction_details: List[CorrectionDetail] = field(default_factory=list)
    redline_note_history: List[RedlineNoteHistory] = field(default_factory=list)
    last_manual_score: Optional[float] = None
    last_manual_status: Optional[str] = None
    manual_correction_applied: bool = False
    manual_correction_reason: Optional[str] = None

    def take_snapshot(self, action: str, operator: str, before: bool,
                      change_reason: Optional[str] = None, detail: str = ""):
        if before:
            self._pending_snapshot = {
                "action": action,
                "operator": operator,
                "before_score": self.current_score,
                "before_status": self.status.value,
                "before_redline_note": self.redline_note,
                "before_suggestion": self.suggestion,
                "change_reason": change_reason,
                "detail": detail,
            }
        else:
            pending = getattr(self, "_pending_snapshot", {})
            snapshot = StateSnapshot(
                time=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                action=pending.get("action", action),
                operator=pending.get("operator", operator),
                before_score=pending.get("before_score"),
                after_score=self.current_score,
                before_status=pending.get("before_status"),
                after_status=self.status.value,
                before_redline_note=pending.get("before_redline_note"),
                after_redline_note=self.redline_note,
                before_suggestion=pending.get("before_suggestion"),
                after_suggestion=self.suggestion,
                change_reason=pending.get("change_reason", change_reason),
                detail=pending.get("detail", detail),
            )
            self.state_snapshots.append(snapshot)
            if hasattr(self, "_pending_snapshot"):
                delattr(self, "_pending_snapshot")

    def add_history(self, action: str, operator: str, detail: str):
        self.history.append({
            "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "action": action,
            "operator": operator,
            "detail": detail
        })
        self.updated_at = datetime.now()

    def add_correction(self, source: CorrectionSource, content: str, operator: str,
                       before_score: Optional[float] = None, after_score: Optional[float] = None,
                       before_status: Optional[str] = None, after_status: Optional[str] = None,
                       before_redline: Optional[str] = None, after_redline: Optional[str] = None,
                       change_reason: Optional[str] = None):
        detail = CorrectionDetail(
            source=source.value,
            content=content,
            operator=operator,
            time=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            before_score=before_score,
            after_score=after_score,
            before_status=before_status,
            after_status=after_status,
            before_redline=before_redline,
            after_redline=after_redline,
            change_reason=change_reason,
        )
        self.correction_details.append(detail)
        self.corrections.append(detail.to_dict())
        self.add_history(
            action="修正记录",
            operator=operator,
            detail=f"来源: {source.value}, 内容: {content}"
        )

    def add_redline_note_change(self, before_note: Optional[str], after_note: str,
                                change_reason: str, operator: str):
        entry = RedlineNoteHistory(
            time=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            operator=operator,
            before_note=before_note,
            after_note=after_note,
            change_reason=change_reason,
        )
        self.redline_note_history.append(entry)

    def get_traceback(self) -> List[Dict[str, Any]]:
        """反查：获取完整的状态变化轨迹"""
        return [s.to_display_dict() for s in self.state_snapshots]

    def get_corrections_traceback(self) -> List[Dict[str, Any]]:
        """反查：获取修正记录的详细改前改后"""
        result = []
        for c in self.correction_details:
            item = {
                "时间": c.time,
                "来源": c.source,
                "操作人": c.operator,
                "内容": c.content,
            }
            if c.before_score is not None and c.after_score is not None:
                if c.before_score != c.after_score:
                    item["评分变化"] = f"{c.before_score:.1f} → {c.after_score:.1f}"
                else:
                    item["评分"] = f"{c.after_score:.1f} (未变化)"
            if c.before_status and c.after_status:
                if c.before_status != c.after_status:
                    item["状态变化"] = f"{c.before_status} → {c.after_status}"
            if c.before_redline is not None or c.after_redline is not None:
                b = c.before_redline if c.before_redline else "无"
                a = c.after_redline if c.after_redline else "无"
                if b != a:
                    item["备注变化"] = f"【改前】{b} → 【改后】{a}"
            if c.change_reason:
                item["修改原因"] = c.change_reason
            result.append(item)
        return result


@dataclass
class ProcessingResult:
    record_id: str
    building_name: str
    final_score: float
    status: RecordStatus
    suggestion: str
    history_count: int
    correction_count: int
    display_message: str
    state_traceback: List[Dict[str, Any]] = field(default_factory=list)
    corrections_traceback: List[Dict[str, Any]] = field(default_factory=list)
    manual_score_preserved: bool = False
    final_verification: str = ""
