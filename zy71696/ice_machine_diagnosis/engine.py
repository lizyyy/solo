from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Tuple

from .models import (
    AnomalyAnnotation,
    AnomalyType,
    AuditEntry,
    ConditionGrade,
    ConditionSegment,
    DataQuality,
    DiagnosisInput,
    DiagnosisResult,
    DoorEvent,
    EnergyAttribution,
    IceProductionRecord,
    MaintenanceSuggestion,
    PowerRecord,
    TemperatureRecord,
)
from .audit import AuditTrail


class DiagnosisEngine:
    """
    制冰机能耗异常诊断引擎

    === 公式与单位说明 ===

    1. 比能耗 (SEC, Specific Energy Consumption)
       公式: SEC = E_total(kWh) / P_ice(kg)
       单位: kWh/kg
       含义: 每产出1kg冰消耗的电量

    2. 温度修正系数 (Temperature Correction Factor)
       公式: TCF = 1 + α × (T_ambient - T_ref)
       其中:
         T_ref = 25°C (ASHRAE标准参考温度)
         α = 0.02 /°C (经验系数, 即环境温度每偏离1°C, 能耗变化2%)
       边界: TCF ∈ [0.5, 2.0], 超出范围截断
       单位: 无量纲

    3. 开门附加能耗 (Door Opening Surcharge)
       公式: E_door = N_opens × t_avg(s) × P_rated(kW) × δ / 3600
       其中:
         N_opens = 开门次数
         t_avg = 平均每次开门时长(s)
         δ = 0.35 (经验系数, 开门期间冷量损失导致压缩机额外负荷比)
       单位: kWh

    4. 基准能耗 (Base Energy)
       公式: E_base = P_ice(kg) × SEC_theoretical(kWh/kg)
       含义: 在额定工况下产出等量冰所需的理论能耗

    5. 温度附加能耗 (Temperature Surcharge)
       公式: E_temp = E_base × (TCF - 1)
       含义: 因环境温度偏离参考温度而额外消耗的电量

    6. 异常附加能耗 (Anomaly Surcharge)
       公式: E_anomaly = Σ(尖峰时段能耗 - 尖峰时段基准能耗)
       含义: 识别出的异常时段(能耗尖峰)带来的额外能耗

    7. 工况分段阈值 (Condition Segmentation Thresholds)
       - 正常 (NORMAL):   SEC / SEC_baseline ≤ 1.2
       - 注意 (WARNING):  1.2 < SEC / SEC_baseline ≤ 1.5
       - 异常 (ABNORMAL): 1.5 < SEC / SEC_baseline ≤ 2.0
       - 严重 (CRITICAL): SEC / SEC_baseline > 2.0

    8. 能耗尖峰检测 (Energy Spike Detection)
       判定条件: 功率 > 额定功率 × 1.8  且  持续 ≥ 2个采样点
       处理: 标记为SPIKE_FLAGGED, 计入异常附加能耗

    9. 产冰量缺失插补 (Missing Production Imputation)
       方法: 若单点缺失, 取前后均值; 若连续缺失≤3点, 线性插值; 超过3点标记为不可用
       标记: quality=IMPUTED, imputed_method="linear_interp" 或 "neighbor_avg"

    10. 温度错位对齐 (Temperature Misalignment Alignment)
        方法: 将温度记录对齐到最近的能耗采样时刻(阈值≤15min), 超出则标记为ALIGNED并记录偏差
        标记: quality=ALIGNED, original_timestamp保留原时间戳
    """

    T_REF = 25.0
    ALPHA_TEMP = 0.02
    TCF_MIN = 0.5
    TCF_MAX = 2.0
    DOOR_LOSS_FACTOR = 0.35
    SPIKE_POWER_RATIO = 1.8
    SPIKE_MIN_DURATION_POINTS = 2
    TEMP_ALIGN_THRESHOLD_S = 900
    MAX_CONSECUTIVE_MISSING = 3
    SEC_NORMAL_THRESHOLD = 1.2
    SEC_WARNING_THRESHOLD = 1.5
    SEC_CRITICAL_THRESHOLD = 2.0

    def __init__(self, audit_trail: Optional[AuditTrail] = None):
        self.audit = audit_trail or AuditTrail()

    def diagnose(self, data: DiagnosisInput) -> DiagnosisResult:
        now = datetime.now()

        validation_errors = data.validate_all()
        for err in validation_errors:
            self.audit.add(
                AuditEntry(
                    timestamp=now,
                    field="validation",
                    original_value=None,
                    adjusted_value=None,
                    reason=err,
                    method="validate",
                    operator="system",
                    can_override=False,
                )
            )

        temp_aligned = self._align_temperature(data.temperature_records, data.power_records)
        production_clean = self._impute_production(data.ice_production)
        power_clean, spike_anomalies = self._detect_spikes(data.power_records, data.equipment)
        door_stats = self._compute_door_stats(data.door_events)

        time_windows = self._build_time_windows(
            power_clean, temp_aligned, production_clean, data.door_events
        )

        anomalies = list(spike_anomalies)
        anomalies.extend(self._detect_missing_anomalies(data.ice_production))
        anomalies.extend(self._detect_temp_misalignment(data.temperature_records, data.power_records))
        anomalies.extend(self._detect_excessive_doors(data.door_events, data.equipment))

        segments = self._compute_condition_segments(
            time_windows, data.equipment, anomalies
        )

        attribution = self._compute_energy_attribution(
            time_windows, data.equipment, door_stats, anomalies
        )

        overall_grade = self._compute_overall_grade(segments)

        suggestions = self._generate_maintenance_suggestions(
            anomalies, segments, attribution, data.equipment
        )

        methodology = self._build_methodology_statement(attribution, segments)

        return DiagnosisResult(
            equipment_id=data.equipment.equipment_id,
            diagnosis_time=now,
            overall_grade=overall_grade,
            energy_attribution=attribution,
            condition_segments=segments,
            anomalies=anomalies,
            maintenance_suggestions=suggestions,
            audit_trail=self.audit.entries,
            processing_methodology=methodology,
        )

    def _align_temperature(
        self,
        temp_records: List[TemperatureRecord],
        power_records: List[PowerRecord],
    ) -> List[TemperatureRecord]:
        if not temp_records or not power_records:
            return list(temp_records)

        power_times = [r.timestamp for r in power_records]
        aligned = []

        for t_rec in temp_records:
            nearest_dt = min(power_times, key=lambda pt: abs((pt - t_rec.timestamp).total_seconds()))
            delta_s = abs((nearest_dt - t_rec.timestamp).total_seconds())

            if delta_s == 0:
                aligned.append(t_rec)
            elif delta_s <= self.TEMP_ALIGN_THRESHOLD_S:
                aligned_rec = TemperatureRecord(
                    timestamp=nearest_dt,
                    temperature_c=t_rec.temperature_c,
                    quality=DataQuality.ALIGNED,
                    original_timestamp=t_rec.timestamp,
                    original_value=t_rec.temperature_c,
                )
                aligned.append(aligned_rec)
                self.audit.add(
                    AuditEntry(
                        timestamp=nearest_dt,
                        field="temperature.timestamp",
                        original_value=t_rec.timestamp.isoformat(),
                        adjusted_value=nearest_dt.isoformat(),
                        reason=f"温度记录时间戳与能耗采样点偏差{delta_s:.0f}s, 对齐到最近采样点",
                        method="nearest_alignment",
                        can_override=True,
                    )
                )
            else:
                self.audit.add(
                    AuditEntry(
                        timestamp=t_rec.timestamp,
                        field="temperature.timestamp",
                        original_value=t_rec.timestamp.isoformat(),
                        adjusted_value=None,
                        reason=f"温度记录时间戳与能耗采样点偏差{delta_s:.0f}s, 超出对齐阈值{self.TEMP_ALIGN_THRESHOLD_S}s, 丢弃",
                        method="threshold_discard",
                        can_override=True,
                    )
                )

        return aligned

    def _impute_production(
        self, records: List[IceProductionRecord]
    ) -> List[IceProductionRecord]:
        cleaned = []
        n = len(records)

        block_sizes = {}
        i = 0
        while i < n:
            if records[i].production_kg is None or records[i].quality == DataQuality.MISSING:
                block_start = i
                while i < n and (records[i].production_kg is None or records[i].quality == DataQuality.MISSING):
                    i += 1
                block_len = i - block_start
                for k in range(block_start, i):
                    block_sizes[k] = block_len
            else:
                i += 1

        for i, rec in enumerate(records):
            if rec.production_kg is not None and rec.quality != DataQuality.MISSING:
                cleaned.append(rec)
                continue

            if rec.quality == DataQuality.MISSING or rec.production_kg is None:
                prev_val = None
                next_val = None
                prev_idx = i - 1
                next_idx = i + 1

                while prev_idx >= 0 and (records[prev_idx].production_kg is None or records[prev_idx].quality == DataQuality.MISSING):
                    prev_idx -= 1
                if prev_idx >= 0:
                    prev_val = records[prev_idx].production_kg

                while next_idx < n and (records[next_idx].production_kg is None or records[next_idx].quality == DataQuality.MISSING):
                    next_idx += 1
                if next_idx < n:
                    next_val = records[next_idx].production_kg

                block_size = block_sizes.get(i, 1)

                if block_size > self.MAX_CONSECUTIVE_MISSING:
                    imputed_rec = IceProductionRecord(
                        timestamp=rec.timestamp,
                        production_kg=None,
                        quality=DataQuality.MISSING,
                        imputed_method="unavailable_exceeds_limit",
                    )
                    self.audit.add(
                        AuditEntry(
                            timestamp=rec.timestamp,
                            field="ice_production.production_kg",
                            original_value="None",
                            adjusted_value="None",
                            reason=f"所在连续缺失块共{block_size}点, 超过插补上限{self.MAX_CONSECUTIVE_MISSING}点, 整块标记为不可用",
                            method="unavailable_exceeds_limit",
                            can_override=False,
                        )
                    )
                elif prev_val is not None and next_val is not None:
                    imputed_val = (prev_val + next_val) / 2
                    method = "linear_interp"
                    imputed_rec = IceProductionRecord(
                        timestamp=rec.timestamp,
                        production_kg=imputed_val,
                        quality=DataQuality.IMPUTED,
                        imputed_method=method,
                    )
                    self.audit.add(
                        AuditEntry(
                            timestamp=rec.timestamp,
                            field="ice_production.production_kg",
                            original_value="None",
                            adjusted_value=f"{imputed_val:.2f}",
                            reason="产冰量缺失, 前后值均存在, 线性插值",
                            method=method,
                            can_override=True,
                        )
                    )
                elif prev_val is not None:
                    imputed_val = prev_val
                    method = "forward_fill"
                    imputed_rec = IceProductionRecord(
                        timestamp=rec.timestamp,
                        production_kg=imputed_val,
                        quality=DataQuality.IMPUTED,
                        imputed_method=method,
                    )
                    self.audit.add(
                        AuditEntry(
                            timestamp=rec.timestamp,
                            field="ice_production.production_kg",
                            original_value="None",
                            adjusted_value=f"{imputed_val:.2f}",
                            reason="产冰量缺失, 仅有前值, 前向填充",
                            method=method,
                            can_override=True,
                        )
                    )
                elif next_val is not None:
                    imputed_val = next_val
                    method = "backward_fill"
                    imputed_rec = IceProductionRecord(
                        timestamp=rec.timestamp,
                        production_kg=imputed_val,
                        quality=DataQuality.IMPUTED,
                        imputed_method=method,
                    )
                    self.audit.add(
                        AuditEntry(
                            timestamp=rec.timestamp,
                            field="ice_production.production_kg",
                            original_value="None",
                            adjusted_value=f"{imputed_val:.2f}",
                            reason="产冰量缺失, 仅有后值, 后向填充",
                            method=method,
                            can_override=True,
                        )
                    )
                else:
                    imputed_rec = IceProductionRecord(
                        timestamp=rec.timestamp,
                        production_kg=None,
                        quality=DataQuality.MISSING,
                        imputed_method="no_neighbors",
                    )
                    self.audit.add(
                        AuditEntry(
                            timestamp=rec.timestamp,
                            field="ice_production.production_kg",
                            original_value="None",
                            adjusted_value="None",
                            reason="产冰量缺失且无可用邻居值, 标记为不可用",
                            method="no_neighbors",
                            can_override=False,
                        )
                    )

                cleaned.append(imputed_rec)
            else:
                cleaned.append(rec)

        return cleaned

    def _detect_spikes(
        self, records: List[PowerRecord], equipment
    ) -> Tuple[List[PowerRecord], List[AnomalyAnnotation]]:
        cleaned = []
        anomalies = []
        spike_threshold = equipment.rated_power_kw * self.SPIKE_POWER_RATIO

        i = 0
        while i < len(records):
            if records[i].power_kw > spike_threshold:
                spike_start = i
                j = i
                while j < len(records) and records[j].power_kw > spike_threshold:
                    j += 1
                spike_count = j - spike_start

                if spike_count >= self.SPIKE_MIN_DURATION_POINTS:
                    for k in range(spike_start, j):
                        cleaned_rec = PowerRecord(
                            timestamp=records[k].timestamp,
                            power_kw=records[k].power_kw,
                            cumulative_kwh=records[k].cumulative_kwh,
                            quality=DataQuality.SPIKE_FLAGGED,
                            original_value=records[k].power_kw,
                        )
                        cleaned.append(cleaned_rec)

                    anomaly = AnomalyAnnotation(
                        anomaly_type=AnomalyType.ENERGY_SPIKE,
                        start_time=records[spike_start].timestamp,
                        end_time=records[j - 1].timestamp,
                        severity=ConditionGrade.ABNORMAL,
                        detail=(
                            f"能耗尖峰: {spike_count}个采样点功率超过额定{self.SPIKE_POWER_RATIO}倍"
                            f" (阈值{spike_threshold:.1f}kW), "
                            f"峰值{max(r.power_kw for r in records[spike_start:j]):.1f}kW"
                        ),
                        affected_records=spike_count,
                    )
                    anomalies.append(anomaly)

                    self.audit.add(
                        AuditEntry(
                            timestamp=records[spike_start].timestamp,
                            field="power.power_kw",
                            original_value=str([round(r.power_kw, 2) for r in records[spike_start:j]]),
                            adjusted_value="SPIKE_FLAGGED(保留原值, 标记为尖峰)",
                            reason=f"检测到能耗尖峰, {spike_count}点功率>{spike_threshold:.1f}kW",
                            method="spike_detection",
                            can_override=True,
                        )
                    )
                else:
                    cleaned.extend(records[spike_start:j])

                i = j
            else:
                cleaned.append(records[i])
                i += 1

        return cleaned, anomalies

    def _compute_door_stats(self, door_events: List[DoorEvent]) -> dict:
        opens = [e for e in door_events if e.is_open]
        total_opens = len(opens)
        avg_duration_s = 0.0
        if opens:
            durations = [e.duration_s for e in opens if e.duration_s is not None]
            if durations:
                avg_duration_s = sum(durations) / len(durations)
        return {
            "total_opens": total_opens,
            "avg_duration_s": avg_duration_s,
        }

    def _build_time_windows(
        self,
        power: List[PowerRecord],
        temp: List[TemperatureRecord],
        production: List[IceProductionRecord],
        doors: List[DoorEvent],
    ) -> List[dict]:
        if not power:
            return []

        temp_map = {t.timestamp: t.temperature_c for t in temp}
        prod_map = {}
        for p in production:
            if p.production_kg is not None:
                prod_map[p.timestamp] = p.production_kg

        windows = []
        for p_rec in power:
            t_c = temp_map.get(p_rec.timestamp)
            prod_kg = prod_map.get(p_rec.timestamp)
            ts = p_rec.timestamp

            door_count = sum(
                1 for d in doors if d.is_open and d.timestamp <= ts
            )

            windows.append({
                "timestamp": ts,
                "power_kw": p_rec.power_kw,
                "cumulative_kwh": p_rec.cumulative_kwh,
                "temperature_c": t_c,
                "production_kg": prod_kg,
                "door_opens_cumulative": door_count,
                "quality": p_rec.quality,
            })

        return windows

    def _compute_condition_segments(
        self,
        windows: List[dict],
        equipment,
        anomalies: List[AnomalyAnnotation],
    ) -> List[ConditionSegment]:
        if not windows:
            return []

        baseline_sec = equipment.theoretical_sec
        hourly_groups = {}

        for w in windows:
            hour_key = w["timestamp"].replace(minute=0, second=0, microsecond=0)
            if hour_key not in hourly_groups:
                hourly_groups[hour_key] = []
            hourly_groups[hour_key].append(w)

        segments = []
        for hour_start in sorted(hourly_groups.keys()):
            group = hourly_groups[hour_start]
            hour_end = group[-1]["timestamp"]

            total_energy = 0.0
            total_production = 0.0
            temps = []
            door_opens = 0

            for w in group:
                if w["cumulative_kwh"] is not None and len(group) > 1:
                    pass
                else:
                    total_energy += w["power_kw"] * (1.0 / 60.0)

                if w["temperature_c"] is not None:
                    temps.append(w["temperature_c"])

                if w["production_kg"] is not None:
                    total_production += w["production_kg"]

            if len(group) >= 2 and group[0]["cumulative_kwh"] is not None and group[-1]["cumulative_kwh"] is not None:
                total_energy = group[-1]["cumulative_kwh"] - group[0]["cumulative_kwh"]

            if total_production > 0 and total_energy > 0:
                avg_sec = total_energy / total_production
            elif total_energy > 0:
                avg_sec = float("inf")
            else:
                avg_sec = 0.0

            avg_temp = sum(temps) / len(temps) if temps else self.T_REF
            sec_ratio = avg_sec / baseline_sec if baseline_sec > 0 and avg_sec != float("inf") else float("inf")

            if sec_ratio <= self.SEC_NORMAL_THRESHOLD:
                grade = ConditionGrade.NORMAL
            elif sec_ratio <= self.SEC_WARNING_THRESHOLD:
                grade = ConditionGrade.WARNING
            elif sec_ratio <= self.SEC_CRITICAL_THRESHOLD:
                grade = ConditionGrade.ABNORMAL
            else:
                grade = ConditionGrade.CRITICAL

            hour_anomalies = [
                a for a in anomalies
                if a.start_time >= hour_start and (a.end_time is None or a.end_time <= hour_end or a.start_time <= hour_end)
            ]

            segments.append(ConditionSegment(
                start_time=hour_start,
                end_time=hour_end,
                grade=grade,
                avg_sec_kwh_per_kg=avg_sec,
                avg_temperature_c=avg_temp,
                door_open_count=door_opens,
                total_production_kg=total_production,
                total_energy_kwh=total_energy,
                sec_ratio_vs_baseline=sec_ratio,
                anomalies=hour_anomalies,
            ))

        return segments

    def _compute_energy_attribution(
        self,
        windows: List[dict],
        equipment,
        door_stats: dict,
        anomalies: List[AnomalyAnnotation],
    ) -> EnergyAttribution:
        baseline_sec = equipment.theoretical_sec

        valid_windows = [w for w in windows if w["production_kg"] is not None and w["production_kg"] > 0]
        total_production = sum(w["production_kg"] for w in valid_windows if w["production_kg"])

        if len(windows) >= 2 and windows[0]["cumulative_kwh"] is not None and windows[-1]["cumulative_kwh"] is not None:
            total_energy = windows[-1]["cumulative_kwh"] - windows[0]["cumulative_kwh"]
        else:
            total_energy = sum(w["power_kw"] * (1.0 / 60.0) for w in windows)

        base_energy = total_production * baseline_sec

        valid_temps = [w["temperature_c"] for w in windows if w["temperature_c"] is not None]
        if valid_temps:
            avg_temp = sum(valid_temps) / len(valid_temps)
        else:
            avg_temp = self.T_REF

        tcf = 1.0 + self.ALPHA_TEMP * (avg_temp - self.T_REF)
        tcf = max(self.TCF_MIN, min(self.TCF_MAX, tcf))
        temp_surcharge = base_energy * (tcf - 1.0)

        door_surcharge = (
            door_stats["total_opens"]
            * door_stats["avg_duration_s"]
            * equipment.rated_power_kw
            * self.DOOR_LOSS_FACTOR
            / 3600.0
        ) if door_stats["avg_duration_s"] > 0 else 0.0

        spike_anomalies = [a for a in anomalies if a.anomaly_type == AnomalyType.ENERGY_SPIKE]
        anomaly_surcharge = 0.0
        for a in spike_anomalies:
            if a.start_time and a.end_time:
                duration_h = (a.end_time - a.start_time).total_seconds() / 3600.0
                if duration_h > 0:
                    anomaly_surcharge += (
                        equipment.rated_power_kw * (self.SPIKE_POWER_RATIO - 1.0) * duration_h
                    )

        unexplained = total_energy - base_energy - temp_surcharge - door_surcharge - anomaly_surcharge

        methodology = (
            f"能耗归因方法:\n"
            f"  总能耗 = {total_energy:.2f} kWh\n"
            f"  基准能耗 = 产冰量({total_production:.2f}kg) × 理论SEC({baseline_sec:.4f} kWh/kg) = {base_energy:.2f} kWh\n"
            f"  温度修正系数 TCF = 1 + {self.ALPHA_TEMP} × (T_avg({avg_temp:.1f}°C) - T_ref({self.T_REF}°C)) = {tcf:.4f}\n"
            f"  温度附加 = 基准能耗 × (TCF - 1) = {base_energy:.2f} × {tcf - 1:.4f} = {temp_surcharge:.2f} kWh\n"
            f"  开门附加 = 开门次数({door_stats['total_opens']}) × 平均时长({door_stats['avg_duration_s']:.1f}s) × 额定功率({equipment.rated_power_kw:.1f}kW) × 损失系数({self.DOOR_LOSS_FACTOR}) / 3600 = {door_surcharge:.2f} kWh\n"
            f"  异常附加 = {anomaly_surcharge:.2f} kWh (来自{len(spike_anomalies)}个尖峰时段)\n"
            f"  未解释 = 总能耗 - 基准 - 温度附加 - 开门附加 - 异常附加 = {unexplained:.2f} kWh\n"
            f"  注意: 未解释能耗可能来自设备老化、制冷剂泄漏、维护不当等因素"
        )

        return EnergyAttribution(
            total_energy_kwh=total_energy,
            base_energy_kwh=base_energy,
            temperature_surcharge_kwh=temp_surcharge,
            door_surcharge_kwh=door_surcharge,
            anomaly_surcharge_kwh=anomaly_surcharge,
            unexplained_kwh=unexplained,
            methodology=methodology,
        )

    def _detect_missing_anomalies(
        self, records: List[IceProductionRecord]
    ) -> List[AnomalyAnnotation]:
        anomalies = []
        i = 0
        while i < len(records):
            if records[i].quality == DataQuality.MISSING or records[i].production_kg is None:
                start_idx = i
                while i < len(records) and (records[i].quality == DataQuality.MISSING or records[i].production_kg is None):
                    i += 1
                count = i - start_idx
                anomaly = AnomalyAnnotation(
                    anomaly_type=AnomalyType.MISSING_PRODUCTION,
                    start_time=records[start_idx].timestamp,
                    end_time=records[i - 1].timestamp if i > 0 else records[start_idx].timestamp,
                    severity=ConditionGrade.WARNING if count <= self.MAX_CONSECUTIVE_MISSING else ConditionGrade.ABNORMAL,
                    detail=f"产冰量数据缺失{count}个采样点",
                    affected_records=count,
                )
                anomalies.append(anomaly)
            else:
                i += 1
        return anomalies

    def _detect_temp_misalignment(
        self,
        temp_records: List[TemperatureRecord],
        power_records: List[PowerRecord],
    ) -> List[AnomalyAnnotation]:
        anomalies = []
        if not temp_records or not power_records:
            return anomalies

        power_times = [r.timestamp for r in power_records]
        misaligned_count = 0
        misaligned_start = None

        for t_rec in temp_records:
            min_delta = min(
                abs((pt - t_rec.timestamp).total_seconds()) for pt in power_times
            )
            if min_delta > self.TEMP_ALIGN_THRESHOLD_S:
                misaligned_count += 1
                if misaligned_start is None:
                    misaligned_start = t_rec.timestamp
            else:
                if misaligned_count > 0:
                    anomaly = AnomalyAnnotation(
                        anomaly_type=AnomalyType.TEMPERATURE_MISALIGNMENT,
                        start_time=misaligned_start,
                        end_time=t_rec.timestamp,
                        severity=ConditionGrade.WARNING,
                        detail=f"温度记录时间戳与能耗采样点错位{misaligned_count}点, 已对齐或丢弃",
                        affected_records=misaligned_count,
                    )
                    anomalies.append(anomaly)
                    misaligned_count = 0
                    misaligned_start = None

        if misaligned_count > 0:
            anomaly = AnomalyAnnotation(
                anomaly_type=AnomalyType.TEMPERATURE_MISALIGNMENT,
                start_time=misaligned_start,
                end_time=temp_records[-1].timestamp,
                severity=ConditionGrade.WARNING,
                detail=f"温度记录时间戳与能耗采样点错位{misaligned_count}点, 已对齐或丢弃",
                affected_records=misaligned_count,
            )
            anomalies.append(anomaly)

        return anomalies

    def _detect_excessive_doors(
        self, door_events: List[DoorEvent], equipment
    ) -> List[AnomalyAnnotation]:
        anomalies = []
        opens = [e for e in door_events if e.is_open]
        if not opens:
            return anomalies

        hourly_opens = {}
        for o in opens:
            hour_key = o.timestamp.replace(minute=0, second=0, microsecond=0)
            hourly_opens.setdefault(hour_key, 0)
            hourly_opens[hour_key] += 1

        normal_max_opens_per_hour = 10
        for hour_key, count in sorted(hourly_opens.items()):
            if count > normal_max_opens_per_hour:
                anomaly = AnomalyAnnotation(
                    anomaly_type=AnomalyType.DOOR_EXCESSIVE,
                    start_time=hour_key,
                    end_time=hour_key.replace(hour=hour_key.hour + 1) if hour_key.hour < 23 else hour_key,
                    severity=ConditionGrade.WARNING,
                    detail=f"开门次数{count}次/h, 超过正常上限{normal_max_opens_per_hour}次/h",
                    affected_records=count,
                )
                anomalies.append(anomaly)

        return anomalies

    def _compute_overall_grade(self, segments: List[ConditionSegment]) -> ConditionGrade:
        if not segments:
            return ConditionGrade.NORMAL

        grade_order = {
            ConditionGrade.NORMAL: 0,
            ConditionGrade.WARNING: 1,
            ConditionGrade.ABNORMAL: 2,
            ConditionGrade.CRITICAL: 3,
        }

        worst = ConditionGrade.NORMAL
        for seg in segments:
            if grade_order[seg.grade] > grade_order[worst]:
                worst = seg.grade

        return worst

    def _generate_maintenance_suggestions(
        self,
        anomalies: List[AnomalyAnnotation],
        segments: List[ConditionSegment],
        attribution: EnergyAttribution,
        equipment,
    ) -> List[MaintenanceSuggestion]:
        suggestions = []
        anomaly_types = {a.anomaly_type for a in anomalies}

        if AnomalyType.ENERGY_SPIKE in anomaly_types:
            spike_anomalies = [a for a in anomalies if a.anomaly_type == AnomalyType.ENERGY_SPIKE]
            suggestions.append(MaintenanceSuggestion(
                priority=ConditionGrade.ABNORMAL,
                category="电气检查",
                action="检查压缩机电气系统, 包括启动电容、接触器和绕组绝缘",
                rationale=(
                    f"检测到{len(spike_anomalies)}次能耗尖峰, "
                    f"功率超过额定{self.SPIKE_POWER_RATIO}倍, "
                    f"可能原因: 压缩机硬启动、电气故障、制冷剂过量"
                ),
                related_anomaly_types=[AnomalyType.ENERGY_SPIKE],
            ))

        if AnomalyType.SUSTAINED_HIGH_SEC in anomaly_types:
            suggestions.append(MaintenanceSuggestion(
                priority=ConditionGrade.ABNORMAL,
                category="制冷系统",
                action="检查制冷剂充注量、冷凝器清洁度、蒸发器结霜情况",
                rationale="持续高比能耗, 制冷效率下降, 需排查制冷系统完整性",
                related_anomaly_types=[AnomalyType.SUSTAINED_HIGH_SEC],
            ))

        critical_segments = [s for s in segments if s.grade == ConditionGrade.CRITICAL]
        if critical_segments:
            suggestions.append(MaintenanceSuggestion(
                priority=ConditionGrade.CRITICAL,
                category="全面检修",
                action="安排设备全面检修, 包括制冷剂检漏、压缩机效率测试、控制系统校准",
                rationale=(
                    f"存在{len(critical_segments)}个严重工况时段, "
                    f"SEC超过基准{self.SEC_CRITICAL_THRESHOLD}倍, 设备可能存在严重故障"
                ),
                related_anomaly_types=[AnomalyType.ENERGY_SPIKE, AnomalyType.SUSTAINED_HIGH_SEC],
            ))

        abnormal_segments = [s for s in segments if s.grade in (ConditionGrade.ABNORMAL, ConditionGrade.CRITICAL)]
        if abnormal_segments and attribution.unexplained_kwh > attribution.total_energy_kwh * 0.15:
            suggestions.append(MaintenanceSuggestion(
                priority=ConditionGrade.ABNORMAL,
                category="设备老化评估",
                action="评估设备老化程度, 检查保温层完整性、门封条密封性",
                rationale=(
                    f"未解释能耗占比{attribution.attribution_pct.get('unexplained_pct', 0):.1f}%, "
                    f"超过15%阈值, 可能存在保温性能下降或密封不良"
                ),
                related_anomaly_types=[],
            ))

        if AnomalyType.DOOR_EXCESSIVE in anomaly_types:
            suggestions.append(MaintenanceSuggestion(
                priority=ConditionGrade.WARNING,
                category="使用规范",
                action="培训操作人员减少开门频率和时长, 检查门封条",
                rationale="开门次数超出正常范围, 每次开门导致冷量损失增加压缩机负荷",
                related_anomaly_types=[AnomalyType.DOOR_EXCESSIVE],
            ))

        if AnomalyType.MISSING_PRODUCTION in anomaly_types:
            suggestions.append(MaintenanceSuggestion(
                priority=ConditionGrade.WARNING,
                category="数据采集",
                action="检查产冰量传感器和数据采集系统, 确保数据完整性",
                rationale="产冰量数据缺失影响诊断准确性, 需排除传感器故障或通讯中断",
                related_anomaly_types=[AnomalyType.MISSING_PRODUCTION],
            ))

        if AnomalyType.TEMPERATURE_MISALIGNMENT in anomaly_types:
            suggestions.append(MaintenanceSuggestion(
                priority=ConditionGrade.WARNING,
                category="数据采集",
                action="校准温度传感器时钟, 统一数据采集时间基准",
                rationale="温度记录时间戳与能耗采样点存在错位, 影响温度修正计算的准确性",
                related_anomaly_types=[AnomalyType.TEMPERATURE_MISALIGNMENT],
            ))

        if not suggestions:
            suggestions.append(MaintenanceSuggestion(
                priority=ConditionGrade.NORMAL,
                category="日常维护",
                action="继续按计划进行日常维护保养",
                rationale="设备运行正常, 无明显异常",
                related_anomaly_types=[],
            ))

        return suggestions

    def _build_methodology_statement(
        self, attribution: EnergyAttribution, segments: List[ConditionSegment]
    ) -> str:
        segment_summary = "\n".join(
            f"  {s.start_time.strftime('%H:%M')}-{s.end_time.strftime('%H:%M')}: "
            f"{s.grade.value} (SEC={s.avg_sec_kwh_per_kg:.3f} kWh/kg, "
            f"比值={s.sec_ratio_vs_baseline:.2f}x)"
            for s in segments
        )

        return (
            f"=== 诊断处理口径 ===\n\n"
            f"1. 能耗归因:\n"
            f"{attribution.methodology}\n\n"
            f"2. 工况分段 (按小时):\n"
            f"{segment_summary}\n\n"
            f"3. SEC分段阈值:\n"
            f"  正常 ≤ {self.SEC_NORMAL_THRESHOLD}x基准\n"
            f"  注意 {self.SEC_NORMAL_THRESHOLD}x-{self.SEC_WARNING_THRESHOLD}x基准\n"
            f"  异常 {self.SEC_WARNING_THRESHOLD}x-{self.SEC_CRITICAL_THRESHOLD}x基准\n"
            f"  严重 > {self.SEC_CRITICAL_THRESHOLD}x基准\n\n"
            f"4. 数据处理规则:\n"
            f"  温度对齐阈值: {self.TEMP_ALIGN_THRESHOLD_S}s\n"
            f"  尖峰检测: 功率 > 额定×{self.SPIKE_POWER_RATIO}, 持续≥{self.SPIKE_MIN_DURATION_POINTS}点\n"
            f"  缺失插补: 连续≤{self.MAX_CONSECUTIVE_MISSING}点可插补, 超出标记不可用\n"
            f"  温度修正: α={self.ALPHA_TEMP}/°C, T_ref={self.T_REF}°C, TCF∈[{self.TCF_MIN},{self.TCF_MAX}]\n"
            f"  开门损失系数: {self.DOOR_LOSS_FACTOR}\n\n"
            f"5. 报告一致性声明:\n"
            f"  本报告所有数字和明细列表均来自同一次诊断计算, 未做二次加工。\n"
            f"  数据处理痕迹详见audit_trail字段, 不会自动覆盖历史记录。"
        )
