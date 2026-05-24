import pytest
from datetime import datetime
from jenkins_snapshot.models import (
    BuildRecord,
    Parameter,
    Artifact,
    ParameterType,
    BuildStatus,
)


class TestParameter:
    def test_parameter_creation(self):
        p = Parameter(name="TEST", value="value", type="STRING")
        assert p.name == "TEST"
        assert p.value == "value"
        assert p.type == ParameterType.STRING

    def test_parameter_unknown_type(self):
        p = Parameter(name="TEST", value="value", type="INVALID_TYPE")
        assert p.type == ParameterType.UNKNOWN


class TestBuildRecord:
    def test_build_record_creation(self):
        record = BuildRecord(
            job_name="TestJob",
            build_number=123,
            status="SUCCESS",
            timestamp=1716710400000,
        )
        assert record.job_name == "TestJob"
        assert record.build_number == 123
        assert record.status == BuildStatus.SUCCESS

    def test_timestamp_from_ms(self):
        record = BuildRecord(
            job_name="Test",
            build_number=1,
            status="SUCCESS",
            timestamp=1716710400000,
        )
        assert isinstance(record.timestamp, datetime)

    def test_get_parameters_dict(self):
        record = BuildRecord(
            job_name="Test",
            build_number=1,
            status="SUCCESS",
            timestamp=1716710400000,
            parameters=[
                Parameter(name="A", value="1"),
                Parameter(name="B", value="2"),
            ]
        )
        params = record.get_parameters_dict()
        assert params == {"A": "1", "B": "2"}


class TestArtifact:
    def test_artifact_creation(self):
        a = Artifact(name="test.txt", path="/tmp/test.txt", size=100)
        assert a.name == "test.txt"
        assert a.exists is True
