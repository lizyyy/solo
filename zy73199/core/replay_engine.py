from typing import List, Dict, Optional, Tuple
from core.models import ReplayRecord, ReplayStatus, Parameter, CalculationStep
from utils.unit_converter import convert_unit, derive_result_unit, get_unit_category
import re
import math


class ReplayEngine:
    def __init__(self, threshold_config: Optional[Dict] = None):
        self.threshold_config = threshold_config or {
            "speed_max": 300.0,
            "mass_max": 10000.0,
            "length_max": 10000.0,
            "area_max": 1000000.0,
            "temperature_max": 1000.0,
        }
        self.boundary_tolerance = 0.05

    def replay(self, record: ReplayRecord) -> ReplayRecord:
        record.updated_at = __import__("datetime").datetime.now()
        record.steps = []

        if not self._check_units_complete(record.parameters):
            record.status = ReplayStatus.FAILED_UNIT
            record.fail_reason = "单位缺失"
            record.fail_detail = "存在参数缺少单位，无法进行完整计算"
            self._add_unit_check_step(record)
            return record

        try:
            result = self._calculate(record)
            if result["status"] == "success":
                record.status = ReplayStatus.SUCCESS
                record.final_result = result["value"]
                record.final_unit = result["unit"]
            elif result["status"] == "formula_error":
                record.status = ReplayStatus.FAILED_FORMULA
                record.fail_reason = "公式错误"
                record.fail_detail = result["detail"]
            elif result["status"] == "threshold":
                record.status = ReplayStatus.FAILED_THRESHOLD
                record.fail_reason = "超阈值"
                record.fail_detail = result["detail"]
        except Exception as e:
            record.status = ReplayStatus.FAILED_FORMULA
            record.fail_reason = "公式错误"
            record.fail_detail = str(e)

        if record.is_boundary:
            if record.status == ReplayStatus.FAILED_UNIT:
                record.boundary_type = "单位缺失"
                record.boundary_evidence = self._build_unit_missing_evidence(record)
            elif record.status == ReplayStatus.FAILED_FORMULA:
                record.boundary_type = "公式缺项"
                record.boundary_evidence = self._build_formula_error_evidence(record)
            elif record.status == ReplayStatus.FAILED_THRESHOLD:
                record.boundary_type = "阈值未过"
                record.boundary_evidence = self._build_threshold_evidence(record)
            elif record.status == ReplayStatus.SUCCESS:
                if self._is_boundary_value(record.final_result, record.final_unit):
                    record.boundary_type = "阈值临界"
                    record.boundary_evidence = self._build_threshold_boundary_evidence(record)
                else:
                    record.boundary_type = "阈值临界"
                    record.boundary_evidence = self._build_threshold_boundary_evidence(record)
            record.status = ReplayStatus.BOUNDARY

        return record

    def _check_units_complete(self, parameters: List[Parameter]) -> bool:
        for p in parameters:
            if not p.unit or p.unit.strip() == "":
                return False
        return True

    def _add_unit_check_step(self, record: ReplayRecord):
        missing_units = [p.name for p in record.parameters if not p.unit or p.unit.strip() == ""]
        step = CalculationStep(
            step_name="单位完整性检查",
            formula="检查所有参数是否带有有效单位",
            input_values={p.name: p.value for p in record.parameters},
            input_units={p.name: p.unit or "(缺失)" for p in record.parameters},
            result_value=None,
            result_unit=None,
            error_msg=f"缺失单位的参数: {', '.join(missing_units)}",
        )
        record.steps.append(step)

    def _calculate(self, record: ReplayRecord) -> Dict:
        params = {p.name: {"value": p.value, "unit": p.unit} for p in record.parameters}

        if record.problem_id.startswith("speed_"):
            return self._calc_speed_problem(record, params)
        elif record.problem_id.startswith("density_"):
            return self._calc_density_problem(record, params)
        elif record.problem_id.startswith("area_"):
            return self._calc_area_problem(record, params)
        elif record.problem_id.startswith("kinetic_"):
            return self._calc_kinetic_energy(record, params)
        else:
            return {"status": "formula_error", "detail": f"未知题型: {record.problem_id}"}

    def _calc_speed_problem(self, record: ReplayRecord, params: Dict) -> Dict:
        dist = params.get("距离", params.get("distance", None))
        time = params.get("时间", params.get("time", None))

        if not dist or not time:
            return {"status": "formula_error", "detail": "缺少必要参数：距离或时间"}

        step1 = CalculationStep(
            step_name="步骤1：单位统一",
            formula="将距离转换为米(m)，时间转换为秒(s)",
            input_values={"距离": dist["value"], "时间": time["value"]},
            input_units={"距离": dist["unit"], "时间": time["unit"]},
            result_value=None,
            result_unit=None,
        )

        dist_m, err1 = convert_unit(dist["value"], dist["unit"], "m")
        time_s, err2 = convert_unit(time["value"], time["unit"], "s")

        if err1 or err2:
            step1.error_msg = err1 or err2
            record.steps.append(step1)
            return {"status": "formula_error", "detail": f"单位转换失败: {err1 or err2}"}

        step1.result_value = dist_m
        step1.result_unit = "m"
        step1.input_values["距离(转换后)"] = dist_m
        step1.input_values["时间(转换后)"] = time_s
        step1.input_units["距离(转换后)"] = "m"
        step1.input_units["时间(转换后)"] = "s"
        record.steps.append(step1)

        step2 = CalculationStep(
            step_name="步骤2：速度计算",
            formula="v = s / t （速度 = 距离 / 时间）",
            input_values={"s": dist_m, "t": time_s},
            input_units={"s": "m", "t": "s"},
            result_value=None,
            result_unit=None,
        )

        if time_s == 0:
            step2.error_msg = "除数不能为零"
            record.steps.append(step2)
            return {"status": "formula_error", "detail": "时间参数为零，无法计算速度"}

        speed = dist_m / time_s
        step2.result_value = round(speed, 4)
        step2.result_unit = "m/s"
        record.steps.append(step2)

        step3 = CalculationStep(
            step_name="步骤3：阈值校验",
            formula="检查速度是否在合理范围内 (0 ~ speed_max)",
            input_values={"计算速度": speed, "阈值上限": self.threshold_config["speed_max"]},
            input_units={"计算速度": "m/s", "阈值上限": "m/s"},
            result_value=speed,
            result_unit="m/s",
        )

        if speed > self.threshold_config["speed_max"]:
            step3.error_msg = f"速度 {speed:.2f} m/s 超过阈值 {self.threshold_config['speed_max']} m/s"
            record.steps.append(step3)
            return {"status": "threshold", "detail": f"速度值 {speed:.2f} m/s 超出最大阈值 {self.threshold_config['speed_max']} m/s"}

        if speed < 0:
            step3.error_msg = "速度不能为负值"
            record.steps.append(step3)
            return {"status": "threshold", "detail": "速度计算结果为负值"}

        record.steps.append(step3)

        return {"status": "success", "value": round(speed, 4), "unit": "m/s"}

    def _calc_density_problem(self, record: ReplayRecord, params: Dict) -> Dict:
        mass = params.get("质量", params.get("mass", None))
        volume = params.get("体积", params.get("volume", None))

        if not mass or not volume:
            return {"status": "formula_error", "detail": "缺少必要参数：质量或体积"}

        step1 = CalculationStep(
            step_name="步骤1：单位统一",
            formula="将质量转换为千克(kg)，体积转换为立方米(m³)",
            input_values={"质量": mass["value"], "体积": volume["value"]},
            input_units={"质量": mass["unit"], "体积": volume["unit"]},
            result_value=None,
            result_unit=None,
        )

        mass_kg, err1 = convert_unit(mass["value"], mass["unit"], "kg")
        volume_m3, err2 = convert_unit(volume["value"], volume["unit"], "m3")

        if err1 or err2:
            step1.error_msg = err1 or err2
            record.steps.append(step1)
            return {"status": "formula_error", "detail": f"单位转换失败: {err1 or err2}"}

        step1.result_value = mass_kg
        step1.result_unit = "kg"
        step1.input_values["质量(转换后)"] = mass_kg
        step1.input_values["体积(转换后)"] = volume_m3
        step1.input_units["质量(转换后)"] = "kg"
        step1.input_units["体积(转换后)"] = "m3"
        record.steps.append(step1)

        step2 = CalculationStep(
            step_name="步骤2：密度计算",
            formula="ρ = m / V （密度 = 质量 / 体积）",
            input_values={"m": mass_kg, "V": volume_m3},
            input_units={"m": "kg", "V": "m³"},
            result_value=None,
            result_unit=None,
        )

        if volume_m3 == 0:
            step2.error_msg = "除数不能为零"
            record.steps.append(step2)
            return {"status": "formula_error", "detail": "体积参数为零，无法计算密度"}

        density = mass_kg / volume_m3
        step2.result_value = round(density, 4)
        step2.result_unit = "kg/m³"
        record.steps.append(step2)

        return {"status": "success", "value": round(density, 4), "unit": "kg/m³"}

    def _calc_area_problem(self, record: ReplayRecord, params: Dict) -> Dict:
        length = params.get("长度", params.get("length", None))
        width = params.get("宽度", params.get("width", None))

        if not length or not width:
            return {"status": "formula_error", "detail": "缺少必要参数：长度或宽度"}

        step1 = CalculationStep(
            step_name="步骤1：单位统一",
            formula="将长度和宽度转换为米(m)",
            input_values={"长度": length["value"], "宽度": width["value"]},
            input_units={"长度": length["unit"], "宽度": width["unit"]},
            result_value=None,
            result_unit=None,
        )

        length_m, err1 = convert_unit(length["value"], length["unit"], "m")
        width_m, err2 = convert_unit(width["value"], width["unit"], "m")

        if err1 or err2:
            step1.error_msg = err1 or err2
            record.steps.append(step1)
            return {"status": "formula_error", "detail": f"单位转换失败: {err1 or err2}"}

        step1.result_value = length_m
        step1.result_unit = "m"
        step1.input_values["长度(转换后)"] = length_m
        step1.input_values["宽度(转换后)"] = width_m
        step1.input_units["长度(转换后)"] = "m"
        step1.input_units["宽度(转换后)"] = "m"
        record.steps.append(step1)

        step2 = CalculationStep(
            step_name="步骤2：面积计算",
            formula="S = a × b （面积 = 长度 × 宽度）",
            input_values={"a": length_m, "b": width_m},
            input_units={"a": "m", "b": "m"},
            result_value=None,
            result_unit=None,
        )

        area = length_m * width_m
        step2.result_value = round(area, 4)
        step2.result_unit = "m²"
        record.steps.append(step2)

        step3 = CalculationStep(
            step_name="步骤3：阈值校验",
            formula="检查面积是否在合理范围内",
            input_values={"计算面积": area, "阈值上限": self.threshold_config["area_max"]},
            input_units={"计算面积": "m²", "阈值上限": "m²"},
            result_value=area,
            result_unit="m²",
        )

        if area > self.threshold_config["area_max"]:
            step3.error_msg = f"面积 {area:.2f} m² 超过阈值 {self.threshold_config['area_max']} m²"
            record.steps.append(step3)
            return {"status": "threshold", "detail": f"面积值 {area:.2f} m² 超出最大阈值 {self.threshold_config['area_max']} m²"}

        record.steps.append(step3)

        return {"status": "success", "value": round(area, 4), "unit": "m²"}

    def _calc_kinetic_energy(self, record: ReplayRecord, params: Dict) -> Dict:
        mass = params.get("质量", params.get("mass", None))
        velocity = params.get("速度", params.get("velocity", None))

        if not mass or not velocity:
            return {"status": "formula_error", "detail": "缺少必要参数：质量或速度"}

        step1 = CalculationStep(
            step_name="步骤1：单位统一",
            formula="将质量转换为千克(kg)，速度转换为米每秒(m/s)",
            input_values={"质量": mass["value"], "速度": velocity["value"]},
            input_units={"质量": mass["unit"], "速度": velocity["unit"]},
            result_value=None,
            result_unit=None,
        )

        mass_kg, err1 = convert_unit(mass["value"], mass["unit"], "kg")
        vel_m_s, err2 = convert_unit(velocity["value"], velocity["unit"], "m/s")

        if err1 or err2:
            step1.error_msg = err1 or err2
            record.steps.append(step1)
            return {"status": "formula_error", "detail": f"单位转换失败: {err1 or err2}"}

        step1.result_value = mass_kg
        step1.result_unit = "kg"
        step1.input_values["质量(转换后)"] = mass_kg
        step1.input_values["速度(转换后)"] = vel_m_s
        step1.input_units["质量(转换后)"] = "kg"
        step1.input_units["速度(转换后)"] = "m/s"
        record.steps.append(step1)

        step2 = CalculationStep(
            step_name="步骤2：动能计算",
            formula="Ek = ½ × m × v² （动能 = 0.5 × 质量 × 速度²）",
            input_values={"m": mass_kg, "v": vel_m_s},
            input_units={"m": "kg", "v": "m/s"},
            result_value=None,
            result_unit=None,
        )

        kinetic = 0.5 * mass_kg * (vel_m_s ** 2)
        step2.result_value = round(kinetic, 4)
        step2.result_unit = "J"
        record.steps.append(step2)

        return {"status": "success", "value": round(kinetic, 4), "unit": "J"}

    def _is_boundary_value(self, value: float, unit: str) -> bool:
        category = get_unit_category(unit)
        if not category:
            return False

        threshold_key = f"{category}_max"
        if threshold_key in self.threshold_config:
            max_val = self.threshold_config[threshold_key]
            if abs(value - max_val) / max_val < self.boundary_tolerance:
                return True

        return False

    def _build_unit_missing_evidence(self, record: ReplayRecord) -> str:
        missing = [p for p in record.parameters if not p.unit or p.unit.strip() == ""]
        present = [p for p in record.parameters if p.unit and p.unit.strip() != ""]
        lines = []
        lines.append(f"卡点分类：单位缺失")
        lines.append(f"判定依据：参数缺少有效单位，无法完成单位换算与计算")
        for p in missing:
            lines.append(f"  缺失单位参数：{p.name}={p.value}(单位为空)")
        for p in present:
            lines.append(f"  正常参数：{p.name}={p.value} {p.unit}")
        if record.steps:
            for s in record.steps:
                if s.error_msg:
                    lines.append(f"  错误信息：{s.error_msg}")
        lines.append(f"复核建议：补充缺失单位后重新回放")
        return "\n".join(lines)

    def _build_formula_error_evidence(self, record: ReplayRecord) -> str:
        lines = []
        lines.append(f"卡点分类：公式缺项")
        lines.append(f"判定依据：公式计算过程中出现错误，缺少必要项或参数不匹配")
        lines.append(f"失败原因：{record.fail_reason or '未知'}")
        lines.append(f"失败详情：{record.fail_detail or '未知'}")
        param_strs = [f"{p.name}={p.value} {p.unit}" for p in record.parameters]
        lines.append(f"输入参数：{', '.join(param_strs)}")
        for s in record.steps:
            if s.error_msg:
                lines.append(f"  步骤[{s.step_name}] 错误：{s.error_msg}")
                if s.input_values:
                    vals = "; ".join(f"{k}={v}" for k, v in s.input_values.items())
                    lines.append(f"    输入值：{vals}")
                if s.input_units:
                    units = "; ".join(f"{k}={v}" for k, v in s.input_units.items())
                    lines.append(f"    输入单位：{units}")
        lines.append(f"复核建议：检查公式完整性和参数匹配")
        return "\n".join(lines)

    def _build_threshold_evidence(self, record: ReplayRecord) -> str:
        lines = []
        lines.append(f"卡点分类：阈值未过")
        lines.append(f"判定依据：计算结果超出合理阈值范围")
        param_strs = [f"{p.name}={p.value} {p.unit}" for p in record.parameters]
        lines.append(f"输入参数：{', '.join(param_strs)}")
        for s in record.steps:
            if s.result_value is not None:
                lines.append(f"  步骤[{s.step_name}]：{s.result_value} {s.result_unit or ''}")
            if s.error_msg:
                lines.append(f"  步骤[{s.step_name}] 错误：{s.error_msg}")
                if s.input_values:
                    vals = "; ".join(f"{k}={v}" for k, v in s.input_values.items())
                    lines.append(f"    对比值：{vals}")
                if s.input_units:
                    units = "; ".join(f"{k}={v}" for k, v in s.input_units.items())
                    lines.append(f"    单位：{units}")
        lines.append(f"复核建议：确认输入参数是否正确，或阈值是否需要调整")
        return "\n".join(lines)

    def _build_threshold_boundary_evidence(self, record: ReplayRecord) -> str:
        lines = []
        lines.append(f"卡点分类：阈值临界")
        category = get_unit_category(record.final_unit) if record.final_unit else None
        threshold_key = f"{category}_max" if category else None
        max_val = self.threshold_config.get(threshold_key) if threshold_key else None

        if record.final_result is not None and max_val is not None and max_val > 0:
            ratio = record.final_result / max_val * 100
            diff = max_val - record.final_result
            lines.append(f"判定依据：结果值{record.final_result}{record.final_unit}距阈值上限{max_val}{record.final_unit}仅差{diff:.2f}{record.final_unit}，占比{ratio:.2f}%，接近{self.boundary_tolerance*100:.0f}%容差线")
        else:
            lines.append(f"判定依据：计算结果接近阈值边界，需人工复核")

        param_strs = [f"{p.name}={p.value} {p.unit}" for p in record.parameters]
        lines.append(f"输入参数：{', '.join(param_strs)}")

        for s in record.steps:
            step_info = f"  步骤[{s.step_name}]"
            if s.formula:
                step_info += f" 公式：{s.formula}"
            if s.input_values:
                vals = "; ".join(f"{k}={v}" for k, v in s.input_values.items())
                lines.append(f"{step_info}")
                lines.append(f"    输入值：{vals}")
            if s.input_units:
                units = "; ".join(f"{k}={v}" for k, v in s.input_units.items())
                lines.append(f"    单位：{units}")
            if s.result_value is not None:
                lines.append(f"    结果：{s.result_value} {s.result_unit or ''}")
            if s.error_msg:
                lines.append(f"    错误：{s.error_msg}")

        lines.append(f"复核建议：确认参数取值是否合理，是否需要调整阈值或补充约束条件")
        return "\n".join(lines)

    def compare_records(self, record_a: ReplayRecord, record_b: ReplayRecord) -> Dict:
        comparison = {
            "problem_id": record_a.problem_id,
            "record_a_id": record_a.record_id,
            "record_b_id": record_b.record_id,
            "status_a": record_a.status.value,
            "status_b": record_b.status.value,
            "params_diff": [],
            "steps_diff": [],
            "result_diff": None,
        }

        params_a = {p.name: p for p in record_a.parameters}
        params_b = {p.name: p for p in record_b.parameters}
        all_param_names = set(params_a.keys()) | set(params_b.keys())

        for name in sorted(all_param_names):
            pa = params_a.get(name)
            pb = params_b.get(name)
            comparison["params_diff"].append({
                "name": name,
                "value_a": pa.value if pa else None,
                "value_b": pb.value if pb else None,
                "unit_a": pa.unit if pa else None,
                "unit_b": pb.unit if pb else None,
                "has_diff": (pa is None or pb is None) or (pa.value != pb.value) or (pa.unit != pb.unit),
            })

        max_steps = max(len(record_a.steps), len(record_b.steps))
        for i in range(max_steps):
            sa = record_a.steps[i] if i < len(record_a.steps) else None
            sb = record_b.steps[i] if i < len(record_b.steps) else None

            if sa and sb:
                comparison["steps_diff"].append({
                    "step_index": i + 1,
                    "step_name": sa.step_name,
                    "result_a": sa.result_value,
                    "result_b": sb.result_value,
                    "unit_a": sa.result_unit,
                    "unit_b": sb.result_unit,
                    "has_diff": sa.result_value != sb.result_value or sa.result_unit != sb.result_unit,
                    "error_a": sa.error_msg,
                    "error_b": sb.error_msg,
                })
            else:
                comparison["steps_diff"].append({
                    "step_index": i + 1,
                    "step_name": sa.step_name if sa else sb.step_name if sb else f"步骤{i+1}",
                    "result_a": sa.result_value if sa else None,
                    "result_b": sb.result_value if sb else None,
                    "unit_a": sa.result_unit if sa else None,
                    "unit_b": sb.result_unit if sb else None,
                    "has_diff": True,
                    "error_a": sa.error_msg if sa else None,
                    "error_b": sb.error_msg if sb else None,
                })

        if record_a.final_result is not None and record_b.final_result is not None:
            diff = record_b.final_result - record_a.final_result
            diff_pct = (diff / record_a.final_result * 100) if record_a.final_result != 0 else float("inf")
            comparison["result_diff"] = {
                "value_a": record_a.final_result,
                "value_b": record_b.final_result,
                "unit": record_a.final_unit,
                "abs_diff": round(diff, 4),
                "pct_diff": round(diff_pct, 2),
            }

        return comparison
