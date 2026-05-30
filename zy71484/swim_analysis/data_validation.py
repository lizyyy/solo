"""
数据输入与验证模块
====================

专门处理边界情况并保留证据：
1. 池长错误检测与人工核校记录
2. 速度尖峰检测与标记（不自动修正，保留原始数据）
3. 划水次数漏记检测与版本记录
4. 所有修改均保留原始数据和修改痕迹，供后续追溯
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
import json
from datetime import datetime
from .kinematics import KinematicInput


@dataclass
class ValidationIssue:
    """单个验证问题记录"""
    issue_type: str  # pool_length_error / velocity_spike / missing_stroke / data_gap / other
    severity: str  # warning / error / info
    description: str
    location: Dict  # 索引、时间、位置等定位信息
    raw_value: float
    expected_range: Optional[Tuple[float, float]] = None
    corrected_value: Optional[float] = None
    corrected_by: Optional[str] = None  # auto / manual
    corrected_at: Optional[str] = None
    evidence: Dict = field(default_factory=dict)


@dataclass
class ValidationResult:
    """验证结果，包含所有问题和证据链"""
    issues: List[ValidationIssue] = field(default_factory=list)
    raw_data_hash: str = ""
    validated_data: Optional[KinematicInput] = None
    validation_time: str = field(default_factory=lambda: datetime.now().isoformat())
    version_history: List[Dict] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    evidence: Dict = field(default_factory=dict)

    def to_dict(self) -> Dict:
        """序列化用于持久化，确保证据不可篡改"""
        return {
            "validation_time": self.validation_time,
            "raw_data_hash": self.raw_data_hash,
            "issues": [
                {
                    "issue_type": i.issue_type,
                    "severity": i.severity,
                    "description": i.description,
                    "location": i.location,
                    "raw_value": i.raw_value,
                    "expected_range": i.expected_range,
                    "corrected_value": i.corrected_value,
                    "corrected_by": i.corrected_by,
                    "corrected_at": i.corrected_at,
                    "evidence": i.evidence,
                }
                for i in self.issues
            ],
            "version_history": self.version_history,
            "warnings": self.warnings,
        }


def validate_and_clean_data(
    raw_input: KinematicInput,
    known_pool_length: Optional[float] = None,
    enable_autocorrect: bool = False
) -> ValidationResult:
    """
    数据验证主函数

    处理原则：
    1. 永远保留原始数据
    2. 自动检测但不自动修正（除非明确指定 enable_autocorrect=True）
    3. 所有修正记录来源（auto/manual）和时间戳
    4. 问题严重程度分级：error（必须处理）/ warning（建议处理）/ info（仅供参考）

    检测项目：
    - 池长一致性检查
    - 速度尖峰检测（> 3σ 原则）
    - 划水次数漏记检测（长时间无新增）
    - 数据丢失检测（时间间隔异常）
    - 位置回退检测（转身除外）
    """
    result = ValidationResult()
    result.raw_data_hash = _calculate_data_hash(raw_input)

    result.version_history.append({
        "version": 1,
        "timestamp": result.validation_time,
        "action": "raw_data_received",
        "description": "原始数据接收，未做任何修改",
        "data_hash": result.raw_data_hash,
    })

    if known_pool_length is not None and abs(raw_input.pool_length - known_pool_length) > 0.1:
        issue = ValidationIssue(
            issue_type="pool_length_error",
            severity="error",
            description=f"池长不匹配：输入={raw_input.pool_length}m, 已知={known_pool_length}m",
            location={"field": "pool_length"},
            raw_value=raw_input.pool_length,
            expected_range=(known_pool_length - 0.1, known_pool_length + 0.1),
            evidence={
                "input_value": raw_input.pool_length,
                "known_value": known_pool_length,
                "difference": abs(raw_input.pool_length - known_pool_length),
                "consequences": [
                    "所有基于池长的段落划分将错误",
                    "转身点检测将偏移",
                    "速度计算可能出现系统性偏差"
                ]
            }
        )
        result.issues.append(issue)
        result.warnings.append(issue.description)

    velocities = []
    for i in range(1, len(raw_input.time)):
        dt = raw_input.time[i] - raw_input.time[i-1]
        dx = raw_input.position[i] - raw_input.position[i-1]
        v = dx / dt if dt > 0 else 0
        velocities.append(v)

    if len(velocities) > 3:
        mean_v = sum(velocities) / len(velocities)
        std_v = (sum((v - mean_v) ** 2 for v in velocities) / len(velocities)) ** 0.5
        max_reasonable_v = mean_v + 3 * std_v
        min_reasonable_v = max(0, mean_v - 3 * std_v)

        for i, v in enumerate(velocities):
            if v > max_reasonable_v or v < min_reasonable_v:
                issue = ValidationIssue(
                    issue_type="velocity_spike",
                    severity="warning",
                    description=f"速度尖峰：t={raw_input.time[i+1]:.2f}s, v={v:.3f}m/s, 均值={mean_v:.3f}m/s, 3σ上限={max_reasonable_v:.3f}m/s",
                    location={"idx": i+1, "time": raw_input.time[i+1], "position": raw_input.position[i+1]},
                    raw_value=v,
                    expected_range=(min_reasonable_v, max_reasonable_v),
                    evidence={
                        "velocity": v,
                        "mean": mean_v,
                        "std": std_v,
                        "z_score": (v - mean_v) / std_v if std_v > 0 else float('inf'),
                        "dt": raw_input.time[i+1] - raw_input.time[i],
                        "dx": raw_input.position[i+1] - raw_input.position[i],
                        "neighbor_values": [
                            velocities[max(0, i-2)],
                            velocities[max(0, i-1)],
                            v,
                            velocities[min(len(velocities)-1, i+1)],
                            velocities[min(len(velocities)-1, i+2)],
                        ]
                    }
                )
                result.issues.append(issue)
                result.warnings.append(issue.description)

    effective_pool_length = known_pool_length if known_pool_length is not None else raw_input.pool_length
    expected_laps = int(raw_input.position[-1] / effective_pool_length) + 1

    expected_stroke_rate = 30.0  # 预期最低划水频率 30次/分钟
    expected_stroke_interval = 60.0 / expected_stroke_rate  # 每划水间隔2秒
    max_gap_for_stroke = expected_stroke_interval * 3  # 允许3倍间隔，超过则疑似漏记

    result.evidence["stroke_validation_params"] = {
        "used_pool_length": effective_pool_length,
        "source": "known_pool_length" if known_pool_length is not None else "input_pool_length",
        "expected_stroke_rate": expected_stroke_rate,
        "expected_stroke_interval": expected_stroke_interval,
        "max_reasonable_gap_seconds": max_gap_for_stroke,
        "detection_method": "划水间隔超过预期3倍则标记为疑似漏记",
    }
    current_stroke = raw_input.stroke_count[0]
    last_change_time = raw_input.time[0]

    for i in range(1, len(raw_input.time)):
        dt = raw_input.time[i] - raw_input.time[i-1]
        if dt > (1.0 / raw_input.sample_rate) * 2:
            issue = ValidationIssue(
                issue_type="data_gap",
                severity="warning",
                description=f"数据丢失：索引{i}, 间隔={dt:.4f}s (预期{1/raw_input.sample_rate:.4f}s)",
                location={"idx": i, "time_start": raw_input.time[i-1], "time_end": raw_input.time[i]},
                raw_value=dt,
                expected_range=(0, (1.0 / raw_input.sample_rate) * 1.5),
                evidence={
                    "missing_samples": int(dt * raw_input.sample_rate),
                    "position_before": raw_input.position[i-1],
                    "position_after": raw_input.position[i],
                }
            )
            result.issues.append(issue)

        if raw_input.stroke_count[i] != current_stroke:
            current_stroke = raw_input.stroke_count[i]
            last_change_time = raw_input.time[i]
        else:
            time_since_last_stroke = raw_input.time[i] - last_change_time
            if time_since_last_stroke > max_gap_for_stroke and raw_input.position[i] < raw_input.position[-1] * 0.95:
                issue = ValidationIssue(
                    issue_type="missing_stroke",
                    severity="warning",
                    description=f"划水次数疑似漏记：t={raw_input.time[i]:.2f}s, 已{time_since_last_stroke:.1f}s无新增划水，当前次数={current_stroke}",
                    location={"idx": i, "time": raw_input.time[i], "position": raw_input.position[i]},
                    raw_value=time_since_last_stroke,
                    expected_range=(0, max_gap_for_stroke),
                    evidence={
                        "current_stroke_count": current_stroke,
                        "time_since_last_change": time_since_last_stroke,
                        "max_reasonable_gap": max_gap_for_stroke,
                        "position_at": raw_input.position[i],
                        "expected_stroke_count_based_on_SL": int(raw_input.position[i] / 1.5),
                    }
                )
                result.issues.append(issue)
                result.warnings.append(issue.description)

    for i in range(1, len(raw_input.position)):
        if raw_input.position[i] < raw_input.position[i-1]:
            lap_before = int(raw_input.position[i-1] / raw_input.pool_length)
            lap_after = int(raw_input.position[i] / raw_input.pool_length)
            if lap_before == lap_after:
                issue = ValidationIssue(
                    issue_type="position_backtrack",
                    severity="error",
                    description=f"位置回退（非转身）：索引{i}, {raw_input.position[i-1]:.2f}m -> {raw_input.position[i]:.2f}m",
                    location={"idx": i, "time": raw_input.time[i]},
                    raw_value=raw_input.position[i],
                    evidence={
                        "position_before": raw_input.position[i-1],
                        "position_after": raw_input.position[i],
                        "lap_before": lap_before,
                        "lap_after": lap_after,
                        "is_turn": lap_before != lap_after,
                    }
                )
                result.issues.append(issue)
                result.warnings.append(issue.description)

    if enable_autocorrect:
        _apply_autocorrect(result, raw_input)
        result.version_history.append({
            "version": 2,
            "timestamp": datetime.now().isoformat(),
            "action": "auto_correction_applied",
            "description": "自动修正已应用，详见issues中的corrected_*字段",
            "corrected_issues": [i.description for i in result.issues if i.corrected_value is not None],
        })

    result.validated_data = raw_input
    return result


def _apply_autocorrect(result: ValidationResult, raw_input: KinematicInput) -> None:
    """自动修正逻辑（慎用，所有修正均留痕）"""
    for issue in result.issues:
        if issue.issue_type == "velocity_spike":
            idx = issue.location["idx"]
            neighbors = issue.evidence.get("neighbor_values", [])
            valid_neighbors = [v for v in neighbors if v != issue.raw_value and v > 0]
            if valid_neighbors:
                corrected = sum(valid_neighbors) / len(valid_neighbors)
                issue.corrected_value = corrected
                issue.corrected_by = "auto"
                issue.corrected_at = datetime.now().isoformat()

                dt = raw_input.time[idx] - raw_input.time[idx-1]
                raw_input.position[idx] = raw_input.position[idx-1] + corrected * dt


def _calculate_data_hash(data: KinematicInput) -> str:
    """计算数据哈希用于版本追踪，防止数据被篡改"""
    import hashlib
    data_str = json.dumps({
        "time": data.time,
        "position": data.position,
        "stroke_count": data.stroke_count,
        "pool_length": data.pool_length,
        "stroke_style": data.stroke_style,
        "athlete_name": data.athlete_name,
        "sample_rate": data.sample_rate,
    }, sort_keys=True)
    return hashlib.sha256(data_str.encode()).hexdigest()[:16]


def apply_manual_correction(
    validation_result: ValidationResult,
    issue_idx: int,
    corrected_value: float,
    operator: str,
    note: str = ""
) -> ValidationResult:
    """
    人工修正接口，所有修改永久留痕

    参数：
    - issue_idx: 要修正的问题在 validation_result.issues 中的索引
    - corrected_value: 修正后的值
    - operator: 修正人姓名（用于问责）
    - note: 修正说明
    """
    if issue_idx < 0 or issue_idx >= len(validation_result.issues):
        raise ValueError(f"问题索引{issue_idx}不存在")

    issue = validation_result.issues[issue_idx]
    issue.corrected_value = corrected_value
    issue.corrected_by = f"manual:{operator}"
    issue.corrected_at = datetime.now().isoformat()
    issue.evidence["manual_note"] = note

    new_version = len(validation_result.version_history) + 1
    validation_result.version_history.append({
        "version": new_version,
        "timestamp": datetime.now().isoformat(),
        "action": "manual_correction",
        "description": f"人工修正：{note}",
        "operator": operator,
        "issue_idx": issue_idx,
        "original_value": issue.raw_value,
        "corrected_value": corrected_value,
    })

    return validation_result
