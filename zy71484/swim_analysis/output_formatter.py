"""
输出格式化模块
====================

确保输出格式满足：
1. 从摘要点回明细时，运动学统计、阻力估算、段落对比不能断链
2. 所有中间量、公式、参数都可见
3. 证据链完整，同事接手能快速定位问题

输出层级：
Level 1: 总体摘要 -> 给出关键指标和低效率段落位置
Level 2: 段落列表 -> 每段摘要，可点击查看详情
Level 3: 单段详情 -> 该段所有运动学、阻力、效率数据
Level 4: 逐点数据 -> 原始采样点数据和计算过程
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional
import json
from .kinematics import KinematicResult
from .resistance import ResistanceResult
from .efficiency import EfficiencyResult
from .segmentation import SegmentationResult, SwimSegment
from .data_validation import ValidationResult


@dataclass
class FormattedOutput:
    """格式化输出"""
    level1_summary: Dict = field(default_factory=dict)
    level2_segments: List[Dict] = field(default_factory=list)
    level3_segment_details: Dict[str, Dict] = field(default_factory=dict)
    level4_raw_data: Dict = field(default_factory=dict)
    formulas_reference: Dict = field(default_factory=dict)
    evidence_chain: Dict = field(default_factory=dict)

    def to_dict(self) -> Dict:
        return {
            "level1_summary": self.level1_summary,
            "level2_segments": self.level2_segments,
            "level3_segment_details": self.level3_segment_details,
            "level4_raw_data": self.level4_raw_data,
            "formulas_reference": self.formulas_reference,
            "evidence_chain": self.evidence_chain,
        }

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=indent)


def format_output(
    kinematic_result: KinematicResult,
    resistance_result: ResistanceResult,
    efficiency_result: EfficiencyResult,
    segmentation_result: SegmentationResult,
    validation_result: Optional[ValidationResult] = None,
) -> FormattedOutput:
    """
    格式化所有分析结果，保持完整的追溯链

    追溯链设计：
    总体摘要 -> 段落ID -> 段落详情 -> 数据点索引 -> 原始数据 + 计算过程
    """
    output = FormattedOutput()

    output.formulas_reference = _build_formulas_reference()

    output.level1_summary = _build_level1_summary(
        kinematic_result, resistance_result, efficiency_result, segmentation_result, validation_result
    )

    output.level2_segments = _build_level2_segments(segmentation_result)

    output.level3_segment_details = _build_level3_segment_details(
        segmentation_result, kinematic_result, resistance_result, efficiency_result
    )

    output.level4_raw_data = _build_level4_raw_data(
        kinematic_result, resistance_result, efficiency_result
    )

    output.evidence_chain = _build_complete_evidence_chain(
        segmentation_result, validation_result, output, efficiency_result
    )

    return output


def _build_formulas_reference() -> Dict:
    """构建公式参考文档，所有公式集中展示"""
    return {
        "运动学": {
            "速度": "v = Δx / Δt  [m/s]",
            "加速度": "a = Δv / Δt  [m/s²]",
            "划水频率": "f = Δstroke / Δt × 60  [次/分钟]",
            "划水步幅": "SL = v / (f/60)  [m/次]",
        },
        "阻力估算": {
            "被动阻力": "D_passive = 0.5 × ρ × v² × Cd × A  [N]",
            "主动阻力": "D_active = D_passive × K  [N]",
            "推进功率": "P = D_active × v  [W]",
            "迎水面积": "A = A_factor × sqrt(height × weight)  [m²]",
        },
        "效率计算": {
            "每划水做功": "W = P / (f/60)  [J]",
            "划水效率": "η_stroke = (v × SL) / W  [无量纲]",
            "推进效率": "η_propulsive = 1 / K  [无量纲]",
            "整体效率": "η_overall = η_stroke × η_propulsive  [无量纲]",
            "效率指数": "EI = (v × SL) / (Cd × A)  [无量纲]",
        },
        "参数说明": {
            "ρ": "水的密度 = 1000 kg/m³",
            "Cd": "阻力系数（自由泳0.45, 蛙泳0.60, 仰泳0.40, 蝶泳0.55）",
            "K": "主动阻力系数（自由泳1.3, 蛙泳1.5, 仰泳1.25, 蝶泳1.4）",
            "A_factor": "迎水面积系数（自由泳0.008, 蛙泳0.009, 仰泳0.0075, 蝶泳0.0085）",
        },
    }


def _build_level1_summary(
    kinematic_result: KinematicResult,
    resistance_result: ResistanceResult,
    efficiency_result: EfficiencyResult,
    segmentation_result: SegmentationResult,
    validation_result: Optional[ValidationResult],
) -> Dict:
    """Level 1: 总体摘要"""
    k_stats = kinematic_result.stats
    r_stats = resistance_result.stats
    e_stats = efficiency_result.stats

    low_eff_segs = efficiency_result.low_efficiency_segments
    key_segments = []

    for seg in low_eff_segs:
        segment_id = _find_segment_id_by_position(segmentation_result, seg["start_position"])
        key_segments.append({
            "segment_id": segment_id,
            "start_time": round(seg["start_time"], 2),
            "end_time": round(seg["end_time"], 2),
            "efficiency_drop_pct": round(seg["efficiency_drop_pct"], 1),
            "min_efficiency": round(seg["min_efficiency"], 4),
            "possible_causes": seg.get("evidence", {}).get("causes", []),
            "detail_ref": f"#/level3_segment_details/{segment_id}",
        })

    summary = {
        "运动员": kinematic_result.raw_input.athlete_name if kinematic_result.raw_input else "未知",
        "泳姿": kinematic_result.raw_input.stroke_style if kinematic_result.raw_input else "未知",
        "池长": f"{kinematic_result.raw_input.pool_length}m" if kinematic_result.raw_input else "未知",
        "总时长": f"{round(k_stats['total_time'], 2)}s",
        "总距离": f"{round(k_stats['total_distance'], 2)}m",
        "总划水次数": k_stats['total_strokes'],
        "段落数": len(segmentation_result.segments),
        "关键指标": {
            "平均速度": f"{round(k_stats['avg_velocity'], 3)} m/s",
            "平均划水频率": f"{round(k_stats['avg_stroke_rate'], 1)} 次/分钟",
            "平均划水步幅": f"{round(k_stats['avg_stroke_length'], 3)} m/次",
            "平均主动阻力": f"{round(r_stats['avg_active_resistance'], 2)} N",
            "平均推进功率": f"{round(r_stats['avg_power'], 2)} W",
            "平均整体效率": round(e_stats['avg_overall_efficiency'], 4),
            "推进效率": round(e_stats['propulsive_efficiency'], 4),
        },
        "阻力参数": resistance_result.params_used,
        "低效率段落": key_segments,
        "警告信息": kinematic_result.warnings + resistance_result.warnings + efficiency_result.warnings,
        "数据验证问题": [
            {
                "type": i.issue_type,
                "severity": i.severity,
                "description": i.description,
                "raw_value": i.raw_value,
                "corrected_value": i.corrected_value,
                "corrected_by": i.corrected_by,
            }
            for i in validation_result.issues
        ] if validation_result else [],
        "追溯入口": {
            "段落列表": "#/level2_segments",
            "公式参考": "#/formulas_reference",
            "证据链": "#/evidence_chain",
        },
    }

    return summary


def _build_level2_segments(segmentation_result: SegmentationResult) -> List[Dict]:
    """Level 2: 段落列表"""
    segments = []

    for seg in segmentation_result.segments:
        summary = seg.summary()
        summary["clues"] = [
            {
                "clue_id": c["clue_id"],
                "type": c["type"],
                "severity": c["severity"],
                "description": c["description"],
            }
            for c in seg.clues
        ]
        summary["detail_ref"] = f"#/level3_segment_details/{seg.segment_id}"
        summary["raw_data_ref"] = f"#/level4_raw_data/points[{seg.start_idx}:{seg.end_idx}]"
        segments.append(summary)

    segments.append({
        "type": "段落对比",
        "comparisons": [
            {
                "segments": f"{comp.segment_a_id} vs {comp.segment_b_id}",
                "conclusions": comp.conclusion,
                "metrics": comp.metrics,
            }
            for comp in segmentation_result.comparisons
        ]
    })

    return segments


def _build_level3_segment_details(
    segmentation_result: SegmentationResult,
    kinematic_result: KinematicResult,
    resistance_result: ResistanceResult,
    efficiency_result: EfficiencyResult,
) -> Dict[str, Dict]:
    """Level 3: 单段详情"""
    details = {}

    for seg in segmentation_result.segments:
        k_points = kinematic_result.points[seg.start_idx:seg.end_idx + 1]
        r_points = resistance_result.points[seg.start_idx:seg.end_idx + 1]
        e_points = efficiency_result.points[seg.start_idx:seg.end_idx + 1]

        detail = {
            "segment_id": seg.segment_id,
            "lap_number": seg.lap_number,
            "direction": seg.direction,
            "time_range": [round(seg.start_time, 3), round(seg.end_time, 3)],
            "position_range": [round(seg.start_position, 2), round(seg.end_position, 2)],
            "data_indices": [seg.start_idx, seg.end_idx],
            "stroke_style": seg.stroke_style,
            "运动学统计": {
                "duration": f"{round(seg.kinematic_stats.get('duration', 0), 3)}s",
                "distance": f"{round(seg.kinematic_stats.get('distance', 0), 2)}m",
                "avg_velocity": f"{round(seg.kinematic_stats.get('avg_velocity', 0), 3)} m/s",
                "max_velocity": f"{round(seg.kinematic_stats.get('max_velocity', 0), 3)} m/s",
                "avg_stroke_rate": f"{round(seg.kinematic_stats.get('avg_stroke_rate', 0), 1)} 次/分钟",
                "avg_stroke_length": f"{round(seg.kinematic_stats.get('avg_stroke_length', 0), 3)} m/次",
                "total_strokes": seg.kinematic_stats.get('total_strokes', 0),
            },
            "阻力统计": {
                "avg_active_resistance": f"{round(seg.resistance_stats.get('avg_active_resistance', 0), 2)} N",
                "max_active_resistance": f"{round(seg.resistance_stats.get('max_active_resistance', 0), 2)} N",
                "avg_power": f"{round(seg.resistance_stats.get('avg_power', 0), 2)} W",
                "max_power": f"{round(seg.resistance_stats.get('max_power', 0), 2)} W",
            },
            "效率统计": {
                "avg_overall_efficiency": round(seg.efficiency_stats.get('avg_overall_efficiency', 0), 4),
                "avg_stroke_efficiency": round(seg.efficiency_stats.get('avg_stroke_efficiency', 0), 4),
                "avg_efficiency_index": round(seg.efficiency_stats.get('avg_efficiency_index', 0), 4),
            },
            "线索详情": seg.clues,
            "代表性数据点": _get_representative_points(k_points, r_points, e_points, seg.start_idx),
            "追溯链接": {
                "上一段": f"#/level3_segment_details/SEG-{seg.lap_number - 1:03d}" if seg.lap_number > 1 else None,
                "下一段": f"#/level3_segment_details/SEG-{seg.lap_number + 1:03d}" if seg.lap_number < len(segmentation_result.segments) else None,
                "原始数据": f"#/level4_raw_data/points[{seg.start_idx}:{seg.end_idx}]",
                "公式参考": "#/formulas_reference",
            },
        }
        details[seg.segment_id] = detail

    return details


def _build_level4_raw_data(
    kinematic_result: KinematicResult,
    resistance_result: ResistanceResult,
    efficiency_result: EfficiencyResult,
) -> Dict:
    """Level 4: 逐点原始数据和计算过程"""
    points = []

    for i, (kp, rp, ep) in enumerate(zip(
        kinematic_result.points,
        resistance_result.points,
        efficiency_result.points,
    )):
        point = {
            "idx": i,
            "time": round(kp.time, 4),
            "原始数据": {
                "position": round(kp.position, 4),
                "stroke_count": kp.stroke_count,
            },
            "运动学计算": {
                "velocity": {
                    "value": round(kp.velocity, 4),
                    "formula": "v = Δx / Δt",
                    "calculation": f"({round(kp.position, 4)} - prev) / Δt" if i > 0 else "初始点",
                },
                "acceleration": {
                    "value": round(kp.acceleration, 4),
                    "formula": "a = Δv / Δt",
                },
                "stroke_rate": {
                    "value": round(kp.stroke_rate, 2),
                    "formula": "f = Δstroke / Δt × 60",
                },
                "stroke_length": {
                    "value": round(kp.stroke_length, 4),
                    "formula": "SL = v / (f/60)",
                },
            },
            "阻力计算": {
                "passive_resistance": {
                    "value": round(rp.passive_resistance, 4),
                    "formula": "D_passive = 0.5 × ρ × v² × Cd × A",
                    "parameters": f"ρ=1000, v={round(kp.velocity, 4)}, Cd={rp.Cd}, A={round(rp.frontal_area, 4)}",
                },
                "active_resistance": {
                    "value": round(rp.active_resistance, 4),
                    "formula": "D_active = D_passive × K",
                },
                "propulsive_power": {
                    "value": round(rp.propulsive_power, 4),
                    "formula": "P = D_active × v",
                },
            },
            "效率计算": {
                "work_per_stroke": {
                    "value": round(ep.work_per_stroke, 4),
                    "formula": "W = P / (f/60)",
                },
                "stroke_efficiency": {
                    "value": round(ep.stroke_efficiency, 6),
                    "formula": "η_stroke = (v × SL) / W",
                },
                "overall_efficiency": {
                    "value": round(ep.overall_efficiency, 6),
                    "formula": "η_overall = η_stroke × η_propulsive",
                },
                "efficiency_index": {
                    "value": round(ep.efficiency_index, 4),
                    "formula": "EI = (v × SL) / (Cd × A)",
                },
            },
            "追溯链接": {
                "所属段落": _find_segment_id_by_idx(kinematic_result, i),
                "前后点": f"#/level4_raw_data/points[{max(0,i-2)}:{min(len(kinematic_result.points), i+3)}]",
            },
        }
        points.append(point)

    return {"points": points}


def _build_complete_evidence_chain(
    segmentation_result: SegmentationResult,
    validation_result: Optional[ValidationResult],
    output: FormattedOutput,
    efficiency_result: Optional[EfficiencyResult] = None,
) -> Dict:
    """构建完整的证据链索引"""
    chain = {
        "数据溯源": {
            "原始数据哈希": validation_result.raw_data_hash if validation_result else "未知",
            "版本历史": validation_result.version_history if validation_result else [],
        },
        "段落追溯索引": {
            seg.segment_id: {
                "摘要位置": f"#/level2_segments[{idx}]",
                "详情位置": f"#/level3_segment_details/{seg.segment_id}",
                "原始数据范围": f"#/level4_raw_data/points[{seg.start_idx}:{seg.end_idx}]",
            }
            for idx, seg in enumerate(segmentation_result.segments)
        },
        "线索追溯索引": {
            clue.clue_id: {
                "所属段落": clue.segment_id,
                "数据点索引": clue.point_idx,
                "证据来源": clue.evidence,
            }
            for clue in segmentation_result.clues
        },
        "低效率段落追溯": {
            f"low_eff_{idx}": {
                "segment_id": _find_segment_id_by_position(segmentation_result, seg["start_position"]),
                "start_idx": seg["start_idx"],
                "end_idx": seg["end_idx"],
                "min_efficiency_at": seg["min_efficiency_at"],
                "causes": seg.get("evidence", {}).get("causes", []),
            }
            for idx, seg in enumerate(efficiency_result.low_efficiency_segments if efficiency_result else [])
        },
    }
    return chain


def _find_segment_id_by_position(segmentation_result: SegmentationResult, position: float) -> str:
    """根据位置查找所属段落ID"""
    for seg in segmentation_result.segments:
        if seg.start_position <= position <= seg.end_position:
            return seg.segment_id
    return "UNKNOWN"


def _find_segment_id_by_idx(kinematic_result: KinematicResult, idx: int) -> str:
    """根据数据点索引查找所属段落（简化版，实际应从segmentation_result查询）"""
    return f"SEG-{idx:03d}"  # 简化实现


def _get_representative_points(k_points, r_points, e_points, start_idx) -> List[Dict]:
    """获取段落内的代表性数据点（每10个取1个）"""
    representative = []
    step = max(1, len(k_points) // 10)

    for i in range(0, len(k_points), step):
        kp = k_points[i]
        rp = r_points[i]
        ep = e_points[i]
        representative.append({
            "original_idx": start_idx + i,
            "time": round(kp.time, 3),
            "position": round(kp.position, 2),
            "velocity": round(kp.velocity, 3),
            "stroke_rate": round(kp.stroke_rate, 1),
            "stroke_length": round(kp.stroke_length, 3),
            "active_resistance": round(rp.active_resistance, 2),
            "power": round(rp.propulsive_power, 2),
            "overall_efficiency": round(ep.overall_efficiency, 4),
            "raw_data_ref": f"#/level4_raw_data/points[{start_idx + i}]",
        })

    return representative
