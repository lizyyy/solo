from datetime import datetime, date
from typing import List, Dict, Optional, Tuple
from collections import defaultdict

from .models import (
    SprayJob, Pesticide, WeatherRecord, ValidationResult,
    Violation, ViolationType
)
from .store import store


class ValidationEngine:
    @staticmethod
    def validate_single_job(job: SprayJob) -> ValidationResult:
        pesticide = store.get_pesticide(job.pesticide_id)
        weather = store.get_weather_by_date_area(str(job.job_date), job.area)
        violations: List[Violation] = []

        if pesticide:
            violations.extend(
                ValidationEngine._check_wind_speed(job, pesticide, weather)
            )
            violations.extend(
                ValidationEngine._check_dosage(job, pesticide)
            )
            violations.extend(
                ValidationEngine._check_safety_interval(job, pesticide)
            )

        stock_sufficient, stock_available, stock_needed = ValidationEngine._check_stock(
            job, pesticide
        )
        if stock_sufficient is False:
            violations.append(Violation(
                type=ViolationType.INSUFFICIENT_STOCK,
                severity="error",
                message=f"药剂库存不足: 需要 {stock_needed} 单位，库存仅有 {stock_available} 单位",
                expected_value=stock_needed,
                actual_value=stock_available
            ))

        is_valid = len([v for v in violations if v.severity == "error"]) == 0

        result = ValidationResult(
            job_id=job.id,
            is_valid=is_valid,
            violations=violations,
            stock_sufficient=stock_sufficient,
            stock_available=stock_available,
            stock_needed=stock_needed
        )
        store.add_validation_result(result)
        return result

    @staticmethod
    def _check_wind_speed(
        job: SprayJob, pesticide: Pesticide, weather: Optional[WeatherRecord]
    ) -> List[Violation]:
        violations = []
        if not weather:
            return violations

        if weather.wind_speed > pesticide.max_wind_speed:
            violations.append(Violation(
                type=ViolationType.WIND_SPEED_EXCEEDED,
                severity="error",
                message=f"风速超标: 当日风速 {weather.wind_speed} m/s，超过最大允许值 {pesticide.max_wind_speed} m/s",
                expected_value=pesticide.max_wind_speed,
                actual_value=weather.wind_speed,
                details={
                    "wind_speed": weather.wind_speed,
                    "max_allowed": pesticide.max_wind_speed,
                    "temperature": weather.temperature,
                    "humidity": weather.humidity,
                    "rainfall": weather.rainfall
                }
            ))
        return violations

    @staticmethod
    def _check_dosage(job: SprayJob, pesticide: Pesticide) -> List[Violation]:
        violations = []
        max_allowed = job.area_size_hectares * pesticide.max_dosage_per_hectare

        if job.dosage_used > max_allowed:
            overage = job.dosage_used - max_allowed
            overage_percent = (overage / max_allowed) * 100
            severity = "warning" if overage_percent <= 10 else "error"
            violations.append(Violation(
                type=ViolationType.DOSAGE_EXCEEDED,
                severity=severity,
                message=f"用量超标: 实际使用 {job.dosage_used} 单位，最大允许 {max_allowed:.2f} 单位 (超标 {overage_percent:.1f}%)",
                expected_value=max_allowed,
                actual_value=job.dosage_used,
                details={
                    "area_hectares": job.area_size_hectares,
                    "max_per_hectare": pesticide.max_dosage_per_hectare,
                    "overage": overage,
                    "overage_percent": overage_percent
                }
            ))
        return violations

    @staticmethod
    def _check_safety_interval(job: SprayJob, pesticide: Pesticide) -> List[Violation]:
        violations = []
        if not job.last_spray_date:
            return violations

        days_since_last = (job.job_date - job.last_spray_date).days
        if days_since_last < pesticide.safety_interval_days:
            days_short = pesticide.safety_interval_days - days_since_last
            violations.append(Violation(
                type=ViolationType.SAFETY_INTERVAL_VIOLATED,
                severity="error",
                message=f"安全间隔期违反: 距离上次喷洒仅 {days_since_last} 天，要求最少 {pesticide.safety_interval_days} 天 (还差 {days_short} 天)",
                expected_value=pesticide.safety_interval_days,
                actual_value=days_since_last,
                details={
                    "last_spray_date": str(job.last_spray_date),
                    "current_job_date": str(job.job_date),
                    "days_since_last": days_since_last,
                    "required_interval": pesticide.safety_interval_days,
                    "days_short": days_short
                }
            ))
        return violations

    @staticmethod
    def _check_stock(
        job: SprayJob, pesticide: Optional[Pesticide]
    ) -> Tuple[Optional[bool], Optional[float], Optional[float]]:
        if not pesticide:
            return None, None, None

        stock_available = pesticide.stock_quantity
        stock_needed = job.dosage_used
        sufficient = stock_available >= stock_needed
        return sufficient, stock_available, stock_needed

    @staticmethod
    def validate_all_jobs() -> List[ValidationResult]:
        results = []
        for job in store.get_all_spray_jobs():
            result = ValidationEngine.validate_single_job(job)
            results.append(result)
        return results

    @staticmethod
    def get_violation_statistics() -> Dict[str, int]:
        counts = defaultdict(int)
        for result in store.get_all_validation_results():
            for violation in result.violations:
                counts[violation.type.value] += 1
        return dict(counts)
