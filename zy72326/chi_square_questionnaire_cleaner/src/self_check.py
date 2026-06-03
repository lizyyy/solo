import math
from .result_store import ResultStore
from .evidence import EvidenceChain, ProcessingStatus
from .chi_square_cleaner import ANOMALY_DENOMINATOR_ZERO_EMPTY, ANOMALY_DUPLICATE_IMPORT


def compute_chi_square(rows: list[dict], count_fields: list[str]) -> dict:
    if not rows or not count_fields:
        return {"chi_square": None, "df": None, "p_value": None, "error": "no data"}

    try:
        observed = []
        for row in rows:
            row_obs = []
            for cf in count_fields:
                val = row.get(cf, "0").strip() or "0"
                row_obs.append(float(val))
            observed.append(row_obs)
    except (ValueError, TypeError) as e:
        return {"chi_square": None, "df": None, "p_value": None, "error": str(e)}

    n_rows = len(observed)
    n_cols = len(count_fields)
    if n_rows < 2 or n_cols < 2:
        return {"chi_square": None, "df": None, "p_value": None, "error": "need at least 2x2"}

    row_totals = [sum(r) for r in observed]
    col_totals = [sum(observed[r][c] for r in range(n_rows)) for c in range(n_cols)]
    grand_total = sum(row_totals)

    if grand_total == 0:
        return {"chi_square": None, "df": None, "p_value": None, "error": "grand total is 0"}

    chi_sq = 0.0
    for r in range(n_rows):
        for c in range(n_cols):
            expected = (row_totals[r] * col_totals[c]) / grand_total
            if expected > 0:
                chi_sq += (observed[r][c] - expected) ** 2 / expected

    df = (n_rows - 1) * (n_cols - 1)
    try:
        from math import gamma
        p_value = 1 - _chi2_cdf(chi_sq, df)
    except Exception:
        p_value = None

    return {
        "chi_square": round(chi_sq, 6),
        "df": df,
        "p_value": round(p_value, 6) if p_value is not None else None,
        "error": None,
        "row_totals": row_totals,
        "col_totals": col_totals,
        "grand_total": grand_total,
    }


def _chi2_cdf(x: float, df: int) -> float:
    if df == 2:
        return 1 - math.exp(-x / 2)
    return _regularized_gamma_lower(df / 2, x / 2)


def _regularized_gamma_lower(a: float, x: float) -> float:
    if x < a + 1:
        return _gamma_series(a, x)
    else:
        return 1 - _gamma_cf(a, x)


def _gamma_series(a: float, x: float) -> float:
    term = 1.0 / a
    total = term
    for _ in range(200):
        term *= x / (a + _ + 1)
        total += term
        if abs(term) < abs(total) * 1e-12:
            break
    return total * math.exp(-x + a * math.log(x) - math.lgamma(a))


def _gamma_cf(a: float, x: float) -> float:
    b = x + 1 - a
    c = 1e30
    d = 1.0 / b
    h = d
    for i in range(1, 200):
        an = -i * (i - a)
        b += 2
        d = an * d + b
        if abs(d) < 1e-30:
            d = 1e-30
        c = b + an / c
        if abs(c) < 1e-30:
            c = 1e-30
        d = 1.0 / d
        delta = d * c
        h *= delta
        if abs(delta - 1) < 1e-12:
            break
    return math.exp(-x + a * math.log(x) - math.lgamma(a)) * h


