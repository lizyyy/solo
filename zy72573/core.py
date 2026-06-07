import json
import csv
import uuid
import math
from datetime import datetime
from typing import List, Dict, Optional, Tuple, Any
from pathlib import Path

from models import (
    FeatureValue, FeatureSnapshot, TrainingLogPoint, TrainingLog,
    Correction, ExplainableSummary, RunRecord, TrialRecord
)


def generate_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def now_str() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def import_feature_snapshot(file_path: str) -> FeatureSnapshot:
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"特征快照文件不存在: {file_path}")

    features: List[FeatureValue] = []
    raw_data: Dict[str, Any] = {}

    if path.suffix == '.json':
        with open(path, 'r', encoding='utf-8') as f:
            raw_data = json.load(f)
    elif path.suffix == '.csv':
        with open(path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for i, row in enumerate(reader, 1):
                raw_data[f"row_{i}"] = row
    else:
        raise ValueError(f"不支持的文件格式: {path.suffix}")

    feature_list = raw_data.get('features', raw_data)

    for idx, item in enumerate(feature_list):
        if isinstance(item, dict):
            name = item.get('name', item.get('feature', f'feature_{idx}'))
            value = item.get('value')
            is_default = item.get('is_default', item.get('default', False))
            source = item.get('source', 'unknown')
            line_no = item.get('line_no')
        else:
            name = f'feature_{idx}'
            value = item
            is_default = False
            source = 'unknown'
            line_no = None

        features.append(FeatureValue(
            name=name,
            value=float(value) if value is not None else None,
            is_default=bool(is_default),
            source=source,
            line_no=line_no
        ))

    snapshot_id = raw_data.get('snapshot_id', generate_id('snap'))

    return FeatureSnapshot(
        snapshot_id=snapshot_id,
        imported_at=now_str(),
        features=features,
        raw_data=raw_data,
        source_file=str(path.resolve())
    )


def detect_default_features(snapshot: FeatureSnapshot) -> List[FeatureValue]:
    return [f for f in snapshot.features if f.is_default]


def import_training_log(file_path: str, snapshot_id: str) -> TrainingLog:
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"训练日志文件不存在: {file_path}")

    points: List[TrainingLogPoint] = []

    with open(path, 'r', encoding='utf-8') as f:
        if path.suffix == '.json':
            data = json.load(f)
            log_points = data.get('points', data.get('logs', []))
        elif path.suffix == '.csv':
            reader = csv.DictReader(f)
            log_points = list(reader)
        else:
            raise ValueError(f"不支持的文件格式: {path.suffix}")

    for item in log_points:
        points.append(TrainingLogPoint(
            step=int(item.get('step', item.get('iteration', 0))),
            loss=float(item.get('loss', 0)),
            temperature=float(item.get('temperature', item.get('temp', 1.0))),
            accuracy=float(item.get('accuracy', item.get('acc', 0))),
            timestamp=str(item.get('timestamp', now_str()))
        ))

    return TrainingLog(
        log_id=generate_id('log'),
        snapshot_id=snapshot_id,
        imported_at=now_str(),
        points=points,
        source_file=str(path.resolve())
    )


def calculate_temperature(
    snapshot: FeatureSnapshot,
    training_log: Optional[TrainingLog] = None,
    correction: Optional[Correction] = None
) -> Tuple[float, Dict[str, Any]]:
    feature_values = {}
    for f in snapshot.features:
        val = f.value if f.value is not None else 0.0
        feature_values[f.name] = val

    if correction:
        for name, val in correction.corrections.items():
            feature_values[name] = val

    base_temp = 1.0
    count = 0

    if 'teacher_confidence' in feature_values:
        base_temp += 0.5 * feature_values['teacher_confidence']
        count += 1
    if 'student_variance' in feature_values:
        base_temp += 0.3 * (1.0 - feature_values['student_variance'])
        count += 1
    if 'label_smooth' in feature_values:
        base_temp += 0.2 * feature_values['label_smooth']
        count += 1

    if count > 0:
        base_temp = base_temp / (0.5 + 0.5 * count)

    if training_log and training_log.points:
        latest = training_log.points[-1]
        if latest.accuracy > 0.9:
            base_temp *= 0.8
        elif latest.accuracy < 0.5:
            base_temp *= 1.3

        temps = [p.temperature for p in training_log.points]
        avg_temp = sum(temps) / len(temps)
        base_temp = 0.7 * base_temp + 0.3 * avg_temp

    base_temp = max(0.1, min(10.0, base_temp))

    details = {
        "base_temperature": base_temp,
        "features_used": list(feature_values.keys()),
        "has_training_log": training_log is not None,
        "has_correction": correction is not None,
        "default_features": [f.name for f in snapshot.features if f.is_default]
    }

    return round(base_temp, 4), details


