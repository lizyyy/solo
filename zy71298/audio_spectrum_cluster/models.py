"""数据模型定义
包含音频片段、频谱特征、聚类结果、异常报告和历史记录的完整数据结构。
"""

from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import List, Dict, Optional, Any, Tuple
from datetime import datetime
import uuid
import json
import os
import copy


class OperationType(Enum):
    """操作类型枚举"""
    NORMAL = "normal"           # 正常提交
    SUPPLEMENT = "supplement"   # 补录
    WITHDRAW = "withdraw"       # 撤回
    DUPLICATE = "duplicate"     # 重复提交


class AnomalyType(Enum):
    """异常类型枚举"""
    SAMPLE_RATE_MISMATCH = "sample_rate_mismatch"
    SILENCE_SEGMENT = "silence_segment"
    LABEL_CONFLICT = "label_conflict"


@dataclass
class AudioSegment:
    """音频片段元数据"""
    segment_id: str
    file_path: str
    file_name: str
    sample_rate: int
    duration: float
    channels: int
    instrument_tags: List[str] = field(default_factory=list)
    performance_version: Optional[str] = None
    composer: Optional[str] = None
    title: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    original_segment_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["created_at"] = self.created_at.isoformat()
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AudioSegment":
        data["created_at"] = datetime.fromisoformat(data["created_at"])
        return cls(**data)


@dataclass
class SpectralFeatures:
    """频谱特征数据"""
    segment_id: str
    mfcc: List[float]           # MFCC系数均值
    mfcc_std: List[float]       # MFCC系数标准差
    spectral_centroid: float    # 频谱质心
    spectral_bandwidth: float   # 频谱带宽
    spectral_rolloff: float     # 频谱滚降点
    spectral_contrast: List[float]  # 频谱对比度
    zero_crossing_rate: float   # 过零率
    tempo: float                # 节拍BPM
    beat_frames: List[int]      # 节拍帧位置
    chroma_stft: List[float]    # 色度特征
    rms_energy: float           # RMS能量
    rms_energy_std: float       # RMS能量标准差
    feature_vector: List[float] # 归一化特征向量（用于聚类）
    extracted_at: datetime = field(default_factory=datetime.now)
    extractor_version: str = "1.0.0"

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["extracted_at"] = self.extracted_at.isoformat()
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SpectralFeatures":
        data["extracted_at"] = datetime.fromisoformat(data["extracted_at"])
        return cls(**data)


@dataclass
class AnomalyReport:
    """异常检测报告"""
    segment_id: str
    anomaly_type: AnomalyType
    severity: str  # "low", "medium", "high"
    description: str
    affected_values: Dict[str, Any] = field(default_factory=dict)
    detected_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["anomaly_type"] = self.anomaly_type.value
        data["detected_at"] = self.detected_at.isoformat()
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AnomalyReport":
        data["anomaly_type"] = AnomalyType(data["anomaly_type"])
        data["detected_at"] = datetime.fromisoformat(data["detected_at"])
        return cls(**data)


@dataclass
class ClusteringResult:
    """聚类结果"""
    segment_id: str
    cluster_label: int
    cluster_name: str
    confidence: float
    distance_to_centroid: float
    nearest_neighbors: List[Tuple[str, float]] = field(default_factory=list)
    umap_2d: Tuple[float, float] = field(default_factory=lambda: (0.0, 0.0))

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["nearest_neighbors"] = [
            (nid, float(dist)) for nid, dist in self.nearest_neighbors
        ]
        data["umap_2d"] = [float(x) for x in self.umap_2d]
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ClusteringResult":
        data["nearest_neighbors"] = [
            (nid, float(dist)) for nid, dist in data["nearest_neighbors"]
        ]
        data["umap_2d"] = tuple(data["umap_2d"])
        return cls(**data)


@dataclass
class ClusteringReport:
    """聚类总报告"""
    report_id: str
    n_clusters: int
    total_segments: int
    clusters_summary: List[Dict[str, Any]]
    cluster_names: Dict[int, str]
    silhouette_score: float
    calinski_harabasz_score: float
    anomalies: List[AnomalyReport]
    clustering_results: Dict[str, ClusteringResult]
    feature_importance: Dict[str, float]
    created_at: datetime = field(default_factory=datetime.now)
    notes: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["anomalies"] = [a.to_dict() for a in self.anomalies]
        data["clustering_results"] = {
            k: v.to_dict() for k, v in self.clustering_results.items()
        }
        data["created_at"] = self.created_at.isoformat()
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ClusteringReport":
        data["anomalies"] = [
            AnomalyReport.from_dict(a) for a in data["anomalies"]
        ]
        data["clustering_results"] = {
            k: ClusteringResult.from_dict(v)
            for k, v in data["clustering_results"].items()
        }
        data["created_at"] = datetime.fromisoformat(data["created_at"])
        return cls(**data)


