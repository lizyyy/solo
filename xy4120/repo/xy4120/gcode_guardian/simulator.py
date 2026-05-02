import math
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, Iterator, List, Optional, Tuple

from .parser import Fixture, GCodeBlock, GCodeType, Tool, Workpiece
from .config import MachineConfig


class MotionType(Enum):
    RAPID = "rapid"
    LINEAR = "linear"
    ARC_CW = "arc_cw"
    ARC_CCW = "arc_ccw"


@dataclass
class Position:
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0

    def to_tuple(self) -> Tuple[float, float, float]:
        return (self.x, self.y, self.z)

    def distance_to(self, other: "Position") -> float:
        return math.sqrt(
            (self.x - other.x) ** 2 + (self.y - other.y) ** 2 + (self.z - other.z) ** 2
        )


@dataclass
class MotionSegment:
    start: Position
    end: Position
    motion_type: MotionType
    feed_rate: Optional[float] = None
    is_rapid: bool = False
    line_number: int = 0
    raw_code: str = ""
    center: Optional[Tuple[float, float, float]] = None
    radius: Optional[float] = None


@dataclass
class SimulationState:
    position: Position = field(default_factory=Position)
    previous_position: Position = field(default_factory=Position)
    current_tool: Optional[int] = None
    feed_rate: Optional[float] = None
    spindle_speed: Optional[float] = None
    spindle_on: bool = False
    coolant_on: bool = False
    in_rapid_mode: bool = False
    program_ended: bool = False
    line_number: int = 0
    motion_count: int = 0
    tool_changes: List[int] = field(default_factory=list)
    max_extent_min: Position = field(default_factory=lambda: Position(float("inf"), float("inf"), float("inf")))
    max_extent_max: Position = field(default_factory=lambda: Position(float("-inf"), float("-inf"), float("-inf")))

    def update_extents(self, pos: Position):
        self.max_extent_min.x = min(self.max_extent_min.x, pos.x)
        self.max_extent_min.y = min(self.max_extent_min.y, pos.y)
        self.max_extent_min.z = min(self.max_extent_min.z, pos.z)
        self.max_extent_max.x = max(self.max_extent_max.x, pos.x)
        self.max_extent_max.y = max(self.max_extent_max.y, pos.y)
        self.max_extent_max.z = max(self.max_extent_max.z, pos.z)


