from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime, timedelta
import json
import hashlib
import math
from collections import defaultdict

from sqlalchemy.orm import Session
from sqlalchemy import and_

from .. import models
from .threshold import threshold_manager, ThresholdCheckResult
from .vibration import vibration_analyzer, VibrationAnalysisResult


@dataclass
class EnergyStatistics:
    total_energy: float
    avg_power: float
    max_power: float
    min_power: float
    avg_load_rate: float
    total_runtime: float
    energy_efficiency: float
    peak_hours: List[Tuple[datetime, float]]
    off_peak_hours: List[Tuple[datetime, float]]


@dataclass
class DiagnosisReport:
    diagnosis_id: int
    report_hash: str
    compressor_id: int
    equipment_no: str
    start_time: datetime
    end_time: datetime
    diagnosis_time: datetime
    energy_stats: EnergyStatistics
    vibration_analysis: Optional[VibrationAnalysisResult]
    anomalies: List[ThresholdCheckResult]
    anomaly_score: float
    abnormal_count: int
    overall_assessment: str
    improvement_suggestions: List[str]
    raw_data_signature: str


class EnergyDiagnosisModel:
    def __init__(self):
        self.param_map = {
            "power": "功率",
            "current": "电流",
            "temperature": "温度",
            "pressure": "压力",
            "load_rate": "负载率",
            "overall_vibration": "总振动",
        }

    def diagnose(
        self,
        db: Session,
        compressor_id: int,
        start_time: datetime,
        end_time: datetime,
        diagnosis_type: str = "standard",
        batch_id: Optional[str] = None,
    ) -> DiagnosisReport:

        compressor = db.query(models.Compressor).filter(
            models.Compressor.id == compressor_id
        ).first()
        if not compressor:
            raise ValueError(f"空压机ID {compressor_id} 不存在")

        energy_records = db.query(models.EnergyRecord).filter(
            and_(
                models.EnergyRecord.compressor_id == compressor_id,
                models.EnergyRecord.record_time >= start_time,
                models.EnergyRecord.record_time <= end_time,
            )
        ).order_by(models.EnergyRecord.record_time).all()

        vibration_records = db.query(models.VibrationRecord).filter(
            and_(
                models.VibrationRecord.compressor_id == compressor_id,
                models.VibrationRecord.record_time >= start_time,
                models.VibrationRecord.record_time <= end_time,
            )
        ).order_by(models.VibrationRecord.record_time).all()

        if not energy_records:
            raise ValueError(f"在指定时间范围内没有能耗数据")

        data_signature = self._calculate_data_signature(
            energy_records, vibration_records, compressor
        )
        report_hash = self._calculate_report_hash(
            compressor_id, start_time, end_time, data_signature, diagnosis_type
        )

        existing_diagnosis = db.query(models.Diagnosis).filter(
            models.Diagnosis.compressor_id == compressor_id,
            models.Diagnosis.start_time == start_time,
            models.Diagnosis.end_time == end_time,
        ).first()

        if existing_diagnosis and existing_diagnosis.report_hash == report_hash and not existing_diagnosis.is_manual_corrected:
            return self._load_existing_report(db, existing_diagnosis, compressor, energy_records, vibration_records)

        energy_stats = self._calculate_energy_stats(energy_records, compressor.rated_power or 100)
        vibration_analysis = vibration_analyzer.analyze(vibration_records)
        anomalies = self._detect_anomalies(energy_records, vibration_records)

        anomaly_score = self._calculate_anomaly_score(anomalies, len(energy_records))
        abnormal_count = len([a for a in anomalies if a.is_abnormal])

        overall_assessment = self._generate_overall_assessment(
            energy_stats, vibration_analysis, anomaly_score, abnormal_count
        )
        improvement_suggestions = self._generate_improvement_suggestions(
            energy_stats, vibration_analysis, anomalies
        )

        diagnosis_obj = self._save_diagnosis(
            db=db,
            compressor_id=compressor_id,
            start_time=start_time,
            end_time=end_time,
            diagnosis_type=diagnosis_type,
            energy_stats=energy_stats,
            anomalies=anomalies,
            anomaly_score=anomaly_score,
            abnormal_count=abnormal_count,
            report_hash=report_hash,
            batch_id=batch_id,
            existing_diagnosis=existing_diagnosis,
        )

        if vibration_analysis and vibration_analysis.raw_data_snapshot:
            vib_snap_path = self._save_vibration_snapshot(
                compressor.equipment_no, start_time, end_time,
                vibration_analysis.raw_data_snapshot
            )
            diagnosis_obj.vibration_snapshot_path = vib_snap_path

        db.commit()

        return DiagnosisReport(
            diagnosis_id=diagnosis_obj.id,
            report_hash=report_hash,
            compressor_id=compressor_id,
            equipment_no=compressor.equipment_no,
            start_time=start_time,
            end_time=end_time,
            diagnosis_time=diagnosis_obj.diagnosis_time,
            energy_stats=energy_stats,
            vibration_analysis=vibration_analysis,
            anomalies=anomalies,
            anomaly_score=anomaly_score,
            abnormal_count=abnormal_count,
            overall_assessment=overall_assessment,
            improvement_suggestions=improvement_suggestions,
            raw_data_signature=data_signature,
        )

    def _calculate_data_signature(
        self,
        energy_records: List[models.EnergyRecord],
        vibration_records: List[models.VibrationRecord],
        compressor: models.Compressor,
    ) -> str:
        energy_data = []
        for r in sorted(energy_records, key=lambda x: x.record_time):
            energy_data.append({
                "t": r.record_time.isoformat(),
                "p": round(r.power or 0, 4),
                "l": round(r.load_rate or 0, 4),
                "pr": round(r.pressure or 0, 4),
                "t": round(r.temperature or 0, 4),
                "m": r.is_manual_edited,
            })

        vib_data = []
        for r in sorted(vibration_records, key=lambda x: x.record_time):
            vib_data.append({
                "t": r.record_time.isoformat(),
                "o": round(r.overall_vibration or 0, 4),
                "x": round(r.x_vibration or 0, 4),
                "y": round(r.y_vibration or 0, 4),
                "z": round(r.z_vibration or 0, 4),
                "m": r.is_manual_edited,
            })

        signature_data = {
            "compressor": compressor.equipment_no,
            "energy_count": len(energy_data),
            "vib_count": len(vib_data),
            "energy_hash": hashlib.md5(json.dumps(energy_data, sort_keys=True).encode()).hexdigest(),
            "vib_hash": hashlib.md5(json.dumps(vib_data, sort_keys=True).encode()).hexdigest(),
        }

        return hashlib.sha256(json.dumps(signature_data, sort_keys=True).encode()).hexdigest()

    def _calculate_report_hash(
        self,
        compressor_id: int,
        start_time: datetime,
        end_time: datetime,
        data_signature: str,
        diagnosis_type: str,
    ) -> str:
        hash_input = f"{compressor_id}|{start_time.isoformat()}|{end_time.isoformat()}|{data_signature}|{diagnosis_type}"
        return hashlib.sha256(hash_input.encode()).hexdigest()[:32]

    def _load_existing_report(
        self,
        db: Session,
        diagnosis: models.Diagnosis,
        compressor: models.Compressor,
        energy_records: List[models.EnergyRecord],
        vibration_records: List[models.VibrationRecord],
    ) -> DiagnosisReport:
        energy_stats = self._calculate_energy_stats(energy_records, compressor.rated_power or 100)
        vibration_analysis = vibration_analyzer.analyze(vibration_records)
        anomalies = self._detect_anomalies(energy_records, vibration_records)

        active_anomalies = [a for a in anomalies if a.is_abnormal]
        for anomaly in diagnosis.anomalies:
            if anomaly.is_manual_override:
                for i, a in enumerate(active_anomalies):
                    if (a.record_time == anomaly.record_time and
                        a.parameter == anomaly.parameter):
                        if anomaly.is_manual_override:
                            active_anomalies.pop(i)
                        break

        active_anomalies.extend([
            ThresholdCheckResult(
                parameter=an.parameter,
                actual_value=an.actual_value,
                level=an.threshold_level,
                min_value=an.threshold_min,
                max_value=an.threshold_max,
                deviation=an.deviation,
                severity="overridden",
                is_abnormal=False,
                description=f"[人工修正] {an.override_note or '已确认正常'}",
                recommendation="已人工确认，无需处理",
            )
            for an in diagnosis.anomalies if an.is_manual_override
        ])

        abnormal_count = len([a for a in active_anomalies if a.is_abnormal and a.severity != "overridden"])

        return DiagnosisReport(
            diagnosis_id=diagnosis.id,
            report_hash=diagnosis.report_hash,
            compressor_id=compressor.id,
            equipment_no=compressor.equipment_no,
            start_time=diagnosis.start_time,
            end_time=diagnosis.end_time,
            diagnosis_time=diagnosis.diagnosis_time,
            energy_stats=energy_stats,
            vibration_analysis=vibration_analysis,
            anomalies=active_anomalies,
            anomaly_score=diagnosis.anomaly_score or 0,
            abnormal_count=abnormal_count,
            overall_assessment=self._generate_overall_assessment(
                energy_stats, vibration_analysis, diagnosis.anomaly_score or 0, abnormal_count
            ),
            improvement_suggestions=self._generate_improvement_suggestions(
                energy_stats, vibration_analysis, active_anomalies
            ),
            raw_data_signature="",
        )

    def _calculate_energy_stats(
        self, records: List[models.EnergyRecord], rated_power: float
    ) -> EnergyStatistics:
        if not records:
            return EnergyStatistics(0, 0, 0, 0, 0, 0, 0, [], [])

        powers = [r.power or 0 for r in records]
        load_rates = [r.load_rate or 0 for r in records]
        times = [r.record_time for r in records]

        total_energy = 0
        for i in range(1, len(records)):
            dt = (times[i] - times[i-1]).total_seconds() / 3600
            avg_p = (powers[i] + powers[i-1]) / 2
            total_energy += avg_p * dt

        total_runtime = (times[-1] - times[0]).total_seconds() / 3600 if len(times) > 1 else 0

        avg_power = sum(powers) / len(powers) if powers else 0
        energy_efficiency = (avg_power / rated_power * 100) if rated_power > 0 else 0

        power_time_pairs = list(zip(times, powers))
        sorted_by_power = sorted(power_time_pairs, key=lambda x: x[1], reverse=True)
        peak_hours = sorted_by_power[:min(5, len(sorted_by_power))]
        off_peak_hours = sorted_by_power[-min(5, len(sorted_by_power)):]

        return EnergyStatistics(
            total_energy=round(total_energy, 2),
            avg_power=round(avg_power, 2),
            max_power=round(max(powers), 2),
            min_power=round(min(powers), 2),
            avg_load_rate=round(sum(load_rates) / len(load_rates), 2),
            total_runtime=round(total_runtime, 2),
            energy_efficiency=round(min(energy_efficiency, 100), 2),
            peak_hours=peak_hours,
            off_peak_hours=off_peak_hours,
        )

    def _detect_anomalies(
        self,
        energy_records: List[models.EnergyRecord],
        vibration_records: List[models.VibrationRecord],
    ) -> List[ThresholdCheckResult]:
        anomalies = []

        for record in energy_records:
            params_to_check = [
                ("power", record.power),
                ("current", record.current),
                ("temperature", record.temperature),
                ("pressure", record.pressure),
                ("load_rate", record.load_rate),
            ]

            for param, value in params_to_check:
                if value is not None:
                    result = threshold_manager.check_value(param, value)
                    result.record_time = record.record_time
                    if result.is_abnormal:
                        anomalies.append(result)

        for record in vibration_records:
            params_to_check = [
                ("overall_vibration", record.overall_vibration),
                ("x_vibration", record.x_vibration),
                ("y_vibration", record.y_vibration),
                ("z_vibration", record.z_vibration),
            ]

            for param, value in params_to_check:
                if value is not None:
                    result = threshold_manager.check_value(param, value)
                    result.record_time = record.record_time
                    if result.is_abnormal:
                        anomalies.append(result)

        return anomalies

    def _calculate_anomaly_score(self, anomalies: List[ThresholdCheckResult], total_records: int) -> float:
        if total_records == 0:
            return 0

        score = 0
        for anomaly in anomalies:
            if anomaly.severity == "critical":
                score += 10 * (1 + anomaly.deviation / 100)
            elif anomaly.severity == "warning":
                score += 3 * (1 + anomaly.deviation / 100)

        return round(min(score / max(total_records / 10, 1), 100), 2)

    def _generate_overall_assessment(
        self,
        energy_stats: EnergyStatistics,
        vibration_analysis: Optional[VibrationAnalysisResult],
        anomaly_score: float,
        abnormal_count: int,
    ) -> str:
        parts = []

        eff_check = threshold_manager.check_value("energy_efficiency", energy_stats.energy_efficiency)
        parts.append(f"能效{eff_check.severity}（{energy_stats.energy_efficiency:.1f}%），")

        load_check = threshold_manager.check_value("load_rate", energy_stats.avg_load_rate)
        parts.append(f"平均负载率{load_check.severity}（{energy_stats.avg_load_rate:.1f}%），")

        if vibration_analysis and vibration_analysis.overall_trend.avg_value > 0:
            vib_check = threshold_manager.check_value(
                "overall_vibration", vibration_analysis.overall_trend.avg_value
            )
            parts.append(f"振动{ vib_check.severity}（{vibration_analysis.overall_trend.avg_value:.2f}mm/s），")

        if anomaly_score >= 70:
            parts.append("异常风险高，")
        elif anomaly_score >= 30:
            parts.append("存在一定异常风险，")
        elif anomaly_score > 0:
            parts.append("异常风险较低，")
        else:
            parts.append("无明显异常，")

        if abnormal_count > 20:
            parts.append(f"共发现{abnormal_count}个异常点，需重点关注。")
        elif abnormal_count > 0:
            parts.append(f"共发现{abnormal_count}个异常点。")
        else:
            parts.append("运行状态良好。")

        return "".join(parts)

    def _generate_improvement_suggestions(
        self,
        energy_stats: EnergyStatistics,
        vibration_analysis: Optional[VibrationAnalysisResult],
        anomalies: List[ThresholdCheckResult],
    ) -> List[str]:
        suggestions = set()

        eff_check = threshold_manager.check_value("energy_efficiency", energy_stats.energy_efficiency)
        if eff_check.is_abnormal:
            suggestions.add(eff_check.recommendation)

        load_check = threshold_manager.check_value("load_rate", energy_stats.avg_load_rate)
        if load_check.is_abnormal:
            suggestions.add(load_check.recommendation)

        critical_anomalies = [a for a in anomalies if a.severity == "critical"]
        warning_anomalies = [a for a in anomalies if a.severity == "warning"]

        for anomaly in critical_anomalies[:5]:
            suggestions.add(anomaly.recommendation)

        for anomaly in warning_anomalies[:3]:
            suggestions.add(anomaly.recommendation)

        if vibration_analysis:
            for rec in vibration_analysis.recommendations[:3]:
                suggestions.add(rec)

        if energy_stats.avg_load_rate < 50:
            suggestions.add("建议优化运行调度，避免低负载运行造成能源浪费")

        if energy_stats.peak_hours and energy_stats.off_peak_hours:
            peak_avg = sum(p for _, p in energy_stats.peak_hours) / len(energy_stats.peak_hours)
            off_peak_avg = sum(p for _, p in energy_stats.off_peak_hours) / len(energy_stats.off_peak_hours)
            if peak_avg > off_peak_avg * 1.5:
                suggestions.add("负载波动较大，建议考虑配置储气罐平抑峰值")

        if not suggestions:
            suggestions.add("设备运行状态良好，继续保持正常巡检")

        return list(suggestions)

    def _save_diagnosis(
        self,
        db: Session,
        compressor_id: int,
        start_time: datetime,
        end_time: datetime,
        diagnosis_type: str,
        energy_stats: EnergyStatistics,
        anomalies: List[ThresholdCheckResult],
        anomaly_score: float,
        abnormal_count: int,
        report_hash: str,
        batch_id: Optional[str],
        existing_diagnosis: Optional[models.Diagnosis] = None,
    ) -> models.Diagnosis:

        if existing_diagnosis:
            existing_diagnosis.diagnosis_time = datetime.now()
            existing_diagnosis.energy_consumption = energy_stats.total_energy
            existing_diagnosis.energy_efficiency = energy_stats.energy_efficiency
            existing_diagnosis.load_rate_avg = energy_stats.avg_load_rate
            existing_diagnosis.anomaly_score = anomaly_score
            existing_diagnosis.abnormal_count = abnormal_count
            existing_diagnosis.report_hash = report_hash
            existing_diagnosis.status = "pending"
            if batch_id:
                existing_diagnosis.batch_id = batch_id

            db.query(models.Anomaly).filter(
                models.Anomaly.diagnosis_id == existing_diagnosis.id
            ).delete()

            diagnosis_obj = existing_diagnosis
        else:
            diagnosis_obj = models.Diagnosis(
                compressor_id=compressor_id,
                diagnosis_time=datetime.now(),
                diagnosis_type=diagnosis_type,
                start_time=start_time,
                end_time=end_time,
                energy_consumption=energy_stats.total_energy,
                energy_efficiency=energy_stats.energy_efficiency,
                load_rate_avg=energy_stats.avg_load_rate,
                anomaly_score=anomaly_score,
                abnormal_count=abnormal_count,
                status="pending",
                batch_id=batch_id,
                report_hash=report_hash,
            )
            db.add(diagnosis_obj)
            db.flush()

        for anomaly in anomalies:
            if anomaly.is_abnormal:
                anomaly_obj = models.Anomaly(
                    diagnosis_id=diagnosis_obj.id,
                    record_time=getattr(anomaly, 'record_time', datetime.now()),
                    parameter=anomaly.parameter,
                    actual_value=anomaly.actual_value,
                    threshold_level=anomaly.level,
                    threshold_min=anomaly.min_value,
                    threshold_max=anomaly.max_value,
                    deviation=anomaly.deviation,
                    severity=anomaly.severity,
                    description=anomaly.description,
                    recommendation=anomaly.recommendation,
                )
                db.add(anomaly_obj)

        return diagnosis_obj

    def _save_vibration_snapshot(
        self,
        equipment_no: str,
        start_time: datetime,
        end_time: datetime,
        snapshot_data: str,
    ) -> str:
        import os
        from ..database import DATA_DIR

        vib_dir = os.path.join(DATA_DIR, "vibration_snapshots")
        os.makedirs(vib_dir, exist_ok=True)

        filename = f"{equipment_no}_{start_time.strftime('%Y%m%d')}_{end_time.strftime('%Y%m%d')}_{datetime.now().strftime('%H%M%S')}.json"
        filepath = os.path.join(vib_dir, filename)

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(snapshot_data)

        return filepath


energy_diagnosis_model = EnergyDiagnosisModel()
