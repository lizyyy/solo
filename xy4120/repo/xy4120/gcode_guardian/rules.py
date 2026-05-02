import math
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

from .config import MachineConfig
from .parser import Fixture, GCodeBlock, GCodeType, Tool, Workpiece
from .simulator import MotionSegment, MotionSimulator, Position, SimulationState


class Severity(Enum):
    CRITICAL = "critical"
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


class RuleCategory(Enum):
    TRAVEL_LIMIT = "travel_limit"
    FEED_SPEED = "feed_speed"
    SPINDLE = "spindle"
    TOOL = "tool"
    SAFETY_HEIGHT = "safety_height"
    FIXTURE_COLLISION = "fixture_collision"
    PROGRAM_FLOW = "program_flow"


@dataclass
class RuleViolation:
    severity: Severity
    category: RuleCategory
    message: str
    line_number: int = 0
    raw_code: str = ""
    position: Optional[Tuple[float, float, float]] = None
    details: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.now)


class RuleEngine:
    def __init__(
        self,
        machine_config: MachineConfig,
        tools: Optional[List[Tool]] = None,
        fixtures: Optional[List[Fixture]] = None,
        workpiece: Optional[Workpiece] = None,
    ):
        self.machine_config = machine_config
        self.tools = tools or []
        self.fixtures = fixtures or []
        self.workpiece = workpiece
        self.violations: List[RuleViolation] = []
        self._tool_number_map: Dict[int, Tool] = {t.number: t for t in self.tools}

    def reset(self):
        self.violations = []

    def get_violations(self) -> List[RuleViolation]:
        return self.violations

    def check_all(
        self,
        gcode_blocks: List[GCodeBlock],
        motion_segments: List[MotionSegment],
        sim_state: SimulationState,
    ) -> List[RuleViolation]:
        self.reset()

        self._check_travel_limits(motion_segments)
        self._check_feed_rates(gcode_blocks, motion_segments)
        self._check_spindle_speeds(gcode_blocks)
        self._check_tools(gcode_blocks, sim_state)
        self._check_safety_heights(gcode_blocks, motion_segments)
        self._check_fixture_collisions(motion_segments)
        self._check_program_flow(gcode_blocks)

        return self.violations

    def _check_travel_limits(self, motion_segments: List[MotionSegment]):
        limits = self.machine_config.limits

        for segment in motion_segments:
            for point in [segment.start, segment.end]:
                if point.x < limits.x_min or point.x > limits.x_max:
                    self.violations.append(
                        RuleViolation(
                            severity=Severity.CRITICAL,
                            category=RuleCategory.TRAVEL_LIMIT,
                            message=f"X轴行程越界: {point.x:.3f} (限制: {limits.x_min} ~ {limits.x_max})",
                            line_number=segment.line_number,
                            raw_code=segment.raw_code,
                            position=(point.x, point.y, point.z),
                            details={
                                "axis": "X",
                                "value": point.x,
                                "min_limit": limits.x_min,
                                "max_limit": limits.x_max,
                            },
                        )
                    )

                if point.y < limits.y_min or point.y > limits.y_max:
                    self.violations.append(
                        RuleViolation(
                            severity=Severity.CRITICAL,
                            category=RuleCategory.TRAVEL_LIMIT,
                            message=f"Y轴行程越界: {point.y:.3f} (限制: {limits.y_min} ~ {limits.y_max})",
                            line_number=segment.line_number,
                            raw_code=segment.raw_code,
                            position=(point.x, point.y, point.z),
                            details={
                                "axis": "Y",
                                "value": point.y,
                                "min_limit": limits.y_min,
                                "max_limit": limits.y_max,
                            },
                        )
                    )

                if point.z < limits.z_min or point.z > limits.z_max:
                    self.violations.append(
                        RuleViolation(
                            severity=Severity.CRITICAL,
                            category=RuleCategory.TRAVEL_LIMIT,
                            message=f"Z轴行程越界: {point.z:.3f} (限制: {limits.z_min} ~ {limits.z_max})",
                            line_number=segment.line_number,
                            raw_code=segment.raw_code,
                            position=(point.x, point.y, point.z),
                            details={
                                "axis": "Z",
                                "value": point.z,
                                "min_limit": limits.z_min,
                                "max_limit": limits.z_max,
                            },
                        )
                    )

    def _check_feed_rates(
        self, gcode_blocks: List[GCodeBlock], motion_segments: List[MotionSegment]
    ):
        max_feed = self.machine_config.max_feed_rate

        for segment in motion_segments:
            if segment.feed_rate is not None and segment.feed_rate > max_feed:
                self.violations.append(
                    RuleViolation(
                        severity=Severity.ERROR,
                        category=RuleCategory.FEED_SPEED,
                        message=f"进给速度超限: {segment.feed_rate} mm/min (最大允许: {max_feed})",
                        line_number=segment.line_number,
                        raw_code=segment.raw_code,
                        position=segment.end.to_tuple(),
                        details={
                            "feed_rate": segment.feed_rate,
                            "max_allowed": max_feed,
                        },
                    )
                )

        zero_feed_segments = [
            s
            for s in motion_segments
            if not s.is_rapid and (s.feed_rate is None or s.feed_rate <= 0)
        ]
        if zero_feed_segments:
            first = zero_feed_segments[0]
            self.violations.append(
                RuleViolation(
                    severity=Severity.ERROR,
                    category=RuleCategory.FEED_SPEED,
                    message=f"发现 {len(zero_feed_segments)} 段切削运动缺少有效进给速度F值",
                    line_number=first.line_number,
                    raw_code=first.raw_code,
                    details={"segment_count": len(zero_feed_segments)},
                )
            )

    def _check_spindle_speeds(self, gcode_blocks: List[GCodeBlock]):
        max_speed = self.machine_config.max_spindle_speed

        for block in gcode_blocks:
            if block.s is not None:
                if block.s > max_speed:
                    self.violations.append(
                        RuleViolation(
                            severity=Severity.ERROR,
                            category=RuleCategory.SPINDLE,
                            message=f"主轴转速超限: {block.s} RPM (最大允许: {max_speed})",
                            line_number=block.line_number,
                            raw_code=block.raw_line,
                            details={
                                "spindle_speed": block.s,
                                "max_allowed": max_speed,
                            },
                        )
                    )
                elif block.s <= 0:
                    self.violations.append(
                        RuleViolation(
                            severity=Severity.WARNING,
                            category=RuleCategory.SPINDLE,
                            message=f"主轴转速异常: {block.s} RPM",
                            line_number=block.line_number,
                            raw_code=block.raw_line,
                            details={"spindle_speed": block.s},
                        )
                    )

        current_tool: Optional[int] = None
        spindle_on = False
        spindle_speed: Optional[float] = None

        for block in gcode_blocks:
            if block.gcode_type == GCodeType.TOOL_CHANGE:
                if block.t is not None:
                    current_tool = block.t
                spindle_on = False
                continue

            if block.gcode_type == GCodeType.SPINDLE_ON:
                spindle_on = True
                if block.s is not None:
                    spindle_speed = block.s
                continue

            if block.gcode_type == GCodeType.SPINDLE_OFF:
                spindle_on = False
                continue

            if block.is_motion and not block.is_rapid:
                if not spindle_on:
                    self.violations.append(
                        RuleViolation(
                            severity=Severity.ERROR,
                            category=RuleCategory.SPINDLE,
                            message="切削运动时主轴未启动",
                            line_number=block.line_number,
                            raw_code=block.raw_line,
                            details={
                                "has_spindle_speed": spindle_speed is not None,
                                "spindle_speed": spindle_speed,
                            },
                        )
                    )
                elif spindle_speed is None or spindle_speed <= 0:
                    self.violations.append(
                        RuleViolation(
                            severity=Severity.WARNING,
                            category=RuleCategory.SPINDLE,
                            message="切削运动时主轴转速未设置或为零",
                            line_number=block.line_number,
                            raw_code=block.raw_line,
                        )
                    )

    def _check_tools(self, gcode_blocks: List[GCodeBlock], sim_state: SimulationState):
        used_tool_numbers: List[int] = []
        tool_select_blocks: List[GCodeBlock] = []

        for block in gcode_blocks:
            if block.t is not None:
                used_tool_numbers.append(block.t)
                if block.gcode_type == GCodeType.TOOL_CHANGE or "T" in block.raw_line.upper():
                    tool_select_blocks.append(block)

        if not self._tool_number_map:
            if used_tool_numbers:
                self.violations.append(
                    RuleViolation(
                        severity=Severity.WARNING,
                        category=RuleCategory.TOOL,
                        message=f"未导入刀具表，但程序使用了 {len(set(used_tool_numbers))} 把刀具",
                        details={"tools_used": sorted(set(used_tool_numbers))},
                    )
                )
            return

        missing_tools = set()
        for tool_num in used_tool_numbers:
            if tool_num not in self._tool_number_map:
                missing_tools.add(tool_num)

        if missing_tools:
            for block in tool_select_blocks:
                if block.t is not None and block.t in missing_tools:
                    self.violations.append(
                        RuleViolation(
                            severity=Severity.ERROR,
                            category=RuleCategory.TOOL,
                            message=f"刀具不存在: T{block.t} (未在刀具表中定义)",
                            line_number=block.line_number,
                            raw_code=block.raw_line,
                            details={"missing_tool": block.t},
                        )
                    )

        for tool_num in sorted(set(used_tool_numbers)):
            if tool_num in self._tool_number_map:
                tool = self._tool_number_map[tool_num]
                if tool.length <= 0:
                    self.violations.append(
                        RuleViolation(
                            severity=Severity.WARNING,
                            category=RuleCategory.TOOL,
                            message=f"刀具 T{tool_num} 长度未设置或为零",
                            details={"tool_number": tool_num, "tool_length": tool.length},
                        )
                    )
                if tool.diameter <= 0:
                    self.violations.append(
                        RuleViolation(
                            severity=Severity.WARNING,
                            category=RuleCategory.TOOL,
                            message=f"刀具 T{tool_num} 直径未设置或为零",
                            details={"tool_number": tool_num, "tool_diameter": tool.diameter},
                        )
                    )

    def _check_safety_heights(
        self, gcode_blocks: List[GCodeBlock], motion_segments: List[MotionSegment]
    ):
        safe_height = self.machine_config.safe_height
        tool_change_height = self.machine_config.tool_change_height

        z_positions: List[Tuple[float, int, str]] = []

        for segment in motion_segments:
            z_positions.append((segment.start.z, segment.line_number, segment.raw_code))
            z_positions.append((segment.end.z, segment.line_number, segment.raw_code))

        min_z = min(p[0] for p in z_positions) if z_positions else 0

        rapid_below_safe: List[Tuple[float, int, str]] = []
        for segment in motion_segments:
            if segment.is_rapid:
                if segment.start.z < safe_height or segment.end.z < safe_height:
                    if segment.start.z < min_z + 5:
                        pass
                    else:
                        rapid_below_safe.append(
                            (min(segment.start.z, segment.end.z), segment.line_number, segment.raw_code)
                        )

        if rapid_below_safe:
            first = rapid_below_safe[0]
            self.violations.append(
                RuleViolation(
                    severity=Severity.WARNING,
                    category=RuleCategory.SAFETY_HEIGHT,
                    message=f"发现 {len(rapid_below_safe)} 段快速移动低于安全高度 ({safe_height}mm)",
                    line_number=first[1],
                    raw_code=first[2],
                    details={
                        "safe_height": safe_height,
                        "lowest_z": first[0],
                        "count": len(rapid_below_safe),
                    },
                )
            )

        for block in gcode_blocks:
            if block.gcode_type == GCodeType.TOOL_CHANGE:
                for segment in motion_segments:
                    if segment.line_number >= block.line_number - 3 and segment.line_number <= block.line_number:
                        if segment.end.z < tool_change_height:
                            self.violations.append(
                                RuleViolation(
                                    severity=Severity.CRITICAL,
                                    category=RuleCategory.SAFETY_HEIGHT,
                                    message=f"换刀前Z轴未达到换刀高度 ({tool_change_height}mm)",
                                    line_number=block.line_number,
                                    raw_code=block.raw_line,
                                    position=segment.end.to_tuple(),
                                    details={
                                        "tool_change_height": tool_change_height,
                                        "actual_z": segment.end.z,
                                    },
                                )
                            )
                        break

    def _check_fixture_collisions(self, motion_segments: List[MotionSegment]):
        if not self.fixtures:
            return

        for fixture in self.fixtures:
            if (
                fixture.min_x is None
                or fixture.max_x is None
                or fixture.min_y is None
                or fixture.max_y is None
                or fixture.min_z is None
                or fixture.max_z is None
            ):
                continue

            for segment in motion_segments:
                if not segment.is_rapid:
                    continue

                if self._segment_intersects_aabb(
                    segment.start,
                    segment.end,
                    (fixture.min_x, fixture.min_y, fixture.min_z),
                    (fixture.max_x, fixture.max_y, fixture.max_z),
                ):
                    self.violations.append(
                        RuleViolation(
                            severity=Severity.CRITICAL,
                            category=RuleCategory.FIXTURE_COLLISION,
                            message=f"快速移动可能与夹具 '{fixture.name}' 碰撞",
                            line_number=segment.line_number,
                            raw_code=segment.raw_code,
                            position=segment.end.to_tuple(),
                            details={
                                "fixture_name": fixture.name,
                                "fixture_bounds": {
                                    "min": (fixture.min_x, fixture.min_y, fixture.min_z),
                                    "max": (fixture.max_x, fixture.max_y, fixture.max_z),
                                },
                                "segment_start": segment.start.to_tuple(),
                                "segment_end": segment.end.to_tuple(),
                            },
                        )
                    )

    def _segment_intersects_aabb(
        self,
        start: Position,
        end: Position,
        aabb_min: Tuple[float, float, float],
        aabb_max: Tuple[float, float, float],
    ) -> bool:
        EPS = 1e-10

        dir_x = end.x - start.x
        dir_y = end.y - start.y
        dir_z = end.z - start.z

        t_min = 0.0
        t_max = 1.0

        if abs(dir_x) > EPS:
            t1 = (aabb_min[0] - start.x) / dir_x
            t2 = (aabb_max[0] - start.x) / dir_x
            if t1 > t2:
                t1, t2 = t2, t1
            t_min = max(t_min, t1)
            t_max = min(t_max, t2)
        else:
            if start.x < aabb_min[0] - EPS or start.x > aabb_max[0] + EPS:
                return False

        if abs(dir_y) > EPS:
            t1 = (aabb_min[1] - start.y) / dir_y
            t2 = (aabb_max[1] - start.y) / dir_y
            if t1 > t2:
                t1, t2 = t2, t1
            t_min = max(t_min, t1)
            t_max = min(t_max, t2)
        else:
            if start.y < aabb_min[1] - EPS or start.y > aabb_max[1] + EPS:
                return False

        if abs(dir_z) > EPS:
            t1 = (aabb_min[2] - start.z) / dir_z
            t2 = (aabb_max[2] - start.z) / dir_z
            if t1 > t2:
                t1, t2 = t2, t1
            t_min = max(t_min, t1)
            t_max = min(t_max, t2)
        else:
            if start.z < aabb_min[2] - EPS or start.z > aabb_max[2] + EPS:
                return False

        return t_min <= t_max + EPS and t_max >= -EPS

    def _check_program_flow(self, gcode_blocks: List[GCodeBlock]):
        has_tool_change: bool = False
        has_spindle_on: bool = False
        has_coolant_on: bool = False
        has_program_end: bool = False

        for block in gcode_blocks:
            if block.gcode_type == GCodeType.TOOL_CHANGE:
                has_tool_change = True
            if block.gcode_type == GCodeType.SPINDLE_ON:
                has_spindle_on = True
            if block.gcode_type == GCodeType.COOLANT_ON:
                has_coolant_on = True
            if block.gcode_type == GCodeType.PROGRAM_END:
                has_program_end = True

        if not has_program_end:
            self.violations.append(
                RuleViolation(
                    severity=Severity.WARNING,
                    category=RuleCategory.PROGRAM_FLOW,
                    message="程序未包含M30或M02结束指令",
                )
            )

        if has_coolant_on:
            has_coolant_off = any(
                block.gcode_type == GCodeType.COOLANT_OFF for block in gcode_blocks
            )
            if not has_coolant_off:
                self.violations.append(
                    RuleViolation(
                        severity=Severity.INFO,
                        category=RuleCategory.PROGRAM_FLOW,
                        message="程序开启了冷却但未关闭(M9)",
                    )
                )

        if has_spindle_on:
            has_spindle_off = any(
                block.gcode_type == GCodeType.SPINDLE_OFF for block in gcode_blocks
            )
            if not has_spindle_off:
                self.violations.append(
                    RuleViolation(
                        severity=Severity.INFO,
                        category=RuleCategory.PROGRAM_FLOW,
                        message="程序开启了主轴但未关闭(M5)",
                    )
                )


class ViolationSummary:
    def __init__(self, violations: List[RuleViolation]):
        self.violations = violations
        self.critical_count = sum(1 for v in violations if v.severity == Severity.CRITICAL)
        self.error_count = sum(1 for v in violations if v.severity == Severity.ERROR)
        self.warning_count = sum(1 for v in violations if v.severity == Severity.WARNING)
        self.info_count = sum(1 for v in violations if v.severity == Severity.INFO)

        self.by_category: Dict[RuleCategory, List[RuleViolation]] = {}
        for v in violations:
            if v.category not in self.by_category:
                self.by_category[v.category] = []
            self.by_category[v.category].append(v)

    @property
    def has_blocking_issues(self) -> bool:
        return self.critical_count > 0 or self.error_count > 0

    @property
    def total_count(self) -> int:
        return len(self.violations)