class MotionSimulator:
    def __init__(self, machine_config: MachineConfig):
        self.machine_config = machine_config
        self.state = SimulationState()
        self.motion_segments: List[MotionSegment] = []
        self._reset_position()

    def _reset_position(self):
        safe_h = self.machine_config.safe_height
        self.state = SimulationState(
            position=Position(0.0, 0.0, safe_h),
            previous_position=Position(0.0, 0.0, safe_h),
        )
        self.motion_segments = []

    def reset(self):
        self._reset_position()

    def simulate_block(self, block: GCodeBlock) -> List[MotionSegment]:
        segments: List[MotionSegment] = []
        self.state.line_number = block.line_number

        if block.gcode_type == GCodeType.TOOL_CHANGE:
            if block.t is not None:
                self.state.current_tool = block.t
                self.state.tool_changes.append(block.t)
            return segments

        if block.gcode_type == GCodeType.SPINDLE_ON:
            self.state.spindle_on = True
            if block.s is not None:
                self.state.spindle_speed = block.s
            return segments

        if block.gcode_type == GCodeType.SPINDLE_OFF:
            self.state.spindle_on = False
            return segments

        if block.gcode_type == GCodeType.COOLANT_ON:
            self.state.coolant_on = True
            return segments

        if block.gcode_type == GCodeType.COOLANT_OFF:
            self.state.coolant_on = False
            return segments

        if block.gcode_type == GCodeType.PROGRAM_END:
            self.state.program_ended = True
            return segments

        if block.is_motion:
            if block.f is not None:
                self.state.feed_rate = block.f
            if block.s is not None:
                self.state.spindle_speed = block.s

            start_pos = Position(
                x=self.state.position.x,
                y=self.state.position.y,
                z=self.state.position.z,
            )

            end_pos = Position(
                x=block.x if block.x is not None else self.state.position.x,
                y=block.y if block.y is not None else self.state.position.y,
                z=block.z if block.z is not None else self.state.position.z,
            )

            is_rapid = block.gcode_type == GCodeType.RAPID
            motion_type = MotionType.RAPID if is_rapid else MotionType.LINEAR

            if block.gcode_type in [GCodeType.ARC_CW, GCodeType.ARC_CCW]:
                motion_type = (
                    MotionType.ARC_CW if block.gcode_type == GCodeType.ARC_CW else MotionType.ARC_CCW
                )
                arc_segments = self._create_arc_segments(
                    start_pos, end_pos, block, motion_type, is_rapid
                )
                segments.extend(arc_segments)
            else:
                segment = MotionSegment(
                    start=start_pos,
                    end=end_pos,
                    motion_type=motion_type,
                    feed_rate=self.state.feed_rate if not is_rapid else None,
                    is_rapid=is_rapid,
                    line_number=block.line_number,
                    raw_code=block.raw_line,
                )
                segments.append(segment)

            self.state.previous_position = Position(
                x=self.state.position.x,
                y=self.state.position.y,
                z=self.state.position.z,
            )
            self.state.position = end_pos
            self.state.update_extents(end_pos)
            self.state.motion_count += len(segments)

            for seg in segments:
                self.motion_segments.append(seg)

        return segments

    def _create_arc_segments(
        self,
        start: Position,
        end: Position,
        block: GCodeBlock,
        motion_type: MotionType,
        is_rapid: bool,
    ) -> List[MotionSegment]:
        segments: List[MotionSegment] = []

        center_x: float = start.x
        center_y: float = start.y
        center_z: float = start.z

        if block.i is not None:
            center_x = start.x + block.i
        if block.j is not None:
            center_y = start.y + block.j
        if block.k is not None:
            center_z = start.z + block.k

        radius: Optional[float] = None
        if block.r is not None:
            radius = block.r
            dx = end.x - start.x
            dy = end.y - start.y
            dz = end.z - start.z
            chord_len = math.sqrt(dx * dx + dy * dy + dz * dz)

            if abs(radius) < chord_len / 2:
                radius = chord_len / 2

            h = math.sqrt(radius**2 - (chord_len / 2) ** 2)
            if radius < 0:
                h = -h

            mid_x = (start.x + end.x) / 2
            mid_y = (start.y + end.y) / 2
            mid_z = (start.z + end.z) / 2

            if abs(dz) < 1e-10:
                perp_x = -dy
                perp_y = dx
                perp_len = math.sqrt(perp_x**2 + perp_y**2)
                if perp_len > 1e-10:
                    perp_x /= perp_len
                    perp_y /= perp_len
                    if motion_type == MotionType.ARC_CW:
                        perp_x = -perp_x
                        perp_y = -perp_y
                    center_x = mid_x + perp_x * h
                    center_y = mid_y + perp_y * h

        else:
            radius = math.sqrt(
                (start.x - center_x) ** 2 + (start.y - center_y) ** 2 + (start.z - center_z) ** 2
            )

        num_steps = max(8, int(radius * 0.5)) if radius else 8
        if num_steps > 100:
            num_steps = 100

        start_angle = math.atan2(start.y - center_y, start.x - center_x)
        end_angle = math.atan2(end.y - center_y, end.x - center_x)

        delta_z = end.z - start.z

        if motion_type == MotionType.ARC_CW:
            if end_angle >= start_angle:
                end_angle -= 2 * math.pi
        else:
            if end_angle <= start_angle:
                end_angle += 2 * math.pi

        angle_step = (end_angle - start_angle) / num_steps
        z_step = delta_z / num_steps

        current_pos = Position(x=start.x, y=start.y, z=start.z)

        for i in range(1, num_steps + 1):
            angle = start_angle + angle_step * i
            next_x = center_x + radius * math.cos(angle)
            next_y = center_y + radius * math.sin(angle)
            next_z = start.z + z_step * i

            next_pos = Position(x=next_x, y=next_y, z=next_z)

            segment = MotionSegment(
                start=Position(x=current_pos.x, y=current_pos.y, z=current_pos.z),
                end=next_pos,
                motion_type=motion_type,
                feed_rate=self.state.feed_rate if not is_rapid else None,
                is_rapid=is_rapid,
                line_number=block.line_number,
                raw_code=block.raw_line,
                center=(center_x, center_y, center_z),
                radius=radius,
            )
            segments.append(segment)

            current_pos = next_pos

        return segments

    def simulate_blocks(self, blocks: List[GCodeBlock]) -> List[MotionSegment]:
        self.reset()
        all_segments: List[MotionSegment] = []

        for block in blocks:
            segments = self.simulate_block(block)
            all_segments.extend(segments)

        return all_segments

    def get_state(self) -> SimulationState:
        return self.state
