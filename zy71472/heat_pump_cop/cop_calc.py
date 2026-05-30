from models import (
    EquipmentParams, CalcResult, AuditEntry, RatedPoint, TempOperatingRange
)
from typing import List, Optional


def _c_to_k(temp_c: float) -> float:
    return temp_c + 273.15


def _derive_carnot_fraction(eq: EquipmentParams) -> float:
    if eq.carnot_fraction is not None:
        return eq.carnot_fraction
    fractions = []
    for rp in eq.rated_points:
        t_hot = _c_to_k(rp.water_outlet_temp_c)
        t_cold = _c_to_k(rp.outdoor_temp_c)
        delta_t = t_hot - t_cold
        if delta_t <= 0:
            continue
        carnot = t_hot / delta_t
        if carnot > 0 and rp.cop > 0:
            fractions.append(rp.cop / carnot)
    if fractions:
        return sum(fractions) / len(fractions)
    return 0.45


def calc_cop(
    eq: EquipmentParams,
    outdoor_temp_c: float,
    water_outlet_temp_c: float,
    heating_load_kw: Optional[float] = None,
) -> CalcResult:
    audit: List[AuditEntry] = []
    rng = eq.operating_range
    src = eq.provenance.source_file if eq.provenance else "未知"

    t_hot_k = round(_c_to_k(water_outlet_temp_c), 2)
    t_cold_k = round(_c_to_k(outdoor_temp_c), 2)
    delta_t_k = round(t_hot_k - t_cold_k, 2)

    audit.append(AuditEntry(
        step="温度转绝对温度",
        source=src,
        input_values={"outdoor_temp_c": outdoor_temp_c, "water_outlet_temp_c": water_outlet_temp_c},
        output_values={"T_hot": f"{t_hot_k}K", "T_cold": f"{t_cold_k}K", "ΔT": f"{delta_t_k}K"},
        formula="T(K) = T(°C) + 273.15"
    ))

    out_of_range = (
        outdoor_temp_c < rng.outdoor_min_c or outdoor_temp_c > rng.outdoor_max_c
        or water_outlet_temp_c < rng.water_outlet_min_c or water_outlet_temp_c > rng.water_outlet_max_c
    )

    if out_of_range:
        audit.append(AuditEntry(
            step="工况越界检测",
            source=src,
            input_values={"outdoor": outdoor_temp_c, "water_out": water_outlet_temp_c},
            output_values={"range_outdoor": f"[{rng.outdoor_min_c}, {rng.outdoor_max_c}]",
                           "range_water": f"[{rng.water_outlet_min_c}, {rng.water_outlet_max_c}]"},
            formula="",
            warnings=[f"工况超出设备运行范围，COP按1.0(电直热)估算"]
        ))
        return CalcResult(
            outdoor_temp_c=outdoor_temp_c,
            water_outlet_temp_c=water_outlet_temp_c,
            t_hot_k=t_hot_k, t_cold_k=t_cold_k, delta_t_k=delta_t_k,
            carnot_cop=0.0, carnot_fraction=0.0, actual_cop=1.0,
            heating_capacity_kw=heating_load_kw or 0.0,
            compressor_power_kw=heating_load_kw or 0.0,
            audit=audit
        )

    carnot_cop = round(t_hot_k / delta_t_k, 4) if delta_t_k > 0 else 0.0
    audit.append(AuditEntry(
        step="Carnot COP",
        source="热力学公式",
        input_values={"T_hot_K": t_hot_k, "T_cold_K": t_cold_k, "ΔT_K": delta_t_k},
        output_values={"COP_carnot": carnot_cop},
        formula="COP_carnot = T_hot / (T_hot - T_cold)"
    ))

    eta = _derive_carnot_fraction(eq)
    eta_source = "厂家指定" if eq.carnot_fraction is not None else f"由{len(eq.rated_points)}个额定工况点反算平均"
    audit.append(AuditEntry(
        step="第二定律效率(η)",
        source=eta_source,
        input_values={"rated_cops": [round(rp.cop, 4) for rp in eq.rated_points]},
        output_values={"η": eta},
        formula="η = COP_actual / COP_carnot (取各工况点均值)"
    ))

    actual_cop = round(carnot_cop * eta, 4)
    audit.append(AuditEntry(
        step="实际COP",
        source="计算",
        input_values={"COP_carnot": carnot_cop, "η": eta},
        output_values={"COP_actual": actual_cop},
        formula="COP_actual = COP_carnot × η"
    ))

    heating_capacity_kw = 0.0
    compressor_power_kw = 0.0
    if eq.rated_points:
        ref = eq.rated_points[0]
        capacity_ratio = actual_cop / ref.cop if ref.cop > 0 else 1.0
        heating_capacity_kw = round(ref.heating_capacity_kw * capacity_ratio, 2)
        compressor_power_kw = round(heating_capacity_kw / actual_cop, 2) if actual_cop > 0 else 0.0
        audit.append(AuditEntry(
            step="制热量与压缩机功率估算",
            source=f"基于额定工况点(室外{ref.outdoor_temp_c}°C/出水{ref.water_outlet_temp_c}°C)",
            input_values={"ref_capacity_kw": ref.heating_capacity_kw, "ref_cop": ref.cop, "capacity_ratio": round(capacity_ratio, 4)},
            output_values={"heating_capacity_kw": heating_capacity_kw, "compressor_power_kw": compressor_power_kw},
            formula="capacity_ratio = COP_actual / COP_rated; Q = Q_rated × ratio; P = Q / COP_actual"
        ))
    elif heating_load_kw:
        heating_capacity_kw = heating_load_kw
        compressor_power_kw = round(heating_load_kw / actual_cop, 2) if actual_cop > 0 else 0.0
        audit.append(AuditEntry(
            step="制热量与压缩机功率(按负荷)",
            source="用户输入负荷",
            input_values={"heating_load_kw": heating_load_kw, "COP_actual": actual_cop},
            output_values={"compressor_power_kw": compressor_power_kw},
            formula="P = Q / COP_actual"
        ))

    return CalcResult(
        outdoor_temp_c=outdoor_temp_c,
        water_outlet_temp_c=water_outlet_temp_c,
        t_hot_k=t_hot_k, t_cold_k=t_cold_k, delta_t_k=delta_t_k,
        carnot_cop=carnot_cop, carnot_fraction=eta,
        actual_cop=actual_cop,
        heating_capacity_kw=heating_capacity_kw,
        compressor_power_kw=compressor_power_kw,
        audit=audit
    )


