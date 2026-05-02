import csv
import math
from pathlib import Path
from typing import List, Tuple, Optional, Dict, Any
import numpy as np

from rain_garden_checker.models.data_models import (
    RainfallSeries,
    RainfallDataPoint,
    SoilInfiltrationTest,
    CatchmentArea,
    PondGeometry,
    ValidationWarning,
    WarningLevel,
    WarningType,
    TimeUnit,
    LengthUnit,
    AreaUnit,
)


class CSVParser:
    def __init__(self):
        self.warnings: List[ValidationWarning] = []

    def _add_warning(
        self,
        level: WarningLevel,
        warning_type: WarningType,
        message: str,
        field: Optional[str] = None,
        value: Optional[Any] = None,
        suggestion: Optional[str] = None,
    ):
        self.warnings.append(
            ValidationWarning(
                level=level,
                warning_type=warning_type,
                message=message,
                field=field,
                value=value,
                suggestion=suggestion,
            )
        )

    def _detect_outliers(self, values: List[float], iqr_factor: float = 3.0) -> List[int]:
        if len(values) < 4:
            return []
        values_arr = np.array(values)
        q1 = np.percentile(values_arr, 25)
        q3 = np.percentile(values_arr, 75)
        iqr = q3 - q1
        if iqr == 0:
            return []
        lower_bound = q1 - iqr_factor * iqr
        upper_bound = q3 + iqr_factor * iqr
        outliers = [i for i, v in enumerate(values) if v < lower_bound or v > upper_bound]
        return outliers

    def _check_time_step_consistency(
        self, times: List[float], tolerance: float = 0.1
    ) -> Tuple[bool, float]:
        if len(times) < 2:
            return True, 0.0
        steps = [times[i] - times[i-1] for i in range(1, len(times))]
        mean_step = np.mean(steps)
        if mean_step == 0:
            return False, 0.0
        max_deviation = max(abs(s - mean_step) for s in steps) / mean_step
        return max_deviation <= tolerance, mean_step

    def parse_rainfall_csv(
        self,
        file_path: Path,
        name: str,
        return_period: float,
        time_unit: TimeUnit = TimeUnit.MINUTE,
        intensity_unit: LengthUnit = LengthUnit.MILLIMETER,
        time_column: str = "time",
        intensity_column: str = "intensity",
        delimiter: str = ",",
    ) -> Optional[RainfallSeries]:
        self.warnings.clear()
        if not file_path.exists():
            self._add_warning(
                WarningLevel.CRITICAL,
                WarningType.MISSING_DATA,
                f"降雨数据文件不存在: {file_path}",
                field="file_path",
            )
            return None

        times: List[float] = []
        intensities: List[float] = []
        row_count = 0
        missing_count = 0

        try:
            with open(file_path, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f, delimiter=delimiter)
                for row_num, row in enumerate(reader, start=1):
                    row_count += 1
                    time_str = row.get(time_column, "").strip()
                    intensity_str = row.get(intensity_column, "").strip()

                    if not time_str or not intensity_str:
                        missing_count += 1
                        self._add_warning(
                            WarningLevel.WARNING,
                            WarningType.MISSING_DATA,
                            f"第 {row_num} 行存在缺失值",
                            field=f"row_{row_num}",
                        )
                        continue

                    try:
                        time_val = float(time_str)
                        intensity_val = float(intensity_str)
                        if math.isnan(time_val) or math.isnan(intensity_val):
                            raise ValueError("NaN value")
                        times.append(time_val)
                        intensities.append(intensity_val)
                    except ValueError as e:
                        self._add_warning(
                            WarningLevel.WARNING,
                            WarningType.MISSING_DATA,
                            f"第 {row_num} 行数据格式错误: {e}",
                            field=f"row_{row_num}",
                        )
                        missing_count += 1
                        continue

        except Exception as e:
            self._add_warning(
                WarningLevel.CRITICAL,
                WarningType.MISSING_DATA,
                f"读取文件失败: {e}",
                field="file_path",
            )
            return None

        if row_count == 0:
            self._add_warning(
                WarningLevel.CRITICAL,
                WarningType.MISSING_DATA,
                "CSV 文件没有有效数据行",
            )
            return None

        if missing_count > 0:
            self._add_warning(
                WarningLevel.WARNING if missing_count < row_count * 0.1 else WarningLevel.CRITICAL,
                WarningType.MISSING_DATA,
                f"共缺失 {missing_count}/{row_count} 条数据",
                value=f"{missing_count}/{row_count}",
            )

        if len(times) < 2:
            self._add_warning(
                WarningLevel.CRITICAL,
                WarningType.MISSING_DATA,
                "有效数据点不足，至少需要2个时间步",
                value=len(times),
            )
            return None

        is_consistent, mean_step = self._check_time_step_consistency(times)
        if not is_consistent:
            self._add_warning(
                WarningLevel.WARNING,
                WarningType.TIMESTEP_INCONSISTENT,
                f"时间步长不一致，平均步长: {mean_step}",
                field="time_step",
                value=mean_step,
                suggestion="建议插值或重新采样为均匀时间步长",
            )

        outlier_indices = self._detect_outliers(intensities)
        for idx in outlier_indices:
            self._add_warning(
                WarningLevel.WARNING,
                WarningType.OUTLIER,
                f"检测到异常降雨强度值",
                field=f"row_{idx+1}",
                value=intensities[idx],
                suggestion="请核实该数据点是否为测量误差",
            )

        if any(i < 0 for i in intensities):
            self._add_warning(
                WarningLevel.CRITICAL,
                WarningType.OUTLIER,
                "降雨强度不能为负值",
                field=intensity_column,
            )
            return None

        data_points = [
            RainfallDataPoint(time=t, intensity=i)
            for t, i in zip(times, intensities)
        ]

        series = RainfallSeries(
            name=name,
            return_period=return_period,
            time_unit=time_unit,
            intensity_unit=intensity_unit,
            data=data_points,
        )

        return series

    def parse_soil_test_csv(
        self,
        file_path: Path,
        test_id: str,
        delimiter: str = ",",
    ) -> Optional[SoilInfiltrationTest]:
        self.warnings.clear()
        if not file_path.exists():
            self._add_warning(
                WarningLevel.CRITICAL,
                WarningType.MISSING_DATA,
                f"土壤试验文件不存在: {file_path}",
            )
            return None

        data: Dict[str, Any] = {}
        try:
            with open(file_path, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f, delimiter=delimiter)
                for row in reader:
                    for key, value in row.items():
                        key_clean = key.strip().lower().replace(" ", "_")
                        if key_clean and value.strip():
                            data[key_clean] = value.strip()
        except Exception as e:
            self._add_warning(
                WarningLevel.CRITICAL,
                WarningType.MISSING_DATA,
                f"读取土壤试验文件失败: {e}",
            )
            return None

        required_fields = ["soil_type", "saturated_hydraulic_conductivity"]
        missing = [f for f in required_fields if f not in data]
        if missing:
            self._add_warning(
                WarningLevel.CRITICAL,
                WarningType.MISSING_DATA,
                f"缺少必需字段: {', '.join(missing)}",
            )
            return None

        try:
            Ks = float(data.get("saturated_hydraulic_conductivity", 0))
            if Ks <= 0:
                raise ValueError("饱和导水率必须大于0")
        except (ValueError, TypeError) as e:
            self._add_warning(
                WarningLevel.CRITICAL,
                WarningType.OUTLIER,
                f"饱和导水率数据无效: {e}",
            )
            return None

        def get_float(key: str, default: Optional[float] = None) -> Optional[float]:
            if key in data:
                try:
                    return float(data[key])
                except (ValueError, TypeError):
                    return default
            return default

        soil_type = data.get("soil_type", "unknown")
        theta_i = get_float("initial_moisture", 0.2)
        theta_s = get_float("saturated_moisture", 0.45)

        if theta_i is not None and theta_s is not None:
            if theta_i >= theta_s:
                self._add_warning(
                    WarningLevel.WARNING,
                    WarningType.SOIL_PARAMS_UNRELIABLE,
                    "初始含水量大于等于饱和含水量",
                    field="initial_moisture",
                    value=theta_i,
                    suggestion="请核实土壤含水量数据",
                )
            if not (0 <= theta_i <= 1):
                self._add_warning(
                    WarningLevel.WARNING,
                    WarningType.SOIL_PARAMS_UNRELIABLE,
                    f"初始含水量 {theta_i} 超出合理范围 [0, 1]",
                    field="initial_moisture",
                    value=theta_i,
                )
            if not (0 < theta_s <= 1):
                self._add_warning(
                    WarningLevel.WARNING,
                    WarningType.SOIL_PARAMS_UNRELIABLE,
                    f"饱和含水量 {theta_s} 超出合理范围 (0, 1]",
                    field="saturated_moisture",
                    value=theta_s,
                )

        soil_type_ranges = {
            "sand": (10, 1000),
            "loamy_sand": (5, 50),
            "sandy_loam": (1, 30),
            "loam": (0.5, 10),
            "silt_loam": (0.1, 5),
            "sandy_clay_loam": (0.1, 3),
            "clay_loam": (0.1, 2),
            "silty_clay_loam": (0.05, 1),
            "sandy_clay": (0.01, 0.5),
            "silty_clay": (0.01, 0.3),
            "clay": (0.001, 0.1),
        }

        soil_lower = soil_type.lower().replace(" ", "_")
        if soil_lower in soil_type_ranges:
            min_ks, max_ks = soil_type_ranges[soil_lower]
            if Ks < min_ks or Ks > max_ks:
                self._add_warning(
                    WarningLevel.WARNING,
                    WarningType.SOIL_PARAMS_UNRELIABLE,
                    f"{soil_type} 的导水率 {Ks} mm/h 超出典型范围 [{min_ks}, {max_ks}]",
                    field="saturated_hydraulic_conductivity",
                    value=Ks,
                    suggestion="建议进行现场双环入渗试验核实",
                )

        try:
            soil_test = SoilInfiltrationTest(
                test_id=test_id,
                soil_type=soil_type,
                initial_moisture=theta_i if theta_i else 0.2,
                saturated_moisture=theta_s if theta_s else 0.45,
                saturated_hydraulic_conductivity=Ks,
                suction_head=get_float("suction_head"),
                horton_f0=get_float("horton_f0"),
                horton_fc=get_float("horton_fc"),
                horton_k=get_float("horton_k"),
                sorptivity=get_float("sorptivity"),
            )
            return soil_test
        except Exception as e:
            self._add_warning(
                WarningLevel.CRITICAL,
                WarningType.MISSING_DATA,
                f"创建土壤试验数据失败: {e}",
            )
            return None

    def parse_catchment_csv(
        self,
        file_path: Path,
        delimiter: str = ",",
    ) -> List[CatchmentArea]:
        self.warnings.clear()
        catchments: List[CatchmentArea] = []

        if not file_path.exists():
            self._add_warning(
                WarningLevel.CRITICAL,
                WarningType.MISSING_DATA,
                f"汇水面积文件不存在: {file_path}",
            )
            return catchments

        try:
            with open(file_path, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f, delimiter=delimiter)
                for row_num, row in enumerate(reader, start=1):
                    try:
                        name = row.get("name", f"catchment_{row_num}").strip()
                        area = float(row.get("area", 0))
                        runoff_coeff = float(row.get("runoff_coefficient", 0.5))
                        land_use = row.get("land_use_type", "").strip() or None
                        impervious = row.get("impervious_ratio", "").strip()

                        if impervious:
                            impervious_val = float(impervious)
                        else:
                            impervious_val = None

                        expected_c_min = (impervious_val * 0.6) if impervious_val else 0.3
                        expected_c_max = (impervious_val * 0.95 + 0.05) if impervious_val else 0.95

                        if not (expected_c_min <= runoff_coeff <= expected_c_max):
                            self._add_warning(
                                WarningLevel.WARNING,
                                WarningType.RUNOFF_COEFFICIENT_CONFLICT,
                                f"汇水区 {name} 的径流系数 {runoff_coeff} "
                                f"与不透水率 {impervious_val} 不一致",
                                field=f"row_{row_num}",
                                value=runoff_coeff,
                                suggestion=f"根据不透水率，预期范围约 [{expected_c_min:.2f}, {expected_c_max:.2f}]",
                            )

                        catchment = CatchmentArea(
                            name=name,
                            area=area,
                            runoff_coefficient=runoff_coeff,
                            land_use_type=land_use,
                            impervious_ratio=impervious_val,
                        )
                        catchments.append(catchment)
                    except Exception as e:
                        self._add_warning(
                            WarningLevel.WARNING,
                            WarningType.MISSING_DATA,
                            f"解析汇水区第 {row_num} 行失败: {e}",
                        )
                        continue
        except Exception as e:
            self._add_warning(
                WarningLevel.CRITICAL,
                WarningType.MISSING_DATA,
                f"读取汇水面积文件失败: {e}",
            )

        if not catchments:
            self._add_warning(
                WarningLevel.CRITICAL,
                WarningType.MISSING_DATA,
                "没有有效的汇水区数据",
            )

        return catchments

    def parse_pond_csv(
        self,
        file_path: Path,
        delimiter: str = ",",
    ) -> Optional[PondGeometry]:
        self.warnings.clear()

        if not file_path.exists():
            self._add_warning(
                WarningLevel.CRITICAL,
                WarningType.MISSING_DATA,
                f"池体几何文件不存在: {file_path}",
            )
            return None

        data: Dict[str, Any] = {}
        try:
            with open(file_path, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f, delimiter=delimiter)
                for row in reader:
                    for key, value in row.items():
                        key_clean = key.strip().lower().replace(" ", "_")
                        if key_clean and value.strip():
                            data[key_clean] = value.strip()
        except Exception as e:
            self._add_warning(
                WarningLevel.CRITICAL,
                WarningType.MISSING_DATA,
                f"读取池体几何文件失败: {e}",
            )
            return None

        required_fields = ["surface_area", "depth"]
        missing = [f for f in required_fields if f not in data]
        if missing:
            self._add_warning(
                WarningLevel.CRITICAL,
                WarningType.MISSING_DATA,
                f"缺少必需字段: {', '.join(missing)}",
            )
            return None

        def get_float(key: str, default: Optional[float] = None) -> Optional[float]:
            if key in data:
                try:
                    val = float(data[key])
                    if val < 0:
                        return default
                    return val
                except (ValueError, TypeError):
                    return default
            return default

        try:
            surface_area = float(data["surface_area"])
            depth = float(data["depth"])

            if surface_area <= 0:
                raise ValueError("表面积必须大于0")
            if depth <= 0:
                raise ValueError("深度必须大于0")

            if depth > 2.0:
                self._add_warning(
                    WarningLevel.WARNING,
                    WarningType.CAPACITY_INSUFFICIENT,
                    f"池体深度 {depth} m 超过雨水花园常见深度范围 (0.3-1.5m)",
                    field="depth",
                    value=depth,
                    suggestion="建议核实设计深度是否符合海绵城市规范",
                )

            pond = PondGeometry(
                name=data.get("name", "rain_garden").strip(),
                surface_area=surface_area,
                depth=depth,
                underdrain_rate=get_float("underdrain_rate"),
                shape_type=data.get("shape_type", "rectangular").strip(),
                bottom_area=get_float("bottom_area"),
                side_slope=get_float("side_slope"),
            )
            return pond
        except Exception as e:
            self._add_warning(
                WarningLevel.CRITICAL,
                WarningType.MISSING_DATA,
                f"创建池体几何数据失败: {e}",
            )
            return None
