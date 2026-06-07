import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, field
from enum import Enum
import math


def _safe_str(value) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and math.isnan(value):
        return ""
    result = str(value).strip()
    if result.lower() in ["nan", "none", "null"]:
        return ""
    return result


def _safe_bool(value) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    str_val = str(value).strip().lower()
    return str_val in ["true", "1", "yes", "是", "y", "t"]


class RecordStatus(Enum):
    SMOOTH = "顺利通过"
    NEED_CONFIRM = "需人工确认"
    FROM_HISTORY = "历史口径补全"
    OUT_OF_BOUND = "样本越界"
    CONFLICT = "参数冲突待裁决"


class ConfidenceLevel(Enum):
    HIGH = "高"
    MEDIUM = "中"
    LOW = "低"


@dataclass
class ThresholdRecord:
    metric_name: str
    current_threshold: float
    historical_threshold: Optional[float] = None
    manual_adjusted: bool = False
    ml_calibration_note: str = ""
    sample_data: List[float] = field(default_factory=list)
    status: RecordStatus = RecordStatus.SMOOTH
    confidence: ConfidenceLevel = ConfidenceLevel.HIGH
    suggested_threshold: Optional[float] = None
    suggestion_reason: str = ""
    warning_messages: List[str] = field(default_factory=list)
    evidence: Dict = field(default_factory=dict)
    last_updated: str = ""


