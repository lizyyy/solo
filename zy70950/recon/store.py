"""进程内会话存储。

为了保持服务「偏后端、可跑通」的定位，这里不引入真实数据库；
所有会话数据以 Python dict 常驻内存，重启即清空。
如需持久化，可把 `SessionStore` 的实现替换为 SQLModel/SQLAlchemy。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional

from .schemas import (
    AdditionRecord,
    Agreement,
    Package,
    ReconciliationItem,
    Session,
    SessionStatus,
    SessionSummary,
)


@dataclass
class SessionData:
    session: Session
    additions: List[AdditionRecord] = field(default_factory=list)
    packages: List[Package] = field(default_factory=list)
    agreements: List[Agreement] = field(default_factory=list)
    items: List[ReconciliationItem] = field(default_factory=list)
    summary: Optional[SessionSummary] = None


class SessionStore:
    def __init__(self) -> None:
        self._data: Dict[str, SessionData] = {}

    # ---------------- 会话 ---------------- #

    def create(self, name: str, note: str = "") -> Session:
        sess = Session(name=name, note=note)
        self._data[sess.id] = SessionData(session=sess)
        return sess

    def get(self, session_id: str) -> SessionData:
        if session_id not in self._data:
            raise KeyError(session_id)
        return self._data[session_id]

    def list_sessions(self) -> List[Session]:
        return [d.session for d in self._data.values()]

    def set_status(self, session_id: str, status: SessionStatus) -> None:
        self.get(session_id).session.status = status

    # ---------------- 原始数据 ---------------- #

    def put_additions(self, session_id: str, records: List[AdditionRecord]) -> None:
        self.get(session_id).additions.extend(records)

    def put_packages(self, session_id: str, packages: List[Package]) -> None:
        self.get(session_id).packages.extend(packages)

    def put_agreements(self, session_id: str, agreements: List[Agreement]) -> None:
        self.get(session_id).agreements.extend(agreements)

    # ---------------- 对账明细 ---------------- #

    def put_items(self, session_id: str, items: List[ReconciliationItem]) -> None:
        self.get(session_id).items = items

    def get_items(self, session_id: str) -> List[ReconciliationItem]:
        return self.get(session_id).items

    def find_item(self, session_id: str, trace_id: str) -> Optional[ReconciliationItem]:
        for it in self.get(session_id).items:
            if it.trace_id == trace_id:
                return it
        return None

    # ---------------- 汇总 ---------------- #

    def put_summary(self, session_id: str, summary: SessionSummary) -> None:
        self.get(session_id).summary = summary

    def get_summary(self, session_id: str) -> Optional[SessionSummary]:
        return self.get(session_id).summary


store = SessionStore()
