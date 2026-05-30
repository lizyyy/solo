from __future__ import annotations

import math
from typing import List, Optional

from .models import (
    AnomalyExplanation,
    DeviationResult,
    ToneZone,
    TuningRecord,
    freq_to_cents,
)


LARGE_DEVIATION_THRESHOLD = 15.0
EXTREME_DEVIATION_THRESHOLD = 50.0
FREQ_OUT_OF_RANGE_LOW = 20.0
FREQ_OUT_OF_RANGE_HIGH = 8000.0
PHYSICAL_FREQ_LIMITS: dict = {
    "LOW_BASS": (27.5, 124.0),
    "BASS": (124.0, 247.0),
    "MID_LOW": (131.0, 494.0),
    "MID_HIGH": (262.0, 988.0),
    "TREBLE": (523.0, 1976.0),
    "HIGH_TREBLE": (1047.0, 4186.0),
}


def detect_anomalies(records: List[TuningRecord], deviations: List[DeviationResult]) -> List[AnomalyExplanation]:
    explanations: List[AnomalyExplanation] = []
    dev_map = {d.canonical: d for d in deviations}

    for rec in records:
        if rec.note_parsed is None:
            explanations.append(AnomalyExplanation(
                record_key=rec.primary_key,
                anomaly_type="无法解析音名",
                detail=f"原始音名 '{rec.note_raw}' 无法解析为标准音名",
                suggestion="请检查音名格式是否正确，常见错误: 'Cb5'→'B4', 'E#4'→'F4', 'B#3'→'C4'。"
                           "支持格式: C4, C#4, Db4, Csharp4 等。",
            ))
            continue

        dev = dev_map.get(rec.note_parsed.canonical)

        explanations.extend(_check_missing_data(rec, dev))
        explanations.extend(_check_deviation_magnitude(rec, dev))
        explanations.extend(_check_freq_range(rec, dev))
        explanations.extend(_check_unit_consistency(rec, dev))
        explanations.extend(_check_environment(rec))

    explanations.extend(_check_cross_record_anomalies(records, deviations))

    return explanations


def _check_missing_data(rec: TuningRecord, dev: Optional[DeviationResult]) -> List[AnomalyExplanation]:
    results: List[AnomalyExplanation] = []
    key = rec.primary_key

    if rec.measured_freq is None and rec.deviation_cents is None:
        results.append(AnomalyExplanation(
            record_key=key,
            anomaly_type="缺少测量数据",
            detail=f"音名 {rec.note_raw} 既无实测频率也无频偏值",
            suggestion="请补充实测频率(Hz)或频偏值(音分)。若该键未测量，建议在备注中说明原因"
                       "（如: 键故障、客户要求跳过等）。",
        ))

    if rec.measured_freq is not None and rec.deviation_cents is None and dev is not None:
        if dev.deviation_cents is not None:
            pass
        elif rec.note_parsed and rec.measured_freq > 0:
            computed = freq_to_cents(rec.measured_freq, rec.note_parsed.standard_freq)
            results.append(AnomalyExplanation(
                record_key=key,
                anomaly_type="频偏自动计算",
                detail=f"音名 {rec.note_raw} 有实测频率但无频偏，已自动计算为 {computed:.1f} 音分",
                suggestion="无需操作，工具已自动从实测频率和标准频率计算频偏。"
                           "如需手写频偏，请同时提供实测频率以确保一致性。",
            ))

    if rec.measured_freq is not None and rec.deviation_cents is not None and dev is not None:
        if rec.note_parsed and rec.measured_freq > 0:
            computed = freq_to_cents(rec.measured_freq, rec.note_parsed.standard_freq)
            diff = abs(computed - rec.deviation_cents)
            if diff > 1.0:
                results.append(AnomalyExplanation(
                    record_key=key,
                    anomaly_type="频偏与频率不一致",
                    detail=f"音名 {rec.note_raw}: 实测频率算出的频偏为 {computed:.1f} 音分，"
                           f"但记录中的频偏为 {rec.deviation_cents:.1f} 音分，差异 {diff:.1f} 音分",
                    suggestion="实测频率和频偏值矛盾。请核实: 1)频率单位是否正确(不是kHz误写Hz)；"
                               "2)频偏是否误写了Hz值而非音分；3)是否使用了非标准音高(如A4=442Hz)。",
                ))

    return results


