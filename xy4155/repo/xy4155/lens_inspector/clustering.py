"""镜头瑕疵分拣台 - 聚类评分模块"""

import uuid
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass

import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import pairwise_distances

from .models import (
    ImageFeatures,
    LensInspection,
    DefectDetection,
    DefectType,
    InspectionStatus,
)


class AnomalyScorer:
    SHARPNESS_WEIGHT = 0.3
    DARK_CORNER_WEIGHT = 0.2
    COLOR_SHIFT_WEIGHT = 0.2
    DEAD_PIXEL_WEIGHT = 0.15
    HOT_PIXEL_WEIGHT = 0.1
    NOISE_WEIGHT = 0.05

    def __init__(
        self,
        sharpness_weight: float = 0.3,
        dark_corner_weight: float = 0.2,
        color_shift_weight: float = 0.2,
        dead_pixel_weight: float = 0.15,
        hot_pixel_weight: float = 0.1,
        noise_weight: float = 0.05,
    ):
        self.sharpness_weight = sharpness_weight
        self.dark_corner_weight = dark_corner_weight
        self.color_shift_weight = color_shift_weight
        self.dead_pixel_weight = dead_pixel_weight
        self.hot_pixel_weight = hot_pixel_weight
        self.noise_weight = noise_weight

    def score_single_image(self, features: ImageFeatures) -> Tuple[float, Dict[str, float]]:
        sharpness_score = features.sharpness_score
        dark_corner_score = features.dark_corner_score
        color_shift_score = features.color_shift_score

        dead_pixel_score = min(1.0, features.dead_pixel_count / 20.0)
        hot_pixel_score = min(1.0, features.hot_pixel_count / 20.0)
        noise_score = features.noise_level

        total_weight = (
            self.sharpness_weight
            + self.dark_corner_weight
            + self.color_shift_weight
            + self.dead_pixel_weight
            + self.hot_pixel_weight
            + self.noise_weight
        )

        anomaly_score = (
            sharpness_score * self.sharpness_weight
            + dark_corner_score * self.dark_corner_weight
            + color_shift_score * self.color_shift_weight
            + dead_pixel_score * self.dead_pixel_weight
            + hot_pixel_score * self.hot_pixel_weight
            + noise_score * self.noise_weight
        ) / total_weight

        breakdown = {
            "sharpness": sharpness_score,
            "dark_corner": dark_corner_score,
            "color_shift": color_shift_score,
            "dead_pixel": dead_pixel_score,
            "hot_pixel": hot_pixel_score,
            "noise": noise_score,
        }

        return anomaly_score, breakdown

    def score_lens_inspection(
        self, inspection: LensInspection
    ) -> Tuple[float, Dict[str, float]]:
        if not inspection.image_features:
            return 0.0, {}

        image_scores = []
        all_breakdowns: Dict[str, List[float]] = {
            "sharpness": [],
            "dark_corner": [],
            "color_shift": [],
            "dead_pixel": [],
            "hot_pixel": [],
            "noise": [],
        }

        for image_id, features in inspection.image_features.items():
            score, breakdown = self.score_single_image(features)
            image_scores.append(score)

            for key, value in breakdown.items():
                all_breakdowns[key].append(value)

        lens_score = np.max(image_scores) if image_scores else 0.0

        avg_breakdown = {
            key: np.mean(values) if values else 0.0
            for key, values in all_breakdowns.items()
        }

        if inspection.defects:
            high_severity_count = sum(1 for d in inspection.defects if d.severity == "高")
            if high_severity_count > 0:
                lens_score = min(1.0, lens_score + high_severity_count * 0.1)

        return lens_score, avg_breakdown


