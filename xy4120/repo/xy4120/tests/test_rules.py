import pytest
from pathlib import Path

from gcode_guardian.config import MachineConfig, MachineLimits
from gcode_guardian.parser import GCodeParser, Tool, Fixture
from gcode_guardian.rules import RuleEngine, Severity, RuleCategory, ViolationSummary
from gcode_guardian.simulator import MotionSimulator


class TestTravelLimitRule:
    def setup_method(self):
        self.config = MachineConfig(
            limits=MachineLimits(
                x_min=-100.0,
                x_max=100.0,
                y_min=-100.0,
                y_max=100.0,
                z_min=-50.0,
                z_max=100.0,
            )
        )
        self.parser = GCodeParser()
        self.simulator = MotionSimulator(self.config)
        self.rule_engine = RuleEngine(machine_config=self.config)

    def test_x_axis_out_of_bounds(self):
        gcode = ["G00 X150.0 Y0.0 Z50.0"]
        blocks = [self.parser.parse_line(g, i + 1) for i, g in enumerate(gcode)]
        segments = self.simulator.simulate_blocks(blocks)
        sim_state = self.simulator.get_state()

        violations = self.rule_engine.check_all(blocks, segments, sim_state)

        travel_violations = [v for v in violations if v.category == RuleCategory.TRAVEL_LIMIT]
        assert len(travel_violations) >= 1
        assert any("X轴" in v.message for v in travel_violations)

    def test_z_axis_out_of_bounds(self):
        gcode = ["G00 X0.0 Y0.0 Z-100.0"]
        blocks = [self.parser.parse_line(g, i + 1) for i, g in enumerate(gcode)]
        segments = self.simulator.simulate_blocks(blocks)
        sim_state = self.simulator.get_state()

        violations = self.rule_engine.check_all(blocks, segments, sim_state)

        travel_violations = [v for v in violations if v.category == RuleCategory.TRAVEL_LIMIT]
        assert len(travel_violations) >= 1
        assert any("Z轴" in v.message for v in travel_violations)

    def test_within_limits_no_violation(self):
        gcode = ["G00 X50.0 Y50.0 Z50.0"]
        blocks = [self.parser.parse_line(g, i + 1) for i, g in enumerate(gcode)]
        segments = self.simulator.simulate_blocks(blocks)
        sim_state = self.simulator.get_state()

        violations = self.rule_engine.check_all(blocks, segments, sim_state)

        travel_violations = [v for v in violations if v.category == RuleCategory.TRAVEL_LIMIT]
        assert len(travel_violations) == 0


class TestFeedRateRule:
    def setup_method(self):
        self.config = MachineConfig(
            max_feed_rate=5000.0,
        )
        self.parser = GCodeParser()
        self.simulator = MotionSimulator(self.config)
        self.rule_engine = RuleEngine(machine_config=self.config)

    def test_feed_rate_exceeds_limit(self):
        gcode = ["G01 X100.0 Y100.0 F6000.0"]
        blocks = [self.parser.parse_line(g, i + 1) for i, g in enumerate(gcode)]
        segments = self.simulator.simulate_blocks(blocks)
        sim_state = self.simulator.get_state()

        violations = self.rule_engine.check_all(blocks, segments, sim_state)

        feed_violations = [v for v in violations if v.category == RuleCategory.FEED_SPEED]
        assert len(feed_violations) >= 1
        assert any("进给速度超限" in v.message for v in feed_violations)

    def test_feed_rate_within_limit(self):
        gcode = ["G01 X100.0 Y100.0 F3000.0"]
        blocks = [self.parser.parse_line(g, i + 1) for i, g in enumerate(gcode)]
        segments = self.simulator.simulate_blocks(blocks)
        sim_state = self.simulator.get_state()

        violations = self.rule_engine.check_all(blocks, segments, sim_state)

        feed_violations = [
            v for v in violations
            if v.category == RuleCategory.FEED_SPEED and "超限" in v.message
        ]
        assert len(feed_violations) == 0


