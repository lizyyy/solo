import pandas as pd
import numpy as np
import logging
from typing import Dict, List, Tuple, Any
from scipy.interpolate import interp1d, CubicSpline, PchipInterpolator
from config import CONFIG


logger = logging.getLogger(__name__)


class GapFiller:
    def __init__(self, config: Dict = None):
        self.config = config or CONFIG
        self.fill_results: List[Dict] = []
        self.fill_method_stats: Dict[str, int] = {}
        
    def fill_gaps(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict]:
        logger.info("开始缺测补全处理")
        
        time_col = self.config['time_column']
        value_col = self.config['value_column']
        station_col = self.config['station_column']
        
        df = df.copy()
        df['filled_value'] = df[value_col].copy()
        df['fill_method'] = ''
        df['is_filled'] = False
        
        self.fill_results = []
        self.fill_method_stats = {}
        
        stations = df[station_col].unique()
        
        for station in stations:
            station_mask = df[station_col] == station
            station_df = df.loc[station_mask].copy()
            
            need_fill_mask = station_df['qc_flag'] != 'PASS'
            need_fill_indices = station_df[need_fill_mask].index.tolist()
            
            if not need_fill_indices:
                continue
                
            logger.info(f"站点 {station}: 有 {len(need_fill_indices)} 条记录需要补全")
            
            fill_mask = station_df['qc_flag'] == 'PASS'
            valid_df = station_df[fill_mask].copy()
            
            if len(valid_df) < 3:
                logger.warning(f"站点 {station} 有效数据不足，尝试使用其他站点数据")
                filled_idx = self._fill_with_other_stations(
                    df, station, need_fill_indices, station_col, value_col, time_col
                )
            else:
                for idx in need_fill_indices:
                    current_time = df.at[idx, time_col]
                    
                    method = self._select_best_method(station_df, idx, time_col, value_col)
                    
                    if method == 'linear':
                        filled_val = self._linear_interpolate(station_df, idx, time_col, value_col)
                    elif method == 'polynomial':
                        filled_val = self._polynomial_interpolate(station_df, idx, time_col, value_col)
                    elif method == 'spline':
                        filled_val = self._spline_interpolate(station_df, idx, time_col, value_col)
                    elif method == 'neighbor_weighted':
                        filled_val = self._neighbor_weighted_interpolate(
                            df, idx, station, time_col, value_col, station_col
                        )
                    else:
                        filled_val = self._linear_interpolate(station_df, idx, time_col, value_col)
                        method = 'linear'
                        
                    if filled_val is not None:
                        df.at[idx, 'filled_value'] = max(0, filled_val)
                        df.at[idx, 'fill_method'] = method
                        df.at[idx, 'is_filled'] = True
                        
                        original_val = df.at[idx, value_col]
                        
                        self.fill_results.append({
                            'index': idx,
                            'station': station,
                            'time': current_time,
                            'original_value': original_val,
                            'filled_value': max(0, filled_val),
                            'method': method,
                            'original_flag': df.at[idx, 'qc_flag'],
                            'original_reason': df.at[idx, 'qc_reason']
                        })
                        
                        if method not in self.fill_method_stats:
                            self.fill_method_stats[method] = 0
                        self.fill_method_stats[method] += 1
                        
        fill_summary = self._generate_fill_summary(df)
        logger.info(f"补全完成，共处理 {len(self.fill_results)} 条记录")
        
        return df, fill_summary
        
    def _select_best_method(self, station_df: pd.DataFrame, idx: int, 
                          time_col: str, value_col: str) -> str:
        methods = self.config['interpolation_methods']
        
        valid_mask = station_df['qc_flag'] == 'PASS'
        valid_before = station_df[valid_mask & (station_df.index < idx)]
        valid_after = station_df[valid_mask & (station_df.index > idx)]
        
        has_before = len(valid_before) > 0
        has_after = len(valid_after) > 0
        
        if not has_before or not has_after:
            return 'linear'
            
        if len(valid_before) + len(valid_after) >= 5:
            return 'spline'
        elif len(valid_before) + len(valid_after) >= 3:
            return 'polynomial'
        else:
            return 'linear'
            
    def _linear_interpolate(self, station_df: pd.DataFrame, idx: int,
                          time_col: str, value_col: str) -> float:
        valid_mask = station_df['qc_flag'] == 'PASS'
        
        before_df = station_df[valid_mask & (station_df.index < idx)]
        after_df = station_df[valid_mask & (station_df.index > idx)]
        
        if len(before_df) == 0 or len(after_df) == 0:
            if len(before_df) > 0:
                return before_df.iloc[-1][value_col]
            elif len(after_df) > 0:
                return after_df.iloc[0][value_col]
            return None
            
        before_row = before_df.iloc[-1]
        after_row = after_df.iloc[0]
        
        t0 = before_row[time_col]
        t1 = after_row[time_col]
        v0 = before_row[value_col]
        v1 = after_row[value_col]
        
        t = station_df.at[idx, time_col]
        
        dt_total = (t1 - t0).total_seconds()
        dt_current = (t - t0).total_seconds()
        
        if dt_total == 0:
            return v0
            
        ratio = dt_current / dt_total
        return v0 + (v1 - v0) * ratio
        
    def _polynomial_interpolate(self, station_df: pd.DataFrame, idx: int,
                              time_col: str, value_col: str) -> float:
        valid_mask = station_df['qc_flag'] == 'PASS'
        
        current_time = station_df.at[idx, time_col]
        
        nearby_mask = valid_mask & (
            abs((station_df[time_col] - current_time).dt.total_seconds()) < 3600
        )
        nearby_df = station_df[nearby_mask]
        
        if len(nearby_df) < 3:
            return self._linear_interpolate(station_df, idx, time_col, value_col)
            
        times = nearby_df[time_col].apply(lambda x: x.timestamp()).values
        values = nearby_df[value_col].values
        
        order = min(2, len(nearby_df) - 1)
        coeffs = np.polyfit(times, values, order)
        
        current_ts = current_time.timestamp()
        return np.polyval(coeffs, current_ts)
        
    def _spline_interpolate(self, station_df: pd.DataFrame, idx: int,
                           time_col: str, value_col: str) -> float:
        valid_mask = station_df['qc_flag'] == 'PASS'
        
        current_time = station_df.at[idx, time_col]
        
        nearby_mask = valid_mask & (
            abs((station_df[time_col] - current_time).dt.total_seconds()) < 7200
        )
        nearby_df = station_df[nearby_mask]
        
        if len(nearby_df) < 4:
            return self._polynomial_interpolate(station_df, idx, time_col, value_col)
            
        times = nearby_df[time_col].apply(lambda x: x.timestamp()).values
        values = nearby_df[value_col].values
        
        sorted_idx = np.argsort(times)
        times = times[sorted_idx]
        values = values[sorted_idx]
        
        try:
            cs = PchipInterpolator(times, values)
            current_ts = current_time.timestamp()
            return cs(current_ts)
        except:
            return self._polynomial_interpolate(station_df, idx, time_col, value_col)
            
    def _neighbor_weighted_interpolate(self, df: pd.DataFrame, idx: int,
                                      current_station: str, time_col: str,
                                      value_col: str, station_col: str) -> float:
        current_time = df.at[idx, time_col]
        
        other_stations = [s for s in df[station_col].unique() if s != current_station]
        
        neighbor_values = []
        weights = []
        
        for station in other_stations:
            station_df = df[(df[station_col] == station) & (df['qc_flag'] == 'PASS')]
            
            time_diff = abs((station_df[time_col] - current_time).dt.total_seconds())
            nearest_idx = time_diff.idxmin() if len(time_diff) > 0 else None
            
            if nearest_idx is not None and time_diff.loc[nearest_idx] < 300:
                neighbor_values.append(station_df.loc[nearest_idx, value_col])
                weights.append(1.0)
                
        if len(neighbor_values) >= 2:
            return np.average(neighbor_values, weights=weights)
        else:
            station_df = df[df[station_col] == current_station]
            return self._linear_interpolate(station_df, idx, time_col, value_col)
            
    def _fill_with_other_stations(self, df: pd.DataFrame, current_station: str,
                                 need_fill_indices: List[int], station_col: str,
                                 value_col: str, time_col: str) -> int:
        filled_count = 0
        
        for idx in need_fill_indices:
            current_time = df.at[idx, time_col]
            current_qc_flag = df.at[idx, 'qc_flag']
            
            other_stations = [s for s in df[station_col].unique() if s != current_station]
            
            neighbor_values = []
            for station in other_stations:
                mask = (df[station_col] == station) & (df[time_col] == current_time)
                if mask.any():
                    val = df.loc[mask, value_col].iloc[0]
                    if not pd.isna(val):
                        neighbor_values.append(val)
                        
            if len(neighbor_values) >= 1:
                filled_val = np.mean(neighbor_values)
                df.at[idx, 'filled_value'] = max(0, filled_val)
                df.at[idx, 'fill_method'] = 'neighbor_weighted'
                df.at[idx, 'is_filled'] = True
                
                self.fill_results.append({
                    'index': idx,
                    'station': current_station,
                    'time': current_time,
                    'original_value': df.at[idx, value_col],
                    'filled_value': max(0, filled_val),
                    'method': 'neighbor_weighted',
                    'original_flag': current_qc_flag,
                    'original_reason': df.at[idx, 'qc_reason']
                })
                
                if 'neighbor_weighted' not in self.fill_method_stats:
                    self.fill_method_stats['neighbor_weighted'] = 0
                self.fill_method_stats['neighbor_weighted'] += 1
                
                filled_count += 1
                
        return filled_count
        
    def _generate_fill_summary(self, df: pd.DataFrame) -> Dict:
        time_col = self.config['time_column']
        station_col = self.config['station_column']
        value_col = self.config['value_column']
        
        summary = {
            'total_filled': len(self.fill_results),
            'fill_method_stats': self.fill_method_stats.copy(),
            'filled_records': self.fill_results.copy(),
            'by_station': {}
        }
        
        for station in df[station_col].unique():
            station_df = df[df[station_col] == station]
            filled_count = len(station_df[station_df['is_filled'] == True])
            
            valid_original = station_df[station_df['qc_flag'] == 'PASS'][value_col]
            all_filled = station_df[station_df['is_filled'] == True]['filled_value']
            
            summary['by_station'][station] = {
                'filled_count': filled_count,
                'original_valid_mean': valid_original.mean() if len(valid_original) > 0 else None,
                'filled_mean': all_filled.mean() if len(all_filled) > 0 else None,
                'fill_ratio': (filled_count / len(station_df)) * 100 if len(station_df) > 0 else 0
            }
            
        return summary
        
    def get_fill_results(self) -> List[Dict]:
        return self.fill_results.copy()
        
    def get_fill_method_stats(self) -> Dict[str, int]:
        return self.fill_method_stats.copy()
