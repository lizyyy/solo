"""瑕疵分组和异常检测模块"""

import numpy as np
from dataclasses import dataclass, field
from typing import List, Dict, Tuple, Optional, Any
from collections import defaultdict
from sklearn.cluster import DBSCAN, KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics.pairwise import cosine_similarity

from ..config import get_config
from ..features.image_features import ImageFeatures
from ..features.text_features import TextFeatures


@dataclass
class SampleData:
    sample_id: str
    image_path: str
    batch_id: str
    formula: str
    image_features: ImageFeatures
    text_features: Optional[TextFeatures] = None
    kiln_temperature_data: Optional[Dict] = None
    notes: str = ""
    metadata: Dict = field(default_factory=dict)


@dataclass
class DefectGroup:
    group_id: str
    name: str
    description: str
    sample_ids: List[str]
    dominant_defect_type: str
    similarity_score: float
    features_summary: Dict = field(default_factory=dict)
    is_manual: bool = False

    def to_dict(self) -> Dict:
        return {
            "group_id": self.group_id,
            "name": self.name,
            "description": self.description,
            "sample_ids": self.sample_ids,
            "dominant_defect_type": self.dominant_defect_type,
            "similarity_score": float(self.similarity_score),
            "features_summary": self.features_summary,
            "is_manual": self.is_manual,
        }


@dataclass
class AnomalyDetection:
    sample_id: str
    anomaly_type: str
    severity: float
    description: str
    comparison_samples: List[str]
    details: Dict = field(default_factory=dict)

    def to_dict(self) -> Dict:
        return {
            "sample_id": self.sample_id,
            "anomaly_type": self.anomaly_type,
            "severity": float(self.severity),
            "description": self.description,
            "comparison_samples": self.comparison_samples,
            "details": self.details,
        }


@dataclass
class AnalysisResult:
    batch_id: str
    total_samples: int
    groups: List[DefectGroup]
    anomalies: List[AnomalyDetection]
    summary: Dict = field(default_factory=dict)

    def to_dict(self) -> Dict:
        return {
            "batch_id": self.batch_id,
            "total_samples": self.total_samples,
            "groups": [g.to_dict() for g in self.groups],
            "anomalies": [a.to_dict() for a in self.anomalies],
            "summary": self.summary,
        }


