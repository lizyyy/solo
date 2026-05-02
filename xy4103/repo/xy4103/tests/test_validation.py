import pytest
from zhr_validator.models import ProjectConfig, ValidationSeverity
from zhr_validator.validation import (
    validate_coordinates,
    validate_timezone,
    validate_cloud_cover,
    validate_limiting_magnitude,
    validate_meteor_count,
    validate_single_record,
    validate_batch_records,
)


class TestCoordinateValidation:
    def test_valid_coordinates(self):
        issues = validate_coordinates(40.0, 116.5)
        assert len(issues) == 0

    def test_invalid_latitude_high(self):
        issues = validate_coordinates(100.0, 116.5)
        assert len(issues) == 1
        assert issues[0].code == "INV_LAT"
        assert issues[0].severity == ValidationSeverity.ERROR

    def test_invalid_latitude_low(self):
        issues = validate_coordinates(-100.0, 116.5)
        assert len(issues) == 1
        assert issues[0].code == "INV_LAT"

    def test_invalid_longitude_high(self):
        issues = validate_coordinates(40.0, 200.0)
        assert len(issues) == 1
        assert issues[0].code == "INV_LON"

    def test_invalid_longitude_low(self):
        issues = validate_coordinates(40.0, -200.0)
        assert len(issues) == 1
        assert issues[0].code == "INV_LON"

    def test_null_island_warning(self):
        issues = validate_coordinates(0.5, 0.5)
        assert len(issues) == 1
        assert issues[0].code == "NULL_ISLAND"
        assert issues[0].severity == ValidationSeverity.WARNING

    def test_elevation_warning(self):
        issues = validate_coordinates(40.0, 116.5, 15000.0)
        assert len(issues) == 1
        assert issues[0].code == "INV_ELEV"


class TestTimezoneValidation:
    def test_valid_timezone(self):
        issues = validate_timezone("Asia/Shanghai")
        assert len(issues) == 0

    def test_invalid_timezone(self):
        issues = validate_timezone("Invalid/Timezone")
        assert len(issues) == 1
        assert issues[0].code == "INV_TZ"
        assert issues[0].severity == ValidationSeverity.ERROR


class TestCloudCoverValidation:
    def test_valid_cloud_cover(self):
        issues = validate_cloud_cover(0.5)
        assert len(issues) == 0

    def test_high_cloud_warning(self):
        issues = validate_cloud_cover(0.8)
        assert len(issues) == 1
        assert issues[0].code == "BAD_CLOUD"
        assert issues[0].severity == ValidationSeverity.WARNING

    def test_invalid_cloud_cover(self):
        issues = validate_cloud_cover(1.5)
        assert len(issues) == 1
        assert issues[0].code == "INV_CLOUD"
        assert issues[0].severity == ValidationSeverity.ERROR

    def test_negative_cloud_cover(self):
        issues = validate_cloud_cover(-0.1)
        assert len(issues) == 1
        assert issues[0].code == "INV_CLOUD"


class TestLimitingMagnitudeValidation:
    def test_valid_lm(self):
        issues = validate_limiting_magnitude(6.5)
        assert len(issues) == 0

    def test_low_lm_warning(self):
        issues = validate_limiting_magnitude(4.0)
        assert len(issues) == 1
        assert issues[0].code == "BAD_LM"
        assert issues[0].severity == ValidationSeverity.WARNING

    def test_invalid_lm_high(self):
        issues = validate_limiting_magnitude(10.0)
        assert len(issues) == 1
        assert issues[0].code == "INV_LM"
        assert issues[0].severity == ValidationSeverity.ERROR

    def test_invalid_lm_low(self):
        issues = validate_limiting_magnitude(-1.0)
        assert len(issues) == 1
        assert issues[0].code == "INV_LM"


class TestMeteorCountValidation:
    def test_valid_count(self):
        issues = validate_meteor_count(25, 2.0)
        assert len(issues) == 0

    def test_negative_count(self):
        issues = validate_meteor_count(-5, 2.0)
        assert len(issues) == 1
        assert issues[0].code == "INV_METEOR"
        assert issues[0].severity == ValidationSeverity.ERROR

    def test_zero_count(self):
        issues = validate_meteor_count(0, 2.0)
        assert len(issues) == 1
        assert issues[0].code == "ZERO_METEOR"
        assert issues[0].severity == ValidationSeverity.INFO

    def test_few_meteors(self):
        issues = validate_meteor_count(3, 2.0)
        assert len(issues) == 1
        assert issues[0].code == "FEW_METEOR"
        assert issues[0].severity == ValidationSeverity.INFO

    def test_unrealistic_rate(self):
        issues = validate_meteor_count(600, 1.0)
        assert len(issues) == 1
        assert issues[0].code == "UNREAL_RATE"
        assert issues[0].severity == ValidationSeverity.WARNING


