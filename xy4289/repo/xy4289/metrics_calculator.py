import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from collections import defaultdict
import config


class MetricsCalculator:
    def __init__(self, data_parser):
        self.data_parser = data_parser
        self.machine_metrics: Dict[str, Any] = {}
        self.water_metrics: Dict[str, Any] = {}
        self.patient_metrics: Dict[str, Any] = {}

    def calculate_machine_load(self) -> Dict[str, Any]:
        machine_records = self.data_parser.machine_records
        if machine_records is None or machine_records.empty:
            return {}

        machines = machine_records['machine_id'].unique()
        dates = sorted(machine_records['date'].unique())

        load_matrix = {}
        consecutive_days = {}

        for machine in machines:
            machine_df = machine_records[machine_records['machine_id'] == machine].copy()
            daily_hours = defaultdict(float)

            for _, row in machine_df.iterrows():
                if pd.notna(row['date']):
                    daily_hours[row['date']] += row['duration_hours']

            load_by_date = {}
            for date in dates:
                load_by_date[date] = daily_hours.get(date, 0)

            load_matrix[machine] = load_by_date

            max_consecutive = 0
            current_consecutive = 0
            sorted_dates = sorted(dates)
            for i, date in enumerate(sorted_dates):
                if daily_hours.get(date, 0) > 0:
                    if i == 0:
                        current_consecutive = 1
                    else:
                        prev_date = sorted_dates[i-1]
                        if (date - prev_date).days == 1:
                            current_consecutive += 1
                        else:
                            current_consecutive = 1
                    max_consecutive = max(max_consecutive, current_consecutive)
                else:
                    current_consecutive = 0

            consecutive_days[machine] = max_consecutive

        self.machine_metrics = {
            'load_matrix': load_matrix,
            'consecutive_days': consecutive_days,
            'machines': list(machines),
            'dates': dates
        }
        return self.machine_metrics

    def calculate_disinfection_intervals(self) -> Dict[str, List[Dict[str, Any]]]:
        machine_records = self.data_parser.machine_records
        if machine_records is None or machine_records.empty:
            return {}

        machines = machine_records['machine_id'].unique()
        intervals = defaultdict(list)

        for machine in machines:
            machine_df = machine_records[machine_records['machine_id'] == machine].copy()
            machine_df = machine_df.sort_values('end_time').reset_index(drop=True)

            if len(machine_df) < 2:
                continue

            for i in range(1, len(machine_df)):
                prev_end = machine_df.iloc[i-1]['end_time']
                curr_start = machine_df.iloc[i]['start_time']

                if pd.notna(prev_end) and pd.notna(curr_start):
                    interval_hours = (curr_start - prev_end).total_seconds() / 3600
                    intervals[machine].append({
                        'prev_session_end': prev_end,
                        'curr_session_start': curr_start,
                        'interval_hours': interval_hours,
                        'patient_id_prev': machine_df.iloc[i-1].get('patient_id', None),
                        'patient_id_curr': machine_df.iloc[i].get('patient_id', None)
                    })

        return dict(intervals)

    def calculate_water_quality_status(self) -> Dict[str, Any]:
        water_quality = self.data_parser.water_quality
        if water_quality is None or water_quality.empty:
            return {'status': 'no_data'}

        latest_test = water_quality.sort_values('test_time', ascending=False).iloc[0]

        anomalies = []
        overall_status = 'normal'

        conductivity = latest_test.get('conductivity', np.nan)
        if not pd.isna(conductivity):
            if conductivity > config.WATER_QUALITY_THRESHOLDS['conductivity']:
                anomalies.append({
                    'parameter': 'conductivity',
                    'value': conductivity,
                    'threshold': config.WATER_QUALITY_THRESHOLDS['conductivity'],
                    'status': 'high'
                })
                overall_status = 'warning'

        bacteria_count = latest_test.get('bacteria_count', np.nan)
        if not pd.isna(bacteria_count):
            if bacteria_count > config.WATER_QUALITY_THRESHOLDS['bacteria_count']:
                anomalies.append({
                    'parameter': 'bacteria_count',
                    'value': bacteria_count,
                    'threshold': config.WATER_QUALITY_THRESHOLDS['bacteria_count'],
                    'status': 'high'
                })
                overall_status = 'warning'

        endotoxin = latest_test.get('endotoxin', np.nan)
        if not pd.isna(endotoxin):
            if endotoxin > config.WATER_QUALITY_THRESHOLDS['endotoxin']:
                anomalies.append({
                    'parameter': 'endotoxin',
                    'value': endotoxin,
                    'threshold': config.WATER_QUALITY_THRESHOLDS['endotoxin'],
                    'status': 'high'
                })
                overall_status = 'critical' if overall_status == 'warning' else 'warning'

        self.water_metrics = {
            'latest_test_time': latest_test['test_time'],
            'overall_status': overall_status,
            'anomalies': anomalies,
            'all_tests': water_quality.to_dict('records')
        }
        return self.water_metrics

    def calculate_patient_risk_alignment(self) -> Dict[str, Any]:
        patient_schedule = self.data_parser.patient_schedule
        machine_records = self.data_parser.machine_records

        if patient_schedule is None or patient_schedule.empty:
            return {}

        high_risk_patients = patient_schedule[patient_schedule['is_high_risk']]

        risk_sessions = []
        for _, patient in high_risk_patients.iterrows():
            risk_sessions.append({
                'patient_id': patient['patient_id'],
                'patient_name': patient.get('patient_name', ''),
                'infection_type': patient['infection_type'],
                'treatment_time': patient['treatment_time'],
                'machine_id': patient.get('machine_id', None),
                'date': patient['date']
            })

        self.patient_metrics = {
            'high_risk_count': len(high_risk_patients),
            'risk_sessions': risk_sessions,
            'total_patients': len(patient_schedule)
        }
        return self.patient_metrics

    def calculate_all_metrics(self) -> Dict[str, Any]:
        return {
            'machine_load': self.calculate_machine_load(),
            'disinfection_intervals': self.calculate_disinfection_intervals(),
            'water_quality': self.calculate_water_quality_status(),
            'patient_risk': self.calculate_patient_risk_alignment()
        }