class SelfChecker:
    def __init__(self, store: ResultStore, evidence: EvidenceChain):
        self.store = store
        self.evidence = evidence

    def run_all(self) -> list[dict]:
        results = [
            self.check_duplicate_import(),
            self.check_denominator_zero_empty_string(),
            self.check_supplement_rerun(),
            self.check_export_consistency(),
        ]
        return results

    def check_duplicate_import(self) -> dict:
        dup_records = self.evidence.get_by_anomaly_type(ANOMALY_DUPLICATE_IMPORT)
        dup_count = len(dup_records)
        status = "PASS" if dup_count == 0 else "FAIL"
        detail = f"Found {dup_count} duplicate import(s)" if dup_count > 0 else "No duplicate imports"
        return {
            "check": "duplicate_import",
            "status": status,
            "detail": detail,
            "evidence_ids": [r.evidence_id for r in dup_records],
        }

    def check_denominator_zero_empty_string(self) -> dict:
        dz_records = self.evidence.get_by_anomaly_type(ANOMALY_DENOMINATOR_ZERO_EMPTY)
        pending = [r for r in dz_records if r.current_status in (ProcessingStatus.PENDING_REVIEW, ProcessingStatus.AUTO_FLAGGED)]
        confirmed = [r for r in dz_records if r.current_status == ProcessingStatus.CONFIRMED_ANOMALY]
        supplemented = [r for r in dz_records if r.current_status == ProcessingStatus.SUPPLEMENTED]

        anomaly_rows = self.store.get_anomaly_rows()
        dz_in_anomaly = [r for r in anomaly_rows if r.get("_anomaly") == ANOMALY_DENOMINATOR_ZERO_EMPTY]
        dz_ids_in_anomaly = {r.get("_original_row") for r in dz_in_anomaly}
        pending_ids = {r.original_row for r in pending + confirmed}
        missing_from_anomaly = pending_ids - dz_ids_in_anomaly
        extra_in_anomaly = dz_ids_in_anomaly - pending_ids - {r.original_row for r in supplemented}

        if missing_from_anomaly or extra_in_anomaly:
            status = "FAIL"
            detail = f"Inconsistency: missing from anomaly store={missing_from_anomaly}, extra={extra_in_anomaly}"
        elif len(pending) > 0:
            status = "WARN"
            detail = f"{len(pending)} denominator-zero-empty-string record(s) pending review, {len(confirmed)} confirmed, {len(supplemented)} supplemented"
        else:
            status = "PASS"
            detail = f"All {len(dz_records)} denominator-zero-empty-string records resolved ({len(supplemented)} supplemented, {len(confirmed)} confirmed)"

        return {
            "check": "denominator_zero_empty_string",
            "status": status,
            "detail": detail,
            "pending_count": len(pending),
            "confirmed_count": len(confirmed),
            "supplemented_count": len(supplemented),
            "evidence_ids": [r.evidence_id for r in dz_records],
        }

    def check_supplement_rerun(self) -> dict:
        supplemented = self.evidence.get_by_status(ProcessingStatus.SUPPLEMENTED)
        chi_result = self.store.get_chi_square_result()

        if not supplemented:
            return {
                "check": "supplement_rerun",
                "status": "PASS",
                "detail": "No supplemented records, no recalculation needed",
            }

        if chi_result is None:
            return {
                "check": "supplement_rerun",
                "status": "FAIL",
                "detail": f"{len(supplemented)} record(s) supplemented but chi-square not recalculated",
                "evidence_ids": [r.evidence_id for r in supplemented],
            }

        anomaly_rows = self.store.get_anomaly_rows()
        supplemented_rows = {r.original_row for r in supplemented}
        still_in_anomaly = [r for r in anomaly_rows if r.get("_original_row") in supplemented_rows]

        if still_in_anomaly:
            return {
                "check": "supplement_rerun",
                "status": "FAIL",
                "detail": f"{len(still_in_anomaly)} supplemented record(s) still in anomaly store",
                "evidence_ids": [r.evidence_id for r in supplemented],
            }

        return {
            "check": "supplement_rerun",
            "status": "PASS",
            "detail": f"{len(supplemented)} record(s) supplemented and chi-square recalculated (χ²={chi_result.get('chi_square')}, df={chi_result.get('df')})",
            "evidence_ids": [r.evidence_id for r in supplemented],
        }

    def check_export_consistency(self) -> dict:
        display = self.store.get_display_data()
        api = self.store.get_api_response()
        export = self.store.get_export_data()

        mismatches = []
        if display["cleaned_rows"] != api["cleaned_rows"]:
            mismatches.append("cleaned_rows: display != api")
        if display["anomaly_rows"] != api["anomaly_rows"]:
            mismatches.append("anomaly_rows: display != api")
        if display["chi_square_result"] != api["chi_square_result"]:
            mismatches.append("chi_square_result: display != api")
        if display["summary"] != api["summary"]:
            mismatches.append("summary: display != api")

        if export["cleaned_rows"] != api["cleaned_rows"]:
            mismatches.append("cleaned_rows: export != api")
        if export["anomaly_rows"] != api["anomaly_rows"]:
            mismatches.append("anomaly_rows: export != api")

        dz_evidence = self.evidence.get_by_anomaly_type(ANOMALY_DENOMINATOR_ZERO_EMPTY)
        for rec in dz_evidence:
            in_anomaly_display = any(
                r.get("_original_row") == rec.original_row and r.get("_anomaly") == ANOMALY_DENOMINATOR_ZERO_EMPTY
                for r in display["anomaly_rows"]
            )
            in_anomaly_export = any(
                r.get("_original_row") == rec.original_row and r.get("_anomaly") == ANOMALY_DENOMINATOR_ZERO_EMPTY
                for r in export["anomaly_rows"]
            )
            if in_anomaly_display != in_anomaly_export:
                mismatches.append(f"denominator_zero_empty_string row {rec.original_row}: display={in_anomaly_display}, export={in_anomaly_export}")

        if mismatches:
            return {"check": "export_consistency", "status": "FAIL", "detail": "; ".join(mismatches)}
        return {"check": "export_consistency", "status": "PASS", "detail": "Display, API, and export data are consistent"}
