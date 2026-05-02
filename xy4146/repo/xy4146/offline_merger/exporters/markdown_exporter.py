from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from offline_merger.archiver.audit_log import AuditLog, AuditLevel
from offline_merger.archiver.manifest import Manifest
from offline_merger.conflict.conflict_manager import ConflictManager, MergePlan


class MarkdownExporter:
    def __init__(
        self,
        task_name: str,
        task_id: str,
    ):
        self.task_name = task_name
        self.task_id = task_id
        self.generated_at = datetime.now()

    def _generate_header(self) -> str:
        return f"""# 离线采集包合并交接报告

> 生成时间: {self.generated_at.strftime('%Y-%m-%d %H:%M:%S')}
>
> 任务名称: {self.task_name}
>
> 任务ID: {self.task_id}

---

## 执行摘要

"""

    def _generate_manifest_summary(self, manifest: Manifest) -> str:
        if not manifest:
            return ""

        summary = manifest.summary

        by_type = summary.get("by_type", {})
        by_status = summary.get("by_status", {})
        by_source = summary.get("by_source", {})

        content = """### 文件统计

| 指标 | 数值 |
|------|------|
| 总文件数 | {total_files} |
| 总大小 | {total_size} |

### 按文件类型分布

| 类型 | 数量 |
|------|------|
""".format(
            total_files=summary.get("total_files", 0),
            total_size=self._format_size(summary.get("total_size_bytes", 0)),
        )

        for file_type, count in by_type.items():
            content += f"| {file_type} | {count} |\n"

        content += """
### 按来源包分布

| 来源 | 数量 |
|------|------|
"""

        for source, count in by_source.items():
            content += f"| {source} | {count} |\n"

        content += """
### 按状态分布

| 状态 | 数量 |
|------|------|
"""

        for status, count in by_status.items():
            content += f"| {status} | {count} |\n"

        return content

    def _generate_conflict_summary(
        self,
        conflict_manager: ConflictManager,
    ) -> str:
        if not conflict_manager:
            return ""

        summary = conflict_manager.get_summary()

        content = f"""
---

## 冲突报告

### 冲突统计

| 指标 | 数值 |
|------|------|
| 总冲突数 | {summary.get('total', 0)} |
| 未解决 | {summary.get('unresolved', 0)} |

"""

        by_type = summary.get("by_type", {})
        if by_type:
            content += """
### 按冲突类型分布

| 类型 | 数量 |
|------|------|
"""
            for conflict_type, count in by_type.items():
                content += f"| {conflict_type} | {count} |\n"

        by_severity = summary.get("by_severity", {})
        if by_severity:
            content += """
### 按严重程度分布

| 严重程度 | 数量 |
|----------|------|
"""
            for severity, count in by_severity.items():
                content += f"| {severity} | {count} |\n"

        conflicts = conflict_manager.get_all_conflicts()
        if conflicts:
            content += """
### 冲突详情

"""
            for conflict in conflicts:
                content += f"""
#### {conflict.conflict_id}

- **类型**: {conflict.conflict_type.value}
- **严重程度**: {conflict.severity}
- **状态**: {conflict.status.value}
- **来源包**: {', '.join(conflict.source_packages)}
- **描述**: {conflict.message}
"""
                if conflict.action.value != "pending":
                    content += f"""- **解决动作**: {conflict.action.value}
"""
                if conflict.resolution_notes:
                    content += f"""- **解决备注**: {conflict.resolution_notes}
"""

        return content

    def _generate_audit_summary(
        self,
        audit_log: AuditLog,
    ) -> str:
        if not audit_log or not audit_log.entries:
            return ""

        errors = audit_log.get_errors()
        warnings = audit_log.get_warnings()

        content = f"""
---

## 审计日志摘要

| 指标 | 数值 |
|------|------|
| 总记录数 | {len(audit_log.entries)} |
| 错误数 | {len(errors)} |
| 警告数 | {len(warnings)} |

"""

        if errors:
            content += """
### 错误详情

"""
            for entry in errors[-10:]:
                content += f"""
- **时间**: {entry.timestamp.strftime('%Y-%m-%d %H:%M:%S')}
  **操作**: {entry.action.value}
  **消息**: {entry.message}
"""
                if entry.error_message:
                    content += f"""  **错误**: {entry.error_message}
"""

        if warnings:
            content += """
### 警告详情 (最近10条)

"""
            for entry in warnings[-10:]:
                content += f"""
- **时间**: {entry.timestamp.strftime('%Y-%m-%d %H:%M:%S')}
  **操作**: {entry.action.value}
  **消息**: {entry.message}
"""

        return content

    def _generate_merge_plan_summary(
        self,
        merge_plan: MergePlan,
    ) -> str:
        if not merge_plan:
            return ""

        content = f"""
---

## 合并计划

| 指标 | 数值 |
|------|------|
| 计划ID | {merge_plan.plan_id} |
| 来源包数 | {len(merge_plan.source_packages)} |
| 总文件数 | {merge_plan.total_files} |
| 唯一文件数 | {merge_plan.unique_files} |
| 冲突数 | {len(merge_plan.conflicts)} |
| Dry-Run | {'是' if merge_plan.dry_run else '否'} |

### 文件操作计划

| 操作 | 数量 |
|------|------|
| 待复制 | {len(merge_plan.files_to_copy)} |
| 待隔离 | {len(merge_plan.files_to_isolate)} |
| 待重命名 | {len(merge_plan.files_to_rename)} |

"""

        if merge_plan.source_packages:
            content += """
### 涉及的来源包

"""
            for package in merge_plan.source_packages:
                content += f"- {package}\n"

        return content

    def _format_size(self, size_bytes: int) -> str:
        for unit in ["B", "KB", "MB", "GB"]:
            if size_bytes < 1024:
                return f"{size_bytes:.2f} {unit}"
            size_bytes /= 1024
        return f"{size_bytes:.2f} TB"

    def export(
        self,
        output_path: str,
        manifest: Optional[Manifest] = None,
        conflict_manager: Optional[ConflictManager] = None,
        audit_log: Optional[AuditLog] = None,
        merge_plan: Optional[MergePlan] = None,
        additional_info: Optional[Dict[str, Any]] = None,
    ) -> str:
        content = self._generate_header()

        if manifest:
            content += self._generate_manifest_summary(manifest)

        if merge_plan:
            content += self._generate_merge_plan_summary(merge_plan)

        if conflict_manager:
            content += self._generate_conflict_summary(conflict_manager)

        if audit_log:
            content += self._generate_audit_summary(audit_log)

        content += """
---

## 备注

"""

        if additional_info:
            for key, value in additional_info.items():
                content += f"- **{key}**: {value}\n"

        content += f"""
---

*报告由离线采集包合并工具生成*
"""

        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)

        with open(output_file, "w", encoding="utf-8") as f:
            f.write(content)

        return output_path
