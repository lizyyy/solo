import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from config import AppConfig


@dataclass
class InverterEfficiencyResult:
    inverter_id: str
    sample_count: int
    raw_generation: float
    theoretical_generation: float
    measured_efficiency: float
    adjusted_efficiency: float
    temperature_correction_factor: float
    performance_ratio: float
    specific_yield: float
    capacity_utilization: float
    data_quality_score: float
    rank: Optional[int] = None
    rank_reason: Optional[str] = None


@dataclass
class CalculationResult:
    row_level_data: pd.DataFrame
    inverter_level_data: pd.DataFrame
    overall_metrics: Dict[str, float]
    calculation_metadata: Dict[str, any]


class EfficiencyCalculator:
    def __init__(self, config: AppConfig):
        self.config = config
        self.calc_config = config.calculation

    def _estimate_capacity(self, df: pd.DataFrame) -> Dict[str, float]:
        if 'capacity' in df.columns and df['capacity'].notna().sum() > 0:
            capacity_map = {}
            for inv_id, group in df.groupby('inverter_id'):
                valid_cap = group['capacity'].dropna()
                if len(valid_cap) > 0:
                    capacity_map[str(inv_id)] = float(valid_cap.median())
                else:
                    gen_max = group['generation'].max()
                    capacity_map[str(inv_id)] = float(gen_max * 1.5) if pd.notna(gen_max) and gen_max > 0 else 500.0
            return capacity_map

        capacity_map = {}
        for inv_id, group in df.groupby('inverter_id'):
            gen_max = group['generation'].max()
            if pd.notna(gen_max) and gen_max > 0:
                capacity = gen_max * 1.5
            else:
                capacity = 500.0
            capacity_map[str(inv_id)] = capacity
        return capacity_map

    def _estimate_sampling_interval(self, df: pd.DataFrame) -> float:
        if df is None or len(df) < 2:
            return 1.0

        if 'inverter_id' not in df.columns or 'timestamp' not in df.columns:
            return 1.0

        all_intervals = []
        for _, group in df.groupby('inverter_id'):
            timestamps = pd.to_datetime(group['timestamp'], errors='coerce').dropna().sort_values()
            if len(timestamps) >= 2:
                intervals = timestamps.diff().dropna()
                if len(intervals) > 0:
                    all_intervals.append(intervals.median())

        if len(all_intervals) == 0:
            return 1.0

        all_intervals_series = pd.Series(all_intervals)
        median_interval = all_intervals_series.median()
        hours = median_interval.total_seconds() / 3600.0
        return max(hours, 0.0833)

    def _calculate_temperature_correction(self, temperature: float) -> float:
        delta_T = temperature - self.calc_config.reference_temperature
        factor = 1 + self.calc_config.temperature_coefficient * delta_T
        return max(factor, 0.5)

    def _calculate_theoretical_generation(
        self,
        irradiance: float,
        temperature: float,
        capacity: float,
        sampling_interval: float
    ) -> Tuple[float, float]:
        if irradiance <= 0 or capacity <= 0:
            return 0.0, 1.0

        temp_factor = self._calculate_temperature_correction(temperature)
        stc_ratio = irradiance / self.calc_config.stc_irradiance
        dc_power = capacity * stc_ratio * temp_factor
        dc_energy = dc_power * sampling_interval

        return dc_energy, temp_factor

    def _calculate_row_level_metrics(
        self,
        df: pd.DataFrame,
        capacity_map: Dict[str, float],
        sampling_interval: float
    ) -> pd.DataFrame:
        result_df = df.copy()

        result_df['capacity'] = result_df['inverter_id'].apply(
            lambda x: capacity_map.get(str(x), 500.0)
        )

        theoreticals = []
        temp_factors = []
        measured_effs = []

        for _, row in result_df.iterrows():
            theo, temp_factor = self._calculate_theoretical_generation(
                irradiance=float(row['irradiance']),
                temperature=float(row['temperature']),
                capacity=float(row['capacity']),
                sampling_interval=sampling_interval
            )

            theoreticals.append(theo)
            temp_factors.append(temp_factor)

            if theo > 0:
                measured_eff = min(float(row['generation']) / theo, 2.0)
            else:
                measured_eff = np.nan
            measured_effs.append(measured_eff)

        result_df['theoretical_generation'] = theoreticals
        result_df['temperature_correction_factor'] = temp_factors
        result_df['measured_efficiency'] = measured_effs

        return result_df

    def _calculate_inverter_level_metrics(
        self,
        df: pd.DataFrame,
        qc_issues_by_inv: Dict[str, Dict[str, int]],
        total_issues_by_inv: Dict[str, int]
    ) -> pd.DataFrame:
        inverter_metrics = []

        for inv_id, group in df.groupby('inverter_id'):
            inv_id_str = str(inv_id)

            total_gen = float(group['generation'].sum())
            total_theo = float(group['theoretical_generation'].sum())
            sample_count = len(group)

            valid_effs = group['measured_efficiency'].dropna()
            if len(valid_effs) > 0:
                measured_eff = float(valid_effs.mean())
                median_eff = float(valid_effs.median())
            else:
                measured_eff = np.nan
                median_eff = np.nan

            avg_temp_factor = float(group['temperature_correction_factor'].mean())
            adjusted_eff = measured_eff / avg_temp_factor if avg_temp_factor > 0 and pd.notna(measured_eff) else np.nan

            total_irradiance = float(group['irradiance'].sum())
            capacity = float(group['capacity'].iloc[0]) if len(group) > 0 else 500.0

            if total_irradiance > 0 and capacity > 0:
                pr = total_gen / (capacity * total_irradiance / self.calc_config.stc_irradiance)
                pr = min(max(pr, 0.0), 2.0)
            else:
                pr = np.nan

            specific_yield = total_gen / capacity if capacity > 0 else np.nan

            if total_theo > 0:
                cap_util = total_gen / total_theo
            else:
                cap_util = np.nan

            inv_issues = total_issues_by_inv.get(inv_id_str, 0)
            total_records = sample_count + inv_issues
            if total_records > 0:
                quality_score = max(0.0, 1.0 - (inv_issues / total_records) * 0.5)
            else:
                quality_score = 0.0

            inverter_metrics.append(InverterEfficiencyResult(
                inverter_id=inv_id_str,
                sample_count=sample_count,
                raw_generation=total_gen,
                theoretical_generation=total_theo,
                measured_efficiency=measured_eff,
                adjusted_efficiency=adjusted_eff,
                temperature_correction_factor=avg_temp_factor,
                performance_ratio=pr,
                specific_yield=specific_yield,
                capacity_utilization=cap_util,
                data_quality_score=quality_score
            ))

        result_df = pd.DataFrame([vars(m) for m in inverter_metrics])

        if len(result_df) > 0:
            valid_mask = result_df['adjusted_efficiency'].notna() & (result_df['data_quality_score'] >= 0.5)
            result_df.loc[valid_mask, 'rank'] = result_df.loc[valid_mask, 'adjusted_efficiency'].rank(
                ascending=False, method='min'
            ).astype(int)

            for idx, row in result_df.iterrows():
                reasons = []
                if pd.isna(row['adjusted_efficiency']):
                    reasons.append("有效样本不足，无法计算效率")
                if row['data_quality_score'] < 0.5:
                    reasons.append(f"数据质量过低 ({row['data_quality_score']:.2f} < 0.50)")
                if row['sample_count'] < 10:
                    reasons.append(f"样本量不足 ({row['sample_count']} < 10)")
                result_df.at[idx, 'rank_reason'] = "; ".join(reasons) if reasons else None

        return result_df.sort_values('rank', na_position='last').reset_index(drop=True)

    def _calculate_overall_metrics(
        self,
        inverter_df: pd.DataFrame,
        row_df: pd.DataFrame
    ) -> Dict[str, float]:
        metrics = {}

        if len(inverter_df) > 0:
            valid_inv = inverter_df[inverter_df['adjusted_efficiency'].notna()]
            if len(valid_inv) > 0:
                metrics['average_measured_efficiency'] = float(valid_inv['measured_efficiency'].mean())
                metrics['average_adjusted_efficiency'] = float(valid_inv['adjusted_efficiency'].mean())
                metrics['average_pr'] = float(valid_inv['performance_ratio'].mean())
                metrics['median_adjusted_efficiency'] = float(valid_inv['adjusted_efficiency'].median())
                metrics['efficiency_std'] = float(valid_inv['adjusted_efficiency'].std())
                metrics['max_efficiency'] = float(valid_inv['adjusted_efficiency'].max())
                metrics['min_efficiency'] = float(valid_inv['adjusted_efficiency'].min())

        metrics['total_inverters'] = int(len(inverter_df))
        metrics['ranked_inverters'] = int(inverter_df['rank'].notna().sum())
        metrics['total_valid_samples'] = int(len(row_df))

        return metrics

    def run(
        self,
        clean_df: pd.DataFrame,
        qc_result
    ) -> CalculationResult:
        capacity_map = self._estimate_capacity(clean_df)
        sampling_interval = self._estimate_sampling_interval(clean_df)

        row_level = self._calculate_row_level_metrics(
            clean_df,
            capacity_map,
            sampling_interval
        )

        issues_by_type = {}
        issues_by_count = {}
        for inv_id, data in qc_result.by_inverter.items():
            issues_by_type[inv_id] = data.get('issues_by_type', {})
            issues_by_count[inv_id] = data.get('total_issues', 0)

        inverter_level = self._calculate_inverter_level_metrics(
            row_level,
            issues_by_type,
            issues_by_count
        )

        overall = self._calculate_overall_metrics(inverter_level, row_level)

        metadata = {
            'nominal_inverter_efficiency': self.calc_config.inverter_efficiency_nominal,
            'temperature_coefficient': self.calc_config.temperature_coefficient,
            'reference_temperature_celsius': self.calc_config.reference_temperature,
            'stc_irradiance_wm2': self.calc_config.stc_irradiance,
            'estimated_sampling_interval_hours': sampling_interval,
            'dc_ac_ratio_assumed': self.calc_config.dc_ac_ratio,
            'calculation_timestamp': pd.Timestamp.now().isoformat()
        }

        return CalculationResult(
            row_level_data=row_level,
            inverter_level_data=inverter_level,
            overall_metrics=overall,
            calculation_metadata=metadata
        )
