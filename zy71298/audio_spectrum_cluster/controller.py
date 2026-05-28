"""主控制器模块
整合特征提取、谱聚类、可视化、导出和历史管理功能，
支持正常、补录、撤回、重复提交四种操作模式。
"""

import os
import uuid
import hashlib
from typing import List, Dict, Optional, Any, Tuple
from pathlib import Path

from .models import (
    AudioSegment,
    SpectralFeatures,
    ClusteringReport,
    AnomalyReport,
    AnomalyType,
    OperationType,
    HistoryManager
)
from .feature_extractor import FeatureExtractor
from .spectral_clustering import AudioSpectralClustering
from .visualizer import ClusterVisualizer
from .exporter import DataExporter


class AudioClusteringController:
    """音频谱聚类主控制器"""

    def __init__(
        self,
        data_dir: str = "./data",
        output_dir: str = "./output",
        target_sample_rate: int = 44100
    ):
        self.data_dir = data_dir
        self.output_dir = output_dir

        self.feature_extractor = FeatureExtractor(
            target_sample_rate=target_sample_rate)
        self.clusterer = AudioSpectralClustering()
        self.visualizer = ClusterVisualizer(output_dir=output_dir)
        self.exporter = DataExporter(output_dir=output_dir)
        self.history_manager = HistoryManager(data_dir=data_dir)

        self.segments: Dict[str, AudioSegment] = {}
        self.features: Dict[str, SpectralFeatures] = {}
        self.report: Optional[ClusteringReport] = None
        self.charts: Dict[str, str] = {}
        self.duplicate_detector: Dict[str, str] = {}

        self._load_latest_state()

    def _load_latest_state(self) -> None:
        """加载最新状态"""
        latest_snapshot = self.history_manager.get_latest_snapshot_id()
        if latest_snapshot:
            try:
                snapshot = self.history_manager.load_snapshot(latest_snapshot)
                self.segments = snapshot["segments"]
                self.features = snapshot["features"]
                self.report = snapshot["report"]
                self._rebuild_duplicate_detector()
            except Exception as e:
                print(f"加载最新状态失败: {e}")

    def _rebuild_duplicate_detector(self) -> None:
        """重建重复文件检测器"""
        for seg in self.segments.values():
            file_hash = self._compute_file_hash(seg.file_path)
            if file_hash:
                self.duplicate_detector[file_hash] = seg.segment_id

    def _compute_file_hash(self, file_path: str) -> Optional[str]:
        """计算文件哈希用于重复检测"""
        try:
            if not os.path.exists(file_path):
                return None
            hasher = hashlib.md5()
            with open(file_path, 'rb') as f:
                for chunk in iter(lambda: f.read(8192), b''):
                    hasher.update(chunk)
            return hasher.hexdigest()
        except Exception:
            return None

    def _check_duplicate(self, file_path: str) -> Optional[str]:
        """检查文件是否已存在"""
        file_hash = self._compute_file_hash(file_path)
        if file_hash and file_hash in self.duplicate_detector:
            return self.duplicate_detector[file_hash]
        return None

    def _perform_clustering(self) -> ClusteringReport:
        """执行聚类并生成报告"""
        segments_list = list(self.segments.values())
        features_list = list(self.features.values())

        all_anomalies: List[AnomalyReport] = []
        for seg in segments_list:
            for feat in features_list:
                if feat.segment_id == seg.segment_id:
                    break

        label_anomalies = self.feature_extractor.check_label_conflicts(
            segments_list, features_list)
        all_anomalies.extend(label_anomalies)

        report = self.clusterer.fit_predict(
            segments_list, features_list, all_anomalies)

        return report

    def _generate_charts(self) -> Dict[str, str]:
        """生成所有可视化图表"""
        segments_list = list(self.segments.values())
        features_list = list(self.features.values())

        if not self.report:
            return {}

        return self.visualizer.generate_all_charts(
            segments_list, features_list, self.report)

    def process_files(
        self,
        file_paths: List[str],
        operation_type: OperationType = OperationType.NORMAL,
        instrument_tags: Optional[Dict[str, List[str]]] = None,
        operator: Optional[str] = None,
        description: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        处理一批音频文件

        Args:
            file_paths: 音频文件路径列表
            operation_type: 操作类型（正常、补录、撤回、重复提交）
            instrument_tags: 可选，为指定文件指定乐器标签 {file_path: [tags]}
            operator: 操作人
            description: 操作描述

        Returns:
            处理结果摘要
        """
        instrument_tags = instrument_tags or {}
        new_segments: List[AudioSegment] = []
        new_features: List[SpectralFeatures] = []
        all_anomalies: List[AnomalyReport] = []
        skipped_files: List[Dict[str, Any]] = []

        for file_path in file_paths:
            if not os.path.exists(file_path):
                skipped_files.append({
                    "file": file_path,
                    "reason": "文件不存在"
                })
                continue

            existing_id = self._check_duplicate(file_path)

            if operation_type == OperationType.DUPLICATE:
                if existing_id:
                    original_seg = self.segments[existing_id]
                    seg, feat, anomalies = self.feature_extractor.extract_from_file(
                        file_path,
                        instrument_tags=instrument_tags.get(file_path, original_seg.instrument_tags),
                        performance_version=original_seg.performance_version,
                        composer=original_seg.composer,
                        title=original_seg.title,
                        original_segment_id=existing_id,
                        notes=original_seg.notes
                    )
                    anomalies.append(AnomalyReport(
                        segment_id=seg.segment_id,
                        anomaly_type=AnomalyType.SAMPLE_RATE_MISMATCH,
                        severity="info",
                        description=f"重复提交，原始片段ID: {existing_id}",
                        affected_values={
                            "original_id": existing_id,
                            "original_file": original_seg.file_name,
                            "duplicate_file": seg.file_name,
                            "note_type": "duplicate"
                        }
                    ))
                else:
                    seg, feat, anomalies = self.feature_extractor.extract_from_file(
                        file_path,
                        instrument_tags=instrument_tags.get(file_path, []),
                        original_segment_id=None
                    )

            elif operation_type == OperationType.SUPPLEMENT:
                original_id = existing_id
                seg, feat, anomalies = self.feature_extractor.extract_from_file(
                    file_path,
                    instrument_tags=instrument_tags.get(file_path, []),
                    original_segment_id=original_id
                )
                if original_id:
                    anomalies.append(AnomalyReport(
                        segment_id=seg.segment_id,
                        anomaly_type=AnomalyType.SAMPLE_RATE_MISMATCH,
                        severity="info",
                        description=f"补录片段，对应原始片段: {original_id}",
                        affected_values={
                            "original_id": original_id,
                            "note_type": "supplement"
                        }
                    ))

            else:
                if existing_id:
                    skipped_files.append({
                        "file": file_path,
                        "reason": f"文件已存在，片段ID: {existing_id}",
                        "segment_id": existing_id
                    })
                    continue

                seg, feat, anomalies = self.feature_extractor.extract_from_file(
                    file_path,
                    instrument_tags=instrument_tags.get(file_path, [])
                )

            new_segments.append(seg)
            new_features.append(feat)
            all_anomalies.extend(anomalies)

            file_hash = self._compute_file_hash(file_path)
            if file_hash:
                self.duplicate_detector[file_hash] = seg.segment_id

        for seg, feat in zip(new_segments, new_features):
            self.segments[seg.segment_id] = seg
            self.features[seg.segment_id] = feat

        if len(self.segments) >= 2:
            self.report = self._perform_clustering()
            self.report.anomalies.extend(all_anomalies)
            self.charts = self._generate_charts()

        new_segment_ids = [seg.segment_id for seg in new_segments]

        if operation_type == OperationType.WITHDRAW:
            return self.withdraw_segments(
                new_segment_ids, operator=operator, description=description)

        metadata = {
            "anomalies": [a.to_dict() for a in all_anomalies],
            "skipped_files": skipped_files,
            "n_new_segments": len(new_segments),
            "report_id": self.report.report_id if self.report else None
        }

        self.history_manager.record_operation(
            operation_type=operation_type,
            segment_ids=new_segment_ids,
            segments=self.segments,
            features=self.features,
            report=self.report,
            operator=operator,
            description=description,
            metadata=metadata
        )

        return {
            "success": True,
            "operation_type": operation_type.value,
            "new_segments": new_segment_ids,
            "n_new_segments": len(new_segments),
            "skipped_files": skipped_files,
            "anomalies": [a.to_dict() for a in all_anomalies],
            "total_segments": len(self.segments),
            "n_clusters": self.report.n_clusters if self.report else 0,
            "report_id": self.report.report_id if self.report else None,
            "charts": self.charts
        }

    def withdraw_segments(
        self,
        segment_ids: List[str],
        operator: Optional[str] = None,
        description: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        撤回指定片段（不删除历史记录，只从当前状态移除）

        Args:
            segment_ids: 要撤回的片段ID列表
            operator: 操作人
            description: 撤回原因

        Returns:
            撤回结果摘要
        """
        removed_ids = []
        not_found_ids = []

        for seg_id in segment_ids:
            if seg_id in self.segments:
                seg = self.segments[seg_id]
                del self.segments[seg_id]
                del self.features[seg_id]

                file_hash = self._compute_file_hash(seg.file_path)
                if file_hash and file_hash in self.duplicate_detector:
                    del self.duplicate_detector[file_hash]

                removed_ids.append(seg_id)
            else:
                not_found_ids.append(seg_id)

        if len(self.segments) >= 2:
            self.report = self._perform_clustering()
            self.charts = self._generate_charts()
        else:
            self.report = None
            self.charts = {}

        metadata = {
            "removed_ids": removed_ids,
            "not_found_ids": not_found_ids,
            "total_segments": len(self.segments)
        }

        self.history_manager.record_operation(
            operation_type=OperationType.WITHDRAW,
            segment_ids=segment_ids,
            segments=self.segments,
            features=self.features,
            report=self.report,
            operator=operator,
            description=description or f"撤回 {len(removed_ids)} 个片段",
            metadata=metadata
        )

        return {
            "success": True,
            "operation_type": "withdraw",
            "removed_ids": removed_ids,
            "not_found_ids": not_found_ids,
            "total_segments": len(self.segments),
            "n_clusters": self.report.n_clusters if self.report else 0,
            "report_id": self.report.report_id if self.report else None
        }

    def process_directory(
        self,
        directory: str,
        file_pattern: str = "*.wav,*.mp3,*.flac,*.ogg",
        operation_type: OperationType = OperationType.NORMAL,
        instrument_tags: Optional[Dict[str, List[str]]] = None,
        operator: Optional[str] = None,
        description: Optional[str] = None
    ) -> Dict[str, Any]:
        """批量处理目录下的音频文件"""
        patterns = file_pattern.split(",")
        audio_files = []
        for pattern in patterns:
            audio_files.extend(Path(directory).glob(pattern.strip()))

        file_paths = [str(f) for f in audio_files]

        return self.process_files(
            file_paths=file_paths,
            operation_type=operation_type,
            instrument_tags=instrument_tags,
            operator=operator,
            description=description
        )

    def refresh_all(self) -> Dict[str, Any]:
        """基于当前数据重新计算所有结果（聚类、图表）"""
        if len(self.segments) < 2:
            return {
                "success": False,
                "reason": "至少需要2个音频片段才能进行聚类"
            }

        self.report = self._perform_clustering()
        self.charts = self._generate_charts()

        return {
            "success": True,
            "total_segments": len(self.segments),
            "n_clusters": self.report.n_clusters,
            "silhouette_score": self.report.silhouette_score,
            "report_id": self.report.report_id,
            "charts": self.charts
        }

    def explain_segment(self, segment_id: str) -> Dict[str, Any]:
        """获取指定片段的详细解释"""
        if segment_id not in self.segments or segment_id not in self.features:
            raise ValueError(f"片段 {segment_id} 不存在")

        seg = self.segments[segment_id]
        feat = self.features[segment_id]

        feature_explanation = self.feature_extractor.explain_features(feat)

        cluster_result = None
        cluster_explanation = None
        if self.report and segment_id in self.report.clustering_results:
            cluster_result = self.report.clustering_results[segment_id]
            cluster_explanation = self.clusterer.explain_cluster(
                cluster_result.cluster_label,
                self.report,
                list(self.segments.values()),
                list(self.features.values())
            )

        anomalies = []
        if self.report:
            anomalies = [
                a.to_dict() for a in self.report.anomalies
                if a.segment_id == segment_id
            ]

        nearest_neighbors = []
        if cluster_result and cluster_result.nearest_neighbors:
            for neighbor_id, distance in cluster_result.nearest_neighbors:
                if neighbor_id in self.segments:
                    nearest_neighbors.append({
                        "segment_id": neighbor_id,
                        "file_name": self.segments[neighbor_id].file_name,
                        "distance": distance
                    })

        return {
            "segment": seg.to_dict(),
            "features": feature_explanation,
            "cluster": cluster_result.to_dict() if cluster_result else None,
            "cluster_explanation": cluster_explanation,
            "anomalies": anomalies,
            "nearest_neighbors": nearest_neighbors
        }

    def compare_segments(
        self,
        segment_id_1: str,
        segment_id_2: str
    ) -> Dict[str, Any]:
        """比较两个片段"""
        if not self.report:
            raise ValueError("请先进行聚类")

        return self.clusterer.compare_segments(
            segment_id_1,
            segment_id_2,
            list(self.features.values()),
            self.report
        )

    def export_data(self) -> Dict[str, str]:
        """导出所有数据"""
        if not self.report:
            raise ValueError("请先进行聚类")

        history = self.history_manager.get_history()

        return self.exporter.export_all(
            segments=list(self.segments.values()),
            features_list=list(self.features.values()),
            report=self.report,
            history=history
        )

    def get_history(self) -> List[Dict[str, Any]]:
        """获取历史记录"""
        return [h.to_dict() for h in self.history_manager.get_history()]

    def get_segment_history(self, segment_id: str) -> List[Dict[str, Any]]:
        """获取指定片段的历史记录"""
        return [
            h.to_dict()
            for h in self.history_manager.get_segment_history(segment_id)
        ]

    def get_summary(self) -> Dict[str, Any]:
        """获取当前状态摘要"""
        segments_list = list(self.segments.values())
        features_list = list(self.features.values())

        clusters_summary = []
        if self.report:
            clusters_summary = self.report.clusters_summary

        return {
            "total_segments": len(self.segments),
            "total_features": len(self.features),
            "n_clusters": self.report.n_clusters if self.report else 0,
            "has_report": self.report is not None,
            "report_id": self.report.report_id if self.report else None,
            "silhouette_score": self.report.silhouette_score if self.report else None,
            "total_anomalies": len(self.report.anomalies) if self.report else 0,
            "clusters": clusters_summary,
            "charts": self.charts,
            "sample_rates": list(set(s.sample_rate for s in segments_list)),
            "duration_range": {
                "min": min(s.duration for s in segments_list) if segments_list else 0,
                "max": max(s.duration for s in segments_list) if segments_list else 0
            },
            "tempo_range": {
                "min": min(f.tempo for f in features_list) if features_list else 0,
                "max": max(f.tempo for f in features_list) if features_list else 0
            }
        }

    def list_segments(self) -> List[Dict[str, Any]]:
        """列出所有片段的简要信息"""
        result = []
        for seg in self.segments.values():
            item = {
                "segment_id": seg.segment_id,
                "file_name": seg.file_name,
                "duration": seg.duration,
                "sample_rate": seg.sample_rate,
                "instrument_tags": seg.instrument_tags,
                "created_at": seg.created_at.isoformat()
            }

            if self.report and seg.segment_id in self.report.clustering_results:
                result_data = self.report.clustering_results[seg.segment_id]
                item["cluster_label"] = result_data.cluster_label
                item["cluster_name"] = result_data.cluster_name
                item["confidence"] = result_data.confidence

            result.append(item)

        return sorted(result, key=lambda x: x.get("cluster_label", 999))

