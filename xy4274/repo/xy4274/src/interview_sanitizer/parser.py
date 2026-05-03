"""解析校验模块 - 负责解析 SRT、CSV 授权表、敏感词词典和音频清单"""

import os
from dataclasses import dataclass, field
from datetime import timedelta
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

import pysrt
from pysrt import SubRipFile, SubRipItem


class IssueType(Enum):
    """问题类型枚举"""
    AUTHORIZATION_GAP = "授权缺口"
    NAME_LEAK = "姓名泄露"
    TIMELINE_OVERLAP = "时间轴重叠"
    MISSING_AUDIO = "缺音频"


@dataclass
class Issue:
    """问题数据类"""
    issue_type: IssueType
    description: str
    severity: str  # "high", "medium", "low"
    location: Optional[Dict[str, Any]] = None
    context: Optional[str] = None


@dataclass
class SRTContent:
    """SRT 文件内容"""
    file_path: Path
    subtitles: SubRipFile
    issues: List[Issue] = field(default_factory=list)
    
    @property
    def duration(self) -> Optional[timedelta]:
        """获取字幕文件总时长"""
        if not self.subtitles:
            return None
        return self.subtitles[-1].end - self.subtitles[0].start


@dataclass
class AuthorizationRecord:
    """授权记录"""
    name: str
    pseudonym: Optional[str] = None
    is_authorized: bool = True
    segments: List[Tuple[timedelta, timedelta]] = field(default_factory=list)


@dataclass
class AuthorizationData:
    """授权数据"""
    file_path: Path
    records: Dict[str, AuthorizationRecord] = field(default_factory=dict)
    issues: List[Issue] = field(default_factory=list)
    
    def get_pseudonym(self, name: str) -> Optional[str]:
        """获取姓名的化名"""
        record = self.records.get(name)
        return record.pseudonym if record else None
    
    def is_authorized(self, name: str, segment_start: timedelta, segment_end: timedelta) -> bool:
        """检查某片段是否在授权范围内"""
        record = self.records.get(name)
        if not record or not record.is_authorized:
            return False
        if not record.segments:
            return record.is_authorized
        for start, end in record.segments:
            if segment_start >= start and segment_end <= end:
                return True
        return False


@dataclass
class AudioSlice:
    """音频切片"""
    file_path: Path
    segment_index: int
    start_time: timedelta
    end_time: timedelta
    exists: bool = True


@dataclass
class AudioManifest:
    """音频清单"""
    file_path: Path
    slices: List[AudioSlice] = field(default_factory=list)
    issues: List[Issue] = field(default_factory=list)


@dataclass
class SensitiveName:
    """敏感姓名"""
    original: str
    categories: List[str] = field(default_factory=list)
    suggested_pseudonym: Optional[str] = None


@dataclass
class SensitiveNames:
    """敏感词词典"""
    file_path: Optional[Path] = None
    names: Dict[str, SensitiveName] = field(default_factory=dict)
    
    def get_all_names(self) -> Set[str]:
        """获取所有敏感姓名"""
        return set(self.names.keys())


class SRTParser:
    """SRT 解析器"""
    
    @staticmethod
    def parse(file_path: Path) -> SRTContent:
        """解析 SRT 文件"""
        try:
            subtitles = pysrt.open(str(file_path))
            content = SRTContent(file_path=file_path, subtitles=subtitles)
            content.issues = SRTParser._check_timeline(subtitles, file_path)
            return content
        except Exception as e:
            raise ValueError(f"解析 SRT 文件失败: {file_path} - {e}")
    
    @staticmethod
    def _check_timeline(subtitles: SubRipFile, file_path: Path) -> List[Issue]:
        """检查时间轴问题"""
        issues = []
        for i in range(1, len(subtitles)):
            prev = subtitles[i-1]
            curr = subtitles[i]
            
            if curr.start < prev.end:
                issues.append(Issue(
                    issue_type=IssueType.TIMELINE_OVERLAP,
                    description=f"时间轴重叠：第 {i} 条字幕与前一条重叠",
                    severity="medium",
                    location={
                        "file": str(file_path),
                        "subtitle_index": i,
                        "prev_start": str(prev.start),
                        "prev_end": str(prev.end),
                        "curr_start": str(curr.start),
                        "curr_end": str(curr.end)
                    },
                    context=f"前一条: {prev.text}\n当前: {curr.text}"
                ))
        return issues
    
    @staticmethod
    def check_name_leaks(content: SRTContent, sensitive_names: SensitiveNames, authorization_data: AuthorizationData) -> List[Issue]:
        """检查姓名泄露"""
        issues = []
        all_names = sensitive_names.get_all_names()
        
        for sub in content.subtitles:
            text = sub.text
            found_names = []
            
            for name in all_names:
                if name in text:
                    found_names.append(name)
            
            for name in found_names:
                pseudonym = authorization_data.get_pseudonym(name)
                if not pseudonym:
                    issues.append(Issue(
                        issue_type=IssueType.NAME_LEAK,
                        description=f"发现敏感姓名「{name}」，且无对应化名",
                        severity="high",
                        location={
                            "file": str(content.file_path),
                            "subtitle_index": sub.index,
                            "start_time": str(sub.start),
                            "end_time": str(sub.end)
                        },
                        context=text
                    ))
                elif name in text:
                    issues.append(Issue(
                        issue_type=IssueType.NAME_LEAK,
                        description=f"发现敏感姓名「{name}」，应替换为「{pseudonym}」",
                        severity="medium",
                        location={
                            "file": str(content.file_path),
                            "subtitle_index": sub.index,
                            "start_time": str(sub.start),
                            "end_time": str(sub.end)
                        },
                        context=text
                    ))
        
        return issues


