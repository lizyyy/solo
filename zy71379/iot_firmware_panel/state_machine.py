"""灰度状态机 - 设备级和批次级状态流转

状态流转图（设备级）:

  PENDING ──安全检测──► PENDING_CONFIRM (待人工确认)
     │
     │  安全通过
     ▼
  ROLLING ──成功──► SUCCESS
     │
     │  失败
     ▼
  FAILED ──触发回滚──► ROLLBACK ──成功──► ROLLED_BACK
                        │
                        │  失败
                        ▼
                   ROLLBACK_FAILED

状态流转图（批次级）:

  BATCH_PENDING ──开始──► BATCH_ROLLING ──全部成功──► BATCH_SUCCESS
                              │
                              ├──异常暂停──► BATCH_PAUSED
                              │
                              ├──失败过多──► BATCH_FAILED ──回滚──► BATCH_ROLLING_BACK ──► BATCH_ROLLED_BACK
                              │
                              └──需要确认──► 暂停等待确认
"""

from datetime import datetime
from typing import List, Optional, Callable, Tuple
from .models import (
    Device, Batch, GrayscaleTask,
    GrayscaleState, BatchState, ConfirmReason, DeviceStatus
)


class StateTransitionError(Exception):
    """状态转换错误"""
    pass


class GrayscaleStateMachine:
    """设备级灰度状态机"""

    ALLOWED_TRANSITIONS = {
        GrayscaleState.PENDING: [
            GrayscaleState.PENDING_CONFIRM,
            GrayscaleState.ROLLING,
        ],
        GrayscaleState.PENDING_CONFIRM: [
            GrayscaleState.PENDING,
            GrayscaleState.ROLLING,
        ],
        GrayscaleState.ROLLING: [
            GrayscaleState.SUCCESS,
            GrayscaleState.FAILED,
            GrayscaleState.PENDING_CONFIRM,
        ],
        GrayscaleState.SUCCESS: [
            GrayscaleState.ROLLBACK,
        ],
        GrayscaleState.FAILED: [
            GrayscaleState.ROLLBACK,
            GrayscaleState.PENDING_CONFIRM,
            GrayscaleState.ROLLING,
        ],
        GrayscaleState.ROLLBACK: [
            GrayscaleState.ROLLED_BACK,
            GrayscaleState.ROLLBACK_FAILED,
        ],
        GrayscaleState.ROLLED_BACK: [
            GrayscaleState.ROLLING,
        ],
        GrayscaleState.ROLLBACK_FAILED: [
            GrayscaleState.ROLLBACK,
            GrayscaleState.PENDING_CONFIRM,
        ],
    }

    @classmethod
    def can_transition(cls, from_state: GrayscaleState, to_state: GrayscaleState) -> bool:
        """检查是否允许状态转换"""
        return to_state in cls.ALLOWED_TRANSITIONS.get(from_state, [])

    @classmethod
    def transition(cls, device: Device, to_state: GrayscaleState,
                   reason: Optional[str] = None,
                   confirm_reasons: Optional[List[ConfirmReason]] = None) -> Device:
        """执行状态转换"""
        if not cls.can_transition(device.processed_current_state, to_state):
            raise StateTransitionError(
                f"不允许的状态转换: {device.processed_current_state.value} → {to_state.value} "
                f"(设备: {device.original_device_id})"
            )

        device.processed_current_state = to_state
        device.meta_updated_at = datetime.now()

        if confirm_reasons:
            device.processed_confirm_reasons = confirm_reasons

        if to_state == GrayscaleState.FAILED:
            device.processed_failure_count += 1
            device.processed_last_failure_time = datetime.now()
            if reason:
                device.processed_upgrade_log = (device.processed_upgrade_log or "") + \
                    f"\n[失败 {device.processed_failure_count}] {datetime.now().isoformat()}: {reason}"

        if to_state == GrayscaleState.SUCCESS and reason:
            device.processed_upgrade_log = (device.processed_upgrade_log or "") + \
                f"\n[成功] {datetime.now().isoformat()}: {reason}"

        if to_state in [GrayscaleState.ROLLED_BACK, GrayscaleState.ROLLBACK_FAILED] and reason:
            device.processed_rollback_log = (device.processed_rollback_log or "") + \
                f"\n[{to_state.value}] {datetime.now().isoformat()}: {reason}"

        return device

    @classmethod
    def mark_pending_confirm(cls, device: Device, reasons: List[ConfirmReason]) -> Device:
        """标记为待确认"""
        return cls.transition(
            device,
            GrayscaleState.PENDING_CONFIRM,
            confirm_reasons=reasons,
            reason=f"待确认原因: {', '.join([r.value for r in reasons])}"
        )

    @classmethod
    def confirm_and_proceed(cls, device: Device, confirmed: bool = True) -> Device:
        """确认后继续或取消"""
        if device.processed_current_state != GrayscaleState.PENDING_CONFIRM:
            raise StateTransitionError(
                f"设备 {device.original_device_id} 不处于待确认状态"
            )

        if confirmed:
            device.processed_confirm_reasons = []
            return cls.transition(device, GrayscaleState.PENDING)
        else:
            device.processed_confirm_reasons = []
            return device