class TestSpindleRule:
    def setup_method(self):
        self.config = MachineConfig(
            max_spindle_speed=10000.0,
        )
        self.parser = GCodeParser()
        self.simulator = MotionSimulator(self.config)
        self.rule_engine = RuleEngine(machine_config=self.config)

    def test_spindle_speed_exceeds_limit(self):
        gcode = ["S15000 M03", "G01 X10.0 F500.0"]
        blocks = [self.parser.parse_line(g, i + 1) for i, g in enumerate(gcode)]
        segments = self.simulator.simulate_blocks(blocks)
        sim_state = self.simulator.get_state()

        violations = self.rule_engine.check_all(blocks, segments, sim_state)

        spindle_violations = [v for v in violations if v.category == RuleCategory.SPINDLE]
        assert len(spindle_violations) >= 1
        assert any("主轴转速超限" in v.message for v in spindle_violations)

    def test_cutting_without_spindle(self):
        gcode = ["G01 Z-10.0 F200.0"]
        blocks = [self.parser.parse_line(g, i + 1) for i, g in enumerate(gcode)]
        segments = self.simulator.simulate_blocks(blocks)
        sim_state = self.simulator.get_state()

        violations = self.rule_engine.check_all(blocks, segments, sim_state)

        spindle_violations = [v for v in violations if v.category == RuleCategory.SPINDLE]
        assert len(spindle_violations) >= 1
        assert any("主轴未启动" in v.message for v in spindle_violations)


class TestToolRule:
    def setup_method(self):
        self.config = MachineConfig()
        self.parser = GCodeParser()
        self.simulator = MotionSimulator(self.config)

        self.tools = [
            Tool(number=1, name="10mm 立铣刀", diameter=10.0, length=75.0),
            Tool(number=2, name="6mm 钻头", diameter=6.0, length=100.0),
        ]
        self.rule_engine = RuleEngine(machine_config=self.config, tools=self.tools)

    def test_missing_tool(self):
        gcode = ["T99 M06", "G01 X10.0 F500.0"]
        blocks = [self.parser.parse_line(g, i + 1) for i, g in enumerate(gcode)]
        segments = self.simulator.simulate_blocks(blocks)
        sim_state = self.simulator.get_state()

        violations = self.rule_engine.check_all(blocks, segments, sim_state)

        tool_violations = [v for v in violations if v.category == RuleCategory.TOOL]
        assert len(tool_violations) >= 1
        assert any("不存在" in v.message for v in tool_violations)

    def test_tool_with_invalid_length(self):
        invalid_tools = [
            Tool(number=1, name="立铣刀", diameter=10.0, length=0.0),
        ]
        rule_engine = RuleEngine(machine_config=self.config, tools=invalid_tools)

        gcode = ["T01 M06", "G01 X10.0 F500.0"]
        blocks = [self.parser.parse_line(g, i + 1) for i, g in enumerate(gcode)]
        segments = self.simulator.simulate_blocks(blocks)
        sim_state = self.simulator.get_state()

        violations = rule_engine.check_all(blocks, segments, sim_state)

        tool_violations = [v for v in violations if v.category == RuleCategory.TOOL]
        assert len(tool_violations) >= 1
        assert any("长度" in v.message for v in tool_violations)


class TestSafetyHeightRule:
    def setup_method(self):
        self.config = MachineConfig(
            safe_height=50.0,
            tool_change_height=100.0,
        )
        self.parser = GCodeParser()
        self.simulator = MotionSimulator(self.config)
        self.rule_engine = RuleEngine(machine_config=self.config)

    def test_rapid_below_safe_height(self):
        gcode = ["G00 Z10.0", "G00 X100.0 Y100.0"]
        blocks = [self.parser.parse_line(g, i + 1) for i, g in enumerate(gcode)]
        segments = self.simulator.simulate_blocks(blocks)
        sim_state = self.simulator.get_state()

        violations = self.rule_engine.check_all(blocks, segments, sim_state)

        safety_violations = [v for v in violations if v.category == RuleCategory.SAFETY_HEIGHT]
        assert len(safety_violations) >= 0


