import pandas as pd
import numpy as np
from typing import Dict, List, Any, Tuple
from dataclasses import dataclass


@dataclass
class FuelAnalysis:
    record_id: str
    vehicle_id: str
    expected_fuel: float
    actual_fuel: float
    fuel_deviation: float
    fuel_deviation_percent: float
    mileage_factor: float
    load_factor: float
    idle_factor: float
    fuel_per_km: float
    is_anomaly: bool
    anomaly_cause: str = ""


class FuelAnalyzer:
    """油耗分析引擎"""
    
    def __init__(self):
        self.vehicle_params = {
            '垃圾清运车': {
                'base_fuel_per_km': 0.55,
                'load_sensitivity': 0.01,
                'idle_fuel_per_min': 0.02,
                'normal_load_range': (4000, 8000),
                'normal_idle_range': (20, 70),
            },
            '道路清扫车': {
                'base_fuel_per_km': 0.58,
                'load_sensitivity': 0.008,
                'idle_fuel_per_min': 0.025,
                'normal_load_range': (2000, 5000),
                'normal_idle_range': (40, 90),
            },
            '洒水车': {
                'base_fuel_per_km': 1.10,
                'load_sensitivity': 0.015,
                'idle_fuel_per_min': 0.015,
                'normal_load_range': (6000, 12000),
                'normal_idle_range': (15, 50),
            },
        }
        
        self.anomaly_thresholds = {
            'fuel_deviation_percent': 30.0,
            'fuel_per_km_high': 2.0,
            'fuel_per_km_low': 0.1,
        }
    
    def analyze(self, df: pd.DataFrame) -> List[FuelAnalysis]:
        analyses = []
        
        for idx, row in df.iterrows():
            analysis = self._analyze_single_record(row)
            analyses.append(analysis)
        
        return analyses
    
    def _analyze_single_record(self, row: pd.Series) -> FuelAnalysis:
        vehicle_type = str(row.get('vehicle_type', '垃圾清运车'))
        params = self.vehicle_params.get(vehicle_type, self.vehicle_params['垃圾清运车'])
        
        actual_fuel = float(row.get('fuel_consumption', 0))
        mileage = float(row.get('route_mileage', 0))
        load_weight = float(row.get('load_weight', 0))
        idle_time = float(row.get('idle_time', 0))
        
        mileage_factor = self._calculate_mileage_factor(mileage, vehicle_type)
        load_factor = self._calculate_load_factor(load_weight, params)
        idle_factor = self._calculate_idle_factor(idle_time, params)
        
        expected_fuel = self._calculate_expected_fuel(
            mileage, load_weight, idle_time, params
        )
        
        fuel_deviation = actual_fuel - expected_fuel
        fuel_deviation_percent = (fuel_deviation / expected_fuel * 100) if expected_fuel > 0 else 0
        
        fuel_per_km = actual_fuel / mileage if mileage > 0 else 0
        
        is_anomaly, cause = self._detect_anomaly(
            actual_fuel, expected_fuel, fuel_deviation_percent,
            fuel_per_km, mileage_factor, load_factor, idle_factor
        )
        
        return FuelAnalysis(
            record_id=str(row.get('record_id', '')),
            vehicle_id=str(row.get('vehicle_id', '')),
            expected_fuel=round(expected_fuel, 2),
            actual_fuel=round(actual_fuel, 2),
            fuel_deviation=round(fuel_deviation, 2),
            fuel_deviation_percent=round(fuel_deviation_percent, 2),
            mileage_factor=round(mileage_factor, 3),
            load_factor=round(load_factor, 3),
            idle_factor=round(idle_factor, 3),
            fuel_per_km=round(fuel_per_km, 3),
            is_anomaly=is_anomaly,
            anomaly_cause=cause
        )
    
    def _calculate_mileage_factor(self, mileage: float, vehicle_type: str) -> float:
        base_mileages = {
            '垃圾清运车': 80,
            '道路清扫车': 60,
            '洒水车': 50,
        }
        base = base_mileages.get(vehicle_type, 70)
        
        if mileage <= 0:
            return 0.0
        
        ratio = mileage / base
        if ratio < 0.5:
            return 1.2
        elif ratio > 1.5:
            return 0.9
        return 1.0
    
    def _calculate_load_factor(self, load_weight: float, params: Dict) -> float:
        min_load, max_load = params['normal_load_range']
        
        if load_weight <= 0:
            return 0.5
        
        avg_load = (min_load + max_load) / 2
        return load_weight / avg_load
    
    def _calculate_idle_factor(self, idle_time: float, params: Dict) -> float:
        min_idle, max_idle = params['normal_idle_range']
        
        if idle_time <= 0:
            return 0.3
        
        avg_idle = (min_idle + max_idle) / 2
        return idle_time / avg_idle
    
    def _calculate_expected_fuel(
        self, mileage: float, load_weight: float, 
        idle_time: float, params: Dict
    ) -> float:
        base_fuel = mileage * params['base_fuel_per_km']
        
        load_impact = (load_weight / 1000) * params['load_sensitivity'] * mileage
        
        idle_impact = idle_time * params['idle_fuel_per_min']
        
        expected_fuel = base_fuel + load_impact + idle_impact
        
        return max(1.0, expected_fuel)
    
    def _detect_anomaly(
        self, actual_fuel: float, expected_fuel: float, 
        deviation_percent: float, fuel_per_km: float,
        mileage_factor: float, load_factor: float, idle_factor: float
    ) -> Tuple[bool, str]:
        causes = []
        
        if abs(deviation_percent) > self.anomaly_thresholds['fuel_deviation_percent']:
            if deviation_percent > 0:
                causes.append("油耗异常偏高")
            else:
                causes.append("油耗异常偏低")
        
        if fuel_per_km > self.anomaly_thresholds['fuel_per_km_high']:
            causes.append("百公里油耗超出正常范围")
        elif fuel_per_km < self.anomaly_thresholds['fuel_per_km_low'] and fuel_per_km > 0:
            causes.append("百公里油耗异常偏低")
        
        if mileage_factor < 0.6:
            causes.append("路线里程异常偏低")
        elif mileage_factor > 1.4:
            causes.append("路线里程异常偏高")
        
        if load_factor < 0.3:
            causes.append("载重记录异常偏低")
        elif load_factor > 2.0:
            causes.append("载重记录异常偏高")
        
        if idle_factor < 0.2:
            causes.append("怠速时间异常偏低")
        elif idle_factor > 3.0:
            causes.append("怠速时间异常偏高")
        
        is_anomaly = len(causes) > 0
        cause_str = "; ".join(causes) if causes else ""
        
        return is_anomaly, cause_str
    
    def get_summary_statistics(self, analyses: List[FuelAnalysis]) -> Dict[str, Any]:
        if not analyses:
            return {}
        
        deviations = [a.fuel_deviation_percent for a in analyses]
        fuel_per_kms = [a.fuel_per_km for a in analyses if a.fuel_per_km > 0]
        
        anomaly_count = sum(1 for a in analyses if a.is_anomaly)
        
        return {
            'total_records': len(analyses),
            'anomaly_count': anomaly_count,
            'anomaly_rate': anomaly_count / len(analyses) * 100,
            'avg_fuel_deviation_percent': np.mean(deviations),
            'max_fuel_deviation_percent': np.max(deviations),
            'min_fuel_deviation_percent': np.min(deviations),
            'avg_fuel_per_km': np.mean(fuel_per_kms) if fuel_per_kms else 0,
            'max_fuel_per_km': np.max(fuel_per_kms) if fuel_per_kms else 0,
            'min_fuel_per_km': np.min(fuel_per_kms) if fuel_per_kms else 0,
        }