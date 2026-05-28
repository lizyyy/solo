"""谱聚类算法模块
使用谱聚类算法对音频片段进行自动分组，
包含聚类、最近邻查找、和聚类结果解释。
"""

import uuid
import numpy as np
from typing import List, Dict, Tuple, Optional, Any
from collections import defaultdict

from sklearn.cluster import SpectralClustering
from sklearn.metrics import (
    silhouette_score,
    calinski_harabasz_score,
    pairwise_distances
)
from sklearn.preprocessing import StandardScaler
from sklearn.neighbors import NearestNeighbors

try:
    import umap
    UMAP_AVAILABLE = True
except ImportError:
    UMAP_AVAILABLE = False

from .models import (
    AudioSegment,
    SpectralFeatures,
    ClusteringResult,
    ClusteringReport,
    AnomalyReport,
    ClusteringReport
)


class AudioSpectralClustering:
    """音频谱聚类器"""

    def __init__(
        self,
        n_clusters: Optional[int] = None,
        affinity: str = "rbf",
        gamma: Optional[float] = None,
        random_state: int = 42
    ):
        """
        Args:
            n_clusters: 聚类数量，None则自动确定
            affinity: 亲和度度量方式
            gamma: RBF核参数
            random_state: 随机种子
        """
        self.n_clusters = n_clusters
        self.affinity = affinity
        self.gamma = gamma
        self.random_state = random_state
        self._scaler = StandardScaler()
        self._feature_matrix: Optional[np.ndarray] = None
        self._labels: Optional[np.ndarray] = None
        self._segment_ids: List[str] = []
        self._cluster_centers: Dict[int, np.ndarray] = {}
        self._umap_embedding: Optional[np.ndarray] = None

    def _build_feature_matrix(
        self,
        features_list: List[SpectralFeatures]
    ) -> np.ndarray:
        """构建特征矩阵"""
        self._segment_ids = [f.segment_id for f in features_list]
        raw_matrix = np.array([f.feature_vector for f in features_list])
        return self._scaler.fit_transform(raw_matrix)

    def _determine_n_clusters(self, X: np.ndarray) -> int:
        """自动确定最佳聚类数（使用轮廓系数）"""
        n_samples = X.shape[0]
        max_clusters = min(10, n_samples - 1)
        if max_clusters <= 2:
            return max_clusters

        best_score = -1
        best_n = 2

        for n in range(2, max_clusters + 1):
            try:
                model = SpectralClustering(
                    n_clusters=n,
                    affinity=self.affinity,
                    gamma=self.gamma,
                    random_state=self.random_state,
                    n_init=10
                )
                labels = model.fit_predict(X)
                score = silhouette_score(X, labels)
                if score > best_score:
                    best_score = score
                    best_n = n
            except Exception:
                continue

        return best_n

    def _compute_umap_embedding(self, X: np.ndarray) -> np.ndarray:
        """计算UMAP二维嵌入用于可视化"""
        if not UMAP_AVAILABLE:
            from sklearn.decomposition import PCA
            pca = PCA(n_components=2, random_state=self.random_state)
            return pca.fit_transform(X)

        reducer = umap.UMAP(
            n_components=2,
            random_state=self.random_state,
            n_neighbors=min(15, X.shape[0] - 1)
        )
        return reducer.fit_transform(X)

    def _name_clusters(
        self,
        X: np.ndarray,
        labels: np.ndarray,
        segments: List[AudioSegment],
        features_list: List[SpectralFeatures]
    ) -> Dict[int, str]:
        """根据聚类特征自动命名聚类"""
        cluster_names = {}

        for cluster_id in np.unique(labels):
            mask = labels == cluster_id
            cluster_segments = [s for s, l in zip(segments, labels) if l == cluster_id]
            cluster_features = [f for f, l in zip(features_list, labels) if l == cluster_id]

            # 提取主要乐器标签
            tag_counts: Dict[str, int] = defaultdict(int)
            for s in cluster_segments:
                for tag in s.instrument_tags:
                    tag_counts[tag] += 1

            # 平均特征
            avg_tempo = np.mean([f.tempo for f in cluster_features])
            avg_centroid = np.mean([f.spectral_centroid for f in cluster_features])

            # 构建名称
            parts = []

            if tag_counts:
                top_tags = sorted(tag_counts.items(), key=lambda x: -x[1])[:2]
                parts.append("+".join([t for t, _ in top_tags]))

            if avg_tempo < 80:
                parts.append("慢速")
            elif avg_tempo > 120:
                parts.append("快速")
            else:
                parts.append("中速")

            if avg_centroid < 1500:
                parts.append("低沉")
            elif avg_centroid > 3000:
                parts.append("明亮")

            if not parts:
                parts = [f"群组{cluster_id + 1}"]

            cluster_names[cluster_id] = "-".join(parts)

        return cluster_names

    def _compute_centroids(
        self,
        X: np.ndarray,
        labels: np.ndarray
    ) -> Dict[int, np.ndarray]:
        """计算每个聚类的中心"""
        centroids = {}
        for cluster_id in np.unique(labels):
            mask = labels == cluster_id
            centroids[cluster_id] = np.mean(X[mask], axis=0)
        return centroids

    def _find_nearest_neighbors(
        self,
        X: np.ndarray,
        segment_ids: List[str],
        n_neighbors: int = 5
    ) -> Dict[str, List[Tuple[str, float]]]:
        """查找每个样本的最近邻"""
        nbrs = NearestNeighbors(
            n_neighbors=min(n_neighbors + 1, len(segment_ids)),
            metric='euclidean'
        )
        nbrs.fit(X)
        distances, indices = nbrs.kneighbors(X)

        neighbors = {}
        for i, seg_id in enumerate(segment_ids):
            seg_neighbors = []
            for j in range(1, len(indices[i])):
                if j < len(indices[i]):
                    neighbor_id = segment_ids[indices[i][j]]
                    distance = float(distances[i][j])
                    seg_neighbors.append((neighbor_id, distance))
            neighbors[seg_id] = seg_neighbors

        return neighbors

    def _compute_feature_importance(
        self,
        X: np.ndarray,
        labels: np.ndarray
    ) -> Dict[str, float]:
        """计算特征重要性（基于聚类间方差比）"""
        feature_names = [
            "mfcc_1", "mfcc_2", "mfcc_3", "mfcc_4", "mfcc_5",
            "mfcc_6", "mfcc_7", "mfcc_8", "mfcc_9", "mfcc_10",
            "mfcc_11", "mfcc_12", "mfcc_13", "mfcc_14", "mfcc_15",
            "mfcc_16", "mfcc_17", "mfcc_18", "mfcc_19", "mfcc_20",
            "mfcc_std_1", "mfcc_std_2", "mfcc_std_3", "mfcc_std_4", "mfcc_std_5",
            "spectral_centroid", "spectral_bandwidth", "spectral_rolloff",
            "spectral_contrast_1", "spectral_contrast_2", "spectral_contrast_3",
            "spectral_contrast_4", "spectral_contrast_5", "spectral_contrast_6", "spectral_contrast_7",
            "zero_crossing_rate", "tempo", "rms_energy"
        ]

        importance = {}
        n_features = X.shape[1]

        unique_labels = np.unique(labels)

        for i in range(n_features):
            feature_name = feature_names[i] if i < len(feature_names) else f"feature_{i}"

            between_var = 0
            within_var = 0
            overall_mean = np.mean(X[:, i])

            for label in unique_labels:
                mask = labels == label
                cluster_mean = np.mean(X[mask, i])
                between_var += len(X[mask]) * (cluster_mean - overall_mean) ** 2
                within_var += np.sum((X[mask, i] - cluster_mean) ** 2)

            if within_var > 0:
                importance[feature_name] = float(between_var / within_var)
            else:
                importance[feature_name] = 0.0

        total = sum(importance.values())
        if total > 0:
            importance = {k: v / total for k, v in importance.items()}

        top_importance = dict(sorted(
            importance.items(), key=lambda x: -x[1])[:15])

        return top_importance

    def fit_predict(
        self,
        segments: List[AudioSegment],
        features_list: List[SpectralFeatures],
        anomalies: Optional[List[AnomalyReport]] = None
    ) -> ClusteringReport:
        """执行谱聚类并生成完整报告"""
        if len(features_list) < 2:
            raise ValueError("至少需要2个音频片段才能进行聚类")

        X = self._build_feature_matrix(features_list)
        self._feature_matrix = X

        n_clusters = self.n_clusters or self._determine_n_clusters(X)

        model_kwargs = {
            "n_clusters": n_clusters,
            "affinity": self.affinity,
            "random_state": self.random_state,
            "n_init": 10
        }
        if self.gamma is not None:
            model_kwargs["gamma"] = self.gamma

        model = SpectralClustering(**model_kwargs)

        labels = model.fit_predict(X)
        self._labels = labels

        cluster_names = self._name_clusters(X, labels, segments, features_list)
        self._cluster_centers = self._compute_centroids(X, labels)

        try:
            self._umap_embedding = self._compute_umap_embedding(X)
        except Exception as e:
            print(f"UMAP嵌入计算失败，使用零向量替代: {e}")
            self._umap_embedding = np.zeros((X.shape[0], 2))

        neighbors = self._find_nearest_neighbors(X, self._segment_ids)

        feature_importance = self._compute_feature_importance(X, labels)

        try:
            silhouette = float(silhouette_score(X, labels))
        except Exception:
            silhouette = 0.0

        try:
            calinski = float(calinski_harabasz_score(X, labels))
        except Exception:
            calinski = 0.0

        clustering_results: Dict[str, ClusteringResult] = {}

        for i, (seg, feat) in enumerate(zip(segments, features_list)):
            cluster_id = int(labels[i])
            centroid = self._cluster_centers[cluster_id]
            distance_to_centroid = float(np.linalg.norm(X[i] - centroid))

            max_distance = max(
                np.linalg.norm(X[j] - centroid) for j in np.where(labels == cluster_id)[0]
            )

            confidence = 1.0 - (distance_to_centroid / max(max_distance, 0.001))

            umap_2d = (
                float(self._umap_embedding[i, 0]),
                float(self._umap_embedding[i, 1])
            )

            clustering_results[seg.segment_id] = ClusteringResult(
                segment_id=seg.segment_id,
                cluster_label=cluster_id,
                cluster_name=cluster_names[cluster_id],
                confidence=confidence,
                distance_to_centroid=distance_to_centroid,
                nearest_neighbors=neighbors.get(seg.segment_id, []),
                umap_2d=umap_2d
            )

        clusters_summary = []
        for cluster_id in np.unique(labels):
            mask = labels == cluster_id
            cluster_segments = [s for s, m in zip(segments, mask) if m]
            cluster_features = [f for f, m in zip(features_list, mask) if m]

            clusters_summary.append({
                "cluster_id": int(cluster_id),
                "cluster_name": cluster_names[cluster_id],
                "size": int(np.sum(mask)),
                "segments": [s.segment_id for s in cluster_segments],
                "avg_tempo": float(np.mean([f.tempo for f in cluster_features])),
                "avg_spectral_centroid": float(np.mean([f.spectral_centroid for f in cluster_features])),
                "avg_rms_energy": float(np.mean([f.rms_energy for f in cluster_features])),
                "instrument_tags": list(set(
                    t for s in cluster_segments for t in s.instrument_tags))
            })

        report = ClusteringReport(
            report_id=f"report_{uuid.uuid4().hex[:8]}",
            n_clusters=n_clusters,
            total_segments=len(segments),
            clusters_summary=clusters_summary,
            cluster_names=cluster_names,
            silhouette_score=silhouette,
            calinski_harabasz_score=calinski,
            anomalies=anomalies or [],
            clustering_results=clustering_results,
            feature_importance=feature_importance
        )

        return report

    def predict_new(
        self,
        new_features: List[SpectralFeatures],
        existing_segments: List[AudioSegment],
        existing_features: List[SpectralFeatures],
        existing_report: ClusteringReport
    ) -> List[ClusteringResult]:
        """对新片段进行聚类预测（增量聚类）"""
        if self._feature_matrix is None:
            raise ValueError("模型尚未训练，请先调用 fit_predict")

        new_X = np.array([f.feature_vector for f in new_features])
        new_X = self._scaler.transform(new_X)

        results = []
        for i, feat in enumerate(new_features):
            distances = []
            for cluster_id, centroid in self._cluster_centers.items():
                dist = float(np.linalg.norm(new_X[i] - centroid))
                distances.append((cluster_id, dist))

            cluster_id, min_dist = min(distances, key=lambda x: x[1])

            max_dist = max(
                np.linalg.norm(self._feature_matrix[j] - centroid)
                for j in np.where(self._labels == cluster_id)[0]
            )

            confidence = 1.0 - (min_dist / max(max_dist, 0.001))

            umap_embedding = self._compute_umap_embedding(
                np.vstack([self._feature_matrix, new_X[i:i+1]])
            )
            new_umap = (
                float(umap_embedding[-1, 0]),
                float(umap_embedding[-1, 1])
            )

            results.append(ClusteringResult(
                segment_id=feat.segment_id,
                cluster_label=cluster_id,
                cluster_name=existing_report.cluster_names[cluster_id],
                confidence=confidence,
                distance_to_centroid=min_dist,
                umap_2d=new_umap
            ))

        return results

    def explain_cluster(
        self,
        cluster_id: int,
        report: ClusteringReport,
        segments: List[AudioSegment],
        features_list: List[SpectralFeatures]
    ) -> Dict[str, Any]:
        """生成聚类解释"""
        summary = next(
            (s for s in report.clusters_summary if s["cluster_id"] == cluster_id),
            None
        )

        if not summary:
            raise ValueError(f"聚类 {cluster_id} 不存在")

        cluster_segments = [
            s for s in segments
            if report.clustering_results[s.segment_id].cluster_label == cluster_id
        ]
        cluster_features = [
            f for f in features_list
            if report.clustering_results[f.segment_id].cluster_label == cluster_id
        ]

        return {
            "cluster_id": cluster_id,
            "cluster_name": summary["cluster_name"],
            "size": summary["size"],
            "segments": [
                {
                    "segment_id": s.segment_id,
                    "file_name": s.file_name,
                    "instrument_tags": s.instrument_tags,
                    "tempo": [f for f in cluster_features if f.segment_id == s.segment_id][0].tempo,
                    "confidence": report.clustering_results[s.segment_id].confidence
                }
                for s in cluster_segments
            ],
            "characteristics": {
                "avg_tempo": summary["avg_tempo"],
                "avg_spectral_centroid": summary["avg_spectral_centroid"],
                "avg_rms_energy": summary["avg_rms_energy"],
                "instrument_tags": summary["instrument_tags"]
            },
            "musical_interpretation": self._interpret_cluster(
                summary["avg_tempo"],
                summary["avg_spectral_centroid"],
                summary["instrument_tags"]
            )
        }

    def _interpret_cluster(
        self,
        avg_tempo: float,
        avg_centroid: float,
        tags: List[str]
    ) -> str:
        """音乐性解释"""
        parts = []

        if tags:
            parts.append(f"主要乐器: {', '.join(tags)}")

        if avg_tempo < 80:
            parts.append("速度较慢，适合表现深沉、抒情的演奏风格")
        elif avg_tempo > 120:
            parts.append("速度较快，演奏风格活泼、激昂")
        else:
            parts.append("速度适中，演奏风格平稳、流畅")

        if avg_centroid < 1500:
            parts.append("音色偏向低沉、温暖")
        elif avg_centroid > 3000:
            parts.append("音色偏向明亮、尖锐")
        else:
            parts.append("音色平衡、自然")

        return "；".join(parts)

    def get_cluster_members(
        self,
        cluster_id: int,
        report: ClusteringReport
    ) -> List[str]:
        """获取指定聚类的成员segment_id列表"""
        return [
            seg_id for seg_id, result in report.clustering_results.items()
            if result.cluster_label == cluster_id
        ]

    def compare_segments(
        self,
        segment_id_1: str,
        segment_id_2: str,
        features_list: List[SpectralFeatures],
        report: ClusteringReport
    ) -> Dict[str, Any]:
        """比较两个音频片段的特征差异"""
        feat1 = next((f for f in features_list if f.segment_id == segment_id_1))
        feat2 = next((f for f in features_list if f.segment_id == segment_id_2))

        result1 = report.clustering_results[segment_id_1]
        result2 = report.clustering_results[segment_id_2]

        vec1 = np.array(feat1.feature_vector)
        vec2 = np.array(feat2.feature_vector)
        distance = float(np.linalg.norm(vec1 - vec2))

        feature_diffs = {
            "tempo_diff": abs(feat1.tempo - feat2.tempo),
            "centroid_diff": abs(feat1.spectral_centroid - feat2.spectral_centroid),
            "rms_diff": abs(feat1.rms_energy - feat2.rms_energy),
            "zcr_diff": abs(feat1.zero_crossing_rate - feat2.zero_crossing_rate),
            "euclidean_distance": distance
        }

        same_cluster = result1.cluster_label == result2.cluster_label

        return {
            "segment_1": segment_id_1,
            "segment_2": segment_id_2,
            "same_cluster": same_cluster,
            "cluster_1": result1.cluster_name,
            "cluster_2": result2.cluster_name,
            "feature_differences": feature_diffs,
            "similarity_score": max(0.0, 1.0 - distance / 5.0),
            "interpretation": self._interpret_comparison(same_cluster, distance)
        }

    def _interpret_comparison(
        self,
        same_cluster: bool,
        distance: float
    ) -> str:
        """比较结果的音乐解释"""
        if same_cluster:
            if distance < 0.5:
                return "两个演奏版本非常相似，可能是同一演奏家的不同录音或相似诠释"
            elif distance < 1.0:
                return "两个演奏版本较为相似，音乐诠释相近"
            else:
                return "两个演奏版本属于同一风格类别，但在细节上有明显差异，适合对比学习"
        else:
            if distance < 1.5:
                return "两个演奏版本虽被分到不同群组，但整体风格仍有一定相似性"
            else:
                return "两个演奏版本在音乐风格上有显著差异，适合对比不同演奏风格"