class DefectGrouper:
    def __init__(self, config=None):
        self.config = config or get_config()
        self.analysis_config = self.config.analysis
        self.scaler = StandardScaler()

    def build_combined_feature_matrix(
        self,
        samples: List[SampleData],
        weights: Optional[Dict[str, float]] = None
    ) -> np.ndarray:
        weights = weights or {"image": 0.6, "text": 0.4}

        features_list = []
        for sample in samples:
            img_feat = sample.image_features.feature_vector
            if sample.text_features:
                text_feat = np.array(sample.text_features.feature_vector, dtype=np.float32)
            else:
                text_feat = np.zeros(11, dtype=np.float32)

            img_norm = img_feat / (np.linalg.norm(img_feat) + 1e-8)
            text_norm = text_feat / (np.linalg.norm(text_feat) + 1e-8)

            combined = np.concatenate([
                img_norm * weights["image"],
                text_norm * weights["text"]
            ])
            features_list.append(combined)

        return np.array(features_list)

    def compute_similarity_matrix(
        self,
        samples: List[SampleData],
        weights: Optional[Dict[str, float]] = None
    ) -> np.ndarray:
        n = len(samples)
        sim_matrix = np.zeros((n, n))

        for i in range(n):
            sim_matrix[i][i] = 1.0
            for j in range(i + 1, n):
                img_sim = samples[i].image_features.similarity(samples[j].image_features)

                if samples[i].text_features and samples[j].text_features:
                    text_sim = samples[i].text_features.similarity(samples[j].text_features)
                else:
                    text_sim = 0.0

                weights = weights or {"image": 0.6, "text": 0.4}
                combined_sim = img_sim * weights["image"] + text_sim * weights["text"]

                sim_matrix[i][j] = combined_sim
                sim_matrix[j][i] = combined_sim

        return sim_matrix

    def group_by_dbscan(
        self,
        samples: List[SampleData],
        eps: Optional[float] = None,
        min_samples: Optional[int] = None
    ) -> Tuple[List[List[int]], np.ndarray]:
        eps = eps or (1.0 - self.analysis_config.similarity_threshold)
        min_samples = min_samples or self.analysis_config.min_group_size

        sim_matrix = self.compute_similarity_matrix(samples)
        dist_matrix = 1.0 - sim_matrix

        dbscan = DBSCAN(eps=eps, min_samples=min_samples, metric="precomputed")
        labels = dbscan.fit_predict(dist_matrix)

        clusters = defaultdict(list)
        for idx, label in enumerate(labels):
            clusters[label].append(idx)

        result = []
        for label, indices in clusters.items():
            if label != -1:
                result.append(indices)

        noise_indices = [i for i, l in enumerate(labels) if l == -1]
        for idx in noise_indices:
            result.append([idx])

        return result, sim_matrix

    def determine_defect_type(self, samples: List[SampleData], indices: List[int]) -> str:
        defect_counts = defaultdict(int)

        for idx in indices:
            sample = samples[idx]

            if sample.image_features.bubble.is_abnormal(
                self.analysis_config.bubble_area_threshold
            ):
                defect_counts["气泡"] += 2

            if sample.text_features:
                for defect_type, score in sample.text_features.defect_categories.items():
                    if score > 0:
                        defect_counts[defect_type] += score

            if sample.image_features.contour.total_contours > 5:
                defect_counts["表面缺陷"] += 1

        if not defect_counts:
            return "无明显缺陷"

        return max(defect_counts.keys(), key=lambda k: defect_counts[k])

    def generate_group_name(self, defect_type: str, group_index: int) -> str:
        type_names = {
            "气泡": "气泡缺陷组",
            "色差": "色差异常组",
            "裂纹": "裂纹缺陷组",
            "划痕": "划痕缺陷组",
            "杂质": "杂质缺陷组",
            "变形": "形状变形组",
            "透明度": "透明度异常组",
            "表面缺陷": "表面瑕疵组",
            "无明显缺陷": "正常试样组",
        }
        base_name = type_names.get(defect_type, f"缺陷组{defect_type}")
        return f"{base_name}_{group_index + 1}"

    def calculate_group_similarity(
        self,
        samples: List[SampleData],
        indices: List[int],
        sim_matrix: np.ndarray
    ) -> float:
        if len(indices) <= 1:
            return 1.0

        similarities = []
        for i in range(len(indices)):
            for j in range(i + 1, len(indices)):
                similarities.append(sim_matrix[indices[i], indices[j]])

        return float(np.mean(similarities)) if similarities else 0.0

    def build_features_summary(
        self,
        samples: List[SampleData],
        indices: List[int]
    ) -> Dict:
        if not indices:
            return {}

        bubble_counts = []
        bubble_ratios = []
        color_contrasts = []
        contour_counts = []

        for idx in indices:
            sample = samples[idx]
            bubble_counts.append(sample.image_features.bubble.bubble_count)
            bubble_ratios.append(sample.image_features.bubble.bubble_area_ratio)
            color_contrasts.append(sample.image_features.color.color_contrast)
            contour_counts.append(sample.image_features.contour.total_contours)

        return {
            "avg_bubble_count": float(np.mean(bubble_counts)),
            "max_bubble_count": int(np.max(bubble_counts)),
            "avg_bubble_ratio": float(np.mean(bubble_ratios)),
            "max_bubble_ratio": float(np.max(bubble_ratios)),
            "avg_color_contrast": float(np.mean(color_contrasts)),
            "avg_contour_count": float(np.mean(contour_counts)),
            "group_size": len(indices),
        }

    def group_samples(
        self,
        samples: List[SampleData],
        method: str = "dbscan"
    ) -> List[DefectGroup]:
        if not samples:
            return []

        if method == "dbscan":
            clusters, sim_matrix = self.group_by_dbscan(samples)
        else:
            clusters, sim_matrix = self.group_by_dbscan(samples)

        groups = []
        for group_idx, cluster_indices in enumerate(clusters):
            sample_ids = [samples[idx].sample_id for idx in cluster_indices]
            defect_type = self.determine_defect_type(samples, cluster_indices)
            similarity = self.calculate_group_similarity(samples, cluster_indices, sim_matrix)
            features_summary = self.build_features_summary(samples, cluster_indices)

            group = DefectGroup(
                group_id=f"G_{group_idx + 1:03d}",
                name=self.generate_group_name(defect_type, group_idx),
                description=f"包含 {len(sample_ids)} 个试样，主要缺陷类型：{defect_type}",
                sample_ids=sample_ids,
                dominant_defect_type=defect_type,
                similarity_score=similarity,
                features_summary=features_summary,
                is_manual=False,
            )
            groups.append(group)

        return groups


