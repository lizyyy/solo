from typing import List, Dict
from .subtitle_parser import SubtitleItem


class TimelineChecker:
    @staticmethod
    def check_overlaps(subtitles: List[SubtitleItem]) -> List[Dict]:
        issues = []
        for i in range(len(subtitles)):
            current = subtitles[i]
            for j in range(i + 1, len(subtitles)):
                next_sub = subtitles[j]
                if current.end_seconds > next_sub.start_seconds and next_sub.start_seconds < current.end_seconds:
                    issues.append({
                        'type': 'timeline_overlap',
                        'subtitle_index': current.index,
                        'other_index': next_sub.index,
                        'start_time': current.start_time,
                        'end_time': current.end_time,
                        'other_start_time': next_sub.start_time,
                        'other_end_time': next_sub.end_time,
                        'description': f'字幕 {current.index} ({current.start_time} - {current.end_time}) 与字幕 {next_sub.index} ({next_sub.start_time} - {next_sub.end_time}) 时间重叠',
                        'suggestion': '请调整时间轴，确保字幕时间不重叠',
                        'original_text': current.text,
                        'other_text': next_sub.text
                    })
        return issues

    @staticmethod
    def check_backward(subtitles: List[SubtitleItem]) -> List[Dict]:
        issues = []
        for i in range(1, len(subtitles)):
            current = subtitles[i]
            previous = subtitles[i - 1]
            if current.start_seconds < previous.end_seconds:
                issues.append({
                    'type': 'timeline_backward',
                    'subtitle_index': current.index,
                    'previous_index': previous.index,
                    'start_time': current.start_time,
                    'end_time': current.end_time,
                    'previous_start_time': previous.start_time,
                    'previous_end_time': previous.end_time,
                    'description': f'字幕 {current.index} 的开始时间 ({current.start_time}) 早于字幕 {previous.index} 的结束时间 ({previous.end_time})',
                    'suggestion': '请调整时间轴，确保字幕按时间顺序排列',
                    'original_text': current.text
                })
        return issues

    @staticmethod
    def check(subtitles: List[SubtitleItem]) -> List[Dict]:
        issues = []
        issues.extend(TimelineChecker.check_overlaps(subtitles))
        issues.extend(TimelineChecker.check_backward(subtitles))
        return issues
