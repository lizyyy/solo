from __future__ import annotations

import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from typing import Optional


class RecordStatus(Enum):
    IMPORTED = "imported"
    CONSISTENT = "consistent"
    INCONSISTENT = "inconsistent"
    CUSTODY_REVIEWED = "custody_reviewed"
    SUPPLEMENTED = "supplemented"
    COMPLETED = "completed"


class RecordType(Enum):
    SMOOTH = "smooth"
    INCONSISTENT_ABBR = "inconsistent_abbr"
    OLD_STANDARD_SUPPLEMENT = "old_standard_supplement"


@dataclass
class TrailingDiffAdjustment:
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])
    institution_full_name: str = ""
    institution_short_name_imported: str = ""
    institution_short_name_on_file: str = ""
    amount: float = 0.0
    diff_amount: float = 0.0
    status: str = RecordStatus.IMPORTED.value
    record_type: str = RecordType.SMOOTH.value
    note: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M"))
    reviewed_by_risk: bool = False
    reviewed_by_finance: bool = False
    custody_confirmed: bool = False
    supplement_applied: bool = False

    @property
    def has_abbr_mismatch(self) -> bool:
        return self.institution_short_name_imported != self.institution_short_name_on_file

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class CustodyConfirmation:
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])
    adjustment_id: str = ""
    institution_short_name_custody: str = ""
    confirmed_amount: float = 0.0
    confirmed_date: str = ""
    reviewed_by_risk: bool = False
    note: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M"))

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class SupplementRecord:
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])
    adjustment_id: str = ""
    custody_id: str = ""
    old_short_name: str = ""
    new_short_name: str = ""
    old_amount: float = 0.0
    new_amount: float = 0.0
    reason: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M"))

    def to_dict(self) -> dict:
        return asdict(self)


INSTITUTION_REGISTRY = {
    "华融商业保理有限公司": "华融保理",
    "中诚信托有限责任公司": "中诚信托",
    "远东宏信有限公司": "远东宏信",
    "平安证券股份有限公司": "平安证券",
    "招银金融租赁有限公司": "招银租赁",
    "中信保理有限公司": "中信保理",
}