class TestSingleRecordValidation:
    def test_valid_record(self):
        config = ProjectConfig()
        raw_data = {
            "observer_name": "测试者",
            "observation_date": "2024-08-12",
            "start_time": "20:00",
            "end_time": "22:00",
            "timezone": "Asia/Shanghai",
            "latitude": "40.0",
            "longitude": "116.5",
            "cloud_cover": "0.1",
            "limiting_magnitude": "6.5",
            "meteor_count": "25",
            "remarks": "测试",
        }
        result, record = validate_single_record(raw_data, 0, "test.csv", config)

        assert result.is_valid is True
        assert record is not None
        assert record.observer_name == "测试者"

    def test_missing_field(self):
        config = ProjectConfig()
        raw_data = {
            "observer_name": "",
            "observation_date": "2024-08-12",
            "start_time": "20:00",
            "end_time": "22:00",
            "timezone": "Asia/Shanghai",
            "latitude": "40.0",
            "longitude": "116.5",
            "cloud_cover": "0.1",
            "limiting_magnitude": "6.5",
            "meteor_count": "25",
        }
        result, record = validate_single_record(raw_data, 0, "test.csv", config)

        assert result.is_valid is False
        assert record is None
        assert any(i.code == "MISSING_FIELD" for i in result.issues)

    def test_invalid_timezone_in_record(self):
        config = ProjectConfig()
        raw_data = {
            "observer_name": "测试者",
            "observation_date": "2024-08-12",
            "start_time": "20:00",
            "end_time": "22:00",
            "timezone": "Invalid/Timezone",
            "latitude": "40.0",
            "longitude": "116.5",
            "cloud_cover": "0.1",
            "limiting_magnitude": "6.5",
            "meteor_count": "25",
        }
        result, record = validate_single_record(raw_data, 0, "test.csv", config)

        assert result.is_valid is False
        assert any(i.code == "INV_TZ" for i in result.issues)


class TestBatchValidation:
    def test_batch_valid_records(self):
        config = ProjectConfig()
        records_with_meta = [
            (
                {
                    "observer_name": f"观测者{i}",
                    "observation_date": "2024-08-12",
                    "start_time": "20:00",
                    "end_time": "22:00",
                    "timezone": "Asia/Shanghai",
                    "latitude": f"{40.0 + i * 0.1}",
                    "longitude": f"{116.5 + i * 0.1}",
                    "cloud_cover": "0.1",
                    "limiting_magnitude": "6.5",
                    "meteor_count": str(20 + i * 5),
                },
                i,
                "test.csv",
            )
            for i in range(3)
        ]

        result = validate_batch_records(records_with_meta, config)

        assert result.total_records == 3
        assert result.valid_records == 3
        assert result.invalid_records == 0

    def test_batch_with_errors(self):
        config = ProjectConfig()
        records_with_meta = [
            (
                {
                    "observer_name": "有效记录",
                    "observation_date": "2024-08-12",
                    "start_time": "20:00",
                    "end_time": "22:00",
                    "timezone": "Asia/Shanghai",
                    "latitude": "40.0",
                    "longitude": "116.5",
                    "cloud_cover": "0.1",
                    "limiting_magnitude": "6.5",
                    "meteor_count": "25",
                },
                0,
                "test.csv",
            ),
            (
                {
                    "observer_name": "无效时区",
                    "observation_date": "2024-08-12",
                    "start_time": "20:00",
                    "end_time": "22:00",
                    "timezone": "Invalid/Timezone",
                    "latitude": "40.0",
                    "longitude": "116.5",
                    "cloud_cover": "0.1",
                    "limiting_magnitude": "6.5",
                    "meteor_count": "25",
                },
                1,
                "test.csv",
            ),
        ]

        result = validate_batch_records(records_with_meta, config)

        assert result.total_records == 2
        assert result.valid_records == 1
        assert result.invalid_records == 1

    def test_duplicate_observer_detection(self):
        config = ProjectConfig()
        records_with_meta = [
            (
                {
                    "observer_name": "重复观测者",
                    "observation_date": "2024-08-12",
                    "start_time": "20:00",
                    "end_time": "22:00",
                    "timezone": "Asia/Shanghai",
                    "latitude": "40.0",
                    "longitude": "116.5",
                    "cloud_cover": "0.1",
                    "limiting_magnitude": "6.5",
                    "meteor_count": "25",
                },
                0,
                "test1.csv",
            ),
            (
                {
                    "observer_name": "重复观测者",
                    "observation_date": "2024-08-12",
                    "start_time": "20:00",
                    "end_time": "22:00",
                    "timezone": "Asia/Shanghai",
                    "latitude": "40.0",
                    "longitude": "116.5",
                    "cloud_cover": "0.15",
                    "limiting_magnitude": "6.3",
                    "meteor_count": "30",
                },
                1,
                "test2.csv",
            ),
        ]

        result = validate_batch_records(records_with_meta, config, check_duplicates=True)

        assert len(result.duplicate_observer_groups) == 1

    def test_overlapping_period_detection(self):
        config = ProjectConfig()
        records_with_meta = [
            (
                {
                    "observer_name": "观测者A",
                    "observation_date": "2024-08-12",
                    "start_time": "20:00",
                    "end_time": "22:00",
                    "timezone": "Asia/Shanghai",
                    "latitude": "40.0",
                    "longitude": "116.5",
                    "cloud_cover": "0.1",
                    "limiting_magnitude": "6.5",
                    "meteor_count": "25",
                },
                0,
                "test1.csv",
            ),
            (
                {
                    "observer_name": "观测者B",
                    "observation_date": "2024-08-12",
                    "start_time": "21:00",
                    "end_time": "23:00",
                    "timezone": "Asia/Shanghai",
                    "latitude": "40.1",
                    "longitude": "116.6",
                    "cloud_cover": "0.15",
                    "limiting_magnitude": "6.3",
                    "meteor_count": "30",
                },
                1,
                "test2.csv",
            ),
        ]

        result = validate_batch_records(records_with_meta, config, check_overlaps=True)

        assert len(result.overlapping_period_groups) == 1
