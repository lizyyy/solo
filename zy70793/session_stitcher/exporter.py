import json
import csv
from typing import List, Dict
from pathlib import Path
from datetime import datetime


class Exporter:
    def __init__(self, output_format: str = "ndjson", time_field: str = "event_time"):
        self.output_format = output_format
        self.time_field = time_field

    def export(self, sessions: List[Dict], output_path: str) -> str:
        if self.output_format == "ndjson":
            return self._export_ndjson(sessions, output_path)
        elif self.output_format == "csv":
            return self._export_csv(sessions, output_path)
        else:
            raise ValueError(f"不支持的输出格式: {self.output_format}")

    def _export_ndjson(self, sessions: List[Dict], output_path: str) -> str:
        output_file = f"{output_path}.jsonl"
        
        with open(output_file, 'w', encoding='utf-8') as f:
            for session in sessions:
                export_session = self._prepare_session_for_export(session)
                f.write(json.dumps(export_session, ensure_ascii=False) + '\n')
        
        return output_file

    def _export_csv(self, sessions: List[Dict], output_path: str) -> str:
        events_file = f"{output_path}_events.csv"
        sessions_file = f"{output_path}_sessions.csv"
        
        self._export_sessions_csv(sessions, sessions_file)
        self._export_events_csv(sessions, events_file)
        
        return f"{sessions_file}, {events_file}"

    def _export_sessions_csv(self, sessions: List[Dict], output_path: str):
        fieldnames = [
            'user_id',
            'session_id',
            'start_time',
            'end_time',
            'duration_seconds',
            'event_count',
            'has_gaps',
            'gap_count',
            'total_gap_seconds',
            'max_gap_seconds',
            'sources'
        ]
        
        with open(output_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for session in sessions:
                row = {
                    'user_id': session['user_id'],
                    'session_id': session['session_id'],
                    'start_time': self._format_timestamp(session['start_time']),
                    'end_time': self._format_timestamp(session['end_time']),
                    'duration_seconds': session['end_time'] - session['start_time'],
                    'event_count': session['event_count'],
                    'has_gaps': session['has_gaps'],
                    'gap_count': session['gap_count'],
                    'total_gap_seconds': session['total_gap_seconds'],
                    'max_gap_seconds': session['max_gap_seconds'],
                    'sources': '|'.join(session['sources'])
                }
                writer.writerow(row)

    def _export_events_csv(self, sessions: List[Dict], output_path: str):
        base_fields = ['user_id', 'session_id', 'event_index', 'source_file', 'source_line']
        
        all_event_fields = set()
        for session in sessions:
            for event in session['events']:
                for key in event.keys():
                    if not key.startswith('_') and key not in ['user_id', 'session_id']:
                        all_event_fields.add(key)
        
        event_fields = sorted(all_event_fields)
        fieldnames = base_fields + event_fields + ['has_gap_before', 'gap_duration_seconds', 'gap_type']
        
        with open(output_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for session in sessions:
                for idx, event in enumerate(session['events']):
                    row = {
                        'user_id': session['user_id'],
                        'session_id': session['session_id'],
                        'event_index': idx,
                        'source_file': event['_source']['file'],
                        'source_line': event['_source']['line']
                    }
                    
                    for field in event_fields:
                        value = event.get(field, '')
                        if isinstance(value, (dict, list)):
                            value = json.dumps(value, ensure_ascii=False)
                        row[field] = value
                    
                    gap_info = event.get('_gap_info', {})
                    row['has_gap_before'] = gap_info.get('has_gap_before', False)
                    row['gap_duration_seconds'] = gap_info.get('gap_duration_seconds', '')
                    row['gap_type'] = gap_info.get('gap_type', '')
                    
                    writer.writerow(row)

    def _prepare_session_for_export(self, session: Dict) -> Dict:
        export_session = {
            'user_id': session['user_id'],
            'session_id': session['session_id'],
            'start_time': self._format_timestamp(session['start_time']),
            'end_time': self._format_timestamp(session['end_time']),
            'duration_seconds': session['end_time'] - session['start_time'],
            'event_count': session['event_count'],
            'has_gaps': session['has_gaps'],
            'gap_count': session['gap_count'],
            'total_gap_seconds': session['total_gap_seconds'],
            'max_gap_seconds': session['max_gap_seconds'],
            'sources': session['sources'],
            'gaps': session['gaps'],
            'events': []
        }
        
        for event in session['events']:
            export_event = {k: v for k, v in event.items() if not k.startswith('_')}
            if '_gap_info' in event:
                export_event['_gap_info'] = event['_gap_info']
            export_event['_source'] = event['_source']
            export_session['events'].append(export_event)
        
        return export_session

    def _format_timestamp(self, timestamp: float) -> str:
        dt = datetime.fromtimestamp(timestamp)
        return dt.isoformat()