def _check_deviation_magnitude(rec: TuningRecord, dev: Optional[DeviationResult]) -> List[AnomalyExplanation]:
    results: List[AnomalyExplanation] = []
    if dev is None or dev.deviation_cents is None:
        return results

    cents = dev.deviation_cents
    key = rec.primary_key
    note = rec.note_raw

    if abs(cents) > EXTREME_DEVIATION_THRESHOLD:
        results.append(AnomalyExplanation(
            record_key=key,
            anomaly_type="极端频偏",
            detail=f"音名 {note} 频偏 {cents:.1f} 音分，超出极值阈值 ±{EXTREME_DEVIATION_THRESHOLD} 音分",
            suggestion=f"这通常不是正常调律偏差。请检查: 1)频率单位是否错误(如kHz当成Hz，或Hz当成cents)；"
                       f"2)音名八度是否写错(如A5写成A4会导致约1200音分偏差)；"
                       f"3)该键是否存在机械故障(弦轴松动、断弦等)，如有请在备注中说明。",
        ))
    elif abs(cents) > LARGE_DEVIATION_THRESHOLD:
        results.append(AnomalyExplanation(
            record_key=key,
            anomaly_type="较大频偏",
            detail=f"音名 {note} 频偏 {cents:.1f} 音分，超出阈值 ±{LARGE_DEVIATION_THRESHOLD} 音分",
            suggestion=f"此偏差虽大但仍在可能范围内。低音区弦长变化大、高音区弦短易偏移属正常现象。"
                       f"如该键需要特别关注，建议在备注中标注，调律时优先处理。",
        ))

    return results


def _check_freq_range(rec: TuningRecord, dev: Optional[DeviationResult]) -> List[AnomalyExplanation]:
    results: List[AnomalyExplanation] = []
    if rec.measured_freq is None or rec.note_parsed is None:
        return results

    freq = rec.measured_freq
    key = rec.primary_key
    note = rec.note_raw

    if freq < FREQ_OUT_OF_RANGE_LOW or freq > FREQ_OUT_OF_RANGE_HIGH:
        results.append(AnomalyExplanation(
            record_key=key,
            anomaly_type="频率超出钢琴范围",
            detail=f"音名 {note} 实测频率 {freq} Hz 超出钢琴频率范围 ({FREQ_OUT_OF_RANGE_LOW}-{FREQ_OUT_OF_RANGE_HIGH} Hz)",
            suggestion="请检查: 1)频率单位是否为kHz误当成Hz(如 0.262 kHz = 262 Hz)；"
                       "2)数值是否多写或少写了小数点；3)是否误将音分值填入了频率列。",
        ))
        return results

    zone_name = rec.note_parsed.tone_zone.name
    if zone_name in PHYSICAL_FREQ_LIMITS:
        low, high = PHYSICAL_FREQ_LIMITS[zone_name]
        if freq < low * 0.8 or freq > high * 1.2:
            results.append(AnomalyExplanation(
                record_key=key,
                anomaly_type="频率与音区不匹配",
                detail=f"音名 {note} 属于 {rec.note_parsed.tone_zone.value}，"
                       f"实测频率 {freq:.1f} Hz 不在正常范围 ({low:.0f}-{high:.0f} Hz) 内",
                suggestion="请检查: 1)音名和八度是否写错(如C4写成C3频率会差一倍)；"
                           "2)频率列是否混入了其他音名的数据；3)等音名是否映射正确(如Db4应为C#4)。",
            ))

    return results


def _check_unit_consistency(rec: TuningRecord, dev: Optional[DeviationResult]) -> List[AnomalyExplanation]:
    results: List[AnomalyExplanation] = []
    key = rec.primary_key

    if rec.measured_freq is not None and rec.measured_freq < 1.0 and rec.measured_freq > 0:
        results.append(AnomalyExplanation(
            record_key=key,
            anomaly_type="疑似单位错误",
            detail=f"音名 {rec.note_raw} 实测频率为 {rec.measured_freq} Hz，疑似为 kHz 值",
            suggestion=f"钢琴最低音A0约27.5Hz。当前值 {rec.measured_freq} 过低，"
                       f"若实际为kHz，则应为 {rec.measured_freq * 1000:.1f} Hz。请确认单位。",
        ))

    if rec.deviation_cents is not None and abs(rec.deviation_cents) > 200:
        if rec.deviation_cents > 500:
            results.append(AnomalyExplanation(
                record_key=key,
                anomaly_type="疑似Hz值误填为音分",
                detail=f"音名 {rec.note_raw} 频偏值为 {rec.deviation_cents}，疑似将Hz偏差填入了音分列",
                suggestion="音分值通常在±50以内。若此值实际为Hz偏差，请将列标题改为'频偏(Hz)'"
                           "或换算为音分（工具可自动计算）。",
            ))

    if rec.measured_freq is not None and rec.note_parsed is not None:
        standard = rec.note_parsed.standard_freq
        if standard > 0 and rec.measured_freq > standard * 3:
            results.append(AnomalyExplanation(
                record_key=key,
                anomaly_type="疑似频率倍频错误",
                detail=f"音名 {rec.note_raw} 标准频率 {standard:.1f} Hz，实测 {rec.measured_freq:.1f} Hz，"
                       f"比值约 {rec.measured_freq / standard:.1f} 倍",
                suggestion="实测频率约为标准频率的整数倍，可能是: 1)八度写低了一度；"
                           "2)测量时拾取到了泛音而非基频；3)频率计设置了错误的倍频。",
            ))

    return results


