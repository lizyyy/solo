import datetime
import json
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional, Tuple
from .db import Database
from .models import (
    TemperatureRecord, RecordStatus, ChangeHistory, WorkflowLog,
)
from .importer import get_record_with_evidence
from .workflow import get_full_audit_trail

@dataclass
class CalibrationRecordResult:
    record_id: int
    original_line_no: int
    equipment_position: str
    sensor_id: str
    temperature_value: float
    caliber: str
    current_status: str
    final_remark: str
    pulling_force_kn: Optional[float] = None
    nominal_force_kn: Optional[float] = None
    force_pass: Optional[bool] = None
    remark_history: List[Dict] = field(default_factory=list)
    workflow_log: List[Dict] = field(default_factory=list)

@dataclass
class EM_CalibrationReport:
    report_id: str
    generated_at: str
    batch_id: int
    source_file: str
    batch_hash_prefix: str
    total_records_in_batch: int
    summary: Dict
    records: List[CalibrationRecordResult]
    all_passed: bool

    def to_dict(self) -> dict:
        return asdict(self)

    def to_json(self, indent=2, ensure_ascii=False) -> str:
        return json.dumps(self.to_dict(), indent=indent, ensure_ascii=ensure_ascii)

    def save_json(self, path: str):
        with open(path, "w", encoding="utf-8") as f:
            f.write(self.to_json())

    def print_summary(self):
        print("=" * 80)
        print(f"  电磁铁吸力标定报告  report_id={self.report_id}")
        print("=" * 80)
        print(f"  生成时间       : {self.generated_at}")
        print(f"  批次 ID        : {self.batch_id}")
        print(f"  源文件         : {self.source_file}")
        print(f"  批次哈希前缀   : {self.batch_hash_prefix}")
        print(f"  记录数         : {self.total_records_in_batch}")
        for k, v in self.summary.items():
            print(f"  {k:<18}: {v}")
        print(f"  全部通过?      : {'是' if self.all_passed else '否'}")
        print("-" * 80)
        print(f"  {'line':>4}  {'pos':<8}  {'sensor':<10}  {'T(°C)':>5}  {'cal':<6}  {'F(kN)':>6}  {'pass':<4}  {'status':<18}  remark")
        print(f"  {'----':>4}  {'---':<8}  {'------':<10}  {'-----':>5}  {'---':<6}  {'------':>6}  {'----':<4}  {'------':<18}  ------")
        for r in self.records:
            f = f"{r.pulling_force_kn:.2f}" if r.pulling_force_kn is not None else "N/A"
            ok = "✓" if r.force_pass else ("✗" if r.force_pass is False else "?")
            print(f"  {r.original_line_no:>4}  {r.equipment_position:<8}  {r.sensor_id:<10}  {r.temperature_value:>5.1f}  {r.caliber:<6}  {f:>6}  {ok:<4}  {r.current_status:<18}  {r.final_remark[:50]}")


CALIBER_NOMINAL_FORCE = {
    "DN32": 4.0,
    "DN40": 6.0,
    "DN50": 10.0,
    "DN65": 16.0,
    "DN80": 25.0,
    "DN100": 40.0,
    "DN125": 63.0,
    "DN150": 100.0,
}
FORCE_TOLERANCE_PCT = 0.10
TEMP_REF = 20.0
TEMP_DERATE_PER_DEG = 0.003

def _compute_pulling_force(caliber: str, temperature_value: float) -> Tuple[Optional[float], Optional[float], Optional[bool]]:
    nominal = CALIBER_NOMINAL_FORCE.get(caliber.upper() if caliber else "")
    if nominal is None:
        return None, None, None
    delta_t = max(0.0, float(temperature_value) - TEMP_REF)
    derate = 1.0 - delta_t * TEMP_DERATE_PER_DEG
    derate = max(0.5, derate)
    actual = round(nominal * derate, 3)
    low = nominal * (1 - FORCE_TOLERANCE_PCT)
    high = nominal * (1 + FORCE_TOLERANCE_PCT)
    passed = low <= actual <= high
    return actual, nominal, passed


def compute_calibration_for_record(rec: TemperatureRecord) -> Tuple[Optional[float], Optional[float], Optional[bool]]:
    return _compute_pulling_force(rec.caliber, rec.temperature_value)


