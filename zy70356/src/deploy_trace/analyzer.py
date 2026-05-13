from typing import List, Dict, Any, Optional
from datetime import datetime
from .models import (
    Artifact, TraceResult, CompareResult, VerifyResult, ReportItem, ArtifactStatus
)


class TraceAnalyzer:
    def trace_artifact(
        self,
        artifact: Artifact,
        all_artifacts: List[Artifact]
    ) -> TraceResult:
        trace_chain = self._build_trace_chain(artifact)
        risks = self._identify_risks(artifact)
        summary = self._generate_trace_summary(artifact, risks)

        return TraceResult(
            environment=artifact.environment,
            artifact=artifact,
            trace_chain=trace_chain,
            risks=risks,
            summary=summary
        )

    def _build_trace_chain(self, artifact: Artifact) -> List[Dict[str, Any]]:
        chain = []

        chain.append({
            "level": "environment",
            "name": artifact.environment,
            "details": {
                "deploy_time": artifact.deploy_time.isoformat(),
                "artifact_id": artifact.artifact_id
            }
        })

        chain.append({
            "level": "artifact",
            "name": f"{artifact.name}:{artifact.version}",
            "details": {
                "artifact_id": artifact.artifact_id,
                "status": artifact.status.value,
                "issues": artifact.issues
            }
        })

        if artifact.build_metadata:
            build = artifact.build_metadata
            chain.append({
                "level": "build",
                "name": f"Build #{build.build_number or 'N/A'}",
                "details": {
                    "build_number": build.build_number,
                    "commit_hash": build.commit_hash,
                    "build_time": build.build_time.isoformat(),
                    "builder": build.builder,
                    "build_machine": build.build_machine,
                    "branch": build.branch,
                    "config_hash": build.config_hash,
                    "build_url": build.build_url
                }
            })

        if artifact.commit_record:
            commit = artifact.commit_record
            chain.append({
                "level": "commit",
                "name": commit.hash[:8],
                "details": {
                    "full_hash": commit.hash,
                    "message": commit.message,
                    "author": commit.author,
                    "timestamp": commit.timestamp.isoformat(),
                    "branch": commit.branch,
                    "parents": commit.parents
                }
            })

        if artifact.config_snapshot:
            config = artifact.config_snapshot
            chain.append({
                "level": "config",
                "name": config.config_path,
                "details": {
                    "config_hash": config.config_hash,
                    "content_hash": config.content_hash,
                    "snapshot_time": config.snapshot_time.isoformat(),
                    "config_data": config.config_data
                }
            })

        if artifact.approval_record:
            approval = artifact.approval_record
            chain.append({
                "level": "approval",
                "name": approval.approver,
                "details": {
                    "approval_id": approval.id,
                    "artifact_version": approval.artifact_version,
                    "approval_time": approval.approval_time.isoformat(),
                    "status": approval.status,
                    "comments": approval.comments
                }
            })

        return chain

    def _identify_risks(self, artifact: Artifact) -> List[str]:
        risks = []

        if artifact.status == ArtifactStatus.MISSING_BUILD:
            risks.append("高风险: 缺少构建元数据，无法追溯来源")
        if artifact.status == ArtifactStatus.MISSING_APPROVAL:
            risks.append("高风险: 缺少审批记录，部署流程不合规")
        if artifact.status == ArtifactStatus.CONFIG_MISMATCH:
            risks.append("高风险: 配置摘要不匹配，可能使用了错误的配置")
        if artifact.status == ArtifactStatus.ROLLBACK:
            risks.append(f"中风险: 回滚版本，从 {artifact.rollback_from} 回滚")
        if artifact.status == ArtifactStatus.DUPLICATE_BUILD:
            risks.append("中风险: 重复的构建号，可能存在构建污染")

        if artifact.approval_record:
            if artifact.approval_record.approval_time > artifact.deploy_time:
                risks.append("高风险: 审批晚于部署，存在先部署后审批问题")

        if "同一版本号对应多个制品" in str(artifact.issues):
            risks.append("中风险: 同一版本号对应多个制品，存在混淆风险")

        return risks

    def _generate_trace_summary(self, artifact: Artifact, risks: List[str]) -> str:
        status_desc = {
            ArtifactStatus.NORMAL: "正常",
            ArtifactStatus.MISSING_BUILD: "缺少构建信息",
            ArtifactStatus.MISSING_APPROVAL: "缺少审批",
            ArtifactStatus.CONFIG_MISMATCH: "配置不匹配",
            ArtifactStatus.ROLLBACK: "回滚版本",
            ArtifactStatus.DUPLICATE_BUILD: "重复构建"
        }

        summary_parts = [
            f"环境: {artifact.environment}",
            f"制品: {artifact.name}:{artifact.version}",
            f"状态: {status_desc.get(artifact.status, artifact.status.value)}",
            f"部署时间: {artifact.deploy_time.strftime('%Y-%m-%d %H:%M:%S')}"
        ]

        if artifact.build_metadata:
            summary_parts.append(f"构建: #{artifact.build_metadata.build_number or 'N/A'}")
        if artifact.commit_record:
            summary_parts.append(f"提交: {artifact.commit_record.hash[:8]}")
        if artifact.approval_record:
            summary_parts.append(f"审批人: {artifact.approval_record.approver}")

        if risks:
            summary_parts.append(f"风险项: {len(risks)} 个")

        return " | ".join(summary_parts)

    def compare_artifacts(self, artifacts: List[Artifact]) -> CompareResult:
        if len(artifacts) < 2:
            return CompareResult(
                artifacts=artifacts,
                differences={},
                common_attributes={}
            )

        common = {}
        differences = {}

        fields_to_compare = [
            "name", "version", "environment", "status", "deploy_time",
            "build_number", "commit_hash", "builder", "build_machine",
            "branch", "config_hash", "approver", "approval_status"
        ]

        for field in fields_to_compare:
            values = []
            for artifact in artifacts:
                value = self._get_field_value(artifact, field)
                values.append(value)

            all_same = all(v == values[0] for v in values)
            if all_same:
                common[field] = values[0]
            else:
                differences[field] = [
                    {"artifact_id": a.artifact_id, "value": v}
                    for a, v in zip(artifacts, values)
                ]

        return CompareResult(
            artifacts=artifacts,
            differences=differences,
            common_attributes=common
        )

    def _get_field_value(self, artifact: Artifact, field: str) -> Any:
        if hasattr(artifact, field):
            return getattr(artifact, field)
        if artifact.build_metadata and hasattr(artifact.build_metadata, field):
            return getattr(artifact.build_metadata, field)
        if artifact.commit_record and hasattr(artifact.commit_record, field):
            return getattr(artifact.commit_record, field)
        if artifact.approval_record:
            if field == "approver":
                return artifact.approval_record.approver
            if field == "approval_status":
                return artifact.approval_record.status
        if artifact.config_snapshot and hasattr(artifact.config_snapshot, field):
            return getattr(artifact.config_snapshot, field)
        return None

    def verify_artifact(self, artifact: Artifact) -> VerifyResult:
        errors = []
        warnings = []
        missing_fields = []

        required_fields = {
            "artifact_id": artifact.artifact_id,
            "name": artifact.name,
            "version": artifact.version,
            "environment": artifact.environment,
            "deploy_time": artifact.deploy_time,
        }

        for field_name, value in required_fields.items():
            if not value:
                missing_fields.append(field_name)
                errors.append(f"缺少必需字段: {field_name}")

        if not artifact.build_metadata:
            errors.append("缺少构建元数据")
        else:
            build = artifact.build_metadata
            if not build.commit_hash:
                missing_fields.append("build_metadata.commit_hash")
                errors.append("构建元数据缺少 commit_hash")
            if not build.config_hash:
                missing_fields.append("build_metadata.config_hash")
                warnings.append("构建元数据缺少 config_hash")

        if not artifact.commit_record:
            warnings.append("缺少提交记录")

        if not artifact.approval_record:
            errors.append("缺少审批记录")
        else:
            approval = artifact.approval_record
            if approval.approval_time > artifact.deploy_time:
                errors.append("审批时间晚于部署时间")
            if approval.status != "approved":
                warnings.append(f"审批状态为 {approval.status}，非 approved")

        if artifact.build_metadata and artifact.config_snapshot:
            if artifact.build_metadata.config_hash != artifact.config_snapshot.config_hash:
                errors.append("配置摘要不匹配")

        is_valid = len(errors) == 0

        return VerifyResult(
            artifact=artifact,
            is_valid=is_valid,
            errors=errors,
            warnings=warnings,
            missing_fields=missing_fields
        )

    def generate_report(self, artifacts: List[Artifact]) -> Dict[str, Any]:
        report_items = []
        stats = {
            "total": len(artifacts),
            "normal": 0,
            "missing_approval": 0,
            "config_mismatch": 0,
            "rollback": 0,
            "missing_build": 0,
            "duplicate_build": 0,
        }

        for artifact in artifacts:
            issues = artifact.issues.copy()
            severity = "low"

            if artifact.status == ArtifactStatus.NORMAL:
                stats["normal"] += 1
                if not issues:
                    issues = ["无问题"]
            elif artifact.status == ArtifactStatus.MISSING_APPROVAL:
                stats["missing_approval"] += 1
                severity = "high"
            elif artifact.status == ArtifactStatus.CONFIG_MISMATCH:
                stats["config_mismatch"] += 1
                severity = "high"
            elif artifact.status == ArtifactStatus.ROLLBACK:
                stats["rollback"] += 1
                severity = "medium"
            elif artifact.status == ArtifactStatus.MISSING_BUILD:
                stats["missing_build"] += 1
                severity = "high"
            elif artifact.status == ArtifactStatus.DUPLICATE_BUILD:
                stats["duplicate_build"] += 1
                severity = "medium"

            report_items.append(ReportItem(
                artifact=artifact,
                issues=issues,
                severity=severity
            ))

        return {
            "generated_at": datetime.now().isoformat(),
            "statistics": stats,
            "items": report_items
        }