def _check_environment(rec: TuningRecord) -> List[AnomalyExplanation]:
    results: List[AnomalyExplanation] = []

    if rec.room_temp is not None:
        if rec.room_temp < 10 or rec.room_temp > 40:
            results.append(AnomalyExplanation(
                record_key=rec.primary_key,
                anomaly_type="室温异常",
                detail=f"室温 {rec.room_temp}°C 不在常见范围 (10-40°C)",
                suggestion="极端温度会影响音板张力和弦的振动频率。"
                           "若数据正确，请注意温度对频偏的影响，调律时需特别标注。",
            ))

    if rec.room_humidity is not None:
        if rec.room_humidity < 20 or rec.room_humidity > 90:
            results.append(AnomalyExplanation(
                record_key=rec.primary_key,
                anomaly_type="湿度异常",
                detail=f"相对湿度 {rec.room_humidity}% 不在常见范围 (20-90%)",
                suggestion="极端湿度会影响音板的含水率和弦的张力。"
                           "若数据正确，建议在备注中说明环境条件，以便后续对比分析。",
            ))

    return results


def _check_cross_record_anomalies(
    records: List[TuningRecord],
    deviations: List[DeviationResult],
) -> List[AnomalyExplanation]:
    results: List[AnomalyExplanation] = []

    note_counts: dict = {}
    for rec in records:
        if rec.note_parsed:
            canonical = rec.note_parsed.canonical
            note_counts[canonical] = note_counts.get(canonical, 0) + 1

    for canonical, count in note_counts.items():
        if count > 2:
            results.append(AnomalyExplanation(
                record_key=canonical,
                anomaly_type="重复音名记录",
                detail=f"音名 {canonical} 在同一批数据中出现 {count} 次",
                suggestion="同一音名出现多次可能是: 1)同一次调律前后都测了(正常，请确认'阶段'列填写正确)；"
                           "2)不同日期的数据混在一起(请确认'日期'列填写正确)；"
                           "3)误重复录入(请删除多余行或使用 --conflict=skip 跳过重复)。",
            ))

    zone_devs: dict = {}
    for d in deviations:
        zone = d.tone_zone
        if zone not in zone_devs:
            zone_devs[zone] = []
        if d.deviation_cents is not None:
            zone_devs[zone].append(d.deviation_cents)

    for zone, cents_list in zone_devs.items():
        if len(cents_list) < 3:
            continue
        avg = sum(cents_list) / len(cents_list)
        variance = sum((c - avg) ** 2 for c in cents_list) / len(cents_list)
        std = math.sqrt(variance)
        if std > 10:
            results.append(AnomalyExplanation(
                record_key=zone.value,
                anomaly_type="音区内频偏离散度过大",
                detail=f"{zone.value} 内频偏标准差 {std:.1f} 音分，说明该区域极不稳定",
                suggestion="此音区内不同键的频偏差异非常大，可能原因: 1)该音区弦轴普遍松动；"
                           "2)音板变形导致张力不均；3)温湿度变化剧烈。"
                           "建议: 调律时优先处理此音区，调律后短期内复查。",
            ))

    return results


def explain_all(explanations: List[AnomalyExplanation]) -> str:
    if not explanations:
        return "未发现异常数据，所有记录均在正常范围内。"

    lines = [f"共发现 {len(explanations)} 项需要注意的问题:\n"]

    type_groups: dict = {}
    for exp in explanations:
        type_groups.setdefault(exp.anomaly_type, []).append(exp)

    for atype, exps in type_groups.items():
        lines.append(f"【{atype}】({len(exps)} 项)")
        for exp in exps[:5]:
            lines.append(f"  - {exp.record_key}: {exp.detail}")
            lines.append(f"    → 建议: {exp.suggestion}")
        if len(exps) > 5:
            lines.append(f"  ... 还有 {len(exps) - 5} 项同类问题")
        lines.append("")

    return "\n".join(lines)