def generate_report(db: Database, batch_id: int, operator: str = "system") -> EM_CalibrationReport:
    batch = db.conn.execute("SELECT * FROM calibration_batch WHERE id=?", (batch_id,)).fetchone()
    if not batch:
        raise ValueError(f"batch {batch_id} not found")
    records = db.get_records_by_batch(batch_id)

    results: List[CalibrationRecordResult] = []
    status_counter: Dict[str, int] = {}
    force_pass_cnt = 0
    force_attempts = 0
    for rec in records:
        f, nominal, passed = compute_calibration_for_record(rec)
        if f is not None:
            force_attempts += 1
            if passed:
                force_pass_cnt += 1
        status_counter[rec.status] = status_counter.get(rec.status, 0) + 1

        evidence = get_record_with_evidence(db, rec.id)
        audit = get_full_audit_trail(db, rec.id)
        remark_hist = []
        for ch in evidence["change_history"]:
            if ch.field_name == "remark":
                remark_hist.append({
                    "changed_at": ch.changed_at,
                    "change_type": ch.change_type,
                    "old_value": ch.old_value,
                    "new_value": ch.new_value,
                    "changed_by": ch.changed_by,
                    "reason": ch.reason,
                })
        if not any(h["old_value"] == "" for h in remark_hist):
            initial = {
                "changed_at": rec.created_at,
                "change_type": "import",
                "old_value": "",
                "new_value": rec.remark,
                "changed_by": "system",
                "reason": "initial remark on import",
            }
            if remark_hist:
                first_old = remark_hist[0]["old_value"]
                if first_old != "":
                    initial["new_value"] = first_old
                    remark_hist.insert(0, initial)
            else:
                remark_hist.append(initial)

        wf_log_dicts = []
        for wl in audit["workflow_log"]:
            wf_log_dicts.append({
                "operated_at": wl.operated_at,
                "from_status": wl.from_status,
                "to_status": wl.to_status,
                "operator": wl.operator,
                "note": wl.note,
            })

        results.append(CalibrationRecordResult(
            record_id=rec.id,
            original_line_no=rec.original_line_no,
            equipment_position=rec.equipment_position,
            sensor_id=rec.sensor_id,
            temperature_value=rec.temperature_value,
            caliber=rec.caliber,
            current_status=rec.status,
            final_remark=rec.remark,
            pulling_force_kn=f,
            nominal_force_kn=nominal,
            force_pass=passed,
            remark_history=remark_hist,
            workflow_log=wf_log_dicts,
        ))

    total_rec = len(records)
    all_completed = all(r.current_status == RecordStatus.COMPLETED.value for r in results)
    all_force_pass = (force_pass_cnt == force_attempts) if force_attempts > 0 else False
    summary = {
        "状态分布": ", ".join(f"{s}={n}" for s, n in sorted(status_counter.items())),
        "已完成 (completed)": sum(1 for r in results if r.current_status == RecordStatus.COMPLETED.value),
        "待安全复核 (safety_review)": sum(1 for r in results if r.current_status == RecordStatus.SAFETY_REVIEW.value),
        "传感器变更待复核 (sensor_changed)": sum(1 for r in results if r.current_status == RecordStatus.SENSOR_CHANGED.value),
        "吸力计算条数": force_attempts,
        "吸力合格条数": force_pass_cnt,
        "吸力合格率": f"{(force_pass_cnt / force_attempts * 100):.1f}%" if force_attempts else "N/A",
    }
    report_id = f"EM-CAL-{batch_id}-{datetime.datetime.now().strftime('%Y%m%d-%H%M%S')}"
    return EM_CalibrationReport(
        report_id=report_id,
        generated_at=datetime.datetime.now().isoformat(timespec="seconds"),
        batch_id=batch_id,
        source_file=batch["source_file"],
        batch_hash_prefix=batch["batch_hash"][:16],
        total_records_in_batch=total_rec,
        summary=summary,
        records=results,
        all_passed=all_completed and all_force_pass,
    )


def recompute_and_export(db: Database, batch_id: int, operator: str, output_json_path: Optional[str] = None) -> EM_CalibrationReport:
    report = generate_report(db, batch_id, operator=operator)
    if output_json_path:
        report.save_json(output_json_path)
    return report
