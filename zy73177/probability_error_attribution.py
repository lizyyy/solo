#!/usr/bin/env python3
"""
probability_error_attribution.py
概率模拟错题归因（Probability Simulation Error Attribution）

把"学生概率模拟草稿 → 错题归因"从月底手工核改为可日常跑的脚本。
设计目标（对应交接诉求）：
  1. 参数名与失败提示稳定，接手同事可直接 import 进日常脚本。
  2. 学生草稿常分几次凑齐：后补材料不会无声覆盖早先判断（append-only 账本 + 历史）。
  3. 重复样本需人工确认时，提示写清"为什么卡住 / 下一步找谁"。
  4. 中间计算过程与单位换算全程可见（不藏起来），便于两组参数对照。
  5. 产出交接状态：哪些可放行、哪些还缺材料、哪些需人工确认。
  6. 自带一组"不太干净"的演示数据，含边界样本与重复样本，跑完不只展示正常样例。

公开 API（请勿重命名，保证稳定）：
  类:    Sample / Judgment / AttributionConfig / LedgerRecord / Ledger / BatchResult
  函数:  attribute(sample, config) -> Judgment
         attribute_batch(samples, config, ledger=None) -> BatchResult
         find_duplicate_conflicts(records) -> list
         format_handover(ledger, config) -> str
         format_comparison(records, config_a, config_b) -> str
  常量:  STATUS_* / CAUSE_* / UNIT_FACTORS / MSG_* / DEFAULT_*_CONFIG / DEFAULT_MANUAL_REVIEW_CONTACT

仅依赖 Python 标准库。直接运行执行演示：
    python3 probability_error_attribution.py
加载自有数据并落账本：
    python3 probability_error_attribution.py --input samples.json --ledger ledger.jsonl --config lenient
"""

import argparse
import json
import math
import os
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Optional


STATUS_RELEASED = "released"
STATUS_PENDING_MATERIALS = "pending_materials"
STATUS_NEEDS_MANUAL_CONFIRMATION = "needs_manual_confirmation"

CAUSE_SAMPLING_VARIANCE = "SAMPLING_VARIANCE"
CAUSE_UNIT_CONVERSION_ERROR = "UNIT_CONVERSION_ERROR"
CAUSE_BOUNDARY_ERROR = "BOUNDARY_ERROR"
CAUSE_SYSTEMATIC_BIAS = "SYSTEMATIC_BIAS"
CAUSE_INSUFFICIENT_TRIALS = "INSUFFICIENT_TRIALS"
CAUSE_MATERIALS_INCOMPLETE = "MATERIALS_INCOMPLETE"
CAUSE_DUPLICATE_CONFLICT = "DUPLICATE_CONFLICT"

UNIT_FACTORS = {
    "fraction": 1.0,
    "decimal": 1.0,
    "percent": 0.01,
    "permille": 0.001,
}
UNIT_CANDIDATES = ["fraction", "percent", "permille"]
_UNKNOWN_UNIT_FACTOR = 1.0

DEFAULT_MANUAL_REVIEW_CONTACT = "教研组概率模拟值班编辑（阿宁）· 飞书群 #prob-sim-review"

