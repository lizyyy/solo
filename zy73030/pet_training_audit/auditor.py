from dataclasses import dataclass, field, asdict
from typing import Any, Callable, Dict, List, Optional

import importlib
import json
import uuid
from datetime import datetime

from .config import RULE_REGISTRY
from .db import get_conn
from .importer import get_all_latest_versions


@dataclass
class Anomaly:
    rule_id: str
    rule_name: str
    severity: str
    anomaly_reason: str
    field_name: Optional[str] = None
    current_value: Optional[str] = None
    expected_value: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


RuleFn = Callable[[Dict[str, Any]], List[Anomaly]]

_RULE_REGISTRY: Dict[str, RuleFn] = {}
_RULE_META: Dict[str, Dict[str, Any]] = {}


def register_rule(rule_id: str, rule_name: str, severity: str = "warning"):
    def decorator(fn: RuleFn) -> RuleFn:
        _RULE_REGISTRY[rule_id] = fn
        _RULE_META[rule_id] = {
            "rule_id": rule_id,
            "rule_name": rule_name,
            "severity": severity,
            "fn": fn.__name__,
        }
        return fn
    return decorator


def _load_rule_modules():
    if _RULE_REGISTRY:
        return
    for mod_name in RULE_REGISTRY:
        importlib.import_module(mod_name)


def get_registered_rules() -> List[Dict[str, Any]]:
    _load_rule_modules()
    return [dict(m) for m in _RULE_META.values()]


def apply_rules(record: Dict[str, Any]) -> List[Anomaly]:
    _load_rule_modules()
    anomalies: List[Anomaly] = []
    for rule_fn in _RULE_REGISTRY.values():
        try:
            result = rule_fn(record) or []
            anomalies.extend(result)
        except Exception as e:
            anomalies.append(Anomaly(
                rule_id="RULE_ERROR",
                rule_name="规则执行异常",
                severity="error",
                anomaly_reason=f"规则执行出错: {str(e)}",
            ))
    return anomalies


def _generate_run_tag() -> str:
    return f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"


@dataclass
class AuditRunResult:
    run_id: int
    run_tag: str
    total_records: int
    anomaly_records: int
    total_anomalies: int
    per_severity: Dict[str, int] = field(default_factory=dict)
    per_rule: Dict[str, int] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "run_id": self.run_id,
            "run_tag": self.run_tag,
            "total_records": self.total_records,
            "anomaly_records": self.anomaly_records,
            "total_anomalies": self.total_anomalies,
            "per_severity": self.per_severity,
            "per_rule": self.per_rule,
            "has_anomalies": self.total_anomalies > 0,
        }


def run_audit(
    run_tag: str = None,
    triggered_by: str = "scheduled",
    baseline_run_tag: str = None,
    db_path: str = None,
) -> AuditRunResult:
    _load_rule_modules()
    run_tag = run_tag or _generate_run_tag()
    records = get_all_latest_versions(db_path)

    per_severity: Dict[str, int] = {}
    per_rule: Dict[str, int] = {}
    anomaly_records = 0
    total_anomalies = 0

    with get_conn(db_path) as conn:
        cur = conn.execute(
            """INSERT INTO audit_runs(run_tag, triggered_by, baseline_run_tag)
               VALUES (?, ?, ?)""",
            (run_tag, triggered_by, baseline_run_tag),
        )
        audit_run_id = cur.lastrowid

        for rec in records:
            anomalies = apply_rules(rec)
            status = "pass" if not anomalies else "fail"
            if anomalies:
                anomaly_records += 1
                total_anomalies += len(anomalies)
            for a in anomalies:
                per_severity[a.severity] = per_severity.get(a.severity, 0) + 1
                per_rule[a.rule_id] = per_rule.get(a.rule_id, 0) + 1

            cur2 = conn.execute(
                """INSERT INTO audit_results(
                    audit_run_id, record_id, version, overall_status,
                    anomaly_count, detail_json
                ) VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    audit_run_id,
                    rec["record_id"],
                    rec["version"],
                    status,
                    len(anomalies),
                    json.dumps(
                        [a.to_dict() for a in anomalies],
                        ensure_ascii=False,
                    ),
                ),
            )
            audit_result_id = cur2.lastrowid
            for a in anomalies:
                conn.execute(
                    """INSERT INTO anomalies(
                        audit_result_id, rule_id, rule_name, severity,
                        field_name, anomaly_reason, current_value, expected_value
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        audit_result_id,
                        a.rule_id,
                        a.rule_name,
                        a.severity,
                        a.field_name,
                        a.anomaly_reason,
                        a.current_value,
                        a.expected_value,
                    ),
                )

    return AuditRunResult(
        run_id=audit_run_id,
        run_tag=run_tag,
        total_records=len(records),
        anomaly_records=anomaly_records,
        total_anomalies=total_anomalies,
        per_severity=per_severity,
        per_rule=per_rule,
    )


def get_audit_run(run_tag: str, db_path: str = None) -> Optional[Dict[str, Any]]:
    with get_conn(db_path) as conn:
        row = conn.execute(
            "SELECT * FROM audit_runs WHERE run_tag = ?", (run_tag,)
        ).fetchone()
        if not row:
            return None
        run = dict(row)
        detail_rows = conn.execute(
            """SELECT ar.*, trv.training_date, trv.course_type, r.pet_name, r.owner_name
               FROM audit_results ar
               JOIN training_record_versions trv
                 ON trv.record_id = ar.record_id AND trv.version = ar.version
               JOIN training_records r ON r.record_id = ar.record_id
               WHERE ar.audit_run_id = ?
               ORDER BY ar.anomaly_count DESC, ar.record_id ASC""",
            (run["id"],),
        ).fetchall()
        run["results"] = []
        for d in detail_rows:
            d = dict(d)
            d["anomalies"] = json.loads(d.get("detail_json") or "[]")
            run["results"].append(d)

        if run.get("baseline_run_tag"):
            baseline = get_audit_run(run["baseline_run_tag"], db_path)
            if baseline:
                run["baseline_summary"] = summarize_diff(run, baseline)
        return run


def summarize_diff(current: Dict[str, Any], baseline: Dict[str, Any]) -> Dict[str, Any]:
    cur_map = {r["record_id"]: r for r in current["results"]}
    base_map = {r["record_id"]: r for r in baseline["results"]}

    new_anomaly_records = []
    fixed_anomaly_records = []
    still_failing = []

    all_ids = set(cur_map.keys()) | set(base_map.keys())
    for rid in sorted(all_ids):
        cur = cur_map.get(rid)
        base = base_map.get(rid)
        cur_fail = cur and cur["overall_status"] == "fail"
        base_fail = base and base["overall_status"] == "fail"
        if cur_fail and not base_fail:
            new_anomaly_records.append(rid)
        elif not cur_fail and base_fail:
            fixed_anomaly_records.append(rid)
        elif cur_fail and base_fail:
            still_failing.append(rid)

    return {
        "baseline_run_tag": baseline["run_tag"],
        "new_anomaly_records": new_anomaly_records,
        "fixed_anomaly_records": fixed_anomaly_records,
        "still_failing_records": still_failing,
    }
