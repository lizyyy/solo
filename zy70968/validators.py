from typing import List, Tuple, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from models import Batch, Chemical, Job, WeatherRecord


class Violation:
    def __init__(self, code: str, message: str, boundary: Optional[str] = None):
        self.code = code
        self.message = message
        self.boundary = boundary

    def __str__(self):
        if self.boundary:
            return f"[{self.code}] {self.message} (边界条件: {self.boundary})"
        return f"[{self.code}] {self.message}"


class ValidationResult:
    def __init__(self):
        self.violations: List[Violation] = []
        self.warnings: List[Violation] = []

    @property
    def passed(self) -> bool:
        return len(self.violations) == 0

    def add_violation(self, code: str, message: str, boundary: Optional[str] = None):
        self.violations.append(Violation(code, message, boundary))

    def add_warning(self, code: str, message: str, boundary: Optional[str] = None):
        self.warnings.append(Violation(code, message, boundary))

    def get_violation_messages(self) -> List[str]:
        return [str(v) for v in self.violations]

    def get_warning_messages(self) -> List[str]:
        return [str(w) for w in self.warnings]

    def get_summary(self) -> str:
        parts = []
        if self.violations:
            parts.append(f"发现 {len(self.violations)} 条违规:")
            for v in self.violations:
                parts.append(f"  - {v}")
        if self.warnings:
            parts.append(f"发现 {len(self.warnings)} 条警告:")
            for w in self.warnings:
                parts.append(f"  - {w}")
        if not parts:
            parts.append("所有检查项通过，可正常放行。")
        return "\n".join(parts)


def validate_batch(db: Session, batch: Batch) -> ValidationResult:
    result = ValidationResult()
    chemical = batch.chemical
    job = batch.job
    weather = batch.weather

    if chemical is None:
        result.add_violation("CHEM_MISSING", "未关联药剂信息", "必须指定有效药剂")
        return result

    if job is None:
        result.add_violation("JOB_MISSING", "未关联作业信息", "必须指定有效作业")
        return result

    if weather is None:
        result.add_violation("WEATHER_MISSING", "未关联天气记录", "必须指定有效天气记录")
        return result

    _check_wind_speed(result, batch, chemical, weather)
    _check_dosage(result, batch, chemical, job)
    _check_safety_interval(result, batch, chemical, db)
    _check_weather_window(result, batch, weather)
    _check_rainfall(result, batch, weather)

    return result


def _check_wind_speed(result: ValidationResult, batch: Batch, chemical: Chemical, weather: WeatherRecord):
    if weather.wind_speed is None:
        result.add_warning(
            "WIND_UNKNOWN",
            "风速数据缺失",
            f"建议范围: {chemical.min_wind_speed:.1f}~{chemical.max_wind_speed:.1f} m/s"
        )
        return

    min_ws = chemical.min_wind_speed or 0.0
    max_ws = chemical.max_wind_speed or 10.0

    if weather.wind_speed < min_ws:
        result.add_violation(
            "WIND_TOO_LOW",
            f"风速 {weather.wind_speed:.1f} m/s 低于最低要求 {min_ws:.1f} m/s",
            f"允许范围: {min_ws:.1f}~{max_ws:.1f} m/s"
        )
    elif weather.wind_speed > max_ws:
        result.add_violation(
            "WIND_TOO_HIGH",
            f"风速 {weather.wind_speed:.1f} m/s 超过最高限制 {max_ws:.1f} m/s",
            f"允许范围: {min_ws:.1f}~{max_ws:.1f} m/s"
        )
    elif max_ws - weather.wind_speed < 1.0:
        result.add_warning(
            "WIND_NEAR_LIMIT",
            f"风速 {weather.wind_speed:.1f} m/s 接近上限 {max_ws:.1f} m/s，注意风向变化",
            f"允许范围: {min_ws:.1f}~{max_ws:.1f} m/s"
        )