class BatchStateMachine:
    """批次级状态机"""

    ALLOWED_TRANSITIONS = {
        BatchState.BATCH_PENDING: [
            BatchState.BATCH_ROLLING,
        ],
        BatchState.BATCH_ROLLING: [
            BatchState.BATCH_SUCCESS,
            BatchState.BATCH_FAILED,
            BatchState.BATCH_PAUSED,
            BatchState.BATCH_ROLLING_BACK,
        ],
        BatchState.BATCH_PAUSED: [
            BatchState.BATCH_ROLLING,
            BatchState.BATCH_ROLLING_BACK,
            BatchState.BATCH_FAILED,
        ],
        BatchState.BATCH_FAILED: [
            BatchState.BATCH_ROLLING_BACK,
            BatchState.BATCH_ROLLING,
        ],
        BatchState.BATCH_ROLLING_BACK: [
            BatchState.BATCH_ROLLED_BACK,
            BatchState.BATCH_FAILED,
        ],
        BatchState.BATCH_ROLLED_BACK: [
            BatchState.BATCH_ROLLING,
        ],
        BatchState.BATCH_SUCCESS: [
            BatchState.BATCH_ROLLING_BACK,
        ],
    }

    @classmethod
    def can_transition(cls, from_state: BatchState, to_state: BatchState) -> bool:
        return to_state in cls.ALLOWED_TRANSITIONS.get(from_state, [])

    @classmethod
    def transition(cls, batch: Batch, to_state: BatchState) -> Batch:
        if not cls.can_transition(batch.processed_state, to_state):
            raise StateTransitionError(
                f"不允许的批次状态转换: {batch.processed_state.value} → {to_state.value} "
                f"(批次: {batch.original_batch_id})"
            )

        batch.processed_state = to_state
        batch.meta_updated_at = datetime.now()
        return batch

    @classmethod
    def update_statistics(cls, batch: Batch) -> Batch:
        """更新批次统计数据"""
        stats = batch.get_statistics()
        batch.processed_success_count = stats["success"]
        batch.processed_failed_count = stats["failed"] + stats["rollback_failed"]
        batch.processed_pending_count = stats["pending"] + stats["rolling"]
        batch.processed_rollback_count = stats["rollback"] + stats["rolled_back"]
        batch.processed_pending_confirm_count = stats["pending_confirm"]
        batch.meta_updated_at = datetime.now()
        return batch

    @classmethod
    def auto_advance_state(cls, batch: Batch,
                           failure_threshold: float = 0.3,
                           pending_confirm_pause: bool = True) -> Tuple[Batch, List[str]]:
        """根据设备状态自动推进批次状态
        返回: (更新后的批次, 决策日志)
        """
        logs = []
        stats = batch.get_statistics()
        total = stats["total"]

        if total == 0:
            return batch, ["批次为空，无设备"]

        failed_rate = (stats["failed"] + stats["rollback_failed"]) / total
        pending_confirm = stats["pending_confirm"]
        pending = stats["pending"] + stats["rolling"]

        if pending_confirm > 0 and pending_confirm_pause:
            if batch.processed_state == BatchState.BATCH_ROLLING:
                cls.transition(batch, BatchState.BATCH_PAUSED)
                logs.append(f"批次暂停: 存在 {pending_confirm} 个设备待确认")

        if failed_rate > failure_threshold:
            if batch.processed_state in [BatchState.BATCH_ROLLING, BatchState.BATCH_PAUSED]:
                cls.transition(batch, BatchState.BATCH_FAILED)
                logs.append(f"批次标记为失败: 失败率 {failed_rate:.1%} > 阈值 {failure_threshold:.1%}")

        if pending == 0 and pending_confirm == 0:
            if stats["failed"] == 0 and stats["rollback_failed"] == 0 and stats["rolled_back"] == 0:
                if batch.processed_state == BatchState.BATCH_ROLLING:
                    cls.transition(batch, BatchState.BATCH_SUCCESS)
                    logs.append("批次完成: 全部成功")
            elif stats["rolled_back"] > 0 and stats["rollback_failed"] == 0:
                if batch.processed_state == BatchState.BATCH_ROLLING_BACK:
                    cls.transition(batch, BatchState.BATCH_ROLLED_BACK)
                    logs.append("批次回滚完成")

        cls.update_statistics(batch)
        return batch, logs


class TaskStateManager:
    """任务级状态管理器"""

    @classmethod
    def update_statistics(cls, task: GrayscaleTask) -> GrayscaleTask:
        """更新任务统计"""
        total_success = 0
        total_failed = 0
        total_pending = 0
        total_rollback = 0
        total_pending_confirm = 0

        for batch in task.processed_batches:
            BatchStateMachine.update_statistics(batch)
            stats = batch.get_statistics()
            total_success += stats["success"]
            total_failed += stats["failed"] + stats["rollback_failed"]
            total_pending += stats["pending"] + stats["rolling"]
            total_rollback += stats["rollback"] + stats["rolled_back"]
            total_pending_confirm += stats["pending_confirm"]

        task.processed_total_success = total_success
        task.processed_total_failed = total_failed
        task.processed_total_pending = total_pending
        task.processed_total_rollback = total_rollback
        task.processed_total_pending_confirm = total_pending_confirm
        task.meta_updated_at = datetime.now()
        return task

    @classmethod
    def process_all_batches(cls, task: GrayscaleTask,
                            device_processor: Callable[[Device], Device]) -> GrayscaleTask:
        """处理所有批次中的设备"""
        for batch in task.processed_batches:
            for i, device in enumerate(batch.processed_devices):
                batch.processed_devices[i] = device_processor(device)
            BatchStateMachine.update_statistics(batch)

        cls.update_statistics(task)
        return task
