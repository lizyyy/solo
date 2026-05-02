import pytest
from dmx_patch_validator.models import Fixture, PatchEntry
from dmx_patch_validator.planner import AddressPlanner


class TestAddressPlanner:
    def setup_method(self):
        self.planner = AddressPlanner()

    def test_find_gaps(self):
        used = {1, 2, 3, 7, 8, 9}
        
        gaps = self.planner._find_gaps(used, 1, 10)
        
        assert len(gaps) == 2
        assert (4, 6) in gaps
        assert (10, 10) in gaps

    def test_plan_rearrangement_with_conflicts(self):
        fixtures = [
            Fixture(
                id="F1", manufacturer="A", model="A", mode="A",
                universe=1, start_address=1, custom_channel_count=10,
                position="吊杆1"
            ),
            Fixture(
                id="F2", manufacturer="B", model="B", mode="B",
                universe=1, start_address=5, custom_channel_count=10,
                position="吊杆1"
            ),
            Fixture(
                id="F3", manufacturer="C", model="C", mode="C",
                universe=1, start_address=30, custom_channel_count=10,
                position="吊杆2"
            ),
        ]
        
        result = self.planner.plan_rearrangement(fixtures, [], max_universe=1)
        
        assert "冲突" in result.summary
        assert len(result.actions) > 0

    def test_plan_optimize_layout(self):
        fixtures = [
            Fixture(
                id="F1", manufacturer="A", model="A", mode="A",
                universe=1, start_address=100, custom_channel_count=10,
                position="吊杆1"
            ),
            Fixture(
                id="F2", manufacturer="B", model="B", mode="B",
                universe=1, start_address=200, custom_channel_count=10,
                position="吊杆2"
            ),
        ]
        
        result = self.planner.plan_optimize_layout(fixtures, [], max_universe=1, group_by_position=True)
        
        assert len(result.actions) > 0
        assert "优化" in result.summary.lower() or "布局" in result.summary

    def test_plan_no_conflicts(self):
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
        
        result = self.planner.plan_rearrangement(fixtures, [], max_universe=1)
        
        assert "未检测到" in result.summary
        assert len(result.actions) == 0
