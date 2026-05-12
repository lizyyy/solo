from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Optional
from collections import defaultdict

from .models import (
    ProjectState,
    RuleViolation,
    SampleStatus,
    ResponsibilitySegment,
    TemperatureRecord,
    TemperatureUnit,
    HandoverRecord,
    Sample,
    Box,
)


class RuleEngine:
    @staticmethod
    def celsius_to_fahrenheit(c: float) -> float:
        return c * 9 / 5 + 32

    @staticmethod
    def fahrenheit_to_celsius(f: float) -> float:
        return (f - 32) * 5 / 9

    @staticmethod
    def normalize_temperature(temp: TemperatureRecord) -> float:
        if temp.unit == TemperatureUnit.FAHRENHEIT:
            return RuleEngine.fahrenheit_to_celsius(temp.temperature)
        return temp.temperature

    @staticmethod
    def check_duplicate_temperature_files(records: List[TemperatureRecord]) -> Tuple[List[RuleViolation], List[TemperatureRecord]]:
        violations = []
        seen = {}
        deduplicated = []
        duplicates = defaultdict(list)

        for record in records:
            key = (record.box_id, record.timestamp, record.temperature)
            duplicates[key].append(record)

        for key, recs in duplicates.items():
            if len(recs) > 1:
                source_files = [r.source_file for r in recs if r.source_file]
                unique_files = list(set(source_files))
                if len(unique_files) > 1:
                    violations.append(
                        RuleViolation(
                            rule_name="重复温度文件",
                            severity="info",
                            description=f"发现重复温度记录（箱号: {key[0]}, 时间: {key[1]}），来源文件: {', '.join(unique_files)}，已自动合并",
                            affected_items=[f"{key[0]}@{key[1]}"],
                            suggestion="系统已自动保留第一条记录，如需人工确认请检查原始文件",
                        )
                    )
                deduplicated.append(recs[0])
            else:
                deduplicated.append(recs[0])

        return violations, deduplicated

    @staticmethod
    def check_temperature_unit_mix(records: List[TemperatureRecord]) -> List[RuleViolation]:
        violations = []
        units = set()
        for r in records:
            units.add(r.unit)

        if len(units) > 1:
            violations.append(
                RuleViolation(
                    rule_name="温度单位混用",
                    severity="warning",
                    description=f"检测到温度单位混用: {', '.join(units)}",
                    affected_items=[f"{r.box_id}" for r in records[:5]],
                    suggestion="系统已自动统一转换为摄氏度，建议确认原始数据单位是否正确",
                )
            )

        return violations

    @staticmethod
    def check_handover_signatures(records: List[HandoverRecord]) -> List[RuleViolation]:
        violations = []
        unsigned = [r for r in records if not r.signed]

        for record in unsigned:
            violations.append(
                RuleViolation(
                    rule_name="交接人缺签",
                    severity="critical",
                    description=f"交接记录缺签：箱号 {record.box_id}，交接人 {record.from_person} -> {record.to_person}，时间 {record.handover_time}",
                    affected_items=[f"{record.box_id}"],
                    suggestion="请补充交接签字记录，或标记为特殊情况并注明原因",
                )
            )

        return violations

    @staticmethod
    def check_box_sample_matching(samples: Dict[str, Sample], boxes: Dict[str, Box]) -> List[RuleViolation]:
        violations = []
        box_samples = defaultdict(list)

        for sample_id, sample in samples.items():
            box_samples[sample.box_id].append(sample_id)

        for box_id, sample_list in box_samples.items():
            if box_id not in boxes:
                violations.append(
                    RuleViolation(
                        rule_name="箱号不匹配",
                        severity="critical",
                        description=f"样本 {', '.join(sample_list)} 关联的箱号 {box_id} 不存在于箱号清单中",
                        affected_items=sample_list,
                        suggestion="请检查样本清单中的箱号是否正确",
                    )
                )

        for box_id in boxes:
            if box_id not in box_samples:
                violations.append(
                    RuleViolation(
                        rule_name="箱号无样本",
                        severity="info",
                        description=f"箱号 {box_id} 没有关联任何样本",
                        affected_items=[box_id],
                        suggestion="请确认该箱是否为空箱或样本清单是否完整",
                    )
                )

        return violations

    @staticmethod
    def check_temperature_coverage(
        records: List[TemperatureRecord],
        samples: Dict[str, Sample],
        boxes: Dict[str, Box],
        max_gap_minutes: int = 60,
    ) -> List[RuleViolation]:
        violations = []
        box_records: Dict[str, List[TemperatureRecord]] = defaultdict(list)

        for r in records:
            box_records[r.box_id].append(r)

        for box_id, box_temps in box_records.items():
            if not box_temps:
                continue

            sorted_temps = sorted(box_temps, key=lambda x: x.timestamp)
            prev_time = None
            gap_start = None
            max_gap = None

            for temp in sorted_temps:
                if prev_time:
                    gap = temp.timestamp - prev_time
                    if gap > timedelta(minutes=max_gap_minutes):
                        if not gap_start:
                            gap_start = prev_time
                        max_gap = max(max_gap or gap, gap)
                    else:
                        gap_start = None
                prev_time = temp.timestamp

            if max_gap and gap_start:
                violations.append(
                    RuleViolation(
                        rule_name="长时间温度记录缺失",
                        severity="critical",
                        description=f"箱号 {box_id} 存在温度记录断档：最大间隔 {max_gap.total_seconds() / 60:.0f} 分钟，起始时间 {gap_start}",
                        affected_items=[box_id],
                        suggestion=f"温度记录间隔超过 {max_gap_minutes} 分钟，请确认运输过程中温度监控是否正常",
                    )
                )

        for box_id in boxes:
            if box_id not in box_records:
                violations.append(
                    RuleViolation(
                        rule_name="无温度记录",
                        severity="critical",
                        description=f"箱号 {box_id} 没有任何温度记录",
                        affected_items=[box_id],
                        suggestion="必须提供该箱的完整温度监控数据",
                    )
                )

        return violations

    @staticmethod
    def check_temperature_exceedance(
        records: List[TemperatureRecord],
        samples: Dict[str, Sample],
        boxes: Dict[str, Box],
        short_exceedance_minutes: int = 15,
        critical_exceedance_minutes: int = 60,
    ) -> List[RuleViolation]:
        violations = []
        box_records: Dict[str, List[TemperatureRecord]] = defaultdict(list)

        for r in records:
            box_records[r.box_id].append(r)

        for box_id, box_temps in box_records.items():
            if not box_temps:
                continue

            sorted_temps = sorted(box_temps, key=lambda x: x.timestamp)

            exceedance_periods = []
            current_exceedance_start = None
            current_exceedance_type = None

            box_samples = [s for s in samples.values() if s.box_id == box_id]
            if not box_samples:
                continue

            temp_min = min(s.expected_temperature_min for s in box_samples)
            temp_max = max(s.expected_temperature_max for s in box_samples)

            for temp in sorted_temps:
                norm_temp = RuleEngine.normalize_temperature(temp)
                is_exceeding = norm_temp < temp_min or norm_temp > temp_max

                if is_exceeding:
                    exceed_type = "过低" if norm_temp < temp_min else "过高"
                    if current_exceedance_start is None:
                        current_exceedance_start = temp.timestamp
                        current_exceedance_type = exceed_type
                else:
                    if current_exceedance_start is not None:
                        duration = temp.timestamp - current_exceedance_start
                        exceedance_periods.append(
                            (current_exceedance_start, temp.timestamp, duration, current_exceedance_type)
                        )
                        current_exceedance_start = None
                        current_exceedance_type = None

            if current_exceedance_start is not None:
                last_time = sorted_temps[-1].timestamp
                duration = last_time - current_exceedance_start
                exceedance_periods.append(
                    (current_exceedance_start, last_time, duration, current_exceedance_type)
                )

            for start, end, duration, exc_type in exceedance_periods:
                mins = duration.total_seconds() / 60
                if mins <= short_exceedance_minutes:
                    severity = "warning"
                    desc = f"箱号 {box_id} 出现短时超温（{exc_type}）：持续 {mins:.0f} 分钟，{start} - {end}"
                    suggestion = "短时超温可能对样本质量影响较小，建议评估后决定是否接收"
                elif mins <= critical_exceedance_minutes:
                    severity = "major"
                    desc = f"箱号 {box_id} 出现较长时间超温（{exc_type}）：持续 {mins:.0f} 分钟，{start} - {end}"
                    suggestion = "超温时间较长，建议复核样本质量后决定"
                else:
                    severity = "critical"
                    desc = f"箱号 {box_id} 出现严重超温（{exc_type}）：持续 {mins:.0f} 分钟，{start} - {end}"
                    suggestion = "超温时间严重超标，建议拒收该批次样本"

                violations.append(
                    RuleViolation(
                        rule_name="温度超温",
                        severity=severity,
                        description=desc,
                        affected_items=[box_id],
                        suggestion=suggestion,
                    )
                )

        return violations

    @staticmethod
    def run_all_rules(state: ProjectState) -> List[RuleViolation]:
        violations = []

        temp_violations, deduplicated = RuleEngine.check_duplicate_temperature_files(
            state.temperature_records
        )
        violations.extend(temp_violations)
        state.temperature_records = deduplicated

        violations.extend(RuleEngine.check_temperature_unit_mix(state.temperature_records))
        violations.extend(RuleEngine.check_handover_signatures(state.handover_records))
        violations.extend(RuleEngine.check_box_sample_matching(state.samples, state.boxes))
        violations.extend(
            RuleEngine.check_temperature_coverage(
                state.temperature_records, state.samples, state.boxes
            )
        )
        violations.extend(
            RuleEngine.check_temperature_exceedance(
                state.temperature_records, state.samples, state.boxes
            )
        )

        return violations