class CalibrationEngine:
    def __init__(self):
        self.records: Dict[str, ThresholdRecord] = {}
        self.param_table_notes: Dict[str, str] = {}

    def load_parameter_table(self, param_df: pd.DataFrame) -> None:
        for _, row in param_df.iterrows():
            metric_name = _safe_str(row.get('指标名称', row.get('metric_name', '')))
            if not metric_name:
                continue

            record = ThresholdRecord(
                metric_name=metric_name,
                current_threshold=float(row.get('当前阈值', row.get('current_threshold', 0))),
                ml_calibration_note=_safe_str(row.get('机器学习阈值校准', row.get('ml_note', ''))),
                manual_adjusted=_safe_bool(row.get('人工调整过', row.get('manual_adjusted', False))),
                last_updated=_safe_str(row.get('最后更新时间', row.get('last_updated', '')))
            )

            if record.ml_calibration_note:
                self.param_table_notes[metric_name] = record.ml_calibration_note

            self.records[metric_name] = record

    def load_historical_records(self, hist_df: pd.DataFrame) -> None:
        for _, row in hist_df.iterrows():
            metric_name = _safe_str(row.get('指标名称', row.get('metric_name', '')))
            if metric_name in self.records:
                record = self.records[metric_name]
                record.historical_threshold = float(row.get('历史阈值', row.get('historical_threshold', record.current_threshold)))

                hist_note = _safe_str(row.get('机器学习阈值校准备注', ''))
                if hist_note and not record.ml_calibration_note:
                    record.ml_calibration_note = hist_note
                    record.status = RecordStatus.FROM_HISTORY
                    record.suggestion_reason = "从历史口径补全，参数表中无对应记录，沿用历史校准结果"

    def load_manual_notes(self, notes_df: pd.DataFrame) -> None:
        for _, row in notes_df.iterrows():
            metric_name = _safe_str(row.get('指标名称', row.get('metric_name', '')))
            if metric_name in self.records:
                record = self.records[metric_name]
                manual_note = _safe_str(row.get('人工备注', row.get('manual_note', '')))
                if manual_note:
                    if record.ml_calibration_note:
                        record.ml_calibration_note = f"{record.ml_calibration_note} | [人工]{manual_note}"
                    else:
                        record.ml_calibration_note = f"[人工]{manual_note}"
                    record.manual_adjusted = True

    def load_sample_data(self, sample_df: pd.DataFrame) -> None:
        for _, row in sample_df.iterrows():
            metric_name = _safe_str(row.get('指标名称', row.get('metric_name', '')))
            if metric_name in self.records:
                record = self.records[metric_name]
                sample_value = float(row.get('样本值', row.get('sample_value', 0)))
                record.sample_data.append(sample_value)
                self._check_out_of_bound(record, sample_value)

    def _check_out_of_bound(self, record: ThresholdRecord, sample_value: float) -> None:
        if sample_value > record.current_threshold * 1.5:
            record.status = RecordStatus.OUT_OF_BOUND
            record.warning_messages.append(
                f"样本值 {sample_value} 超出当前阈值 {record.current_threshold} 的150%"
            )
            record.confidence = ConfidenceLevel.LOW
        elif sample_value > record.current_threshold:
            if record.status == RecordStatus.SMOOTH:
                record.status = RecordStatus.NEED_CONFIRM
            record.warning_messages.append(
                f"样本值 {sample_value} 高于当前阈值 {record.current_threshold}"
            )
            record.confidence = ConfidenceLevel.MEDIUM

    def detect_conflicts(self, import_df: pd.DataFrame) -> List[Dict]:
        conflicts = []
        for _, row in import_df.iterrows():
            metric_name = _safe_str(row.get('指标名称', row.get('metric_name', '')))
            if metric_name in self.records:
                record = self.records[metric_name]
                imported_threshold = float(row.get('阈值', row.get('threshold', 0)))

                if abs(imported_threshold - record.current_threshold) > 0.01:
                    conflict = {
                        'metric_name': metric_name,
                        'param_table_threshold': record.current_threshold,
                        'imported_threshold': imported_threshold,
                        'difference': abs(imported_threshold - record.current_threshold),
                        'param_table_note': record.ml_calibration_note,
                        'suggested_action': '请核对两边数据来源，确认哪个是正确口径后手动调整',
                        'evidence': {
                            '参数表来源': f'阈值={record.current_threshold}, 备注={record.ml_calibration_note}',
                            '导入数据来源': f'阈值={imported_threshold}'
                        }
                    }
                    conflicts.append(conflict)
                    record.status = RecordStatus.CONFLICT
                    record.evidence = conflict['evidence']
                    record.warning_messages.append('参数表与导入数据阈值冲突，请人工裁决')

        return conflicts

    def generate_suggestions(self) -> None:
        for metric_name, record in self.records.items():
            if record.manual_adjusted:
                record.suggested_threshold = record.current_threshold
                record.suggestion_reason = "该指标之前人工调整过，为避免覆盖您的校准成果，本次保持原值。如需要重新计算，请先在参数表中移除'人工调整过'标记。"
                continue

            if record.status == RecordStatus.CONFLICT:
                record.suggested_threshold = None
                record.suggestion_reason = "存在参数冲突，需要您先确认哪边数据准确。建议：1) 核对两边数据来源；2) 确认业务口径是否变化；3) 在参数表中更新最终值。"
                continue

            if record.status == RecordStatus.FROM_HISTORY:
                record.suggested_threshold = record.historical_threshold
                continue

            self._calculate_suggestion(record)

    def _calculate_suggestion(self, record: ThresholdRecord) -> None:
        if not record.sample_data:
            if record.historical_threshold:
                p95_threshold = record.historical_threshold * 1.05
                record.suggested_threshold = round(p95_threshold, 2)
                record.suggestion_reason = f"无新样本数据，基于历史阈值 {record.historical_threshold} 上浮5%，建议设为 {record.suggested_threshold}。理由：定期小幅上浮可减少误报。"
            else:
                record.suggested_threshold = record.current_threshold
                record.suggestion_reason = "无样本数据也无历史记录，保持当前阈值。建议：积累更多样本后再校准。"
            return

        samples = np.array(record.sample_data)
        p95 = np.percentile(samples, 95)
        p99 = np.percentile(samples, 99)
        mean_val = np.mean(samples)

        if record.status == RecordStatus.OUT_OF_BOUND:
            suggested = max(p99, record.current_threshold * 1.2)
            record.suggested_threshold = round(suggested, 2)
            record.suggestion_reason = (
                f"检测到越界样本，按99分位+阈值上浮20%的保守策略建议。"
                f"计算依据：样本P99={p99:.2f}, 当前阈值×1.2={record.current_threshold*1.2:.2f}, "
                f"取较大值。如果觉得太松，可以改为P95={p95:.2f}。"
            )
            record.evidence = {
                '样本数量': len(samples),
                '样本均值': round(mean_val, 2),
                'P95分位': round(p95, 2),
                'P99分位': round(p99, 2),
                '越界样本数': sum(1 for s in samples if s > record.current_threshold)
            }
        elif record.status == RecordStatus.NEED_CONFIRM:
            suggested = p95
            record.suggested_threshold = round(suggested, 2)
            record.suggestion_reason = (
                f"有样本超出阈值但不严重，建议按样本P95分位校准。"
                f"计算依据：样本P95={p95:.2f}，这个值能覆盖95%的正常情况。"
                f"如果业务上希望更严格，可以保持当前阈值 {record.current_threshold}。"
            )
            record.evidence = {
                '样本数量': len(samples),
                '样本均值': round(mean_val, 2),
                'P95分位': round(p95, 2),
                '超出阈值样本数': sum(1 for s in samples if s > record.current_threshold)
            }
        else:
            suggested = max(p95, record.current_threshold * 0.95)
            record.suggested_threshold = round(suggested, 2)
            record.suggestion_reason = (
                f"样本分布正常，建议按P95分位校准但不低于当前阈值的95%。"
                f"计算依据：样本P95={p95:.2f}, 当前阈值×0.95={record.current_threshold*0.95:.2f}。"
                f"这样既利用了新数据，又不会让阈值降太低。"
            )
            record.evidence = {
                '样本数量': len(samples),
                '样本均值': round(mean_val, 2),
                'P95分位': round(p95, 2),
                'P99分位': round(p99, 2)
            }

    def get_results_dataframe(self) -> pd.DataFrame:
        rows = []
        for metric_name, record in self.records.items():
            row = {
                '指标名称': record.metric_name,
                '当前阈值': record.current_threshold,
                '建议阈值': record.suggested_threshold,
                '状态': record.status.value,
                '置信度': record.confidence.value,
                '是否人工调整过': '是' if record.manual_adjusted else '否',
                '机器学习阈值校准': record.ml_calibration_note,
                '校准建议理由': record.suggestion_reason,
                '警告信息': '; '.join(record.warning_messages) if record.warning_messages else '',
                '证据数据': str(record.evidence) if record.evidence else '',
                '历史阈值': record.historical_threshold,
                '最后更新': record.last_updated or datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            }
            rows.append(row)
        return pd.DataFrame(rows)

    def get_anomalies_list(self) -> pd.DataFrame:
        anomaly_records = [
            record for record in self.records.values()
            if record.status in [RecordStatus.NEED_CONFIRM, RecordStatus.OUT_OF_BOUND, RecordStatus.CONFLICT]
        ]
        rows = []
        for record in anomaly_records:
            row = {
                '指标名称': record.metric_name,
                '异常类型': record.status.value,
                '当前阈值': record.current_threshold,
                '建议阈值': record.suggested_threshold,
                '警告内容': '; '.join(record.warning_messages),
                '建议操作': self._get_action_suggestion(record),
                '证据链接': '详见结果表中的证据数据列'
            }
            rows.append(row)
        return pd.DataFrame(rows)

    def _get_action_suggestion(self, record: ThresholdRecord) -> str:
        if record.status == RecordStatus.CONFLICT:
            return "1. 核对参数表和导入数据的来源；2. 确认业务口径；3. 在参数表中更新最终值"
        elif record.status == RecordStatus.OUT_OF_BOUND:
            return "1. 检查越界样本是否为异常值；2. 如属正常情况，可采纳建议阈值；3. 如为异常，保持原阈值并标记样本"
        elif record.status == RecordStatus.NEED_CONFIRM:
            return "1. 查看样本分布；2. 根据业务容忍度选择阈值；3. 在参数表中确认并标记人工调整"
        else:
            return "无需特殊操作"
