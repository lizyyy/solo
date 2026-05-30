from models import (
    EquipmentParams, TempCurve, ElectricityData,
    CalcResult, AuditEntry, DataStore, TempBin
)
from typing import List, Optional, Tuple


class DiagnosticError:
    def __init__(self, level: str, code: str, message: str,
                 source_file: str = "", source_type: str = "",
                 field: str = "", value=None, suggested_fix: str = ""):
        self.level = level
        self.code = code
        self.message = message
        self.source_file = source_file
        self.source_type = source_type
        self.field = field
        self.value = value
        self.suggested_fix = suggested_fix

    def __str__(self):
        parts = [f"[{self.level}] {self.code}: {self.message}"]
        if self.source_file:
            parts.append(f"  材料来源: {self.source_file} (类型={self.source_type})")
        if self.field:
            parts.append(f"  字段: {self.field}  当前值: {self.value}")
        if self.suggested_fix:
            parts.append(f"  建议操作: {self.suggested_fix}")
        return "\n".join(parts)


class Diagnostics:

    TEMP_OUT_OF_RANGE = "TEMP_OUT_OF_RANGE"
    UNIT_MISMATCH = "UNIT_MISMATCH"
    DUPLICATE_ENERGY = "DUPLICATE_ENERGY"
    MISSING_DATA = "MISSING_DATA"
    PHYSICS_WARNING = "PHYSICS_WARNING"
    DATA_CONSISTENCY = "DATA_CONSISTENCY"

    @staticmethod
    def check_equipment(eq: EquipmentParams) -> List[DiagnosticError]:
        errors = []
        src = eq.provenance.source_file if eq.provenance else "未知"
        rng = eq.operating_range

        for i, rp in enumerate(eq.rated_points):
            if rp.outdoor_temp_c < rng.outdoor_min_c or rp.outdoor_temp_c > rng.outdoor_max_c:
                errors.append(DiagnosticError(
                    level="ERROR",
                    code=Diagnostics.TEMP_OUT_OF_RANGE,
                    message=f"额定工况点#{i+1}的室外温度{rp.outdoor_temp_c}°C超出设备运行范围[{rng.outdoor_min_c}, {rng.outdoor_max_c}]°C",
                    source_file=src, source_type="equipment",
                    field=f"rated_points[{i}].outdoor_temp_c", value=rp.outdoor_temp_c,
                    suggested_fix="核实厂家参数表，确认该工况点是否需特殊说明，或修正运行范围"
                ))
            if rp.water_outlet_temp_c < rng.water_outlet_min_c or rp.water_outlet_temp_c > rng.water_outlet_max_c:
                errors.append(DiagnosticError(
                    level="ERROR",
                    code=Diagnostics.TEMP_OUT_OF_RANGE,
                    message=f"额定工况点#{i+1}的出水温度{rp.water_outlet_temp_c}°C超出设备运行范围[{rng.water_outlet_min_c}, {rng.water_outlet_max_c}]°C",
                    source_file=src, source_type="equipment",
                    field=f"rated_points[{i}].water_outlet_temp_c", value=rp.water_outlet_temp_c,
                    suggested_fix="核实厂家参数表，确认该工况点是否需特殊说明，或修正运行范围"
                ))
            if rp.cop < 1.0 or rp.cop > 8.0:
                errors.append(DiagnosticError(
                    level="WARNING",
                    code=Diagnostics.PHYSICS_WARNING,
                    message=f"额定工况点#{i+1}的COP={rp.cop}，超出常见热泵COP范围[1.0, 8.0]",
                    source_file=src, source_type="equipment",
                    field=f"rated_points[{i}].cop", value=rp.cop,
                    suggested_fix="检查制热量和压缩机功率的单位是否一致(kW)，确认COP=制热量/压缩机功率"
                ))
            if rp.heating_capacity_kw <= 0 or rp.compressor_power_kw <= 0:
                errors.append(DiagnosticError(
                    level="ERROR",
                    code=Diagnostics.DATA_CONSISTENCY,
                    message=f"额定工况点#{i+1}的制热量或压缩机功率非正数",
                    source_file=src, source_type="equipment",
                    field=f"rated_points[{i}]", value=f"Q={rp.heating_capacity_kw}, P={rp.compressor_power_kw}",
                    suggested_fix="确认数据单位为kW，检查是否误用了W或其它单位"
                ))

        if not eq.rated_points:
            errors.append(DiagnosticError(
                level="ERROR",
                code=Diagnostics.MISSING_DATA,
                message=f"设备'{eq.name}'缺少额定工况点数据",
                source_file=src, source_type="equipment",
                field="rated_points", value="[]",
                suggested_fix="补充至少一个额定工况点(室外温度、出水温度、制热量、压缩机功率)"
            ))
        return errors

    @staticmethod
    def check_temp_curve(tc: TempCurve, eq: EquipmentParams) -> List[DiagnosticError]:
        errors = []
        src = tc.provenance.source_file if tc.provenance else "未知"
        rng = eq.operating_range
        out_of_range_bins = []

        for i, b in enumerate(tc.bins):
            if b.outdoor_temp_c < rng.outdoor_min_c or b.outdoor_temp_c > rng.outdoor_max_c:
                out_of_range_bins.append(b)
            if b.hours < 0:
                errors.append(DiagnosticError(
                    level="ERROR",
                    code=Diagnostics.DATA_CONSISTENCY,
                    message=f"温度频段#{i+1}的小时数为负({b.hours})",
                    source_file=src, source_type="temp_curve",
                    field=f"bins[{i}].hours", value=b.hours,
                    suggested_fix="检查温度频段数据，小时数不能为负"
                ))

        if out_of_range_bins:
            total_hours = sum(b.hours for b in out_of_range_bins)
            temps = [b.outdoor_temp_c for b in out_of_range_bins]
            errors.append(DiagnosticError(
                level="WARNING",
                code=Diagnostics.TEMP_OUT_OF_RANGE,
                message=f"温度曲线有{len(out_of_range_bins)}个频段({min(temps)}~{max(temps)}°C)超出设备运行范围[{rng.outdoor_min_c}, {rng.outdoor_max_c}]°C，合计{total_hours:.0f}小时将按COP=1.0(电直热)估算",
                source_file=src, source_type="temp_curve",
                field="bins", value=f"越界频段数={len(out_of_range_bins)}",
                suggested_fix=f"确认项目设计温度({tc.design_outdoor_temp_c}°C)是否正确，或选择运行范围更宽的设备"
            ))

        total_hours = sum(b.hours for b in tc.bins)
        if total_hours < 100 or total_hours > 8784:
            errors.append(DiagnosticError(
                level="WARNING",
                code=Diagnostics.DATA_CONSISTENCY,
                message=f"温度曲线总小时数={total_hours:.0f}，偏离典型采暖季(1000~5000小时)",
                source_file=src, source_type="temp_curve",
                field="bins", value=f"total_hours={total_hours:.0f}",
                suggested_fix="核实温度频段数据是否覆盖了完整采暖季"
            ))
        return errors

    @staticmethod
    def check_electricity(ed: ElectricityData) -> List[DiagnosticError]:
        errors = []
        src = ed.provenance.source_file if ed.provenance else "未知"

        if ed.flat_rate_yuan_per_kwh is not None:
            if ed.flat_rate_yuan_per_kwh <= 0 or ed.flat_rate_yuan_per_kwh > 5:
                errors.append(DiagnosticError(
                    level="WARNING",
                    code=Diagnostics.UNIT_MISMATCH,
                    message=f"平电价={ed.flat_rate_yuan_per_kwh}元/kWh，超出常见范围(0.3~2.0元/kWh)",
                    source_file=src, source_type="electricity",
                    field="flat_rate_yuan_per_kwh", value=ed.flat_rate_yuan_per_kwh,
                    suggested_fix="确认单位是元/kWh而非元/MWh或其它"
                ))

        if ed.time_of_use:
            total_tou_hours = sum(r.hours_per_year for r in ed.time_of_use)
            if abs(total_tou_hours - 8760) > 200:
                errors.append(DiagnosticError(
                    level="WARNING",
                    code=Diagnostics.DATA_CONSISTENCY,
                    message=f"分时电价总小时数={total_tou_hours:.0f}，与全年8760小时偏差>200",
                    source_file=src, source_type="electricity",
                    field="time_of_use", value=f"total={total_tou_hours:.0f}",
                    suggested_fix="核实各时段小时数是否完整覆盖全年"
                ))
            for r in ed.time_of_use:
                if r.price_per_kwh <= 0 or r.price_per_kwh > 5:
                    errors.append(DiagnosticError(
                        level="WARNING",
                        code=Diagnostics.UNIT_MISMATCH,
                        message=f"分时电价'{r.label}'={r.price_per_kwh}元/kWh，超出常见范围",
                        source_file=src, source_type="electricity",
                        field=f"time_of_use[{r.label}].price_per_kwh", value=r.price_per_kwh,
                        suggested_fix="确认单位是元/kWh"
                    ))
        return errors

    @staticmethod
    def check_duplicate_imports(store: DataStore) -> List[DiagnosticError]:
        errors = []
        seen = {}
        for entry in store.import_log():
            key = f"{entry['type']}:{entry['name']}"
            if key in seen:
                errors.append(DiagnosticError(
                    level="WARNING",
                    code=Diagnostics.DUPLICATE_ENERGY,
                    message=f"'{entry['name']}'被重复导入：先由{seen[key]['file']}，再由{entry['file']}",
                    source_file=entry['file'], source_type=entry['type'],
                    field="name", value=entry['name'],
                    suggested_fix="确认是否为同一份材料的更新版本，若是请删除旧版本后重新导入"
                ))
            else:
                seen[key] = entry
        return errors

    @staticmethod
    def check_calc_result(result: CalcResult, eq: EquipmentParams) -> List[DiagnosticError]:
        errors = []
        src = eq.provenance.source_file if eq.provenance else "未知"

        if result.delta_t_k <= 0:
            errors.append(DiagnosticError(
                level="ERROR",
                code=Diagnostics.PHYSICS_WARNING,
                message=f"温差ΔT={result.delta_t_k:.1f}K ≤ 0，出水温度≤室外温度，热泵无法运行",
                source_file=src, source_type="equipment",
                field="delta_t_k", value=result.delta_t_k,
                suggested_fix="检查温度输入，确认室外温度和出水温度是否正确"
            ))
        if result.actual_cop < 1.0:
            errors.append(DiagnosticError(
                level="WARNING",
                code=Diagnostics.PHYSICS_WARNING,
                message=f"COP={result.actual_cop:.2f} < 1.0，不如电直热，建议此时段切换为电加热或其它热源",
                source_file=src, source_type="equipment",
                field="actual_cop", value=result.actual_cop,
                suggested_fix="极端低温工况下热泵效率低，考虑辅助热源或切换运行策略"
            ))
        return errors

    @staticmethod
    def format_report(errors: List[DiagnosticError]) -> str:
        if not errors:
            return "诊断完成：未发现问题 ✓"

        errors_only = [e for e in errors if e.level == "ERROR"]
        warnings = [e for e in errors if e.level == "WARNING"]
        lines = ["=" * 60, "数据诊断报告", "=" * 60]

        if errors_only:
            lines.append(f"\n⛔ 错误 ({len(errors_only)} 项):")
            for e in errors_only:
                lines.append(f"\n{e}")

        if warnings:
            lines.append(f"\n⚠️  警告 ({len(warnings)} 项):")
            for e in warnings:
                lines.append(f"\n{e}")

        lines.append(f"\n{'=' * 60}")
        lines.append(f"合计: {len(errors_only)} 个错误, {len(warnings)} 个警告")
        if errors_only:
            lines.append("请先解决错误项再继续计算")
        return "\n".join(lines)