class StatusDeterminator:
    @staticmethod
    def determine_sample_status(
        sample: Sample,
        state: ProjectState,
        violations: List[RuleViolation],
        corrections: Optional[List] = None,
    ) -> Tuple[SampleStatus, ResponsibilitySegment]:
        if corrections is None:
            corrections = []

        sample_violations = []
        box_id = sample.box_id

        for v in violations:
            if sample.sample_id in v.affected_items or box_id in v.affected_items:
                sample_violations.append(v)

        has_correction = False
        for c in corrections:
            if hasattr(c, 'affected_items'):
                if sample.sample_id in str(c.affected_items):
                    has_correction = True
                    break
            else:
                before_str = str(getattr(c, 'before_value', ''))
                after_str = str(getattr(c, 'after_value', ''))
                if box_id in before_str or box_id in after_str:
                    has_correction = True
                    break

        critical_violations = [v for v in sample_violations if v.severity == "critical"]
        major_violations = [v for v in sample_violations if v.severity == "major"]
        warning_violations = [v for v in sample_violations if v.severity == "warning"]

        if critical_violations:
            critical_types = {v.rule_name for v in critical_violations}

            if "交接人缺签" in critical_types:
                return SampleStatus.REJECTED, ResponsibilitySegment.TRANSPORT
            if "箱号不匹配" in critical_types:
                return SampleStatus.REJECTED, ResponsibilitySegment.COLLECTION
            if "长时间温度记录缺失" in critical_types or "无温度记录" in critical_types:
                return SampleStatus.REJECTED, ResponsibilitySegment.TRANSPORT
            if "温度超温" in critical_types:
                if has_correction:
                    return SampleStatus.REVIEWED, ResponsibilitySegment.TRANSPORT
                return SampleStatus.REJECTED, ResponsibilitySegment.TRANSPORT
            return SampleStatus.REJECTED, ResponsibilitySegment.UNKNOWN

        if major_violations:
            if has_correction:
                return SampleStatus.RECEIVED, ResponsibilitySegment.TRANSPORT
            return SampleStatus.REVIEWED, ResponsibilitySegment.TRANSPORT

        if warning_violations:
            if has_correction:
                return SampleStatus.RECEIVED, ResponsibilitySegment.TRANSPORT
            return SampleStatus.REVIEWED, ResponsibilitySegment.COLLECTION

        return SampleStatus.RECEIVED, ResponsibilitySegment.LAB_RECEIVE
