import json
from typing import List, Dict
from datetime import datetime
from collections import Counter


class ReportGenerator:
    def generate(
        self,
        input_files: List[str],
        total_events: int,
        bad_lines: List[Dict],
        total_sessions: int,
        sessions_with_gaps: List[Dict],
        args: Dict
    ) -> Dict:
        sessions_with_gaps_count = sum(1 for s in sessions_with_gaps if s['has_gaps'])
        total_gaps = sum(s['gap_count'] for s in sessions_with_gaps)
        total_gap_seconds = sum(s['total_gap_seconds'] for s in sessions_with_gaps)
        
        gap_type_counts = Counter()
        cross_file_gaps = 0
        
        for session in sessions_with_gaps:
            for gap in session['gaps']:
                gap_type_counts[gap['gap_type']] += 1
                if gap['cross_file']:
                    cross_file_gaps += 1
        
        file_stats = self._generate_file_stats(input_files, sessions_with_gaps, bad_lines)
        
        report = {
            'report_generated_at': datetime.now().isoformat(),
            'parameters': args,
            'summary': {
                'input_files_count': len(input_files),
                'total_events': total_events,
                'bad_lines_count': len(bad_lines),
                'total_sessions': total_sessions,
                'sessions_with_gaps': sessions_with_gaps_count,
                'sessions_with_gaps_percentage': self._percentage(sessions_with_gaps_count, total_sessions),
                'total_gaps': total_gaps,
                'total_gap_seconds': total_gap_seconds,
                'avg_gap_seconds_per_session': self._avg(total_gap_seconds, sessions_with_gaps_count),
                'cross_file_gaps': cross_file_gaps,
                'cross_file_gaps_percentage': self._percentage(cross_file_gaps, total_gaps)
            },
            'gap_type_distribution': dict(gap_type_counts),
            'file_statistics': file_stats,
            'top_sessions_by_gap_count': self._get_top_sessions(sessions_with_gaps, 'gap_count', 10),
            'top_sessions_by_gap_duration': self._get_top_sessions(sessions_with_gaps, 'total_gap_seconds', 10),
            'bad_lines': bad_lines[:100],
            'bad_lines_count': len(bad_lines)
        }
        
        return report

    def _generate_file_stats(
        self,
        input_files: List[str],
        sessions_with_gaps: List[Dict],
        bad_lines: List[Dict]
    ) -> Dict:
        file_stats = {}
        
        bad_lines_by_file = Counter()
        for bad_line in bad_lines:
            bad_lines_by_file[bad_line['file']] += 1
        
        events_by_file = Counter()
        gaps_by_file = Counter()
        
        for session in sessions_with_gaps:
            for event in session['events']:
                events_by_file[event['_source']['file']] += 1
            for gap in session['gaps']:
                if gap['cross_file']:
                    gaps_by_file[gap['prev_event']['source_file']] += 1
                    gaps_by_file[gap['next_event']['source_file']] += 1
                else:
                    gaps_by_file[gap['prev_event']['source_file']] += 1
        
        for file_path in input_files:
            file_stats[file_path] = {
                'events_count': events_by_file.get(file_path, 0),
                'bad_lines_count': bad_lines_by_file.get(file_path, 0),
                'gaps_involving_file': gaps_by_file.get(file_path, 0)
            }
        
        return file_stats

    def _get_top_sessions(self, sessions: List[Dict], key: str, limit: int) -> List[Dict]:
        sorted_sessions = sorted(sessions, key=lambda s: s[key], reverse=True)[:limit]
        
        result = []
        for session in sorted_sessions:
            result.append({
                'user_id': session['user_id'],
                'session_id': session['session_id'],
                'event_count': session['event_count'],
                'gap_count': session['gap_count'],
                'total_gap_seconds': session['total_gap_seconds'],
                'max_gap_seconds': session['max_gap_seconds']
            })
        
        return result

    def _percentage(self, part: int, total: int) -> float:
        if total == 0:
            return 0.0
        return round((part / total) * 100, 2)

    def _avg(self, total: float, count: int) -> float:
        if count == 0:
            return 0.0
        return round(total / count, 2)

    def save(self, report: Dict, report_path: str):
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
