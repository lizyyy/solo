from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Tuple


@dataclass
class Vertex:
    index: int
    x: float
    y: float
    z: float
    source_line: int

    def to_dict(self) -> dict:
        return {
            "index": self.index,
            "coordinates": [self.x, self.y, self.z],
            "source_line": self.source_line,
        }


@dataclass
class Face:
    index: int
    vertex_indices: Tuple[int, int, int]
    source_line: int
    normal_indices: Tuple[int, int, int] | None = None

    def to_dict(self) -> dict:
        d: dict = {
            "index": self.index,
            "vertex_indices": list(self.vertex_indices),
            "source_line": self.source_line,
        }
        if self.normal_indices is not None:
            d["normal_indices"] = list(self.normal_indices)
        return d


@dataclass
class ParsedMesh:
    file_path: str
    file_name: str
    vertices: List[Vertex]
    faces: List[Face]
    vertex_normals: List[Tuple[float, float, float]] = field(default_factory=list)
    parse_warnings: List[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "file_path": self.file_path,
            "file_name": self.file_name,
            "vertex_count": len(self.vertices),
            "face_count": len(self.faces),
            "vertices": [v.to_dict() for v in self.vertices],
            "faces": [f.to_dict() for f in self.faces],
            "vertex_normal_count": len(self.vertex_normals),
            "parse_warnings": self.parse_warnings,
        }


def parse_obj(file_path: str) -> ParsedMesh:
    vertices: List[Vertex] = []
    faces: List[Face] = []
    vertex_normals: List[Tuple[float, float, float]] = []
    parse_warnings: List[dict] = []

    path = Path(file_path)
    file_name = path.name

    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        for line_num, raw_line in enumerate(f, start=1):
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue

            parts = line.split()
            keyword = parts[0]

            if keyword == "v" and len(parts) >= 4:
                try:
                    x, y, z = float(parts[1]), float(parts[2]), float(parts[3])
                    vertices.append(
                        Vertex(
                            index=len(vertices),
                            x=x,
                            y=y,
                            z=z,
                            source_line=line_num,
                        )
                    )
                except ValueError:
                    parse_warnings.append(
                        {
                            "line": line_num,
                            "type": "invalid_vertex",
                            "content": line,
                            "message": f"无法解析顶点坐标: {line}",
                        }
                    )

            elif keyword == "vn" and len(parts) >= 4:
                try:
                    nx, ny, nz = float(parts[1]), float(parts[2]), float(parts[3])
                    vertex_normals.append((nx, ny, nz))
                except ValueError:
                    parse_warnings.append(
                        {
                            "line": line_num,
                            "type": "invalid_normal",
                            "content": line,
                            "message": f"无法解析法线坐标: {line}",
                        }
                    )

            elif keyword == "f":
                try:
                    vi_list: List[int] = []
                    ni_list: List[int] = []
                    for token in parts[1:]:
                        comps = token.split("/")
                        vi = int(comps[0])
                        if vi < 0:
                            vi = len(vertices) + vi + 1
                        vi_list.append(vi - 1)

                        if len(comps) >= 3 and comps[2]:
                            ni = int(comps[2])
                            if ni < 0:
                                ni = len(vertex_normals) + ni + 1
                            ni_list.append(ni - 1)
                        elif len(comps) >= 2 and comps[1]:
                            pass

                    if len(vi_list) >= 3:
                        for i in range(1, len(vi_list) - 1):
                            tri_vi = (vi_list[0], vi_list[i], vi_list[i + 1])
                            tri_ni: Tuple[int, int, int] | None = None
                            if len(ni_list) == len(vi_list):
                                tri_ni = (ni_list[0], ni_list[i], ni_list[i + 1])
                            faces.append(
                                Face(
                                    index=len(faces),
                                    vertex_indices=tri_vi,
                                    source_line=line_num,
                                    normal_indices=tri_ni,
                                )
                            )
                    else:
                        parse_warnings.append(
                            {
                                "line": line_num,
                                "type": "degenerate_face",
                                "content": line,
                                "message": f"面片顶点数不足3: {line}",
                            }
                        )
                except (ValueError, IndexError):
                    parse_warnings.append(
                        {
                            "line": line_num,
                            "type": "invalid_face",
                            "content": line,
                            "message": f"无法解析面片定义: {line}",
                        }
                    )

    return ParsedMesh(
        file_path=os.path.abspath(file_path),
        file_name=file_name,
        vertices=vertices,
        faces=faces,
        vertex_normals=vertex_normals,
        parse_warnings=parse_warnings,
    )


def parse_mesh_file(file_path: str) -> ParsedMesh:
    ext = Path(file_path).suffix.lower()
    if ext == ".obj":
        return parse_obj(file_path)
    raise ValueError(f"不支持的网格文件格式: {ext} (文件: {file_path})")


def parse_directory(directory: str, extensions: Tuple[str, ...] = (".obj",)) -> List[ParsedMesh]:
    meshes: List[ParsedMesh] = []
    dir_path = Path(directory)
    if not dir_path.is_dir():
        raise ValueError(f"目录不存在: {directory}")

    for root, _, files in os.walk(directory):
        for fname in sorted(files):
            if Path(fname).suffix.lower() in extensions:
                fpath = os.path.join(root, fname)
                try:
                    mesh = parse_mesh_file(fpath)
                    meshes.append(mesh)
                except Exception as e:
                    meshes.append(
                        ParsedMesh(
                            file_path=os.path.abspath(fpath),
                            file_name=fname,
                            vertices=[],
                            faces=[],
                            parse_warnings=[
                                {
                                    "line": 0,
                                    "type": "parse_error",
                                    "content": "",
                                    "message": f"文件解析失败: {str(e)}",
                                }
                            ],
                        )
                    )
    return meshes
