"""设备固件灰度面板 - 主入口

核心能力：
1. 灰度状态机：严格的状态流转控制
2. 批次控制：按批次灰度，安全检测前置
3. 回滚机制：失败自动回滚，保留完整日志
4. 日志聚合：按设备聚合，失败原因分类
5. 报告导出：终端/JSON/Markdown 三格式一致
6. 复盘入口：历史快照，决策追溯

快速开始：
    from iot_firmware_panel import GrayscalePanel
    panel = GrayscalePanel()
    report = panel.run_full_workflow(devices, "2.0.0")
    print(report["terminal"])
"""

import os
import sys
from typing import List, Dict, Callable, Tuple, Optional, Any
from datetime import datetime

from .models import (
    Device, Batch, GrayscaleTask, GrayscaleState, BatchState,
    DeviceStatus, ConfirmReason
)
from .state_machine import (
    GrayscaleStateMachine, BatchStateMachine, TaskStateManager,
    StateTransitionError
)
from .batch_control import (
    BatchController, SecurityChecker, SecurityCheckResult,
    MAX_FAILURE_THRESHOLD
)
from .rollback_engine import RollbackEngine, LogAggregator
from .report_exporter import ReportExporter
from .history_manager import HistoryManager
from .sample_data import (
    create_sample_devices, create_sample_task,
    create_mock_upgrade_fn, create_mock_rollback_fn
)


