import json
from typing import List
from sqlalchemy.orm import Session
from app.models import TaskBatch, TaskResult, AttributionResult
from datetime import datetime


class OutputService:
    def __init__(self, db: Session):
        self.db = db

    def generate_json_output(self, batch_id: str) -> dict:
        batch = self.db.query(TaskBatch).filter(TaskBatch.batch_id == batch_id).first()
        if not batch:
            return {"error": "Batch not found"}

        task_results = self.db.query(TaskResult).filter(TaskResult.batch_id == batch_id).all()
        attribution_results = self.db.query(AttributionResult).filter(AttributionResult.batch_id == batch_id).all()

        attribution_map = {ar.task_id: ar for ar in attribution_results}

        tasks_detail = []
        for task in task_results:
            task_dict = {
                "task_id": task.task_id,
                "node_id": task.node_id,
                "status": task.status.value,
                "is_early_terminated": task.is_early_terminated,
                "error_code": task.error_code,
                "error_message": task.error_message,
            }

            if task.task_id in attribution_map:
                attr = attribution_map[task.task_id]
                task_dict["attribution"] = {
                    "blocked_by_rule": attr.blocked_by_rule,
                    "blocked_by_rule_code": attr.blocked_by_rule_code,
                    "block_reason": attr.block_reason,
                    "risk_type": attr.risk_type.value,
                    "confidence_score": attr.confidence_score,
                    "is_manual_modified": attr.is_manual_modified,
                    "original_conclusion": attr.original_conclusion
                }

            tasks_detail.append(task_dict)

        return {
            "batch_id": batch.batch_id,
            "batch_name": batch.batch_name,
            "operator": batch.operator,
            "batch_status": batch.status.value,
            "risk_type": batch.risk_type.value,
            "total_tasks": batch.total_tasks,
            "success_count": batch.success_count,
            "failed_count": batch.failed_count,
            "started_at": batch.started_at.isoformat() if batch.started_at else None,
            "completed_at": batch.completed_at.isoformat() if batch.completed_at else None,
            "tasks": tasks_detail,
            "generated_at": datetime.now().isoformat()
        }

    def generate_markdown_output(self, batch_id: str) -> str:
        data = self.generate_json_output(batch_id)
        if "error" in data:
            return f"# Error\n\n{data['error']}"

        md_lines = []
        md_lines.append(f"# 任务失败归因报告 - {data['batch_id']}")
        md_lines.append("")
        md_lines.append("## 批次概览")
        md_lines.append("")
        md_lines.append(f"| 项目 | 内容 |")
        md_lines.append(f"|------|------|")
        md_lines.append(f"| 批次名称 | {data['batch_name'] or 'N/A'} |")
        md_lines.append(f"| 操作者 | {data['operator']} |")
        md_lines.append(f"| 批次状态 | {data['batch_status']} |")
        md_lines.append(f"| 风险类型 | {data['risk_type']} |")
        md_lines.append(f"| 总任务数 | {data['total_tasks']} |")
        md_lines.append(f"| 成功数 | {data['success_count']} |")
        md_lines.append(f"| 失败数 | {data['failed_count']} |")
        md_lines.append(f"| 开始时间 | {data['started_at'] or 'N/A'} |")
        md_lines.append(f"| 完成时间 | {data['completed_at'] or 'N/A'} |")
        md_lines.append("")

        blocked_tasks = [t for t in data['tasks'] if t.get('is_early_terminated')]
        if blocked_tasks:
            md_lines.append("## 提前终止任务详情")
            md_lines.append("")
            for idx, task in enumerate(blocked_tasks, 1):
                md_lines.append(f"### {idx}. 任务 {task['task_id']}")
                md_lines.append("")
                md_lines.append(f"- **节点ID**: {task['node_id']}")
                md_lines.append(f"- **状态**: {task['status']}")
                md_lines.append(f"- **错误代码**: {task['error_code'] or 'N/A'}")
                md_lines.append(f"- **错误信息**: {task['error_message'] or 'N/A'}")

                if 'attribution' in task:
                    attr = task['attribution']
                    md_lines.append("")
                    md_lines.append("#### 归因结果")
                    md_lines.append(f"- **拦截规则**: {attr['blocked_by_rule']} ({attr['blocked_by_rule_code']})")
                    md_lines.append(f"- **拦截原因**: {attr['block_reason']}")
                    md_lines.append(f"- **风险类型**: {attr['risk_type']}")
                    md_lines.append(f"- **置信度**: {attr['confidence_score']:.2%}")
                    if attr.get('is_manual_modified'):
                        md_lines.append(f"- **人工修改**: 是")
                        md_lines.append(f"- **原始结论**: {attr.get('original_conclusion', 'N/A')}")

                md_lines.append("")

        md_lines.append("## 所有任务明细")
        md_lines.append("")
        md_lines.append("| 任务ID | 节点ID | 状态 | 是否提前终止 | 拦截规则 |")
        md_lines.append("|--------|--------|------|--------------|----------|")
        for task in data['tasks']:
            blocked_rule = task.get('attribution', {}).get('blocked_by_rule', '-') if task.get('attribution') else '-'
            md_lines.append(
                f"| {task['task_id']} | {task['node_id']} | {task['status']} | {task['is_early_terminated']} | {blocked_rule} |")

        md_lines.append("")
        md_lines.append(f"*报告生成时间: {data['generated_at']}*")

        return "\n".join(md_lines)

    def generate_excel_data(self, batch_id: str) -> bytes:
        import io
        import pandas as pd

        data = self.generate_json_output(batch_id)
        if "error" in data:
            return b""

        summary_df = pd.DataFrame([
            {"项目": "批次ID", "内容": data["batch_id"]},
            {"项目": "批次名称", "内容": data["batch_name"] or "N/A"},
            {"项目": "操作者", "内容": data["operator"]},
            {"项目": "批次状态", "内容": data["batch_status"]},
            {"项目": "风险类型", "内容": data["risk_type"]},
            {"项目": "总任务数", "内容": data["total_tasks"]},
            {"项目": "成功数", "内容": data["success_count"]},
            {"项目": "失败数", "内容": data["failed_count"]},
            {"项目": "开始时间", "内容": data["started_at"] or "N/A"},
            {"项目": "完成时间", "内容": data["completed_at"] or "N/A"},
        ])

        tasks_data = []
        for task in data["tasks"]:
            task_row = {
                "任务ID": task["task_id"],
                "节点ID": task["node_id"],
                "状态": task["status"],
                "是否提前终止": task["is_early_terminated"],
                "错误代码": task["error_code"] or "",
                "错误信息": task["error_message"] or "",
            }
            if task.get("attribution"):
                attr = task["attribution"]
                task_row.update({
                    "拦截规则": attr["blocked_by_rule"],
                    "拦截规则代码": attr["blocked_by_rule_code"],
                    "拦截原因": attr["block_reason"],
                    "风险类型": attr["risk_type"],
                    "置信度": f"{attr['confidence_score']:.2%}",
                    "人工修改": attr["is_manual_modified"],
                    "原始结论": attr.get("original_conclusion", "")
                })
            tasks_data.append(task_row)

        tasks_df = pd.DataFrame(tasks_data)

        output = io.BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            summary_df.to_excel(writer, sheet_name="批次概览", index=False)
            tasks_df.to_excel(writer, sheet_name="任务明细", index=False)

        output.seek(0)
        return output.getvalue()
