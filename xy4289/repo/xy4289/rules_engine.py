import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from enum import Enum
import config


class RiskLevel(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass
class RiskAlert:
    alert_id: str
    risk_level: RiskLevel
    category: str
    machine_id: Optional[str] = None
    patient_id: Optional[str] = None
    description: str = ""
    recommendation: str = ""
    affected_time: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class RulesEngine:
    def __init__(self, metrics_calculator, data_parser):
        self.metrics_calculator = metrics_calculator
        self.data_parser = data_parser
        self.alerts: List[RiskAlert] = []
        self.recommendations: List[Dict[str, Any]] = []
        self._alert_counter = 0

    def _generate_alert_id(self) -> str:
        self._alert_counter += 1
        return f"ALERT-{datetime.now().strftime('%Y%m%d')}-{self._alert_counter:04d}"

    def check_high_load(self) -> List[RiskAlert]:
        alerts = []
        machine_metrics = self.metrics_calculator.machine_metrics

        if not machine_metrics or 'load_matrix' not in machine_metrics:
            return alerts

        load_matrix = machine_metrics['load_matrix']
        consecutive_days = machine_metrics.get('consecutive_days', {})

        for machine_id, daily_load in load_matrix.items():
            for date, hours in daily_load.items():
                if hours > config.MAX_MACHINE_HOURS_PER_DAY:
                    alert = RiskAlert(
                        alert_id=self._generate_alert_id(),
                        risk_level=RiskLevel.HIGH,
                        category="high_load",
                        machine_id=machine_id,
                        description=f"机器 {machine_id} 在 {date} 的运行时间为 {hours:.1f} 小时，超过每日最大限值 {config.MAX_MACHINE_HOURS_PER_DAY} 小时",
                        recommendation=f"建议将机器 {machine_id} 在 {date} 的部分透析任务转移到其他负载较低的机器",
                        affected_time=datetime.combine(date, datetime.min.time()),
                        metadata={
                            'actual_hours': hours,
                            'threshold': config.MAX_MACHINE_HOURS_PER_DAY,
                            'date': date
                        }
                    )
                    alerts.append(alert)

            max_consecutive = consecutive_days.get(machine_id, 0)
            if max_consecutive > config.MAX_CONSECUTIVE_DAYS:
                alert = RiskAlert(
                    alert_id=self._generate_alert_id(),
                    risk_level=RiskLevel.CRITICAL,
                    category="consecutive_overuse",
                    machine_id=machine_id,
                    description=f"机器 {machine_id} 连续运行 {max_consecutive} 天，超过最大连续天数限值 {config.MAX_CONSECUTIVE_DAYS} 天",
                    recommendation=f"机器 {machine_id} 需要强制停机休息至少1天，建议安排预防性维护",
                    metadata={
                        'actual_days': max_consecutive,
                        'threshold': config.MAX_CONSECUTIVE_DAYS
                    }
                )
                alerts.append(alert)

        self.alerts.extend(alerts)
        return alerts

    def check_disinfection_intervals(self) -> List[RiskAlert]:
        alerts = []
        intervals = self.metrics_calculator.calculate_disinfection_intervals()

        for machine_id, session_intervals in intervals.items():
            for interval in session_intervals:
                if interval['interval_hours'] < config.DISINFECTION_INTERVAL_HOURS:
                    alert = RiskAlert(
                        alert_id=self._generate_alert_id(),
                        risk_level=RiskLevel.CRITICAL,
                        category="disinfection_violation",
                        machine_id=machine_id,
                        patient_id=interval.get('patient_id_curr'),
                        description=f"机器 {machine_id} 消毒间隔不足：前次透析结束于 {interval['prev_session_end']}，本次开始于 {interval['curr_session_start']}，间隔仅 {interval['interval_hours']:.1f} 小时，低于要求的 {config.DISINFECTION_INTERVAL_HOURS} 小时",
                        recommendation=f"立即对机器 {machine_id} 进行强化消毒，建议对涉及的患者 {interval.get('patient_id_curr', '未知')} 进行感染风险评估",
                        affected_time=interval['curr_session_start'],
                        metadata={
                            'actual_interval': interval['interval_hours'],
                            'required_interval': config.DISINFECTION_INTERVAL_HOURS,
                            'prev_session': interval['prev_session_end'],
                            'curr_session': interval['curr_session_start']
                        }
                    )
                    alerts.append(alert)

        self.alerts.extend(alerts)
        return alerts

    def check_water_quality_risk(self) -> List[RiskAlert]:
        alerts = []
        water_metrics = self.metrics_calculator.water_metrics

        if not water_metrics or water_metrics.get('overall_status') == 'normal':
            return alerts

        anomalies = water_metrics.get('anomalies', [])
        patient_schedule = self.data_parser.patient_schedule

        for anomaly in anomalies:
            param = anomaly['parameter']
            value = anomaly['value']
            threshold = anomaly['threshold']

            alert = RiskAlert(
                alert_id=self._generate_alert_id(),
                risk_level=RiskLevel.HIGH if param != 'endotoxin' else RiskLevel.CRITICAL,
                category="water_quality_anomaly",
                description=f"水质检测异常：{param} 检测值为 {value}，超过阈值 {threshold}",
                recommendation=f"检查水处理系统，确认问题原因。在水质恢复正常前，暂停高风险患者透析",
                affected_time=water_metrics.get('latest_test_time'),
                metadata={
                    'parameter': param,
                    'actual_value': value,
                    'threshold': threshold
                }
            )
            alerts.append(alert)

        if patient_schedule is not None and not patient_schedule.empty:
            high_risk_patients = patient_schedule[patient_schedule['is_high_risk']]
            latest_test_time = water_metrics.get('latest_test_time')

            if latest_test_time:
                test_date = latest_test_time.date()
                for _, patient in high_risk_patients.iterrows():
                    if pd.notna(patient['date']) and patient['date'] >= test_date:
                        alert = RiskAlert(
                            alert_id=self._generate_alert_id(),
                            risk_level=RiskLevel.CRITICAL,
                            category="high_risk_patient_water_risk",
                            patient_id=patient['patient_id'],
                            machine_id=patient.get('machine_id'),
                            description=f"高风险患者 {patient['patient_id']} ({patient['infection_type']}) 安排在水质异常时间 {patient['date']} 进行透析",
                            recommendation=f"立即将患者 {patient['patient_id']} 转移到水质正常时段或其他可用机器，或推迟透析",
                            affected_time=patient['treatment_time'],
                            metadata={
                                'infection_type': patient['infection_type'],
                                'patient_name': patient.get('patient_name', '')
                            }
                        )
                        alerts.append(alert)

        self.alerts.extend(alerts)
        return alerts

    def check_maintenance_conflicts(self) -> List[RiskAlert]:
        alerts = []
        maintenance = self.data_parser.maintenance_records
        machine_records = self.data_parser.machine_records

        if maintenance is None or maintenance.empty:
            return alerts

        if machine_records is None or machine_records.empty:
            return alerts

        for _, fault in maintenance.iterrows():
            fault_time = fault['fault_time']
            resolved_time = fault['resolved_time']
            machine_id = fault['machine_id']

            if pd.isna(fault_time):
                continue

            if pd.isna(resolved_time):
                alert = RiskAlert(
                    alert_id=self._generate_alert_id(),
                    risk_level=RiskLevel.HIGH,
                    category="unresolved_maintenance",
                    machine_id=machine_id,
                    description=f"机器 {machine_id} 存在未解决的故障，故障时间：{fault_time}",
                    recommendation=f"优先处理机器 {machine_id} 的故障维修，确认维修完成后再安排透析任务",
                    affected_time=fault_time,
                    metadata={
                        'fault_description': fault.get('fault_description', ''),
                        'fault_type': fault.get('fault_type', '')
                    }
                )
                alerts.append(alert)

            machine_sessions = machine_records[machine_records['machine_id'] == machine_id]
            for _, session in machine_sessions.iterrows():
                session_start = session['start_time']
                session_end = session['end_time']

                if pd.isna(session_start) or pd.isna(fault_time):
                    continue

                if pd.isna(resolved_time):
                    if session_start >= fault_time:
                        alert = RiskAlert(
                            alert_id=self._generate_alert_id(),
                            risk_level=RiskLevel.CRITICAL,
                            category="session_during_unresolved_fault",
                            machine_id=machine_id,
                            patient_id=session.get('patient_id'),
                            description=f"机器 {machine_id} 在未解决故障期间安排了透析任务，时间：{session_start}",
                            recommendation=f"立即取消或转移该透析任务，机器 {machine_id} 存在未解决故障",
                            affected_time=session_start,
                            metadata={
                                'session_id': session.get('session_id'),
                                'fault_time': fault_time
                            }
                        )
                        alerts.append(alert)
                else:
                    if (session_start <= resolved_time and session_end >= fault_time):
                        alert = RiskAlert(
                            alert_id=self._generate_alert_id(),
                            risk_level=RiskLevel.MEDIUM,
                            category="session_near_maintenance",
                            machine_id=machine_id,
                            patient_id=session.get('patient_id'),
                            description=f"机器 {machine_id} 的透析任务与维修时间重叠或接近，透析时间：{session_start}",
                            recommendation=f"核实机器 {machine_id} 在透析前是否已完成维修并通过性能验证",
                            affected_time=session_start,
                            metadata={
                                'session_id': session.get('session_id'),
                                'fault_time': fault_time,
                                'resolved_time': resolved_time
                            }
                        )
                        alerts.append(alert)

        self.alerts.extend(alerts)
        return alerts

    def generate_recommendations(self) -> List[Dict[str, Any]]:
        self.recommendations = []

        for alert in self.alerts:
            rec = {
                'alert_id': alert.alert_id,
                'risk_level': alert.risk_level.value,
                'category': alert.category,
                'machine_id': alert.machine_id,
                'patient_id': alert.patient_id,
                'problem': alert.description,
                'recommendation': alert.recommendation,
                'affected_time': alert.affected_time.isoformat() if alert.affected_time else None,
                'priority': self._get_priority_score(alert.risk_level)
            }
            self.recommendations.append(rec)

        self.recommendations.sort(key=lambda x: x['priority'], reverse=True)
        return self.recommendations

    def _get_priority_score(self, risk_level: RiskLevel) -> int:
        scores = {
            RiskLevel.CRITICAL: 4,
            RiskLevel.HIGH: 3,
            RiskLevel.MEDIUM: 2,
            RiskLevel.LOW: 1
        }
        return scores.get(risk_level, 0)

    def run_all_checks(self) -> Dict[str, Any]:
        self.alerts = []
        self._alert_counter = 0

        self.check_high_load()
        self.check_disinfection_intervals()
        self.check_water_quality_risk()
        self.check_maintenance_conflicts()

        self.generate_recommendations()

        risk_counts = {
            'critical': len([a for a in self.alerts if a.risk_level == RiskLevel.CRITICAL]),
            'high': len([a for a in self.alerts if a.risk_level == RiskLevel.HIGH]),
            'medium': len([a for a in self.alerts if a.risk_level == RiskLevel.MEDIUM]),
            'low': len([a for a in self.alerts if a.risk_level == RiskLevel.LOW]),
        }

        return {
            'alerts': self.alerts,
            'recommendations': self.recommendations,
            'risk_counts': risk_counts,
            'total_alerts': len(self.alerts)
        }