class AuthorizationParser:
    """授权表解析器"""
    
    @staticmethod
    def parse(file_path: Path) -> AuthorizationData:
        """解析 CSV 授权表"""
        import csv
        
        data = AuthorizationData(file_path=file_path)
        issues = []
        name_pseudonym_map: Dict[str, str] = {}
        
        try:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    name = row.get('姓名', '').strip()
                    if not name:
                        continue
                    
                    pseudonym = row.get('化名', '').strip() or None
                    authorized = row.get('授权状态', '').strip() not in ['未授权', '否', '0', 'false']
                    
                    if pseudonym:
                        if pseudonym in name_pseudonym_map and name_pseudonym_map[pseudonym] != name:
                            issues.append(Issue(
                                issue_type=IssueType.NAME_LEAK,
                                description=f"化名「{pseudonym}」被多人使用：「{name}」和「{name_pseudonym_map[pseudonym]}」",
                                severity="high",
                                location={"file": str(file_path), "name": name}
                            ))
                        else:
                            name_pseudonym_map[pseudonym] = name
                    
                    segments = []
                    segments_str = row.get('授权片段', '').strip()
                    if segments_str:
                        for seg in segments_str.split(';'):
                            seg = seg.strip()
                            if seg and '-' in seg:
                                try:
                                    start_str, end_str = seg.split('-', 1)
                                    start = AuthorizationParser._parse_time(start_str.strip())
                                    end = AuthorizationParser._parse_time(end_str.strip())
                                    segments.append((start, end))
                                except ValueError as e:
                                    issues.append(Issue(
                                        issue_type=IssueType.AUTHORIZATION_GAP,
                                        description=f"解析授权片段失败：{seg} - {e}",
                                        severity="medium",
                                        location={"file": str(file_path), "name": name}
                                    ))
                    
                    record = AuthorizationRecord(
                        name=name,
                        pseudonym=pseudonym,
                        is_authorized=authorized,
                        segments=segments
                    )
                    data.records[name] = record
                
                data.issues = issues
                return data
                
        except Exception as e:
            raise ValueError(f"解析授权表失败: {file_path} - {e}")
    
    @staticmethod
    def _parse_time(time_str: str) -> timedelta:
        """解析时间字符串（支持 HH:MM:SS 或 MM:SS 或 HH:MM:SS,mmm）"""
        time_str = time_str.replace(',', '.').strip()
        parts = time_str.split(':')
        
        if len(parts) == 3:
            hours = int(parts[0])
            minutes = int(parts[1])
            seconds = float(parts[2])
            return timedelta(hours=hours, minutes=minutes, seconds=seconds)
        elif len(parts) == 2:
            minutes = int(parts[0])
            seconds = float(parts[1])
            return timedelta(minutes=minutes, seconds=seconds)
        else:
            raise ValueError(f"不支持的时间格式: {time_str}")


class SensitiveNamesParser:
    """敏感词词典解析器"""
    
    @staticmethod
    def parse(file_path: Path) -> SensitiveNames:
        """解析敏感词词典"""
        import csv
        
        sensitive_names = SensitiveNames(file_path=file_path)
        
        try:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    original = row.get('姓名', '').strip()
                    if not original:
                        continue
                    
                    categories = []
                    if '分类' in row:
                        categories = [c.strip() for c in row['分类'].split(',') if c.strip()]
                    
                    suggested_pseudonym = row.get('建议化名', '').strip() or None
                    
                    sensitive_names.names[original] = SensitiveName(
                        original=original,
                        categories=categories,
                        suggested_pseudonym=suggested_pseudonym
                    )
            
            return sensitive_names
        except Exception as e:
            raise ValueError(f"解析敏感词词典失败: {file_path} - {e}")


