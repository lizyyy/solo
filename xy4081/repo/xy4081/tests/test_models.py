import pytest
from dmx_patch_validator.models import (
    Fixture, PatchEntry, ValidationIssue, Severity,
    FixtureMode, FixtureLibrary
)


class TestFixture:
    def test_fixture_creation(self):
        fixture = Fixture(
            id="PAR001",
            name="面光1",
            manufacturer="Martin",
            model="MAC Aura",
            mode="8通道模式",
            position="吊杆1",
            universe=1,
            start_address=1,
            custom_channel_count=8
        )
        assert fixture.id == "PAR001"
        assert fixture.universe == 1
        assert fixture.start_address == 1
        assert fixture.end_address == 8

    def test_fixture_end_address(self):
        fixture = Fixture(
            id="TEST",
            manufacturer="Test",
            model="Test",
            mode="Test",
            universe=1,
            start_address=10,
            custom_channel_count=5
        )
        assert fixture.end_address == 14

    def test_fixture_overlap(self):
        f1 = Fixture(
            id="F1", manufacturer="A", model="A", mode="A",
            universe=1, start_address=1, custom_channel_count=10
        )
        f2 = Fixture(
            id="F2", manufacturer="B", model="B", mode="B",
            universe=1, start_address=5, custom_channel_count=10
        )
        f3 = Fixture(
            id="F3", manufacturer="C", model="C", mode="C",
            universe=1, start_address=20, custom_channel_count=10
        )
        f4 = Fixture(
            id="F4", manufacturer="D", model="D", mode="D",
            universe=2, start_address=1, custom_channel_count=10
        )
        
        assert f1.overlaps_with(f2) == True
        assert f1.overlaps_with(f3) == False
        assert f1.overlaps_with(f4) == False


class TestPatchEntry:
    def test_patch_creation(self):
        patch = PatchEntry(
            id="P001",
            universe=1,
            start_address=1,
            fixture_id="PAR001",
            fixture_name="面光1",
            channel_count=8
        )
        assert patch.id == "P001"
        assert patch.universe == 1
        assert patch.start_address == 1
        assert patch.end_address == 8


class TestValidationIssue:
    def test_issue_creation(self):
        issue = ValidationIssue(
            severity=Severity.CRITICAL,
            category="地址重叠",
            message="测试重叠问题",
            affected_items=["F1", "F2"],
            suggestion="调整地址"
        )
        assert issue.severity == Severity.CRITICAL
        assert issue.category == "地址重叠"
        assert len(issue.affected_items) == 2


class TestFixtureLibrary:
    def test_library_creation(self):
        mode1 = FixtureMode(mode_name="8通道模式", channel_count=8)
        mode2 = FixtureMode(mode_name="16通道模式", channel_count=16)
        
        library = FixtureLibrary(
            manufacturer="Martin",
            model="MAC Aura",
            modes=[mode1, mode2]
        )
        
        assert library.manufacturer == "Martin"
        assert len(library.modes) == 2

    def test_library_requires_modes(self):
        with pytest.raises(Exception):
            FixtureLibrary(
                manufacturer="Martin",
                model="MAC Aura",
                modes=[]
            )