class AnomalyDetector:
    def __init__(self, config=None):
        self.config = config or get_config()
        self.analysis_config = self.config.analysis

    def detect_color_anomalies(
        self,
        samples: List[SampleData],
        group_by_formula: bool = True
    ) -> List[AnomalyDetection]:
        anomalies = []

        if group_by_formula:
            formula_groups = defaultdict(list)
            for sample in samples:
                formula_groups[sample.formula].append(sample)

            for formula, formula_samples in formula_groups.items():
                if len(formula_samples) < 2:
                    continue

                anomalies.extend(self._detect_color_anomalies_in_group(formula_samples, formula))
        else:
            anomalies.extend(self._detect_color_anomalies_in_group(samples, "全部"))

        return anomalies

    def _detect_color_anomalies_in_group(
        self,
        samples: List[SampleData],
        group_name: str
    ) -> List[AnomalyDetection]:
        anomalies = []

        color_vectors = []
        for sample in samples:
            lab = sample.image_features.color.avg_lab
            color_vectors.append(np.array(lab))

        color_matrix = np.array(color_vectors)
        centroid = np.mean(color_matrix, axis=0)

        distances = []
        for i, vec in enumerate(color_vectors):
            dist = np.linalg.norm(vec - centroid)
            distances.append((i, dist))

        distances.sort(key=lambda x: x[1], reverse=True)

        if not distances:
            return anomalies

        max_dist = distances[0][1]
        if max_dist < 1e-8:
            return anomalies

        for idx, dist in distances[:3]:
            normalized_dist = dist / max_dist
            if normalized_dist > self.analysis_config.color_diff_threshold:
                sample = samples[idx]
                comparison_ids = [s.sample_id for s in samples if s.sample_id != sample.sample_id][:3]

                anomaly = AnomalyDetection(
                    sample_id=sample.sample_id,
                    anomaly_type="色差",
                    severity=normalized_dist,
                    description=f"在{group_name}组中，该试样与同组平均颜色偏差较大（LAB距离: {dist:.2f}）",
                    comparison_samples=comparison_ids,
                    details={
                        "formula": sample.formula,
                        "avg_lab": list(sample.image_features.color.avg_lab),
                        "group_centroid": list(centroid),
                        "distance": float(dist),
                    },
                )
                anomalies.append(anomaly)

        return anomalies

    def detect_bubble_anomalies(self, samples: List[SampleData]) -> List[AnomalyDetection]:
        anomalies = []

        for sample in samples:
            bubble = sample.image_features.bubble
            is_abnormal = bubble.is_abnormal(
                self.analysis_config.bubble_area_threshold,
                threshold_count=5
            )

            if is_abnormal:
                severity = min(1.0, bubble.bubble_area_ratio / self.analysis_config.bubble_area_threshold)

                anomaly = AnomalyDetection(
                    sample_id=sample.sample_id,
                    anomaly_type="气泡",
                    severity=severity,
                    description=f"检测到异常气泡：数量 {bubble.bubble_count} 个，面积占比 {bubble.bubble_area_ratio * 100:.2f}%",
                    comparison_samples=[],
                    details={
                        "bubble_count": bubble.bubble_count,
                        "total_bubble_area": bubble.total_bubble_area,
                        "bubble_area_ratio": bubble.bubble_area_ratio,
                        "max_bubble_area": bubble.max_bubble_area,
                    },
                )
                anomalies.append(anomaly)

        return anomalies

    def detect_temperature_anomalies(
        self,
        samples: List[SampleData]
    ) -> List[AnomalyDetection]:
        anomalies = []

        temp_samples = [s for s in samples if s.kiln_temperature_data]
        if not temp_samples:
            return anomalies

        all_temps = []
        for sample in temp_samples:
            temp_data = sample.kiln_temperature_data
            if "temperatures" in temp_data:
                all_temps.extend(temp_data["temperatures"])

        if not all_temps:
            return anomalies

        avg_temp = np.mean(all_temps)
        std_temp = np.std(all_temps)

        for sample in temp_samples:
            temp_data = sample.kiln_temperature_data
            temps = temp_data.get("temperatures", [])
            if not temps:
                continue

            sample_avg = np.mean(temps)
            sample_std = np.std(temps)

            z_score = abs(sample_avg - avg_temp) / (std_temp + 1e-8)

            if z_score > 2.0 or sample_std > std_temp * 1.5:
                severity = min(1.0, z_score / 3.0)

                anomaly = AnomalyDetection(
                    sample_id=sample.sample_id,
                    anomaly_type="温度",
                    severity=severity,
                    description=f"窑炉温度异常：平均温度 {sample_avg:.1f}°C，波动 {sample_std:.1f}°C",
                    comparison_samples=[],
                    details={
                        "sample_avg_temp": float(sample_avg),
                        "sample_temp_std": float(sample_std),
                        "batch_avg_temp": float(avg_temp),
                        "batch_temp_std": float(std_temp),
                        "z_score": float(z_score),
                    },
                )
                anomalies.append(anomaly)

        return anomalies

    def detect_all_anomalies(self, samples: List[SampleData]) -> List[AnomalyDetection]:
        anomalies = []
        anomalies.extend(self.detect_color_anomalies(samples))
        anomalies.extend(self.detect_bubble_anomalies(samples))
        anomalies.extend(self.detect_temperature_anomalies(samples))
        return anomalies


