from typing import Dict, Tuple, Optional
import numpy as np


class UnitConverter:
    def __init__(self):
        self.flow_factors = {
            'l/h': 1.0,
            'lph': 1.0,
            'liter/hour': 1.0,
            '升/小时': 1.0,
            
            'ml/min': 16.6666667,
            'ml/minute': 16.6666667,
            '毫升/分钟': 16.6666667,
            
            'ml/h': 0.001,
            '毫升/小时': 0.001,
            
            'l/min': 60.0,
            '升/分钟': 60.0,
            
            'm3/h': 1000.0,
            'm³/h': 1000.0,
            '立方米/小时': 1000.0,
            
            'gpm': 227.124707,
            'gallon/minute': 227.124707,
        }
        
        self.concentration_factors = {
            'mg/l': 1.0,
            'mg/liter': 1.0,
            '毫克/升': 1.0,
            
            'ppm': 1.0,
            'parts per million': 1.0,
            
            'g/m3': 1.0,
            '克/立方米': 1.0,
            
            'ug/l': 0.001,
            'ug/liter': 0.001,
            '微克/升': 0.001,
            'ppb': 0.001,
            
            'g/l': 1000.0,
            'g/liter': 1000.0,
            '克/升': 1000.0,
            
            '%': 10000.0,
            'percent': 10000.0,
            '重量百分比': 10000.0,
            
            'kg/m3': 1000.0,
            '千克/立方米': 1000.0,
        }
        
        self.volume_factors = {
            'l': 1.0,
            'liter': 1.0,
            '升': 1.0,
            
            'ml': 0.001,
            'milliliter': 0.001,
            '毫升': 0.001,
            
            'm3': 1000.0,
            'm³': 1000.0,
            'cubic meter': 1000.0,
            '立方米': 1000.0,
            
            'gallon': 3.785411784,
            '加仑': 3.785411784,
        }
        
        self.time_factors = {
            'hour': 1.0,
            'h': 1.0,
            '小时': 1.0,
            
            'minute': 1/60,
            'min': 1/60,
            '分钟': 1/60,
            
            'second': 1/3600,
            'sec': 1/3600,
            's': 1/3600,
            '秒': 1/3600,
            
            'day': 24.0,
            'd': 24.0,
            '天': 24.0,
        }
    
    def _normalize_unit(self, unit: str) -> str:
        if not unit:
            return ''
        return unit.lower().strip().replace(' ', '')
    
    def convert_flow(self, value: float, from_unit: str, to_unit: str = 'l/h') -> float:
        from_norm = self._normalize_unit(from_unit)
        to_norm = self._normalize_unit(to_unit)
        
        if from_norm not in self.flow_factors:
            raise ValueError(f"未知的流量单位: {from_unit}")
        
        if to_norm not in self.flow_factors:
            raise ValueError(f"未知的流量单位: {to_unit}")
        
        from_factor = self.flow_factors[from_norm]
        to_factor = self.flow_factors[to_norm]
        
        return value * from_factor / to_factor
    
    def convert_concentration(self, value: float, from_unit: str, to_unit: str = 'mg/l') -> float:
        from_norm = self._normalize_unit(from_unit)
        to_norm = self._normalize_unit(to_unit)
        
        if from_norm not in self.concentration_factors:
            raise ValueError(f"未知的浓度单位: {from_unit}")
        
        if to_norm not in self.concentration_factors:
            raise ValueError(f"未知的浓度单位: {to_unit}")
        
        from_factor = self.concentration_factors[from_norm]
        to_factor = self.concentration_factors[to_norm]
        
        return value * from_factor / to_factor
    
    def convert_volume(self, value: float, from_unit: str, to_unit: str = 'l') -> float:
        from_norm = self._normalize_unit(from_unit)
        to_norm = self._normalize_unit(to_unit)
        
        if from_norm not in self.volume_factors:
            raise ValueError(f"未知的体积单位: {from_unit}")
        
        if to_norm not in self.volume_factors:
            raise ValueError(f"未知的体积单位: {to_unit}")
        
        from_factor = self.volume_factors[from_norm]
        to_factor = self.volume_factors[to_norm]
        
        return value * from_factor / to_factor
    
    def convert_time(self, value: float, from_unit: str, to_unit: str = 'hour') -> float:
        from_norm = self._normalize_unit(from_unit)
        to_norm = self._normalize_unit(to_unit)
        
        if from_norm not in self.time_factors:
            raise ValueError(f"未知的时间单位: {from_unit}")
        
        if to_norm not in self.time_factors:
            raise ValueError(f"未知的时间单位: {to_unit}")
        
        from_factor = self.time_factors[from_norm]
        to_factor = self.time_factors[to_norm]
        
        return value * from_factor / to_factor


