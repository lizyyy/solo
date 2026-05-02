from datetime import date, datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
import pandas as pd
import numpy as np

from config import config
from src.models import SummaryMetrics


class MetricsCalculator:
    def __init__(self):
        pass

    def calculate_compliance_rate(
        self, 
        training_records: List[Dict[str, Any]], 
        period_start: date, 
        period_end: date
    ) -> Tuple[float, int, int]:
        if not training_records:
            return 0.0, 0, 0

        df = pd.DataFrame(training_records)
        if "date" not in df.columns or "is_completed" not in df.columns:
            return 0.0, 0, 0

        df["date"] = pd.to_datetime(df["date"]).dt.date
        mask = (df["date"] >= period_start) & (df["date"] <= period_end)
        period_df = df.loc[mask].copy()

        if len(period_df) == 0:
            return 0.0, 0, 0

        unique_dates = period_df["date"].unique()
        total_training_days = len(unique_dates)
        
        completed_dates = []
        for d in unique_dates:
            day_records = period_df[period_df["date"] == d]
            has_completed = day_records["is_completed"].any()
            if has_completed:
                completed_dates.append(d)
        
        completed_training_days = len(completed_dates)
        
        if total_training_days > 0:
            compliance_rate = completed_training_days / total_training_days
        else:
            compliance_rate = 0.0

        return round(compliance_rate, 4), total_training_days, completed_training_days

    def calculate_average_duration(
        self,
        training_records: List[Dict[str, Any]],
        period_start: date,
        period_end: date
    ) -> float:
        if not training_records:
            return 0.0

        df = pd.DataFrame(training_records)
        if "date" not in df.columns or "duration_minutes" not in df.columns:
            return 0.0

        df["date"] = pd.to_datetime(df["date"]).dt.date
        mask = (df["date"] >= period_start) & (df["date"] <= period_end)
        period_df = df.loc[mask].copy()

        if len(period_df) == 0:
            return 0.0

        valid_durations = period_df["duration_minutes"].dropna()
        if len(valid_durations) == 0:
            return 0.0

        return round(valid_durations.mean(), 2)

    def calculate_pain_metrics(
        self,
        pain_records: List[Dict[str, Any]],
        period_start: date,
        period_end: date
    ) -> Tuple[float, float]:
        if not pain_records:
            return 0.0, 0.0

        df = pd.DataFrame(pain_records)
        if "date" not in df.columns or "pain_score" not in df.columns:
            return 0.0, 0.0

        df["date"] = pd.to_datetime(df["date"]).dt.date
        mask = (df["date"] >= period_start) & (df["date"] <= period_end)
        period_df = df.loc[mask].copy()

        if len(period_df) == 0:
            return 0.0, 0.0

        valid_pain = period_df["pain_score"].dropna()
        if len(valid_pain) == 0:
            return 0.0, 0.0

        average_pain = round(valid_pain.mean(), 2)

        period_df_sorted = period_df.sort_values("date")
        first_valid = period_df_sorted["pain_score"].dropna().iloc[0] if len(period_df_sorted["pain_score"].dropna()) > 0 else 0
        last_valid = period_df_sorted["pain_score"].dropna().iloc[-1] if len(period_df_sorted["pain_score"].dropna()) > 0 else 0
        pain_change = round(last_valid - first_valid, 2)

        return average_pain, pain_change

    def calculate_movement_metrics(
        self,
        movement_records: List[Dict[str, Any]],
        period_start: date,
        period_end: date
    ) -> Tuple[float, float]:
        if not movement_records:
            return 0.0, 0.0

        df = pd.DataFrame(movement_records)
        if "date" not in df.columns or "completion_score" not in df.columns:
            return 0.0, 0.0

        df["date"] = pd.to_datetime(df["date"]).dt.date
        mask = (df["date"] >= period_start) & (df["date"] <= period_end)
        period_df = df.loc[mask].copy()

        if len(period_df) == 0:
            return 0.0, 0.0

        valid_scores = period_df["completion_score"].dropna()
        if len(valid_scores) == 0:
            return 0.0, 0.0

        average_score = round(valid_scores.mean(), 2)
        
        if len(valid_scores) > 1:
            volatility = round(valid_scores.std() / valid_scores.mean() if valid_scores.mean() > 0 else 0.0, 4)
        else:
            volatility = 0.0

        return average_score, volatility

    def calculate_missed_days(
        self,
        training_records: List[Dict[str, Any]],
        period_start: date,
        period_end: date
    ) -> Tuple[int, int]:
        if not training_records:
            return 0, 0

        df = pd.DataFrame(training_records)
        if "date" not in df.columns or "is_completed" not in df.columns:
            return 0, 0

        df["date"] = pd.to_datetime(df["date"]).dt.date
        
        all_dates = set()
        current = period_start
        while current <= period_end:
            all_dates.add(current)
            current += timedelta(days=1)

        unique_dates = df["date"].unique()
        training_dates = set(d for d in unique_dates if isinstance(d, date) and period_start <= d <= period_end)
        
        completed_dates = set()
        for d in training_dates:
            day_records = df[df["date"] == d]
            if day_records["is_completed"].any():
                completed_dates.add(d)

        missed_dates = training_dates - completed_dates
        missed_count = len(missed_dates)

        max_consecutive_missed = 0
        if missed_dates:
            sorted_missed = sorted(missed_dates)
            current_streak = 1
            max_streak = 1
            
            for i in range(1, len(sorted_missed)):
                if (sorted_missed[i] - sorted_missed[i-1]).days == 1:
                    current_streak += 1
                    max_streak = max(max_streak, current_streak)
                else:
                    current_streak = 1
            
            max_consecutive_missed = max_streak

        return missed_count, max_consecutive_missed

    def get_training_programs(
        self,
        training_records: List[Dict[str, Any]],
        period_start: date,
        period_end: date
    ) -> List[str]:
        if not training_records:
            return []

        df = pd.DataFrame(training_records)
        if "date" not in df.columns or "training_program" not in df.columns:
            return []

        df["date"] = pd.to_datetime(df["date"]).dt.date
        mask = (df["date"] >= period_start) & (df["date"] <= period_end)
        period_df = df.loc[mask].copy()

        if len(period_df) == 0:
            return []

        programs = period_df["training_program"].dropna().unique().tolist()
        return [str(p) for p in programs]

    def get_notes_history(
        self,
        training_records: List[Dict[str, Any]],
        pain_records: List[Dict[str, Any]],
        movement_records: List[Dict[str, Any]],
        period_start: date,
        period_end: date
    ) -> List[Dict[str, Any]]:
        notes = []

        for records, record_type in [
            (training_records, "training"),
            (pain_records, "pain"),
            (movement_records, "movement"),
        ]:
            if records:
                df = pd.DataFrame(records)
                if "date" in df.columns and "notes" in df.columns:
                    df["date"] = pd.to_datetime(df["date"]).dt.date
                    mask = (df["date"] >= period_start) & (df["date"] <= period_end)
                    period_df = df.loc[mask].copy()
                    
                    for _, row in period_df.iterrows():
                        note_text = row.get("notes")
                        if note_text and pd.notna(note_text) and str(note_text).strip():
                            notes.append({
                                "date": row["date"],
                                "type": record_type,
                                "note": str(note_text).strip(),
                            })

        notes.sort(key=lambda x: x["date"])
        return notes

    def calculate_summary_metrics(
        self,
        patient_id: str,
        training_records: List[Dict[str, Any]],
        pain_records: List[Dict[str, Any]],
        movement_records: List[Dict[str, Any]],
        period_start: date,
        period_end: date
    ) -> SummaryMetrics:
        compliance_rate, total_training_days, completed_training_days = self.calculate_compliance_rate(
            training_records, period_start, period_end
        )
        
        average_duration = self.calculate_average_duration(
            training_records, period_start, period_end
        )
        
        average_pain_score, pain_score_change = self.calculate_pain_metrics(
            pain_records, period_start, period_end
        )
        
        average_movement_score, movement_volatility = self.calculate_movement_metrics(
            movement_records, period_start, period_end
        )
        
        missed_days_count, consecutive_missed_days = self.calculate_missed_days(
            training_records, period_start, period_end
        )
        
        training_programs = self.get_training_programs(
            training_records, period_start, period_end
        )
        
        notes_history = self.get_notes_history(
            training_records, pain_records, movement_records, period_start, period_end
        )

        return SummaryMetrics(
            patient_id=patient_id,
            period_start=period_start,
            period_end=period_end,
            total_training_days=total_training_days,
            completed_training_days=completed_training_days,
            compliance_rate=compliance_rate,
            average_duration_minutes=average_duration,
            average_pain_score=average_pain_score,
            pain_score_change=pain_score_change,
            average_movement_score=average_movement_score,
            movement_volatility=movement_volatility,
            missed_days_count=missed_days_count,
            consecutive_missed_days=consecutive_missed_days,
            training_programs=training_programs,
            notes_history=notes_history,
            calculated_at=datetime.now(),
        )

    def calculate_batch_metrics(
        self,
        data_by_patient: Dict[str, Any],
        period_start: date,
        period_end: date
    ) -> Dict[str, SummaryMetrics]:
        results = {}

        for patient_id, patient_data in data_by_patient.items():
            training_records = patient_data.get("training", [])
            pain_records = patient_data.get("pain", [])
            movement_records = patient_data.get("movement", [])

            metrics = self.calculate_summary_metrics(
                patient_id=patient_id,
                training_records=training_records,
                pain_records=pain_records,
                movement_records=movement_records,
                period_start=period_start,
                period_end=period_end
            )

            results[patient_id] = metrics

        return results