@dataclass
class HistoryRecord:
    """历史记录条目"""
    record_id: str
    operation_type: OperationType
    segment_ids: List[str]
    timestamp: datetime
    operator: Optional[str] = None
    description: Optional[str] = None
    previous_state_ref: Optional[str] = None
    new_state_ref: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["operation_type"] = self.operation_type.value
        data["timestamp"] = self.timestamp.isoformat()
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "HistoryRecord":
        data["operation_type"] = OperationType(data["operation_type"])
        data["timestamp"] = datetime.fromisoformat(data["timestamp"])
        return cls(**data)


class HistoryManager:
    """历史记录管理器
    支持正常、补录、撤回、重复提交四种操作模式，
    永不覆盖原始线索，保留完整审计轨迹。
    """

    def __init__(self, data_dir: str = "./data"):
        self.data_dir = data_dir
        self.history_file = os.path.join(data_dir, "history.json")
        self.versions_dir = os.path.join(data_dir, "versions")
        os.makedirs(data_dir, exist_ok=True)
        os.makedirs(self.versions_dir, exist_ok=True)
        self._history: List[HistoryRecord] = self._load_history()

    def _load_history(self) -> List[HistoryRecord]:
        if os.path.exists(self.history_file):
            with open(self.history_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                return [HistoryRecord.from_dict(r) for r in data]
        return []

    def _save_history(self) -> None:
        with open(self.history_file, "w", encoding="utf-8") as f:
            json.dump(
                [r.to_dict() for r in self._history],
                f,
                ensure_ascii=False,
                indent=2
            )

    def _save_snapshot(
        self,
        segments: Dict[str, AudioSegment],
        features: Dict[str, SpectralFeatures],
        report: Optional[ClusteringReport]
    ) -> str:
        """保存状态快照，返回快照ID"""
        snapshot_id = f"snapshot_{uuid.uuid4().hex[:8]}"
        snapshot_path = os.path.join(self.versions_dir, f"{snapshot_id}.json")

        snapshot = {
            "snapshot_id": snapshot_id,
            "created_at": datetime.now().isoformat(),
            "segments": {k: v.to_dict() for k, v in segments.items()},
            "features": {k: v.to_dict() for k, v in features.items()},
            "report": report.to_dict() if report else None
        }

        with open(snapshot_path, "w", encoding="utf-8") as f:
            json.dump(snapshot, f, ensure_ascii=False, indent=2)

        return snapshot_id

    def load_snapshot(self, snapshot_id: str) -> Dict[str, Any]:
        """加载指定快照"""
        snapshot_path = os.path.join(self.versions_dir, f"{snapshot_id}.json")
        if not os.path.exists(snapshot_path):
            raise FileNotFoundError(f"Snapshot {snapshot_id} not found")

        with open(snapshot_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        data["segments"] = {
            k: AudioSegment.from_dict(v) for k, v in data["segments"].items()
        }
        data["features"] = {
            k: SpectralFeatures.from_dict(v) for k, v in data["features"].items()
        }
        if data["report"]:
            data["report"] = ClusteringReport.from_dict(data["report"])

        return data

    def record_operation(
        self,
        operation_type: OperationType,
        segment_ids: List[str],
        segments: Dict[str, AudioSegment],
        features: Dict[str, SpectralFeatures],
        report: Optional[ClusteringReport],
        operator: Optional[str] = None,
        description: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> HistoryRecord:
        """记录一次操作并保存状态快照"""
        # 获取上一个状态引用
        previous_ref = self._history[-1].new_state_ref if self._history else None

        # 保存新状态快照
        new_ref = self._save_snapshot(segments, features, report)

        # 创建历史记录
        record = HistoryRecord(
            record_id=f"rec_{uuid.uuid4().hex[:8]}",
            operation_type=operation_type,
            segment_ids=segment_ids,
            timestamp=datetime.now(),
            operator=operator,
            description=description,
            previous_state_ref=previous_ref,
            new_state_ref=new_ref,
            metadata=metadata or {}
        )

        self._history.append(record)
        self._save_history()

        return record

    def get_history(self) -> List[HistoryRecord]:
        """获取完整历史记录"""
        return copy.deepcopy(self._history)

    def get_segment_history(self, segment_id: str) -> List[HistoryRecord]:
        """获取指定片段的操作历史"""
        return [
            r for r in self._history
            if segment_id in r.segment_ids
        ]

    def rollback(self, record_id: str) -> Dict[str, Any]:
        """回滚到指定记录之前的状态（创建新的撤回记录）"""
        # 找到要回滚的记录
        target_idx = None
        for i, r in enumerate(self._history):
            if r.record_id == record_id:
                target_idx = i
                break

        if target_idx is None:
            raise ValueError(f"Record {record_id} not found")

        # 获取回滚目标状态
        target_record = self._history[target_idx]
        if target_record.previous_state_ref:
            snapshot = self.load_snapshot(target_record.previous_state_ref)
        else:
            snapshot = {
                "segments": {},
                "features": {},
                "report": None
            }

        return snapshot

    def get_latest_snapshot_id(self) -> Optional[str]:
        """获取最新的快照ID"""
        if self._history:
            return self._history[-1].new_state_ref
        return None
