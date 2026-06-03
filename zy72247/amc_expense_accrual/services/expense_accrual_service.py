import copy
import csv
import io
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from ..models.accrual import AccrualLine, AccrualResult
from ..models.diff_list import DiffItem, DiffList, DiffListVersion
from ..models.evidence import (
    EvidenceRecord,
    EvidenceSource,
    ManualChange,
    ProcessingStatus,
    ScreenshotEvidence,
    TaxNoteEvidence,
)
from .split_line_detector import SplitLineDetector, SPLIT_LINE_BOUNDARY


class ExpenseAccrualService:
    def __init__(self, storage_dir: Optional[str] = None):
        self._records: Dict[str, EvidenceRecord] = {}
        self._diff_list = DiffList()
        self._accrual_result = AccrualResult()
        self._detector = SplitLineDetector()
        self._storage_dir = Path(storage_dir) if storage_dir else Path.cwd() / "data"
        self._storage_dir.mkdir(parents=True, exist_ok=True)

    def import_screenshot_evidence(
        self, screenshot_rows: List[Dict[str, Any]], operator: str = "system"
    ) -> List[EvidenceRecord]:
        new_records: List[EvidenceRecord] = []
        for row in screenshot_rows:
            evidence = ScreenshotEvidence(
                original_line_number=row.get("original_line_number", 0),
                ex_rights_date=row.get("ex_rights_date", ""),
                business_no=row.get("business_no", ""),
                amount=float(row.get("amount", 0)),
                line_type=row.get("line_type", ""),
                raw_text=row.get("raw_text", ""),
            )
            record = EvidenceRecord(
                business_no=evidence.business_no,
                screenshot_evidence=evidence,
                status=ProcessingStatus.PENDING_REVIEW,
            )
            self._records[record.record_id] = record
            new_records.append(record)

        self._detect_split_lines()
        self._rebuild_accrual_result()
        self._rebuild_diff_list(trigger="screenshot_import", operator=operator)

        self._persist()
        return new_records

    def review_tax_note_evidence(
        self, tax_notes: List[Dict[str, Any]], operator: str = "system"
    ) -> List[EvidenceRecord]:
        updated_records: List[EvidenceRecord] = []

        for note in tax_notes:
            biz_no = note.get("business_no", "")
            matching = [
                r for r in self._records.values() if r.business_no == biz_no
            ]
            tax_evidence = TaxNoteEvidence(
                tax_rate=float(note.get("tax_rate", 0)),
                note_text=note.get("note_text", ""),
                business_no=biz_no,
                stated_by=note.get("stated_by", ""),
                stated_date=note.get("stated_date", ""),
            )

            if matching:
                for record in matching:
                    record.tax_note_evidence = tax_evidence
                    if record.status != ProcessingStatus.SPLIT_LINE_PENDING_SUPERVISOR:
                        record.status = ProcessingStatus.CONFIRMED
                    record.updated_at = datetime.now().isoformat()
                    updated_records.append(record)
            else:
                record = EvidenceRecord(
                    business_no=biz_no,
                    tax_note_evidence=tax_evidence,
                    status=ProcessingStatus.PENDING_REVIEW,
                )
                self._records[record.record_id] = record
                updated_records.append(record)

        self._rebuild_accrual_result()
        self._rebuild_diff_list(trigger="tax_note_review", operator=operator)

        self._persist()
        return updated_records

    def update_diff_list(self, operator: str = "system") -> DiffListVersion:
        version = self._rebuild_diff_list(
            trigger="diff_list_update", operator=operator
        )
        self._persist()
        return version

    def rollback_diff_list(
        self, target_version: int, operator: str = "system"
    ) -> Optional[DiffListVersion]:
        rolled = self._diff_list.rollback(target_version)
        if rolled:
            self._sync_records_from_diff_list(rolled)
            self._rebuild_accrual_result()
            self._persist()
        return rolled

    def withdraw_tax_note(
        self, business_no: str, reason: str, operator: str = "system"
    ) -> Optional[DiffListVersion]:
        current_items = self._diff_list._current_items()
        biz_items = [i for i in current_items if i.business_no == business_no]
        if not biz_items:
            return None

        for record in self._records.values():
            if record.business_no == business_no and record.tax_note_evidence:
                change = ManualChange(
                    changed_by=operator,
                    changed_at=datetime.now().isoformat(),
                    field_name="tax_note_evidence",
                    old_value=record.tax_note_evidence.to_dict(),
                    new_value=None,
                    reason=reason,
                )
                record.manual_changes.append(change)
                record.tax_note_evidence = None
                record.status = ProcessingStatus.ROLLED_BACK
                record.updated_at = datetime.now().isoformat()

        self._rebuild_accrual_result()
        new_version = self._rebuild_diff_list(
            trigger="withdraw_tax_note", operator=operator
        )
        self._persist()
        return new_version

    def apply_manual_change(
        self,
        record_id: str,
        field_name: str,
        new_value: Any,
        reason: str,
        operator: str,
    ) -> Optional[EvidenceRecord]:
        record = self._records.get(record_id)
        if not record:
            return None

        old_value = getattr(record, field_name, None)
        if isinstance(old_value, ProcessingStatus):
            old_value = old_value.value
        change = ManualChange(
            changed_by=operator,
            changed_at=datetime.now().isoformat(),
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            reason=reason,
        )
        record.manual_changes.append(change)

        if field_name == "status":
            try:
                record.status = ProcessingStatus(new_value)
            except ValueError:
                record.status = ProcessingStatus.MODIFIED
        else:
            setattr(record, field_name, new_value)
            record.status = ProcessingStatus.MODIFIED

        record.updated_at = datetime.now().isoformat()
        self._rebuild_accrual_result()
        self._rebuild_diff_list(trigger="manual_change", operator=operator)
        self._persist()
        return record

    def get_evidence_record(self, record_id: str) -> Optional[EvidenceRecord]:
        return self._records.get(record_id)

    def get_all_records(self) -> List[EvidenceRecord]:
        return list(self._records.values())

    def get_records_by_business_no(self, business_no: str) -> List[EvidenceRecord]:
        return [r for r in self._records.values() if r.business_no == business_no]

    def get_accrual_result(self) -> AccrualResult:
        return self._accrual_result

    def get_diff_list(self) -> DiffList:
        return self._diff_list

    def get_diff_list_version(self, version: int) -> Optional[DiffListVersion]:
        for v in self._diff_list.versions:
            if v.version == version:
                return v
        return None

    def export_details_csv(self) -> str:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "record_id", "business_no", "status",
            "screenshot_line_no", "ex_rights_date", "screenshot_amount",
            "screenshot_line_type", "screenshot_raw_text",
            "tax_rate", "tax_note_text", "tax_note_stated_by", "tax_note_stated_date",
            "is_split_line", "split_line_role",
            "manual_changes_count", "created_at", "updated_at",
        ])
        for r in self._records.values():
            se = r.screenshot_evidence
            tn = r.tax_note_evidence
            writer.writerow([
                r.record_id,
                r.business_no,
                r.status.value,
                se.original_line_number if se else "",
                se.ex_rights_date if se else "",
                se.amount if se else "",
                se.line_type if se else "",
                se.raw_text if se else "",
                tn.tax_rate if tn else "",
                tn.note_text if tn else "",
                tn.stated_by if tn else "",
                tn.stated_date if tn else "",
                r.is_split_line,
                r.split_line_role,
                len(r.manual_changes),
                r.created_at,
                r.updated_at,
            ])
        return output.getvalue()

    def export_accrual_csv(self) -> str:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "line_id", "business_no", "line_type", "amount",
            "tax_rate", "tax_amount", "net_amount",
            "is_split_line", "split_line_role", "evidence_status",
        ])
        for line in self._accrual_result.lines:
            writer.writerow([
                line.line_id,
                line.business_no,
                line.line_type,
                line.amount,
                line.tax_rate,
                line.tax_amount,
                line.net_amount,
                line.is_split_line,
                line.split_line_role,
                line.evidence.status.value if line.evidence else "",
            ])
        return output.getvalue()

    def _detect_split_lines(self):
        by_biz: Dict[str, List[dict]] = {}
        for record in self._records.values():
            if record.screenshot_evidence:
                se = record.screenshot_evidence
                row = {
                    "record_id": record.record_id,
                    "line_type": se.line_type,
                    "amount": se.amount,
                    "is_split_line": record.is_split_line,
                    "split_line_role": record.split_line_role,
                    "status": record.status.value,
                }
                by_biz.setdefault(record.business_no, []).append(row)

        detected = self._detector.detect(by_biz)

        for biz_no, rows in detected.items():
            for row in rows:
                rid = row["record_id"]
                if rid in self._records:
                    self._records[rid].is_split_line = row["is_split_line"]
                    self._records[rid].split_line_role = row["split_line_role"]
                    if row.get("status") == "split_line_pending_supervisor":
                        self._records[rid].status = ProcessingStatus.SPLIT_LINE_PENDING_SUPERVISOR

    def _rebuild_accrual_result(self):
        self._accrual_result.lines.clear()
        for record in self._records.values():
            line = AccrualLine(
                business_no=record.business_no,
                is_split_line=record.is_split_line,
                split_line_role=record.split_line_role,
                evidence=record,
            )
            if record.screenshot_evidence:
                se = record.screenshot_evidence
                line.line_type = se.line_type
                line.amount = se.amount
            if record.tax_note_evidence:
                tn = record.tax_note_evidence
                line.tax_rate = tn.tax_rate
                line.tax_amount = round(line.amount * tn.tax_rate, 2)
                line.net_amount = round(line.amount - line.tax_amount, 2)
            self._accrual_result.lines.append(line)
        self._accrual_result.updated_at = datetime.now().isoformat()

    def _rebuild_diff_list(
        self, trigger: str, operator: str
    ) -> DiffListVersion:
        items: List[DiffItem] = []
        by_biz: Dict[str, List[EvidenceRecord]] = {}
        for r in self._records.values():
            by_biz.setdefault(r.business_no, []).append(r)

        for biz_no, records in by_biz.items():
            screenshot_total = sum(
                r.screenshot_evidence.amount
                for r in records
                if r.screenshot_evidence
            )
            tax_total = sum(
                r.tax_note_evidence.tax_rate * r.screenshot_evidence.amount
                for r in records
                if r.screenshot_evidence and r.tax_note_evidence
            )
            diff_amount = abs(screenshot_total - tax_total)
            needs_review = any(
                r.status == ProcessingStatus.SPLIT_LINE_PENDING_SUPERVISOR
                for r in records
            )
            review_reason = ""
            if needs_review:
                split_records = [r for r in records if r.is_split_line]
                review_reason = self._detector.explain_judgment(
                    biz_no,
                    [
                        {
                            "line_type": r.screenshot_evidence.line_type if r.screenshot_evidence else "",
                            "amount": r.screenshot_evidence.amount if r.screenshot_evidence else 0,
                        }
                        for r in split_records
                    ],
                )

            items.append(
                DiffItem(
                    business_no=biz_no,
                    expected_amount=screenshot_total,
                    actual_amount=tax_total,
                    diff_amount=diff_amount,
                    diff_type="split_line_review" if needs_review else "normal",
                    evidence_records=records,
                    needs_supervisor_review=needs_review,
                    supervisor_review_reason=review_reason,
                )
            )

        return self._diff_list.commit(items, trigger=trigger, operator=operator)

    def _sync_records_from_diff_list(self, version: DiffListVersion):
        for item in version.items:
            for ev_record in item.evidence_records:
                if ev_record.record_id in self._records:
                    existing = self._records[ev_record.record_id]
                    existing.status = ProcessingStatus.ROLLED_BACK
                    existing.updated_at = datetime.now().isoformat()

    def _persist(self):
        data = {
            "records": {rid: r.to_dict() for rid, r in self._records.items()},
            "diff_list": self._diff_list.to_dict(),
            "accrual_result": self._accrual_result.to_dict(),
        }
        path = self._storage_dir / "expense_accrual_state.json"
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    def load_state(self) -> bool:
        path = self._storage_dir / "expense_accrual_state.json"
        if not path.exists():
            return False
        data = json.loads(path.read_text(encoding="utf-8"))
        self._records.clear()
        for rid, rdict in data.get("records", {}).items():
            record = self._dict_to_record(rdict)
            self._records[rid] = record
        dldict = data.get("diff_list", {})
        self._diff_list = self._dict_to_diff_list(dldict)
        ardict = data.get("accrual_result", {})
        self._accrual_result = self._dict_to_accrual_result(ardict)
        return True

    def _dict_to_record(self, d: dict) -> EvidenceRecord:
        se = None
        if d.get("screenshot_evidence"):
            se_dict = d["screenshot_evidence"]
            se = ScreenshotEvidence(
                original_line_number=se_dict["original_line_number"],
                ex_rights_date=se_dict["ex_rights_date"],
                business_no=se_dict["business_no"],
                amount=se_dict["amount"],
                line_type=se_dict["line_type"],
                raw_text=se_dict["raw_text"],
            )
        tn = None
        if d.get("tax_note_evidence"):
            tn_dict = d["tax_note_evidence"]
            tn = TaxNoteEvidence(
                tax_rate=tn_dict["tax_rate"],
                note_text=tn_dict["note_text"],
                business_no=tn_dict["business_no"],
                stated_by=tn_dict["stated_by"],
                stated_date=tn_dict["stated_date"],
            )
        changes = []
        for cd in d.get("manual_changes", []):
            changes.append(
                ManualChange(
                    changed_by=cd["changed_by"],
                    changed_at=cd["changed_at"],
                    field_name=cd["field_name"],
                    old_value=cd["old_value"],
                    new_value=cd["new_value"],
                    reason=cd["reason"],
                )
            )
        return EvidenceRecord(
            record_id=d["record_id"],
            business_no=d["business_no"],
            screenshot_evidence=se,
            tax_note_evidence=tn,
            status=ProcessingStatus(d["status"]),
            manual_changes=changes,
            is_split_line=d.get("is_split_line", False),
            split_line_role=d.get("split_line_role", ""),
            created_at=d["created_at"],
            updated_at=d["updated_at"],
        )

    def _dict_to_diff_list(self, d: dict) -> DiffList:
        dl = DiffList(diff_list_id=d.get("diff_list_id", ""))
        dl.current_version = d.get("current_version", 0)
        for vdict in d.get("versions", []):
            items = []
            for idict in vdict.get("items", []):
                ev_records = []
                for erdict in idict.get("evidence_records", []):
                    ev_records.append(self._dict_to_record(erdict))
                items.append(
                    DiffItem(
                        business_no=idict["business_no"],
                        expected_amount=idict["expected_amount"],
                        actual_amount=idict["actual_amount"],
                        diff_amount=idict["diff_amount"],
                        diff_type=idict["diff_type"],
                        evidence_records=ev_records,
                        needs_supervisor_review=idict.get("needs_supervisor_review", False),
                        supervisor_review_reason=idict.get("supervisor_review_reason", ""),
                    )
                )
            dl.versions.append(
                DiffListVersion(
                    version=vdict["version"],
                    items=items,
                    snapshot=vdict["snapshot"],
                    trigger=vdict["trigger"],
                    operator=vdict["operator"],
                )
            )
        return dl

    def _dict_to_accrual_result(self, d: dict) -> AccrualResult:
        ar = AccrualResult(
            result_id=d.get("result_id", ""),
            plan_name=d.get("plan_name", ""),
            accrual_date=d.get("accrual_date", ""),
            created_at=d.get("created_at", ""),
            updated_at=d.get("updated_at", ""),
        )
        for ldict in d.get("lines", []):
            evidence = None
            if ldict.get("evidence"):
                evidence = self._dict_to_record(ldict["evidence"])
            ar.lines.append(
                AccrualLine(
                    line_id=ldict.get("line_id", ""),
                    business_no=ldict.get("business_no", ""),
                    line_type=ldict.get("line_type", ""),
                    amount=ldict.get("amount", 0),
                    tax_rate=ldict.get("tax_rate", 0),
                    tax_amount=ldict.get("tax_amount", 0),
                    net_amount=ldict.get("net_amount", 0),
                    evidence=evidence,
                    is_split_line=ldict.get("is_split_line", False),
                    split_line_role=ldict.get("split_line_role", ""),
                )
            )
        return ar
