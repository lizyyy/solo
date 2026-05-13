import json
import os
from typing import List, Dict, Any, Optional
from datetime import datetime
from .models import (
    Artifact, BuildMetadata, CommitRecord, ApprovalRecord, ConfigSnapshot,
    ArtifactStatus
)


def _parse_datetime(ts: str) -> datetime:
    if ts.endswith('Z'):
        ts = ts[:-1] + '+00:00'
    return datetime.fromisoformat(ts)


class DataLoader:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        self.artifacts: Dict[str, Artifact] = {}
        self.build_metadata: Dict[str, BuildMetadata] = {}
        self.commit_records: Dict[str, CommitRecord] = {}
        self.approval_records: Dict[str, ApprovalRecord] = {}
        self.config_snapshots: Dict[str, ConfigSnapshot] = {}
        self.duplicate_build_numbers: set = set()
        self.version_to_artifacts: Dict[str, List[Artifact]] = {}

    def load_all(self) -> List[Artifact]:
        self._load_artifacts()
        self._load_build_metadata()
        self._load_commits()
        self._load_approvals()
        self._load_configs()
        self._associate_data()
        self._detect_rollbacks()
        self._validate_artifacts()
        return list(self.artifacts.values())

    def _load_json(self, filename: str) -> List[Dict[str, Any]]:
        filepath = os.path.join(self.data_dir, filename)
        if not os.path.exists(filepath):
            return []
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, list) else [data]

    def _load_artifacts(self):
        data = self._load_json("artifact_manifest.json")
        for item in data:
            artifact = Artifact(
                artifact_id=item["artifact_id"],
                name=item["name"],
                version=item["version"],
                environment=item["environment"],
                deploy_time=_parse_datetime(item["deploy_time"]),
            )
            self.artifacts[artifact.artifact_id] = artifact
            if artifact.version not in self.version_to_artifacts:
                self.version_to_artifacts[artifact.version] = []
            self.version_to_artifacts[artifact.version].append(artifact)

    def _load_build_metadata(self):
        data = self._load_json("build_metadata.json")
        build_numbers = set()
        for item in data:
            if item.get("build_number"):
                if item["build_number"] in build_numbers:
                    self.duplicate_build_numbers.add(item["build_number"])
                build_numbers.add(item["build_number"])
            build = BuildMetadata(
                build_number=item.get("build_number"),
                commit_hash=item["commit_hash"],
                build_time=_parse_datetime(item["build_time"]),
                builder=item["builder"],
                build_machine=item["build_machine"],
                config_hash=item["config_hash"],
                branch=item["branch"],
                build_url=item.get("build_url"),
                raw=item,
            )
            self.build_metadata[build.commit_hash] = build

    def _load_commits(self):
        data = self._load_json("commit_records.json")
        for item in data:
            commit = CommitRecord(
                hash=item["hash"],
                message=item["message"],
                author=item["author"],
                timestamp=_parse_datetime(item["timestamp"]),
                branch=item["branch"],
                parents=item.get("parents", []),
            )
            self.commit_records[commit.hash] = commit

    def _load_approvals(self):
        data = self._load_json("approval_records.json")
        for item in data:
            approval = ApprovalRecord(
                id=item["id"],
                artifact_version=item["artifact_version"],
                approver=item["approver"],
                approval_time=_parse_datetime(item["approval_time"]),
                status=item["status"],
                comments=item.get("comments"),
            )
            self.approval_records[approval.id] = approval

    def _load_configs(self):
        data = self._load_json("config_snapshots.json")
        for item in data:
            config = ConfigSnapshot(
                config_hash=item["config_hash"],
                config_path=item["config_path"],
                content_hash=item["content_hash"],
                snapshot_time=_parse_datetime(item["snapshot_time"]),
                config_data=item.get("config_data", {}),
            )
            self.config_snapshots[config.config_hash] = config

    def _associate_data(self):
        for artifact in self.artifacts.values():
            for build in self.build_metadata.values():
                if artifact.version in build.raw.get("versions", []) or \
                   artifact.version == build.raw.get("artifact_version"):
                    artifact.build_metadata = build
                    if artifact.build_metadata.build_number in self.duplicate_build_numbers:
                        artifact.status = ArtifactStatus.DUPLICATE_BUILD
                        artifact.issues.append("重复的构建号")
                    break

            if artifact.build_metadata:
                commit = self.commit_records.get(artifact.build_metadata.commit_hash)
                if commit:
                    artifact.commit_record = commit

            approval = self._find_approval_for_artifact(artifact)
            if approval:
                artifact.approval_record = approval

            if artifact.build_metadata:
                config = self.config_snapshots.get(artifact.build_metadata.config_hash)
                if config:
                    artifact.config_snapshot = config

    def _find_approval_for_artifact(self, artifact: Artifact) -> Optional[ApprovalRecord]:
        for approval in self.approval_records.values():
            if approval.artifact_version == artifact.version:
                return approval
        return None

    def _detect_rollbacks(self):
        env_artifacts = {}
        for artifact in self.artifacts.values():
            if artifact.environment not in env_artifacts:
                env_artifacts[artifact.environment] = []
            env_artifacts[artifact.environment].append(artifact)

        for env, arts in env_artifacts.items():
            arts_sorted = sorted(arts, key=lambda x: x.deploy_time)
            for i in range(1, len(arts_sorted)):
                current = arts_sorted[i]
                prev = arts_sorted[i - 1]
                if current.version == prev.version:
                    continue
                for j in range(i - 1, -1, -1):
                    if arts_sorted[j].version == current.version:
                        current.is_rollback = True
                        current.rollback_from = arts_sorted[i - 1].version
                        current.issues.append(f"回滚版本，从 {arts_sorted[i - 1].version} 回滚")
                        if current.status == ArtifactStatus.NORMAL:
                            current.status = ArtifactStatus.ROLLBACK
                        break

    def _validate_artifacts(self):
        for artifact in self.artifacts.values():
            if not artifact.build_metadata:
                artifact.status = ArtifactStatus.MISSING_BUILD
                artifact.issues.append("缺少构建元数据")
            elif not artifact.build_metadata.build_number:
                artifact.issues.append("缺少构建号")
                if artifact.status == ArtifactStatus.NORMAL:
                    artifact.status = ArtifactStatus.MISSING_BUILD

            if len(self.version_to_artifacts.get(artifact.version, [])) > 1:
                artifact.issues.append(f"同一版本号对应多个制品 ({len(self.version_to_artifacts[artifact.version])} 个)")

            if artifact.approval_record:
                if artifact.approval_record.approval_time > artifact.deploy_time:
                    artifact.issues.append("审批记录晚于部署时间")
            else:
                if artifact.status == ArtifactStatus.NORMAL:
                    artifact.status = ArtifactStatus.MISSING_APPROVAL
                artifact.issues.append("缺少审批记录")

            if artifact.build_metadata and artifact.config_snapshot:
                if artifact.build_metadata.config_hash != artifact.config_snapshot.config_hash:
                    artifact.issues.append("配置摘要不匹配")
                    if artifact.status == ArtifactStatus.NORMAL:
                        artifact.status = ArtifactStatus.CONFIG_MISMATCH

    def get_artifact_by_version(self, version: str, environment: Optional[str] = None) -> List[Artifact]:
        artifacts = self.version_to_artifacts.get(version, [])
        if environment:
            artifacts = [a for a in artifacts if a.environment == environment]
        return artifacts

    def get_artifact_by_id(self, artifact_id: str) -> Optional[Artifact]:
        return self.artifacts.get(artifact_id)

    def get_artifacts_by_environment(self, environment: str) -> List[Artifact]:
        return [a for a in self.artifacts.values() if a.environment == environment]