MSG_SAMPLING_VARIANCE = (
    "样本 {sample_id}：模拟值在统计噪声范围内（z={z:.3f} ≤ {threshold}），可放行。"
)
MSG_INSUFFICIENT_TRIALS = (
    "样本 {sample_id}：试验次数 n={n} 不足下限 {min_trials}，统计噪声过大无法判定。"
    "下一步：让学生补交更多试验数据后重新归因。"
)
MSG_MATERIALS_INCOMPLETE = (
    "样本 {sample_id}：统计上本可放行（{stat_cause}），但学生材料未凑齐（materials_complete=False）。"
    "下一步：补交缺失材料（随机种子 / 模拟脚本 / 试验明细）后再放行。"
)
MSG_UNIT_CONVERSION = (
    "样本 {sample_id}：报出值在标注单位 '{reported_unit}' 下异常，"
    "但按 ×{factor} 换算后与理论值吻合，疑似单位标注错误。"
    "下一步：要求学生按 fraction(0~1) 统一单位补交材料。"
)
MSG_BOUNDARY = (
    "样本 {sample_id}：模拟值落在边界 {edge}，且偏离显著（z={z:.3f}），"
    "疑似事件触发条件 bug（如 > 与 >= 混用、随机数范围端点处理错误）。"
    "下一步：让学生核查边界判断并附上原始模拟脚本；暂不放行。"
)
MSG_SYSTEMATIC = (
    "样本 {sample_id}：偏离显著（z={z:.3f}）且未命中单位/边界特征，归因为系统性偏差。"
    "下一步：补交材料——随机种子、模拟脚本与完整试验次数明细。"
)
MSG_DUPLICATE_CONFLICT = (
    "样本 {sample_id}：出现重复/冲突提交。两份独立 report 不一致——"
    "草稿A: {value_a} {unit_a}（归一化 {norm_a:.6f}），"
    "草稿B: {value_b} {unit_b}（归一化 {norm_b:.6f}）。"
    "卡住原因：无法判断哪一份草稿可信，故不放行。"
    "下一步：联系 {contact}，核对原始模拟脚本与随机种子；"
    "确认后将其中一份标注为 correction 重新提交。"
)
MSG_RESUBMISSION_NOTE = (
    "样本 {sample_id}：批次 {batch} 以 correction 重新提交，变更字段 {changed}；"
    "早先判断 {prior_cause}({prior_status}) 已保留在历史记录 #{prior_seq}，未被覆盖。"
)


@dataclass
class Sample:
    sample_id: str
    student_id: str
    problem_label: str
    theoretical_prob: float
    reported_value: float
    reported_unit: str
    n_trials: int
    materials_complete: bool = True
    batch: str = "default"
    submission_kind: str = "report"

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "Sample":
        return cls(
            sample_id=d["sample_id"],
            student_id=d["student_id"],
            problem_label=d["problem_label"],
            theoretical_prob=float(d["theoretical_prob"]),
            reported_value=float(d["reported_value"]),
            reported_unit=d["reported_unit"],
            n_trials=int(d["n_trials"]),
            materials_complete=bool(d.get("materials_complete", True)),
            batch=d.get("batch", "default"),
            submission_kind=d.get("submission_kind", "report"),
        )


@dataclass
class Judgment:
    cause: str
    status: str
    message: str
    trace: dict


@dataclass
class AttributionConfig:
    name: str
    z_release_threshold: float
    unit_match_tol: float
    min_trials: int
    manual_review_contact: str = DEFAULT_MANUAL_REVIEW_CONTACT

    def describe(self) -> str:
        return (
            f"config={self.name} | z_release_threshold={self.z_release_threshold} | "
            f"unit_match_tol={self.unit_match_tol} | min_trials={self.min_trials} | "
            f"contact={self.manual_review_contact}"
        )


@dataclass
class LedgerRecord:
    seq: int
    ts: str
    sample_id: str
    student_id: str
    problem_label: str
    batch: str
    submission_kind: str
    input_snapshot: dict
    cause: str
    status: str
    message: str
    trace: dict
    prior_seq: Optional[int] = None
    changed_fields: list = field(default_factory=list)
    duplicate_with: Optional[int] = None

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "LedgerRecord":
        return cls(
            seq=d["seq"],
            ts=d["ts"],
            sample_id=d["sample_id"],
            student_id=d["student_id"],
            problem_label=d["problem_label"],
            batch=d["batch"],
            submission_kind=d["submission_kind"],
            input_snapshot=d["input_snapshot"],
            cause=d["cause"],
            status=d["status"],
            message=d["message"],
            trace=d["trace"],
            prior_seq=d.get("prior_seq"),
            changed_fields=d.get("changed_fields", []),
            duplicate_with=d.get("duplicate_with"),
        )


@dataclass
class BatchResult:
    records: list
    ledger: "Ledger"


def _now_ts() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _normalize(reported_value: float, reported_unit: str):
    factor = UNIT_FACTORS.get(reported_unit, _UNKNOWN_UNIT_FACTOR)
    return factor, reported_value * factor


def _diff_fields(prior_snapshot: dict, new_sample: Sample) -> list:
    keys = ["reported_value", "reported_unit", "n_trials", "theoretical_prob", "materials_complete"]
    changed = []
    for k in keys:
        old = prior_snapshot.get(k)
        new = getattr(new_sample, k)
        if old != new:
            changed.append(f"{k}: {old} -> {new}")
    return changed


