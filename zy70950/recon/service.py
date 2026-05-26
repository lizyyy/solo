"""会话级编排：导入 / 比对 / 复核 / 重算 / 汇总 / 报告。"""

from __future__ import annotations

import csv
import io
from typing import Any, Dict, List, Optional

from .matcher import reconcile_all
from .schemas import (
    ReasonCode,
    ReconciliationItem,
    ReviewStatus,
    Session,
    SessionStatus,
    SessionSummary,
)
from .store import SessionData, store


# ---------------- 创建 / 查看会话 ---------------- #

def create_session(name: str, note: str = "") -> Session:
    return store.create(name=name, note=note)


def get_session(session_id: str) -> Session:
    return store.get(session_id).session


def list_sessions() -> List[Session]:
    return store.list_sessions()


def _data(session_id: str) -> SessionData:
    return store.get(session_id)


# ---------------- 导入 ---------------- #

def import_additions(session_id: str, records) -> int:
    store.put_additions(session_id, records)
    _mark_data_loaded(session_id)
    return len(records)


def import_packages(session_id: str, packages) -> int:
    store.put_packages(session_id, packages)
    _mark_data_loaded(session_id)
    return len(packages)


def import_agreements(session_id: str, agreements) -> int:
    store.put_agreements(session_id, agreements)
    _mark_data_loaded(session_id)
    return len(agreements)


def _mark_data_loaded(session_id: str) -> None:
    d = _data(session_id)
    if d.session.status == SessionStatus.CREATED:
        store.set_status(session_id, SessionStatus.DATA_LOADED)


# ---------------- 自动比对 ---------------- #

def run_match(session_id: str) -> List[ReconciliationItem]:
    d = _data(session_id)
    items = reconcile_all(d.additions, d.packages, d.agreements)
    store.put_items(session_id, items)
    store.set_status(session_id, SessionStatus.MATCHED)
    return items


# ---------------- 人工复核 ---------------- #

def apply_review(
    session_id: str,
    trace_id: str,
    status: ReviewStatus,
    adjustment_amount: float = 0.0,
    comment: str = "",
) -> ReconciliationItem:
    item = store.find_item(session_id, trace_id)
    if item is None:
        raise KeyError(trace_id)
    item.review_status = status
    item.review_comment = comment
    item.adjustment_amount = adjustment_amount
    store.set_status(session_id, SessionStatus.REVIEWED)
    return item


# ---------------- 重新计算 ---------------- #

def recalc(session_id: str) -> SessionSummary:
    """基于复核结果重新计算 final_amount 与汇总。"""
    items = store.get_items(session_id)
    for it in items:
        it.final_amount = round(
            it.expected_amount + it.adjustment_amount, 2
        )
    summary = summarize(session_id)
    store.put_summary(session_id, summary)
    store.set_status(session_id, SessionStatus.RECALCULATED)
    return summary


# ---------------- 汇总 ---------------- #

def summarize(session_id: str) -> SessionSummary:
    items = store.get_items(session_id)
    reason_dist: Dict[str, int] = {}
    onsite_total = 0.0
    expected_total = 0.0
    final_total = 0.0
    adjustment_total = 0.0
    matched = 0
    diff = 0
    pending = approved = rejected = supplement = 0
    for it in items:
        onsite_total += it.onsite_amount
        expected_total += it.expected_amount
        final_total += it.final_amount
        adjustment_total += it.adjustment_amount
        if abs(it.diff_amount) < 0.01:
            matched += 1
        else:
            diff += 1
        for rc in it.explanation.reason_codes:
            reason_dist[rc.value] = reason_dist.get(rc.value, 0) + 1
        if it.review_status == ReviewStatus.PENDING:
            pending += 1
        elif it.review_status == ReviewStatus.APPROVED:
            approved += 1
        elif it.review_status == ReviewStatus.REJECTED:
            rejected += 1
        elif it.review_status == ReviewStatus.SUPPLEMENT:
            supplement += 1
    return SessionSummary(
        session_id=session_id,
        total_items=len(items),
        matched_items=matched,
        diff_items=diff,
        pending_review=pending,
        approved=approved,
        rejected=rejected,
        supplement=supplement,
        onsite_total=round(onsite_total, 2),
        expected_total=round(expected_total, 2),
        final_total=round(final_total, 2),
        adjustment_total=round(adjustment_total, 2),
        reason_distribution=reason_dist,
    )