class FactoringRepaymentStore:
    def __init__(self):
        self.adjustments: list[TrailingDiffAdjustment] = []
        self.custody_confirmations: list[CustodyConfirmation] = []
        self.supplement_records: list[SupplementRecord] = []
        self._run_log: list[str] = []

    def _log(self, msg: str):
        ts = datetime.now().strftime("%H:%M:%S")
        self._run_log.append(f"[{ts}] {msg}")

    def get_run_log(self) -> list[str]:
        return list(self._run_log)

    def clear_run_log(self):
        self._run_log.clear()

    def import_adjustments(self, items: list[dict]) -> list[TrailingDiffAdjustment]:
        results = []
        for item in items:
            full_name = item.get("institution_full_name", "")
            short_imported = item.get("institution_short_name_imported", "")
            short_on_file = INSTITUTION_REGISTRY.get(full_name, short_imported)

            adj = TrailingDiffAdjustment(
                institution_full_name=full_name,
                institution_short_name_imported=short_imported,
                institution_short_name_on_file=short_on_file,
                amount=item.get("amount", 0.0),
                diff_amount=item.get("diff_amount", 0.0),
                record_type=item.get("record_type", RecordType.SMOOTH.value),
                note=item.get("note", ""),
            )

            if adj.has_abbr_mismatch:
                adj.status = RecordStatus.INCONSISTENT.value
                self._log(
                    f"导入 {adj.id}: {adj.institution_full_name} "
                    f"简称不一致（导入='{adj.institution_short_name_imported}'，"
                    f"在册='{adj.institution_short_name_on_file}'），"
                    f"标记为待财务复核"
                )
            else:
                adj.status = RecordStatus.CONSISTENT.value
                self._log(
                    f"导入 {adj.id}: {adj.institution_full_name} "
                    f"简称一致('{adj.institution_short_name_on_file}')，顺畅通过"
                )

            self.adjustments.append(adj)
            results.append(adj)
        return results

    def get_adjustment(self, adj_id: str) -> Optional[TrailingDiffAdjustment]:
        for a in self.adjustments:
            if a.id == adj_id:
                return a
        return None

    def review_custody_confirmation(
        self,
        adj_id: str,
        custody_short_name: str,
        confirmed_amount: float,
        confirmed_date: str,
        note: str = "",
    ) -> Optional[tuple[CustodyConfirmation, TrailingDiffAdjustment]]:
        adj = self.get_adjustment(adj_id)
        if adj is None:
            return None

        cc = CustodyConfirmation(
            adjustment_id=adj_id,
            institution_short_name_custody=custody_short_name,
            confirmed_amount=confirmed_amount,
            confirmed_date=confirmed_date,
            reviewed_by_risk=True,
            note=note,
        )
        self.custody_confirmations.append(cc)

        old_status = adj.status
        adj.status = RecordStatus.CUSTODY_REVIEWED.value
        adj.custody_confirmed = True
        adj.reviewed_by_risk = True

        self._log(
            f"托管确认 {adj.id}: 风控值班已审阅，"
            f"托管页简称='{custody_short_name}'，"
            f"确认金额={confirmed_amount:.2f}，"
            f"状态从 {old_status} 变更为 custody_reviewed"
        )

        return cc, adj

    def apply_supplement(
        self,
        adj_id: str,
        custody_id: str,
        new_short_name: str,
        new_amount: float,
        reason: str = "",
    ) -> Optional[tuple[SupplementRecord, TrailingDiffAdjustment]]:
        adj = self.get_adjustment(adj_id)
        if adj is None:
            return None

        cc = None
        for c in self.custody_confirmations:
            if c.id == custody_id:
                cc = c
                break
        if cc is None:
            return None

        sr = SupplementRecord(
            adjustment_id=adj_id,
            custody_id=custody_id,
            old_short_name=adj.institution_short_name_imported,
            new_short_name=new_short_name,
            old_amount=adj.amount,
            new_amount=new_amount,
            reason=reason,
        )
        self.supplement_records.append(sr)

        old_short = adj.institution_short_name_imported
        adj.institution_short_name_imported = new_short_name
        adj.amount = new_amount
        adj.diff_amount = new_amount - adj.amount if new_short_name == old_short else adj.diff_amount
        adj.status = RecordStatus.SUPPLEMENTED.value
        adj.supplement_applied = True

        self._log(
            f"补录更新 {adj.id}: 简称从 '{old_short}' 更正为 '{new_short_name}'，"
            f"金额从 {sr.old_amount:.2f} 更正为 {new_amount:.2f}，"
            f"原因：{reason or '托管确认页补录'}"
        )

        return sr, adj

    def finance_review(self, adj_id: str) -> Optional[TrailingDiffAdjustment]:
        adj = self.get_adjustment(adj_id)
        if adj is None:
            return None
        if adj.status not in (
            RecordStatus.INCONSISTENT.value,
            RecordStatus.CUSTODY_REVIEWED.value,
            RecordStatus.SUPPLEMENTED.value,
        ):
            return None

        adj.reviewed_by_finance = True
        adj.status = RecordStatus.COMPLETED.value
        self._log(
            f"财务复核 {adj.id}: 通过，状态变更为 completed"
        )
        return adj

    def rerun(self, adj_id: str) -> Optional[TrailingDiffAdjustment]:
        adj = self.get_adjustment(adj_id)
        if adj is None:
            return None

        if adj.supplement_applied:
            adj.institution_short_name_on_file = adj.institution_short_name_imported

        if adj.has_abbr_mismatch:
            adj.status = RecordStatus.INCONSISTENT.value
            self._log(
                f"重跑 {adj.id}: 仍存在简称不一致"
                f"（导入='{adj.institution_short_name_imported}'，"
                f"在册='{adj.institution_short_name_on_file}'），"
                f"仍需财务复核"
            )
        else:
            adj.status = RecordStatus.CONSISTENT.value
            self._log(
                f"重跑 {adj.id}: 简称一致，顺畅通过"
            )

        return adj

    def summary(self) -> dict:
        total = len(self.adjustments)
        by_status = {}
        for a in self.adjustments:
            by_status.setdefault(a.status, 0)
            by_status[a.status] += 1
        return {
            "total_adjustments": total,
            "total_custody_confirmations": len(self.custody_confirmations),
            "total_supplement_records": len(self.supplement_records),
            "by_status": by_status,
        }


def build_demo_store() -> FactoringRepaymentStore:
    store = FactoringRepaymentStore()
    store.clear_run_log()

    store._log("=== 演示数据初始化 ===")

    smooth_items = [
        {
            "institution_full_name": "华融商业保理有限公司",
            "institution_short_name_imported": "华融保理",
            "amount": 1500000.00,
            "diff_amount": 0.35,
            "record_type": RecordType.SMOOTH.value,
            "note": "正常回款，尾差0.35元，简称匹配",
        }
    ]
    inconsistent_items = [
        {
            "institution_full_name": "中信保理有限公司",
            "institution_short_name_imported": "中信商业保理",
            "amount": 2300000.00,
            "diff_amount": -0.72,
            "record_type": RecordType.INCONSISTENT_ABBR.value,
            "note": "导入简称与在册不一致，需财务复核",
        }
    ]
    old_standard_items = [
        {
            "institution_full_name": "远东宏信有限公司",
            "institution_short_name_imported": "远东租赁",
            "amount": 980000.00,
            "diff_amount": 0.18,
            "record_type": RecordType.OLD_STANDARD_SUPPLEMENT.value,
            "note": "旧口径导入，简称用旧称，待托管确认页补录",
        }
    ]

    store._log("--- 导入顺利记录 ---")
    store.import_adjustments(smooth_items)

    store._log("--- 导入机构简称不一致记录 ---")
    store.import_adjustments(inconsistent_items)

    store._log("--- 导入旧口径补录记录 ---")
    store.import_adjustments(old_standard_items)

    store._log("=== 演示数据初始化完成 ===")

    return store
