"""CSV 时间码解析器"""
import csv
from datetime import timedelta
from typing import List, Dict, Any
import os

from src.models.models import TimecodeEntry, FeedbackRecord, parse_srt_time


class CSVParser:
    """CSV 文件解析器"""
    
    @classmethod
    def parse_timecodes(cls, file_path: str, encoding: str = 'utf-8') -> List[TimecodeEntry]:
        """解析视频时间码 CSV 文件"""
        timecodes = []
        
        with open(file_path, 'r', encoding=encoding, newline='') as f:
            reader = csv.DictReader(f)
            
            for row_num, row in enumerate(reader, start=1):
                # 尝试获取时间码
                timecode_str = None
                for key in ['timecode', 'time', 'timestamp', 'start', '开始时间']:
                    if key in row:
                        timecode_str = row[key].strip()
                        break
                
                if not timecode_str:
                    continue
                
                try:
                    timecode = parse_srt_time(timecode_str)
                except ValueError:
                    # 尝试其他格式
                    try:
                        timecode = timedelta(seconds=float(timecode_str))
                    except ValueError:
                        continue
                
                # 获取描述
                description = ""
                for key in ['description', 'desc', '场景', '内容', 'scene', 'action']:
                    if key in row:
                        description = row[key].strip()
                        break
                
                # 获取场景类型
                scene_type = "dialogue"
                for key in ['type', 'scene_type', '类型', '场景类型']:
                    if key in row:
                        scene_type = row[key].strip().lower()
                        break
                
                entry = TimecodeEntry(
                    index=row_num,
                    timecode=timecode,
                    description=description,
                    scene_type=scene_type
                )
                timecodes.append(entry)
        
        # 按时间排序
        timecodes.sort(key=lambda t: t.timecode)
        
        return timecodes
    
    @classmethod
    def parse_feedback(cls, file_path: str, encoding: str = 'utf-8') -> List[FeedbackRecord]:
        """解析反馈记录 CSV 文件"""
        feedbacks = []
        
        with open(file_path, 'r', encoding=encoding, newline='') as f:
            reader = csv.DictReader(f)
            
            for row_num, row in enumerate(reader, start=1):
                # 尝试获取时间戳
                timestamp_str = None
                for key in ['timecode', 'time', 'timestamp', 'start', '时间', '时间戳']:
                    if key in row:
                        timestamp_str = row[key].strip()
                        break
                
                if not timestamp_str:
                    continue
                
                try:
                    timestamp = parse_srt_time(timestamp_str)
                except ValueError:
                    try:
                        timestamp = timedelta(seconds=float(timestamp_str))
                    except ValueError:
                        continue
                
                # 获取问题类型
                issue_type = ""
                for key in ['issue_type', 'type', '问题类型', '类型', 'category']:
                    if key in row:
                        issue_type = row[key].strip()
                        break
                
                # 获取描述
                description = ""
                for key in ['description', 'desc', '描述', '内容', 'feedback', '反馈']:
                    if key in row:
                        description = row[key].strip()
                        break
                
                # 获取报告人
                reporter = ""
                for key in ['reporter', '报告人', 'name', '姓名']:
                    if key in row:
                        reporter = row[key].strip()
                        break
                
                # 获取严重程度
                severity = "medium"
                for key in ['severity', '严重程度', 'priority', '优先级']:
                    if key in row:
                        severity = row[key].strip().lower()
                        break
                
                record = FeedbackRecord(
                    index=row_num,
                    timestamp=timestamp,
                    issue_type=issue_type,
                    description=description,
                    reporter=reporter,
                    severity=severity
                )
                feedbacks.append(record)
        
        # 按时间排序
        feedbacks.sort(key=lambda f: f.timestamp)
        
        return feedbacks
    
    @classmethod
    def write_issues_csv(cls, issues: List[Any], file_path: str, encoding: str = 'utf-8'):
        """将问题列表写入 CSV 文件"""
        from src.models.models import Issue
        
        with open(file_path, 'w', encoding=encoding, newline='') as f:
            fieldnames = [
                '序号', '问题类型', '字幕索引', '开始时间', '结束时间',
                '严重程度', '问题描述', '建议修复', '是否已解决', '解决备注'
            ]
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for i, issue in enumerate(issues, start=1):
                writer.writerow({
                    '序号': i,
                    '问题类型': issue.issue_type.value if hasattr(issue.issue_type, 'value') else str(issue.issue_type),
                    '字幕索引': issue.subtitle_index if issue.subtitle_index else '',
                    '开始时间': str(issue.start_time) if issue.start_time else '',
                    '结束时间': str(issue.end_time) if issue.end_time else '',
                    '严重程度': issue.severity.value if hasattr(issue.severity, 'value') else str(issue.severity),
                    '问题描述': issue.description,
                    '建议修复': issue.suggested_fix,
                    '是否已解决': '是' if issue.resolved else '否',
                    '解决备注': issue.resolution_note
                })
