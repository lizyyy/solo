from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from .area import AreaResult
from .audit import AuditLog
from .parser import ParsedMesh
from .topology import TopologyResult


@dataclass
class MeshFileReport:
    file_path: str
    file_name: str
    mesh: ParsedMesh
    topology: TopologyResult
    area: AreaResult

    @property
    def has_any_issue(self) -> bool:
        return (
            self.topology.has_holes
            or self.topology.has_inverted_normals
            or len(self.area.anomaly_issues) > 0
            or len(self.mesh.parse_warnings) > 0
        )

    @property
    def issue_types(self) -> List[str]:
        types: List[str] = []
        if self.mesh.parse_warnings:
            types.append("parse_warning")
        if self.topology.has_holes:
            types.append("hole")
        if self.topology.has_inverted_normals:
            types.append("inverted_normal")
        if self.area.anomaly_issues:
            types.append("area_anomaly")
        return types

    def to_dict(self) -> dict:
        return {
            "file_path": self.file_path,
            "file_name": self.file_name,
            "has_any_issue": self.has_any_issue,
            "issue_types": self.issue_types,
            "mesh_summary": {
                "vertex_count": len(self.mesh.vertices),
                "face_count": len(self.mesh.faces),
                "parse_warning_count": len(self.mesh.parse_warnings),
            },
            "topology": self.topology.to_dict(),
            "area": self.area.to_dict(),
        }


