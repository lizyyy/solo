from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field

from ..models import (
    PondConfig,
    PondState,
    SensorData,
    SensorRecord,
    ThresholdParams,
    WaterQualityParams,
    Scenario,
    ProbioticsPlan,
)


class ValidationError(Exception):
    def __init__(self, message: str, errors: Optional[List[Dict[str, Any]]] = None):
        super().__init__(message)
        self.errors = errors or []


@dataclass
class ValidationResult:
    is_valid: bool = True
    errors: List[Dict[str, Any]] = field(default_factory=list)
    warnings: List[Dict[str, Any]] = field(default_factory=list)

    def add_error(self, category: str, field: str, message: str, value: Any = None) -> None:
        self.is_valid = False
        self.errors.append({
            "category": category,
            "field": field,
            "message": message,
            "value": value,
        })

    def add_warning(self, category: str, field: str, message: str, value: Any = None) -> None:
        self.warnings.append({
            "category": category,
            "field": field,
            "message": message,
            "value": value,
        })

    def merge(self, other: "ValidationResult") -> "ValidationResult":
        self.is_valid = self.is_valid and other.is_valid
        self.errors.extend(other.errors)
        self.warnings.extend(other.warnings)
        return self


class DataValidator:
    SENSOR_TYPE_MAPPING = {
        "temperature": {"unit": "℃", "min": 0, "max": 40},
        "ph": {"unit": "pH", "min": 0, "max": 14},
        "ammonia_nitrogen": {"unit": "mg/L", "min": 0, "max": 10},
        "nitrite": {"unit": "mg/L", "min": 0, "max": 5},
        "salinity": {"unit": "‰", "min": 0, "max": 50},
        "dissolved_oxygen": {"unit": "mg/L", "min": 0, "max": 20},
        "turbidity": {"unit": "NTU", "min": 0, "max": 1000},
    }

    def __init__(self, thresholds: Optional[ThresholdParams] = None):
        self.thresholds = thresholds or ThresholdParams()

    def validate_pond_config(self, config: PondConfig) -> ValidationResult:
        result = ValidationResult()

        if not config.pond_id or not config.pond_id.strip():
            result.add_error("pond_config", "pond_id", "池塘ID不能为空")

        if not config.pond_name or not config.pond_name.strip():
            result.add_warning("pond_config", "pond_name", "池塘名称为空")

        if config.volume <= 0:
            result.add_error("pond_config", "volume", "池塘体积必须大于0", config.volume)

        if config.area <= 0:
            result.add_error("pond_config", "area", "池塘面积必须大于0", config.area)

        if config.depth <= 0:
            result.add_error("pond_config", "depth", "池塘深度必须大于0", config.depth)

        expected_depth = config.volume / config.area if config.area > 0 else 0
        if abs(config.depth - expected_depth) > 0.1:
            result.add_warning(
                "pond_config", "depth",
                f"水深 {config.depth}m 与体积/面积计算值 {expected_depth:.2f}m 不一致",
                config.depth
            )

        if config.stocking_density <= 0:
            result.add_warning(
                "pond_config", "stocking_density",
                "放养密度为0或负值", config.stocking_density
            )

        return result

    def validate_pond_state(self, state: PondState) -> ValidationResult:
        result = ValidationResult()

        if state.temperature < 0 or state.temperature > 40:
            result.add_error(
                "pond_state", "temperature",
                f"水温 {state.temperature}℃ 超出合理范围(0-40℃)",
                state.temperature
            )

        if state.ph < 0 or state.ph > 14:
            result.add_error(
                "pond_state", "ph",
                f"pH值 {state.ph} 超出合理范围(0-14)",
                state.ph
            )

        if state.ammonia_nitrogen < 0:
            result.add_error(
                "pond_state", "ammonia_nitrogen",
                f"氨氮 {state.ammonia_nitrogen} mg/L 不能为负值",
                state.ammonia_nitrogen
            )

        if state.nitrite < 0:
            result.add_error(
                "pond_state", "nitrite",
                f"亚硝酸盐 {state.nitrite} mg/L 不能为负值",
                state.nitrite
            )

        if state.salinity < 0:
            result.add_error(
                "pond_state", "salinity",
                f"盐度 {state.salinity}‰ 不能为负值",
                state.salinity
            )

        if state.dissolved_oxygen < 0:
            result.add_error(
                "pond_state", "dissolved_oxygen",
                f"溶解氧 {state.dissolved_oxygen} mg/L 不能为负值",
                state.dissolved_oxygen
            )

        if state.temperature < self.thresholds.temp_min:
            result.add_warning(
                "pond_state", "temperature",
                f"水温 {state.temperature}℃ 低于阈值 {self.thresholds.temp_min}℃",
                state.temperature
            )

        if state.temperature > self.thresholds.temp_max:
            result.add_warning(
                "pond_state", "temperature",
                f"水温 {state.temperature}℃ 高于阈值 {self.thresholds.temp_max}℃",
                state.temperature
            )

        if state.ph < self.thresholds.ph_min or state.ph > self.thresholds.ph_max:
            result.add_warning(
                "pond_state", "ph",
                f"pH值 {state.ph} 超出正常范围({self.thresholds.ph_min}-{self.thresholds.ph_max})",
                state.ph
            )

        if state.ammonia_nitrogen > self.thresholds.ammonia_nitrogen_warning:
            level = "危险" if state.ammonia_nitrogen > self.thresholds.ammonia_nitrogen_danger else "警告"
            result.add_warning(
                "pond_state", "ammonia_nitrogen",
                f"氨氮 {state.ammonia_nitrogen} mg/L 达到{level}水平",
                state.ammonia_nitrogen
            )

        if state.nitrite > self.thresholds.nitrite_warning:
            level = "危险" if state.nitrite > self.thresholds.nitrite_danger else "警告"
            result.add_warning(
                "pond_state", "nitrite",
                f"亚硝酸盐 {state.nitrite} mg/L 达到{level}水平",
                state.nitrite
            )

        if state.dissolved_oxygen < self.thresholds.do_min:
            level = "临界" if state.dissolved_oxygen < self.thresholds.do_critical else "偏低"
            result.add_warning(
                "pond_state", "dissolved_oxygen",
                f"溶解氧 {state.dissolved_oxygen} mg/L {level}",
                state.dissolved_oxygen
            )

        return result

    def validate_sensor_data(self, sensor_data: SensorData) -> ValidationResult:
        result = ValidationResult()

        if not sensor_data.records:
            result.add_error("sensor_data", "records", "没有传感器记录")
            return result

        valid_records = [r for r in sensor_data.records if r.is_valid]
        if not valid_records:
            result.add_error("sensor_data", "records", "没有有效的传感器记录")
            return result

        invalid_count = len(sensor_data.records) - len(valid_records)
        if invalid_count > 0:
            result.add_warning(
                "sensor_data", "records",
                f"存在 {invalid_count} 条无效记录"
            )

        sensor_types = set(r.sensor_type for r in valid_records)
        expected_types = {"temperature", "ph", "ammonia_nitrogen", "nitrite", "salinity", "dissolved_oxygen"}
        missing_types = expected_types - sensor_types
        if missing_types:
            result.add_warning(
                "sensor_data", "sensor_type",
                f"缺少关键传感器类型: {', '.join(missing_types)}"
            )

        for i, record in enumerate(valid_records):
            record_result = self._validate_single_sensor_record(record, i + 2)
            result.merge(record_result)

        time_gaps = self._check_time_gaps(valid_records)
        for gap in time_gaps:
            result.add_warning(
                "sensor_data", "timestamp",
                f"时间间隙过大: {gap['gap_hours']:.1f}小时, 在记录 {gap['start_row']} 和 {gap['end_row']} 之间"
            )

        return result

    def _validate_single_sensor_record(self, record: SensorRecord, row_num: int) -> ValidationResult:
        result = ValidationResult()

        if not record.sensor_type or not record.sensor_type.strip():
            result.add_error("sensor_record", "sensor_type", "传感器类型不能为空", row=row_num)
            return result

        sensor_info = self.SENSOR_TYPE_MAPPING.get(record.sensor_type)
        if not sensor_info:
            result.add_warning(
                "sensor_record", "sensor_type",
                f"未知传感器类型: {record.sensor_type}",
                value=record.sensor_type
            )
            return result

        if record.unit and record.unit != sensor_info["unit"]:
            result.add_warning(
                "sensor_record", "unit",
                f"单位不匹配: 预期 {sensor_info['unit']}, 实际 {record.unit}",
                value=record.unit
            )

        if record.value < sensor_info["min"] or record.value > sensor_info["max"]:
            result.add_warning(
                "sensor_record", "value",
                f"传感器值 {record.value} {record.unit} 超出合理范围({sensor_info['min']}-{sensor_info['max']})",
                value=record.value
            )

        return result

    def _check_time_gaps(self, records: List[SensorRecord], max_gap_hours: float = 4.0) -> List[Dict[str, Any]]:
        gaps = []
        sorted_records = sorted(records, key=lambda r: r.timestamp)

        for i in range(1, len(sorted_records)):
            prev = sorted_records[i - 1]
            curr = sorted_records[i]
            gap_hours = (curr.timestamp - prev.timestamp).total_seconds() / 3600

            if gap_hours > max_gap_hours:
                gaps.append({
                    "start_row": i,
                    "end_row": i + 1,
                    "start_time": prev.timestamp,
                    "end_time": curr.timestamp,
                    "gap_hours": gap_hours,
                })

        return gaps

    def validate_water_quality_params(self, params: WaterQualityParams) -> ValidationResult:
        result = ValidationResult()

        temp_state = PondState(
            pond_id="validation",
            temperature=params.temperature,
            ph=params.ph,
            ammonia_nitrogen=params.ammonia_nitrogen,
            nitrite=params.nitrite,
            salinity=params.salinity,
            dissolved_oxygen=params.dissolved_oxygen,
            turbidity=params.turbidity,
            alkalinity=params.alkalinity,
            hardness=params.hardness,
        )
        state_result = self.validate_pond_state(temp_state)
        result.merge(state_result)

        return result

    def validate_scenario(self, scenario: Scenario) -> ValidationResult:
        result = ValidationResult()

        if not scenario.scenario_id or not scenario.scenario_id.strip():
            result.add_error("scenario", "scenario_id", "方案ID不能为空")

        if not scenario.scenario_name or not scenario.scenario_name.strip():
            result.add_warning("scenario", "scenario_name", "方案名称为空")

        for i, wc_plan in enumerate(scenario.water_change_plans):
            if wc_plan.exchange_rate < 0 or wc_plan.exchange_rate > 1:
                result.add_error(
                    "scenario", f"water_change_plan[{i}].exchange_rate",
                    f"换水速率 {wc_plan.exchange_rate} 超出范围(0-1)",
                    value=wc_plan.exchange_rate
                )

            if wc_plan.total_exchange_ratio < 0 or wc_plan.total_exchange_ratio > 1:
                result.add_error(
                    "scenario", f"water_change_plan[{i}].total_exchange_ratio",
                    f"总换水比例 {wc_plan.total_exchange_ratio} 超出范围(0-1)",
                    value=wc_plan.total_exchange_ratio
                )

            if wc_plan.is_urgent and wc_plan.total_exchange_ratio > 0.5:
                result.add_warning(
                    "scenario", f"water_change_plan[{i}]",
                    f"紧急换水量过大({wc_plan.total_exchange_ratio*100:.0f}%)，可能刺激幼苗",
                    value=wc_plan.total_exchange_ratio
                )

        probiotics_conflicts = scenario.check_probiotics_conflicts()
        for conflict in probiotics_conflicts:
            result.add_error(
                "scenario", "probiotics_plan",
                conflict["message"],
                value=conflict["plan_id"]
            )

        for i, prob_plan in enumerate(scenario.probiotics_plans):
            if prob_plan.dosage <= 0:
                result.add_error(
                    "scenario", f"probiotics_plan[{i}].dosage",
                    f"益生菌投加量 {prob_plan.dosage} g/m³ 必须大于0",
                    value=prob_plan.dosage
                )

            if not prob_plan.probiotics_type or not prob_plan.probiotics_type.strip():
                result.add_warning(
                    "scenario", f"probiotics_plan[{i}].probiotics_type",
                    "益生菌类型未指定"
                )

        return result

    def validate_complete_data(
        self,
        pond_config: PondConfig,
        initial_state: PondState,
        sensor_data: Optional[SensorData] = None,
        scenario: Optional[Scenario] = None,
    ) -> ValidationResult:
        result = ValidationResult()

        config_result = self.validate_pond_config(pond_config)
        result.merge(config_result)

        state_result = self.validate_pond_state(initial_state)
        result.merge(state_result)

        if sensor_data:
            if sensor_data.pond_id != pond_config.pond_id:
                result.add_error(
                    "data_consistency", "pond_id",
                    f"传感器数据池塘ID({sensor_data.pond_id})与配置池塘ID({pond_config.pond_id})不匹配"
                )
            sensor_result = self.validate_sensor_data(sensor_data)
            result.merge(sensor_result)

        if scenario:
            if scenario.pond_id != pond_config.pond_id:
                result.add_error(
                    "data_consistency", "pond_id",
                    f"方案池塘ID({scenario.pond_id})与配置池塘ID({pond_config.pond_id})不匹配"
                )
            scenario_result = self.validate_scenario(scenario)
            result.merge(scenario_result)

        return result
