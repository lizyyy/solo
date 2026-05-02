import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
import re


@dataclass
class RoastPhase:
    name: str
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    start_temp: Optional[float] = None
    end_temp: Optional[float] = None
    duration: Optional[float] = None
    temp_change: Optional[float] = None
    avg_ror: Optional[float] = None


@dataclass
class RoastMetrics:
    total_duration: Optional[float] = None
    drop_temperature: Optional[float] = None
    charge_temperature: Optional[float] = None
    
    phases: Dict[str, RoastPhase] = field(default_factory=dict)
    development_time: Optional[float] = None
    development_ratio: Optional[float] = None
    
    avg_ror_overall: Optional[float] = None
    min_ror: Optional[float] = None
    max_ror: Optional[float] = None
    
    ror_anomalies: List[Dict] = field(default_factory=list)
    events: Dict[str, Dict] = field(default_factory=dict)
    
    power_profile: Dict = field(default_factory=dict)
    damper_profile: Dict = field(default_factory=dict)


class RoRCalculator:
    EVENT_KEYWORDS = {
        'charge': ['入豆', 'charge', '入锅', '开始', 'start'],
        'turning_point': ['回温点', '回温', 'tp', 'turning.?point', '最低温'],
        'yellow': ['黄点', '转黄', '变黄', 'yellow', '脱水'],
        'first_crack_start': ['一爆开始', '一爆', '1c', 'first.?crack', 'fc', '第一次爆裂'],
        'first_crack_end': ['一爆结束', '一爆停', 'fc.?end', '1c结束'],
        'second_crack_start': ['二爆开始', '二爆', '2c', 'second.?crack', 'sc'],
        'second_crack_end': ['二爆结束', 'sc.?end', '2c结束'],
        'drop': ['下豆', '出锅', 'drop', '结束', 'end', '出炉']
    }

    PHASE_NAMES = {
        'charge_to_tp': '入豆到回温点',
        'tp_to_yellow': '回温点到黄点',
        'yellow_to_fc': '黄点到一爆',
        'fc_to_drop': '一爆到下豆',
        'sc_to_drop': '二爆到下豆'
    }

    def __init__(self, smoothing_window: int = 5):
        self.smoothing_window = smoothing_window

    def calculate_ror(self, df: pd.DataFrame) -> pd.DataFrame:
        result = df.copy()

        if 'time_seconds' not in result.columns or 'bean_temp' not in result.columns:
            result['ror'] = np.nan
            result['ror_smoothed'] = np.nan
            return result

        valid_mask = result['time_seconds'].notna() & result['bean_temp'].notna()
        valid_data = result[valid_mask].copy()

        if len(valid_data) < 2:
            result['ror'] = np.nan
            result['ror_smoothed'] = np.nan
            return result

        time_diff = valid_data['time_seconds'].diff()
        temp_diff = valid_data['bean_temp'].diff()

        valid_data['ror'] = (temp_diff / time_diff) * 60

        if len(valid_data) >= self.smoothing_window:
            valid_data['ror_smoothed'] = valid_data['ror'].rolling(
                window=self.smoothing_window, 
                center=True, 
                min_periods=2
            ).mean()
        else:
            valid_data['ror_smoothed'] = valid_data['ror']

        result.loc[valid_mask, 'ror'] = valid_data['ror'].values
        result.loc[valid_mask, 'ror_smoothed'] = valid_data['ror_smoothed'].values

        return result

    def extract_events(self, df: pd.DataFrame) -> Dict[str, Dict]:
        events = {}

        if 'events' not in df.columns:
            return events

        valid_rows = df[df['events'].notna() & (df['events'].str.strip() != '')]

        for idx, row in valid_rows.iterrows():
            event_text = str(row['events']).lower().strip()
            time_sec = row.get('time_seconds')
            bean_temp = row.get('bean_temp')

            matched_category = None
            for category, keywords in self.EVENT_KEYWORDS.items():
                if any(re.search(k, event_text) for k in keywords):
                    matched_category = category
                    break

            if matched_category:
                if matched_category not in events:
                    events[matched_category] = {
                        'time': time_sec,
                        'temp': bean_temp,
                        'text': event_text,
                        'row_index': idx
                    }

        return events

    def calculate_metrics(self, df: pd.DataFrame, events: Optional[Dict] = None) -> RoastMetrics:
        metrics = RoastMetrics()

        if events is None:
            events = self.extract_events(df)
        metrics.events = events

        valid_data = df[df['time_seconds'].notna() & df['bean_temp'].notna()].copy()
        if len(valid_data) < 2:
            return metrics

        start_time = valid_data['time_seconds'].min()
        end_time = valid_data['time_seconds'].max()
        metrics.total_duration = end_time - start_time

        drop_event = events.get('drop')
        if drop_event and pd.notna(drop_event['temp']):
            metrics.drop_temperature = drop_event['temp']
        elif len(valid_data) > 0:
            metrics.drop_temperature = valid_data.iloc[-1]['bean_temp']

        charge_event = events.get('charge')
        if charge_event and pd.notna(charge_event['temp']):
            metrics.charge_temperature = charge_event['temp']
        elif len(valid_data) > 0:
            metrics.charge_temperature = valid_data.iloc[0]['bean_temp']

        metrics.phases = self._calculate_phases(events)
        metrics = self._calculate_development_metrics(metrics, events)
        metrics = self._calculate_ror_metrics(df, metrics)
        metrics = self._detect_ror_anomalies(df, metrics)
        metrics = self._calculate_profile_metrics(df, metrics)

        return metrics

    def _calculate_phases(self, events: Dict[str, Dict]) -> Dict[str, RoastPhase]:
        phases = {}

        phase_definitions = [
            ('charge_to_tp', 'charge', 'turning_point'),
            ('tp_to_yellow', 'turning_point', 'yellow'),
            ('yellow_to_fc', 'yellow', 'first_crack_start'),
            ('fc_to_drop', 'first_crack_start', 'drop'),
            ('sc_to_drop', 'second_crack_start', 'drop')
        ]

        for phase_name, start_event, end_event in phase_definitions:
            start_data = events.get(start_event)
            end_data = events.get(end_event)

            if start_data and end_data:
                phase = RoastPhase(
                    name=self.PHASE_NAMES.get(phase_name, phase_name),
                    start_time=start_data.get('time'),
                    end_time=end_data.get('time'),
                    start_temp=start_data.get('temp'),
                    end_temp=end_data.get('temp')
                )

                if phase.start_time is not None and phase.end_time is not None:
                    phase.duration = phase.end_time - phase.start_time
                if phase.start_temp is not None and phase.end_temp is not None:
                    phase.temp_change = phase.end_temp - phase.start_temp

                phases[phase_name] = phase

        return phases

    def _calculate_development_metrics(self, metrics: RoastMetrics, events: Dict) -> RoastMetrics:
        fc_start = events.get('first_crack_start')
        drop = events.get('drop')

        if fc_start and drop:
            fc_time = fc_start.get('time')
            drop_time = drop.get('time')

            if fc_time is not None and drop_time is not None:
                metrics.development_time = drop_time - fc_time

                if metrics.total_duration and metrics.total_duration > 0:
                    metrics.development_ratio = (metrics.development_time / metrics.total_duration) * 100

        return metrics

    def _calculate_ror_metrics(self, df: pd.DataFrame, metrics: RoastMetrics) -> RoastMetrics:
        if 'ror_smoothed' in df.columns:
            valid_ror = df['ror_smoothed'].dropna()
            if len(valid_ror) > 0:
                metrics.avg_ror_overall = valid_ror.mean()
                metrics.min_ror = valid_ror.min()
                metrics.max_ror = valid_ror.max()

        return metrics

    def _detect_ror_anomalies(self, df: pd.DataFrame, metrics: RoastMetrics) -> RoastMetrics:
        anomalies = []

        if 'ror_smoothed' not in df.columns:
            return metrics

        valid_data = df[df['ror_smoothed'].notna() & df['time_seconds'].notna()].copy()
        if len(valid_data) < 5:
            return metrics

        ror_values = valid_data['ror_smoothed'].values
        time_values = valid_data['time_seconds'].values

        for i in range(1, len(ror_values) - 1):
            current_ror = ror_values[i]
            prev_ror = ror_values[i - 1]
            next_ror = ror_values[i + 1]

            if prev_ror is None or next_ror is None:
                continue

            ror_change_up = next_ror - current_ror
            ror_change_down = current_ror - prev_ror

            if current_ror > 30:
                anomalies.append({
                    'type': 'high_ror',
                    'time': time_values[i],
                    'ror_value': current_ror,
                    'message': f"RoR 过高: {current_ror:.1f}°C/min"
                })

            if current_ror < 0:
                anomalies.append({
                    'type': 'negative_ror',
                    'time': time_values[i],
                    'ror_value': current_ror,
                    'message': f"RoR 为负: {current_ror:.1f}°C/min（温度下降）"
                })

            if abs(ror_change_up) > 10 and abs(ror_change_down) > 10:
                anomalies.append({
                    'type': 'ror_spike',
                    'time': time_values[i],
                    'ror_value': current_ror,
                    'change': max(abs(ror_change_up), abs(ror_change_down)),
                    'message': f"RoR 抖动剧烈: 变化幅度 {max(abs(ror_change_up), abs(ror_change_down)):.1f}°C/min"
                })

        if 'first_crack_start' in metrics.events:
            fc_time = metrics.events['first_crack_start'].get('time')
            if fc_time is not None:
                after_fc_data = valid_data[valid_data['time_seconds'] > fc_time]
                if len(after_fc_data) > 0:
                    ror_after_fc = after_fc_data['ror_smoothed'].values
                    ror_above_15 = len([r for r in ror_after_fc if r > 15])
                    if ror_above_15 > len(ror_after_fc) * 0.5:
                        anomalies.append({
                            'type': 'high_ror_development',
                            'time': fc_time,
                            'message': "发展阶段 RoR 偏高，可能导致发展过快或烤焦"
                        })

        metrics.ror_anomalies = anomalies
        return metrics

    def _calculate_profile_metrics(self, df: pd.DataFrame, metrics: RoastMetrics) -> RoastMetrics:
        if 'power' in df.columns:
            valid_power = df['power'].dropna()
            if len(valid_power) > 0:
                metrics.power_profile = {
                    'min': valid_power.min(),
                    'max': valid_power.max(),
                    'avg': valid_power.mean(),
                    'median': valid_power.median()
                }

        if 'damper' in df.columns:
            valid_damper = df['damper'].dropna()
            if len(valid_damper) > 0:
                metrics.damper_profile = {
                    'min': valid_damper.min(),
                    'max': valid_damper.max(),
                    'avg': valid_damper.mean(),
                    'median': valid_damper.median()
                }

        return metrics

    @staticmethod
    def format_seconds(seconds: float) -> str:
        if seconds is None:
            return "N/A"
        minutes = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{minutes}:{secs:02d}"

    @staticmethod
    def format_metrics_for_display(metrics: RoastMetrics) -> Dict:
        display = {
            'basic': {
                '总时长': RoRCalculator.format_seconds(metrics.total_duration),
                '入豆温度': f"{metrics.charge_temperature:.1f}°C" if metrics.charge_temperature else "N/A",
                '下豆温度': f"{metrics.drop_temperature:.1f}°C" if metrics.drop_temperature else "N/A",
            },
            'development': {
                '发展时间': RoRCalculator.format_seconds(metrics.development_time),
                '发展比例': f"{metrics.development_ratio:.1f}%" if metrics.development_ratio else "N/A"
            },
            'ror': {
                '平均 RoR': f"{metrics.avg_ror_overall:.1f}°C/min" if metrics.avg_ror_overall else "N/A",
                '最小 RoR': f"{metrics.min_ror:.1f}°C/min" if metrics.min_ror else "N/A",
                '最大 RoR': f"{metrics.max_ror:.1f}°C/min" if metrics.max_ror else "N/A"
            },
            'phases': [],
            'events': [],
            'anomalies': []
        }

        for phase_key, phase in metrics.phases.items():
            phase_display = {
                'name': phase.name,
                'duration': RoRCalculator.format_seconds(phase.duration),
                'temp_change': f"{phase.temp_change:+.1f}°C" if phase.temp_change else "N/A"
            }
            display['phases'].append(phase_display)

        event_names = {
            'charge': '入豆',
            'turning_point': '回温点',
            'yellow': '黄点',
            'first_crack_start': '一爆开始',
            'first_crack_end': '一爆结束',
            'second_crack_start': '二爆开始',
            'second_crack_end': '二爆结束',
            'drop': '下豆'
        }

        for event_key, event_data in metrics.events.items():
            event_display = {
                'name': event_names.get(event_key, event_key),
                'time': RoRCalculator.format_seconds(event_data.get('time')),
                'temp': f"{event_data.get('temp'):.1f}°C" if event_data.get('temp') is not None else "N/A"
            }
            display['events'].append(event_display)

        display['anomalies'] = metrics.ror_anomalies

        return display
