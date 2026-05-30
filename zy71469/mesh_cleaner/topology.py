from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, FrozenSet, List, Set, Tuple

import numpy as np

from .parser import Face, ParsedMesh, Vertex


@dataclass
class HoleIssue:
    boundary_edges: List[Tuple[Tuple[int, int], Tuple[int, int]]]
    face_indices_involved: List[int]
    description: str

    def to_dict(self) -> dict:
        return {
            "issue_type": "hole",
            "boundary_edge_count": len(self.boundary_edges),
            "boundary_edges": [
                {
                    "edge": list(e[0]),
                    "adjacent_face": e[1],
                }
                for e in self.boundary_edges
            ],
            "face_indices_involved": self.face_indices_involved,
            "description": self.description,
        }


@dataclass
class InvertedNormalIssue:
    face_index: int
    source_line: int
    computed_normal: Tuple[float, float, float]
    file_normal: Tuple[float, float, float] | None
    dot_product: float
    vertex_indices: Tuple[int, int, int]
    description: str

    def to_dict(self) -> dict:
        d: dict = {
            "issue_type": "inverted_normal",
            "face_index": self.face_index,
            "source_line": self.source_line,
            "computed_normal": list(self.computed_normal),
            "dot_product_with_file_normal": self.dot_product,
            "vertex_indices": list(self.vertex_indices),
            "description": self.description,
        }
        if self.file_normal is not None:
            d["file_normal"] = list(self.file_normal)
        else:
            d["file_normal"] = None
        return d


@dataclass
class TopologyResult:
    file_path: str
    file_name: str
    is_manifold: bool
    hole_issues: List[HoleIssue] = field(default_factory=list)
    inverted_normal_issues: List[InvertedNormalIssue] = field(default_factory=list)

    @property
    def has_holes(self) -> bool:
        return len(self.hole_issues) > 0

    @property
    def has_inverted_normals(self) -> bool:
        return len(self.inverted_normal_issues) > 0

    @property
    def is_clean(self) -> bool:
        return self.is_manifold and not self.has_holes and not self.has_inverted_normals

    def to_dict(self) -> dict:
        return {
            "file_path": self.file_path,
            "file_name": self.file_name,
            "is_manifold": self.is_manifold,
            "has_holes": self.has_holes,
            "has_inverted_normals": self.has_inverted_normals,
            "is_clean": self.is_clean,
            "hole_count": len(self.hole_issues),
            "inverted_normal_count": len(self.inverted_normal_issues),
            "hole_issues": [h.to_dict() for h in self.hole_issues],
            "inverted_normal_issues": [n.to_dict() for n in self.inverted_normal_issues],
        }


def _edge_key(v0: int, v1: int) -> FrozenSet[int]:
    return frozenset((v0, v1))


def _compute_face_normal(v0: Vertex, v1: Vertex, v2: Vertex) -> np.ndarray:
    a = np.array([v0.x, v0.y, v0.z])
    b = np.array([v1.x, v1.y, v1.z])
    c = np.array([v2.x, v2.y, v2.z])
    cross = np.cross(b - a, c - a)
    length = np.linalg.norm(cross)
    if length < 1e-12:
        return np.array([0.0, 0.0, 0.0])
    return cross / length


def check_holes(mesh: ParsedMesh) -> List[HoleIssue]:
    edge_face_map: Dict[FrozenSet[int], List[int]] = defaultdict(list)
    for face in mesh.faces:
        vi = face.vertex_indices
        for i in range(3):
            edge = _edge_key(vi[i], vi[(i + 1) % 3])
            edge_face_map[edge].append(face.index)

    boundary_edges: List[Tuple[FrozenSet[int], int]] = []
    for edge, face_ids in edge_face_map.items():
        if len(face_ids) == 1:
            boundary_edges.append((edge, face_ids[0]))
        elif len(face_ids) > 2:
            pass

    if not boundary_edges:
        return []

    edge_list = list(edge_face_map.keys())
    edge_set_for_boundary = set(e for e, _ in boundary_edges)

    adjacency: Dict[int, Set[int]] = defaultdict(set)
    for edge, _ in boundary_edges:
        verts = list(edge)
        if len(verts) == 2:
            adjacency[verts[0]].add(verts[1])
            adjacency[verts[1]].add(verts[0])

    visited_edges: Set[FrozenSet[int]] = set()
    holes: List[HoleIssue] = []

    for edge, face_id in boundary_edges:
        if edge in visited_edges:
            continue

        loop_verts: List[int] = []
        verts = list(edge)
        if len(verts) != 2:
            continue
        start = verts[0]
        current = start
        prev = verts[1]
        loop_verts.append(prev)
        loop_verts.append(current)

        safety = 0
        max_iter = len(boundary_edges) + 1
        while safety < max_iter:
            neighbors = adjacency.get(current, set())
            next_verts = [n for n in neighbors if n != prev and frozenset((current, n)) not in visited_edges]
            if not next_verts:
                break
            next_v = next_verts[0]
            visited_edges.add(frozenset((current, next_v)))
            if next_v == start:
                break
            loop_verts.append(next_v)
            prev = current
            current = next_v
            safety += 1

        face_indices_involved: List[int] = []
        for i in range(len(loop_verts) - 1):
            e = _edge_key(loop_verts[i], loop_verts[i + 1])
            if e in edge_face_map:
                face_indices_involved.extend(edge_face_map[e])
        face_indices_involved = list(set(face_indices_involved))

        boundary_edge_tuples = []
        for e_key, f_id in boundary_edges:
            if e_key in visited_edges or e_key == edge:
                verts_list = sorted(e_key)
                boundary_edge_tuples.append(((verts_list[0], verts_list[1]), (f_id,)))

        holes.append(
            HoleIssue(
                boundary_edges=boundary_edge_tuples[: len(loop_verts)],
                face_indices_involved=face_indices_involved,
                description=f"检测到由 {len(loop_verts)} 条边界边构成的孔洞",
            )
        )

    if not holes and boundary_edges:
        holes.append(
            HoleIssue(
                boundary_edges=[
                    (sorted(e), (fid,)) for e, fid in boundary_edges
                ],
                face_indices_involved=list(set(fid for _, fid in boundary_edges)),
                description=f"检测到 {len(boundary_edges)} 条边界边(非闭合孔洞)",
            )
        )

    return holes


