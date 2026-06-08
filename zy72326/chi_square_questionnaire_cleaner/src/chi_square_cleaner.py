import csv
import hashlib
from typing import Optional
from .evidence import EvidenceChain, ProcessingStatus
from .result_store import ResultStore


ANOMALY_DENOMINATOR_ZERO_EMPTY = "denominator_zero_empty_string"
ANOMALY_DUPLICATE_IMPORT = "duplicate_import"
ANOMALY_NEGATIVE_COUNT = "negative_count"
ANOMALY_NON_NUMERIC = "non_numeric"


class ChiSquareCleaner:
    def __init__(self, evidence: EvidenceChain, store: ResultStore):
        self.evidence = evidence
        self.store = store
        self._imported_hashes: set[str] = set()
        self._raw_rows: list[dict] = []
        self._denominator_fields: list[str] = []
        self._count_fields: list[str] = []

    def configure(self, denominator_fields: list[str], count_fields: list[str]):
        self._denominator_fields = denominator_fields
        self._count_fields = count_fields

    def import_csv(self, filepath: str, encoding: str = "utf-8") -> dict:
        rows = []
        with open(filepath, encoding=encoding, newline="") as f:
            reader = csv.DictReader(f)
            for i, row in enumerate(reader, start=2):
                row["_original_row"] = i
                rows.append(row)
        self._raw_rows = rows
        return self._detect_and_clean(rows)

    def import_rows(self, rows: list[dict], start_row: int = 2) -> dict:
        indexed_rows = []
        for i, row in enumerate(rows):
            row = dict(row)
            row["_original_row"] = row.get("_original_row", start_row + i)
            indexed_rows.append(row)
        self._raw_rows = indexed_rows
        return self._detect_and_clean(indexed_rows)

    def _row_hash(self, row: dict) -> str:
        keys = sorted(k for k in row.keys() if k != "_original_row")
        payload = "|".join(f"{k}={row.get(k, '')}" for k in keys)
        return hashlib.md5(payload.encode()).hexdigest()

    def _detect_and_clean(self, rows: list[dict]) -> dict:
        cleaned = []
        anomaly = []
        dup_count = 0
        denom_zero_empty_count = 0

        for row in rows:
            original_row = row.get("_original_row", "?")
            rh = self._row_hash(row)

            if rh in self._imported_hashes:
                dup_count += 1
                self.evidence.add(
                    original_row=original_row,
                    field_name="_row",
                    original_value=str(row),
                    anomaly_type=ANOMALY_DUPLICATE_IMPORT,
                    detail=f"Row content hash {rh} already imported, skipping duplicate",
                    status=ProcessingStatus.AUTO_FLAGGED,
                )
                continue
            self._imported_hashes.add(rh)

            is_anomaly = False
            for denom_field in self._denominator_fields:
                val = row.get(denom_field, "").strip()
                if val == "":
                    try:
                        total = sum(
                            int(row.get(cf, "0").strip() or "0")
                            for cf in self._count_fields
                        )
                    except ValueError:
                        total = -1
                    if total == 0:
                        is_anomaly = True
                        denom_zero_empty_count += 1
                        self.evidence.add(
                            original_row=original_row,
                            field_name=denom_field,
                            original_value="",
                            anomaly_type=ANOMALY_DENOMINATOR_ZERO_EMPTY,
                            detail=f"Denominator field '{denom_field}' is empty string but count fields sum to 0; flagged for reviewer",
                            status=ProcessingStatus.PENDING_REVIEW,
                        )
                        row["_anomaly"] = ANOMALY_DENOMINATOR_ZERO_EMPTY
                        row["_anomaly_field"] = denom_field

            for field in self._denominator_fields + self._count_fields:
                val = row.get(field, "").strip()
                if val != "" and val not in ("0", "0.0"):
                    try:
                        int(val)
                    except ValueError:
                        try:
                            float(val)
                        except ValueError:
                            self.evidence.add(
                                original_row=original_row,
                                field_name=field,
                                original_value=val,
                                anomaly_type=ANOMALY_NON_NUMERIC,
                                detail=f"Field '{field}' value '{val}' is not numeric",
                                status=ProcessingStatus.AUTO_FLAGGED,
                            )
                            if not is_anomaly:
                                is_anomaly = True
                                row["_anomaly"] = ANOMALY_NON_NUMERIC
                                row["_anomaly_field"] = field

            if is_anomaly:
                anomaly.append(dict(row))
            else:
                for denom_field in self._denominator_fields:
                    val = row.get(denom_field, "").strip()
                    if val == "":
                        count_sum = sum(
                            int(row.get(cf, "0").strip() or "0")
                            for cf in self._count_fields
                        )
                        row[denom_field] = str(count_sum)
                cleaned.append(dict(row))

        result = {
            "total_raw": len(rows),
            "cleaned_count": len(cleaned),
            "anomaly_count": len(anomaly),
            "duplicate_count": dup_count,
            "denominator_zero_empty_count": denom_zero_empty_count,
        }
        self.store.set_cleaned_rows(cleaned)
        self.store.set_anomaly_rows(anomaly)
        self.store.set_summary(result)
        return result

    def supplement_row(self, evidence_id: str, new_values: dict, evidence: EvidenceChain, supplemented_by: str = "") -> dict:
        rec = evidence.get_by_id(evidence_id)
        if rec is None:
            return {"error": f"Evidence {evidence_id} not found"}

        anomaly_rows = self.store.get_anomaly_rows()
        target_row = None
        idx = None
        for i, row in enumerate(anomaly_rows):
            if row.get("_original_row") == rec.original_row:
                target_row = dict(row)
                idx = i
                break

        cleaned_rows = self.store.get_cleaned_rows()
        if target_row is None:
            for i, row in enumerate(cleaned_rows):
                if row.get("_original_row") == rec.original_row:
                    target_row = dict(row)
                    break

        if target_row is None:
            return {"error": f"Row with original_row={rec.original_row} not found in store"}

        target_row["_supplemented"] = "1"
        for k, v in new_values.items():
            target_row[k] = str(v)

        evidence.update_status(
            evidence_id,
            ProcessingStatus.SUPPLEMENTED,
            manual_change=f"Supplemented fields: {list(new_values.keys())} with values {new_values}",
            supplemented_by=supplemented_by or "unknown",
            supplemented_values=dict(new_values),
            next_step="交由数据复核人（通常为组长）复核确认，确认无误后移入正常结果",
        )

        if idx is not None:
            anomaly_rows[idx] = target_row
            self.store.set_anomaly_rows(anomaly_rows)
        else:
            anomaly_rows.append(target_row)
            new_cleaned = [r for r in cleaned_rows if r.get("_original_row") != rec.original_row]
            self.store.set_cleaned_rows(new_cleaned)
            self.store.set_anomaly_rows(anomaly_rows)

        self._recalculate_chi_square()
        return {"status": "supplemented_pending_review", "evidence_id": evidence_id, "original_row": rec.original_row}

    def reviewer_confirm_move(self, evidence_id: str, confirmed_normal: bool, evidence: EvidenceChain, reviewer: str = "", review_reason: str = "") -> dict:
        rec = evidence.get_by_id(evidence_id)
        if rec is None:
            return {"error": f"Evidence {evidence_id} not found"}
        if rec.current_status not in (
            ProcessingStatus.SUPPLEMENTED,
            ProcessingStatus.PENDING_REVIEW,
            ProcessingStatus.AUTO_FLAGGED,
        ):
            return {"error": f"Evidence {evidence_id} status is {rec.current_status.value}, not reviewable"}

        anomaly_rows = self.store.get_anomaly_rows()
        cleaned_rows = self.store.get_cleaned_rows()

        target_row = None
        idx = None
        for i, row in enumerate(anomaly_rows):
            if row.get("_original_row") == rec.original_row:
                target_row = dict(row)
                idx = i
                break

        if target_row is None:
            return {"error": f"Anomaly row original_row={rec.original_row} not found"}

        if confirmed_normal:
            target_row.pop("_anomaly", None)
            target_row.pop("_anomaly_field", None)
            target_row.pop("_review_reason", None)
            target_row["_reviewer"] = reviewer or "unknown"
            target_row["_review_status"] = "confirmed_normal"
            cleaned_rows.append(target_row)
            del anomaly_rows[idx]
            self.store.set_cleaned_rows(cleaned_rows)
            self.store.set_anomaly_rows(anomaly_rows)
            evidence.update_status(
                evidence_id,
                ProcessingStatus.CONFIRMED_NORMAL,
                reviewer=reviewer or "unknown",
                review_reason=review_reason or f"复核人确认数据正常，移入卡方计算正常结果",
                next_step="已归入正常结果，参与卡方检验",
                corrected_value=target_row.get(rec.field_name),
            )
        else:
            target_row["_review_status"] = "confirmed_anomaly"
            target_row["_reviewer"] = reviewer or "unknown"
            target_row["_review_reason"] = review_reason or f"复核人确认仍为异常，从正常结果中排除"
            anomaly_rows[idx] = target_row
            self.store.set_anomaly_rows(anomaly_rows)
            evidence.update_status(
                evidence_id,
                ProcessingStatus.CONFIRMED_ANOMALY,
                reviewer=reviewer or "unknown",
                review_reason=review_reason or f"复核人确认仍为异常，不参与卡方计算",
                next_step="该条记录保留在异常区，不进入卡方检验；如需修正请重新补录并再复核",
                corrected_value=None,
            )

        self._recalculate_chi_square()
        return {
            "status": "ok",
            "evidence_id": evidence_id,
            "new_status": (ProcessingStatus.CONFIRMED_NORMAL if confirmed_normal else ProcessingStatus.CONFIRMED_ANOMALY).value,
        }

    def _recalculate_chi_square(self):
        cleaned = self.store.get_cleaned_rows()
        if not cleaned or not self._count_fields:
            return

        from .self_check import compute_chi_square
        result = compute_chi_square(cleaned, self._count_fields)
        self.store.set_chi_square_result(result)

        summary = self.store.get_summary()
        summary["chi_square"] = result
        self.store.set_summary(summary)

    def view_original_row(self, original_row: int) -> Optional[dict]:
        for row in self._raw_rows:
            if row.get("_original_row") == original_row:
                return dict(row)
        return None

    def list_anomaly_rows_for_review(self) -> list[dict]:
        anomaly = self.store.get_anomaly_rows()
        pending = self.evidence.pending_review_records()
        pending_rows = {r.original_row for r in pending}
        return [r for r in anomaly if r.get("_original_row") in pending_rows]
