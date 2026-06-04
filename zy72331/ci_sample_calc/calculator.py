"""置信区间样本量计算核心逻辑"""

import math
import uuid
from typing import List, Tuple, Optional

from .models import (
    SampleRecord,
    RecordStatus,
    WeightTable,
    WeightRule,
    CounterExample,
    DataSource,
)


def calculate_confidence_interval(
    sample_size: int,
    pass_count: int,
    confidence_level: float = 0.95,
) -> Tuple[float, float, float]:
    """
    计算二项分布的置信区间（Wilson 分数区间）
    返回: (下限, 上限, 通过率)
    """
    if sample_size <= 0:
        return 0.0, 0.0, 0.0

    p_hat = pass_count / sample_size
    z = _get_z_score(confidence_level)

    denominator = 1 + z ** 2 / sample_size
    center = (p_hat + z ** 2 / (2 * sample_size)) / denominator
    margin = z * math.sqrt(
        (p_hat * (1 - p_hat) + z ** 2 / (4 * sample_size)) / sample_size
    ) / denominator

    lower = max(0.0, center - margin)
    upper = min(1.0, center + margin)

    return lower, upper, p_hat


def _get_z_score(confidence_level: float) -> float:
    """获取标准正态分布的 z 分数"""
    z_scores = {
        0.90: 1.645,
        0.95: 1.96,
        0.99: 2.576,
    }
    return z_scores.get(confidence_level, 1.96)


def calculate_weighted_score(
    pass_rate: float,
    weight_rule: Optional[WeightRule],
) -> Tuple[float, float]:
    """
    根据评分权重表计算加权分数
    返回: (权重, 加权分数)
    """
    if weight_rule is None:
        return 0.0, pass_rate * 100

    weight = weight_rule.weight
    weighted_score = pass_rate * 100 * weight
    return weight, weighted_score


def evaluate_record_status(
    record: SampleRecord,
    weight_rule: Optional[WeightRule],
    tolerance: float = 1e-9,
) -> RecordStatus:
    """
    评估记录状态，重点处理边界值刚好等于阈值的情况

    关键逻辑：
    - 如果置信区间下限刚好等于阈值，标记为 NEED_REVIEW，留给任课老师复核
    - 不自动归为正常
    """
    if weight_rule is None:
        return RecordStatus.ABNORMAL

    threshold = weight_rule.threshold
    ci_lower = record.ci_lower

    if abs(ci_lower - threshold) < tolerance:
        record.mark_boundary(
            f"置信区间下限 {ci_lower:.6f} 刚好等于阈值 {threshold:.6f}，待任课老师复核"
        )
        return RecordStatus.NEED_REVIEW

    if ci_lower > threshold:
        return RecordStatus.NORMAL
    elif ci_lower < threshold:
        return RecordStatus.ABNORMAL
    else:
        return RecordStatus.BOUNDARY


def process_single_record(
    record: SampleRecord,
    weight_table: WeightTable,
    confidence_level: float = 0.95,
) -> SampleRecord:
    """处理单条样本记录"""
    ci_lower, ci_upper, pass_rate = calculate_confidence_interval(
        record.sample_size, record.pass_count, confidence_level
    )

    record.ci_lower = ci_lower
    record.ci_upper = ci_upper
    record.pass_rate = pass_rate

    weight_rule = weight_table.find_rule(record.score)
    weight, _ = calculate_weighted_score(pass_rate, weight_rule)
    record.weight = weight

    status = evaluate_record_status(record, weight_rule)

    # 状态优先级：边界标记 > 重跑标记 > 常规评估
    if record.boundary_equal_to_threshold:
        pass
    elif record.status == RecordStatus.RERUN:
        pass
    else:
        record.status = status

    record.updated_at = record.updated_at or record.created_at
    return record


def process_records(
    records: List[SampleRecord],
    weight_table: WeightTable,
    confidence_level: float = 0.95,
) -> List[SampleRecord]:
    """批量处理样本记录"""
    return [
        process_single_record(record, weight_table, confidence_level)
        for record in records
    ]


def generate_counter_example(
    record: SampleRecord,
    issue_type: str,
    description: str,
    evidence: str = "",
) -> CounterExample:
    """生成反例记录"""
    return CounterExample(
        case_id=f"CE-{uuid.uuid4().hex[:8]}",
        record_id=record.record_id,
        course_name=record.course_name,
        issue_type=issue_type,
        description=description,
        formula_version=record.formula_version,
        evidence=evidence,
    )


def rerun_record(
    record: SampleRecord,
    weight_table: WeightTable,
    operator: str,
    note: str = "",
    confidence_level: float = 0.95,
) -> SampleRecord:
    """重跑单条记录"""
    record.fix_history.append({
        "before": record.status.value,
        "action": "rerun",
        "operator": operator,
        "note": note,
        "timestamp": record.updated_at.isoformat(),
    })

    record.boundary_equal_to_threshold = False
    record.formula_version = "v2"
    record.status = RecordStatus.RERUN

    return process_single_record(record, weight_table, confidence_level)
