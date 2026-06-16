from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum

class TrackStatus(Enum):
    PENDING = "待处理"
    MATCHED = "已匹配"
    UNMATCHED = "未匹配"
    ERROR = "处理失败"
    CONFLICT = "数据冲突"
    NEEDS_REVIEW = "待审核"

class AnomalyType(Enum):
    DUPLICATE_TRACK = "重复曲目"
    OLD_MASTER = "旧版母带"
    UNAUTHORIZED = "未授权"
    MANUAL_RENAME = "人工改名"
    CORRUPTED_FILE = "文件损坏"
    DURATION_MISMATCH = "时长不符"
    MISSING_AUDIO = "缺失音频"
    NAME_MISMATCH = "名称不匹配"

@dataclass
class TrackRecord:
    track_id: str
    track_name: str
    student_name: str
    class_date: str
    duration: int
    authorized: bool
    version: str
    notes: str
    status: TrackStatus = TrackStatus.PENDING
    audio_file: Optional[str] = None
    anomalies: List[AnomalyType] = field(default_factory=list)
    anomaly_details: List[str] = field(default_factory=list)
    supplementary_notes: str = ""
    process_log: List[str] = field(default_factory=list)
    extra: Dict[str, Any] = field(default_factory=dict)

    def add_anomaly(self, anomaly_type: AnomalyType, detail: str):
        self.anomalies.append(anomaly_type)
        self.anomaly_details.append(detail)
        self.log(f"检测异常 [{anomaly_type.value}]: {detail}")

    def log(self, message: str):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.process_log.append(f"[{timestamp}] {message}")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "曲目编号": self.track_id,
            "曲目名称": self.track_name,
            "学生姓名": self.student_name,
            "上课日期": self.class_date,
            "时长(秒)": self.duration,
            "已授权": "是" if self.authorized else "否",
            "版本": self.version,
            "备注": self.notes,
            "补录备注": self.supplementary_notes,
            "状态": self.status.value,
            "音频文件": self.audio_file or "",
            "异常类型": "|".join([a.value for a in self.anomalies]) if self.anomalies else "",
            "异常详情": "|".join(self.anomaly_details) if self.anomaly_details else "",
            "处理日志": "\n".join(self.process_log)
        }

@dataclass
class AudioFile:
    file_path: str
    file_name: str
    file_size: int
    extension: str
    parsed_track_id: Optional[str] = None
    parsed_track_name: Optional[str] = None
    parsed_student_name: Optional[str] = None
    is_valid: bool = True
    error_message: Optional[str] = None

@dataclass
class ProcessResult:
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None

@dataclass
class BatchSummary:
    total_tracks: int = 0
    matched_tracks: int = 0
    matched_with_valid_audio: int = 0
    matched_with_corrupted_audio: int = 0
    unmatched_tracks: int = 0
    error_tracks: int = 0
    conflict_tracks: int = 0
    total_audio_files: int = 0
    valid_audio_count: int = 0
    corrupted_audio_count: int = 0
    total_anomalies: int = 0
    anomaly_counts: Dict[AnomalyType, int] = field(default_factory=dict)
    process_time: float = 0.0
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
