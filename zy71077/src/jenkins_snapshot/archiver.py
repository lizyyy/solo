import hashlib
import json
import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from .models import (
    BuildRecord,
    Parameter,
    Artifact,
    SnapshotValidationResult,
    SnapshotMetadata,
    SnapshotReport,
)


class ParameterArchiver:
    def __init__(self, output_dir: str = "./snapshots"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def _get_snapshot_id(self, record: BuildRecord) -> str:
        content = f"{record.job_name}-{record.build_number}-{record.timestamp.isoformat()}"
        return hashlib.sha256(content.encode()).hexdigest()[:16]

    def _get_build_dir(self, job_name: str, build_number: int) -> Path:
        job_safe = job_name.replace('/', '_').replace(' ', '_')
        return self.output_dir / job_safe / f"build_{build_number}"

    def archive_build(
        self,
        record: BuildRecord,
        validation: SnapshotValidationResult,
        source_file: Optional[str] = None,
        overwrite: bool = False,
        copy_artifacts: bool = False,
        artifact_base_dir: Optional[str] = None,
    ) -> Tuple[SnapshotReport, bool, List[str]]:
        build_dir = self._get_build_dir(record.job_name, record.build_number)
        snapshot_id = self._get_snapshot_id(record)
        
        existed = build_dir.exists()
        messages: List[str] = []
        
        if existed and not overwrite:
            messages.append("⚠️  输出已存在，跳过归档操作")
            messages.append(f"📂 已存在快照目录: {build_dir}")
            messages.append(f"💡 如需覆盖现有快照，请使用: --overwrite")
            messages.append(f"💡 如需创建重跑变体，请使用: --rerun-suffix <后缀名>")
            existing_report = self._load_existing_report(build_dir)
            if existing_report:
                return existing_report, False, messages
            raise FileExistsError(f"Build {record.build_number} already archived. Use --overwrite or --rerun-suffix")

        build_dir.mkdir(parents=True, exist_ok=True)
        
        if existed and overwrite:
            messages.append(f"Overwriting existing snapshot for build {record.build_number}")

        params_file = build_dir / "parameters.json"
        with open(params_file, 'w', encoding='utf-8') as f:
            json.dump(
                [p.model_dump() for p in record.parameters],
                f,
                indent=2,
                ensure_ascii=False,
                default=str
            )
        messages.append(f"Parameters archived: {params_file}")

        artifacts_dir = build_dir / "artifacts"
        if copy_artifacts and record.artifacts:
            artifacts_dir.mkdir(exist_ok=True)
            for artifact in record.artifacts:
                if artifact.exists:
                    src_path = artifact.path
                    if artifact_base_dir:
                        src_path = os.path.join(artifact_base_dir, artifact.path)
                    if os.path.exists(src_path):
                        dst_path = artifacts_dir / artifact.name
                        shutil.copy2(src_path, dst_path)
                        artifact.path = f"artifacts/{artifact.name}"
                        messages.append(f"Artifact copied: {artifact.name}")

        artifacts_file = build_dir / "artifacts.json"
        with open(artifacts_file, 'w', encoding='utf-8') as f:
            json.dump(
                [a.model_dump() for a in record.artifacts],
                f,
                indent=2,
                ensure_ascii=False
            )
        messages.append(f"Artifact manifest saved: {artifacts_file}")

        build_info_file = build_dir / "build_info.json"
        build_info = {
            "job_name": record.job_name,
            "build_number": record.build_number,
            "status": record.status,
            "timestamp": record.timestamp.isoformat(),
            "duration_ms": record.duration_ms,
            "triggered_by": record.triggered_by,
            "git_info": record.git_info.model_dump() if record.git_info else None,
            "url": record.url,
            "description": record.description,
            "is_rerun": record.is_rerun,
            "rerun_of": record.rerun_of,
        }
        with open(build_info_file, 'w', encoding='utf-8') as f:
            json.dump(build_info, f, indent=2, ensure_ascii=False)
        messages.append(f"Build info saved: {build_info_file}")

        if source_file:
            source_copy = build_dir / "source_input.json"
            shutil.copy2(source_file, source_copy)
            messages.append(f"Source input preserved: {source_copy}")

        metadata = SnapshotMetadata(
            snapshot_id=snapshot_id,
            created_at=datetime.now(),
            tool_version="1.0.0",
            input_source=source_file or "direct_input",
            output_format="json",
        )

        report = SnapshotReport(
            metadata=metadata,
            build=record,
            validation=validation,
            notes=messages,
        )

        report_file = build_dir / "snapshot_report.json"
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(
                report.model_dump(),
                f,
                indent=2,
                ensure_ascii=False,
                default=str
            )
        messages.append(f"Snapshot report saved: {report_file}")

        return report, True, messages

    def archive_rerun(
        self,
        record: BuildRecord,
        validation: SnapshotValidationResult,
        source_file: Optional[str] = None,
        suffix: Optional[str] = None,
        overwrite: bool = False,
        copy_artifacts: bool = False,
        artifact_base_dir: Optional[str] = None,
    ) -> Tuple[SnapshotReport, bool, List[str]]:
        if not suffix:
            suffix = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        build_dir = self._get_build_dir(record.job_name, record.build_number)
        rerun_dir = build_dir / f"rerun_{suffix}"
        
        existed = rerun_dir.exists()
        messages: List[str] = []
        
        if existed and not overwrite:
            messages.append("⚠️  重跑快照已存在，跳过归档操作")
            messages.append(f"📂 已存在重跑快照目录: {rerun_dir}")
            messages.append(f"💡 如需覆盖现有重跑快照，请使用: --overwrite")
            messages.append(f"💡 如需创建新的重跑变体，请使用不同的: --rerun-suffix <新后缀名>")
            existing_report = self._load_existing_report(rerun_dir)
            if existing_report:
                return existing_report, False, messages
            raise FileExistsError(f"Rerun snapshot with suffix '{suffix}' already exists. Use --overwrite to force update or use a different --rerun-suffix")

        rerun_dir.mkdir(parents=True, exist_ok=True)
        
        if existed and overwrite:
            messages.append(f"Overwriting existing rerun snapshot with suffix: {suffix}")
        else:
            messages.append(f"Creating rerun snapshot with suffix: {suffix}")
        
        original_report = self._load_existing_report(build_dir)
        if original_report:
            messages.append(f"Original snapshot found, this is a rerun variant")
            record.is_rerun = True
            if original_report.build:
                record.rerun_of = original_report.build.build_number

        params_file = rerun_dir / "parameters.json"
        with open(params_file, 'w', encoding='utf-8') as f:
            json.dump(
                [p.model_dump() for p in record.parameters],
                f,
                indent=2,
                ensure_ascii=False,
                default=str
            )

        artifacts_dir = rerun_dir / "artifacts"
        if copy_artifacts and record.artifacts:
            artifacts_dir.mkdir(exist_ok=True)
            for artifact in record.artifacts:
                if artifact.exists:
                    src_path = artifact.path
                    if artifact_base_dir:
                        src_path = os.path.join(artifact_base_dir, artifact.path)
                    if os.path.exists(src_path):
                        dst_path = artifacts_dir / artifact.name
                        shutil.copy2(src_path, dst_path)
                        artifact.path = f"rerun_{suffix}/artifacts/{artifact.name}"

        snapshot_id = hashlib.sha256(
            f"{record.job_name}-{record.build_number}-{suffix}".encode()
        ).hexdigest()[:16]

        metadata = SnapshotMetadata(
            snapshot_id=snapshot_id,
            created_at=datetime.now(),
            tool_version="1.0.0",
            input_source=source_file or "direct_input",
            output_format="json",
        )

        report = SnapshotReport(
            metadata=metadata,
            build=record,
            validation=validation,
            notes=messages.copy(),
        )

        report_file = rerun_dir / "snapshot_report.json"
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(
                report.model_dump(),
                f,
                indent=2,
                ensure_ascii=False,
                default=str
            )
        
        messages.append(f"Rerun snapshot saved: {report_file}")
        report.notes.append(f"Rerun snapshot saved: {report_file}")
        return report, True, messages

    def _load_existing_report(self, build_dir: Path) -> Optional[SnapshotReport]:
        report_file = build_dir / "snapshot_report.json"
        if report_file.exists():
            try:
                with open(report_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                from .models import SnapshotReport
                return SnapshotReport.model_validate(data)
            except Exception:
                return None
        return None

    def list_snapshots(self, job_name: Optional[str] = None) -> List[Dict[str, str]]:
        snapshots = []
        
        if job_name:
            job_dir = self.output_dir / job_name.replace('/', '_').replace(' ', '_')
            search_dirs = [job_dir] if job_dir.exists() else []
        else:
            search_dirs = [d for d in self.output_dir.iterdir() if d.is_dir()]

        for job_dir in search_dirs:
            for build_dir in job_dir.iterdir():
                if build_dir.name.startswith("build_") and build_dir.is_dir():
                    report = self._load_existing_report(build_dir)
                    if report:
                        snapshots.append({
                            "job_name": report.build.job_name,
                            "build_number": str(report.build.build_number),
                            "status": report.build.status,
                            "snapshot_id": report.metadata.snapshot_id,
                            "created_at": report.metadata.created_at.isoformat(),
                            "path": str(build_dir),
                        })
                    rerun_dirs = [d for d in build_dir.iterdir() if d.name.startswith("rerun_") and d.is_dir()]
                    for rerun_dir in rerun_dirs:
                        rerun_report = self._load_existing_report(rerun_dir)
                        if rerun_report:
                            snapshots.append({
                                "job_name": rerun_report.build.job_name,
                                "build_number": f"{rerun_report.build.build_number}",
                                "rerun_suffix": rerun_dir.name.replace("rerun_", ""),
                                "status": rerun_report.build.status,
                                "snapshot_id": rerun_report.metadata.snapshot_id,
                                "created_at": rerun_report.metadata.created_at.isoformat(),
                                "path": str(rerun_dir),
                            })
        return snapshots

    def load_snapshot(
        self,
        job_name: str,
        build_number: int,
        rerun_suffix: Optional[str] = None,
    ) -> Optional[SnapshotReport]:
        build_dir = self._get_build_dir(job_name, build_number)
        if rerun_suffix:
            build_dir = build_dir / f"rerun_{rerun_suffix}"
        return self._load_existing_report(build_dir)
