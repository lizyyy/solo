from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional, Tuple

import numpy as np

from .parser import Face, ParsedMesh, Vertex


@dataclass
class FaceAreaRecord:
    face_index: int
    source_line: int
    vertex_indices: Tuple[int, int, int]
    area: float
    is_anomaly: bool = False
    anomaly_reason: str = ""

    def to_dict(self) -> dict:
        d: dict = {
            "face_index": self.face_index,
            "source_line": self.source_line,
            "vertex_indices": list(self.vertex_indices),
            "area": self.area,
            "is_anomaly": self.is_anomaly,
        }
        if self.anomaly_reason:
            d["anomaly_reason"] = self.anomaly_reason
        return d


@dataclass
class AreaAnomalyIssue:
    face_index: int
    source_line: int
    area: float
    z_score: float
    deviation: str
    description: str

    def to_dict(self) -> dict:
        return {
            "issue_type": "area_anomaly",
            "face_index": self.face_index,
            "source_line": self.source_line,
            "area": self.area,
            "z_score": self.z_score,
            "deviation": self.deviation,
            "description": self.description,
        }


@dataclass
class AreaStatistics:
    total_area: float
    mean_area: float
    median_area: float
    std_area: float
    min_area: float
    max_area: float
    face_count: int
    anomaly_count: int

    def to_dict(self) -> dict:
        return {
            "total_area": self.total_area,
            "mean_area": self.mean_area,
            "median_area": self.median_area,
            "std_area": self.std_area,
            "min_area": self.min_area,
            "max_area": self.max_area,
            "face_count": self.face_count,
            "anomaly_count": self.anomaly_count,
        }


@dataclass
class AreaResult:
    file_path: str
    file_name: str
    area_unit: str
    statistics: AreaStatistics
    face_areas: List[FaceAreaRecord]
    anomaly_issues: List[AreaAnomalyIssue]

    def to_dict(self) -> dict:
        return {
            "file_path": self.file_path,
            "file_name": self.file_name,
            "area_unit": self.area_unit,
            "statistics": self.statistics.to_dict(),
            "face_areas": [fa.to_dict() for fa in self.face_areas],
            "anomaly_issues": [ai.to_dict() for ai in self.anomaly_issues],
        }


def _triangle_area(v0: Vertex, v1: Vertex, v2: Vertex) -> float:
    a = np.array([v0.x, v0.y, v0.z])
    b = np.array([v1.x, v1.y, v1.z])
    c = np.array([v2.x, v2.y, v2.z])
    cross = np.cross(b - a, c - a)
    return float(0.5 * np.linalg.norm(cross))


def infer_area_unit(areas: np.ndarray) -> str:
    if len(areas) == 0:
        return "unknown"
    mean_a = float(np.mean(areas))
    if mean_a < 1e-6:
        return "mm²"
    elif mean_a < 1e-2:
        return "cm²"
    elif mean_a < 1e3:
        return "m²"
    else:
        return "m²(大尺度)"


def check_area_anomalies(
    mesh: ParsedMesh,
    z_threshold: float = 3.0,
    min_area_threshold: float = 1e-10,
) -> AreaResult:
    face_areas: List[FaceAreaRecord] = []
    anomaly_issues: List[AreaAnomalyIssue] = []

    raw_areas: List[float] = []
    for face in mesh.faces:
        vi = face.vertex_indices
        if any(idx < 0 or idx >= len(mesh.vertices) for idx in vi):
            raw_areas.append(0.0)
            face_areas.append(
                FaceAreaRecord(
                    face_index=face.index,
                    source_line=face.source_line,
                    vertex_indices=vi,
                    area=0.0,
                    is_anomaly=True,
                    anomaly_reason="顶点索引越界，无法计算面积",
                )
            )
            continue

        v0 = mesh.vertices[vi[0]]
        v1 = mesh.vertices[vi[1]]
        v2 = mesh.vertices[vi[2]]
        area = _triangle_area(v0, v1, v2)
        raw_areas.append(area)

        face_areas.append(
            FaceAreaRecord(
                face_index=face.index,
                source_line=face.source_line,
                vertex_indices=vi,
                area=area,
            )
        )

    areas_arr = np.array(raw_areas)
    valid_mask = areas_arr > 0
    valid_areas = areas_arr[valid_mask]

    if len(valid_areas) > 0:
        mean_a = float(np.mean(valid_areas))
        std_a = float(np.std(valid_areas))
        median_a = float(np.median(valid_areas))
        total_a = float(np.sum(areas_arr))
        min_a = float(np.min(valid_areas))
        max_a = float(np.max(valid_areas))
    else:
        mean_a = std_a = median_a = total_a = min_a = max_a = 0.0

    area_unit = infer_area_unit(valid_areas) if len(valid_areas) > 0 else "unknown"

    anomaly_count = 0
    for i, fa in enumerate(face_areas):
        reasons: List[str] = []
        z_score = 0.0

        if fa.area <= min_area_threshold and fa.area >= 0:
            reasons.append(f"面积过小({fa.area:.2e} ≤ {min_area_threshold:.2e})")
            z_score = 0.0

        if std_a > 1e-15 and fa.area > 0:
            z_score = abs(fa.area - mean_a) / std_a
            if z_score > z_threshold:
                deviation = "偏大" if fa.area > mean_a else "偏小"
                reasons.append(
                    f"Z-score={z_score:.2f}超过阈值{z_threshold}，面积{deviation}"
                )

        if reasons:
            fa.is_anomaly = True
            fa.anomaly_reason = "; ".join(reasons)
            anomaly_count += 1
            deviation = ""
            if fa.area > mean_a:
                deviation = "偏大"
            elif fa.area < mean_a and fa.area > 0:
                deviation = "偏小"
            elif fa.area <= 0:
                deviation = "退化/零面积"
            anomaly_issues.append(
                AreaAnomalyIssue(
                    face_index=fa.face_index,
                    source_line=fa.source_line,
                    area=fa.area,
                    z_score=z_score,
                    deviation=deviation,
                    description=f"面片 {fa.face_index} (行 {fa.source_line}) 面积异常: {fa.anomaly_reason}",
                )
            )

    statistics = AreaStatistics(
        total_area=total_a,
        mean_area=mean_a,
        median_area=median_a,
        std_area=std_a,
        min_area=min_a,
        max_area=max_a,
        face_count=len(face_areas),
        anomaly_count=anomaly_count,
    )

    return AreaResult(
        file_path=mesh.file_path,
        file_name=mesh.file_name,
        area_unit=area_unit,
        statistics=statistics,
        face_areas=face_areas,
        anomaly_issues=anomaly_issues,
    )