def check_inverted_normals(mesh: ParsedMesh, dot_threshold: float = 0.0) -> List[InvertedNormalIssue]:
    issues: List[InvertedNormalIssue] = []

    for face in mesh.faces:
        vi = face.vertex_indices
        if any(idx < 0 or idx >= len(mesh.vertices) for idx in vi):
            continue

        v0 = mesh.vertices[vi[0]]
        v1 = mesh.vertices[vi[1]]
        v2 = mesh.vertices[vi[2]]

        computed = _compute_face_normal(v0, v1, v2)
        comp_norm = np.linalg.norm(computed)
        if comp_norm < 1e-12:
            continue

        if face.normal_indices is not None and mesh.vertex_normals:
            ni = face.normal_indices
            valid = all(0 <= idx < len(mesh.vertex_normals) for idx in ni)
            if valid:
                n0 = np.array(mesh.vertex_normals[ni[0]])
                n1 = np.array(mesh.vertex_normals[ni[1]])
                n2 = np.array(mesh.vertex_normals[ni[2]])
                file_normal = (n0 + n1 + n2) / 3.0
                fn_norm = np.linalg.norm(file_normal)
                if fn_norm < 1e-12:
                    continue
                file_normal_unit = file_normal / fn_norm
                computed_unit = computed / comp_norm
                dot = float(np.dot(computed_unit, file_normal_unit))

                if dot < dot_threshold:
                    issues.append(
                        InvertedNormalIssue(
                            face_index=face.index,
                            source_line=face.source_line,
                            computed_normal=tuple(computed_unit.tolist()),
                            file_normal=tuple(file_normal_unit.tolist()),
                            dot_product=dot,
                            vertex_indices=vi,
                            description=f"面片 {face.index} (行 {face.source_line}) 法线反向: 计算法线与文件法线点积={dot:.4f}",
                        )
                    )
        else:
            neighbor_normals: List[np.ndarray] = []
            for idx in vi:
                v = mesh.vertices[idx]
                pos = np.array([v.x, v.y, v.z])
                for other_face in mesh.faces:
                    if other_face.index == face.index:
                        continue
                    if idx in other_face.vertex_indices:
                        ovi = other_face.vertex_indices
                        if any(i < 0 or i >= len(mesh.vertices) for i in ovi):
                            continue
                        ov0 = mesh.vertices[ovi[0]]
                        ov1 = mesh.vertices[ovi[1]]
                        ov2 = mesh.vertices[ovi[2]]
                        on = _compute_face_normal(ov0, ov1, ov2)
                        on_norm = np.linalg.norm(on)
                        if on_norm > 1e-12:
                            neighbor_normals.append(on / on_norm)

            if neighbor_normals:
                avg_neighbor = np.mean(neighbor_normals, axis=0)
                an_norm = np.linalg.norm(avg_neighbor)
                if an_norm > 1e-12:
                    avg_neighbor_unit = avg_neighbor / an_norm
                    computed_unit = computed / comp_norm
                    dot = float(np.dot(computed_unit, avg_neighbor_unit))
                    if dot < dot_threshold:
                        issues.append(
                            InvertedNormalIssue(
                                face_index=face.index,
                                source_line=face.source_line,
                                computed_normal=tuple(computed_unit.tolist()),
                                file_normal=None,
                                dot_product=dot,
                                vertex_indices=vi,
                                description=f"面片 {face.index} (行 {face.source_line}) 法线疑似反向: 与邻域法线点积={dot:.4f}",
                            )
                        )

    return issues


def check_topology(mesh: ParsedMesh, dot_threshold: float = 0.0) -> TopologyResult:
    edge_face_map: Dict[FrozenSet[int], List[int]] = defaultdict(list)
    for face in mesh.faces:
        vi = face.vertex_indices
        for i in range(3):
            edge = _edge_key(vi[i], vi[(i + 1) % 3])
            edge_face_map[edge].append(face.index)

    is_manifold = all(len(face_ids) <= 2 for face_ids in edge_face_map.values())

    hole_issues = check_holes(mesh)
    inverted_normal_issues = check_inverted_normals(mesh, dot_threshold)

    return TopologyResult(
        file_path=mesh.file_path,
        file_name=mesh.file_name,
        is_manifold=is_manifold,
        hole_issues=hole_issues,
        inverted_normal_issues=inverted_normal_issues,
    )