@dataclass
class BatchReport:
    generated_at: str
    total_files: int
    clean_files: int
    problem_files: int
    files: List[MeshFileReport]
    audit_log: Optional[AuditLog] = None

    @property
    def clean_file_reports(self) -> List[MeshFileReport]:
        return [f for f in self.files if not f.has_any_issue]

    @property
    def problem_file_reports(self) -> List[MeshFileReport]:
        return [f for f in self.files if f.has_any_issue]

    def to_dict(self) -> dict:
        clean = [f.to_dict() for f in self.clean_file_reports]
        problems = [f.to_dict() for f in self.problem_file_reports]
        all_files = [f.to_dict() for f in self.files]

        summary = {
            "total_files": self.total_files,
            "clean_files": self.clean_files,
            "problem_files": self.problem_files,
            "issue_breakdown": {
                "parse_warning": sum(
                    1 for f in self.files if f.mesh.parse_warnings
                ),
                "hole": sum(
                    1 for f in self.files if f.topology.has_holes
                ),
                "inverted_normal": sum(
                    1 for f in self.files if f.topology.has_inverted_normals
                ),
                "area_anomaly": sum(
                    1 for f in self.files if f.area.anomaly_issues
                ),
            },
        }

        result: Dict[str, Any] = {
            "report_version": "1.0",
            "tool_name": "三角网格面积清洗",
            "generated_at": self.generated_at,
            "summary": summary,
            "clean_files": clean,
            "problem_files": problems,
            "all_files": all_files,
        }

        if self.audit_log and self.audit_log.entries:
            result["audit_trail"] = self.audit_log.to_dict_list()

        return result

    def save(self, output_path: str) -> str:
        os.makedirs(
            os.path.dirname(output_path) if os.path.dirname(output_path) else ".",
            exist_ok=True,
        )
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, ensure_ascii=False, indent=2)
        return output_path

    def print_summary(self) -> str:
        lines: List[str] = []
        lines.append("=" * 60)
        lines.append("三角网格面积清洗 — 批量检查报告")
        lines.append(f"生成时间: {self.generated_at}")
        lines.append("=" * 60)
        lines.append("")
        lines.append(f"总文件数: {self.total_files}")
        lines.append(f"正常文件: {self.clean_files}")
        lines.append(f"问题文件: {self.problem_files}")
        lines.append("")

        breakdown = {
            "parse_warning": sum(
                1 for f in self.files if f.mesh.parse_warnings
            ),
            "hole": sum(1 for f in self.files if f.topology.has_holes),
            "inverted_normal": sum(
                1 for f in self.files if f.topology.has_inverted_normals
            ),
            "area_anomaly": sum(
                1 for f in self.files if f.area.anomaly_issues
            ),
        }
        lines.append("问题类型分布:")
        for issue_type, count in breakdown.items():
            label = {
                "parse_warning": "解析警告",
                "hole": "孔洞",
                "inverted_normal": "反法线",
                "area_anomaly": "面积异常",
            }.get(issue_type, issue_type)
            lines.append(f"  {label}: {count} 个文件")
        lines.append("")

        if self.problem_file_reports:
            lines.append("-" * 60)
            lines.append("【问题文件详情】")
            lines.append("-" * 60)
            for report in self.problem_file_reports:
                lines.append("")
                lines.append(f"  文件: {report.file_name}")
                lines.append(f"  路径: {report.file_path}")
                lines.append(f"  顶点数: {len(report.mesh.vertices)}")
                lines.append(f"  面片数: {len(report.mesh.faces)}")
                lines.append(f"  问题类型: {', '.join(report.issue_types)}")

                if report.topology.has_holes:
                    for hole in report.topology.hole_issues:
                        lines.append(f"    [孔洞] {hole.description}")
                        lines.append(
                            f"           边界边数: {len(hole.boundary_edges)}"
                        )
                        lines.append(
                            f"           涉及面片: {hole.face_indices_involved[:10]}{'...' if len(hole.face_indices_involved) > 10 else ''}"
                        )

                if report.topology.has_inverted_normals:
                    for inv in report.topology.inverted_normal_issues:
                        lines.append(
                            f"    [反法线] {inv.description}"
                        )
                        lines.append(
                            f"             面片索引: {inv.face_index}, 源文件行: {inv.source_line}"
                        )
                        lines.append(
                            f"             点积值: {inv.dot_product:.4f}"
                        )

                if report.area.anomaly_issues:
                    for anom in report.area.anomaly_issues:
                        lines.append(
                            f"    [面积异常] {anom.description}"
                        )
                        lines.append(
                            f"               面片索引: {anom.face_index}, 源文件行: {anom.source_line}"
                        )
                        lines.append(
                            f"               面积: {anom.area:.6e}, Z-score: {anom.z_score:.2f}"
                        )

                if report.mesh.parse_warnings:
                    for pw in report.mesh.parse_warnings[:5]:
                        lines.append(
                            f"    [解析警告] 行{pw['line']}: {pw['message']}"
                        )
                    if len(report.mesh.parse_warnings) > 5:
                        lines.append(
                            f"    ... 还有 {len(report.mesh.parse_warnings) - 5} 条解析警告"
                        )

        if self.clean_file_reports:
            lines.append("")
            lines.append("-" * 60)
            lines.append("【正常文件列表】")
            lines.append("-" * 60)
            for report in self.clean_file_reports:
                area_stats = report.area.statistics
                lines.append(
                    f"  {report.file_name}  "
                    f"顶点={len(report.mesh.vertices)}  "
                    f"面片={len(report.mesh.faces)}  "
                    f"总面积={area_stats.total_area:.6e}{report.area.area_unit}  "
                    f"平均面积={area_stats.mean_area:.6e}{report.area.area_unit}"
                )

        if self.audit_log and self.audit_log.entries:
            lines.append("")
            lines.append("-" * 60)
            lines.append("【修正记录】")
            lines.append("-" * 60)
            for entry in self.audit_log.entries:
                lines.append(
                    f"  [{entry.timestamp}] {entry.operator}/{entry.action}"
                )
                lines.append(f"    文件: {entry.file_name}")
                lines.append(f"    对象: {entry.target_type} {entry.target_identifier}")
                lines.append(f"    旧值: {entry.old_value}")
                lines.append(f"    新值: {entry.new_value}")
                lines.append(f"    理由: {entry.reason}")

        lines.append("")
        lines.append("=" * 60)
        return "\n".join(lines)


def build_batch_report(
    meshes: List[ParsedMesh],
    topology_results: List[TopologyResult],
    area_results: List[AreaResult],
    audit_log: Optional[AuditLog] = None,
) -> BatchReport:
    file_reports: List[MeshFileReport] = []
    for mesh, topo, area in zip(meshes, topology_results, area_results):
        file_reports.append(
            MeshFileReport(
                file_path=mesh.file_path,
                file_name=mesh.file_name,
                mesh=mesh,
                topology=topo,
                area=area,
            )
        )

    clean_count = sum(1 for f in file_reports if not f.has_any_issue)
    problem_count = sum(1 for f in file_reports if f.has_any_issue)

    return BatchReport(
        generated_at=datetime.now(timezone.utc).isoformat(),
        total_files=len(file_reports),
        clean_files=clean_count,
        problem_files=problem_count,
        files=file_reports,
        audit_log=audit_log,
    )
