import pandas as pd
import numpy as np
from typing import Dict, Any


class LeqCalculator:
    def calculate(
        self,
        data: pd.DataFrame,
        time_col: str,
        noise_col: str
    ) -> Dict[str, Any]:
        if len(data) == 0:
            return {
                'leq': 0.0,
                'Lmax': 0.0,
                'Lmin': 0.0,
                'L10': 0.0,
                'L50': 0.0,
                'L90': 0.0,
                'L95': 0.0,
                'std': 0.0,
                'mean': 0.0,
                'n_samples': 0,
                'duration_seconds': 0
            }
        
        noise_values = data[noise_col].astype(float)
        
        leq = self._calculate_leq(noise_values)
        
        sorted_values = np.sort(noise_values)
        
        Lmax = float(np.max(noise_values))
        Lmin = float(np.min(noise_values))
        mean = float(np.mean(noise_values))
        std = float(np.std(noise_values, ddof=0))
        
        L10 = float(np.percentile(sorted_values, 90, method='linear'))
        L50 = float(np.percentile(sorted_values, 50, method='linear'))
        L90 = float(np.percentile(sorted_values, 10, method='linear'))
        L95 = float(np.percentile(sorted_values, 5, method='linear'))
        
        duration_seconds = self._calculate_duration(data, time_col)
        
        return {
            'leq': leq,
            'Lmax': Lmax,
            'Lmin': Lmin,
            'L10': L10,
            'L50': L50,
            'L90': L90,
            'L95': L95,
            'mean': mean,
            'std': std,
            'n_samples': len(noise_values),
            'duration_seconds': duration_seconds,
            'calculation_method': '能量平均法 (10*log10(mean(10^(L/10))))'
        }
    
    def _calculate_leq(self, noise_values: np.ndarray) -> float:
        if len(noise_values) == 0:
            return 0.0
        
        energy_values = 10 ** (noise_values / 10.0)
        mean_energy = np.mean(energy_values)
        leq = 10 * np.log10(mean_energy)
        
        return float(leq)
    
    def _calculate_duration(self, data: pd.DataFrame, time_col: str) -> float:
        try:
            times = pd.to_datetime(data[time_col])
            times = times.dropna()
            if len(times) < 2:
                return 0.0
            duration = (times.max() - times.min()).total_seconds()
            return float(duration)
        except Exception:
            return 0.0
    
    def calculate_periodic_leq(
        self,
        data: pd.DataFrame,
        time_col: str,
        noise_col: str,
        period: str = 'H'
    ) -> pd.DataFrame:
        if len(data) == 0:
            return pd.DataFrame()
        
        df = data.copy()
        try:
            df[time_col] = pd.to_datetime(df[time_col])
            df['_period'] = df[time_col].dt.to_period(period)
        except Exception:
            return pd.DataFrame()
        
        results = []
        for period_name, group in df.groupby('_period'):
            noise = group[noise_col].astype(float)
            leq = self._calculate_leq(noise)
            results.append({
                'period': str(period_name),
                'start_time': group[time_col].min(),
                'end_time': group[time_col].max(),
                'n_samples': len(group),
                'leq': leq,
                'Lmax': float(noise.max()),
                'Lmin': float(noise.min())
            })
        
        return pd.DataFrame(results)
