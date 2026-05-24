import json
import os
from typing import Any, Dict, List, Optional
from pathlib import Path

from .models import (
    BuildRecord,
    Parameter,
    Artifact,
    GitInfo,
    ParameterType,
    BuildStatus,
    SnapshotValidationResult,
    ValidationError,
)


class BuildRecordReader:
    def __init__(self):
        pass

    def from_json_file(self, file_path: str) -> BuildRecord:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Build record file not found: {file_path}")
        
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return self.from_dict(data)

    def from_dict(self, data: Dict[str, Any]) -> BuildRecord:
        parameters = []
        if 'parameters' in data and data['parameters']:
            if isinstance(data['parameters'], dict):
                for name, value in data['parameters'].items():
                    parameters.append(Parameter(name=name, value=value))
            elif isinstance(data['parameters'], list):
                        parameters = [Parameter(**p) for p in data['parameters']]

        artifacts = []
        if 'artifacts' in data and data['artifacts']:
            artifacts = [Artifact(**a) for a in data['artifacts']]

        git_info = None
        if 'git_info' in data and data['git_info']:
            git_info = GitInfo(**data['git_info'])

        return BuildRecord(
            job_name=data.get('job_name', data.get('fullDisplayName', 'unknown')),
            build_number=int(data.get('build_number', data.get('number', 0))),
            status=data.get('status', data.get('result', 'UNKNOWN')),
            timestamp=data.get('timestamp', data.get('timestamp', 0)),
            duration_ms=data.get('duration_ms', data.get('duration')),
            triggered_by=data.get('triggered_by', self._extract_triggered_by(data)),
            parameters=parameters,
            artifacts=artifacts,
            git_info=git_info,
            description=data.get('description'),
            url=data.get('url'),
            is_rerun=data.get('is_rerun', False),
            rerun_of=data.get('rerun_of'),
        )

    def _extract_triggered_by(self, data: Dict[str, Any]) -> Optional[str]:
        if 'triggered_by' in data:
            return str(data['triggered_by'])
        if 'actions' in data and isinstance(data['actions'], list):
            for action in data['actions']:
                if isinstance(action, dict):
                    if 'causes' in action:
                        for cause in action['causes']:
                            if 'userName' in cause:
                                return cause['userName']
                            if 'shortDescription' in cause:
                                return cause['shortDescription']
        return None

    def from_jenkins_api(self, data: Dict[str, Any]) -> BuildRecord:
        return self.from_dict(data)


class InputValidator:
    def validate_build_record(self, record: BuildRecord) -> SnapshotValidationResult:
        errors: List[ValidationError] = []
        warnings: List[ValidationError] = []

        if not record.job_name or record.job_name == 'unknown':
            errors.append(ValidationError(
                field='job_name',
                message='Job name is missing or invalid',
                severity='error'
            ))

        if record.build_number <= 0:
            errors.append(ValidationError(
                field='build_number',
                message='Build number must be a positive integer',
                severity='error'
            ))

        if not record.parameters:
            warnings.append(ValidationError(
                field='parameters',
                message='No parameters found in build record',
                severity='warning'
            ))

        param_names = set()
        for param in record.parameters:
            if param.name in param_names:
                errors.append(ValidationError(
                    field=f'parameters.{param.name}',
                    message=f'Duplicate parameter name: {param.name}',
                    severity='error'
                ))
            param_names.add(param.name)
            
            if param.type == ParameterType.UNKNOWN:
                warnings.append(ValidationError(
                    field=f'parameters.{param.name}.type',
                    message=f'Parameter type is unknown for: {param.name}',
                    severity='warning'
                ))

        for artifact in record.artifacts:
            if not artifact.exists:
                warnings.append(ValidationError(
                    field=f'artifacts.{artifact.name}',
                    message=f'Artifact marked as missing: {artifact.name}',
                    severity='warning'
                ))

        if record.git_info and not record.git_info.commit:
            warnings.append(ValidationError(
                field='git_info.commit',
                message='Git commit hash is empty',
                severity='warning'
            ))

        return SnapshotValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings
        )

    def validate_artifact_paths(self, record: BuildRecord, base_dir: Optional[str] = None) -> SnapshotValidationResult:
        errors: List[ValidationError] = []
        warnings: List[ValidationError] = []

        for artifact in record.artifacts:
            if base_dir:
                full_path = os.path.join(base_dir, artifact.path)
            else:
                full_path = artifact.path
            
            if not os.path.exists(full_path):
                artifact.exists = False
                artifact.missing_reason = 'File not found on disk'
                warnings.append(ValidationError(
                    field=f'artifacts.{artifact.name}',
                    message=f'Artifact file not found: {full_path}',
                    severity='warning'
                ))
            else:
                artifact.size = os.path.getsize(full_path)

        return SnapshotValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings
        )
