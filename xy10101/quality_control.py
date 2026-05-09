import pandas as pd
import numpy as np
import logging
from typing import Dict, List, Tuple, Any
from config import CONFIG, QC_RULES


logger = logging.getLogger(__name__)


class QualityControl:
    def __init__(self, config: Dict = None):
        self.config = config or CONFIG
        self.qc_rules = QC_RULES.copy()
        self.qc_results: Dict[str, List[Dict]] = {}
        self.failed_samples: List[Dict] = []
        
    def run_quality_control(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict]:
        logger.info("开始质量控制流程")
        
        time_col = self.config['time_column']
        value_col = self.config['value_column']
        station_col = self.config['station_column']
        
        self.qc_results = {}
        self.failed_samples = []
        
        df = df.copy()
        df['qc_flag'] = 'PASS'
        df['qc_reason'] = ''
        
        stations = df[station_col].unique()
        
        for station in stations:
            station_mask = df[station_col] == station
            station_df = df.loc[station_mask].copy()
            
            self._check_missing_values(df, station_mask, value_col)
            self._range_check(df, station_mask, value_col)
            self._spike_check(df, station_mask, value_col)
            self._constant_check(df, station_mask, value_col)
            
        self._logic_check(df, station_col, value_col)
        
        failed_count = len(df[df['qc_flag'] != 'PASS'])
        logger.info(f"质量控制完成，共 {failed_count} 条异常/缺测记录")
        
        qc_summary = self._generate_qc_summary(df)
        
        return df, qc_summary
        
    def _check_missing_values(self, df: pd.DataFrame, mask: pd.Series, value_col: str):
        rule_name = 'missing_check'
        
        if rule_name not in self.qc_results:
            self.qc_results[rule_name] = []
            
        missing_mask = mask & df[value_col].isna()
        missing_indices = df[missing_mask].index
        
        for idx in missing_indices:
            df.at[idx, 'qc_flag'] = 'MISSING'
            df.at[idx, 'qc_reason'] = '缺失值'
            
            self.qc_results[rule_name].append({
                'index': idx,
                'station': df.at[idx, self.config['station_column']],
                'time': df.at[idx, self.config['time_column']],
                'value': None,
                'reason': '缺失值'
            })
            
            self.failed_samples.append({
                'test_name': self.qc_rules[rule_name]['name'],
                'station': df.at[idx, self.config['station_column']],
                'time': df.at[idx, self.config['time_column']],
                'value': None,
                'reason': '数据缺失，无法进行质量检查',
                'action': '标记为缺失，将进行补全处理'
            })
            
        if len(missing_indices):
            logger.info(f"发现 {len(missing_indices)} 条缺失值记录")
            
    def _range_check(self, df: pd.DataFrame, mask: pd.Series, value_col: str):
        rule_name = 'range_check'
        rule = self.qc_rules[rule_name]
        
        if rule_name not in self.qc_results:
            self.qc_results[rule_name] = []
            
        min_val = rule['min_value']
        max_val = rule['max_value']
        
        valid_mask = ~df[value_col].isna()
        
        below_min = mask & valid_mask & (df[value_col] < min_val)
        above_max = mask & valid_mask & (df[value_col] > max_val)
        
        failed_indices = df[below_min | above_max].index
        
        for idx in failed_indices:
            value = df.at[idx, value_col]
            if value < min_val:
                reason = f"值低于最小值 {min_val}mm"
            else:
                reason = f"值高于最大值 {max_val}mm"
                
            df.at[idx, 'qc_flag'] = 'FAIL'
            df.at[idx, 'qc_reason'] = reason
            
            self.qc_results[rule_name].append({
                'index': idx,
                'station': df.at[idx, self.config['station_column']],
                'time': df.at[idx, self.config['time_column']],
                'value': value,
                'min_limit': min_val,
                'max_limit': max_val,
                'reason': reason
            })
            
            self.failed_samples.append({
                'test_name': rule['name'],
                'station': df.at[idx, self.config['station_column']],
                'time': df.at[idx, self.config['time_column']],
                'value': value,
                'reason': reason,
                'limits': f'有效范围: [{min_val}, {max_val}] mm',
                'action': '标记为异常，将进行补全处理'
            })
            
        if len(failed_indices):
            logger.info(f"值域检查发现 {len(failed_indices)} 条异常记录")
            
    def _spike_check(self, df: pd.DataFrame, mask: pd.Series, value_col: str):
        rule_name = 'spike_check'
        rule = self.qc_rules[rule_name]
        
        if rule_name not in self.qc_results:
            self.qc_results[rule_name] = []
            
        threshold = rule['threshold']
        window = rule['window_size']
        
        station_indices = df[mask].index
        
        for idx in station_indices:
            if df.at[idx, 'qc_flag'] != 'PASS':
                continue
                
            value = df.at[idx, value_col]
            if pd.isna(value):
                continue
                
            before_indices = [i for i in station_indices 
                           if i < idx and df.at[i, 'qc_flag'] == 'PASS'][-window//2:]
            after_indices = [i for i in station_indices 
                          if i > idx and df.at[i, 'qc_flag'] == 'PASS'][:window//2]
            
            neighboring_values = [df.at[i, value_col] 
                               for i in before_indices + after_indices 
                               if not pd.isna(df.at[i, value_col])]
            
            if len(neighboring_values) >= 2:
                mean_neighbor = np.mean(neighboring_values)
                deviation = abs(value - mean_neighbor)
                
                if deviation > threshold and deviation > 2 * np.std(neighboring_values):
                    df.at[idx, 'qc_flag'] = 'SPIKE'
                    df.at[idx, 'qc_reason'] = '突刺异常'
                    
                    self.qc_results[rule_name].append({
                        'index': idx,
                        'station': df.at[idx, self.config['station_column']],
                        'time': df.at[idx, self.config['time_column']],
                        'value': value,
                        'neighbor_mean': mean_neighbor,
                        'deviation': deviation,
                        'threshold': threshold
                    })
                    
                    self.failed_samples.append({
                        'test_name': rule['name'],
                        'station': df.at[idx, self.config['station_column']],
                        'time': df.at[idx, self.config['time_column']],
                        'value': value,
                        'neighbor_mean': mean_neighbor,
                        'deviation': deviation,
                        'reason': f'与周边值偏差 {deviation:.2f}mm，超过阈值 {threshold}mm',
                        'action': '标记为突刺，将进行补全处理'
                    })
                    
        spike_count = len([r for r in self.qc_results.get(rule_name, [])])
        if spike_count:
            logger.info(f"突刺检查发现 {spike_count} 条突刺记录")
            
    def _constant_check(self, df: pd.DataFrame, mask: pd.Series, value_col: str):
        rule_name = 'constant_check'
        rule = self.qc_rules[rule_name]
        
        if rule_name not in self.qc_results:
            self.qc_results[rule_name] = []
            
        max_constant = rule['max_constant_count']
        min_threshold = rule['min_value_threshold']
        
        station_indices = df[mask & (df['qc_flag'] == 'PASS')].index.tolist()
        
        constant_run = []
        prev_value = None
        
        for idx in station_indices:
            value = df.at[idx, value_col]
            
            if pd.isna(value):
                constant_run = []
                prev_value = None
                continue
                
            if prev_value is not None and abs(value - prev_value) < 0.001:
                constant_run.append(idx)
            else:
                if len(constant_run) > max_constant and prev_value > min_threshold:
                    for fail_idx in constant_run:
                        df.at[fail_idx, 'qc_flag'] = 'CONSTANT'
                        df.at[fail_idx, 'qc_reason'] = '连续恒值'
                        
                        self.qc_results[rule_name].append({
                            'index': fail_idx,
                            'station': df.at[fail_idx, self.config['station_column']],
                            'time': df.at[fail_idx, self.config['time_column']],
                            'value': prev_value,
                            'run_length': len(constant_run)
                        })
                        
                        self.failed_samples.append({
                            'test_name': rule['name'],
                            'station': df.at[fail_idx, self.config['station_column']],
                            'time': df.at[fail_idx, self.config['time_column']],
                            'value': prev_value,
                            'reason': f'连续 {len(constant_run)} 个相同值',
                            'action': '标记为恒值异常，将进行补全处理'
                        })
                        
                constant_run = [idx]
                
            prev_value = value
            
        constant_count = len([r for r in self.qc_results.get(rule_name, [])])
        if constant_count:
            logger.info(f"恒值检查发现 {constant_count} 条恒值记录")
            
    def _logic_check(self, df: pd.DataFrame, station_col: str, value_col: str):
        rule_name = 'logic_check'
        rule = self.qc_rules[rule_name]
        
        if rule_name not in self.qc_results:
            self.qc_results[rule_name] = []
            
        max_diff_ratio = rule['max_diff_ratio']
        
        stations = df[station_col].unique()
        if len(stations) <= 1:
            logger.info("只有一个站点，跳过逻辑一致性检查")
            return
            
        time_col = self.config['time_column']
        
        for idx in df[df['qc_flag'] == 'PASS'].index:
            current_time = df.at[idx, time_col]
            current_station = df.at[idx, station_col]
            current_value = df.at[idx, value_col]
            
            if pd.isna(current_value):
                continue
                
            other_stations = [s for s in stations if s != current_station]
            
            other_values = []
            for other_station in other_stations:
                other_mask = (
                    (df[station_col] == other_station) & 
                    (df[time_col] == current_time) & 
                    (df['qc_flag'] == 'PASS')
                )
                
                if other_mask.any():
                    other_val = df.loc[other_mask, value_col].iloc[0]
                    if not pd.isna(other_val):
                        other_values.append(other_val)
                        
            if len(other_values) >= 1:
                mean_other = np.mean(other_values)
                if mean_other > 0:
                    ratio = current_value / mean_other if mean_other != 0 else float('inf')
                    
                    if ratio > max_diff_ratio and current_value > 5:
                        df.at[idx, 'qc_flag'] = 'LOGIC'
                        df.at[idx, 'qc_reason'] = '逻辑一致性异常'
                        
                        self.qc_results[rule_name].append({
                            'index': idx,
                            'station': current_station,
                            'time': current_time,
                            'value': current_value,
                            'other_mean': mean_other,
                            'ratio': ratio
                        })
                        
                        self.failed_samples.append({
                            'test_name': rule['name'],
                            'station': current_station,
                            'time': current_time,
                            'value': current_value,
                            'other_mean': mean_other,
                            'ratio': ratio,
                            'reason': f'与其他站点均值比为 {ratio:.2f}，超过阈值 {max_diff_ratio}',
                            'action': '标记为逻辑异常，将进行补全处理'
                        })
                        
        logic_count = len([r for r in self.qc_results.get(rule_name, [])])
        if logic_count:
            logger.info(f"逻辑一致性检查发现 {logic_count} 条异常记录")
            
    def _generate_qc_summary(self, df: pd.DataFrame) -> Dict:
        time_col = self.config['time_column']
        value_col = self.config['value_column']
        station_col = self.config['station_column']
        
        summary = {
            'total_records': len(df),
            'stations': df[station_col].nunique(),
            'date_range': {
                'start': df[time_col].min(),
                'end': df[time_col].max()
            },
            'qc_results': {},
            'by_station': {}
        }
        
        for flag, group in df.groupby('qc_flag'):
            summary['qc_results'][flag] = {
                'count': len(group),
                'percentage': (len(group) / len(df)) * 100
            }
            
        for station in df[station_col].unique():
            station_df = df[df[station_col] == station]
            summary['by_station'][station] = {
                'total': len(station_df),
                'pass_count': len(station_df[station_df['qc_flag'] == 'PASS']),
                'missing_count': len(station_df[station_df['qc_flag'] == 'MISSING']),
                'fail_count': len(station_df[station_df['qc_flag'].isin(['FAIL', 'SPIKE', 'CONSTANT', 'LOGIC'])]),
                'missing_ratio': (len(station_df[station_df['qc_flag'] == 'MISSING']) / len(station_df)) * 100
            }
            
        return summary
        
    def get_failed_samples(self) -> List[Dict]:
        return self.failed_samples.copy()
        
    def get_qc_results(self) -> Dict[str, List[Dict]]:
        return self.qc_results.copy()