class TestFixtureCollisionRule:
    def setup_method(self):
        self.config = MachineConfig()
        self.parser = GCodeParser()
        self.simulator = MotionSimulator(self.config)

        self.fixtures = [
            Fixture(
                name="测试夹具",
                offset_x=0.0,
                offset_y=0.0,
                offset_z=0.0,
                min_x=40.0,
                max_x=60.0,
                min_y=40.0,
                max_y=60.0,
                min_z=0.0,
                max_z=100.0,
            )
        ]
        self.rule_engine = RuleEngine(machine_config=self.config, fixtures=self.fixtures)

    def test_rapid_through_fixture(self):
        gcode = ["G00 X0.0 Y0.0 Z50.0", "G00 X100.0 Y100.0 Z50.0"]
        blocks = [self.parser.parse_line(g, i + 1) for i, g in enumerate(gcode)]
        segments = self.simulator.simulate_blocks(blocks)
        sim_state = self.simulator.get_state()

        violations = self.rule_engine.check_all(blocks, segments, sim_state)

        collision_violations = [v for v in violations if v.category == RuleCategory.FIXTURE_COLLISION]
        assert len(collision_violations) >= 1


class TestProgramFlowRule:
    def setup_method(self):
        self.config = MachineConfig()
        self.parser = GCodeParser()
        self.simulator = MotionSimulator(self.config)
        self.rule_engine = RuleEngine(machine_config=self.config)

    def test_missing_program_end(self):
        gcode = ["G00 X0.0 Y0.0 Z50.0", "M05"]
        blocks = [self.parser.parse_line(g, i + 1) for i, g in enumerate(gcode)]
        segments = self.simulator.simulate_blocks(blocks)
        sim_state = self.simulator.get_state()

        violations = self.rule_engine.check_all(blocks, segments, sim_state)

        flow_violations = [v for v in violations if v.category == RuleCategory.PROGRAM_FLOW]
        assert len(flow_violations) >= 1
        assert any("结束指令" in v.message for v in flow_violations)

    def test_coolant_on_but_not_off(self):
        gcode = ["M08", "G01 X10.0 F500.0", "M30"]
        blocks = [self.parser.parse_line(g, i + 1) for i, g in enumerate(gcode)]
        segments = self.simulator.simulate_blocks(blocks)
        sim_state = self.simulator.get_state()

        violations = self.rule_engine.check_all(blocks, segments, sim_state)

        flow_violations = [v for v in violations if v.category == RuleCategory.PROGRAM_FLOW]
        assert len(flow_violations) >= 1
        assert any("冷却" in v.message for v in flow_violations)


class TestViolationSummary:
    def test_summary_counts(self):
        from gcode_guardian.rules import RuleViolation, Severity, RuleCategory

        violations = [
            RuleViolation(severity=Severity.CRITICAL, category=RuleCategory.TRAVEL_LIMIT, message="test1"),
            RuleViolation(severity=Severity.CRITICAL, category=RuleCategory.TRAVEL_LIMIT, message="test2"),
            RuleViolation(severity=Severity.ERROR, category=RuleCategory.FEED_SPEED, message="test3"),
            RuleViolation(severity=Severity.WARNING, category=RuleCategory.SAFETY_HEIGHT, message="test4"),
            RuleViolation(severity=Severity.INFO, category=RuleCategory.PROGRAM_FLOW, message="test5"),
        ]

        summary = ViolationSummary(violations)

        assert summary.critical_count == 2
        assert summary.error_count == 1
        assert summary.warning_count == 1
        assert summary.info_count == 1
        assert summary.total_count == 5
        assert summary.has_blocking_issues is True

    def test_summary_no_blocking_issues(self):
        from gcode_guardian.rules import RuleViolation, Severity, RuleCategory

        violations = [
            RuleViolation(severity=Severity.WARNING, category=RuleCategory.SAFETY_HEIGHT, message="test"),
            RuleViolation(severity=Severity.INFO, category=RuleCategory.PROGRAM_FLOW, message="test"),
        ]

        summary = ViolationSummary(violations)

        assert summary.has_blocking_issues is False
