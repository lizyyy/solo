"""批次控制与安全检测

核心安全检测规则（触发则标记 PENDING_CONFIRM）：
1. 离线设备被安排升级  → OFFLINE_DEVICE
2. 目标版本 < 当前版本（版本回退） → VERSION_DOWNGRADE
3. 同一设备失败次数 >= MAX_FAILURE_THRESHOLD → TOO_MANY_FAILURES

批次控制策略：
- 按批次分组，可配置每批并行数量
- 批次间串行，批次内并行
- 支持暂停、继续、中止、回滚
"""

from datetime import datetime
from typing import List, Dict, Optional, Callable, Tuple
from packaging.version import Version, InvalidVersion

from .models import (
    Device, Batch, GrayscaleTask,
    GrayscaleState, BatchState, ConfirmReason, DeviceStatus
)
from .state_machine import GrayscaleStateMachine, BatchStateMachine, TaskStateManager


MAX_FAILURE_THRESHOLD = 3
DEFAULT_PARALLEL_PER_BATCH = 10


class SecurityCheckResult:
    """安全检测结果"""

    def __init__(self):
        self.needs_confirm: bool = False
        self.reasons: List[ConfirmReason] = []
        self.warnings: List[str] = []

    def add_reason(self, reason: ConfirmReason, warning: str):
        self.needs_confirm = True
        self.reasons.append(reason)
        self.warnings.append(warning)


class SecurityChecker:
    """安全检测器 - 核心防护层"""

    @staticmethod
    def check_offline_device(device: Device, result: SecurityCheckResult) -> None:
        """检测：离线设备误升级"""
        if device.original_online_status == DeviceStatus.OFFLINE:
            if device.processed_current_state in [GrayscaleState.PENDING, GrayscaleState.ROLLING]:
                result.add_reason(
                    ConfirmReason.OFFLINE_DEVICE,
                    f"设备 {device.original_device_id} 当前离线，但被安排升级"
                )

    @staticmethod
    def check_version_downgrade(device: Device, target_version: str, result: SecurityCheckResult) -> None:
        """检测：版本回退错误"""
        try:
            current = Version(device.original_firmware_version)
            target = Version(target_version)
            if target < current:
                result.add_reason(
                    ConfirmReason.VERSION_DOWNGRADE,
                    f"版本回退风险: {device.original_firmware_version} → {target_version}"
                )
        except InvalidVersion:
            if target_version < device.original_firmware_version:
                result.add_reason(
                    ConfirmReason.VERSION_DOWNGRADE,
                    f"版本回退风险(无法解析语义版本): {device.original_firmware_version} → {target_version}"
                )

    @staticmethod
    def check_too_many_failures(device: Device, result: SecurityCheckResult) -> None:
        """检测：失败重复计数"""
        if device.processed_failure_count >= MAX_FAILURE_THRESHOLD:
            result.add_reason(
                ConfirmReason.TOO_MANY_FAILURES,
                f"设备 {device.original_device_id} 已失败 {device.processed_failure_count} 次，"
                f"超过阈值 {MAX_FAILURE_THRESHOLD}"
            )

    @classmethod
    def check_device(cls, device: Device, target_version: Optional[str] = None) -> SecurityCheckResult:
        """对设备执行完整安全检测"""
        result = SecurityCheckResult()
        cls.check_offline_device(device, result)
        if target_version:
            cls.check_version_downgrade(device, target_version, result)
        cls.check_too_many_failures(device, result)
        return result


