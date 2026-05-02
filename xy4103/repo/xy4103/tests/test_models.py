import pytest
from zhr_validator.models import (
    ObservationRecord,
    CloudCoverCategory,
    ProjectConfig,
)


class TestObservationRecord:
    def test_valid_record(self):
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
        assert record.observer_name == "测试者"
        assert record.cloud_cover == 0.1

    def test_cloud_category(self):
        record = ObservationRecord(
            observer_name="测试者",
            observation_date="2024-08-12",
            start_time="20:00",
            end_time="22:00",
            timezone="Asia/Shanghai",
            latitude=40.0,
            longitude=116.5,
            cloud_cover=0.05,
            limiting_magnitude=6.5,
            meteor_count=25,
        )
        assert record.cloud_category == CloudCoverCategory.EXCELLENT

        record.cloud_cover = 0.5
        assert record.cloud_category == CloudCoverCategory.FAIR

        record.cloud_cover = 0.9
        assert record.cloud_category == CloudCoverCategory.BAD

    def test_is_bad_weather(self):
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
            meteor_count=25,
        )
        assert record.is_bad_weather is True

        record.cloud_cover = 0.5
        record.limiting_magnitude = 4.0
        assert record.is_bad_weather is True

        record.cloud_cover = 0.1
        record.limiting_magnitude = 6.0
        assert record.is_bad_weather is False

    def test_invalid_latitude(self):
        with pytest.raises(Exception):
            ObservationRecord(
                observer_name="测试者",
                observation_date="2024-08-12",
                start_time="20:00",
                end_time="22:00",
                timezone="Asia/Shanghai",
                latitude=100.0,
                longitude=116.5,
                cloud_cover=0.1,
                limiting_magnitude=6.5,
                meteor_count=25,
            )

    def test_invalid_cloud_cover(self):
        with pytest.raises(Exception):
            ObservationRecord(
                observer_name="测试者",
                observation_date="2024-08-12",
                start_time="20:00",
                end_time="22:00",
                timezone="Asia/Shanghai",
                latitude=40.0,
                longitude=116.5,
                cloud_cover=1.5,
                limiting_magnitude=6.5,
                meteor_count=25,
            )

    def test_invalid_timezone(self):
        with pytest.raises(Exception):
            ObservationRecord(
                observer_name="测试者",
                observation_date="2024-08-12",
                start_time="20:00",
                end_time="22:00",
                timezone="Invalid/Timezone",
                latitude=40.0,
                longitude=116.5,
                cloud_cover=0.1,
                limiting_magnitude=6.5,
                meteor_count=25,
            )


class TestProjectConfig:
    def test_default_config(self):
        config = ProjectConfig()
        assert config.project_name == "流星雨 ZHR 复核项目"
        assert config.default_timezone == "Asia/Shanghai"
        assert config.population_index == 2.0
        assert config.confidence_level == 0.68

    def test_custom_config(self):
        config = ProjectConfig(
            project_name="英仙座流星雨",
            shower_name="英仙座流星雨",
            population_index=2.3,
            confidence_level=0.95,
        )
        assert config.project_name == "英仙座流星雨"
        assert config.population_index == 2.3
        assert config.confidence_level == 0.95

    def test_invalid_confidence(self):
        with pytest.raises(Exception):
            ProjectConfig(confidence_level=1.5)

        with pytest.raises(Exception):
            ProjectConfig(confidence_level=0.0)
