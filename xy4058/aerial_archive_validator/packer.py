from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set
import shutil
import json
import uuid

from .config import (
    MaterialMetadata,
    ProjectConfig,
    CheckReport,
    MaterialType,
)
from .exceptions import PackingError


class MaterialCopyResult:
    def __init__(
        self,
        source_path: Path,
        dest_path: Path,
        success: bool,
        error_message: Optional[str] = None,
    ) -> None:
        self.source_path = source_path
        self.dest_path = dest_path
        self.success = success
        self.error_message = error_message


class PackResult:
    def __init__(self) -> None:
        self.total_files: int = 0
        self.copied_files: int = 0
        self.skipped_files: int = 0
        self.failed_files: int = 0
        self.results: List[MaterialCopyResult] = []
        self.manifest_path: Optional[Path] = None
        self.output_directory: Optional[Path] = None

    def add_result(self, result: MaterialCopyResult) -> None:
        self.results.append(result)
        self.total_files += 1
        if result.success:
            self.copied_files += 1
        elif result.error_message and "skipped" in result.error_message.lower():
            self.skipped_files += 1
        else:
            self.failed_files += 1


class MaterialPacker:
    def __init__(
        self,
        config: ProjectConfig,
        check_report: CheckReport,
        output_directory: Path,
    ) -> None:
        self.config = config
        self.check_report = check_report
        self.output_directory = output_directory
        self.output_directory.mkdir(parents=True, exist_ok=True)

        self._valid_file_paths: Set[str] = self._extract_valid_files()

    def _extract_valid_files(self) -> Set[str]:
        valid_paths: Set[str] = set()

        material_validity: Dict[str, bool] = {}

        for result in self.check_report.validation_results:
            file_path = result.material_metadata.file_path
            if file_path not in material_validity:
                material_validity[file_path] = True

            if not result.is_valid and result.severity == "error":
                material_validity[file_path] = False

        for file_path, is_valid in material_validity.items():
            if is_valid:
                valid_paths.add(file_path)

        return valid_paths

    def is_valid_for_packing(self, material: MaterialMetadata) -> bool:
        return material.file_path in self._valid_file_paths

    def _get_destination_path(
        self,
        material: MaterialMetadata,
        base_dir: Path,
    ) -> Path:
        material_type = material.material_type

        type_subdir = ""
        if material_type == MaterialType.PHOTO:
            type_subdir = "photos"
        elif material_type == MaterialType.VIDEO:
            type_subdir = "videos"
        else:
            type_subdir = "other"

        if material.flight_line is not None:
            flight_dir = f"flight_line_{material.flight_line:03d}"
            subdir = base_dir / type_subdir / flight_dir
        else:
            subdir = base_dir / type_subdir

        subdir.mkdir(parents=True, exist_ok=True)

        dest_path = subdir / material.file_name

        counter = 1
        while dest_path.exists():
            name_parts = material.file_name.rsplit(".", 1)
            if len(name_parts) == 2:
                stem, suffix = name_parts
                dest_path = subdir / f"{stem}_{counter:03d}.{suffix}"
            else:
                dest_path = subdir / f"{material.file_name}_{counter:03d}"
            counter += 1

        return dest_path

    def copy_material(
        self,
        material: MaterialMetadata,
        overwrite: bool = False,
    ) -> MaterialCopyResult:
        source_path = Path(material.file_path)

        if not source_path.exists():
            return MaterialCopyResult(
                source_path=source_path,
                dest_path=Path(""),
                success=False,
                error_message=f"源文件不存在: {source_path}",
            )

        if not self.is_valid_for_packing(material):
            return MaterialCopyResult(
                source_path=source_path,
                dest_path=Path(""),
                success=False,
                error_message="素材未通过校验，跳过打包",
            )

        dest_path = self._get_destination_path(material, self.output_directory)

        if dest_path.exists() and not overwrite:
            return MaterialCopyResult(
                source_path=source_path,
                dest_path=dest_path,
                success=False,
                error_message="目标文件已存在，跳过（设置overwrite=True可覆盖）",
            )

        try:
            shutil.copy2(str(source_path), str(dest_path))
            return MaterialCopyResult(
                source_path=source_path,
                dest_path=dest_path,
                success=True,
            )
        except Exception as e:
            return MaterialCopyResult(
                source_path=source_path,
                dest_path=dest_path,
                success=False,
                error_message=f"复制文件失败: {e}",
            )

    def pack_all(
        self,
        materials: List[MaterialMetadata],
        overwrite: bool = False,
    ) -> PackResult:
        result = PackResult()
        result.output_directory = self.output_directory

        for material in materials:
            copy_result = self.copy_material(material, overwrite)
            result.add_result(copy_result)

        return result


class ManifestGenerator:
    @staticmethod
    def generate(
        pack_result: PackResult,
        check_report: CheckReport,
        project_config: ProjectConfig,
    ) -> Dict[str, Any]:
        manifest_id = str(uuid.uuid4())
        generated_at = datetime.now()

        file_list: List[Dict[str, Any]] = []

        for copy_result in pack_result.results:
            if copy_result.success:
                file_list.append({
                    "file_name": copy_result.dest_path.name,
                    "source_path": str(copy_result.source_path),
                    "dest_path": str(copy_result.dest_path),
                    "file_size": copy_result.dest_path.stat().st_size if copy_result.dest_path.exists() else 0,
                })

        validation_summary: Dict[str, Any] = {
            "total_materials": check_report.total_materials,
            "valid_materials": check_report.valid_materials,
            "invalid_materials": check_report.invalid_materials,
            "quarantined_materials": check_report.quarantined_materials,
            "stats_by_rule": {
                str(rule): stats
                for rule, stats in check_report.stats_by_rule.items()
            },
        }

        packing_summary: Dict[str, Any] = {
            "total_files": pack_result.total_files,
            "copied_files": pack_result.copied_files,
            "skipped_files": pack_result.skipped_files,
            "failed_files": pack_result.failed_files,
        }

        manifest: Dict[str, Any] = {
            "manifest_id": manifest_id,
            "generated_at": generated_at.isoformat(),
            "project": {
                "name": project_config.project_name,
                "id": project_config.project_id,
                "version": project_config.version,
                "created_at": project_config.created_at.isoformat() if project_config.created_at else None,
            },
            "validation_summary": validation_summary,
            "packing_summary": packing_summary,
            "delivered_files": file_list,
            "output_directory": str(pack_result.output_directory) if pack_result.output_directory else None,
            "check_report_id": check_report.report_id,
        }

        return manifest

    @staticmethod
    def save(manifest: Dict[str, Any], output_path: Path) -> None:
        try:
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(manifest, f, indent=2, ensure_ascii=False, default=str)
        except Exception as e:
            raise PackingError(f"保存Manifest文件失败: {e}")