class AudioManifestParser:
    """音频清单解析器"""
    
    @staticmethod
    def parse(file_path: Path) -> AudioManifest:
        """解析音频清单"""
        import csv
        
        manifest = AudioManifest(file_path=file_path)
        issues = []
        
        try:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    file = row.get('文件路径', '').strip()
                    if not file:
                        continue
                    
                    segment_index = int(row.get('片段索引', '0'))
                    
                    start_str = row.get('开始时间', '').strip()
                    end_str = row.get('结束时间', '').strip()
                    
                    try:
                        start = AuthorizationParser._parse_time(start_str)
                        end = AuthorizationParser._parse_time(end_str)
                    except ValueError as e:
                        issues.append(Issue(
                            issue_type=IssueType.MISSING_AUDIO,
                            description=f"解析音频时间失败：{start_str} - {end_str} - {e}",
                            severity="medium",
                            location={"file": file, "segment_index": segment_index}
                        ))
                        start = timedelta()
                        end = timedelta()
                    
                    exists = os.path.exists(file)
                    
                    manifest.slices.append(AudioSlice(
                        file_path=Path(file),
                        segment_index=segment_index,
                        start_time=start,
                        end_time=end,
                        exists=exists
                    ))
                    
                    if not exists:
                        issues.append(Issue(
                            issue_type=IssueType.MISSING_AUDIO,
                            description=f"音频文件不存在：{file}",
                            severity="high",
                            location={"file": file, "segment_index": segment_index}
                        ))
            
            manifest.issues = issues
            return manifest
        except Exception as e:
            raise ValueError(f"解析音频清单失败: {file_path} - {e}")


class ProjectScanner:
    """项目扫描器"""
    
    def __init__(self, project_dir: Path):
        self.project_dir = project_dir
        self.srt_content: Optional[SRTContent] = None
        self.authorization_data: Optional[AuthorizationData] = None
        self.sensitive_names: Optional[SensitiveNames] = None
        self.audio_manifest: Optional[AudioManifest] = None
        self.all_issues: List[Issue] = []
    
    def scan(self) -> Dict[str, Any]:
        """扫描整个项目"""
        self._scan_srt()
        self._scan_authorization()
        self._scan_sensitive_names()
        self._scan_audio_manifest()
        self._perform_cross_checks()
        
        return self._generate_report()
    
    def _scan_srt(self):
        """扫描 SRT 文件"""
        srt_files = list(self.project_dir.glob("**/*.srt"))
        if srt_files:
            self.srt_content = SRTParser.parse(srt_files[0])
            self.all_issues.extend(self.srt_content.issues)
    
    def _scan_authorization(self):
        """扫描授权表"""
        auth_files = list(self.project_dir.glob("**/*授权*.csv")) + list(self.project_dir.glob("**/*authorization*.csv"))
        if auth_files:
            self.authorization_data = AuthorizationParser.parse(auth_files[0])
            self.all_issues.extend(self.authorization_data.issues)
    
    def _scan_sensitive_names(self):
        """扫描敏感词词典"""
        sensitive_files = list(self.project_dir.glob("**/*敏感*.csv")) + list(self.project_dir.glob("**/*sensitive*.csv"))
        if sensitive_files:
            self.sensitive_names = SensitiveNamesParser.parse(sensitive_files[0])
    
    def _scan_audio_manifest(self):
        """扫描音频清单"""
        manifest_files = list(self.project_dir.glob("**/*音频*.csv")) + list(self.project_dir.glob("**/*audio*.csv"))
        if manifest_files:
            self.audio_manifest = AudioManifestParser.parse(manifest_files[0])
            self.all_issues.extend(self.audio_manifest.issues)
    
    def _perform_cross_checks(self):
        """执行交叉检查"""
        if self.srt_content and self.sensitive_names and self.authorization_data:
            name_issues = SRTParser.check_name_leaks(
                self.srt_content, 
                self.sensitive_names, 
                self.authorization_data
            )
            self.all_issues.extend(name_issues)
    
    def _generate_report(self) -> Dict[str, Any]:
        """生成扫描报告"""
        report = {
            "project_dir": str(self.project_dir),
            "scan_time": os.path.getctime(str(self.project_dir)) if self.project_dir.exists() else None,
            "files_found": {
                "srt": bool(self.srt_content),
                "authorization": bool(self.authorization_data),
                "sensitive_names": bool(self.sensitive_names),
                "audio_manifest": bool(self.audio_manifest)
            },
            "issues_summary": {
                issue_type.value: len([i for i in self.all_issues if i.issue_type == issue_type])
                for issue_type in IssueType
            },
            "issues": [
                {
                    "type": issue.issue_type.value,
                    "description": issue.description,
                    "severity": issue.severity,
                    "location": issue.location,
                    "context": issue.context
                }
                for issue in self.all_issues
            ]
        }
        return report
