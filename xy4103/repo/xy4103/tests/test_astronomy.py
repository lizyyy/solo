import pytest
import zoneinfo
from datetime import datetime, timedelta
from zhr_validator.models import ObservationRecord, ProjectConfig
from zhr_validator.astronomy import (
    parse_local_datetime,
    local_to_utc,
    get_utc_period,
    calculate_cloud_correction,
    calculate_limiting_mag_correction,
    calculate_raw_zhr,
    calculate_zhr_confidence_interval,
    calculate_observation_weight,
    calculate_single_zhr,
    calculate_aggregate_zhr,
)


class TestTimezoneConversion:
    def test_parse_local_datetime(self):
        dt = parse_local_datetime("2024-08-12", "20:00", "Asia/Shanghai")
        assert dt.tzinfo is not None
        assert dt.hour == 20
        assert dt.minute == 0

    def test_parse_local_datetime_alt_format(self):
        dt = parse_local_datetime("2024/08/12", "20:00", "Asia/Shanghai")
        assert dt.hour == 20

    def test_local_to_utc(self):
        shanghai_tz = zoneinfo.ZoneInfo("Asia/Shanghai")
        local_dt = datetime(2024, 8, 12, 20, 0, tzinfo=shanghai_tz)
        utc_dt = local_to_utc(local_dt)
        assert utc_dt.hour == 12

    def test_get_utc_period_normal(self):
        record = ObservationRecord(
            observer_name="测试者",
            observation_date="2024-08-12",
            start_time="20:00",
            end_time="22:00",
            timezone="Asia/Shanghai",
            latitude=40.0,
            longitude=116.5,
            cloud_cover=0.1,
            limiting_magnitude=6.5,
            meteor_count=25,
        )
        period = get_utc_period(record)
        assert period.utc_start.hour == 12
        assert period.utc_end.hour == 14

    def test_get_utc_period_cross_midnight(self):
        record = ObservationRecord(
            observer_name="测试者",
            observation_date="2024-08-12",
            start_time="23:00",
            end_time="01:30",
            timezone="Asia/Shanghai",
            latitude=40.0,
            longitude=116.5,
            cloud_cover=0.1,
            limiting_magnitude=6.5,
            meteor_count=25,
        )
        period = get_utc_period(record)
        assert period.duration_hours == pytest.approx(2.5)


class TestCorrectionFactors:
    def test_cloud_correction_clear(self):
        assert calculate_cloud_correction(0.0) == 1.0

    def test_cloud_correction_partial(self):
        assert calculate_cloud_correction(0.25) == pytest.approx(1.0 / 0.75)

    def test_cloud_correction_half(self):
        assert calculate_cloud_correction(0.5) == 2.0

    def test_lm_correction_equal(self):
        assert calculate_limiting_mag_correction(6.5, 2.0, 6.5) == 1.0

    def test_lm_correction_darker(self):
        assert calculate_limiting_mag_correction(7.0, 2.0, 6.5) == 1.0

    def test_lm_correction_brighter(self):
        assert calculate_limiting_mag_correction(5.5, 2.0, 6.5) == pytest.approx(2.0)


class TestZHRCalculation:
    def test_raw_zhr(self):
        assert calculate_raw_zhr(25, 2.0) == 12.5
        assert calculate_raw_zhr(10, 1.0) == 10.0

    def test_raw_zhr_zero_duration(self):
        assert calculate_raw_zhr(25, 0.0) == 0.0

    def test_confidence_interval(self):
        lower, upper = calculate_zhr_confidence_interval(25, 2.0, 12.5, 0.68)
        assert lower < 12.5
        assert upper > 12.5

    def test_confidence_interval_zero_meteors(self):
        lower, upper = calculate_zhr_confidence_interval(0, 2.0, 0.0, 0.68)
        assert lower == 0.0
        assert upper == 0.0

    def test_observation_weight_good(self):
        weight = calculate_observation_weight(
            duration_hours=2.0,
            meteor_count=20,
            cloud_cover=0.1,
            limiting_magnitude=6.5,
            is_bad_weather=False,
        )
        assert weight > 0.8

    def test_observation_weight_bad_weather(self):
        weight = calculate_observation_weight(
            duration_hours=2.0,
            meteor_count=20,
            cloud_cover=0.8,
            limiting_magnitude=6.5,
            is_bad_weather=True,
        )
        assert weight == 0.0

    def test_observation_weight_few_meteors(self):
        weight = calculate_observation_weight(
            duration_hours=2.0,
            meteor_count=2,
            cloud_cover=0.1,
            limiting_magnitude=6.5,
            is_bad_weather=False,
        )
        assert weight == 0.0


class TestSingleZHR:
    def test_calculate_single_zhr(self):
        config = ProjectConfig()
        record = ObservationRecord(
            observer_name="测试者",
            observation_date="2024-08-12",
            start_time="20:00",
            end_time="22:00",
            timezone="Asia/Shanghai",
            latitude=40.0,
            longitude=116.5,
            cloud_cover=0.1,
            limiting_magnitude=6.5,
            meteor_count=25,
        )
        calc = calculate_single_zhr(record, config)

        assert calc.observer_name == "测试者"
        assert calc.raw_zhr == 12.5
        assert calc.cloud_correction_factor > 1.0
        assert calc.limiting_mag_correction_factor == 1.0
        assert calc.corrected_zhr > calc.raw_zhr
        assert calc.zhr_lower < calc.corrected_zhr
        assert calc.zhr_upper > calc.corrected_zhr
        assert calc.is_reliable is True

    def test_calculate_single_zhr_bad_weather(self):
        config = ProjectConfig()
        record = ObservationRecord(
            observer_name="测试者",
            observation_date="2024-08-12",
            start_time="20:00",
            end_time="22:00",
            timezone="Asia/Shanghai",
            latitude=40.0,
            longitude=116.5,
            cloud_cover=0.8,
            limiting_magnitude=6.5,
            meteor_count=5,
        )
        calc = calculate_single_zhr(record, config)

        assert calc.is_bad_weather is True
        assert calc.is_reliable is False


class TestAggregateZHR:
    def test_calculate_aggregate_zhr(self):
        config = ProjectConfig()

        records = [
            ObservationRecord(
                observer_name=f"观测者{i}",
                observation_date="2024-08-12",
                start_time="20:00",
                end_time="22:00",
                timezone="Asia/Shanghai",
                latitude=40.0,
                longitude=116.5,
                cloud_cover=0.1,
                limiting_magnitude=6.5,
                meteor_count=20 + i * 5,
            )
            for i in range(3)
        ]

        calculations = [calculate_single_zhr(r, config) for r in records]
        result = calculate_aggregate_zhr(
            calculations,
            config,
            shower_name="测试流星雨",
            observation_date="2024-08-12",
        )

        assert result.total_records == 3
        assert result.reliable_records == 3
        assert result.mean_zhr > 0
        assert result.median_zhr > 0
        assert result.weighted_mean_zhr > 0
        assert result.zhr_lower_aggregate < result.weighted_mean_zhr
        assert result.zhr_upper_aggregate > result.weighted_mean_zhr

    def test_calculate_aggregate_zhr_empty(self):
        config = ProjectConfig()
        result = calculate_aggregate_zhr(
            [],
            config,
            shower_name="测试流星雨",
            observation_date="2024-08-12",
        )
        assert result.total_records == 0
        assert result.mean_zhr == 0.0
