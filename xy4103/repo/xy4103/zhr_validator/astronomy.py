import math
import zoneinfo
from datetime import datetime, timedelta
from typing import Optional, Tuple
from zhr_validator.models import ObservationRecord, ZHRCalculation, ObservationPeriod, ProjectConfig


def parse_local_datetime(
    date_str: str,
    time_str: str,
    timezone_str: str,
) -> datetime:
    dt_str = f"{date_str} {time_str}"
    try:
        local_dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M")
    except ValueError:
        local_dt = datetime.strptime(dt_str, "%Y/%m/%d %H:%M")
    tz = zoneinfo.ZoneInfo(timezone_str)
    return local_dt.replace(tzinfo=tz)


def local_to_utc(local_dt: datetime) -> datetime:
    return local_dt.astimezone(zoneinfo.ZoneInfo("UTC"))


def get_utc_period(
    record: ObservationRecord,
) -> ObservationPeriod:
    local_start = parse_local_datetime(
        record.observation_date,
        record.start_time,
        record.timezone,
    )
    local_end = parse_local_datetime(
        record.observation_date,
        record.end_time,
        record.timezone,
    )

    if local_end <= local_start:
        local_end += timedelta(days=1)

    utc_start = local_to_utc(local_start)
    utc_end = local_to_utc(local_end)

    return ObservationPeriod(utc_start=utc_start, utc_end=utc_end)


def calculate_cloud_correction(cloud_cover: float) -> float:
    if cloud_cover >= 1.0:
        return float("inf")
    if cloud_cover <= 0.0:
        return 1.0
    return 1.0 / (1.0 - cloud_cover)


def calculate_limiting_mag_correction(
    limiting_mag: float,
    population_index: float = 2.0,
    reference_limiting_mag: float = 6.5,
) -> float:
    if limiting_mag >= reference_limiting_mag:
        return 1.0
    lm_diff = reference_limiting_mag - limiting_mag
    return math.pow(population_index, lm_diff)


def calculate_raw_zhr(
    meteor_count: int,
    duration_hours: float,
) -> float:
    if duration_hours <= 0:
        return 0.0
    return meteor_count / duration_hours


def calculate_zhr_confidence_interval(
    meteor_count: int,
    duration_hours: float,
    corrected_zhr: float,
    confidence_level: float = 0.68,
) -> Tuple[float, float]:
    if meteor_count <= 0:
        return (0.0, 0.0)

    z_scores = {
        0.50: 0.674,
        0.68: 1.000,
        0.80: 1.282,
        0.90: 1.645,
        0.95: 1.960,
        0.99: 2.576,
        0.997: 3.000,
        0.999: 3.291,
    }

    z = z_scores.get(confidence_level, 1.0)
    poisson_std = math.sqrt(meteor_count)

    rate = meteor_count / duration_hours if duration_hours > 0 else 0
    rate_std = poisson_std / duration_hours if duration_hours > 0 else 0

    if rate <= 0:
        return (0.0, 0.0)

    if corrected_zhr > rate:
        correction_factor = corrected_zhr / rate
    else:
        correction_factor = 1.0

    lower = max(0.0, corrected_zhr - z * rate_std * correction_factor)
    upper = corrected_zhr + z * rate_std * correction_factor

    return (lower, upper)


def calculate_observation_weight(
    duration_hours: float,
    meteor_count: int,
    cloud_cover: float,
    limiting_mag: float,
    is_bad_weather: bool,
) -> float:
    if is_bad_weather or meteor_count < 3 or duration_hours < 0.1:
        return 0.0

    duration_weight = min(1.0, duration_hours / 2.0)
    count_weight = min(1.0, meteor_count / 20.0)
    cloud_weight = 1.0 - cloud_cover
    lm_weight = min(1.0, limiting_mag / 6.5)

    weight = (
        duration_weight * 0.3
        + count_weight * 0.3
        + cloud_weight * 0.2
        + lm_weight * 0.2
    )

    return max(0.0, weight)


def calculate_single_zhr(
    record: ObservationRecord,
    config: ProjectConfig,
) -> ZHRCalculation:
    period = get_utc_period(record)

    raw_zhr = calculate_raw_zhr(record.meteor_count, period.duration_hours)

    cloud_factor = calculate_cloud_correction(record.cloud_cover)
    if math.isinf(cloud_factor):
        cloud_factor = 1000.0

    lm_factor = calculate_limiting_mag_correction(
        record.limiting_magnitude,
        config.population_index,
    )

    corrected_zhr = raw_zhr * cloud_factor * lm_factor

    zhr_lower, zhr_upper = calculate_zhr_confidence_interval(
        record.meteor_count,
        period.duration_hours,
        corrected_zhr,
        config.confidence_level,
    )

    weight = calculate_observation_weight(
        period.duration_hours,
        record.meteor_count,
        record.cloud_cover,
        record.limiting_magnitude,
        record.is_bad_weather,
    )

    record_id = f"{record.observer_name}_{period.utc_start.strftime('%Y%m%d%H%M')}"

    return ZHRCalculation(
        record_id=record_id,
        observer_name=record.observer_name,
        observation_date=record.observation_date,
        utc_start=period.utc_start,
        utc_end=period.utc_end,
        duration_hours=period.duration_hours,
        latitude=record.latitude,
        longitude=record.longitude,
        meteor_count=record.meteor_count,
        cloud_cover=record.cloud_cover,
        limiting_magnitude=record.limiting_magnitude,
        raw_zhr=raw_zhr,
        population_index=config.population_index,
        cloud_correction_factor=cloud_factor,
        limiting_mag_correction_factor=lm_factor,
        corrected_zhr=corrected_zhr,
        zhr_lower=zhr_lower,
        zhr_upper=zhr_upper,
        confidence_level=config.confidence_level,
        observation_weight=weight,
        is_bad_weather=record.is_bad_weather,
    )