def attribute(sample: Sample, config: AttributionConfig) -> Judgment:
    factor, normalized = _normalize(sample.reported_value, sample.reported_unit)
    theoretical = sample.theoretical_prob
    error = abs(normalized - theoretical)
    alternatives = {u: sample.reported_value * UNIT_FACTORS[u] for u in UNIT_CANDIDATES}
    if sample.n_trials > 0 and 0.0 < theoretical < 1.0:
        se = math.sqrt(theoretical * (1.0 - theoretical) / sample.n_trials)
    else:
        se = 0.0
    z = (error / se) if se > 0 else (float("inf") if error > 0 else 0.0)

    trace = {
        "reported_value": sample.reported_value,
        "reported_unit": sample.reported_unit,
        "unit_factor_applied": factor,
        "normalized_simulated": normalized,
        "theoretical_prob": theoretical,
        "error": error,
        "n_trials": sample.n_trials,
        "se": se,
        "z": z,
        "unit_alternatives": alternatives,
        "threshold_z": config.z_release_threshold,
        "min_trials": config.min_trials,
        "materials_complete": sample.materials_complete,
    }

    if sample.n_trials < config.min_trials:
        msg = MSG_INSUFFICIENT_TRIALS.format(
            sample_id=sample.sample_id, n=sample.n_trials, min_trials=config.min_trials
        )
        return Judgment(CAUSE_INSUFFICIENT_TRIALS, STATUS_PENDING_MATERIALS, msg, trace)

    best_unit = None
    best_err = error
    for u in UNIT_CANDIDATES:
        if u == sample.reported_unit:
            continue
        cand = alternatives[u]
        e = abs(cand - theoretical)
        if e <= config.unit_match_tol and e < best_err:
            best_unit, best_err = u, e
    out_of_range = normalized < 0.0 or normalized > 1.0
    if best_unit is not None and (out_of_range or best_err < error):
        trace["best_alt_unit"] = best_unit
        msg = MSG_UNIT_CONVERSION.format(
            sample_id=sample.sample_id,
            reported_unit=sample.reported_unit,
            factor=UNIT_FACTORS[best_unit],
        )
        return Judgment(CAUSE_UNIT_CONVERSION_ERROR, STATUS_PENDING_MATERIALS, msg, trace)

    is_edge = normalized in (0.0, 1.0)
    if is_edge and 0.0 < theoretical < 1.0 and z > config.z_release_threshold:
        msg = MSG_BOUNDARY.format(sample_id=sample.sample_id, edge=normalized, z=z)
        return Judgment(CAUSE_BOUNDARY_ERROR, STATUS_NEEDS_MANUAL_CONFIRMATION, msg, trace)

    if z <= config.z_release_threshold:
        msg = MSG_SAMPLING_VARIANCE.format(
            sample_id=sample.sample_id, z=z, threshold=config.z_release_threshold
        )
        judgment = Judgment(CAUSE_SAMPLING_VARIANCE, STATUS_RELEASED, msg, trace)
    else:
        msg = MSG_SYSTEMATIC.format(sample_id=sample.sample_id, z=z)
        judgment = Judgment(CAUSE_SYSTEMATIC_BIAS, STATUS_PENDING_MATERIALS, msg, trace)

    if not sample.materials_complete and judgment.status == STATUS_RELEASED:
        msg = MSG_MATERIALS_INCOMPLETE.format(
            sample_id=sample.sample_id, stat_cause=judgment.cause
        )
        judgment = Judgment(CAUSE_MATERIALS_INCOMPLETE, STATUS_PENDING_MATERIALS, msg, trace)
    return judgment