def _check_dosage(result: ValidationResult, batch: Batch, chemical: Chemical, job: Job):
    max_dosage = chemical.max_dosage_per_ha
    if max_dosage and batch.dosage > max_dosage:
        result.add_violation(
            "DOSAGE_EXCEED",
            f"用量 {batch.dosage:.2f} L/ha 超过最大允许值 {max_dosage:.2f} L/ha",
            f"最大允许用量: {max_dosage:.2f} L/ha"
        )
    elif max_dosage and batch.dosage / max_dosage > 0.9:
        result.add_warning(
            "DOSAGE_NEAR_LIMIT",
            f"用量 {batch.dosage:.2f} L/ha 接近上限 {max_dosage:.2f} L/ha",
            f"建议控制在 {max_dosage * 0.8:.2f} L/ha 以内"
        )

    if batch.dosage <= 0:
        result.add_violation(
            "DOSAGE_INVALID",
            f"用量 {batch.dosage:.2f} L/ha 无效",
            "用量必须大于 0"
        )


def _check_safety_interval(result: ValidationResult, batch: Batch, chemical: Chemical, db: Session):
    if not chemical.safety_interval_hours:
        return

    existing = db.query(Batch).filter(
        Batch.chemical_id == chemical.id,
        Batch.id != batch.id,
        Batch.planned_date >= batch.planned_date - timedelta(hours=chemical.safety_interval_hours),
        Batch.planned_date <= batch.planned_date + timedelta(hours=chemical.safety_interval_hours),
        Batch.status.in_(["pending", "processing", "processed"]),
    ).first()

    if existing:
        result.add_violation(
            "SAFETY_INTERVAL",
            f"与批次 {existing.batch_no} 的安全间隔不足 {chemical.safety_interval_hours} 小时",
            f"安全间隔: {chemical.safety_interval_hours} 小时，冲突批次: {existing.batch_no}"
        )


def _check_weather_window(result: ValidationResult, batch: Batch, weather: WeatherRecord):
    if weather.weather_window_start and weather.weather_window_end:
        if batch.planned_date < weather.weather_window_start:
            result.add_warning(
                "WINDOW_TOO_EARLY",
                f"计划时间 {batch.planned_date.strftime('%Y-%m-%d %H:%M')} 早于天气窗口开始 {weather.weather_window_start.strftime('%Y-%m-%d %H:%M')}",
                f"有效窗口: {weather.weather_window_start.strftime('%Y-%m-%d %H:%M')} ~ {weather.weather_window_end.strftime('%Y-%m-%d %H:%M')}"
            )
        elif batch.planned_date > weather.weather_window_end:
            result.add_warning(
                "WINDOW_TOO_LATE",
                f"计划时间 {batch.planned_date.strftime('%Y-%m-%d %H:%M')} 晚于天气窗口结束 {weather.weather_window_end.strftime('%Y-%m-%d %H:%M')}",
                f"有效窗口: {weather.weather_window_start.strftime('%Y-%m-%d %H:%M')} ~ {weather.weather_window_end.strftime('%Y-%m-%d %H:%M')}"
            )


def _check_rainfall(result: ValidationResult, batch: Batch, weather: WeatherRecord):
    if weather.rainfall and weather.rainfall > 0:
        result.add_warning(
            "RAINFALL_PRESENT",
            f"有降雨记录 {weather.rainfall:.1f} mm，可能影响药效",
            "建议在无降雨条件下作业"
        )


def get_readable_violation_summary(batch: Batch, validation: ValidationResult) -> str:
    lines = []
    lines.append(f"批次 {batch.batch_no} 审核结果:")
    lines.append(f"  喷洒区域: {batch.spray_area}")
    lines.append(f"  药剂: {batch.chemical.name if batch.chemical else '未知'} ({batch.chemical.batch_no if batch.chemical else 'N/A'})")
    lines.append(f"  计划时间: {batch.planned_date.strftime('%Y-%m-%d %H:%M')}")
    lines.append(f"  用量: {batch.dosage:.2f} L/ha")
    lines.append("")
    lines.append(validation.get_summary())
    return "\n".join(lines)
