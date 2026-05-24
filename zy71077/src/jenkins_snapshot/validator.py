import hashlib
import os
from typing import Dict, List, Optional, Tuple

from .models import (
    BuildRecord,
    Artifact,
    Parameter,
    ParameterChange,
    SnapshotDiff,
    SnapshotValidationResult,
    ValidationError,
)


class ArtifactValidator:
    def __init__(self, base_dir: Optional[str] = None):
        self.base_dir = base_dir

    def calculate_sha256(self, file_path: str) -> Optional[str]:
        try:
            sha256_hash = hashlib.sha256()
            with open(file_path, "rb") as f:
                for byte_block in iter(lambda: f.read(4096), b""):
                    sha256_hash.update(byte_block)
            return sha256_hash.hexdigest()
        except Exception:
            return None

    def validate_artifact(
        self,
        artifact: Artifact,
        base_dir: Optional[str] = None,
        calculate_hash: bool = True,
    ) -> Tuple[bool, Optional[str]]:
        search_dir = base_dir or self.base_dir
        if search_dir:
            full_path = os.path.join(search_dir, artifact.path)
        else:
            full_path = artifact.path

        if not os.path.exists(full_path):
            artifact.exists = False
            artifact.missing_reason = "File not found"
            return False, "File not found"

        if not os.path.isfile(full_path):
            artifact.exists = False
            artifact.missing_reason = "Not a regular file"
            return False, "Not a regular file"

        artifact.exists = True
        artifact.size = os.path.getsize(full_path)

        if calculate_hash:
            artifact.sha256 = self.calculate_sha256(full_path)

        return True, None

    def validate_all_artifacts(
        self,
        record: BuildRecord,
        base_dir: Optional[str] = None,
        calculate_hash: bool = True,
    ) -> SnapshotValidationResult:
        errors: List[ValidationError] = []
        warnings: List[ValidationError] = []

        for artifact in record.artifacts:
            is_valid, reason = self.validate_artifact(artifact, base_dir, calculate_hash)
            if not is_valid:
                warnings.append(ValidationError(
                    field=f"artifacts.{artifact.name}",
                    message=f"Artifact validation failed: {reason}",
                    severity="warning"
                ))

        missing_count = sum(1 for a in record.artifacts if not a.exists)
        if missing_count > 0:
            warnings.append(ValidationError(
                field="artifacts",
                message=f"{missing_count} artifact(s) are missing",
                severity="warning"
            ))

        return SnapshotValidationResult(
            valid=missing_count == 0,
            errors=errors,
            warnings=warnings
        )

    def compare_artifact_lists(
        self,
        old_artifacts: List[Artifact],
        new_artifacts: List[Artifact],
    ) -> Dict[str, List[str]]:
        old_names = {a.name for a in old_artifacts}
        new_names = {a.name for a in new_artifacts}

        added = list(new_names - old_names)
        removed = list(old_names - new_names)
        modified = []

        for name in old_names & new_names:
            old_artifact = next(a for a in old_artifacts if a.name == name)
            new_artifact = next(a for a in new_artifacts if a.name == name)
            
            if old_artifact.sha256 and new_artifact.sha256:
                if old_artifact.sha256 != new_artifact.sha256:
                    modified.append(name)
            elif old_artifact.size and new_artifact.size:
                if old_artifact.size != new_artifact.size:
                    modified.append(name)

        return {
            "added": added,
            "removed": removed,
            "modified": modified,
        }


class DiffComparator:
    def compare_builds(
        self,
        old_build: BuildRecord,
        new_build: BuildRecord,
    ) -> SnapshotDiff:
        diff = SnapshotDiff(
            build_number_old=old_build.build_number,
            build_number_new=new_build.build_number,
        )

        if old_build.status != new_build.status:
            diff.status_changed = True
            diff.old_status = old_build.status
            diff.new_status = new_build.status

        diff.parameter_changes = self._compare_parameters(
            old_build.parameters,
            new_build.parameters
        )

        artifact_validator = ArtifactValidator()
        artifact_diff = artifact_validator.compare_artifact_lists(
            old_build.artifacts,
            new_build.artifacts
        )
        diff.artifacts_added = artifact_diff["added"]
        diff.artifacts_removed = artifact_diff["removed"]
        diff.artifacts_modified = artifact_diff["modified"]

        return diff

    def _compare_parameters(
        self,
        old_params: List[Parameter],
        new_params: List[Parameter],
    ) -> List[ParameterChange]:
        changes: List[ParameterChange] = []

        old_dict = {p.name: p for p in old_params}
        new_dict = {p.name: p for p in new_params}

        all_names = set(old_dict.keys()) | set(new_dict.keys())

        for name in all_names:
            old_param = old_dict.get(name)
            new_param = new_dict.get(name)

            if old_param is None:
                changes.append(ParameterChange(
                    name=name,
                    old_value=None,
                    new_value=new_param.value,
                    old_type=None,
                    new_type=new_param.type,
                    change_type="added"
                ))
            elif new_param is None:
                changes.append(ParameterChange(
                    name=name,
                    old_value=old_param.value,
                    new_value=None,
                    old_type=old_param.type,
                    new_type=None,
                    change_type="removed"
                ))
            else:
                value_changed = self._values_differ(old_param.value, new_param.value)
                type_changed = old_param.type != new_param.type

                if value_changed or type_changed:
                    if type_changed:
                        change_type = "type_change"
                    elif value_changed:
                        change_type = "value_change"
                    else:
                        change_type = "modified"
                    
                    changes.append(ParameterChange(
                        name=name,
                        old_value=old_param.value,
                        new_value=new_param.value,
                        old_type=old_param.type,
                        new_type=new_param.type,
                        change_type=change_type
                    ))

        return changes

    def _values_differ(self, old_val, new_val) -> bool:
        if old_val is None and new_val is None:
            return False
        if old_val is None or new_val is None:
            return True
        
        try:
            return str(old_val) != str(new_val)
        except Exception:
            return True

    def summarize_changes(self, diff: SnapshotDiff) -> Dict[str, int]:
        type_changes = sum(1 for c in diff.parameter_changes if c.is_type_change)
        value_changes = sum(1 for c in diff.parameter_changes if not c.is_type_change)
        
        return {
            "parameter_changes_total": len(diff.parameter_changes),
            "parameter_type_changes": type_changes,
            "parameter_value_changes": value_changes,
            "artifacts_added": len(diff.artifacts_added),
            "artifacts_removed": len(diff.artifacts_removed),
            "artifacts_modified": len(diff.artifacts_modified),
            "status_changed": diff.status_changed,
        }
