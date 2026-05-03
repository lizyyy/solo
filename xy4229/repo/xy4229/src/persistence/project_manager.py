"""项目持久化模块"""
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import os

from src.models.models import (
    CalibrationProject, Subtitle, TimecodeEntry, AudioAnnotation,
    FeedbackRecord, Issue, IssueType, IssueSeverity,
    parse_srt_time, timedelta_to_srt_format
)


class ProjectSerializer:
    """项目序列化器"""
    
    @staticmethod
    def _timedelta_to_dict(td: timedelta) -> Dict[str, Any]:
        """将 timedelta 转换为可序列化的字典"""
        return {
            'seconds': td.total_seconds(),
            'formatted': str(td)
        }
    
    @staticmethod
    def _dict_to_timedelta(data: Any) -> timedelta:
        """从字典或字符串恢复 timedelta"""
        if isinstance(data, dict):
            return timedelta(seconds=data.get('seconds', 0))
        elif isinstance(data, (int, float)):
            return timedelta(seconds=data)
        elif isinstance(data, str):
            try:
                return parse_srt_time(data)
            except ValueError:
                return timedelta(0)
        return timedelta(0)
    
    @staticmethod
    def project_to_dict(project: CalibrationProject) -> Dict[str, Any]:
        """将项目转换为可序列化的字典"""
        data = {
            'version': '1.0',
            'name': project.name,
            'created_at': project.created_at.isoformat() if project.created_at else None,
            'modified_at': project.modified_at.isoformat() if project.modified_at else None,
            'notes': project.notes,
            'global_offset': ProjectSerializer._timedelta_to_dict(project.global_offset),
            'subtitles': [],
            'timecodes': [],
            'audio_annotations': [],
            'feedback_records': [],
            'issues': []
        }
        
        # 字幕
        for sub in project.subtitles:
            sub_data = {
                'index': sub.index,
                'start_time': ProjectSerializer._timedelta_to_dict(sub.start_time),
                'end_time': ProjectSerializer._timedelta_to_dict(sub.end_time),
                'original_start_time': ProjectSerializer._timedelta_to_dict(sub.original_start_time) if sub.original_start_time else None,
                'original_end_time': ProjectSerializer._timedelta_to_dict(sub.original_end_time) if sub.original_end_time else None,
                'offset_applied': ProjectSerializer._timedelta_to_dict(sub.offset_applied),
                'text': sub.text,
                'speaker': sub.speaker,
                'sound_effect': sub.sound_effect
            }
            data['subtitles'].append(sub_data)
        
        # 时间码
        for tc in project.timecodes:
            tc_data = {
                'index': tc.index,
                'timecode': ProjectSerializer._timedelta_to_dict(tc.timecode),
                'description': tc.description,
                'scene_type': tc.scene_type
            }
            data['timecodes'].append(tc_data)
        
        # 音频标注
        for ann in project.audio_annotations:
            ann_data = {
                'index': ann.index,
                'start_time': ProjectSerializer._timedelta_to_dict(ann.start_time),
                'end_time': ProjectSerializer._timedelta_to_dict(ann.end_time),
                'sound_type': ann.sound_type,
                'description': ann.description,
                'volume': ann.volume
            }
            data['audio_annotations'].append(ann_data)
        
        # 反馈记录
        for fb in project.feedback_records:
            fb_data = {
                'index': fb.index,
                'timestamp': ProjectSerializer._timedelta_to_dict(fb.timestamp),
                'issue_type': fb.issue_type,
                'description': fb.description,
                'reporter': fb.reporter,
                'severity': fb.severity
            }
            data['feedback_records'].append(fb_data)
        
        # 问题
        for issue in project.issues:
            issue_data = {
                'issue_type': issue.issue_type.value if hasattr(issue.issue_type, 'value') else str(issue.issue_type),
                'subtitle_index': issue.subtitle_index,
                'start_time': ProjectSerializer._timedelta_to_dict(issue.start_time) if issue.start_time else None,
                'end_time': ProjectSerializer._timedelta_to_dict(issue.end_time) if issue.end_time else None,
                'severity': issue.severity.value if hasattr(issue.severity, 'value') else str(issue.severity),
                'description': issue.description,
                'suggested_fix': issue.suggested_fix,
                'resolved': issue.resolved,
                'resolution_note': issue.resolution_note
            }
            data['issues'].append(issue_data)
        
        return data
    
    @staticmethod
    def dict_to_project(data: Dict[str, Any]) -> CalibrationProject:
        """从字典恢复项目"""
        project = CalibrationProject()
        
        project.name = data.get('name', '未命名项目')
        
        created_at = data.get('created_at')
        if created_at:
            try:
                project.created_at = datetime.fromisoformat(created_at)
            except ValueError:
                pass
        
        modified_at = data.get('modified_at')
        if modified_at:
            try:
                project.modified_at = datetime.fromisoformat(modified_at)
            except ValueError:
                pass
        
        project.notes = data.get('notes', '')
        project.global_offset = ProjectSerializer._dict_to_timedelta(data.get('global_offset', 0))
        
        # 恢复字幕
        for sub_data in data.get('subtitles', []):
            sub = Subtitle(
                index=sub_data.get('index', 0),
                start_time=ProjectSerializer._dict_to_timedelta(sub_data.get('start_time', 0)),
                end_time=ProjectSerializer._dict_to_timedelta(sub_data.get('end_time', 0)),
                text=sub_data.get('text', ''),
                speaker=sub_data.get('speaker'),
                sound_effect=sub_data.get('sound_effect', False),
                offset_applied=ProjectSerializer._dict_to_timedelta(sub_data.get('offset_applied', 0)),
                original_start_time=ProjectSerializer._dict_to_timedelta(sub_data.get('original_start_time')) if sub_data.get('original_start_time') else None,
                original_end_time=ProjectSerializer._dict_to_timedelta(sub_data.get('original_end_time')) if sub_data.get('original_end_time') else None
            )
            project.subtitles.append(sub)
        
        # 恢复时间码
        for tc_data in data.get('timecodes', []):
            tc = TimecodeEntry(
                index=tc_data.get('index', 0),
                timecode=ProjectSerializer._dict_to_timedelta(tc_data.get('timecode', 0)),
                description=tc_data.get('description', ''),
                scene_type=tc_data.get('scene_type', 'dialogue')
            )
            project.timecodes.append(tc)
        
        # 恢复音频标注
        for ann_data in data.get('audio_annotations', []):
            ann = AudioAnnotation(
                index=ann_data.get('index', 0),
                start_time=ProjectSerializer._dict_to_timedelta(ann_data.get('start_time', 0)),
                end_time=ProjectSerializer._dict_to_timedelta(ann_data.get('end_time', 0)),
                sound_type=ann_data.get('sound_type', 'effect'),
                description=ann_data.get('description', ''),
                volume=ann_data.get('volume', 'normal')
            )
            project.audio_annotations.append(ann)
        
        # 恢复反馈记录
        for fb_data in data.get('feedback_records', []):
            fb = FeedbackRecord(
                index=fb_data.get('index', 0),
                timestamp=ProjectSerializer._dict_to_timedelta(fb_data.get('timestamp', 0)),
                issue_type=fb_data.get('issue_type', ''),
                description=fb_data.get('description', ''),
                reporter=fb_data.get('reporter', ''),
                severity=fb_data.get('severity', 'medium')
            )
            project.feedback_records.append(fb)
        
        # 恢复问题
        for issue_data in data.get('issues', []):
            # 解析问题类型枚举
            issue_type_str = issue_data.get('issue_type', '')
            issue_type = None
            for member in IssueType:
                if member.value == issue_type_str or member.name == issue_type_str:
                    issue_type = member
                    break
            if issue_type is None:
                issue_type = IssueType.SUBTITLE_DELAY  # 默认值
            
            # 解析严重程度枚举
            severity_str = issue_data.get('severity', '')
            severity = None
            for member in IssueSeverity:
                if member.value == severity_str or member.name == severity_str:
                    severity = member
                    break
            if severity is None:
                severity = IssueSeverity.MEDIUM
            
            issue = Issue(
                issue_type=issue_type,
                subtitle_index=issue_data.get('subtitle_index'),
                start_time=ProjectSerializer._dict_to_timedelta(issue_data.get('start_time')) if issue_data.get('start_time') else None,
                end_time=ProjectSerializer._dict_to_timedelta(issue_data.get('end_time')) if issue_data.get('end_time') else None,
                severity=severity,
                description=issue_data.get('description', ''),
                suggested_fix=issue_data.get('suggested_fix', ''),
                resolved=issue_data.get('resolved', False),
                resolution_note=issue_data.get('resolution_note', '')
            )
            project.issues.append(issue)
        
        return project