class GrayscalePanel:
    """设备固件灰度面板 - 对外主接口"""

    def __init__(self,
                 parallel_per_batch: int = 10,
                 failure_threshold: float = 0.3,
                 auto_rollback: bool = True,
                 history_dir: Optional[str] = None):
        """
        Args:
            parallel_per_batch: 每批并行升级的设备数
            failure_threshold: 批次失败率阈值（超过则标记批次失败）
            auto_rollback: 是否自动回滚失败设备
            history_dir: 历史数据存储目录
        """
        self.batch_controller = BatchController(
            parallel_per_batch=parallel_per_batch,
            failure_threshold=failure_threshold
        )
        self.rollback_engine = RollbackEngine()
        self.history_manager = HistoryManager(history_dir) if history_dir else HistoryManager()
        self.auto_rollback = auto_rollback

        self.current_task: Optional[GrayscaleTask] = None
        self.decision_logs: List[str] = []

    def _log(self, message: str):
        timestamp = datetime.now().isoformat()
        log_entry = f"[{timestamp}] {message}"
        self.decision_logs.append(log_entry)
        self.batch_controller._log(message)

    # ===== 核心工作流 =====

    def run_full_workflow(self,
                          devices: List[Device],
                          target_version: str,
                          task_id: Optional[str] = None,
                          task_name: Optional[str] = None,
                          upgrade_fn: Optional[Callable[[Device], Tuple[bool, str]]] = None,
                          rollback_fn: Optional[Callable[[Device], Tuple[bool, str]]] = None,
                          save_history: bool = True,
                          tags: Optional[List[str]] = None,
                          notes: Optional[str] = None) -> Dict[str, Any]:
        """执行完整的灰度工作流

        流程：创建任务 → 安全检测 → 创建批次 → 执行升级 → 自动回滚 → 生成报告 → 保存历史
        """
        task_id = task_id or f"TASK-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        task_name = task_name or f"固件灰度 {target_version}"

        self._log(f"开始灰度任务: {task_id} - {task_name}")
        self._log(f"目标版本: {target_version}, 设备总数: {len(devices)}")

        # 1. 创建任务
        task = GrayscaleTask(
            original_task_id=task_id,
            original_task_name=task_name,
            original_target_version=target_version,
            original_description=notes
        )
        self.current_task = task

        # 2. 安全检测（所有设备）
        self._log("执行安全检测...")
        devices, security_logs = self.batch_controller.security_screen_devices(
            devices, target_version
        )
        for log in security_logs:
            self._log(log)

        pending_confirm = sum(1 for d in devices if d.needs_confirm())
        if pending_confirm > 0:
            self._log(f"安全检测完成，发现 {pending_confirm} 个设备待确认")
        else:
            self._log("安全检测完成，所有设备通过检测")

        # 3. 创建批次
        self._log("创建批次...")
        batches = self.batch_controller.create_batches_from_devices(
            devices, target_version
        )
        task.processed_batches = batches
        self._log(f"创建了 {len(batches)} 个批次")

        # 4. 模拟函数
        if upgrade_fn is None:
            upgrade_fn = create_mock_upgrade_fn(success_rate=0.8)
        if rollback_fn is None:
            rollback_fn = create_mock_rollback_fn(success_rate=0.9)

        # 5. 执行灰度升级
        self._log("开始执行灰度升级...")
        task, process_logs = self.batch_controller.process_task(
            task, upgrade_fn
        )
        for log in process_logs:
            self._log(log)

        # 6. 自动回滚失败设备
        if self.auto_rollback:
            failed_count = sum(
                1 for d in task.get_all_devices()
                if d.processed_current_state == GrayscaleState.FAILED
            )
            if failed_count > 0:
                self._log(f"自动回滚 {failed_count} 个失败设备...")
                task, rollback_logs = self.rollback_engine.rollback_task(
                    task, rollback_fn, include_success=False
                )
                for log in rollback_logs:
                    self._log(log)

        TaskStateManager.update_statistics(task)

        # 7. 生成报告
        self._log("生成报告...")
        reports = ReportExporter.export_all(
            task, self.rollback_engine, self.decision_logs
        )

        # 8. 保存历史
        if save_history:
            self._log("保存历史快照...")
            snapshot_file = self.history_manager.save_snapshot(
                task, self.rollback_engine, self.decision_logs, tags, notes
            )
            self._log(f"快照已保存: {snapshot_file}")

        result = {
            "task": task,
            "reports": reports,
            "rollback_engine": self.rollback_engine,
            "decision_logs": self.decision_logs,
            "pending_confirm_devices": LogAggregator.get_pending_confirm_devices(task),
            "log_report": LogAggregator.generate_log_report(task),
        }

        self._log("灰度任务完成")
        return result

    # ===== 分步操作接口 =====

    def create_task(self, task_id: str, task_name: str,
                    target_version: str, description: Optional[str] = None) -> GrayscaleTask:
        """创建灰度任务"""
        task = GrayscaleTask(
            original_task_id=task_id,
            original_task_name=task_name,
            original_target_version=target_version,
            original_description=description
        )
        self.current_task = task
        self._log(f"创建任务: {task_id} - {task_name}")
        return task

    def add_devices(self, devices: List[Device],
                    batch_size: Optional[int] = None) -> List[Batch]:
        """添加设备并创建批次"""
        if not self.current_task:
            raise ValueError("请先创建任务")

        target_version = self.current_task.original_target_version
        devices, logs = self.batch_controller.security_screen_devices(
            devices, target_version
        )
        for log in logs:
            self._log(log)

        batches = self.batch_controller.create_batches_from_devices(
            devices, target_version, batch_size
        )
        self.current_task.processed_batches.extend(batches)
        TaskStateManager.update_statistics(self.current_task)

        self._log(f"添加 {len(devices)} 个设备，创建 {len(batches)} 个批次")
        return batches

    def run_upgrade_step(self,
                         upgrade_fn: Callable[[Device], Tuple[bool, str]]) -> Dict[str, Any]:
        """执行单步升级"""
        if not self.current_task:
            raise ValueError("请先创建任务并添加设备")

        all_logs = []
        for batch in self.current_task.processed_batches:
            if batch.processed_state in [
                BatchState.BATCH_PENDING, BatchState.BATCH_ROLLING
            ]:
                batch, step_logs = self.batch_controller.process_batch_step(
                    batch, upgrade_fn
                )
                all_logs.extend(step_logs)
                for log in step_logs:
                    self._log(log)

        TaskStateManager.update_statistics(self.current_task)

        return {
            "logs": all_logs,
            "task": self.current_task
        }

    def run_rollback(self,
                     rollback_fn: Callable[[Device], Tuple[bool, str]],
                     include_success: bool = False) -> Dict[str, Any]:
        """执行回滚"""
        if not self.current_task:
            raise ValueError("请先创建任务")

        task, logs = self.rollback_engine.rollback_task(
            self.current_task, rollback_fn, include_success
        )
        for log in logs:
            self._log(log)

        TaskStateManager.update_statistics(task)

        return {
            "logs": logs,
            "task": task
        }

    def confirm_device(self, device_id: str, confirmed: bool = True) -> Optional[Device]:
        """人工确认待确认设备"""
        if not self.current_task:
            return None

        for batch in self.current_task.processed_batches:
            for i, device in enumerate(batch.processed_devices):
                if device.original_device_id == device_id:
                    device = self.batch_controller.confirm_device(device, confirmed)
                    batch.processed_devices[i] = device
                    self._log(
                        f"设备 {device_id} 已{'确认' if confirmed else '取消确认'}"
                    )
                    TaskStateManager.update_statistics(self.current_task)
                    return device
        return None

    def generate_reports(self) -> Dict[str, str]:
        """生成所有格式的报告"""
        if not self.current_task:
            raise ValueError("请先创建任务")

        return ReportExporter.export_all(
            self.current_task, self.rollback_engine, self.decision_logs
        )

    def save_current_history(self, tags: Optional[List[str]] = None,
                             notes: Optional[str] = None) -> Optional[str]:
        """保存当前任务到历史"""
        if not self.current_task:
            return None

        return self.history_manager.save_snapshot(
            self.current_task, self.rollback_engine, self.decision_logs, tags, notes
        )

    # ===== 复盘接口 =====

    def list_history(self, **kwargs) -> List:
        """查询历史记录"""
        return self.history_manager.list_history(**kwargs)

    def replay(self, task_id: str, format_type: str = "terminal") -> Optional[str]:
        """复盘：重新生成历史报告"""
        return self.history_manager.replay(task_id, format_type)

    def explain(self, task_id: str) -> Optional[str]:
        """复盘：解释历史决策过程"""
        return self.history_manager.explain(task_id)

    def compare_tasks(self, task_id_1: str, task_id_2: str) -> Optional[str]:
        """对比两个历史任务"""
        return self.history_manager.compare(task_id_1, task_id_2)

    # ===== 安全检测接口 =====

    def check_device_security(self, device: Device,
                              target_version: Optional[str] = None) -> SecurityCheckResult:
        """对单个设备执行安全检测"""
        return SecurityChecker.check_device(device, target_version)

    def get_pending_confirm_devices(self) -> List[Device]:
        """获取当前所有待确认设备"""
        if not self.current_task:
            return []
        return LogAggregator.get_pending_confirm_devices(self.current_task)

    # ===== 工具方法 =====

    @staticmethod
    def create_sample_devices() -> List[Device]:
        """创建样例设备数据"""
        return create_sample_devices()

    @staticmethod
    def create_mock_upgrade_fn(success_rate: float = 0.8):
        """创建模拟升级函数"""
        return create_mock_upgrade_fn(success_rate)

    @staticmethod
    def create_mock_rollback_fn(success_rate: float = 0.9):
        """创建模拟回滚函数"""
        return create_mock_rollback_fn(success_rate)

    def print_report(self, format_type: str = "terminal"):
        """打印报告到终端"""
        if not self.current_task:
            print("没有可报告的任务")
            return

        report = ReportExporter.export(
            self.current_task, self.rollback_engine, self.decision_logs, format_type
        )
        print(report)
