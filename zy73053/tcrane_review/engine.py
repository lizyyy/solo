#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""塔吊维保报告复核 - 核心引擎"""

import csv
import io
import json
import os
import re
import sys
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


DATA_DIR = Path(__file__).resolve().parent.parent / "data"
SENSOR_DIR = DATA_DIR / "sensor_logs"
REPORT_PATH = DATA_DIR / "maintenance_report.json"
BOM_PATH = DATA_DIR / "spec_bom.json"


# ============ 数据结构 ============

@dataclass
class SensorReading:
    ts: str
    temp_C: float
    vibration_mm_s: float
    pressure_MPa: Optional[float]
    load_t: float
    source_id: str
    line_no: int
    source_file: str
    raw_line: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "ts": self.ts,
            "temp_C": self.temp_C,
            "vibration_mm_s": self.vibration_mm_s,
            "pressure_MPa": self.pressure_MPa,
            "load_t": self.load_t,
            "source_id": self.source_id,
            "line_no": self.line_no,
            "source_file": self.source_file,
        }


@dataclass
class SourceRef:
    file: str
    line_no: int
    ts: str
    detail: str = ""

    def __str__(self) -> str:
        base = f"文件[{self.file}] 行{self.line_no} 时间[{self.ts}]"
        if self.detail:
            base += f" 细节:{self.detail}"
        return base


@dataclass
class ThresholdBreach:
    sensor_id: str
    metric: str
    value: float
    threshold_type: str  # warning / alarm / warning_low / alarm_low
    threshold_value: float
    source: SourceRef
    load_at_breach: float

    def severity(self) -> str:
        if "alarm" in self.threshold_type:
            return "严重"
        return "警告"


@dataclass
class PartCheckResult:
    part_name: str
    model_claimed: str
    model_actual: str
    is_consistent: bool
    approved_models: List[str]
    issue: str
    blocking_step: str  # 卡在哪个流程环节
    tolerance_note: str = ""
    blocked: bool = True  # 是否阻塞复核通过

    def stage_tag(self) -> str:
        return self.blocking_step


@dataclass
class BoundaryEventJudgement:
    event_id: str
    claimed_time: str
    claimed_desc: str
    claimed_conclusion: str
    sensor_matches: List[ThresholdBreach]
    actual_conclusion: str  # 复核后的结论
    justification: str  # 判定依据
    verdict: str  # 同意/驳回/需补充证据


@dataclass
class ReviewResult:
    report_id: str
    run_id: str
    run_time: str
    review_status: str  # BLOCKED / PASSED / NEEDS_ATTENTION
    part_checks: List[PartCheckResult]
    sensor_breaches: List[ThresholdBreach]
    boundary_judgements: List[BoundaryEventJudgement]
    notes: List[str] = field(default_factory=list)
    handover_note: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "report_id": self.report_id,
            "run_id": self.run_id,
            "run_time": self.run_time,
            "review_status": self.review_status,
            "part_checks": [asdict(p) for p in self.part_checks],
            "sensor_breaches": [
                {
                    "sensor_id": b.sensor_id,
                    "metric": b.metric,
                    "value": b.value,
                    "threshold_type": b.threshold_type,
                    "threshold_value": b.threshold_value,
                    "severity": b.severity(),
                    "source": {
                        "file": b.source.file,
                        "line_no": b.source.line_no,
                        "ts": b.source.ts,
                        "detail": b.source.detail,
                    },
                    "load_at_breach": b.load_at_breach,
                }
                for b in self.sensor_breaches
            ],
            "boundary_judgements": [asdict(j) for j in self.boundary_judgements],
            "notes": self.notes,
            "handover_note": self.handover_note,
        }


# ============ 传感器日志解析与溯源 ============