def generate_summary(
    snapshot: FeatureSnapshot,
    training_log: Optional[TrainingLog] = None,
    corrections: List[Correction] = None,
    prev_summary: Optional[ExplainableSummary] = None
) -> ExplainableSummary:
    corrections = corrections or []
    default_features = detect_default_features(snapshot)
    version = (prev_summary.version + 1) if prev_summary else 1
    has_training_log = training_log is not None
    has_correction = len(corrections) > 0

    temp_result, details = calculate_temperature(snapshot, training_log, corrections[-1] if corrections else None)

    notes = []
    missing_materials = []
    conclusion_parts = []
    next_action = ""

    if default_features:
        default_names = [f.name for f in default_features]
        notes.append(f"检测到 {len(default_features)} 个特征使用了默认值: {', '.join(default_names)}")
        notes.append("线上特征缺失但给了默认分，需推荐负责人复核，不归入正常")
        missing_materials.append("线上特征真实值（当前使用默认值）")
        conclusion_parts.append(f"特征快照导入完成，但有 {len(default_features)} 个特征使用默认值，结论暂不可直接照抄")
    else:
        conclusion_parts.append("特征快照导入完成，所有特征均有正常值")

    if not has_training_log:
        missing_materials.append("训练日志曲线")
        notes.append("训练日志尚未补录，温度计算仅基于特征快照")
        conclusion_parts.append("训练日志待补录")
        next_action = "请推荐策略老唐补看训练日志曲线后重新生成摘要"
    else:
        notes.append(f"训练日志已补录，共 {len(training_log.points)} 个记录点")
        if training_log.points:
            latest = training_log.points[-1]
            notes.append(f"最新训练步: step={latest.step}, acc={latest.accuracy:.4f}, temp={latest.temperature:.4f}")
        conclusion_parts.append("训练日志已补录，温度计算已结合训练曲线")

    if has_correction:
        latest_corr = corrections[-1]
        notes.append(f"已进行人工修正（由 {latest_corr.corrected_by}）: {latest_corr.reason}")
        conclusion_parts.append("已应用人工修正")

    if not default_features and has_training_log:
        confidence = "high"
        if has_correction:
            conclusion_parts.append(f"推荐蒸馏温度: {temp_result}")
            next_action = "结果可交付，如需调整请重跑"
        else:
            conclusion_parts.append(f"初步推荐蒸馏温度: {temp_result}，建议推荐策略老唐复核后确认")
            next_action = "请推荐策略老唐复核温度值，必要时进行人工修正"
    elif default_features and not has_training_log:
        confidence = "low"
        next_action = "请先找推荐负责人复核缺失特征，同时找推荐策略老唐补训练日志"
    elif default_features:
        confidence = "medium"
        next_action = "请先找推荐负责人复核缺失特征，再由推荐策略老唐最终确认"
    else:
        confidence = "medium"
        next_action = "请推荐策略老唐补看训练日志曲线后确认"

    if prev_summary:
        notes.append(f"摘要版本更新: v{prev_summary.version} -> v{version}")

    return ExplainableSummary(
        summary_id=generate_id('sum'),
        snapshot_id=snapshot.snapshot_id,
        generated_at=now_str(),
        version=version,
        has_training_log=has_training_log,
        has_correction=has_correction,
        default_features=[f.name for f in default_features],
        conclusion="；".join(conclusion_parts),
        next_action=next_action,
        reviewer=None,
        temperature_result=temp_result,
        confidence=confidence,
        missing_materials=missing_materials,
        notes=notes
    )


def apply_correction(
    snapshot: FeatureSnapshot,
    corrections: Dict[str, float],
    corrected_by: str,
    reason: str
) -> Correction:
    return Correction(
        correction_id=generate_id('corr'),
        snapshot_id=snapshot.snapshot_id,
        corrected_by=corrected_by,
        corrected_at=now_str(),
        corrections=corrections,
        reason=reason
    )


def create_run(
    snapshot: FeatureSnapshot,
    run_type: str,
    parameters: Dict[str, Any],
    temperature: Optional[float] = None
) -> RunRecord:
    return RunRecord(
        run_id=generate_id('run'),
        snapshot_id=snapshot.snapshot_id,
        run_at=now_str(),
        run_type=run_type,
        temperature=temperature,
        parameters=parameters,
        status="completed"
    )


def create_trial() -> TrialRecord:
    return TrialRecord(
        trial_id=generate_id('trial'),
        created_at=now_str(),
        status="initial"
    )


def load_trial(file_path: str) -> TrialRecord:
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    trial = TrialRecord(
        trial_id=data['trial_id'],
        created_at=data['created_at'],
        status=data['status']
    )

    if data.get('snapshot'):
        snap = data['snapshot']
        trial.snapshot = FeatureSnapshot(
            snapshot_id=snap['snapshot_id'],
            imported_at=snap['imported_at'],
            features=[FeatureValue(**f) for f in snap['features']],
            raw_data=snap['raw_data'],
            source_file=snap.get('source_file')
        )

    if data.get('training_log'):
        log = data['training_log']
        trial.training_log = TrainingLog(
            log_id=log['log_id'],
            snapshot_id=log['snapshot_id'],
            imported_at=log['imported_at'],
            points=[TrainingLogPoint(**p) for p in log['points']],
            source_file=log.get('source_file')
        )

    trial.corrections = [Correction(**c) for c in data.get('corrections', [])]
    trial.summaries = [ExplainableSummary(**s) for s in data.get('summaries', [])]
    trial.runs = [RunRecord(**r) for r in data.get('runs', [])]

    return trial