class AnalysisEngine:
    def __init__(self, config=None):
        self.config = config or get_config()
        self.grouper = DefectGrouper(self.config)
        self.anomaly_detector = AnomalyDetector(self.config)

    def analyze(self, samples: List[SampleData], batch_id: str = "") -> AnalysisResult:
        if not batch_id and samples:
            batch_id = samples[0].batch_id

        groups = self.grouper.group_samples(samples)
        anomalies = self.anomaly_detector.detect_all_anomalies(samples)

        summary = self._build_summary(samples, groups, anomalies)

        return AnalysisResult(
            batch_id=batch_id,
            total_samples=len(samples),
            groups=groups,
            anomalies=anomalies,
            summary=summary,
        )

    def _build_summary(
        self,
        samples: List[SampleData],
        groups: List[DefectGroup],
        anomalies: List[AnomalyDetection]
    ) -> Dict:
        defect_type_counts = defaultdict(int)
        for group in groups:
            defect_type_counts[group.dominant_defect_type] += len(group.sample_ids)

        anomaly_type_counts = defaultdict(int)
        for anomaly in anomalies:
            anomaly_type_counts[anomaly.anomaly_type] += 1

        bubble_abnormal = sum(
            1 for s in samples
            if s.image_features.bubble.is_abnormal(self.config.analysis.bubble_area_threshold)
        )

        return {
            "total_samples": len(samples),
            "total_groups": len(groups),
            "total_anomalies": len(anomalies),
            "defect_distribution": dict(defect_type_counts),
            "anomaly_distribution": dict(anomaly_type_counts),
            "bubble_abnormal_count": bubble_abnormal,
            "bubble_normal_count": len(samples) - bubble_abnormal,
        }