class BatchController:
    """批次控制器"""

    def __init__(self, parallel_per_batch: int = DEFAULT_PARALLEL_PER_BATCH,
                 failure_threshold: float = 0.3):
        self.parallel_per_batch = parallel_per_batch
        self.failure_threshold = failure_threshold
        self.decision_logs: List[str] = []

    def _log(self, message: str):
        self.decision_logs.append(f"[{datetime.now().isoformat()}] {message}")

    def create_batches_from_devices(self,
                                    devices: List[Device],
                                    target_version: str,
                                    batch_size: Optional[int] = None) -> List[Batch]:
        """根据设备列表自动创建批次
        按 original_batch 字段分组，组内再按 batch_size 拆分
        """
        batch_size = batch_size or self.parallel_per_batch

        batch_groups: Dict[str, List[Device]] = {}
        for device in devices:
            key = device.original_batch
            if key not in batch_groups:
                batch_groups[key] = []
            batch_groups[key].append(device)

        batches: List[Batch] = []
        for batch_name, group_devices in batch_groups.items():
            for i in range(0, len(group_devices), batch_size):
                sub_devices = group_devices[i:i + batch_size]
                batch_id = f"{batch_name}_{i // batch_size + 1:02d}"

                for dev in sub_devices:
                    dev.processed_target_version = target_version

                batch = Batch(
                    original_batch_id=batch_id,
                    original_batch_name=batch_name,
                    original_device_ids=[d.original_device_id for d in sub_devices],
                    original_target_version=target_version,
                    processed_devices=sub_devices
                )
                batches.append(batch)

        self._log(f"创建了 {len(batches)} 个批次，共 {len(devices)} 个设备")
        return batches

    def security_screen_devices(self, devices: List[Device],
                                target_version: str) -> Tuple[List[Device], List[str]]:
        """安全筛选设备 - 对所有设备执行安全检测
        返回: (更新后的设备列表, 检测日志)
        """
        logs = []
        for device in devices:
            check_result = SecurityChecker.check_device(device, target_version)

            if check_result.needs_confirm:
                if device.processed_current_state == GrayscaleState.PENDING:
                    GrayscaleStateMachine.mark_pending_confirm(device, check_result.reasons)
                    for warning in check_result.warnings:
                        logs.append(f"[待确认] {warning}")
                elif device.processed_current_state == GrayscaleState.ROLLING:
                    device.processed_confirm_reasons = check_result.reasons
                    for warning in check_result.warnings:
                        logs.append(f"[警告-升级中] {warning}")
            else:
                if device.processed_current_state == GrayscaleState.PENDING_CONFIRM:
                    device.processed_confirm_reasons = []
                    GrayscaleStateMachine.confirm_and_proceed(device, confirmed=True)
                    logs.append(f"[解除待确认] 设备 {device.original_device_id} 已通过安全检测")

        return devices, logs

    def get_devices_for_upgrade(self, batch: Batch) -> List[Device]:
        """获取可以升级的设备（排除待确认和已处理的）"""
        return [
            d for d in batch.processed_devices
            if d.processed_current_state == GrayscaleState.PENDING
        ]

    def process_batch_step(self, batch: Batch,
                           upgrade_fn: Callable[[Device], Tuple[bool, str]]) -> Tuple[Batch, List[str]]:
        """执行单步批次处理
        upgrade_fn: 实际升级函数，返回(是否成功, 日志信息)
        """
        step_logs = []

        if batch.processed_state == BatchState.BATCH_PENDING:
            BatchStateMachine.transition(batch, BatchState.BATCH_ROLLING)
            self._log(f"批次 {batch.original_batch_id} 开始升级")
            step_logs.append(f"批次开始: {batch.original_batch_id}")

        if batch.processed_state != BatchState.BATCH_ROLLING:
            step_logs.append(f"批次状态为 {batch.processed_state.value}，跳过处理")
            return batch, step_logs

        devices_to_upgrade = self.get_devices_for_upgrade(batch)
        devices_to_upgrade = devices_to_upgrade[:self.parallel_per_batch]

        for device in devices_to_upgrade:
            check_result = SecurityChecker.check_device(
                device, batch.original_target_version
            )
            if check_result.needs_confirm:
                GrayscaleStateMachine.mark_pending_confirm(device, check_result.reasons)
                for warning in check_result.warnings:
                    step_logs.append(f"[待确认] {warning}")
                continue

            GrayscaleStateMachine.transition(device, GrayscaleState.ROLLING)
            step_logs.append(f"[升级中] {device.original_device_id} 开始升级到 {batch.original_target_version}")

            try:
                success, upgrade_log = upgrade_fn(device)
                if success:
                    GrayscaleStateMachine.transition(
                        device, GrayscaleState.SUCCESS, reason=upgrade_log
                    )
                    step_logs.append(f"[成功] {device.original_device_id}: {upgrade_log}")
                else:
                    GrayscaleStateMachine.transition(
                        device, GrayscaleState.FAILED, reason=upgrade_log
                    )
                    step_logs.append(f"[失败] {device.original_device_id}: {upgrade_log}")

                    if device.processed_failure_count >= MAX_FAILURE_THRESHOLD:
                        GrayscaleStateMachine.mark_pending_confirm(
                            device, [ConfirmReason.TOO_MANY_FAILURES]
                        )
                        step_logs.append(
                            f"[待确认] {device.original_device_id} 失败 "
                            f"{device.processed_failure_count} 次，需人工确认"
                        )
            except Exception as e:
                GrayscaleStateMachine.transition(
                    device, GrayscaleState.FAILED, reason=f"升级异常: {str(e)}"
                )
                step_logs.append(f"[异常] {device.original_device_id}: {str(e)}")

        batch, auto_logs = BatchStateMachine.auto_advance_state(
            batch, failure_threshold=self.failure_threshold
        )
        step_logs.extend(auto_logs)

        BatchStateMachine.update_statistics(batch)
        self.decision_logs.extend(step_logs)
        return batch, step_logs

    def process_task(self, task: GrayscaleTask,
                     upgrade_fn: Callable[[Device], Tuple[bool, str]],
                     max_steps: int = 100) -> Tuple[GrayscaleTask, List[str]]:
        """处理整个任务，逐步推进所有批次"""
        all_logs = []

        TaskStateManager.update_statistics(task)

        for batch in task.processed_batches:
            self._log(f"处理批次: {batch.original_batch_id}")
            step_count = 0

            while (batch.processed_state in [BatchState.BATCH_PENDING, BatchState.BATCH_ROLLING]
                   and step_count < max_steps):
                batch, step_logs = self.process_batch_step(batch, upgrade_fn)
                all_logs.extend(step_logs)
                step_count += 1

                pending = batch.get_statistics()["pending"] + batch.get_statistics()["rolling"]
                if pending == 0:
                    break

            TaskStateManager.update_statistics(task)

        return task, all_logs

    def pause_batch(self, batch: Batch) -> Batch:
        """暂停批次"""
        if batch.processed_state == BatchState.BATCH_ROLLING:
            BatchStateMachine.transition(batch, BatchState.BATCH_PAUSED)
            self._log(f"批次 {batch.original_batch_id} 已暂停")
        return batch

    def resume_batch(self, batch: Batch) -> Batch:
        """恢复批次"""
        if batch.processed_state == BatchState.BATCH_PAUSED:
            BatchStateMachine.transition(batch, BatchState.BATCH_ROLLING)
            self._log(f"批次 {batch.original_batch_id} 已恢复")
        return batch

    def confirm_device(self, device: Device, confirmed: bool) -> Device:
        """人工确认设备"""
        if device.needs_confirm():
            device = GrayscaleStateMachine.confirm_and_proceed(device, confirmed=confirmed)
            if confirmed:
                self._log(f"设备 {device.original_device_id} 已确认，继续处理")
            else:
                self._log(f"设备 {device.original_device_id} 已取消，保持当前状态")
        return device
