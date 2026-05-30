from models import (
    EquipmentParams, TempCurve, ElectricityData,
    SliceResult, AuditEntry, TempBin
)
from cop_calc import calc_cop
from typing import List, Tuple


DEFAULT_BAND_EDGES = [-25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25, 30, 35]


def slice_by_temp_bands(
    eq: EquipmentParams,
    tc: TempCurve,
    ed: ElectricityData,
    water_outlet_temp_c: float,
    heating_load_kw: float,
    band_edges: List[float] = None,
) -> List[SliceResult]:
    if band_edges is None:
        band_edges = DEFAULT_BAND_EDGES

    results: List[SliceResult] = []
    rate = ed.effective_rate()
    src_curve = tc.provenance.source_file if tc.provenance else "未知"
    src_elec = ed.provenance.source_file if ed.provenance else "未知"

    bins_by_band: List[Tuple[str, List[TempBin]]] = []
    for i in range(len(band_edges) - 1):
        lo = band_edges[i]
        hi = band_edges[i + 1]
        label = f"{lo:+.0f}~{hi:+.0f}°C"
        matched = [b for b in tc.bins if lo <= b.outdoor_temp_c < hi]
        bins_by_band.append((label, matched))

    for label, matched_bins in bins_by_band:
        if not matched_bins:
            continue

        total_hours = sum(b.hours for b in matched_bins)
        avg_outdoor = sum(b.outdoor_temp_c * b.hours for b in matched_bins) / total_hours if total_hours > 0 else 0

        cop_result = calc_cop(eq, avg_outdoor, water_outlet_temp_c, heating_load_kw)
        cop = cop_result.actual_cop

        total_heating = heating_load_kw * total_hours
        total_electricity = total_heating / cop if cop > 0 else total_heating
        total_cost = total_electricity * rate

        audit = [
            AuditEntry(
                step="频段汇总",
                source=src_curve,
                input_values={"频段": label, "频段数": len(matched_bins)},
                output_values={"总小时": round(total_hours, 1), "平均室外温度": round(avg_outdoor, 1)},
                formula="加权平均 = Σ(T_i × h_i) / Σ(h_i)"
            ),
            AuditEntry(
                step="能耗计算",
                source=src_elec,
                input_values={"热负荷_kW": heating_load_kw, "COP": cop, "小时": round(total_hours, 1), "电价_元/kWh": rate},
                output_values={"制热量_kWh": round(total_heating, 1), "用电量_kWh": round(total_electricity, 1), "费用_元": round(total_cost, 2)},
                formula="Q_heat = load × hours; E = Q_heat / COP; Cost = E × rate"
            )
        ]

        results.append(SliceResult(
            temp_band=label,
            avg_outdoor_temp_c=round(avg_outdoor, 1),
            total_hours=round(total_hours, 1),
            avg_cop=round(cop, 4),
            total_heating_kwh=round(total_heating, 1),
            total_electricity_kwh=round(total_electricity, 1),
            total_cost_yuan=round(total_cost, 2),
            audit=audit
        ))

    return results


def slice_hourly(
    eq: EquipmentParams,
    tc: TempCurve,
    ed: ElectricityData,
    water_outlet_temp_c: float,
    heating_load_kw: float,
) -> List[SliceResult]:
    rate = ed.effective_rate()
    src_curve = tc.provenance.source_file if tc.provenance else "未知"
    src_elec = ed.provenance.source_file if ed.provenance else "未知"

    results: List[SliceResult] = []
    for b in tc.bins:
        cop_result = calc_cop(eq, b.outdoor_temp_c, water_outlet_temp_c, heating_load_kw)
        cop = cop_result.actual_cop

        total_heating = heating_load_kw * b.hours
        total_electricity = total_heating / cop if cop > 0 else total_heating
        total_cost = total_electricity * rate

        results.append(SliceResult(
            temp_band=f"{b.outdoor_temp_c:+.1f}°C",
            avg_outdoor_temp_c=b.outdoor_temp_c,
            total_hours=b.hours,
            avg_cop=round(cop, 4),
            total_heating_kwh=round(total_heating, 1),
            total_electricity_kwh=round(total_electricity, 1),
            total_cost_yuan=round(total_cost, 2),
            audit=[
                AuditEntry(
                    step="逐频段计算",
                    source=f"曲线={src_curve}, 电价={src_elec}",
                    input_values={"T_out": b.outdoor_temp_c, "T_water": water_outlet_temp_c, "load_kW": heating_load_kw, "hours": b.hours},
                    output_values={"COP": cop, "Q_kWh": round(total_heating, 1), "E_kWh": round(total_electricity, 1), "Cost": round(total_cost, 2)},
                    formula="E = Q / COP; Cost = E × rate"
                )
            ]
        ))

    return results


def format_slice_table(results: List[SliceResult], show_audit: bool = False) -> str:
    lines = [
        "=" * 90,
        "  工况切片结果",
        "=" * 90,
        f"  {'频段':>14s} | {'平均室外°C':>10s} | {'小时':>8s} | {'COP':>6s} | {'制热kWh':>10s} | {'用电kWh':>10s} | {'费用元':>10s}",
        "-" * 90
    ]

    total_hours = 0
    total_heat = 0.0
    total_elec = 0.0
    total_cost = 0.0

    for r in results:
        lines.append(
            f"  {r.temp_band:>14s} | {r.avg_outdoor_temp_c:>+10.1f} | {r.total_hours:>8.1f} | {r.avg_cop:>6.3f} | {r.total_heating_kwh:>10.1f} | {r.total_electricity_kwh:>10.1f} | {r.total_cost_yuan:>10.2f}"
        )
        total_hours += r.total_hours
        total_heat += r.total_heating_kwh
        total_elec += r.total_electricity_kwh
        total_cost += r.total_cost_yuan

    avg_cop = total_heat / total_elec if total_elec > 0 else 0

    lines.append("-" * 90)
    lines.append(
        f"  {'合计':>14s} | {'':>10s} | {total_hours:>8.1f} | {avg_cop:>6.3f} | {total_heat:>10.1f} | {total_elec:>10.1f} | {total_cost:>10.2f}"
    )
    lines.append("=" * 90)

    if show_audit:
        lines.append("\n  各频段审计轨迹:")
        for r in results:
            lines.append(f"\n  ── 频段 {r.temp_band} ──")
            for a in r.audit:
                lines.append(f"    [{a.step}] 来源={a.source}")
                lines.append(f"      公式: {a.formula or '(直接赋值)'}")
                lines.append(f"      输入: {a.input_values}")
                lines.append(f"      输出: {a.output_values}")

    return "\n".join(lines)
