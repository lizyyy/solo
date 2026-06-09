"""核心归因引擎：公式/单位/阈值边界判定、备件到货窗口校验"""
import yaml
import os
from datetime import datetime
from typing import Tuple, Optional, List, Dict, Any

from .models import (
    Measurement, SparePart, AnomalyLevel, BoundaryReason,
    BoundaryDetail, EvidenceItem, AttributionRecord
)


CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config", "thresholds.yaml")


def load_thresholds() -> Dict:
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


class AttributionEngine:
    def __init__(self, thresholds: Optional[Dict] = None):
        self.thresholds = thresholds or load_thresholds()
        self.cfg = self.thresholds.get("blade_anomaly", {})
        self.spare_cfg = self.thresholds.get("spare_parts", {})

    def _check_vibration(self, m: Measurement) -> Tuple[AnomalyLevel, BoundaryDetail, EvidenceItem]:
        vib_cfg = self.cfg.get("vibration", {})
        val = m.vibration_velocity
        unit = m.vibration_unit
        warn = vib_cfg.get("warning", 4.5)
        crit = vib_cfg.get("critical", 7.1)
        tol = vib_cfg.get("tolerance", 0.1)
        formula = vib_cfg.get("formula", "")
        expected_unit = vib_cfg.get("unit", "mm/s")

        calc = f"{formula.replace('threshold', str(warn))} = {val} {unit} > {warn} {expected_unit}"
        level = AnomalyLevel.NORMAL
        boundary = BoundaryDetail(metric="振动速度", formula=formula, raw_value=val,
                                   threshold_value=warn, tolerance=tol, unit=unit)
        reason = None

        if unit != expected_unit:
            reason = BoundaryReason.UNIT
            boundary.reason = reason
            boundary.description = f"单位不匹配: 记录={unit}, 标准={expected_unit}"
            level = AnomalyLevel.BOUNDARY
        elif abs(val - warn) <= tol:
            reason = BoundaryReason.THRESHOLD
            boundary.reason = reason
            boundary.is_boundary = True
            boundary.description = f"振动速度{val}{unit}在预警阈值{warn}±{tol}容差内"
            level = AnomalyLevel.BOUNDARY
        elif abs(val - crit) <= tol:
            reason = BoundaryReason.THRESHOLD
            boundary.reason = reason
            boundary.is_boundary = True
            boundary.threshold_value = crit
            boundary.description = f"振动速度{val}{unit}在严重阈值{crit}±{tol}容差内"
            level = AnomalyLevel.BOUNDARY
        elif val > crit:
            level = AnomalyLevel.CRITICAL
            boundary.description = f"振动速度{val}{unit}超过严重阈值{crit}"
        elif val > warn:
            level = AnomalyLevel.WARNING
            boundary.description = f"振动速度{val}{unit}超过预警阈值{warn}"

        evidence = EvidenceItem(
            step_order=1,
            step_name="振动阈值判定",
            source_data={"vibration_velocity": val, "unit": unit, "warning": warn, "critical": crit, "tolerance": tol},
            calculation=calc,
            intermediate_result=f"判定结果={level.value}" + (f", 边界原因={reason.value}" if reason else "")
        )
        return level, boundary, evidence

    def _check_temperature(self, m: Measurement) -> Tuple[AnomalyLevel, BoundaryDetail, EvidenceItem]:
        t_cfg = self.cfg.get("temperature", {})
        delta = m.temperature - m.ambient_temp
        unit = m.temp_unit
        warn_d = t_cfg.get("warning_delta", 25)
        crit_d = t_cfg.get("critical_delta", 40)
        tol = t_cfg.get("tolerance", 0.5)
        formula = t_cfg.get("formula", "")
        expected_unit = t_cfg.get("unit", "°C")

        calc = f"{formula.replace('delta_threshold', str(warn_d))} = {m.temperature}-{m.ambient_temp}={delta}{unit} > {warn_d}"
        level = AnomalyLevel.NORMAL
        boundary = BoundaryDetail(metric="温度差", formula=formula, raw_value=delta,
                                   threshold_value=warn_d, tolerance=tol, unit=unit)
        reason = None

        if unit != expected_unit:
            reason = BoundaryReason.UNIT
            boundary.reason = reason
            boundary.description = f"温度单位不匹配: 记录={unit}, 标准={expected_unit}"
            level = AnomalyLevel.BOUNDARY
        elif abs(delta - warn_d) <= tol:
            reason = BoundaryReason.THRESHOLD
            boundary.reason = reason
            boundary.is_boundary = True
            boundary.description = f"温度差{delta}{unit}在预警差{warn_d}±{tol}容差内"
            level = AnomalyLevel.BOUNDARY
        elif abs(delta - crit_d) <= tol:
            reason = BoundaryReason.THRESHOLD
            boundary.reason = reason
            boundary.is_boundary = True
            boundary.threshold_value = crit_d
            boundary.description = f"温度差{delta}{unit}在严重差{crit_d}±{tol}容差内"
            level = AnomalyLevel.BOUNDARY
        elif delta > crit_d:
            level = AnomalyLevel.CRITICAL
            boundary.description = f"温度差{delta}{unit}超过严重差{crit_d}"
        elif delta > warn_d:
            level = AnomalyLevel.WARNING
            boundary.description = f"温度差{delta}{unit}超过预警差{warn_d}"

        evidence = EvidenceItem(
            step_order=2,
            step_name="温度差判定",
            source_data={"temp": m.temperature, "ambient": m.ambient_temp, "delta": delta,
                         "warning_delta": warn_d, "critical_delta": crit_d, "tolerance": tol},
            calculation=calc,
            intermediate_result=f"判定结果={level.value}" + (f", 边界原因={reason.value}" if reason else "")
        )
        return level, boundary, evidence

    def _check_pitch(self, m: Measurement) -> Tuple[AnomalyLevel, BoundaryDetail, EvidenceItem]:
        p_cfg = self.cfg.get("pitch_angle", {})
        offset = abs(m.pitch_angle - m.pitch_reference)
        unit = m.pitch_unit
        warn_o = p_cfg.get("warning_offset", 2.0)
        crit_o = p_cfg.get("critical_offset", 5.0)
        tol = p_cfg.get("tolerance", 0.1)
        formula = p_cfg.get("formula", "")
        expected_unit = p_cfg.get("unit", "°")

        calc = (f"{formula.replace('offset', str(warn_o))} = |{m.pitch_angle}-{m.pitch_reference}|"
                f"={offset}{unit} > {warn_o}")
        level = AnomalyLevel.NORMAL
        boundary = BoundaryDetail(metric="桨距角偏差", formula=formula, raw_value=offset,
                                   threshold_value=warn_o, tolerance=tol, unit=unit)
        reason = None

        if unit != expected_unit:
            reason = BoundaryReason.UNIT
            boundary.reason = reason
            boundary.description = f"桨距角单位不匹配: 记录={unit}, 标准={expected_unit}"
            level = AnomalyLevel.BOUNDARY
        elif abs(offset - warn_o) <= tol:
            reason = BoundaryReason.THRESHOLD
            boundary.reason = reason
            boundary.is_boundary = True
            boundary.description = f"桨距偏差{offset}{unit}在预警偏差{warn_o}±{tol}容差内"
            level = AnomalyLevel.BOUNDARY
        elif abs(offset - crit_o) <= tol:
            reason = BoundaryReason.THRESHOLD
            boundary.reason = reason
            boundary.is_boundary = True
            boundary.threshold_value = crit_o
            boundary.description = f"桨距偏差{offset}{unit}在严重偏差{crit_o}±{tol}容差内"
            level = AnomalyLevel.BOUNDARY
        elif offset > crit_o:
            level = AnomalyLevel.CRITICAL
            boundary.description = f"桨距偏差{offset}{unit}超过严重偏差{crit_o}"
        elif offset > warn_o:
            level = AnomalyLevel.WARNING
            boundary.description = f"桨距偏差{offset}{unit}超过预警偏差{warn_o}"

        evidence = EvidenceItem(
            step_order=3,
            step_name="桨距角偏差判定",
            source_data={"pitch": m.pitch_angle, "reference": m.pitch_reference, "offset": offset,
                         "warning_offset": warn_o, "critical_offset": crit_o, "tolerance": tol},
            calculation=calc,
            intermediate_result=f"判定结果={level.value}" + (f", 边界原因={reason.value}" if reason else "")
        )
        return level, boundary, evidence

    def _merge_level(self, levels: List[AnomalyLevel]) -> AnomalyLevel:
        order = [AnomalyLevel.NORMAL, AnomalyLevel.WARNING, AnomalyLevel.CRITICAL, AnomalyLevel.BOUNDARY]
        return max(levels, key=lambda l: order.index(l))

    def check_spare_parts_window(self, parts: List[SparePart], shutdown_window_end: str) -> List[Dict]:
        """检查备件到货是否晚于停机窗口"""
        issues = []
        window_end = datetime.strptime(shutdown_window_end, "%Y-%m-%d")
        for p in parts:
            arr = datetime.strptime(p.arrival_date, "%Y-%m-%d")
            delay_days = (arr - window_end).days
            lead_time = self.spare_cfg.get("lead_time_days", {}).get(p.part_code,
                        self.spare_cfg.get("lead_time_days", {}).get("default", 3))
            p.lead_time_days = lead_time
            if delay_days > 0:
                issues.append({
                    "part_code": p.part_code,
                    "part_name": p.part_name,
                    "shutdown_window_end": shutdown_window_end,
                    "arrival_date": p.arrival_date,
                    "delay_days": delay_days,
                    "lead_time_days": lead_time,
                    "description": f"备件{p.part_name}({p.part_code})到货晚于停机窗口{delay_days}天(标准交期{lead_time}天)"
                })
        return issues

    def attribute(self, measurement: Measurement, spare_parts: Optional[List[SparePart]] = None,
                  shutdown_window_end: Optional[str] = None, handover_notes: str = "") -> AttributionRecord:
        """执行完整归因判定"""
        parts = spare_parts or []
        record_id = f"BA-{measurement.turbine_id}-B{measurement.blade_no}-{measurement.timestamp.replace('-','').replace(' ','').replace(':','')}"

        v_level, v_bd, v_ev = self._check_vibration(measurement)
        t_level, t_bd, t_ev = self._check_temperature(measurement)
        p_level, p_bd, p_ev = self._check_pitch(measurement)

        levels = [v_level, t_level, p_level]
        final_level = self._merge_level(levels)

        boundary_map = {AnomalyLevel.BOUNDARY: [], AnomalyLevel.CRITICAL: [], AnomalyLevel.WARNING: []}
        for lv, bd in [(v_level, v_bd), (t_level, t_bd), (p_level, p_bd)]:
            if bd.reason or bd.description:
                boundary_map[lv].append(bd)

        final_bd = BoundaryDetail()
        if final_level == AnomalyLevel.BOUNDARY and boundary_map[AnomalyLevel.BOUNDARY]:
            final_bd = boundary_map[AnomalyLevel.BOUNDARY][0]
        elif boundary_map[AnomalyLevel.CRITICAL]:
            final_bd = boundary_map[AnomalyLevel.CRITICAL][0]
        elif boundary_map[AnomalyLevel.WARNING]:
            final_bd = boundary_map[AnomalyLevel.WARNING][0]

        evidence_chain = [v_ev, t_ev, p_ev]

        spare_issues = []
        if parts and shutdown_window_end:
            spare_issues = self.check_spare_parts_window(parts, shutdown_window_end)
            if spare_issues:
                spare_evidence = EvidenceItem(
                    step_order=4,
                    step_name="备件到货窗口校验",
                    source_data={"shutdown_window_end": shutdown_window_end, "parts": [p.part_code for p in parts]},
                    calculation="到货日期 > 停机窗口结束日期",
                    intermediate_result=f"发现{len(spare_issues)}项备件到货延迟"
                )
                evidence_chain.append(spare_evidence)

        root_cause_parts = []
        if v_level != AnomalyLevel.NORMAL:
            root_cause_parts.append(f"振动异常({v_level.value})")
        if t_level != AnomalyLevel.NORMAL:
            root_cause_parts.append(f"温度异常({t_level.value})")
        if p_level != AnomalyLevel.NORMAL:
            root_cause_parts.append(f"桨距异常({p_level.value})")
        if spare_issues:
            root_cause_parts.append(f"{len(spare_issues)}项备件到货延迟")

        root_cause = "、".join(root_cause_parts) if root_cause_parts else "无异常"

        conclusion_parts = [final_bd.description] if final_bd.description else []
        if spare_issues:
            conclusion_parts.extend([i["description"] for i in spare_issues])
        conclusion = "；".join(conclusion_parts) if conclusion_parts else (
            f"{measurement.turbine_id}-B{measurement.blade_no}各项指标正常"
        )

        verdict_source = "自动判定"
        if final_level == AnomalyLevel.BOUNDARY:
            verdict_source = "边界样本-待人工确认"

        record = AttributionRecord(
            record_id=record_id,
            measurement=measurement,
            level=final_level,
            root_cause=root_cause,
            conclusion=conclusion,
            boundary_detail=final_bd,
            spare_parts=parts,
            evidence_chain=evidence_chain,
            handover_notes=handover_notes,
            final_verdict_source=verdict_source
        )
        record.version.record_id = record_id
        return record
