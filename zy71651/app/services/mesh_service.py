import os
import hashlib
import time
from typing import Optional, Dict, Any, List, Tuple
from pathlib import Path
from sqlalchemy.orm import Session

import trimesh
import numpy as np

from ..models import (
    ModelFile,
    MeshAnalysisResult,
    EstimationTask,
    TaskStatus,
    FileType,
)
from ..schemas import (
    MeshAnalysisResponse,
    MeshAnalysisRequest,
    ModelFileUploadResponse,
    MeshQualityIssue,
    OverhangDetail,
)
from ..config import settings
from .status_service import StatusService
from .anomaly_service import AnomalyService
from ..models.enums import AnomalyType, AnomalySeverity


class MeshService:
    @staticmethod
    def _calculate_md5(file_path: str) -> str:
        md5_hash = hashlib.md5()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                md5_hash.update(chunk)
        return md5_hash.hexdigest()

    @staticmethod
    def _detect_file_type(file_name: str) -> str:
        ext = Path(file_name).suffix.lower().lstrip(".")
        if ext in [ft.value for ft in FileType]:
            return ext
        return FileType.STL.value

    @staticmethod
    async def upload_model_file(
        db: Session,
        task: EstimationTask,
        file_content: bytes,
        file_name: str,
        uploaded_by: Optional[str] = None,
    ) -> ModelFile:
        task_id = task.id
        file_type = MeshService._detect_file_type(file_name)

        save_dir = settings.upload_dir / str(task_id)
        save_dir.mkdir(parents=True, exist_ok=True)

        save_path = save_dir / f"{int(time.time())}_{file_name}"
        with open(save_path, "wb") as f:
            f.write(file_content)

        md5_hash = MeshService._calculate_md5(str(save_path))
        file_size = len(file_content)

        model_file = ModelFile(
            task_id=task_id,
            file_name=file_name,
            file_path=str(save_path),
            file_type=file_type,
            file_size=file_size,
            md5_hash=md5_hash,
            uploaded_by=uploaded_by,
            is_processed=False,
        )
        db.add(model_file)
        db.flush()

        try:
            mesh = trimesh.load(str(save_path))
            if isinstance(mesh, trimesh.Scene):
                mesh = mesh.to_mesh()

            model_file.vertex_count = len(mesh.vertices)
            model_file.face_count = len(mesh.faces)
            model_file.bounding_box_x = float(mesh.extents[0])
            model_file.bounding_box_y = float(mesh.extents[1])
            model_file.bounding_box_z = float(mesh.extents[2])
            model_file.volume = float(mesh.volume) if mesh.is_watertight else float(mesh.convex_hull.volume)
            model_file.surface_area = float(mesh.area)
            model_file.is_processed = True
            model_file.processing_notes = "模型信息提取成功"
        except Exception as e:
            model_file.processing_notes = f"模型信息提取失败: {str(e)}"
            AnomalyService.create_anomaly(
                db=db,
                task_id=task_id,
                anomaly_type=AnomalyType.MODEL_CORRUPTED,
                severity=AnomalySeverity.CRITICAL,
                data_source=f"mesh_service:upload:{file_name}",
                metadata={"error": str(e)},
            )

        db.flush()

        StatusService.transition(
            db=db,
            task=task,
            target_status=TaskStatus.MODEL_UPLOADED.value,
            message=f"模型文件 {file_name} 已上传",
            triggered_by="mesh_service",
            metadata={
                "file_name": file_name,
                "file_size": file_size,
                "md5": md5_hash,
            },
        )

        return model_file

    @staticmethod
    def analyze_mesh(
        db: Session,
        task: EstimationTask,
        request: MeshAnalysisRequest,
    ) -> Tuple[MeshAnalysisResult, MeshAnalysisResponse]:
        start_time = time.time()

        StatusService.transition(
            db=db,
            task=task,
            target_status=TaskStatus.ANALYZING.value,
            message="开始网格分析",
            triggered_by="mesh_service",
        )

        if request.model_file_id:
            model_file = db.query(ModelFile).filter(ModelFile.id == request.model_file_id).first()
        else:
            model_file = (
                db.query(ModelFile)
                .filter(ModelFile.task_id == request.task_id)
                .order_by(ModelFile.created_at.desc())
                .first()
            )

        if not model_file:
            raise ValueError("未找到模型文件，请先上传模型")

        params_version = request.params_version or task.current_params_version or 1
        min_support_angle = request.min_support_angle or 45.0

        quality_issues: List[MeshQualityIssue] = []
        overhang_details: List[OverhangDetail] = []

        try:
            mesh = trimesh.load(model_file.file_path)
            if isinstance(mesh, trimesh.Scene):
                mesh = mesh.to_mesh()

            is_watertight = bool(mesh.is_watertight)
            is_manifold = bool(mesh.is_watertight)

            broken_faces = 0
            non_manifold_edges = 0
            self_intersections = 0
            duplicate_faces = 0
            inverted_normals = 0

            if not is_watertight:
                broken_faces = len(mesh.faces) - len(mesh.unique_faces())
                if broken_faces > 0:
                    quality_issues.append(MeshQualityIssue(
                        issue_type="broken_faces",
                        count=broken_faces,
                        severity=AnomalySeverity.ERROR.value,
                        description=f"检测到 {broken_faces} 个破损面，模型不封闭",
                        suggestion="使用建模软件修复破面，确保模型是闭合实体",
                    ))
                    AnomalyService.create_anomaly(
                        db=db,
                        task_id=task.id,
                        anomaly_type=AnomalyType.MESH_BROKEN_FACES,
                        severity=AnomalySeverity.ERROR,
                        format_params={"count": broken_faces},
                        data_source="mesh_service:analyze",
                        params_version=params_version,
                    )

            try:
                non_manifold = trimesh.smoothing.get_non_manifold(mesh) if hasattr(trimesh.smoothing, 'get_non_manifold') else []
                non_manifold_edges = len(non_manifold) if hasattr(non_manifold, '__len__') else 0
            except:
                non_manifold_edges = 0

            if non_manifold_edges > 0:
                quality_issues.append(MeshQualityIssue(
                    issue_type="non_manifold",
                    count=non_manifold_edges,
                    severity=AnomalySeverity.ERROR.value,
                    description=f"检测到 {non_manifold_edges} 条非流形边",
                    suggestion="合并重复顶点，删除内部面",
                ))
                AnomalyService.create_anomaly(
                    db=db,
                    task_id=task.id,
                    anomaly_type=AnomalyType.MESH_NON_MANIFOLD,
                    severity=AnomalySeverity.ERROR,
                    format_params={"count": non_manifold_edges},
                    data_source="mesh_service:analyze",
                    params_version=params_version,
                )

            unique_faces, unique_indices = np.unique(mesh.faces, axis=0, return_index=True)
            duplicate_faces = len(mesh.faces) - len(unique_faces)
            if duplicate_faces > 0:
                quality_issues.append(MeshQualityIssue(
                    issue_type="duplicate_faces",
                    count=duplicate_faces,
                    severity=AnomalySeverity.WARNING.value,
                    description=f"检测到 {duplicate_faces} 个重复面",
                    suggestion="使用去除重复面功能清理模型",
                ))
                AnomalyService.create_anomaly(
                    db=db,
                    task_id=task.id,
                    anomaly_type=AnomalyType.MESH_DUPLICATE_FACES,
                    severity=AnomalySeverity.WARNING,
                    format_params={"count": duplicate_faces},
                    data_source="mesh_service:analyze",
                    params_version=params_version,
                )

            face_normals = mesh.face_normals
            up_vector = np.array([0, 0, 1])
            angles = np.degrees(np.arccos(np.clip(np.dot(face_normals, -up_vector), -1.0, 1.0)))
            overhang_mask = angles > min_support_angle

            overhang_faces = mesh.faces[overhang_mask]
            overhang_areas = mesh.area_faces[overhang_mask]
            overhang_area = float(np.sum(overhang_areas))
            overhang_count = int(np.sum(overhang_mask))

            if overhang_area > 100:
                quality_issues.append(MeshQualityIssue(
                    issue_type="large_overhang",
                    count=overhang_count,
                    severity=AnomalySeverity.WARNING.value,
                    description=f"检测到 {overhang_count} 个悬垂面，总面积 {overhang_area:.1f} mm²",
                    suggestion=f"考虑减小支撑临界角（当前 {min_support_angle}°）或增加支撑",
                ))
                if overhang_area > 500:
                    AnomalyService.create_anomaly(
                        db=db,
                        task_id=task.id,
                        anomaly_type=AnomalyType.SUPPORT_INSUFFICIENT,
                        severity=AnomalySeverity.WARNING,
                        format_params={"area": overhang_area},
                        data_source="mesh_service:analyze",
                        params_version=params_version,
                    )

            for i in range(min(5, overhang_count)):
                face_idx = np.where(overhang_mask)[0][i]
                face_center = np.mean(mesh.vertices[mesh.faces[face_idx]], axis=0)
                overhang_details.append(OverhangDetail(
                    area=float(mesh.area_faces[face_idx]),
                    angle=float(angles[face_idx]),
                    height=float(face_center[2]),
                    location=f"({face_center[0]:.1f}, {face_center[1]:.1f}, {face_center[2]:.1f})",
                ))

            total_volume = float(mesh.volume) if is_watertight else float(mesh.convex_hull.volume)
            part_volume = float(mesh.volume) if is_watertight else float(mesh.convex_hull.volume)
            bounding_box_volume = float(np.prod(mesh.extents))

            support_volume = 0.0
            support_contact_area = 0.0
            support_material_volume = 0.0
            max_support_height = 0.0

            if overhang_count > 0:
                overhang_height = mesh.extents[2] - np.min(mesh.vertices[:, 2])
                max_support_height = float(overhang_height)
                support_volume = overhang_area * 0.5
                support_contact_area = overhang_area * 0.1
                support_material_volume = support_volume * 0.15

            quality_score = 100.0
            quality_score -= min(broken_faces * 5, 30)
            quality_score -= min(non_manifold_edges * 3, 20)
            quality_score -= min(duplicate_faces * 0.5, 10)
            quality_score -= min(overhang_area / 100, 20)
            quality_score = max(0.0, min(100.0, quality_score))

            processing_time_ms = int((time.time() - start_time) * 1000)

            analysis_details = {
                "mesh_info": {
                    "vertices": model_file.vertex_count,
                    "faces": model_file.face_count,
                    "watertight": is_watertight,
                    "manifold": is_manifold,
                },
                "bounding_box": {
                    "x": float(mesh.extents[0]),
                    "y": float(mesh.extents[1]),
                    "z": float(mesh.extents[2]),
                },
                "support_analysis": {
                    "min_support_angle": min_support_angle,
                    "overhang_faces": overhang_count,
                    "overhang_area": overhang_area,
                    "avg_overhang_angle": float(np.mean(angles[overhang_mask])) if overhang_count > 0 else 0,
                },
                "quality_checks": {
                    "broken_faces": broken_faces,
                    "non_manifold_edges": non_manifold_edges,
                    "self_intersections": self_intersections,
                    "duplicate_faces": duplicate_faces,
                    "inverted_normals": inverted_normals,
                },
            }

            result = MeshAnalysisResult(
                task_id=request.task_id,
                model_file_id=model_file.id,
                params_version=params_version,
                is_watertight=is_watertight,
                is_manifold=is_manifold,
                broken_face_count=broken_faces,
                non_manifold_edges=non_manifold_edges,
                self_intersections=self_intersections,
                duplicate_faces=duplicate_faces,
                inverted_normals=inverted_normals,
                overhang_area=overhang_area,
                overhang_count=overhang_count,
                min_support_angle=min_support_angle,
                max_support_height=max_support_height,
                support_volume=support_volume,
                support_contact_area=support_contact_area,
                support_material_volume=support_material_volume,
                total_volume=total_volume,
                part_volume=part_volume,
                bounding_box_volume=bounding_box_volume,
                quality_score=quality_score,
                processing_time_ms=processing_time_ms,
                analysis_details=analysis_details,
                notes="网格分析完成",
            )
            db.add(result)
            db.flush()

            StatusService.transition(
                db=db,
                task=task,
                target_status=TaskStatus.ANALYZED.value,
                message=f"网格分析完成，质量评分 {quality_score:.1f}",
                triggered_by="mesh_service",
                metadata={
                    "quality_score": quality_score,
                    "processing_time_ms": processing_time_ms,
                    "issues_count": len(quality_issues),
                },
            )

            response = MeshAnalysisResponse(
                id=result.id,
                task_id=result.task_id,
                model_file_id=result.model_file_id,
                params_version=result.params_version,
                is_watertight=result.is_watertight,
                is_manifold=result.is_manifold,
                broken_face_count=result.broken_face_count,
                non_manifold_edges=result.non_manifold_edges,
                self_intersections=result.self_intersections,
                duplicate_faces=result.duplicate_faces,
                inverted_normals=result.inverted_normals,
                overhang_area=result.overhang_area,
                overhang_count=result.overhang_count,
                min_support_angle=result.min_support_angle,
                max_support_height=result.max_support_height,
                support_volume=result.support_volume,
                support_contact_area=result.support_contact_area,
                support_material_volume=result.support_material_volume,
                total_volume=result.total_volume,
                part_volume=result.part_volume,
                bounding_box_volume=result.bounding_box_volume,
                quality_score=result.quality_score,
                processing_time_ms=result.processing_time_ms,
                quality_issues=quality_issues,
                overhang_details=overhang_details,
                analysis_details=analysis_details,
                notes=result.notes,
                created_at=result.created_at,
                updated_at=result.updated_at,
            )

            return result, response

        except Exception as e:
            StatusService.transition(
                db=db,
                task=task,
                target_status=TaskStatus.FAILED.value,
                message=f"网格分析失败: {str(e)}",
                triggered_by="mesh_service",
                force=True,
            )
            raise

    @staticmethod
    def to_upload_response(model_file: ModelFile) -> ModelFileUploadResponse:
        return ModelFileUploadResponse(
            id=model_file.id,
            task_id=model_file.task_id,
            file_name=model_file.file_name,
            file_type=model_file.file_type,
            file_size=model_file.file_size,
            vertex_count=model_file.vertex_count,
            face_count=model_file.face_count,
            bounding_box_x=model_file.bounding_box_x,
            bounding_box_y=model_file.bounding_box_y,
            bounding_box_z=model_file.bounding_box_z,
            volume=model_file.volume,
            surface_area=model_file.surface_area,
            md5_hash=model_file.md5_hash,
            is_processed=model_file.is_processed,
            processing_notes=model_file.processing_notes,
            created_at=model_file.created_at,
            updated_at=model_file.updated_at,
        )
