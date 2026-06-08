import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from pathlib import Path
import sys
sys.path.append(str(Path(__file__).parent.parent))
from config import DIRECTION_GROUPS, DIRECTION_ALIASES


@dataclass
class CalibrationResult:
    bias: float
    scale_factor: float
    rmse: float
    mae: float
    max_error: float
    min_error: float
    std_error: float
    r_squared: float
    calibration_curve: List[Tuple[float, float]]
    corrected_values: List[float]
    residuals: List[float]


class LaserRangeCalibrator:
    def __init__(self):
        self.calibration_result = None
        self.correction_model = None
        self.calibration_history = []
        
    def linear_calibration(self, raw_values: np.ndarray, reference_values: np.ndarray) -> CalibrationResult:
        raw_values = np.array(raw_values, dtype=float)
        reference_values = np.array(reference_values, dtype=float)
        
        valid_mask = ~np.isnan(raw_values) & ~np.isnan(reference_values)
        raw_clean = raw_values[valid_mask]
        ref_clean = reference_values[valid_mask]
        
        if len(raw_clean) < 2:
            raise ValueError("有效数据点不足，无法进行校准")
            
        A = np.vstack([raw_clean, np.ones(len(raw_clean))]).T
        scale, bias = np.linalg.lstsq(A, ref_clean, rcond=None)[0]
        
        corrected = scale * raw_clean + bias
        residuals = ref_clean - corrected
        
        ss_res = np.sum(residuals ** 2)
        ss_tot = np.sum((ref_clean - np.mean(ref_clean)) ** 2)
        r_squared = 1 - (ss_res / ss_tot) if ss_tot != 0 else 0
        
        rmse = np.sqrt(np.mean(residuals ** 2))
        mae = np.mean(np.abs(residuals))
        max_error = np.max(np.abs(residuals))
        min_error = np.min(np.abs(residuals))
        std_error = np.std(residuals)
        
        sorted_indices = np.argsort(raw_clean)
        calibration_curve = list(zip(raw_clean[sorted_indices], corrected[sorted_indices]))
        
        result = CalibrationResult(
            bias=bias,
            scale_factor=scale,
            rmse=rmse,
            mae=mae,
            max_error=max_error,
            min_error=min_error,
            std_error=std_error,
            r_squared=r_squared,
            calibration_curve=calibration_curve,
            corrected_values=corrected.tolist(),
            residuals=residuals.tolist()
        )
        
        self.calibration_result = result
        self.correction_model = {'scale': scale, 'bias': bias}
        self.calibration_history.append(result)
        
        return result
    
    def piecewise_linear_calibration(self, raw_values: np.ndarray, 
                                      reference_values: np.ndarray,
                                      segments: int = 3) -> CalibrationResult:
        raw_values = np.array(raw_values, dtype=float)
        reference_values = np.array(reference_values, dtype=float)
        
        valid_mask = ~np.isnan(raw_values) & ~np.isnan(reference_values)
        raw_clean = raw_values[valid_mask]
        ref_clean = reference_values[valid_mask]
        
        sorted_indices = np.argsort(raw_clean)
        raw_sorted = raw_clean[sorted_indices]
        ref_sorted = ref_clean[sorted_indices]
        
        segment_size = len(raw_sorted) // segments
        breakpoints = []
        
        for i in range(1, segments):
            idx = i * segment_size
            breakpoints.append(raw_sorted[idx])
            
        self.breakpoints = breakpoints
        self.segment_models = []
        
        corrected = np.zeros_like(raw_clean)
        
        for i in range(segments):
            start_idx = i * segment_size
            end_idx = (i + 1) * segment_size if i < segments - 1 else len(raw_sorted)
            
            seg_raw = raw_sorted[start_idx:end_idx]
            seg_ref = ref_sorted[start_idx:end_idx]
            
            A = np.vstack([seg_raw, np.ones(len(seg_raw))]).T
            scale, bias = np.linalg.lstsq(A, seg_ref, rcond=None)[0]
            
            self.segment_models.append({'scale': scale, 'bias': bias})
            corrected[start_idx:end_idx] = scale * seg_raw + bias
            
        residuals = ref_sorted - corrected
        
        rmse = np.sqrt(np.mean(residuals ** 2))
        mae = np.mean(np.abs(residuals))
        max_error = np.max(np.abs(residuals))
        min_error = np.min(np.abs(residuals))
        std_error = np.std(residuals)
        
        ss_res = np.sum(residuals ** 2)
        ss_tot = np.sum((ref_sorted - np.mean(ref_sorted)) ** 2)
        r_squared = 1 - (ss_res / ss_tot) if ss_tot != 0 else 0
        
        calibration_curve = list(zip(raw_sorted, corrected))
        
        full_corrected = np.zeros_like(raw_values)
        full_residuals = np.zeros_like(raw_values)
        
        valid_indices = np.where(valid_mask)[0]
        for i, orig_idx in enumerate(valid_indices):
            sorted_pos = np.where(sorted_indices == i)[0][0]
            full_corrected[orig_idx] = corrected[sorted_pos]
            full_residuals[orig_idx] = residuals[sorted_pos]
        
        result = CalibrationResult(
            bias=np.mean([m['bias'] for m in self.segment_models]),
            scale_factor=np.mean([m['scale'] for m in self.segment_models]),
            rmse=rmse,
            mae=mae,
            max_error=max_error,
            min_error=min_error,
            std_error=std_error,
            r_squared=r_squared,
            calibration_curve=calibration_curve,
            corrected_values=full_corrected.tolist(),
            residuals=full_residuals.tolist()
        )
        
        self.calibration_result = result
        self.correction_model = {'scale': result.scale_factor, 'bias': result.bias}
        return result
    
    def apply_correction(self, raw_value: float) -> float:
        if self.correction_model is None:
            return raw_value
            
        scale = self.correction_model['scale']
        bias = self.correction_model['bias']
        
        return scale * raw_value + bias
    
    def apply_correction_batch(self, raw_values: np.ndarray) -> np.ndarray:
        if self.correction_model is None:
            return np.array(raw_values)
            
        scale = self.correction_model['scale']
        bias = self.correction_model['bias']
        
        return scale * np.array(raw_values) + bias
    
    def temperature_compensation(self, raw_values: np.ndarray, 
                                  temperatures: np.ndarray,
                                  ref_temperature: float = 20.0) -> np.ndarray:
        raw_values = np.array(raw_values, dtype=float)
        temperatures = np.array(temperatures, dtype=float)
        
        temp_coefficient = 1e-5
        
        temp_diff = temperatures - ref_temperature
        compensated = raw_values * (1 + temp_coefficient * temp_diff)
        
        return compensated
    
    def get_error_statistics(self, raw_values: np.ndarray, 
                              reference_values: np.ndarray) -> Dict:
        raw_values = np.array(raw_values, dtype=float)
        reference_values = np.array(reference_values, dtype=float)
        
        valid_mask = ~np.isnan(raw_values) & ~np.isnan(reference_values)
        errors = reference_values[valid_mask] - raw_values[valid_mask]
        
        return {
            'mean_error': np.mean(errors),
            'std_error': np.std(errors),
            'max_error': np.max(np.abs(errors)),
            'min_error': np.min(np.abs(errors)),
            'rmse': np.sqrt(np.mean(errors ** 2)),
            'mae': np.mean(np.abs(errors)),
            'error_percentiles': {
                'p25': np.percentile(errors, 25),
                'p50': np.percentile(errors, 50),
                'p75': np.percentile(errors, 75),
                'p95': np.percentile(errors, 95)
            }
        }
    
    def direction_analysis(self, raw_values: np.ndarray, 
                            reference_values: np.ndarray,
                            directions: List[str]) -> Dict:
        raw_values = np.array(raw_values, dtype=float)
        reference_values = np.array(reference_values, dtype=float)
        directions = np.array(directions)
        
        result = {}
        
        positive_set = set(DIRECTION_GROUPS.get('正向', []))
        negative_set = set(DIRECTION_GROUPS.get('反向', []))
        
        def normalize_dir(d):
            mapped = DIRECTION_ALIASES.get(d, d)
            if mapped in positive_set or d in positive_set:
                return '正向'
            if mapped in negative_set or d in negative_set:
                return '反向'
            return None
        
        positive_mask = np.array([normalize_dir(d) == '正向' for d in directions])
        negative_mask = np.array([normalize_dir(d) == '反向' for d in directions])
        
        if np.any(positive_mask):
            pos_errors = reference_values[positive_mask] - raw_values[positive_mask]
            result['正向'] = {
                'count': np.sum(positive_mask),
                'mean_error': np.mean(pos_errors),
                'std_error': np.std(pos_errors),
                'rmse': np.sqrt(np.mean(pos_errors ** 2))
            }
            
        if np.any(negative_mask):
            neg_errors = reference_values[negative_mask] - raw_values[negative_mask]
            result['反向'] = {
                'count': np.sum(negative_mask),
                'mean_error': np.mean(neg_errors),
                'std_error': np.std(neg_errors),
                'rmse': np.sqrt(np.mean(neg_errors ** 2))
            }
            
        if '正向' in result and '反向' in result:
            result['方向差异'] = {
                'bias_diff': abs(result['正向']['mean_error'] - result['反向']['mean_error']),
                'has_hysteresis': abs(result['正向']['mean_error'] - result['反向']['mean_error']) > result['正向']['std_error']
            }
            
        return result