class DosageCalculator:
    def __init__(self):
        self.unit_converter = UnitConverter()
    
    def calculate_required_flow(
        self,
        target_concentration: float,
        target_concentration_unit: str,
        stock_concentration: float,
        stock_concentration_unit: str,
        process_flow_rate: float,
        process_flow_unit: str = 'm3/h'
    ) -> Tuple[float, str]:
        target_mg_l = self.unit_converter.convert_concentration(
            target_concentration, target_concentration_unit, 'mg/l'
        )
        stock_mg_l = self.unit_converter.convert_concentration(
            stock_concentration, stock_concentration_unit, 'mg/l'
        )
        process_m3_h = self.unit_converter.convert_flow(
            process_flow_rate, process_flow_unit, 'm3/h'
        )
        
        if stock_mg_l <= 0:
            raise ValueError("母液浓度必须大于0")
        
        if target_mg_l < 0:
            raise ValueError("目标浓度不能为负数")
        
        required_flow_m3_h = (target_mg_l * process_m3_h) / stock_mg_l
        
        required_flow_l_h = required_flow_m3_h * 1000
        
        return required_flow_l_h, 'l/h'
    
    def calculate_actual_dosage(
        self,
        measured_concentration: float,
        measured_conc_unit: str,
        sample_volume: float,
        sample_volume_unit: str,
        pump_speed: float,
        stock_concentration: float,
        stock_conc_unit: str,
        process_flow_rate: float,
        process_flow_unit: str = 'm3/h'
    ) -> Dict:
        measured_mg_l = self.unit_converter.convert_concentration(
            measured_concentration, measured_conc_unit, 'mg/l'
        )
        stock_mg_l = self.unit_converter.convert_concentration(
            stock_concentration, stock_conc_unit, 'mg/l'
        )
        sample_l = self.unit_converter.convert_volume(
            sample_volume, sample_volume_unit, 'l'
        )
        process_m3_h = self.unit_converter.convert_flow(
            process_flow_rate, process_flow_unit, 'm3/h'
        )
        
        theoretical_mg_l = (stock_mg_l * 1000) / process_m3_h if process_m3_h > 0 else 0
        
        recovery_rate = (measured_mg_l / theoretical_mg_l * 100) if theoretical_mg_l > 0 else 0
        
        return {
            'measured_concentration_mg_l': measured_mg_l,
            'theoretical_concentration_mg_l': theoretical_mg_l,
            'recovery_rate_percent': recovery_rate,
            'deviation_percent': recovery_rate - 100.0,
            'sample_volume_l': sample_l,
        }
    
    def calculate_error(
        self,
        measured_value: float,
        reference_value: float
    ) -> Dict:
        if reference_value <= 0:
            return {
                'absolute_error': measured_value - reference_value,
                'relative_error': float('nan'),
                'relative_error_percent': float('nan')
            }
        
        absolute_error = measured_value - reference_value
        relative_error = absolute_error / reference_value
        
        return {
            'absolute_error': absolute_error,
            'relative_error': relative_error,
            'relative_error_percent': relative_error * 100.0
        }


unit_converter = UnitConverter()
dosage_calculator = DosageCalculator()
