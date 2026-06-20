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

    anomaly_changes: Dict[str, Dict[str, Any]] = {}

    def _anomaly_key(a: Dict[str, Any]) -> str:
        return a["rule_id"]

    def _anomaly_meta(a: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "rule_id": a["rule_id"],
            "rule_name": a.get("rule_name", ""),
            "severity": a.get("severity", ""),
            "field_name": a.get("field_name"),
            "anomaly_reason": a.get("anomaly_reason", ""),
            "current_value": a.get("current_value"),
        }

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

        cur_anoms = {
            _anomaly_key(a): _anomaly_meta(a)
            for a in (cur.get("anomalies", []) if cur else [])
        }
        base_anoms = {
            _anomaly_key(a): _anomaly_meta(a)
            for a in (base.get("anomalies", []) if base else [])
        }

        all_rule_ids = set(cur_anoms.keys()) | set(base_anoms.keys())
        new_rule_ids = set(cur_anoms.keys()) - set(base_anoms.keys())
        disappeared_rule_ids = set(base_anoms.keys()) - set(cur_anoms.keys())
        persisting_rule_ids = set(cur_anoms.keys()) & set(base_anoms.keys())

        if not all_rule_ids and not (cur_fail or base_fail):
            continue

        new_list = [cur_anoms[rid2] for rid2 in sorted(new_rule_ids)]
        disappeared_list = [base_anoms[rid2] for rid2 in sorted(disappeared_rule_ids)]
        persisting_list = []
        for rid2 in sorted(persisting_rule_ids):
            c = cur_anoms[rid2]
            b = base_anoms[rid2]
            field_changed = c.get("field_name") != b.get("field_name")
            severity_changed = c.get("severity") != b.get("severity")
            value_changed = c.get("current_value") != b.get("current_value")
            persisting_list.append({
                **c,
                "baseline_field_name": b.get("field_name"),
                "baseline_severity": b.get("severity"),
                "baseline_current_value": b.get("current_value"),
                "baseline_anomaly_reason": b.get("anomaly_reason"),
                "field_changed": field_changed,
                "severity_changed": severity_changed,
                "value_changed": value_changed,
                "any_changed": field_changed or severity_changed or value_changed,
            })

        change_type_parts = []
        if not base_fail and cur_fail:
            change_type_parts.append("新出现异常")
        elif base_fail and not cur_fail:
            change_type_parts.append("全部修复")
        else:
            if disappeared_list:
                change_type_parts.append(
                    f"{len(disappeared_list)}项异常已消失({','.join(a['rule_id'] for a in disappeared_list)})"
                )
            if new_list:
                change_type_parts.append(
                    f"{len(new_list)}项异常新增({','.join(a['rule_id'] for a in new_list)})"
                )
            if persisting_list:
                changed_persist = [p for p in persisting_list if p["any_changed"]]
                unchanged_persist = [p for p in persisting_list if not p["any_changed"]]
                if changed_persist:
                    change_type_parts.append(
                        f"{len(changed_persist)}项异常字段/级别变化({','.join(p['rule_id'] for p in changed_persist)})"
                    )
                if unchanged_persist:
                    change_type_parts.append(
                        f"{len(unchanged_persist)}项异常仍存在({','.join(p['rule_id'] for p in unchanged_persist)})"
                    )

        needs_manual_confirm = bool(
            new_list
            or any(p["any_changed"] for p in persisting_list)
        )

        pet_name = cur.get("pet_name") if cur else (base.get("pet_name") if base else "")
        owner_name = cur.get("owner_name") if cur else (base.get("owner_name") if base else "")
        baseline_version = base.get("version") if base else None
        current_version = cur.get("version") if cur else None
        version_jumped = (
            baseline_version and current_version and current_version > baseline_version
        )

        anomaly_changes[rid] = {
            "record_id": rid,
            "pet_name": pet_name,
            "owner_name": owner_name,
            "baseline_status": "fail" if base_fail else "pass",
            "current_status": "fail" if cur_fail else "pass",
            "baseline_version": baseline_version,
            "current_version": current_version,
            "version_jumped": version_jumped,
            "new_anomalies": new_list,
            "disappeared_anomalies": disappeared_list,
            "persisting_anomalies": persisting_list,
            "change_type": " → ".join(change_type_parts) or "无变化",
            "needs_manual_confirm": needs_manual_confirm,
        }

    needs_confirm_ids = sorted(
        rid for rid, c in anomaly_changes.items()
        if c["needs_manual_confirm"]
    )

    return {
        "baseline_run_tag": baseline["run_tag"],
        "new_anomaly_records": new_anomaly_records,
        "fixed_anomaly_records": fixed_anomaly_records,
        "still_failing_records": still_failing,
        "anomaly_changes": anomaly_changes,
        "needs_manual_confirm_records": needs_confirm_ids,
        "change_summary_counts": {
            "new_anomaly_records": len(new_anomaly_records),
            "fixed_anomaly_records": len(fixed_anomaly_records),
            "still_failing_records": len(still_failing),
            "records_with_new_anomalies": len(
                [rid for rid, c in anomaly_changes.items() if c["new_anomalies"]]
            ),
            "records_with_disappeared_anomalies": len(
                [rid for rid, c in anomaly_changes.items() if c["disappeared_anomalies"]]
            ),
            "records_with_persisting_changes": len(
                [rid for rid, c in anomaly_changes.items()
                 if any(p["any_changed"] for p in c["persisting_anomalies"])]
            ),
            "needs_manual_confirm": len(needs_confirm_ids),
        },
    }
