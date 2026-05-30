from models import (
    EquipmentParams, TempCurve, ElectricityData,
    CompetingFuel, SchemeCost, AuditEntry
)
from slicing import slice_by_temp_bands, SliceResult
from typing import List, Dict, Optional


def compare_schemes(
    schemes: List[Dict],
    tc: TempCurve,
    ed: ElectricityData,
    water_outlet_temp_c: float,
    heating_load_kw: float,
    baseline_fuel: Optional[CompetingFuel] = None,
    investment_costs: Optional[Dict[str, float]] = None,
) -> List[SchemeCost]:
    investment_costs = investment_costs or {}
    results: List[SchemeCost] = []

    for scheme in schemes:
        eq: EquipmentParams = scheme["equipment"]
        slices: List[SliceResult] = slice_by_temp_bands(
            eq, tc, ed, water_outlet_temp_c, heating_load_kw
        )

        total_heating = sum(s.total_heating_kwh for s in slices)
        total_electricity = sum(s.total_electricity_kwh for s in slices)
        total_cost = sum(s.total_cost_yuan for s in slices)
        avg_cop = total_heating / total_electricity if total_electricity > 0 else 0

        equivalent_fuel_cost = 0.0
        annual_saving = 0.0
        audit: List[AuditEntry] = []

        src_eq = eq.provenance.source_file if eq.provenance else "未知"
        src_elec = ed.provenance.source_file if ed.provenance else "未知"

        audit.append(AuditEntry(
            step="方案总能耗",
            source=f"设备={src_eq}, 电价={src_elec}",
            input_values={"设备": eq.name, "出水温度": water_outlet_temp_c, "负荷_kW": heating_load_kw},
            output_values={"总制热_kWh": round(total_heating, 1), "总用电_kWh": round(total_electricity, 1), "总费用_元": round(total_cost, 2), "平均COP": round(avg_cop, 4)},
            formula="Σ(slices)"
        ))

        if baseline_fuel:
            fuel_kwh_per_unit = baseline_fuel.energy_per_unit_kwh * baseline_fuel.efficiency
            fuel_units_needed = total_heating / fuel_kwh_per_unit if fuel_kwh_per_unit > 0 else 0
            equivalent_fuel_cost = fuel_units_needed * baseline_fuel.price_per_unit
            annual_saving = equivalent_fuel_cost - total_cost

            audit.append(AuditEntry(
                step="与替代燃料对比",
                source=baseline_fuel.name,
                input_values={
                    "燃料单价": f"{baseline_fuel.price_per_unit}元/{baseline_fuel.unit}",
                    "热值_kWh/单位": baseline_fuel.energy_per_unit_kwh,
                    "效率": baseline_fuel.efficiency,
                    "所需总热量_kWh": round(total_heating, 1)
                },
                output_values={
                    "等效能燃费_元": round(equivalent_fuel_cost, 2),
                    "热泵运行费_元": round(total_cost, 2),
                    "年节省_元": round(annual_saving, 2)
                },
                formula=f"等效燃费 = (Q_total / (热值×效率)) × 单价; 节省 = 燃费 - 电费"
            ))

        payback = None
        invest = investment_costs.get(eq.name)
        if invest and invest > 0 and annual_saving > 0:
            payback = round(invest / annual_saving, 2)
            audit.append(AuditEntry(
                step="回收期",
                source="投资数据",
                input_values={"投资_元": invest, "年节省_元": round(annual_saving, 2)},
                output_values={"回收期_年": payback},
                formula="回收期 = 投资 / 年节省"
            ))

        results.append(SchemeCost(
            scheme_name=eq.name,
            total_heating_kwh=round(total_heating, 1),
            total_electricity_kwh=round(total_electricity, 1),
            total_cost_yuan=round(total_cost, 2),
            avg_cop=round(avg_cop, 4),
            equivalent_fuel_cost_yuan=round(equivalent_fuel_cost, 2),
            annual_saving_yuan=round(annual_saving, 2),
            payback_years=payback,
            audit=audit
        ))

    return results


def format_comparison(scheme_costs: List[SchemeCost], show_audit: bool = False) -> str:
    lines = [
        "=" * 80,
        "  方案费用对比",
        "=" * 80,
        f"  {'方案':>12s} | {'平均COP':>8s} | {'总制热kWh':>12s} | {'总用电kWh':>12s} | {'运行费元':>10s} | {'等效燃费元':>12s} | {'年省元':>10s} | {'回收年':>6s}",
        "-" * 80
    ]

    for sc in scheme_costs:
        payback_str = f"{sc.payback_years:.1f}" if sc.payback_years is not None else "N/A"
        lines.append(
            f"  {sc.scheme_name:>12s} | {sc.avg_cop:>8.3f} | {sc.total_heating_kwh:>12.1f} | {sc.total_electricity_kwh:>12.1f} | {sc.total_cost_yuan:>10.2f} | {sc.equivalent_fuel_cost_yuan:>12.2f} | {sc.annual_saving_yuan:>10.2f} | {payback_str:>6s}"
        )

    lines.append("=" * 80)

    if len(scheme_costs) >= 2:
        best = min(scheme_costs, key=lambda x: x.total_cost_yuan)
        worst = max(scheme_costs, key=lambda x: x.total_cost_yuan)
        diff = worst.total_cost_yuan - best.total_cost_yuan
        lines.append(f"\n  最省方案: {best.scheme_name} (运行费 {best.total_cost_yuan:.2f} 元)")
        lines.append(f"  最贵方案: {worst.scheme_name} (运行费 {worst.total_cost_yuan:.2f} 元)")
        lines.append(f"  年费差异: {diff:.2f} 元")

    if show_audit:
        for sc in scheme_costs:
            lines.append(f"\n  ── {sc.scheme_name} 审计轨迹 ──")
            for a in sc.audit:
                lines.append(f"    [{a.step}] 来源={a.source}")
                lines.append(f"      公式: {a.formula or '(直接赋值)'}")
                lines.append(f"      输入: {a.input_values}")
                lines.append(f"      输出: {a.output_values}")

    return "\n".join(lines)
