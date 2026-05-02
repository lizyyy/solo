import pytest
from dmx_patch_validator.models import Fixture, PatchEntry, Severity
from dmx_patch_validator.validator import Validator


class TestValidator:
    def setup_method(self):
        self.validator = Validator()

    def test_check_overlaps(self):
        fixtures = [
            Fixture(
                id="F1", manufacturer="A", model="A", mode="A",
                universe=1, start_address=1, custom_channel_count=10
            ),
            Fixture(
                id="F2", manufacturer="B", model="B", mode="B",
                universe=1, start_address=5, custom_channel_count=10
            ),
            Fixture(
                id="F3", manufacturer="C", model="C", mode="C",
                universe=1, start_address=20, custom_channel_count=10
            ),
        ]
        
        issues = self.validator.check_fixture_overlaps(fixtures)
        assert len(issues) == 1
        assert issues[0].severity == Severity.CRITICAL
        assert "F1" in issues[0].affected_items
        assert "F2" in issues[0].affected_items

    def test_check_address_boundaries(self):
        fixtures = [
            Fixture(
                id="F1", manufacturer="A", model="A", mode="A",
                universe=1, start_address=0, custom_channel_count=10
            ),
            Fixture(
                id="F2", manufacturer="B", model="B", mode="B",
                universe=1, start_address=510, custom_channel_count=10
            ),
        ]
        
        issues = self.validator.check_address_boundaries(fixtures, [])
        assert len(issues) == 2
        
        start_issue = [i for i in issues if "起始地址" in i.message][0]
        end_issue = [i for i in issues if "结束地址" in i.message][0]
        
        assert start_issue.severity == Severity.CRITICAL
        assert end_issue.severity == Severity.CRITICAL

    def test_check_universe_capacity(self):
        fixtures = []
        for i in range(60):
            fixtures.append(Fixture(
                id=f"F{i}", manufacturer="A", model="A", mode="A",
                universe=1, start_address=i * 10 + 1, custom_channel_count=10
            ))
        
        issues = self.validator.check_universe_capacity(fixtures, [], max_universe=1)
        
        capacity_issues = [i for i in issues if i.category in ["容量超限", "容量预警"]]
        assert len(capacity_issues) >= 1

    def test_validate_no_issues(self):
        fixtures = [
            Fixture(
                id="F1", manufacturer="A", model="A", mode="A",
                universe=1, start_address=1, custom_channel_count=10
            ),
            Fixture(
                id="F2", manufacturer="B", model="B", mode="B",
                universe=1, start_address=20, custom_channel_count=10
            ),
        ]
        
        result = self.validator.validate(fixtures, [], max_universe=1)
        assert result.total_issues == 0
        assert result.critical_count == 0

    def test_cross_reference_mismatch(self):
        fixtures = [
            Fixture(
                id="F1", manufacturer="A", model="A", mode="A",
                universe=1, start_address=1, custom_channel_count=10,
                position="吊杆1"
            ),
        ]
        
        patch_entries = [
            PatchEntry(
                id="P1", universe=1, start_address=5,
                fixture_id="F1", channel_count=10, position="吊杆2"
            ),
        ]
        
        issues = self.validator.check_cross_reference(fixtures, patch_entries)
        
        address_issue = [i for i in issues if "地址不一致" in i.message]
        position_issue = [i for i in issues if "位置不一致" in i.message]
        
        assert len(address_issue) == 1
        assert len(position_issue) == 1