def calculate_aggregate_zhr(
    calculations: list[ZHRCalculation],
    config: ProjectConfig,
    shower_name: str = "未指定流星雨",
    observation_date: str = "",
) -> "ZHRBatchResult":
    from zhr_validator.models import ZHRBatchResult

    reliable = [c for c in calculations if c.is_reliable]
    unreliable = [c for c in calculations if not c.is_reliable]

    if not reliable:
        reliable = calculations

    if not reliable:
        return ZHRBatchResult(
            shower_name=shower_name,
            observation_date=observation_date,
            total_records=len(calculations),
            reliable_records=0,
            unreliable_records=len(calculations),
            mean_zhr=0.0,
            median_zhr=0.0,
            weighted_mean_zhr=0.0,
            zhr_lower_aggregate=0.0,
            zhr_upper_aggregate=0.0,
            calculations=calculations,
        )

    zhr_values = [c.corrected_zhr for c in reliable]
    mean_zhr = sum(zhr_values) / len(zhr_values)

    sorted_zhr = sorted(zhr_values)
    n = len(sorted_zhr)
    if n % 2 == 0:
        median_zhr = (sorted_zhr[n // 2 - 1] + sorted_zhr[n // 2]) / 2
    else:
        median_zhr = sorted_zhr[n // 2]

    total_weight = sum(c.observation_weight for c in reliable)
    if total_weight > 0:
        weighted_sum = sum(c.corrected_zhr * c.observation_weight for c in reliable)
        weighted_mean_zhr = weighted_sum / total_weight
    else:
        weighted_mean_zhr = mean_zhr

    total_meteors = sum(c.meteor_count for c in reliable)
    total_hours = sum(c.duration_hours for c in reliable)

    if total_hours > 0 and total_meteors > 0:
        aggregate_rate = total_meteors / total_hours
        aggregate_std = math.sqrt(total_meteors) / total_hours

        z = 1.0
        if config.confidence_level <= 0.68:
            z = 1.0
        elif config.confidence_level <= 0.90:
            z = 1.645
        elif config.confidence_level <= 0.95:
            z = 1.96
        else:
            z = 2.576

        correction_factor = weighted_mean_zhr / aggregate_rate if aggregate_rate > 0 else 1.0
        zhr_lower_aggregate = max(0.0, weighted_mean_zhr - z * aggregate_std * correction_factor)
        zhr_upper_aggregate = weighted_mean_zhr + z * aggregate_std * correction_factor
    else:
        zhr_lower_aggregate = min(c.zhr_lower for c in reliable) if reliable else 0.0
        zhr_upper_aggregate = max(c.zhr_upper for c in reliable) if reliable else 0.0

    return ZHRBatchResult(
        shower_name=shower_name,
        observation_date=observation_date,
        total_records=len(calculations),
        reliable_records=len(reliable),
        unreliable_records=len(unreliable),
        mean_zhr=mean_zhr,
        median_zhr=median_zhr,
        weighted_mean_zhr=weighted_mean_zhr,
        zhr_lower_aggregate=zhr_lower_aggregate,
        zhr_upper_aggregate=zhr_upper_aggregate,
        calculations=calculations,
    )


def calculate_julian_date(dt: datetime) -> float:
    dt_utc = dt.astimezone(zoneinfo.ZoneInfo("UTC")).replace(tzinfo=None)
    a = int((14 - dt_utc.month) / 12)
    y = dt_utc.year + 4800 - a
    m = dt_utc.month + 12 * a - 3
    jdn = (
        dt_utc.day
        + int((153 * m + 2) / 5)
        + 365 * y
        + int(y / 4)
        - int(y / 100)
        + int(y / 400)
        - 32045
    )
    jd = jdn + (dt_utc.hour - 12) / 24.0 + dt_utc.minute / 1440.0 + dt_utc.second / 86400.0
    return jd


def calculate_local_sidereal_time(
    longitude: float,
    dt: datetime,
) -> float:
    jd = calculate_julian_date(dt)
    t = (jd - 2451545.0) / 36525.0
    gmst = (
        280.46061837
        + 360.98564736629 * (jd - 2451545.0)
        + 0.000387933 * t * t
        - t * t * t / 38710000.0
    )
    gmst = gmst % 360.0
    if gmst < 0:
        gmst += 360.0
    lst = (gmst + longitude) % 360.0
    return lst


def is_zenith_exposure_good(
    lst: float,
    ra_radiant: float = 0.0,
    dec_radiant: float = 0.0,
) -> bool:
    return True