def parse_sensor_log(file_path: Path) -> Tuple[List[SensorReading], List[str]]:
    readings: List[SensorReading] = []
    header_lines: List[str] = []
    filename = file_path.name

    with open(file_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    csv_started = False
    csv_content = []
    for idx, raw in enumerate(lines, start=1):
        line = raw.rstrip("\n")
        if line.startswith("#"):
            header_lines.append(line.lstrip("# ").strip())
            continue
        if not line.strip():
            continue
        if not csv_started:
            csv_started = True
            csv_content.append(line)
            continue
        csv_content.append(line)

    reader = csv.DictReader(io.StringIO("\n".join(csv_content)))
    for row in reader:
        ln = int(row["line_no"])
        readings.append(SensorReading(
            ts=row["ts"],
            temp_C=float(row["temp_C"]),
            vibration_mm_s=float(row["vibration_mm_s"]),
            pressure_MPa=float(row["pressure_MPa"]) if row.get("pressure_MPa") else None,
            load_t=float(row["load_t"]),
            source_id=row["source_id"],
            line_no=ln,
            source_file=filename,
            raw_line=lines[ln + 2].rstrip("\n") if ln + 2 <= len(lines) else "",
        ))

    return readings, header_lines


def load_all_sensor_data() -> Tuple[Dict[str, List[SensorReading]], Dict[str, List[str]]]:
    all_readings: Dict[str, List[SensorReading]] = {}
    all_headers: Dict[str, List[str]] = {}
    for log_file in sorted(SENSOR_DIR.glob("*.log")):
        readings, headers = parse_sensor_log(log_file)
        key = log_file.name
        all_readings[key] = readings
        all_headers[key] = headers
        for r in readings:
            sid = r.source_id
            all_readings.setdefault(sid, [])
            if r not in all_readings[sid]:
                all_readings[sid].append(r)
    return all_readings, all_headers


# ============ 阈值判定（边界样本） ============

def check_thresholds(
    readings: List[SensorReading], thresholds: Dict[str, Any]
) -> List[ThresholdBreach]:
    breaches: List[ThresholdBreach] = []
    for r in readings:
        sid = r.source_id
        if sid not in thresholds:
            continue
        th = thresholds[sid]

        for metric_key, rules in th.items():
            val = getattr(r, metric_key, None)
            if val is None:
                continue
            for rule_name, rule_val in rules.items():
                hit = False
                if rule_name == "warning" and val > rule_val:
                    hit = True
                elif rule_name == "alarm" and val > rule_val:
                    hit = True
                elif rule_name == "warning_low" and val < rule_val:
                    hit = True
                elif rule_name == "alarm_low" and val < rule_val:
                    hit = True
                if hit:
                    breaches.append(ThresholdBreach(
                        sensor_id=sid,
                        metric=metric_key,
                        value=val,
                        threshold_type=rule_name,
                        threshold_value=rule_val,
                        source=SourceRef(
                            file=r.source_file,
                            line_no=r.line_no,
                            ts=r.ts,
                            detail=f"{metric_key}={val}",
                        ),
                        load_at_breach=r.load_t,
                    ))
    return breaches


# ============ 备件型号校验 ============

def parse_oring_dims(model: str) -> Optional[Dict[str, float]]:
    m = re.match(r".*-O-RING-(\d+)×(\d+)-.*", model)
    if not m:
        return None
    return {"inner_dia": float(m.group(1)), "cross_section": float(m.group(2))}


def check_parts(
    parts: List[Dict[str, Any]], bom: Dict[str, Any]
) -> List[PartCheckResult]:
    results: List[PartCheckResult] = []
    specs = {p["name"]: p for p in bom["parts_spec"]}

    for p in parts:
        name = p["name"]
        spec = specs.get(name, {})
        approved = spec.get("approved_models", [])
        model_claimed = p["model_claimed"]
        model_actual = p["model_actual"]
        is_consistent_claimed = bool(p.get("is_replacement_consistent", True))
        tolerance_note = spec.get("tolerance_note", "")

        # Step 1: 报单型号是否在批准清单
        if model_claimed not in approved:
            results.append(PartCheckResult(
                part_name=name,
                model_claimed=model_claimed,
                model_actual=model_actual,
                is_consistent=False,
                approved_models=approved,
                issue=f"报单型号 {model_claimed} 不在批准清单 {approved} 内",
                blocking_step="【步骤1】备件报单型号准入校验",
                tolerance_note=tolerance_note,
                blocked=True,
            ))
            continue

        # Step 2: 实际领用型号是否与报单一致
        if model_claimed != model_actual:
            # 进一步判断：尺寸公差是否可替代（密封圈场景）
            extra = ""
            dims_spec = None
            dims_actual = None
            if "inner_dia_mm" in spec:
                dims_spec = {
                    "inner_dia": spec["inner_dia_mm"],
                    "inner_tol": spec["inner_dia_tolerance_mm"],
                    "cross_section": spec.get("cross_section_mm"),
                }
                dims_actual = parse_oring_dims(model_actual)
            substitutable = False
            if dims_spec and dims_actual:
                diff = abs(dims_spec["inner_dia"] - dims_actual["inner_dia"])
                if diff <= dims_spec["inner_tol"] and (
                    dims_spec["cross_section"] is None
                    or abs(dims_spec["cross_section"] - dims_actual["cross_section"]) < 0.01
                ):
                    substitutable = True
            if not substitutable:
                size_info = ""
                if dims_spec and dims_actual:
                    diff_inner = abs(dims_spec["inner_dia"] - dims_actual["inner_dia"])
                    size_info = (f"（规格内径{dims_spec['inner_dia']}mm vs 实际内径{dims_actual['inner_dia']}mm，"
                                 f"偏差{diff_inner}mm > 公差±{dims_spec['inner_tol']}mm）")
                results.append(PartCheckResult(
                    part_name=name,
                    model_claimed=model_claimed,
                    model_actual=model_actual,
                    is_consistent=False,
                    approved_models=approved,
                    issue=(f"实际领用 {model_actual} 与报单 {model_claimed} 不一致，"
                           f"且尺寸公差/型号不在可替代范围{size_info}"),
                    blocking_step="【步骤2】备件实际领用型号与报单一致性校验（含公差比对）",
                    tolerance_note=tolerance_note,
                    blocked=True,
                ))
                continue

        # Step 3: 报告自填一致标记是否与校验相符
        if not is_consistent_claimed and model_claimed == model_actual:
            results.append(PartCheckResult(
                part_name=name,
                model_claimed=model_claimed,
                model_actual=model_actual,
                is_consistent=True,
                approved_models=approved,
                issue="报告自填is_replacement_consistent=false，但校验一致，建议核实",
                blocking_step="【步骤3】报告自填一致性标记复核",
                tolerance_note=tolerance_note,
                blocked=False,
            ))
            continue

        # Pass
        results.append(PartCheckResult(
            part_name=name,
            model_claimed=model_claimed,
            model_actual=model_actual,
            is_consistent=True,
            approved_models=approved,
            issue="",
            blocking_step="",
            tolerance_note=tolerance_note,
            blocked=False,
        ))
    return results


# ============ 边界事件判定 ============

def judge_boundary_events(
    events: List[Dict[str, Any]], breaches: List[ThresholdBreach],
    readings_by_sensor: Dict[str, List[SensorReading]]
) -> List[BoundaryEventJudgement]:
    judgements: List[BoundaryEventJudgement] = []

    for evt in events:
        ev_time = evt["time"]
        # 时间窗口内找对应 breach（前后 2 分钟）
        t_evt = datetime.fromisoformat(ev_time)
        matched = []
        for b in breaches:
            t_b = datetime.fromisoformat(b.source.ts)
            if abs((t_b - t_evt).total_seconds()) <= 120:
                matched.append(b)

        if not matched:
            judgements.append(BoundaryEventJudgement(
                event_id=evt["event_id"],
                claimed_time=ev_time,
                claimed_desc=evt["description"],
                claimed_conclusion=evt["conclusion_claimed"],
                sensor_matches=[],
                actual_conclusion="传感器日志中未找到对应时间窗口内的越限记录",
                justification=f"在 {ev_time} 前后120秒内未发现任何阈值越限，请核对事件时间或传感器数据源",
                verdict="需补充证据",
            ))
            continue

        # 判断严重程度
        max_sev = max((b.severity() for b in matched), default="警告")
        alarm_count = sum(1 for b in matched if b.severity() == "严重")
        load_vals = [b.load_at_breach for b in matched]
        max_load = max(load_vals) if load_vals else 0

        if alarm_count >= 1 and max_load >= 9.0:
            conclusion = (f"存在{alarm_count}条严重告警，最大载荷{max_load}t，"
                          f"达到边界样本标准——不可直接归类为『正常现象无需处理』，"
                          f"需补充事后检查记录（齿轮箱磨损、润滑脂状态）")
            verdict = "驳回"
        else:
            conclusion = (f"时间匹配{len(matched)}条越限记录（最高{max_sev}），"
                          f"载荷{max_load}t，若后续无二次告警可归类为边界样本放行")
            verdict = "同意但需备注"

        just_parts = []
        for b in matched:
            just_parts.append(
                f"[{b.severity()}] {b.sensor_id} {b.metric}={b.value} "
                f"(阈值{b.threshold_value} {b.threshold_type}) "
                f"来源: {b.source}"
            )
        justification = "\n".join(just_parts)

        judgements.append(BoundaryEventJudgement(
            event_id=evt["event_id"],
            claimed_time=ev_time,
            claimed_desc=evt["description"],
            claimed_conclusion=evt["conclusion_claimed"],
            sensor_matches=matched,
            actual_conclusion=conclusion,
            justification=justification,
            verdict=verdict,
        ))

    return judgements


# ============ 主复核流程 ============

def run_review(notes: Optional[List[str]] = None, handover_note: str = "",
               run_id_suffix: str = "") -> ReviewResult:
    with open(REPORT_PATH, "r", encoding="utf-8") as f:
        report = json.load(f)
    with open(BOM_PATH, "r", encoding="utf-8") as f:
        bom = json.load(f)

    all_readings, _ = load_all_sensor_data()

    # 阈值越限
    all_flat: List[SensorReading] = []
    for key, rs in all_readings.items():
        if key.startswith("SNS-"):
            all_flat.extend(rs)
    breaches = check_thresholds(all_flat, bom["sensor_thresholds"])

    # 备件校验
    part_checks = check_parts(report["parts_replaced"], bom)

    # 边界事件
    judgements = judge_boundary_events(
        report.get("boundary_events_claimed", []), breaches, all_readings
    )

    # 总体状态
    has_blocked_parts = any(p.blocked for p in part_checks)
    has_rejected_events = any(j.verdict == "驳回" for j in judgements)
    if has_blocked_parts:
        status = "BLOCKED"
    elif has_rejected_events:
        status = "NEEDS_ATTENTION"
    else:
        status = "PASSED"

    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    run_id = f"RUN-{report['report_id']}-{ts}{run_id_suffix}"
    run_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    result = ReviewResult(
        report_id=report["report_id"],
        run_id=run_id,
        run_time=run_time,
        review_status=status,
        part_checks=part_checks,
        sensor_breaches=breaches,
        boundary_judgements=judgements,
        notes=list(notes or []),
        handover_note=handover_note,
    )
    return result
