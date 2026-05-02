import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from enum import Enum


class ValidationSeverity(Enum):
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


@dataclass
class ValidationIssue:
    severity: ValidationSeverity
    category: str
    message: str
    details: Dict[str, Any] = field(default_factory=dict)
    row_index: Optional[int] = None


@dataclass
class ValidationResult:
    is_valid: bool
    issues: List[ValidationIssue] = field(default_factory=list)
    summary: Dict[str, int] = field(default_factory=dict)

    def add_issue(self, issue: ValidationIssue):
        self.issues.append(issue)
        key = f"{issue.severity.value}_{issue.category}"
        if key not in self.summary:
            self.summary[key] = 0
        self.summary[key] += 1
        if issue.severity == ValidationSeverity.ERROR:
            self.is_valid = False

    def get_issues_by_severity(self, severity: ValidationSeverity) -> List[ValidationIssue]:
        return [i for i in self.issues if i.severity == severity]

    def has_errors(self) -> bool:
        return any(i.severity == ValidationSeverity.ERROR for i in self.issues)

    def has_warnings(self) -> bool:
        return any(i.severity == ValidationSeverity.WARNING for i in self.issues)


class DataValidator:
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

    def __init__(self):
        pass

    def validate(self, df: pd.DataFrame, metadata: Dict) -> ValidationResult:
        result = ValidationResult(is_valid=True)

        self._validate_required_columns(df, result)
        self._validate_time_sequence(df, result)
        self._validate_temperature_data(df, result)
        self._validate_events(df, result)
        self._validate_temperature_range(df, result)

        return result

    def _validate_required_columns(self, df: pd.DataFrame, result: ValidationResult):
        required = ['time_seconds', 'bean_temp']
        for col in required:
            if col not in df.columns or df[col].isna().all():
                result.add_issue(ValidationIssue(
                    severity=ValidationSeverity.ERROR,
                    category='missing_column',
                    message=f"缺少必需的列: {col}",
                    details={'missing_column': col}
                ))

    def _validate_time_sequence(self, df: pd.DataFrame, result: ValidationResult):
        if 'time_seconds' not in df.columns:
            return

        time_series = df['time_seconds'].dropna()
        if len(time_series) < 2:
            return

        time_diffs = time_series.diff()
        negative_diffs = time_diffs[time_diffs < 0]

        if len(negative_diffs) > 0:
            for idx in negative_diffs.index:
                result.add_issue(ValidationIssue(
                    severity=ValidationSeverity.ERROR,
                    category='time_backward',
                    message=f"时间倒退，行 {idx}: 时间值 {time_series.loc[idx]} 小于前一行",
                    row_index=idx,
                    details={'current_time': time_series.loc[idx], 'prev_time': time_series.loc[idx-1]}
                ))

        time_diffs_positive = time_diffs[time_diffs > 0]
        if len(time_diffs_positive) > 0:
            avg_interval = time_diffs_positive.mean()
            large_jumps = time_diffs[time_diffs > avg_interval * 3]

            for idx in large_jumps.index:
                result.add_issue(ValidationIssue(
                    severity=ValidationSeverity.WARNING,
                    category='time_gap',
                    message=f"时间间隔异常，行 {idx}: 间隔 {time_diffs.loc[idx]} 秒，超过平均值的3倍",
                    row_index=idx,
                    details={'gap': time_diffs.loc[idx], 'avg_interval': avg_interval}
                ))

        if time_series.iloc[-1] - time_series.iloc[0] < 60:
            result.add_issue(ValidationIssue(
                severity=ValidationSeverity.WARNING,
                category='short_roast',
                message="烘焙时间过短（小于1分钟），请确认数据是否完整",
                details={'total_seconds': time_series.iloc[-1] - time_series.iloc[0]}
            ))

    def _validate_temperature_data(self, df: pd.DataFrame, result: ValidationResult):
        if 'bean_temp' in df.columns:
            missing_count = df['bean_temp'].isna().sum()
            if missing_count > 0:
                result.add_issue(ValidationIssue(
                    severity=ValidationSeverity.WARNING,
                    category='missing_temp',
                    message=f"豆温数据缺失 {missing_count} 个点",
                    details={'missing_count': missing_count, 'total': len(df)}
                ))

            valid_temp = df['bean_temp'].dropna()
            if len(valid_temp) > 0:
                temp_diffs = valid_temp.diff()
                temp_drops = temp_diffs[temp_diffs < -20]

                for idx in temp_drops.index:
                    result.add_issue(ValidationIssue(
                        severity=ValidationSeverity.WARNING,
                        category='temp_drop',
                        message=f"豆温突降，行 {idx}: 下降 {abs(temp_diffs.loc[idx])}°C",
                        row_index=idx,
                        details={'drop': abs(temp_diffs.loc[idx])}
                    ))

    def _validate_temperature_range(self, df: pd.DataFrame, result: ValidationResult):
        if 'bean_temp' in df.columns:
            valid_temp = df['bean_temp'].dropna()
            if len(valid_temp) > 0:
                low_temp_mask = (valid_temp < 20) & (valid_temp > -50)
                high_temp_mask = valid_temp > 260

                for idx in valid_temp[low_temp_mask].index:
                    result.add_issue(ValidationIssue(
                        severity=ValidationSeverity.WARNING,
                        category='temp_too_low',
                        message=f"豆温异常低，行 {idx}: {valid_temp.loc[idx]}°C",
                        row_index=idx,
                        details={'temp': valid_temp.loc[idx]}
                    ))

                for idx in valid_temp[high_temp_mask].index:
                    result.add_issue(ValidationIssue(
                        severity=ValidationSeverity.WARNING,
                        category='temp_too_high',
                        message=f"豆温异常高，行 {idx}: {valid_temp.loc[idx]}°C",
                        row_index=idx,
                        details={'temp': valid_temp.loc[idx]}
                    ))

    def _validate_events(self, df: pd.DataFrame, result: ValidationResult):
        if 'events' not in df.columns:
            return

        events_df = df[df['events'].str.strip() != ''] if 'events' in df.columns else pd.DataFrame()

        if len(events_df) == 0:
            result.add_issue(ValidationIssue(
                severity=ValidationSeverity.INFO,
                category='no_events',
                message="未检测到任何事件标记，建议检查事件列是否正确映射"
            ))
            return

        event_times = []
        recognized_events = {}

        for idx, row in events_df.iterrows():
            event_text = str(row['events']).lower().strip()
            time_sec = row.get('time_seconds')
            bean_temp = row.get('bean_temp')

            matched_category = None
            for category, keywords in self.EVENT_KEYWORDS.items():
                if any(re.search(k, event_text) for k in keywords):
                    matched_category = category
                    if category not in recognized_events:
                        recognized_events[category] = []
                    recognized_events[category].append({
                        'time': time_sec,
                        'temp': bean_temp,
                        'text': event_text
                    })
                    break

            if pd.notna(time_sec):
                event_times.append(time_sec)

        self._validate_event_sequence(recognized_events, result, df)
        self._validate_event_temperature(recognized_events, result)

    def _validate_event_sequence(self, recognized_events: Dict, result: ValidationResult, df: pd.DataFrame):
        expected_order = ['charge', 'turning_point', 'yellow', 'first_crack_start', 
                         'first_crack_end', 'second_crack_start', 'second_crack_end', 'drop']

        detected_order = []
        for category in expected_order:
            if category in recognized_events and len(recognized_events[category]) > 0:
                detected_order.append(category)

        if len(detected_order) < 2:
            return

        for i in range(len(detected_order) - 1):
            prev_cat = detected_order[i]
            curr_cat = detected_order[i + 1]

            prev_time = recognized_events[prev_cat][0]['time']
            curr_time = recognized_events[curr_cat][0]['time']

            if pd.notna(prev_time) and pd.notna(curr_time):
                if curr_time < prev_time:
                    result.add_issue(ValidationIssue(
                        severity=ValidationSeverity.ERROR,
                        category='event_sequence',
                        message=f"事件顺序异常: {self._get_event_name(curr_cat)} 发生在 {self._get_event_name(prev_cat)} 之前",
                        details={
                            'prev_event': prev_cat,
                            'prev_time': prev_time,
                            'curr_event': curr_cat,
                            'curr_time': curr_time
                        }
                    ))

    def _validate_event_temperature(self, recognized_events: Dict, result: ValidationResult):
        temp_ranges = {
            'turning_point': (120, 180),
            'yellow': (140, 180),
            'first_crack_start': (180, 210),
            'first_crack_end': (190, 220),
            'second_crack_start': (210, 240),
            'drop': (180, 250)
        }

        for category, events in recognized_events.items():
            if category in temp_ranges:
                for event in events:
                    temp = event.get('temp')
                    if pd.notna(temp):
                        min_temp, max_temp = temp_ranges[category]
                        if temp < min_temp or temp > max_temp:
                            result.add_issue(ValidationIssue(
                                severity=ValidationSeverity.WARNING,
                                category='event_temp_outlier',
                                message=f"{self._get_event_name(category)} 温度异常: {temp}°C，期望范围 {min_temp}-{max_temp}°C",
                                details={
                                    'event': category,
                                    'temp': temp,
                                    'expected_min': min_temp,
                                    'expected_max': max_temp
                                }
                            ))

    def _get_event_name(self, category: str) -> str:
        names = {
            'charge': '入豆',
            'turning_point': '回温点',
            'yellow': '黄点',
            'first_crack_start': '一爆开始',
            'first_crack_end': '一爆结束',
            'second_crack_start': '二爆开始',
            'second_crack_end': '二爆结束',
            'drop': '下豆'
        }
        return names.get(category, category)

    @staticmethod
    def format_issues_for_display(issues: List[ValidationIssue]) -> Dict[str, List[Dict]]:
        grouped = {'errors': [], 'warnings': [], 'info': []}

        for issue in issues:
            item = {
                'category': issue.category,
                'message': issue.message,
                'details': issue.details,
                'row_index': issue.row_index
            }

            if issue.severity == ValidationSeverity.ERROR:
                grouped['errors'].append(item)
            elif issue.severity == ValidationSeverity.WARNING:
                grouped['warnings'].append(item)
            else:
                grouped['info'].append(item)

        return grouped


import re
