"""
段落识别与线索关联模块
====================

核心功能：
1. 基于速度曲线、划水频率、转身点自动划分游泳段落（单趟）
2. 将划水频率、速度曲线、泳姿等线索归并到同一段落
3. 实现段落间的横向对比
4. 保持从摘要到明细的完整链接，确保断链可追溯

关键设计：
- 每个段落都有唯一ID
- 每个段落关联其原始数据索引范围
- 线索（划水频率、速度异常、转身等）都关联到具体段落
- 段落对比结果可追溯到具体数据点
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from .kinematics import KinematicResult, KinematicPoint
from .resistance import ResistanceResult
from .efficiency import EfficiencyResult, EfficiencyPoint
from .data_validation import ValidationResult


@dataclass
class SwimSegment:
    """单个游泳段落（通常是单趟）"""
    segment_id: str
    start_idx: int
    end_idx: int
    start_time: float
    end_time: float
    start_position: float
    end_position: float
    direction: str  # "往" 或 "返"
    lap_number: int
    stroke_style: str

    kinematic_stats: Dict = field(default_factory=dict)
    resistance_stats: Dict = field(default_factory=dict)
    efficiency_stats: Dict = field(default_factory=dict)

    clues: List[Dict] = field(default_factory=list)
    data_refs: Dict = field(default_factory=dict)

    def summary(self) -> Dict:
        """段落摘要，保留回明细的链接"""
        return {
            "segment_id": self.segment_id,
            "lap_number": self.lap_number,
            "direction": self.direction,
            "duration": round(self.end_time - self.start_time, 3),
            "distance": round(self.end_position - self.start_position, 2),
            "avg_velocity": round(self.kinematic_stats.get("avg_velocity", 0), 3),
            "avg_stroke_rate": round(self.kinematic_stats.get("avg_stroke_rate", 0), 1),
            "avg_stroke_length": round(self.kinematic_stats.get("avg_stroke_length", 0), 3),
            "avg_overall_efficiency": round(self.efficiency_stats.get("avg_overall_efficiency", 0), 4),
            "clues_count": len(self.clues),
            "detail_ref": f"segments/{self.segment_id}",
            "data_range": f"points[{self.start_idx}:{self.end_idx}]",
        }


@dataclass
class Clue:
    """线索：各种异常或特征点"""
    clue_id: str
    clue_type: str  # velocity_spike / low_efficiency / turn / stroke_rate_change / etc.
    severity: str  # info / warning / error
    description: str
    segment_id: Optional[str] = None
    point_idx: Optional[int] = None
    time: Optional[float] = None
    position: Optional[float] = None
    evidence: Dict = field(default_factory=dict)


@dataclass
class SegmentComparison:
    """段落对比结果"""
    segment_a_id: str
    segment_b_id: str
    metrics: Dict[str, Dict] = field(default_factory=dict)
    conclusion: List[str] = field(default_factory=list)
    evidence_refs: List[str] = field(default_factory=list)


@dataclass
class SegmentationResult:
    """段落分析总结果"""
    segments: List[SwimSegment] = field(default_factory=list)
    clues: List[Clue] = field(default_factory=list)
    comparisons: List[SegmentComparison] = field(default_factory=list)
    evidence_chain: Dict = field(default_factory=dict)
    warnings: List[str] = field(default_factory=list)


def segment_swim(
    kinematic_result: KinematicResult,
    resistance_result: Optional[ResistanceResult] = None,
    efficiency_result: Optional[EfficiencyResult] = None,
    validation_result: Optional[ValidationResult] = None,
) -> SegmentationResult:
    """
    段落识别主函数

    识别逻辑：
    1. 基于池长和位置数据识别转身点
    2. 基于转身点划分段落
    3. 为每个段落计算统计量
    4. 关联所有线索到对应段落
    5. 生成段落间对比
    """
    result = SegmentationResult()
    points = kinematic_result.points
    pool_length = kinematic_result.raw_input.pool_length if kinematic_result.raw_input else 25.0
    stroke_style = kinematic_result.raw_input.stroke_style if kinematic_result.raw_input else "自由泳"

    if not points or len(points) < 2:
        result.warnings.append("数据点不足，无法划分段落")
        return result

    turn_points = _detect_turns(points, pool_length)
    result.evidence_chain["turn_detection"] = {
        "pool_length": pool_length,
        "turn_points": turn_points,
        "method": "基于位置极值+速度最低点检测转身点",
    }

    segments = _split_segments(points, turn_points, pool_length, stroke_style)

    for i, seg in enumerate(segments):
        seg_points = points[seg.start_idx:seg.end_idx + 1]

        seg.kinematic_stats = _calculate_kinematic_stats(seg_points)
        seg.data_refs["kinematic_range"] = [seg.start_idx, seg.end_idx]

        if resistance_result and len(resistance_result.points) > seg.end_idx:
            res_points = resistance_result.points[seg.start_idx:seg.end_idx + 1]
            seg.resistance_stats = _calculate_resistance_stats(res_points)
            seg.data_refs["resistance_range"] = [seg.start_idx, seg.end_idx]

        if efficiency_result and len(efficiency_result.points) > seg.end_idx:
            eff_points = efficiency_result.points[seg.start_idx:seg.end_idx + 1]
            seg.efficiency_stats = _calculate_efficiency_stats(eff_points)
            seg.data_refs["efficiency_range"] = [seg.start_idx, seg.end_idx]

        seg.clues = _collect_clues_for_segment(
            seg, validation_result, efficiency_result
        )

        result.segments.append(seg)

    result.clues = _collect_all_clues(result.segments, validation_result, efficiency_result)

    if len(result.segments) >= 2:
        result.comparisons = _generate_segment_comparisons(result.segments)

    _build_evidence_chain(result, kinematic_result, resistance_result, efficiency_result, validation_result)

    return result


def _detect_turns(points: List[KinematicPoint], pool_length: float) -> List[int]:
    """检测转身点索引"""
    turns = []
    n = len(points)

    expected_laps = int(points[-1].position / pool_length) + 1
    for lap in range(1, expected_laps):
        target_pos = lap * pool_length
        closest_idx = 0
        min_diff = float('inf')

        for i, p in enumerate(points):
            diff = abs(p.position - target_pos)
            if diff < min_diff:
                min_diff = diff
                closest_idx = i

        search_start = max(0, closest_idx - 5)
        search_end = min(n, closest_idx + 6)
        min_v = float('inf')
        turn_idx = closest_idx

        for i in range(search_start, search_end):
            if points[i].velocity < min_v and points[i].velocity >= 0:
                min_v = points[i].velocity
                turn_idx = i

        turns.append(turn_idx)

    return turns


def _split_segments(
    points: List[KinematicPoint],
    turn_points: List[int],
    pool_length: float,
    stroke_style: str
) -> List[SwimSegment]:
    """根据转身点划分段落"""
    segments = []
    boundaries = [0] + turn_points + [len(points) - 1]

    for i in range(len(boundaries) - 1):
        start = boundaries[i]
        end = boundaries[i + 1]

        if i > 0:
            start += 1
        if i < len(boundaries) - 2:
            end -= 1

        if end <= start:
            continue

        direction = "往" if i % 2 == 0 else "返"
        lap_number = i + 1

        seg = SwimSegment(
            segment_id=f"SEG-{lap_number:03d}",
            start_idx=start,
            end_idx=end,
            start_time=points[start].time,
            end_time=points[end].time,
            start_position=points[start].position,
            end_position=points[end].position,
            direction=direction,
            lap_number=lap_number,
            stroke_style=stroke_style,
        )
        segments.append(seg)

    return segments


def _calculate_kinematic_stats(points: List[KinematicPoint]) -> Dict:
    """计算段落运动学统计"""
    if not points:
        return {}

    velocities = [p.velocity for p in points]
    stroke_rates = [p.stroke_rate for p in points if p.stroke_rate > 0]
    stroke_lengths = [p.stroke_length for p in points if p.stroke_length > 0]

    return {
        "duration": points[-1].time - points[0].time,
        "distance": points[-1].position - points[0].position,
        "avg_velocity": sum(velocities) / len(velocities) if velocities else 0,
        "max_velocity": max(velocities) if velocities else 0,
        "min_velocity": min(velocities) if velocities else 0,
        "avg_stroke_rate": sum(stroke_rates) / len(stroke_rates) if stroke_rates else 0,
        "max_stroke_rate": max(stroke_rates) if stroke_rates else 0,
        "avg_stroke_length": sum(stroke_lengths) / len(stroke_lengths) if stroke_lengths else 0,
        "max_stroke_length": max(stroke_lengths) if stroke_lengths else 0,
        "total_strokes": points[-1].stroke_count - points[0].stroke_count,
    }


def _calculate_resistance_stats(points) -> Dict:
    """计算段落阻力统计"""
    if not points:
        return {}

    active_resistances = [p.active_resistance for p in points]
    powers = [p.propulsive_power for p in points]

    return {
        "avg_active_resistance": sum(active_resistances) / len(active_resistances) if active_resistances else 0,
        "max_active_resistance": max(active_resistances) if active_resistances else 0,
        "avg_power": sum(powers) / len(powers) if powers else 0,
        "max_power": max(powers) if powers else 0,
    }


def _calculate_efficiency_stats(points: List[EfficiencyPoint]) -> Dict:
    """计算段落效率统计"""
    if not points:
        return {}

    overall_effs = [p.overall_efficiency for p in points if p.overall_efficiency > 0]
    stroke_effs = [p.stroke_efficiency for p in points if p.stroke_efficiency > 0]
    eis = [p.efficiency_index for p in points if p.efficiency_index > 0]

    return {
        "avg_overall_efficiency": sum(overall_effs) / len(overall_effs) if overall_effs else 0,
        "max_overall_efficiency": max(overall_effs) if overall_effs else 0,
        "min_overall_efficiency": min(overall_effs) if overall_effs else 0,
        "avg_stroke_efficiency": sum(stroke_effs) / len(stroke_effs) if stroke_effs else 0,
        "avg_efficiency_index": sum(eis) / len(eis) if eis else 0,
    }


def _collect_clues_for_segment(
    segment: SwimSegment,
    validation_result: Optional[ValidationResult],
    efficiency_result: Optional[EfficiencyResult],
) -> List[Dict]:
    """收集归属于某段落的所有线索"""
    clues = []

    if validation_result:
        for issue in validation_result.issues:
            idx = issue.location.get("idx")
            if idx is not None and segment.start_idx <= idx <= segment.end_idx:
                clues.append({
                    "clue_id": f"CLUE-VAL-{len(clues):03d}",
                    "type": issue.issue_type,
                    "severity": issue.severity,
                    "description": issue.description,
                    "point_idx": idx,
                    "time": issue.location.get("time"),
                    "position": issue.location.get("position"),
                    "source": "validation",
                    "evidence_ref": f"validation/issues/{id(issue)}",
                })

    if efficiency_result:
        for low_seg in efficiency_result.low_efficiency_segments:
            overlap_start = max(segment.start_idx, low_seg["start_idx"])
            overlap_end = min(segment.end_idx, low_seg["end_idx"])
            if overlap_start <= overlap_end:
                clues.append({
                    "clue_id": f"CLUE-EFF-{len(clues):03d}",
                    "type": "low_efficiency_segment",
                    "severity": "warning",
                    "description": f"低效率段落，效率下降{low_seg.get('efficiency_drop_pct', 0):.1f}%",
                    "point_idx": low_seg["min_efficiency_at"],
                    "time": low_seg.get("start_time"),
                    "position": low_seg.get("start_position"),
                    "source": "efficiency",
                    "causes": low_seg.get("evidence", {}).get("causes", []),
                    "evidence_ref": f"efficiency/low_segments/{low_seg['start_idx']}_{low_seg['end_idx']}",
                })

    return clues


def _collect_all_clues(
    segments: List[SwimSegment],
    validation_result: Optional[ValidationResult],
    efficiency_result: Optional[EfficiencyResult],
) -> List[Clue]:
    """收集所有线索并转换为Clue对象"""
    all_clues = []
    clue_counter = 0

    for seg in segments:
        for clue_dict in seg.clues:
            clue = Clue(
                clue_id=clue_dict["clue_id"],
                clue_type=clue_dict["type"],
                severity=clue_dict["severity"],
                description=clue_dict["description"],
                segment_id=seg.segment_id,
                point_idx=clue_dict.get("point_idx"),
                time=clue_dict.get("time"),
                position=clue_dict.get("position"),
                evidence={"source": clue_dict["source"], "ref": clue_dict.get("evidence_ref")}
            )
            all_clues.append(clue)

    return all_clues


def _generate_segment_comparisons(segments: List[SwimSegment]) -> List[SegmentComparison]:
    """生成相邻段落对比"""
    comparisons = []

    for i in range(len(segments) - 1):
        seg_a = segments[i]
        seg_b = segments[i + 1]

        comp = SegmentComparison(
            segment_a_id=seg_a.segment_id,
            segment_b_id=seg_b.segment_id,
        )

        metrics = ["avg_velocity", "avg_stroke_rate", "avg_stroke_length", "avg_overall_efficiency"]
        for metric in metrics:
            val_a = seg_a.kinematic_stats.get(metric, seg_a.efficiency_stats.get(metric, 0))
            val_b = seg_b.kinematic_stats.get(metric, seg_b.efficiency_stats.get(metric, 0))
            diff = val_b - val_a
            pct = (diff / val_a * 100) if val_a != 0 else 0

            comp.metrics[metric] = {
                "value_a": round(val_a, 4),
                "value_b": round(val_b, 4),
                "difference": round(diff, 4),
                "change_pct": round(pct, 1),
                "evidence_ref": f"segments/{seg_a.segment_id}/{metric}_vs_{seg_b.segment_id}",
            }

            if abs(pct) > 10:
                direction = "上升" if pct > 0 else "下降"
                comp.conclusion.append(f"{metric}: {direction}{abs(pct):.1f}%")
                comp.evidence_refs.append(comp.metrics[metric]["evidence_ref"])

        comparisons.append(comp)

    return comparisons


def _build_evidence_chain(
    result: SegmentationResult,
    kinematic_result: KinematicResult,
    resistance_result: Optional[ResistanceResult],
    efficiency_result: Optional[EfficiencyResult],
    validation_result: Optional[ValidationResult],
) -> None:
    """构建完整的证据链，确保从摘要可追溯到明细"""
    chain = {
        "segments": {},
        "clues": {},
        "raw_data_refs": {},
    }

    for seg in result.segments:
        chain["segments"][seg.segment_id] = {
            "summary": seg.summary(),
            "data_ranges": seg.data_refs,
            "clue_refs": [c["clue_id"] for c in seg.clues],
            "raw_kinematic_refs": list(range(seg.start_idx, seg.end_idx + 1, max(1, (seg.end_idx - seg.start_idx) // 10))),
        }

    for clue in result.clues:
        chain["clues"][clue.clue_id] = {
            "segment_id": clue.segment_id,
            "point_idx": clue.point_idx,
            "evidence": clue.evidence,
        }

    if validation_result:
        chain["raw_data_refs"]["validation_hash"] = validation_result.raw_data_hash
        chain["raw_data_refs"]["validation_issue_count"] = len(validation_result.issues)

    result.evidence_chain["traceability"] = chain