class ProjectManager:
    """项目管理器"""
    
    PROJECT_EXTENSION = '.scc'  # Subtitle Calibration Project
    
    def __init__(self):
        self.current_project: Optional[CalibrationProject] = None
        self.current_file_path: Optional[str] = None
    
    def new_project(self, name: str = "未命名项目") -> CalibrationProject:
        """创建新项目"""
        self.current_project = CalibrationProject(name=name)
        self.current_file_path = None
        return self.current_project
    
    def save_project(self, file_path: str = None) -> bool:
        """保存项目"""
        if self.current_project is None:
            return False
        
        if file_path is None:
            file_path = self.current_file_path
        
        if file_path is None:
            return False
        
        # 更新修改时间
        self.current_project.modified_at = datetime.now()
        
        # 序列化并保存
        try:
            data = ProjectSerializer.project_to_dict(self.current_project)
            
            # 确保目录存在
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            
            self.current_file_path = file_path
            return True
        except Exception as e:
            print(f"保存项目失败: {e}")
            return False
    
    def load_project(self, file_path: str) -> Optional[CalibrationProject]:
        """加载项目"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            project = ProjectSerializer.dict_to_project(data)
            self.current_project = project
            self.current_file_path = file_path
            return project
        except Exception as e:
            print(f"加载项目失败: {e}")
            return None
    
    def import_from_files(
        self,
        srt_path: str = None,
        timecode_csv_path: str = None,
        audio_json_path: str = None,
        feedback_csv_path: str = None
    ) -> Dict[str, Any]:
        """从各种文件导入数据到当前项目"""
        if self.current_project is None:
            self.new_project()
        
        result = {
            'success': True,
            'imported': [],
            'errors': []
        }
        
        # 导入 SRT
        if srt_path:
            try:
                from src.parsers.srt_parser import SRTParser
                subtitles = SRTParser.parse_file(srt_path)
                self.current_project.subtitles.extend(subtitles)
                result['imported'].append({
                    'type': 'srt',
                    'file': srt_path,
                    'count': len(subtitles)
                })
            except Exception as e:
                result['errors'].append(f"导入 SRT 失败: {e}")
                result['success'] = False
        
        # 导入时间码 CSV
        if timecode_csv_path:
            try:
                from src.parsers.csv_parser import CSVParser
                timecodes = CSVParser.parse_timecodes(timecode_csv_path)
                self.current_project.timecodes.extend(timecodes)
                result['imported'].append({
                    'type': 'timecodes',
                    'file': timecode_csv_path,
                    'count': len(timecodes)
                })
            except Exception as e:
                result['errors'].append(f"导入时间码 CSV 失败: {e}")
                result['success'] = False
        
        # 导入音频标注 JSON
        if audio_json_path:
            try:
                from src.parsers.json_parser import JSONParser
                annotations = JSONParser.parse_audio_annotations(audio_json_path)
                self.current_project.audio_annotations.extend(annotations)
                result['imported'].append({
                    'type': 'audio_annotations',
                    'file': audio_json_path,
                    'count': len(annotations)
                })
            except Exception as e:
                result['errors'].append(f"导入音频标注 JSON 失败: {e}")
                result['success'] = False
        
        # 导入反馈记录 CSV
        if feedback_csv_path:
            try:
                from src.parsers.csv_parser import CSVParser
                feedbacks = CSVParser.parse_feedback(feedback_csv_path)
                self.current_project.feedback_records.extend(feedbacks)
                result['imported'].append({
                    'type': 'feedback',
                    'file': feedback_csv_path,
                    'count': len(feedbacks)
                })
            except Exception as e:
                result['errors'].append(f"导入反馈记录 CSV 失败: {e}")
                result['success'] = False
        
        return result
    
    def run_analysis(self) -> Dict[str, Any]:
        """运行规则引擎分析"""
        if self.current_project is None:
            return {
                'success': False,
                'message': '没有打开的项目'
            }
        
        from src.rules.rules_engine import RulesEngine
        
        engine = RulesEngine()
        issues = engine.check_all(self.current_project)
        
        self.current_project.issues = issues
        
        # 统计
        stats = {
            'total': len(issues),
            'by_type': {},
            'by_severity': {}
        }
        
        for issue in issues:
            # 按类型统计
            type_key = issue.issue_type.value
            stats['by_type'][type_key] = stats['by_type'].get(type_key, 0) + 1
            
            # 按严重程度统计
            sev_key = issue.severity.value
            stats['by_severity'][sev_key] = stats['by_severity'].get(sev_key, 0) + 1
        
        return {
            'success': True,
            'issues': issues,
            'stats': stats,
            'message': f'检测到 {len(issues)} 个问题'
        }
