import pandas as pd
import json
import yaml
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
import warnings


class DataLoader:
    def __init__(self):
        self.tree_inventory: pd.DataFrame = pd.DataFrame()
        self.inspection_events: pd.DataFrame = pd.DataFrame()
        self.weather_hourly: pd.DataFrame = pd.DataFrame()
        self.risk_rules: Dict[str, Any] = {}

    def load_tree_inventory(self, file_path: str) -> Tuple[pd.DataFrame, Dict]:
        """
        加载树木台账 CSV，处理缺失经纬度等边界情况
        """
        try:
            df = pd.read_csv(file_path, encoding='utf-8')
            warnings_list = []

            required_cols = ['tree_id', 'road_name', 'tree_species', 'tree_age', 
                           'root_depth_category', 'has_water_pool', 'latitude', 'longitude']
            
            missing_cols = [col for col in required_cols if col not in df.columns]
            if missing_cols:
                warnings_list.append({
                    'type': 'missing_columns',
                    'message': f'缺少必要列: {missing_cols}，部分功能可能受限'
                })

            if 'tree_id' in df.columns:
                df['tree_id'] = df['tree_id'].astype(str).str.strip()
                duplicate_ids = df[df.duplicated('tree_id', keep=False)]
                if not duplicate_ids.empty:
                    warnings_list.append({
                        'type': 'duplicate_tree_id',
                        'message': f'发现重复的树木ID: {duplicate_ids["tree_id"].unique().tolist()}'
                    })

            if 'latitude' in df.columns and 'longitude' in df.columns:
                df['has_coordinates'] = ~(df['latitude'].isna() | df['longitude'].isna())
                missing_coords = (~df['has_coordinates']).sum()
                if missing_coords > 0:
                    warnings_list.append({
                        'type': 'missing_coordinates',
                        'message': f'有 {missing_coords} 棵树缺失经纬度信息'
                    })
            else:
                df['has_coordinates'] = False
                warnings_list.append({
                    'type': 'no_coordinate_columns',
                    'message': '缺少经纬度列，无法显示地图'
                })

            if 'tree_age' in df.columns:
                df['tree_age'] = pd.to_numeric(df['tree_age'], errors='coerce')
                df['tree_age_category'] = pd.cut(
                    df['tree_age'], 
                    bins=[-float('inf'), 10, 30, float('inf')],
                    labels=['幼龄', '中龄', '老龄']
                )
            else:
                df['tree_age_category'] = '未知'

            if 'root_depth_category' not in df.columns:
                df['root_depth_category'] = '未知'
            
            if 'has_water_pool' not in df.columns:
                df['has_water_pool'] = False
            else:
                df['has_water_pool'] = df['has_water_pool'].astype(bool)

            self.tree_inventory = df
            warnings_info = {
                'count': len(warnings_list),
                'details': warnings_list
            }

            return df, warnings_info

        except Exception as e:
            raise ValueError(f'加载树木台账失败: {str(e)}')

    def load_inspection_events(self, file_path: str) -> Tuple[pd.DataFrame, Dict]:
        """
        加载巡查事件 JSONL，处理同一树木重复巡查、跨午夜台风等边界情况
        """
        try:
            events = []
            warnings_list = []

            with open(file_path, 'r', encoding='utf-8') as f:
                for line_num, line in enumerate(f, 1):
                    line = line.strip()
                    if line:
                        try:
                            event = json.loads(line)
                            events.append(event)
                        except json.JSONDecodeError as e:
                            warnings_list.append({
                                'type': 'json_parse_error',
                                'message': f'第 {line_num} 行 JSON 解析错误: {str(e)}'
                            })

            if not events:
                raise ValueError('没有有效的巡查事件数据')

            df = pd.DataFrame(events)

            if 'tree_id' in df.columns:
                df['tree_id'] = df['tree_id'].astype(str).str.strip()

            if 'inspection_time' in df.columns:
                df['inspection_time'] = pd.to_datetime(df['inspection_time'], errors='coerce')
                invalid_times = df['inspection_time'].isna().sum()
                if invalid_times > 0:
                    warnings_list.append({
                        'type': 'invalid_timestamp',
                        'message': f'有 {invalid_times} 条记录的时间戳无效'
                    })

                df['inspection_date'] = df['inspection_time'].dt.date

            if 'tree_id' in df.columns:
                tree_inspection_counts = df.groupby('tree_id').size().sort_values(ascending=False)
                multiple_inspections = tree_inspection_counts[tree_inspection_counts > 1]
                if not multiple_inspections.empty:
                    warnings_list.append({
                        'type': 'multiple_inspections',
                        'message': f'有 {len(multiple_inspections)} 棵树被多次巡查，最多被巡查 {multiple_inspections.max()} 次'
                    })

            status_mapping = {
                '已处置': 'resolved',
                '处置中': 'processing',
                '待处置': 'pending',
                '无需处置': 'no_action',
                'resolved': 'resolved',
                'processing': 'processing',
                'pending': 'pending',
                'no_action': 'no_action'
            }

            if 'disposal_status' in df.columns:
                df['disposal_status'] = df['disposal_status'].str.strip()
                df['disposal_status_standard'] = df['disposal_status'].map(status_mapping).fillna('unknown')
            else:
                df['disposal_status_standard'] = 'unknown'

            if 'typhoon_event' not in df.columns:
                df['typhoon_event'] = 'unknown'

            self.inspection_events = df
            warnings_info = {
                'count': len(warnings_list),
                'details': warnings_list
            }

            return df, warnings_info

        except Exception as e:
            raise ValueError(f'加载巡查事件失败: {str(e)}')

    def load_weather_hourly(self, file_path: str) -> Tuple[pd.DataFrame, Dict]:
        """
        加载小时级风雨 CSV，处理跨午夜台风过程
        """
        try:
            df = pd.read_csv(file_path, encoding='utf-8')
            warnings_list = []

            if 'time' in df.columns:
                df['time'] = pd.to_datetime(df['time'], errors='coerce')
                invalid_times = df['time'].isna().sum()
                if invalid_times > 0:
                    warnings_list.append({
                        'type': 'invalid_timestamp',
                        'message': f'有 {invalid_times} 条记录的时间戳无效'
                    })

                df = df.dropna(subset=['time']).sort_values('time').reset_index(drop=True)

                df['date'] = df['time'].dt.date
                df['hour'] = df['time'].dt.hour

                if len(df) >= 2:
                    time_diff = df['time'].diff().dropna()
                    non_hourly = time_diff[time_diff != pd.Timedelta(hours=1)]
                    if not non_hourly.empty:
                        warnings_list.append({
                            'type': 'non_hourly_interval',
                            'message': f'发现 {len(non_hourly)} 处时间间隔不是1小时，可能存在数据缺失'
                        })

                    midnight_transitions = df[(df['time'].dt.hour == 0) & 
                                              (df['time'].diff() == pd.Timedelta(hours=1))]
                    if not midnight_transitions.empty:
                        warnings_list.append({
                            'type': 'cross_midnight',
                            'message': f'检测到 {len(midnight_transitions)} 个跨午夜时间段，需要注意台风过程的连续性'
                        })

            required_weather = ['wind_speed', 'rainfall']
            missing_weather = [col for col in required_weather if col not in df.columns]
            if missing_weather:
                warnings_list.append({
                    'type': 'missing_weather_data',
                    'message': f'缺少气象列: {missing_weather}，风险计算可能不准确'
                })

            for col in ['wind_speed', 'rainfall']:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors='coerce')
                    missing_vals = df[col].isna().sum()
                    if missing_vals > 0:
                        warnings_list.append({
                            'type': 'missing_values',
                            'message': f'{col} 有 {missing_vals} 个缺失值'
                        })

            self.weather_hourly = df
            warnings_info = {
                'count': len(warnings_list),
                'details': warnings_list
            }

            return df, warnings_info

        except Exception as e:
            raise ValueError(f'加载气象数据失败: {str(e)}')

    def load_risk_rules(self, file_path: str) -> Tuple[Dict[str, Any], Dict]:
        """
        加载风险规则 YAML
        """
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                rules = yaml.safe_load(f)

            warnings_list = []

            default_rules = {
                'wind_risk': {
                    'thresholds': [
                        {'wind_speed': 10, 'risk_level': 'low'},
                        {'wind_speed': 20, 'risk_level': 'medium'},
                        {'wind_speed': 30, 'risk_level': 'high'}
                    ],
                    'weights': {'exposure_hours': 0.3, 'max_wind': 0.7}
                },
                'root_risk': {
                    'shallow_root_factor': 1.5,
                    'categories': {'浅根': 'high', '中根': 'medium', '深根': 'low'}
                },
                'age_risk': {
                    'old_tree_age_threshold': 30,
                    'young_tree_age_threshold': 10,
                    'age_factor': {'old': 1.5, 'young': 0.8, 'normal': 1.0}
                },
                'water_risk': {
                    'rainfall_threshold': 50,
                    'water_pool_factor': 1.3
                },
                'overall_risk': {
                    'weights': {
                        'wind_risk': 0.35,
                        'root_risk': 0.25,
                        'age_risk': 0.20,
                        'water_risk': 0.20
                    },
                    'thresholds': {'low': 30, 'medium': 60, 'high': 80}
                },
                'damage_types': {
                    'fall_over': '倒伏',
                    'branch_break': '断枝',
                    'leaning': '倾斜',
                    'root_exposed': '露根'
                }
            }

            merged_rules = self._deep_merge(default_rules, rules)

            self.risk_rules = merged_rules
            warnings_info = {
                'count': len(warnings_list),
                'details': warnings_list
            }

            return merged_rules, warnings_info

        except Exception as e:
            raise ValueError(f'加载风险规则失败: {str(e)}')

    def _deep_merge(self, default: Dict, override: Dict) -> Dict:
        """
        深度合并字典，用于合并默认规则和用户规则
        """
        result = default.copy()
        for key, value in override.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._deep_merge(result[key], value)
            else:
                result[key] = value
        return result

    def get_typhoon_periods(self) -> List[Dict]:
        """
        从气象数据和巡查事件中识别台风时间段
        处理跨午夜的情况
        """
        periods = []

        if not self.weather_hourly.empty and 'time' in self.weather_hourly.columns:
            weather_df = self.weather_hourly.dropna(subset=['time'])
            
            if 'wind_speed' in weather_df.columns:
                high_wind = weather_df[weather_df['wind_speed'] >= 10]
                
                if not high_wind.empty:
                    high_wind = high_wind.sort_values('time')
                    
                    current_period = None
                    for idx, row in high_wind.iterrows():
                        if current_period is None:
                            current_period = {
                                'start': row['time'],
                                'end': row['time'],
                                'max_wind': row['wind_speed'],
                                'total_rain': row.get('rainfall', 0)
                            }
                        else:
                            time_diff = row['time'] - current_period['end']
                            if time_diff <= pd.Timedelta(hours=3):
                                current_period['end'] = row['time']
                                current_period['max_wind'] = max(current_period['max_wind'], row['wind_speed'])
                                current_period['total_rain'] += row.get('rainfall', 0)
                            else:
                                periods.append(current_period)
                                current_period = {
                                    'start': row['time'],
                                    'end': row['time'],
                                    'max_wind': row['wind_speed'],
                                    'total_rain': row.get('rainfall', 0)
                                }
                    
                    if current_period:
                        periods.append(current_period)

        for i, period in enumerate(periods):
            start_date = period['start'].date()
            end_date = period['end'].date()
            
            period['cross_midnight'] = start_date != end_date
            period['duration_hours'] = (period['end'] - period['start']).total_seconds() / 3600
            period['label'] = f"台风过程 {i+1}: {period['start'].strftime('%Y-%m-%d %H:%M')} - {period['end'].strftime('%Y-%m-%d %H:%M')}"

        return periods

    def load_sample_data(self, sample_dir: str) -> Dict:
        """
        加载示例数据，用于演示
        """
        import os
        
        sample_files = {
            'tree_inventory': os.path.join(sample_dir, 'tree_inventory.csv'),
            'inspection_events': os.path.join(sample_dir, 'inspection_events.jsonl'),
            'weather_hourly': os.path.join(sample_dir, 'weather_hourly.csv'),
            'risk_rules': os.path.join(sample_dir, 'risk_rules.yaml')
        }

        results = {}
        
        if os.path.exists(sample_files['tree_inventory']):
            results['tree_inventory'] = self.load_tree_inventory(sample_files['tree_inventory'])
        
        if os.path.exists(sample_files['inspection_events']):
            results['inspection_events'] = self.load_inspection_events(sample_files['inspection_events'])
        
        if os.path.exists(sample_files['weather_hourly']):
            results['weather_hourly'] = self.load_weather_hourly(sample_files['weather_hourly'])
        
        if os.path.exists(sample_files['risk_rules']):
            results['risk_rules'] = self.load_risk_rules(sample_files['risk_rules'])

        return results
