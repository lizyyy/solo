import pandas as pd
import numpy as np
from config import (
    IRRIGATION_THRESHOLD_LOW,
    IRRIGATION_THRESHOLD_HIGH,
    RANDOM_SEED
)


class IrrigationSimulator:
    def __init__(self, threshold_low=None, threshold_high=None):
        self.threshold_low = threshold_low or IRRIGATION_THRESHOLD_LOW
        self.threshold_high = threshold_high or IRRIGATION_THRESHOLD_HIGH
        np.random.seed(RANDOM_SEED)
        
    def simulate(self, df, noise_level=0.05):
        if df is None or len(df) == 0:
            return {
                'simulation_data': pd.DataFrame(),
                'statistics': {}
            }
        
        df = df.copy()
        df = df.sort_values('timestamp').reset_index(drop=True)
        
        df['humidity_noise'] = df['humidity'] + np.random.normal(0, noise_level * 100, len(df))
        df['humidity_noise'] = df['humidity_noise'].clip(0, 100)
        
        df['should_irrigate'] = (df['humidity_noise'] < self.threshold_low).astype(int)
        df['should_stop'] = (df['humidity_noise'] > self.threshold_high).astype(int)
        
        df['irrigation_decision'] = 0
        irrigation_active = False
        
        for idx, row in df.iterrows():
            if row['should_irrigate'] == 1 and not irrigation_active:
                df.loc[idx, 'irrigation_decision'] = 1
                irrigation_active = True
            elif row['should_stop'] == 1 and irrigation_active:
                df.loc[idx, 'irrigation_decision'] = 0
                irrigation_active = False
            else:
                df.loc[idx, 'irrigation_decision'] = 1 if irrigation_active else 0
        
        df['actual_irrigation'] = df.get('irrigation', 0)
        df['decision_match'] = (df['irrigation_decision'] == df['actual_irrigation']).astype(int)
        
        over_irrigated = ((df['irrigation_decision'] == 1) & (df['humidity_noise'] > self.threshold_high + 5)).sum()
        under_irrigated = ((df['irrigation_decision'] == 0) & (df['humidity_noise'] < self.threshold_low - 5)).sum()
        
        statistics = {
            'threshold_low': self.threshold_low,
            'threshold_high': self.threshold_high,
            'total_samples': len(df),
            'irrigation_activated': (df['irrigation_decision'] == 1).sum(),
            'irrigation_deactivated': (df['irrigation_decision'] == 0).sum(),
            'over_irrigation_risk': over_irrigated,
            'under_irrigation_risk': under_irrigated,
            'decision_accuracy': df['decision_match'].mean(),
            'avg_humidity': df['humidity_noise'].mean(),
            'min_humidity': df['humidity_noise'].min(),
            'max_humidity': df['humidity_noise'].max(),
            'noise_level': noise_level
        }
        
        return {
            'simulation_data': df,
            'statistics': statistics
        }
    
    def simulate_multiple_thresholds(self, df, threshold_pairs, noise_level=0.05):
        results = []
        
        for low, high in threshold_pairs:
            simulator = IrrigationSimulator(low, high)
            result = simulator.simulate(df, noise_level)
            results.append({
                'threshold_low': low,
                'threshold_high': high,
                'statistics': result['statistics'],
                'simulation_data': result['simulation_data']
            })
        
        return results
    
    def analyze_threshold_sensitivity(self, df, noise_levels=[0.02, 0.05, 0.1, 0.15]):
        sensitivity_results = []
        
        for noise in noise_levels:
            result = self.simulate(df, noise)
            sensitivity_results.append({
                'noise_level': noise,
                'statistics': result['statistics'],
                'simulation_data': result['simulation_data']
            })
        
        return sensitivity_results
