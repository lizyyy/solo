import json
from typing import Dict, Any

from slice_validator.models.schemas import ValidationResult, RollbackPlan


class OutputFormatter:
    @staticmethod
    def to_json(data: Any, pretty: bool = True) -> str:
        if hasattr(data, "model_dump"):
            data = data.model_dump(mode="json")
        if pretty:
            return json.dumps(data, ensure_ascii=False, indent=2)
        return json.dumps(data, ensure_ascii=False)

    @staticmethod
    def validation_to_markdown(result: ValidationResult) -> str:
        lines = []
        lines.append(f"# 切片校验报告 - {result.batch_id}")
        lines.append("")
        lines.append(f"**校验时间**: {result.validation_time}")
        lines.append(f"**整体状态**: `{result.overall_status.value}`")
        lines.append("")

        lines.append("## 校验概览")
        lines.append("")
        lines.append("| 指标 | 数值 |")
        lines.append("|------|------|")
        lines.append(f"| 总切片数 | {result.total_slices} |")
        lines.append(f"| 成功 | {result.success_count} |")
        lines.append(f"| 失败 | {result.failed_count} |")
        lines.append(f"| 部分 | {result.partial_count} |")
        lines.append("")

        if result.failure_groups:
            lines.append("## 失败分组详情")
            lines.append("")
            for failure_type, items in result.failure_groups.items():
                lines.append(f"### {failure_type.value}")
                lines.append("")
                for item in items:
                    lines.append(f"- {item}")
                lines.append("")

        lines.append("## 切片详情")
        lines.append("")
        lines.append("| 文件名 | 切片索引 | 状态 | 失败类型 |")
        lines.append("|---------|----------|------|----------|")
        for slice_info in result.validated_slices:
            failure_type = slice_info.get("failure_type", "-")
            lines.append(
                f"| {slice_info['file_name']} | {slice_info['slice_index']} | "
                f"`{slice_info['status']}` | `{failure_type}` |"
            )
        lines.append("")

        return "\n".join(lines)

    @staticmethod
    def rollback_to_markdown(plan: RollbackPlan) -> str:
        lines = []
        lines.append(f"# 回滚计划 - {plan.plan_id}")
        lines.append("")
        lines.append(f"**关联批次**: {plan.batch_id}")
        lines.append(f"**创建时间**: {plan.created_at}")
        lines.append(f"**状态**: `{plan.status}`")
        lines.append("")

        lines.append("## 候选操作清单")
        lines.append("")

        for i, candidate in enumerate(plan.candidates, 1):
            lines.append(f"### 操作 {i}: {candidate.action_type}")
            lines.append("")
            lines.append(f"- **操作ID**: {candidate.action_id}")
            lines.append(f"- **原因**: {candidate.reason}")
            lines.append(f"- **需人工确认**: {'是' if candidate.requires_manual_confirmation else '否'}")
            lines.append("")
            lines.append("**影响文件**:")
            lines.append("")
            for file in candidate.affected_files:
                lines.append(f"- `{file}`")
            lines.append("")

        lines.append("## 执行说明")
        lines.append("")
        lines.append("> ⚠️ **重要提示**: 所有回滚操作必须经过人工确认后才能执行。")
        lines.append("> 请仔细核对影响文件列表，避免误伤真实数据。")
        lines.append("")

        return "\n".join(lines)

    @staticmethod
    def save_markdown(content: str, file_path: str) -> None:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
