import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from pathlib import Path
import sys
sys.path.append(str(Path(__file__).parent.parent))
from config import WARNING_MESSAGES, DIRECTION_GROUPS, DIRECTION_ALIASES


@dataclass
class ConflictRecord:
    conflict_type: str
    data_source: str
    wechat_record: str
    data_value: float
    wechat_value: float
    discrepancy: float
    discrepancy_percent: float
    timestamp: str
    suggestion: str
    severity: str
    status: str = 'pending'
    conflict_id: str = ''
    resolution_note: str = ''
    detected_at: str = ''

CONFLICT_STATUSES = ('pending', 'resolved', 'ignored')


class ConflictDetector:
    def __init__(self):
        self.conflicts = []
        self.wechat_records = []
        self._seen_conflict_keys = set()
        self._resolved_keys = set()
        self._ignored_keys = set()
        self._last_detection_report = {
            'distance_checked': False,
            'direction_checked': False,
            'wechat_records_count': 0,
            'directional_wechat_records': 0,
            'distance_wechat_records': 0,
            'time_matches': 0,
            'parse_errors': []
        }
        
    def _make_conflict_key(self, conflict_type: str, timestamp: str, **kwargs) -> str:
        parts = [conflict_type, timestamp]
        for k, v in sorted(kwargs.items()):
            parts.append(f"{k}={v}")
        return "|".join(str(p) for p in parts)
        
    def _add_conflict_if_new(self, conflict: ConflictRecord):
        from datetime import datetime
        key = self._make_conflict_key(
            conflict.conflict_type,
            conflict.timestamp,
            data_value=conflict.data_value,
            wechat_value=conflict.wechat_value
        )
        if key in self._resolved_keys or key in self._ignored_keys:
            return
        if key not in self._seen_conflict_keys:
            self._seen_conflict_keys.add(key)
            conflict.conflict_id = key
            conflict.status = 'pending'
            conflict.detected_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            self.conflicts.append(conflict)

    def mark_resolved(self, conflict_id: str, note: str = ''):
        for c in self.conflicts:
            if c.conflict_id == conflict_id:
                c.status = 'resolved'
                c.resolution_note = note
        self._resolved_keys.add(conflict_id)

    def mark_ignored(self, conflict_id: str, note: str = ''):
        for c in self.conflicts:
            if c.conflict_id == conflict_id:
                c.status = 'ignored'
                c.resolution_note = note
        self._ignored_keys.add(conflict_id)

    def get_pending_conflicts(self) -> List[ConflictRecord]:
        return [c for c in self.conflicts if c.status == 'pending']

    @staticmethod
    def infer_reference_date_from_data(data_df: pd.DataFrame, time_col: str) -> Optional[str]:
        if not time_col or time_col not in data_df.columns:
            return None
        try:
            ts = pd.to_datetime(data_df[time_col], errors='coerce').dropna()
            if len(ts) == 0:
                return None
            return ts.iloc[0].strftime("%Y-%m-%d")
        except Exception:
            return None
        
    def add_wechat_record(self, timestamp: str, content: str, 
                          distance: float = None, direction: str = None,
                          operator: str = None, speaker: str = None):
        if operator is None and speaker is not None:
            operator = speaker
        self.wechat_records.append({
            'timestamp': timestamp,
            'content': content,
            'distance': distance,
            'direction': direction,
            'operator': operator,
            'speaker': speaker
        })
    
    def parse_wechat_text(self, wechat_text: str, reference_date: str = None) -> List[Dict]:
        import re
        from datetime import datetime

        records = []
        lines = wechat_text.strip().split('\n')

        header_re = re.compile(
            r'^(?P<speaker>[^\s：:]+?)\s+'
            r'(?P<time>\d{1,2}:\d{2}(?::\d{2})?)'
            r'(?:\s*$)'
        )

        dist_re = re.compile(
            r'(?P<num>\d+(?:\.\d+)?)\s*(?P<unit>mm|cm|m|毫米|厘米|米)?',
            re.IGNORECASE
        )
        dir_re = re.compile(
            r'(?:DIR\s*=\s*)?(?P<dir>CW|CCW|正向|反向|FWD|REV|fwd|rev|正|反|[+\-])',
            re.IGNORECASE
        )

        current = None

        for raw_line in lines:
            line = raw_line.strip()
            if not line:
                if current and current.get('content_lines'):
                    records.append(self._finalize_wechat_record(current, reference_date))
                current = None
                continue

            m = header_re.match(line)
            if m:
                if current and current.get('content_lines'):
                    records.append(self._finalize_wechat_record(current, reference_date))
                current = {
                    'speaker': m.group('speaker'),
                    'raw_time': m.group('time'),
                    'content_lines': [],
                    'content_text': ''
                }
                continue

            if current is None:
                current = {'speaker': '', 'raw_time': '', 'content_lines': [], 'content_text': ''}

            current['content_lines'].append(line)
            current['content_text'] = current.get('content_text', '') + line + '\n'

            for dm in dist_re.finditer(line):
                skip = False
                prefix = line[max(0, dm.start() - 3):dm.start()]
                if any(tok in prefix for tok in ['点', '第', '时', '分', '秒', ':']):
                    skip = True
                if dm.group('num').count('.') > 1:
                    skip = True
                if not skip:
                    num = float(dm.group('num'))
                    unit = (dm.group('unit') or '').lower()
                    if unit in ('mm', '毫米', ''):
                        dist_mm = num
                    elif unit in ('cm', '厘米'):
                        dist_mm = num * 10
                    elif unit in ('m', '米'):
                        dist_mm = num * 1000
                    else:
                        dist_mm = num
                    current['distance'] = dist_mm
                    current['unit'] = unit or 'mm'

            dm = dir_re.search(line)
            if dm:
                current['direction'] = dm.group('dir')

        if current and current.get('content_lines'):
            records.append(self._finalize_wechat_record(current, reference_date))

        self._last_detection_report['parse_errors'] = [
            r for r in records
            if not r.get('timestamp')
        ]
        return records

    @staticmethod
    def _finalize_wechat_record(record: Dict, reference_date: str = None) -> Dict:
        from datetime import datetime
        raw_time = record.get('raw_time', '')
        if raw_time:
            try:
                if reference_date:
                    ts = datetime.strptime(f"{reference_date} {raw_time}", "%Y-%m-%d %H:%M:%S" if len(raw_time.split(':')) == 3 else "%Y-%m-%d %H:%M")
                else:
                    today = datetime.now().strftime("%Y-%m-%d")
                    ts = datetime.strptime(f"{today} {raw_time}", "%Y-%m-%d %H:%M:%S" if len(raw_time.split(':')) == 3 else "%Y-%m-%d %H:%M")
                record['timestamp'] = ts.strftime("%Y-%m-%d %H:%M:%S")
            except (ValueError, TypeError):
                record['timestamp'] = raw_time
        else:
            record['timestamp'] = ''

        record['content'] = record.get('content_text', '')
        if 'content_lines' in record:
            del record['content_lines']
        if 'content_text' in record:
            del record['content_text']
        if 'raw_time' in record:
            del record['raw_time']
        return record
    
    def compare_distance(self, data_df: pd.DataFrame, 
                          data_value_col: str,
                          data_time_col: str = None,
                          threshold_percent: float = 5.0,
                          threshold_absolute: float = 1.0) -> List[ConflictRecord]:
        conflicts = []
        self._last_detection_report['distance_checked'] = True
        self._last_detection_report['wechat_records_count'] = len(self.wechat_records)
        self._last_detection_report['distance_wechat_records'] = sum(
            1 for r in self.wechat_records if r.get('distance') is not None
        )
        time_matches = 0
        
        for wechat_rec in self.wechat_records:
            if 'distance' not in wechat_rec:
                continue
                
            wechat_distance = wechat_rec['distance']
            unit = wechat_rec.get('unit', 'mm')
            
            if unit == 'cm':
                wechat_distance *= 10
            elif unit == 'm':
                wechat_distance *= 1000
                
            if data_time_col and data_time_col in data_df.columns and 'timestamp' in wechat_rec and wechat_rec['timestamp']:
                try:
                    data_times = pd.to_datetime(data_df[data_time_col])
                    wechat_time = pd.to_datetime(wechat_rec['timestamp'])
                    time_diff = abs((data_times - wechat_time).dt.total_seconds())
                    closest_idx = time_diff.idxmin()
                    
                    if time_diff[closest_idx] < 300:
                        time_matches += 1
                        data_value = data_df.iloc[closest_idx][data_value_col]
                        try:
                            data_value = float(data_value)
                        except (ValueError, TypeError):
                            continue
                        discrepancy = abs(data_value - wechat_distance)
                        discrepancy_pct = (discrepancy / abs(wechat_distance)) * 100 if wechat_distance != 0 else 0
                        
                        if discrepancy_pct > threshold_percent or discrepancy > threshold_absolute:
                            severity = 'high' if discrepancy_pct > 20 or discrepancy > 10 else 'medium'
                            
                            conflicts.append(ConflictRecord(
                                conflict_type='数值差异',
                                data_source='实验数据',
                                wechat_record=wechat_rec['content'],
                                data_value=float(data_value),
                                wechat_value=float(wechat_distance),
                                discrepancy=float(discrepancy),
                                discrepancy_percent=float(discrepancy_pct),
                                timestamp=wechat_rec.get('timestamp', ''),
                                suggestion=f'建议核对测量条件，实验数据值: {data_value:.2f} mm，微信群记录: {wechat_distance:.2f} mm',
                                severity=severity
                            ))
                except Exception as e:
                    self._last_detection_report['parse_errors'].append(
                        f"时间匹配失败[{wechat_rec.get('timestamp', '')}]: {e}"
                    )
            else:
                data_values = pd.to_numeric(data_df[data_value_col], errors='coerce').dropna()
                if len(data_values) > 0:
                    mean_data = data_values.mean()
                    discrepancy = abs(mean_data - wechat_distance)
                    discrepancy_pct = (discrepancy / abs(wechat_distance)) * 100 if wechat_distance != 0 else 0
                    
                    if discrepancy_pct > threshold_percent * 2 or discrepancy > threshold_absolute * 2:
                        conflicts.append(ConflictRecord(
                            conflict_type='数值差异(概略)',
                            data_source='实验数据',
                            wechat_record=wechat_rec['content'],
                            data_value=float(mean_data),
                            wechat_value=float(wechat_distance),
                            discrepancy=float(discrepancy),
                            discrepancy_percent=float(discrepancy_pct),
                            timestamp=wechat_rec.get('timestamp', ''),
                            suggestion='时间不匹配，建议核对微信群记录对应的具体测量点',
                            severity='medium'
                        ))
        
        self._last_detection_report['time_matches'] = time_matches
        for c in conflicts:
            self._add_conflict_if_new(c)
        return conflicts
    
    def compare_direction(self, data_df: pd.DataFrame, 
                           data_direction_col: str,
                           data_time_col: str = None) -> List[ConflictRecord]:
        conflicts = []
        self._last_detection_report['direction_checked'] = True
        self._last_detection_report['directional_wechat_records'] = sum(
            1 for r in self.wechat_records if r.get('direction') is not None
        )
        
        positive_set = set(DIRECTION_GROUPS.get('正向', []))
        negative_set = set(DIRECTION_GROUPS.get('反向', []))
        
        for wechat_rec in self.wechat_records:
            if 'direction' not in wechat_rec:
                continue
                
            wechat_direction = wechat_rec['direction']
            wechat_mapped = DIRECTION_ALIASES.get(wechat_direction, wechat_direction)
            wechat_is_positive = wechat_mapped in positive_set or wechat_direction in positive_set
            
            if data_time_col and data_time_col in data_df.columns and 'timestamp' in wechat_rec and wechat_rec['timestamp']:
                try:
                    data_times = pd.to_datetime(data_df[data_time_col])
                    wechat_time = pd.to_datetime(wechat_rec['timestamp'])
                    time_diff = abs((data_times - wechat_time).dt.total_seconds())
                    closest_idx = time_diff.idxmin()
                    
                    if time_diff[closest_idx] < 300:
                        data_direction = str(data_df.iloc[closest_idx][data_direction_col]).strip()
                        data_mapped = DIRECTION_ALIASES.get(data_direction, data_direction)
                        data_is_positive = data_mapped in positive_set or data_direction in positive_set
                        data_is_negative = data_mapped in negative_set or data_direction in negative_set
                        
                        if (data_is_positive or data_is_negative) and (data_is_positive != wechat_is_positive):
                            conflicts.append(ConflictRecord(
                                conflict_type='方向冲突',
                                data_source='实验数据',
                                wechat_record=wechat_rec['content'],
                                data_value=0,
                                wechat_value=0,
                                discrepancy=0,
                                discrepancy_percent=0,
                                timestamp=wechat_rec.get('timestamp', ''),
                                suggestion=f'方向不一致，实验数据: {data_direction}，微信群记录: {wechat_direction}',
                                severity='high'
                            ))
                except Exception as e:
                    self._last_detection_report['parse_errors'].append(
                        f"方向匹配失败[{wechat_rec.get('timestamp', '')}]: {e}"
                    )
                    
        for c in conflicts:
            self._add_conflict_if_new(c)
        return conflicts
    
    def get_conflict_summary(self) -> Dict:
        pending = self.get_pending_conflicts()
        summary = {
            'total_conflicts': len(self.conflicts),
            'pending_conflicts': len(pending),
            'resolved_conflicts': len([c for c in self.conflicts if c.status == 'resolved']),
            'ignored_conflicts': len([c for c in self.conflicts if c.status == 'ignored']),
            'by_type': {},
            'by_severity': {'high': 0, 'medium': 0, 'low': 0},
            'conflicts': self.conflicts,
            'pending_conflicts_list': pending,
            'detection_report': dict(self._last_detection_report)
        }
        
        for conflict in self.conflicts:
            if conflict.conflict_type not in summary['by_type']:
                summary['by_type'][conflict.conflict_type] = 0
            summary['by_type'][conflict.conflict_type] += 1
            
            summary['by_severity'][conflict.severity] += 1
            
        return summary
    
    def get_suggested_actions(self) -> List[str]:
        actions = []
        pending = self.get_pending_conflicts()
        report = self._last_detection_report
        
        if not report.get('distance_checked') and not report.get('direction_checked'):
            actions.append("⚠️ 冲突检测尚未执行，请点击「检测冲突」按钮")
            return actions
        
        actions.append(
            f"检测状态: 微信记录 {report.get('wechat_records_count', 0)} 条 | "
            f"含距离 {report.get('distance_wechat_records', 0)} 条 | "
            f"含方向 {report.get('directional_wechat_records', 0)} 条 | "
            f"时间匹配 {report.get('time_matches', 0)} 次"
        )
        
        if report.get('parse_errors'):
            actions.append(f"⚠️ 解析/匹配异常 {len(report['parse_errors'])} 条:")
            for e in report['parse_errors'][:3]:
                actions.append(f"  - {e}")
        
        high_conflicts = [c for c in pending if c.severity == 'high']
        medium_conflicts = [c for c in pending if c.severity == 'medium']
        
        if high_conflicts:
            actions.append(f"【紧急】存在 {len(high_conflicts)} 个未处理严重冲突：")
            for c in high_conflicts[:3]:
                actions.append(f"  - [{c.conflict_type}] {c.suggestion}")
                
        if medium_conflicts:
            actions.append(f"【建议】存在 {len(medium_conflicts)} 个未处理中等冲突：")
            for c in medium_conflicts[:2]:
                actions.append(f"  - [{c.conflict_type}] {c.suggestion}")
                
        if not pending:
            resolved = len([c for c in self.conflicts if c.status == 'resolved'])
            ignored = len([c for c in self.conflicts if c.status == 'ignored'])
            if self.conflicts:
                actions.append(f"✅ 所有 {len(self.conflicts)} 个冲突均已处理（已解决 {resolved}，已忽略 {ignored}），可以继续校准流程")
            else:
                if report.get('direction_checked') or report.get('distance_checked'):
                    actions.append("✅ 已执行冲突检测，未发现新的冲突，可以继续校准流程")
                else:
                    actions.append("⚠️ 未检测到冲突（检测未完整执行，请确认列选择正确）")
            
        return actions
    
    def clear_conflicts(self):
        self.conflicts = []
        self.wechat_records = []
        self._seen_conflict_keys = set()
        self._resolved_keys = set()
        self._ignored_keys = set()
        self._last_detection_report = {
            'distance_checked': False,
            'direction_checked': False,
            'wechat_records_count': 0,
            'directional_wechat_records': 0,
            'distance_wechat_records': 0,
            'time_matches': 0,
            'parse_errors': []
        }