def format_calc_detail(result: CalcResult) -> str:
    lines = [
        "=" * 55,
        f"  COP计算详情",
        "=" * 55,
        f"  室外温度:     {result.outdoor_temp_c:+.1f} °C  ({result.t_cold_k:.2f} K)",
        f"  出水温度:       {result.water_outlet_temp_c:.1f} °C  ({result.t_hot_k:.2f} K)",
        f"  温差 ΔT:              {result.delta_t_k:.2f} K",
        f"  Carnot COP:           {result.carnot_cop:.4f}",
        f"  第二定律效率 η:       {result.carnot_fraction:.4f}",
        f"  实际 COP:             {result.actual_cop:.4f}",
        f"  估算制热量:          {result.heating_capacity_kw:.2f} kW",
        f"  估算压缩机功率:      {result.compressor_power_kw:.2f} kW",
        "-" * 55,
    ]
    if result.audit:
        lines.append("  计算审计轨迹:")
        for a in result.audit:
            lines.append(f"    [{a.step}] 来源={a.source}")
            lines.append(f"      公式: {a.formula or '(直接赋值)'}")
            lines.append(f"      输入: {a.input_values}")
            lines.append(f"      输出: {a.output_values}")
            if a.warnings:
                for w in a.warnings:
                    lines.append(f"      ⚠ {w}")
    lines.append("=" * 55)
    return "\n".join(lines)
