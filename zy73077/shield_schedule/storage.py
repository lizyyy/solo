import json
import os
import copy
from typing import Dict, List, Optional
from models import (
    ScheduleRecord, ParamVersion, RunDiff, Anomaly,
    _now, _uid, asdict,
)

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")


def _p(name):
    return os.path.join(DATA_DIR, name)


def _ensure():
    os.makedirs(DATA_DIR, exist_ok=True)


def save_json(path, obj):
    _ensure()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)


def load_json(path, default):
    if not os.path.exists(path):
        return default
    with open(path, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except Exception:
            return default


# ============ Records ============
def load_records(version_id: str) -> List[ScheduleRecord]:
    rows = load_json(_p(f"records_{version_id}.json"), [])
    out = []
    for r in rows:
        anoms = [Anomaly(**a) for a in r.get("anomalies", [])]
        r2 = {**r, "anomalies": anoms}
        out.append(ScheduleRecord(**r2))
    return out


def save_records(version_id: str, records: List[ScheduleRecord]):
    rows = []
    for rec in records:
        d = asdict(rec)
        d["anomalies"] = [asdict(a) for a in rec.anomalies]
        rows.append(d)
    save_json(_p(f"records_{version_id}.json"), rows)


# ============ Versions ============
def load_versions() -> List[ParamVersion]:
    rows = load_json(_p("versions.json"), [])
    return [ParamVersion(**r) for r in rows]


def save_versions(versions: List[ParamVersion]):
    save_json(_p("versions.json"), [asdict(v) for v in versions])


def add_version(v: ParamVersion):
    vs = load_versions()
    vs.insert(0, v)
    save_versions(vs)


def get_version(version_id: str) -> Optional[ParamVersion]:
    for v in load_versions():
        if v.version_id == version_id:
            return v
    return None


# ============ Diffs ============
def load_diffs() -> List[RunDiff]:
    rows = load_json(_p("diffs.json"), [])
    return [RunDiff(**r) for r in rows]


def save_diffs(diffs: List[RunDiff]):
    save_json(_p("diffs.json"), [asdict(d) for d in diffs])


def add_diff(d: RunDiff):
    ds = load_diffs()
    ds.insert(0, d)
    save_diffs(ds)


def get_diff(diff_id: str) -> Optional[RunDiff]:
    for d in load_diffs():
        if d.diff_id == diff_id:
            return d
    return None


# ============ Samples ============
def load_sample_input() -> List[Dict]:
    return load_json(_p("sample_input.json"), [])


def save_sample_input(data: List[Dict]):
    save_json(_p("sample_input.json"), data)


# ============ Record Update Helpers ============
def update_record(version_id: str, record_id: str, updates: Dict, operator: str, reason: str):
    records = load_records(version_id)
    for rec in records:
        if rec.record_id == record_id:
            for k, v in updates.items():
                old = getattr(rec, k, None)
                if old != v:
                    rec.add_audit(k, old, v, operator, reason)
                    setattr(rec, k, v)
            save_records(version_id, records)
            return rec
    return None


def resolve_anomaly(version_id: str, record_id: str, anomaly_id: str, note: str, operator: str):
    records = load_records(version_id)
    for rec in records:
        if rec.record_id == record_id:
            for a in rec.anomalies:
                if a.anomaly_id == anomaly_id:
                    a.resolved = True
                    a.resolved_note = note
                    rec.add_audit(f"anomaly:{anomaly_id}", False, True, operator, note)
                    save_records(version_id, records)
                    return a
    return None
