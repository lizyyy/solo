"""演练执行器模块 - 在临时目录模拟执行修补操作"""

import shutil
import tempfile
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional

from .patch_plan import PatchPlan, PatchAction, PatchActionType, PatchPriority
from .utils import calculate_file_hash, save_json


class ExecutionStatus(Enum):
    """执行状态"""
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class JournalEntry:
    """日志条目"""
    timestamp: datetime
    action_id: str
    action_type: str
    status: ExecutionStatus
    message: str
    details: Dict[str, Any] = field(default_factory=dict)
    duration_seconds: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat(),
            "action_id": self.action_id,
            "action_type": self.action_type,
            "status": self.status.value,
            "message": self.message,
            "details": self.details,
            "duration_seconds": self.duration_seconds
        }


@dataclass
class ExecutionResult:
    """执行结果"""
    plan_id: str
    executed_at: datetime
    temp_dir: Path
    status: ExecutionStatus
    journal: List[JournalEntry] = field(default_factory=list)
    summary: Dict[str, Any] = field(default_factory=dict)
    success_count: int = 0
    failed_count: int = 0
    skipped_count: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "plan_id": self.plan_id,
            "executed_at": self.executed_at.isoformat(),
            "temp_dir": str(self.temp_dir),
            "status": self.status.value,
            "journal": [j.to_dict() for j in self.journal],
            "summary": self.summary,
            "success_count": self.success_count,
            "failed_count": self.failed_count,
            "skipped_count": self.skipped_count
        }