def _make_duplicate_conflict(prior_rec: LedgerRecord, sample: Sample,
                              config: AttributionConfig, base: Judgment) -> Judgment:
    _, norm_a = _normalize(
        prior_rec.input_snapshot["reported_value"], prior_rec.input_snapshot["reported_unit"]
    )
    _, norm_b = _normalize(sample.reported_value, sample.reported_unit)
    msg = MSG_DUPLICATE_CONFLICT.format(
        sample_id=sample.sample_id,
        value_a=prior_rec.input_snapshot["reported_value"],
        unit_a=prior_rec.input_snapshot["reported_unit"],
        norm_a=norm_a,
        value_b=sample.reported_value,
        unit_b=sample.reported_unit,
        norm_b=norm_b,
        contact=config.manual_review_contact,
    )
    return Judgment(CAUSE_DUPLICATE_CONFLICT, STATUS_NEEDS_MANUAL_CONFIRMATION, msg, base.trace)


class Ledger:
    def __init__(self, path: Optional[str] = None):
        self.path = path
        self.records: list = []
        self._next_seq = 1
        if path and os.path.exists(path):
            self._load()

    def _load(self) -> None:
        with open(self.path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                rec = LedgerRecord.from_dict(json.loads(line))
                self.records.append(rec)
                self._next_seq = max(self._next_seq, rec.seq + 1)

    def _persist(self, rec: LedgerRecord) -> None:
        if not self.path:
            return
        with open(self.path, "a", encoding="utf-8") as f:
            f.write(json.dumps(rec.to_dict(), ensure_ascii=False) + "\n")

    def latest_by_sample(self) -> dict:
        latest = {}
        for rec in self.records:
            cur = latest.get(rec.sample_id)
            if cur is None or rec.seq > cur.seq:
                latest[rec.sample_id] = rec
        return latest

    def history(self, sample_id: str) -> list:
        return [r for r in self.records if r.sample_id == sample_id]

    def append(self, sample: Sample, judgment: Judgment, batch: str,
               prior_seq: Optional[int] = None, changed_fields: Optional[list] = None,
               duplicate_with: Optional[int] = None) -> LedgerRecord:
        rec = LedgerRecord(
            seq=self._next_seq,
            ts=_now_ts(),
            sample_id=sample.sample_id,
            student_id=sample.student_id,
            problem_label=sample.problem_label,
            batch=batch,
            submission_kind=sample.submission_kind,
            input_snapshot=sample.to_dict(),
            cause=judgment.cause,
            status=judgment.status,
            message=judgment.message,
            trace=judgment.trace,
            prior_seq=prior_seq,
            changed_fields=changed_fields or [],
            duplicate_with=duplicate_with,
        )
        self._next_seq += 1
        self.records.append(rec)
        self._persist(rec)
        return rec


def attribute_batch(samples, config: AttributionConfig, ledger: Optional[Ledger] = None) -> BatchResult:
    if ledger is None:
        ledger = Ledger()
    for sample in samples:
        prior = ledger.latest_by_sample().get(sample.sample_id)
        base = attribute(sample, config)
        if sample.submission_kind == "correction" and prior is not None:
            changed = _diff_fields(prior.input_snapshot, sample)
            ledger.append(sample, base, sample.batch, prior_seq=prior.seq, changed_fields=changed)
        elif sample.submission_kind == "report" and prior is not None:
            conflict = _make_duplicate_conflict(prior, sample, config, base)
            ledger.append(sample, conflict, sample.batch, duplicate_with=prior.seq)
        else:
            ledger.append(sample, base, sample.batch)
    return BatchResult(records=ledger.records, ledger=ledger)


def find_duplicate_conflicts(records: list) -> list:
    conflicts = []
    for rec in records:
        if rec.duplicate_with is not None:
            conflicts.append((rec.seq, rec.sample_id, rec.duplicate_with))
    return conflicts


def _fmt_z(z: float) -> str:
    if math.isinf(z):
        return "inf"
    return f"{z:.3f}"


def format_trace_detail(records: list) -> str:
    lines = ["=== 中间计算过程（单位换算与统计量全程可见，不藏步骤） ==="]
    for rec in records:
        t = rec.trace
        lines.append(
            f"#{rec.seq} [{rec.batch}] {rec.sample_id} {rec.student_id} '{rec.problem_label}'"
        )
        lines.append(
            f"    reported={t['reported_value']} {t['reported_unit']}  "
            f"×factor={t['unit_factor_applied']} -> normalized={t['normalized_simulated']:.6f}"
        )
        lines.append(
            f"    theoretical={t['theoretical_prob']:.6f}  error={t['error']:.6f}  "
            f"n={t['n_trials']}  se={t['se']:.6f}  z={_fmt_z(t['z'])}  (threshold_z={t['threshold_z']})"
        )
        alts = " ".join(f"{u}={v:.6g}" for u, v in t["unit_alternatives"].items())
        lines.append(f"    unit_alternatives: {alts}")
        if "best_alt_unit" in t:
            lines.append(f"    best_alt_unit={t['best_alt_unit']}  -> 命中单位换算特征")
        lines.append(f"    -> cause={rec.cause}  status={rec.status}")
        lines.append(f"    提示: {rec.message}")
    return "\n".join(lines)


def format_handover(ledger: Ledger, config: AttributionConfig) -> str:
    latest = ledger.latest_by_sample()
    released, pending, manual = [], [], []
    for sid, rec in latest.items():
        if rec.status == STATUS_RELEASED:
            released.append(rec)
        elif rec.status == STATUS_PENDING_MATERIALS:
            pending.append(rec)
        else:
            manual.append(rec)

    def line(rec: LedgerRecord) -> str:
        return (f"  {rec.sample_id:<6} {rec.student_id:<10} {rec.problem_label:<14} "
                f"cause={rec.cause:<24} status={rec.status}")

    out = [f"=== 交接状态（{config.describe()}） ==="]
    out.append(f"[可放行 / released]  共 {len(released)} 条")
    out.extend(line(r) for r in sorted(released, key=lambda r: r.sample_id))
    out.append("")
    out.append(f"[缺材料 / pending_materials]  共 {len(pending)} 条")
    out.extend(line(r) for r in sorted(pending, key=lambda r: r.sample_id))
    out.append("")
    out.append(f"[需人工确认 / needs_manual_confirmation]  共 {len(manual)} 条")
    out.extend(line(r) for r in sorted(manual, key=lambda r: r.sample_id))
    out.append("")
    out.append("== 历史 / 覆盖记录（后补材料未无声覆盖早先判断） ==")
    for rec in ledger.records:
        if rec.prior_seq is not None:
            prior = next(r for r in ledger.records if r.seq == rec.prior_seq)
            changed = ", ".join(rec.changed_fields) if rec.changed_fields else "(无字段变更)"
            out.append(
                f"  {rec.sample_id}: 批次 {prior.batch} -> {rec.batch} (correction) "
                f"变更[{changed}]"
            )
            out.append(
                f"      早先判断: {prior.cause}({prior.status}) 记录 #{prior.seq} — 仍可在历史中查到，未被覆盖；"
                f"当前判断: {rec.cause}({rec.status}) 记录 #{rec.seq}"
            )
        if rec.duplicate_with is not None:
            out.append(
                f"  {rec.sample_id}: 与记录 #{rec.duplicate_with} 构成重复/冲突提交（DUPLICATE_CONFLICT），"
                f"两份 report 均保留，等待人工裁决。"
            )
    return "\n".join(out)


def format_comparison(records: list, config_a: AttributionConfig,
                       config_b: AttributionConfig) -> str:
    latest = {}
    for rec in records:
        cur = latest.get(rec.sample_id)
        if cur is None or rec.seq > cur.seq:
            latest[rec.sample_id] = rec

    lines = [f"=== 两组参数对照（同一批数据） ===",
             f"  A: {config_a.describe()}",
             f"  B: {config_b.describe()}"]
    header = (f"  {'sample':<6} {'reported(unit)':<18} {'norm':<9} {'factor':<7} "
              f"{'err':<9} {'se':<9} {'z':<8} {'A:cause':<22} {'B:cause':<22} 差异")
    lines.append(header)
    lines.append("  " + "-" * (len(header) - 2))
    for sid in sorted(latest):
        rec = latest[sid]
        t = rec.trace
        s = Sample.from_dict(rec.input_snapshot)
        if rec.duplicate_with is not None:
            cause_a = cause_b = CAUSE_DUPLICATE_CONFLICT
        else:
            cause_a = attribute(s, config_a).cause
            cause_b = attribute(s, config_b).cause
        diff = "" if cause_a == cause_b else "  <- 分歧"
        lines.append(
            f"  {sid:<6} {str(t['reported_value'])+' '+t['reported_unit']:<18} "
            f"{t['normalized_simulated']:<9.6f} {t['unit_factor_applied']:<7} "
            f"{t['error']:<9.6f} {t['se']:<9.6f} {_fmt_z(t['z']):<8} "
            f"{cause_a:<22} {cause_b:<22}{diff}"
        )
    lines.append("  说明: 两配置共享单位换算与中间量，仅阈值不同；分歧行标注 <- 分歧。")
    return "\n".join(lines)


def load_samples_from_json(path: str) -> list:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return [Sample.from_dict(d) for d in data]


def demo_samples() -> list:
    batch1 = "draft-1"
    batch2 = "draft-2"
    return [
        Sample("S01", "student-A", "抛硬币正面", 0.5, 0.49, "fraction", 1000, True, batch1, "report"),
        Sample("S02", "student-A", "骰子点数<=2", 1.0 / 3.0, 33.2, "percent", 2000, True, batch1, "report"),
        Sample("S03", "student-B", "袋子摸球红球", 0.5, 50.0, "fraction", 1000, True, batch1, "report"),
        Sample("S04", "student-C", "稀有事件P=0.05", 0.05, 0.0, "fraction", 10000, True, batch1, "report"),
        Sample("S05", "student-D", "转盘命中", 0.25, 0.30, "fraction", 20, False, batch1, "report"),
        Sample("S06", "student-E", "双骰和>=10", 1.0 / 6.0, 0.48, "fraction", 500, True, batch1, "report"),
        Sample("S07", "student-F", "几何概率", 0.6, 0.31, "fraction", 5000, True, batch1, "report"),
        Sample("S08", "student-G", "硬币偏置检验", 0.5, 0.535, "fraction", 1000, True, batch1, "report"),
        Sample("S09", "student-H", "摸球红球", 0.25, 0.248, "fraction", 2000, False, batch1, "report"),
        Sample("S02", "student-A", "骰子点数<=2", 1.0 / 3.0, 33.1, "percent", 4000, True, batch2, "correction"),
        Sample("S06", "student-E", "双骰和>=10", 1.0 / 6.0, 0.73, "percent", 500, True, batch2, "report"),
    ]


def build_configs() -> dict:
    return {
        "lenient": AttributionConfig(
            name="lenient", z_release_threshold=3.0, unit_match_tol=0.02, min_trials=30
        ),
        "strict": AttributionConfig(
            name="strict", z_release_threshold=1.96, unit_match_tol=0.01, min_trials=100
        ),
    }


def run_demo() -> None:
    configs = build_configs()
    default_cfg = configs["lenient"]
    strict_cfg = configs["strict"]

    ledger = Ledger()
    attribute_batch(demo_samples(), default_cfg, ledger=ledger)

    print("=" * 92)
    print("概率模拟错题归因 · 演示（含边界样本 S04、重复样本 S06、单位错误 S03、试验不足 S05、")
    print("系统偏差 S07、阈值分歧 S08、材料未齐 S09、更正重交 S02）")
    print("=" * 92)
    print()
    print(format_trace_detail(ledger.records))
    print()
    print(format_handover(ledger, default_cfg))
    print()
    print(format_comparison(ledger.records, default_cfg, strict_cfg))
    print()
    dups = find_duplicate_conflicts(ledger.records)
    print(f"重复/冲突检出: {dups if dups else '无'}")


def main() -> None:
    parser = argparse.ArgumentParser(description="概率模拟错题归因")
    parser.add_argument("--input", help="样本 JSON 文件路径（list[Sample dict]）")
    parser.add_argument("--ledger", help="append-only 账本 JSONL 路径，跨批保留历史")
    parser.add_argument("--config", choices=["lenient", "strict"], default="lenient",
                        help="交接状态报告所用的参数组（默认 lenient）")
    args = parser.parse_args()

    if not args.input:
        run_demo()
        return

    cfg = build_configs()[args.config]
    ledger = Ledger(args.ledger)
    samples = load_samples_from_json(args.input)
    attribute_batch(samples, cfg, ledger=ledger)
    print(format_trace_detail(ledger.records))
    print()
    print(format_handover(ledger, cfg))


if __name__ == "__main__":
    main()