# ---------------- 明细 & 全链路 ---------------- #

def details(
    session_id: str,
    trace_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    items = store.get_items(session_id)
    if trace_id is not None:
        items = [it for it in items if it.trace_id == trace_id]
    out: List[Dict[str, Any]] = []
    for it in items:
        out.append(
            {
                "trace_id": it.trace_id,
                "addition_id": it.addition.addition_id if it.addition else None,
                "examinee_id": it.addition.examinee_id if it.addition else None,
                "examinee_name": it.addition.examinee_name if it.addition else None,
                "item_code": it.addition.item_code if it.addition else None,
                "item_name": it.addition.item_name if it.addition else None,
                "agreement_id": it.addition.agreement_id if it.addition else None,
                "gross_amount": it.addition.gross_amount if it.addition else 0.0,
                "onsite_amount": it.onsite_amount,
                "expected_amount": it.expected_amount,
                "diff_amount": it.diff_amount,
                "review_status": it.review_status.value,
                "review_comment": it.review_comment,
                "adjustment_amount": it.adjustment_amount,
                "final_amount": it.final_amount,
                "explanation": it.explanation.model_dump(),
                "trace_chain": _trace_chain(it),
            }
        )
    return out


def _trace_chain(it: ReconciliationItem) -> List[Dict[str, Any]]:
    """从原始导入到最终报告的链路。"""
    chain: List[Dict[str, Any]] = []
    if it.addition:
        chain.append(
            {
                "stage": "additions_import",
                "amount": it.addition.gross_amount,
                "source": "addition_csv",
                "ref": it.addition.addition_id,
            }
        )
    if it.package:
        chain.append(
            {
                "stage": "package_reference",
                "source": "package_json",
                "ref": it.package.package_id,
                "items": [i.model_dump() for i in it.package.items],
            }
        )
    if it.agreement:
        chain.append(
            {
                "stage": "agreement_reference",
                "source": "agreement_json",
                "ref": it.agreement.agreement_id,
                "per_person_limit": it.agreement.per_person_limit,
                "company_total_limit": it.agreement.company_total_limit,
            }
        )
    chain.append(
        {
            "stage": "match",
            "expected_amount": it.expected_amount,
            "diff_amount": it.diff_amount,
            "reasons": [r.value for r in it.explanation.reason_codes],
        }
    )
    chain.append(
        {
            "stage": "review",
            "status": it.review_status.value,
            "adjustment": it.adjustment_amount,
            "comment": it.review_comment,
        }
    )
    chain.append(
        {
            "stage": "final_report",
            "final_amount": it.final_amount,
        }
    )
    return chain


# ---------------- 报告导出 ---------------- #

def build_report_csv(session_id: str) -> str:
    items = store.get_items(session_id)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(
        [
            "trace_id",
            "addition_id",
            "examinee_id",
            "examinee_name",
            "item_code",
            "item_name",
            "agreement_id",
            "gross_amount",
            "onsite_amount",
            "expected_amount",
            "diff_amount",
            "reason_codes",
            "human_readable",
            "review_status",
            "review_comment",
            "adjustment_amount",
            "final_amount",
        ]
    )
    for it in items:
        a = it.addition
        w.writerow(
            [
                it.trace_id,
                a.addition_id if a else "",
                a.examinee_id if a else "",
                a.examinee_name if a else "",
                a.item_code if a else "",
                a.item_name if a else "",
                a.agreement_id if a else "",
                a.gross_amount if a else "",
                it.onsite_amount,
                it.expected_amount,
                it.diff_amount,
                ",".join(r.value for r in it.explanation.reason_codes),
                it.explanation.human_readable,
                it.review_status.value,
                it.review_comment,
                it.adjustment_amount,
                it.final_amount,
            ]
        )
    store.set_status(session_id, SessionStatus.REPORTED)
    return buf.getvalue()