class DefectClusterer:
    CLUSTER_LABELS = {
        0: "清晰度问题",
        1: "暗角问题",
        2: "色偏问题",
        3: "坏点/热点问题",
        4: "综合问题",
        5: "正常/无问题",
    }

    def __init__(self, n_clusters: int = 6, random_state: int = 42):
        self.n_clusters = n_clusters
        self.random_state = random_state
        self.scaler = StandardScaler()
        self.kmeans: Optional[KMeans] = None
        self.cluster_centers_: Optional[np.ndarray] = None

    def _extract_feature_vector(self, inspection: LensInspection) -> np.ndarray:
        breakdown = inspection.anomaly_score_breakdown

        if not breakdown:
            return np.zeros(6)

        features = [
            breakdown.get("sharpness", 0.0),
            breakdown.get("dark_corner", 0.0),
            breakdown.get("color_shift", 0.0),
            breakdown.get("dead_pixel", 0.0),
            breakdown.get("hot_pixel", 0.0),
            breakdown.get("noise", 0.0),
        ]

        return np.array(features)

    def fit(self, inspections: Dict[str, LensInspection]) -> "DefectClusterer":
        if len(inspections) < 2:
            return self

        feature_matrix = []
        for lens_id, inspection in inspections.items():
            vec = self._extract_feature_vector(inspection)
            feature_matrix.append(vec)

        feature_matrix = np.array(feature_matrix)

        if feature_matrix.shape[0] < self.n_clusters:
            self.n_clusters = max(2, feature_matrix.shape[0] // 2)

        scaled_features = self.scaler.fit_transform(feature_matrix)

        self.kmeans = KMeans(
            n_clusters=self.n_clusters,
            random_state=self.random_state,
            n_init=10,
        )
        self.kmeans.fit(scaled_features)
        self.cluster_centers_ = self.kmeans.cluster_centers_

        return self

    def predict(
        self, inspection: LensInspection
    ) -> Tuple[int, str, List[Tuple[str, float]]]:
        if self.kmeans is None:
            return -1, "未聚类", []

        feature_vector = self._extract_feature_vector(inspection).reshape(1, -1)
        scaled = self.scaler.transform(feature_vector)

        cluster_id = int(self.kmeans.predict(scaled)[0])

        distances = pairwise_distances(scaled, self.cluster_centers_)[0]
        sorted_indices = np.argsort(distances)

        similar_clusters = []
        for idx in sorted_indices[1:4]:
            similar_clusters.append(
                (self.CLUSTER_LABELS.get(int(idx), f"聚类{idx}"), float(distances[idx]))
            )

        cluster_label = self.CLUSTER_LABELS.get(cluster_id, f"聚类{cluster_id}")

        return cluster_id, cluster_label, similar_clusters

    def transform(
        self, inspections: Dict[str, LensInspection]
    ) -> Dict[str, LensInspection]:
        if self.kmeans is None:
            return inspections

        clusters: Dict[int, List[str]] = {}

        for lens_id, inspection in inspections.items():
            cluster_id, cluster_label, similar = self.predict(inspection)

            inspection.cluster_id = cluster_id
            inspection.cluster_label = cluster_label

            if cluster_id not in clusters:
                clusters[cluster_id] = []
            clusters[cluster_id].append(lens_id)

        for lens_id, inspection in inspections.items():
            if inspection.cluster_id is not None and inspection.cluster_id in clusters:
                similar_lenses = [
                    lid
                    for lid in clusters[inspection.cluster_id]
                    if lid != lens_id
                ]
                inspection.similar_defects = similar_lenses

        return inspections


class ClusteringPipeline:
    def __init__(
        self,
        n_clusters: int = 6,
        random_state: int = 42,
    ):
        self.scorer = AnomalyScorer()
        self.clusterer = DefectClusterer(n_clusters=n_clusters, random_state=random_state)

    def process_inspections(
        self, inspections: Dict[str, LensInspection]
    ) -> Dict[str, LensInspection]:
        for lens_id, inspection in inspections.items():
            anomaly_score, breakdown = self.scorer.score_lens_inspection(inspection)
            inspection.anomaly_score = anomaly_score
            inspection.anomaly_score_breakdown = breakdown

        if len(inspections) >= 2:
            self.clusterer.fit(inspections)
            inspections = self.clusterer.transform(inspections)

        for lens_id, inspection in inspections.items():
            if inspection.anomaly_score > 0.1:
                inspection.status = InspectionStatus.FLAGGED
            elif inspection.defects:
                inspection.status = InspectionStatus.COMPLETED
            else:
                inspection.status = InspectionStatus.COMPLETED

        return inspections

    def get_anomaly_summary(
        self, inspections: Dict[str, LensInspection]
    ) -> Dict[str, any]:
        if not inspections:
            return {
                "count": 0,
                "min_score": 0.0,
                "max_score": 0.0,
                "mean_score": 0.0,
                "high_anomaly_count": 0,
                "clusters": {},
            }

        scores = [inspection.anomaly_score for inspection in inspections.values()]
        high_anomaly_count = sum(1 for s in scores if s > 0.5)

        clusters: Dict[int, List[str]] = {}
        for lens_id, inspection in inspections.items():
            cid = inspection.cluster_id if inspection.cluster_id is not None else -1
            if cid not in clusters:
                clusters[cid] = []
            clusters[cid].append(lens_id)

        cluster_summary = {}
        for cid, lens_ids in clusters.items():
            if cid == -1:
                label = "未聚类"
            else:
                label = DefectClusterer.CLUSTER_LABELS.get(cid, f"聚类{cid}")

            cluster_scores = [
                inspections[lid].anomaly_score
                for lid in lens_ids
                if lid in inspections
            ]

            cluster_summary[cid] = {
                "label": label,
                "count": len(lens_ids),
                "lenses": lens_ids,
                "avg_score": np.mean(cluster_scores) if cluster_scores else 0.0,
            }

        return {
            "count": len(inspections),
            "min_score": float(np.min(scores)),
            "max_score": float(np.max(scores)),
            "mean_score": float(np.mean(scores)),
            "high_anomaly_count": high_anomaly_count,
            "clusters": cluster_summary,
        }

    def find_similar_defects(
        self,
        target_lens_id: str,
        inspections: Dict[str, LensInspection],
        top_n: int = 5,
    ) -> List[Tuple[str, float, str]]:
        if target_lens_id not in inspections:
            return []

        target = inspections[target_lens_id]
        target_vec = self.clusterer._extract_feature_vector(target).reshape(1, -1)

        similarities = []
        for lens_id, inspection in inspections.items():
            if lens_id == target_lens_id:
                continue

            other_vec = self.clusterer._extract_feature_vector(inspection).reshape(1, -1)

            distance = float(np.linalg.norm(target_vec - other_vec))
            similarity = 1.0 / (1.0 + distance)

            similarities.append(
                (lens_id, similarity, inspection.cluster_label)
            )

        similarities.sort(key=lambda x: x[1], reverse=True)

        return similarities[:top_n]