class DryRunExecutor:
    """演练执行器 - 仅在临时目录模拟执行"""

    def __init__(self, work_dir: Path, source_dir: Path):
        self.work_dir = work_dir
        self.source_dir = source_dir
        self.temp_dir: Optional[Path] = None

    def execute_plan(self, plan: PatchPlan, description: str = "演练执行") -> ExecutionResult:
        """
        执行修补计划（演练模式）
        
        在临时目录中创建模拟执行环境，记录所有操作但不修改源数据
        """
        result = ExecutionResult(
            plan_id=plan.plan_id,
            executed_at=datetime.now(),
            temp_dir=Path(""),
            status=ExecutionStatus.PENDING
        )

        try:
            self.temp_dir = Path(tempfile.mkdtemp(prefix="offline_sync_dryrun_"))
            result.temp_dir = self.temp_dir

            result.status = ExecutionStatus.RUNNING
            
            self._log_entry(result, "plan_start", "plan_execution", ExecutionStatus.RUNNING,
                          f"开始演练执行: {description}",
                          {"plan_id": plan.plan_id, "temp_dir": str(self.temp_dir)})

            self._prepare_sandbox(result)

            all_actions: List[PatchAction] = []
            for terminal_id, tp in plan.terminal_plans.items():
                for action in tp.actions:
                    if action.target_terminal is None:
                        action.target_terminal = terminal_id
                    all_actions.append(action)
            all_actions.extend(plan.global_actions)

            sorted_actions = sorted(
                all_actions,
                key=lambda a: self._priority_order(a.priority)
            )

            for action in sorted_actions:
                self._execute_action(action, result)

            result.status = ExecutionStatus.SUCCESS
            self._log_entry(result, "plan_complete", "plan_execution", ExecutionStatus.SUCCESS,
                          "演练执行完成",
                          {"success_count": result.success_count,
                           "failed_count": result.failed_count,
                           "skipped_count": result.skipped_count})

        except Exception as e:
            result.status = ExecutionStatus.FAILED
            self._log_entry(result, "plan_error", "plan_execution", ExecutionStatus.FAILED,
                          f"演练执行失败: {e}",
                          {"error": str(e)})

        result.summary = self._build_summary(result)
        self._save_execution_result(result)

        return result

    def _prepare_sandbox(self, result: ExecutionResult) -> None:
        """准备演练沙箱环境"""
        if not self.temp_dir:
            return

        self._log_entry(result, "sandbox_prepare", "sandbox", ExecutionStatus.RUNNING,
                      "准备演练沙箱环境",
                      {"source_dir": str(self.source_dir)})

        tiles_dir = self.source_dir / "tiles"
        parcels_dir = self.source_dir / "parcels"
        tasks_dir = self.source_dir / "tasks"
        rollback_dir = self.source_dir / "rollback"

        sandbox_tiles = self.temp_dir / "tiles"
        sandbox_parcels = self.temp_dir / "parcels"
        sandbox_tasks = self.temp_dir / "tasks"
        sandbox_rollback = self.temp_dir / "rollback"

        if tiles_dir.exists():
            shutil.copytree(tiles_dir, sandbox_tiles, dirs_exist_ok=True)
        if parcels_dir.exists():
            shutil.copytree(parcels_dir, sandbox_parcels, dirs_exist_ok=True)
        if tasks_dir.exists():
            shutil.copytree(tasks_dir, sandbox_tasks, dirs_exist_ok=True)
        if rollback_dir.exists():
            shutil.copytree(rollback_dir, sandbox_rollback, dirs_exist_ok=True)

        self._log_entry(result, "sandbox_ready", "sandbox", ExecutionStatus.SUCCESS,
                      "演练沙箱环境准备完成",
                      {"sandbox_dir": str(self.temp_dir)})

    def _execute_action(self, action: PatchAction, result: ExecutionResult) -> None:
        """执行单个操作（演练模式）"""
        start_time = datetime.now()

        self._log_entry(result, action.action_id, action.action_type.value, ExecutionStatus.RUNNING,
                      f"开始执行: {action.description}",
                      action.details.copy())

        try:
            if action.action_type == PatchActionType.ADD_TILE:
                self._simulate_add_tile(action, result)
            elif action.action_type == PatchActionType.UPDATE_PARCEL:
                self._simulate_update_parcel(action, result)
            elif action.action_type == PatchActionType.REMOVE_DUPLICATE_TASK:
                self._simulate_remove_duplicate_task(action, result)
            elif action.action_type == PatchActionType.ADD_ROLLBACK_PACKAGE:
                self._simulate_add_rollback_package(action, result)
            elif action.action_type == PatchActionType.SYNC_TERMINAL:
                self._simulate_sync_terminal(action, result)
            elif action.action_type == PatchActionType.RESOLVE_ERROR:
                self._simulate_resolve_error(action, result)
            else:
                self._log_entry(result, action.action_id, action.action_type.value, ExecutionStatus.SKIPPED,
                              f"跳过未知操作类型: {action.action_type}",
                              action.details.copy())
                result.skipped_count += 1
                return

            duration = (datetime.now() - start_time).total_seconds()
            self._log_entry(result, action.action_id, action.action_type.value, ExecutionStatus.SUCCESS,
                          f"执行完成: {action.description}",
                          {**action.details, "duration_seconds": duration},
                          duration)
            result.success_count += 1

        except Exception as e:
            duration = (datetime.now() - start_time).total_seconds()
            self._log_entry(result, action.action_id, action.action_type.value, ExecutionStatus.FAILED,
                          f"执行失败: {e}",
                          {**action.details, "error": str(e)},
                          duration)
            result.failed_count += 1

    def _simulate_add_tile(self, action: PatchAction, result: ExecutionResult) -> None:
        """模拟添加瓦片"""
        if not self.temp_dir:
            return

        sandbox_tiles = self.temp_dir / "tiles"
        sandbox_tiles.mkdir(parents=True, exist_ok=True)

        details = action.details
        missing_count = details.get("total_missing", 0)
        sample_tiles = details.get("missing_tile_sample", [])

        for tile_id in sample_tiles[:5]:
            try:
                z, x, y = map(int, tile_id.split("/"))
                tile_dir = sandbox_tiles / str(z) / str(x)
                tile_dir.mkdir(parents=True, exist_ok=True)

                tile_file = tile_dir / f"{y}.png"
                tile_file.write_text(f"SIMULATED_TILE_{tile_id}")

            except ValueError:
                continue

        action.details["simulated_tiles_count"] = min(len(sample_tiles), 5)
        action.details["total_tiles_to_add"] = missing_count

    def _simulate_update_parcel(self, action: PatchAction, result: ExecutionResult) -> None:
        """模拟更新地块"""
        if not self.temp_dir:
            return

        sandbox_parcels = self.temp_dir / "parcels"
        sandbox_parcels.mkdir(parents=True, exist_ok=True)

        details = action.details
        parcel_id = details.get("parcel_id", "unknown")
        target_version = details.get("target_version", "unknown")
        current_version = details.get("current_version", "unknown")

        update_marker = sandbox_parcels / f"{parcel_id}_update_marker.json"
        update_marker.write_text(f"""{{
    "parcel_id": "{parcel_id}",
    "action": "update",
    "from_version": "{current_version}",
    "to_version": "{target_version}",
    "simulated_at": "{datetime.now().isoformat()}"
}}""")

        action.details["update_marker_created"] = str(update_marker)

    def _simulate_remove_duplicate_task(self, action: PatchAction, result: ExecutionResult) -> None:
        """模拟移除重复任务"""
        if not self.temp_dir:
            return

        sandbox_tasks = self.temp_dir / "tasks"
        sandbox_tasks.mkdir(parents=True, exist_ok=True)

        details = action.details
        task_id = details.get("task_id", "unknown")
        receive_count = details.get("receive_count", 0)

        dedup_marker = sandbox_tasks / f"{task_id}_dedup_marker.json"
        dedup_marker.write_text(f"""{{
    "task_id": "{task_id}",
    "action": "deduplicate",
    "original_receive_count": {receive_count},
    "simulated_at": "{datetime.now().isoformat()}"
}}""")

        action.details["dedup_marker_created"] = str(dedup_marker)

    def _simulate_add_rollback_package(self, action: PatchAction, result: ExecutionResult) -> None:
        """模拟添加回滚包"""
        if not self.temp_dir:
            return

        sandbox_rollback = self.temp_dir / "rollback"
        sandbox_rollback.mkdir(parents=True, exist_ok=True)

        package_name = f"rollback_simulated_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        package_file = sandbox_rollback / f"{package_name}.zip"
        package_file.write_text("SIMULATED_ROLLBACK_PACKAGE_CONTENT")

        meta_file = sandbox_rollback / f"{package_name}.meta.json"
        meta_file.write_text(f"""{{
    "package_id": "{package_name}",
    "version": "1.0.0",
    "created_at": "{datetime.now().isoformat()}",
    "simulated": true
}}""")

        action.details["simulated_package"] = package_name
        action.details["package_file"] = str(package_file)

    def _simulate_sync_terminal(self, action: PatchAction, result: ExecutionResult) -> None:
        """模拟同步终端"""
        if not self.temp_dir:
            return

        sandbox_terminals = self.temp_dir / "terminals"
        sandbox_terminals.mkdir(parents=True, exist_ok=True)

        terminal_id = action.target_terminal or "unknown"
        sync_marker = sandbox_terminals / f"{terminal_id}_sync_marker.json"
        sync_marker.write_text(f"""{{
    "terminal_id": "{terminal_id}",
    "action": "sync",
    "description": "{action.description}",
    "simulated_at": "{datetime.now().isoformat()}"
}}""")

        action.details["sync_marker_created"] = str(sync_marker)

    def _simulate_resolve_error(self, action: PatchAction, result: ExecutionResult) -> None:
        """模拟解决错误"""
        if not self.temp_dir:
            return

        sandbox_errors = self.temp_dir / "error_resolutions"
        sandbox_errors.mkdir(parents=True, exist_ok=True)

        resolution_id = f"resolution_{action.action_id}"
        resolution_file = sandbox_errors / f"{resolution_id}.json"
        resolution_file.write_text(f"""{{
    "resolution_id": "{resolution_id}",
    "action_id": "{action.action_id}",
    "description": "{action.description}",
    "details": {action.details},
    "simulated_at": "{datetime.now().isoformat()}"
}}""")

        action.details["resolution_file"] = str(resolution_file)

    def _log_entry(self, result: ExecutionResult, action_id: str, action_type: str,
                   status: ExecutionStatus, message: str, details: Dict[str, Any],
                   duration: float = 0.0) -> None:
        """添加日志条目"""
        entry = JournalEntry(
            timestamp=datetime.now(),
            action_id=action_id,
            action_type=action_type,
            status=status,
            message=message,
            details=details.copy(),
            duration_seconds=duration
        )
        result.journal.append(entry)

    def _priority_order(self, priority: PatchPriority) -> int:
        """优先级排序顺序"""
        order = {
            PatchPriority.CRITICAL: 0,
            PatchPriority.HIGH: 1,
            PatchPriority.MEDIUM: 2,
            PatchPriority.LOW: 3,
        }
        return order.get(priority, 3)

    def _build_summary(self, result: ExecutionResult) -> Dict[str, Any]:
        """构建执行摘要"""
        summary = {
            "plan_id": result.plan_id,
            "executed_at": result.executed_at.isoformat(),
            "temp_dir": str(result.temp_dir),
            "final_status": result.status.value,
            "counts": {
                "total": len(result.journal),
                "success": result.success_count,
                "failed": result.failed_count,
                "skipped": result.skipped_count
            },
            "by_type": {},
            "by_status": {
                "success": [],
                "failed": [],
                "skipped": []
            }
        }

        type_counts: Dict[str, int] = {}
        for entry in result.journal:
            action_type = entry.action_type
            type_counts[action_type] = type_counts.get(action_type, 0) + 1

            if entry.status == ExecutionStatus.SUCCESS:
                summary["by_status"]["success"].append(entry.action_id)
            elif entry.status == ExecutionStatus.FAILED:
                summary["by_status"]["failed"].append(entry.action_id)
            elif entry.status == ExecutionStatus.SKIPPED:
                summary["by_status"]["skipped"].append(entry.action_id)

        summary["by_type"] = type_counts

        return summary

    def _save_execution_result(self, result: ExecutionResult) -> None:
        """保存执行结果"""
        output_dir = self.work_dir / ".sync_index" / "dry_runs"
        output_dir.mkdir(parents=True, exist_ok=True)

        result_file = output_dir / f"{result.plan_id}_result.json"
        save_json(result.to_dict(), result_file)

        journal_file = output_dir / f"{result.plan_id}_journal.json"
        journal_data = {
            "plan_id": result.plan_id,
            "generated_at": datetime.now().isoformat(),
            "journal": [j.to_dict() for j in result.journal]
        }
        save_json(journal_data, journal_file)

    def cleanup_temp_dir(self) -> None:
        """清理临时目录"""
        if self.temp_dir and self.temp_dir.exists():
            try:
                shutil.rmtree(self.temp_dir)
            except Exception:
                pass
