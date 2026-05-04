import json
from pathlib import Path
from typing import Dict, List, Optional

from .models import (
    AnalysisResult,
    TaskInfo,
    TaskState,
)


class ReportGenerator:
    @staticmethod
    def generate_markdown(result: AnalysisResult, importer) -> str:
        lines = []

        lines.append("# Asyncio 诊断报告\n")

        lines.append("## 摘要\n")
        summary = result.summary
        lines.append(f"- **总任务数**: {summary.get('total_tasks', 0)}")
        lines.append(f"- **发现问题数**: {summary.get('issues_found', 0)}")
        lines.append(f"\n### 任务状态分布\n")
        by_state = summary.get("by_state", {})
        for state, count in by_state.items():
            lines.append(f"- {state}: {count}")

        if result.long_pending_tasks:
            lines.append("\n## 长期 Pending 的任务\n")
            lines.append(f"共发现 {len(result.long_pending_tasks)} 个长期 pending 的任务\n")
            for task in result.long_pending_tasks:
                lines.append(f"### 任务 `{task.task_id}`\n")
                lines.append(f"- **名称**: {task.name or 'N/A'}")
                lines.append(f"- **协程**: `{task.coro_name}`")
                lines.append(f"- **状态**: {task.state.value}")
                lines.append(f"- **创建时间**: {task.created_at}")
                lines.append(f"- **等待**: {task.waiting_on or 'N/A'}")
                lines.append(f"- **被等待**: {task.awaited_by or '无'}")

        if result.task_leaks:
            lines.append("\n## 任务泄漏\n")
            lines.append(f"共发现 {len(result.task_leaks)} 个可能的任务泄漏\n")
            for task in result.task_leaks:
                lines.append(f"### 任务 `{task.task_id}`\n")
                lines.append(f"- **名称**: {task.name or 'N/A'}")
                lines.append(f"- **协程**: `{task.coro_name}`")
                lines.append(f"- **状态**: {task.state.value}")
                lines.append(f"- **创建时间**: {task.created_at}")
                lines.append(f"\n> ⚠️  此任务没有被其他任务 await，也没有超时 watchdog，可能已泄漏")

        if result.ineffective_cancellations:
            lines.append("\n## 取消未生效的任务\n")
            lines.append(f"共发现 {len(result.ineffective_cancellations)} 个取消未生效的任务\n")
            for task in result.ineffective_cancellations:
                lines.append(f"### 任务 `{task.task_id}`\n")
                lines.append(f"- **名称**: {task.name or 'N/A'}")
                lines.append(f"- **协程**: `{task.coro_name}`")
                lines.append(f"- **当前状态**: {task.state.value}")
                lines.append(f"- **取消请求时间**: {task.cancel_time}")
                lines.append(f"\n> ⚠️  此任务已收到取消请求但仍在运行，可能没有正确处理 CancelledError")

        if result.timeout_chains:
            lines.append("\n## 超时链路\n")
            lines.append(f"共发现 {len(result.timeout_chains)} 个超时链路\n")
            for i, chain in enumerate(result.timeout_chains, 1):
                lines.append(f"### 链路 #{i}\n")
                lines.append("```")
                lines.append(" → ".join(chain))
                lines.append("```")

        if result.queue_congestion:
            lines.append("\n## 队列堆积\n")
            lines.append(f"共发现 {len(result.queue_congestion)} 个堆积的队列\n")
            for queue in result.queue_congestion:
                lines.append(f"### 队列 `{queue['queue_name']}`\n")
                lines.append(f"- **队列大小**: {queue['queue_size']}")
                lines.append(f"- **等待任务数**: {queue['pending_count']}")
                lines.append(f"- **总 put 操作**: {queue['total_puts']}")
                lines.append(f"- **总 get 操作**: {queue['total_gets']}")
                if queue['pending_tasks']:
                    lines.append(f"- **等待的任务**:")
                    for task_id in queue['pending_tasks']:
                        lines.append(f"  - `{task_id}`")

        if result.wait_chains:
            lines.append("\n## 等待链\n")
            lines.append(f"共发现 {len(result.wait_chains)} 个等待链\n")
            for i, chain in enumerate(result.wait_chains, 1):
                lines.append(f"### 等待链 #{i}\n")
                lines.append("```")
                lines.append(" → ".join(chain))
                lines.append("```")

        lines.append("\n---\n")
        lines.append(f"*报告生成时间: {ReportGenerator._now()}*")

        return "\n".join(lines)

    @staticmethod
    def generate_json(result: AnalysisResult, importer) -> str:
        output = {
            "summary": result.summary,
            "long_pending_tasks": [
                ReportGenerator._task_to_dict(t)
                for t in result.long_pending_tasks
            ],
            "task_leaks": [
                ReportGenerator._task_to_dict(t)
                for t in result.task_leaks
            ],
            "ineffective_cancellations": [
                ReportGenerator._task_to_dict(t)
                for t in result.ineffective_cancellations
            ],
            "timeout_chains": result.timeout_chains,
            "queue_congestion": result.queue_congestion,
            "wait_chains": result.wait_chains,
            "all_tasks": [
                ReportGenerator._task_to_dict(t)
                for t in importer.get_all_tasks()
            ],
            "generated_at": ReportGenerator._now(),
        }
        return json.dumps(output, indent=2, default=str)

    @staticmethod
    def _task_to_dict(task: TaskInfo) -> Dict:
        return {
            "task_id": task.task_id,
            "name": task.name,
            "state": task.state.value if isinstance(task.state, TaskState) else task.state,
            "coro_name": task.coro_name,
            "created_at": task.created_at.isoformat() if task.created_at else None,
            "last_updated_at": task.last_updated_at.isoformat() if task.last_updated_at else None,
            "waiting_on": task.waiting_on,
            "awaited_by": task.awaited_by,
            "cancel_requested": task.cancel_requested,
            "cancel_time": task.cancel_time.isoformat() if task.cancel_time else None,
            "metadata": task.metadata,
        }

    @staticmethod
    def _now() -> str:
        from datetime import datetime
        return datetime.now().isoformat()

    @staticmethod
    def export_markdown(result: AnalysisResult, importer, output_path: Path):
        content = ReportGenerator.generate_markdown(result, importer)
        output_path.write_text(content)

    @staticmethod
    def export_json(result: AnalysisResult, importer, output_path: Path):
        content = ReportGenerator.generate_json(result, importer)
        output_path.write_text(content)
