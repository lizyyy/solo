"""回滚引擎与日志聚合

回滚策略：
1. 自动回滚：设备升级失败后自动触发
2. 手动回滚：人工指定设备或批次回滚
3. 批次回滚：整个批次失败时触发全量回滚

日志聚合：
- 按设备聚合所有失败日志、回滚日志、升级日志
- 支持按批次、按状态、按时间范围筛选
"""

from datetime import datetime
from typing import List, Dict, Callable, Tuple, Optional
from collections import defaultdict

from .models import (
    Device, Batch, GrayscaleTask, RollbackRecord, AggregatedLog,
    GrayscaleState, BatchState, DeviceStatus
)
from .state_machine import GrayscaleStateMachine, BatchStateMachine, TaskStateManager
from .batch_control import SecurityChecker, MAX_FAILURE_THRESHOLD


class RollbackEngine:
    """回滚引擎"""

    def __init__(self):
        self.rollback_records: List[RollbackRecord] = []
        self.rollback_logs: List[str] = []

    def _log(self, message: str):
        self.rollback_logs.append(f"[{datetime.now().isoformat()}] {message}")

    def create_rollback_record(self, device: Device,
                               reason: str,
                               failure_log: Optional[str] = None) -> RollbackRecord:
        """创建回滚记录"""
        record = RollbackRecord(
            original_device_id=device.original_device_id,
            original_from_version=device.processed_target_version or device.original_firmware_version,
            original_to_version=device.original_firmware_version,
            original_reason=reason,
            original_failure_log=failure_log or device.original_failure_log
        )
        self.rollback_records.append(record)
        return record

    def rollback_device(self, device: Device,
                        rollback_fn: Callable[[Device], Tuple[bool, str]],
                        reason: str = "自动回滚") -> Tuple[Device, RollbackRecord, str]:
        """回滚单个设备"""
        if device.processed_current_state not in [
            GrayscaleState.FAILED,
            GrayscaleState.SUCCESS,
            GrayscaleState.ROLLBACK_FAILED,
        ]:
            return device, None, f"设备 {device.original_device_id} 状态 {device.processed_current_state.value} 不允许回滚"

        record = self.create_rollback_record(device, reason)
        device.processed_rollback_from_version = record.original_from_version

        try:
            GrayscaleStateMachine.transition(device, GrayscaleState.ROLLBACK)
            self._log(f"[回滚开始] {device.original_device_id}: {record.original_from_version} → {record.original_to_version}")

            success, log = rollback_fn(device)
            record.processed_rollback_log = log

            if success:
                GrayscaleStateMachine.transition(
                    device, GrayscaleState.ROLLED_BACK, reason=log
                )
                record.processed_rollback_success = True
                result_log = f"[回滚成功] {device.original_device_id}: {log}"
            else:
                GrayscaleStateMachine.transition(
                    device, GrayscaleState.ROLLBACK_FAILED, reason=log
                )
                record.processed_rollback_success = False
                result_log = f"[回滚失败] {device.original_device_id}: {log}"

            self._log(result_log)
            return device, record, result_log

        except Exception as e:
            error_msg = f"回滚异常: {str(e)}"
            GrayscaleStateMachine.transition(
                device, GrayscaleState.ROLLBACK_FAILED, reason=error_msg
            )
            record.processed_rollback_log = error_msg
            record.processed_rollback_success = False
            self._log(f"[回滚异常] {device.original_device_id}: {error_msg}")
            return device, record, error_msg

    def auto_rollback_failed(self, batch: Batch,
                             rollback_fn: Callable[[Device], Tuple[bool, str]]) -> Tuple[Batch, List[str]]:
        """自动回滚批次中所有失败设备"""
        logs = []
        failed_devices = [
            d for d in batch.processed_devices
            if d.processed_current_state == GrayscaleState.FAILED
        ]

        self._log(f"批次 {batch.original_batch_id} 触发自动回滚，{len(failed_devices)} 个设备需要回滚")

        if failed_devices and batch.processed_state == BatchState.BATCH_ROLLING:
            BatchStateMachine.transition(batch, BatchState.BATCH_ROLLING_BACK)

        for device in failed_devices:
            device, record, log = self.rollback_device(
                device, rollback_fn, reason="批次自动回滚"
            )
            logs.append(log)

        BatchStateMachine.update_statistics(batch)
        return batch, logs

    def rollback_batch(self, batch: Batch,
                       rollback_fn: Callable[[Device], Tuple[bool, str]],
                       include_success: bool = False) -> Tuple[Batch, List[str]]:
        """回滚整个批次
        include_success: 是否回滚已成功的设备
        """
        logs = []

        if batch.processed_state not in [
            BatchState.BATCH_ROLLING,
            BatchState.BATCH_PAUSED,
            BatchState.BATCH_FAILED,
            BatchState.BATCH_SUCCESS,
        ]:
            return batch, [f"批次 {batch.original_batch_id} 状态 {batch.processed_state.value} 不允许回滚"]

        BatchStateMachine.transition(batch, BatchState.BATCH_ROLLING_BACK)
        self._log(f"批次 {batch.original_batch_id} 开始全量回滚")

        for i, device in enumerate(batch.processed_devices):
            should_rollback = (
                device.processed_current_state == GrayscaleState.FAILED
                or device.processed_current_state == GrayscaleState.SUCCESS
                and include_success
            )

            if should_rollback:
                device, record, log = self.rollback_device(
                    device, rollback_fn, reason="批次全量回滚"
                )
                batch.processed_devices[i] = device
                logs.append(log)

        batch, auto_logs = BatchStateMachine.auto_advance_state(batch)
        logs.extend(auto_logs)

        BatchStateMachine.update_statistics(batch)
        return batch, logs

    def rollback_task(self, task: GrayscaleTask,
                      rollback_fn: Callable[[Device], Tuple[bool, str]],
                      include_success: bool = False) -> Tuple[GrayscaleTask, List[str]]:
        """回滚整个任务"""
        all_logs = []
        for batch in task.processed_batches:
            batch, logs = self.rollback_batch(batch, rollback_fn, include_success)
            all_logs.extend(logs)

        TaskStateManager.update_statistics(task)
        return task, all_logs

    def get_rollback_records_by_device(self, device_id: str) -> List[RollbackRecord]:
        """按设备查询回滚记录"""
        return [r for r in self.rollback_records if r.original_device_id == device_id]

    def get_rollback_records_by_batch(self, batch: Batch) -> List[RollbackRecord]:
        """按批次查询回滚记录"""
        device_ids = set(batch.original_device_ids)
        return [r for r in self.rollback_records if r.original_device_id in device_ids]


class LogAggregator:
    """日志聚合器"""

    @staticmethod
    def _parse_log_lines(log_text: Optional[str]) -> List[str]:
        """解析日志文本为行列表"""
        if not log_text:
            return []
        return [line.strip() for line in log_text.strip().split("\n") if line.strip()]

    @classmethod
    def aggregate_device_logs(cls, device: Device) -> AggregatedLog:
        """聚合单个设备的所有日志"""
        failure_logs = []
        if device.original_failure_log:
            failure_logs.append(f"[原始失败日志] {device.original_failure_log}")
        failure_logs.extend(cls._parse_log_lines(device.processed_upgrade_log))
        failure_logs = [l for l in failure_logs if "[失败" in l or "[异常" in l or "原始失败日志" in l]

        return AggregatedLog(
            device_id=device.original_device_id,
            failure_count=device.processed_failure_count,
            last_failure_time=device.processed_last_failure_time,
            failure_logs=failure_logs,
            rollback_logs=cls._parse_log_lines(device.processed_rollback_log),
            upgrade_logs=cls._parse_log_lines(device.processed_upgrade_log)
        )

    @classmethod
    def aggregate_batch_logs(cls, batch: Batch) -> Dict[str, AggregatedLog]:
        """聚合批次中所有设备的日志"""
        result = {}
        for device in batch.processed_devices:
            result[device.original_device_id] = cls.aggregate_device_logs(device)
        return result

    @classmethod
    def aggregate_task_logs(cls, task: GrayscaleTask) -> Dict[str, AggregatedLog]:
        """聚合任务中所有设备的日志"""
        result = {}
        for batch in task.processed_batches:
            result.update(cls.aggregate_batch_logs(batch))
        return result

    @classmethod
    def get_failed_devices_logs(cls, task: GrayscaleTask) -> Dict[str, AggregatedLog]:
        """获取所有失败设备的日志聚合"""
        all_logs = cls.aggregate_task_logs(task)
        failed_devices = [
            d for d in task.get_all_devices()
            if d.processed_current_state in [
                GrayscaleState.FAILED,
                GrayscaleState.ROLLBACK_FAILED
            ]
        ]
        return {d.original_device_id: all_logs[d.original_device_id] for d in failed_devices}

    @classmethod
    def get_pending_confirm_devices(cls, task: GrayscaleTask) -> List[Device]:
        """获取所有待确认设备"""
        return [
            d for d in task.get_all_devices()
            if d.needs_confirm()
        ]

    @classmethod
    def get_failure_summary(cls, task: GrayscaleTask) -> Dict[str, List[str]]:
        """获取失败摘要 - 按失败原因分组"""
        summary: Dict[str, List[str]] = defaultdict(list)
        for device in task.get_all_devices():
            if device.processed_current_state == GrayscaleState.FAILED:
                logs = cls._parse_log_lines(device.processed_upgrade_log)
                failure_logs = [l for l in logs if "[失败" in l or "[异常" in l]
                for log in failure_logs:
                    reason = cls._extract_failure_reason(log)
                    summary[reason].append(device.original_device_id)
        return dict(summary)

    @staticmethod
    def _extract_failure_reason(log_line: str) -> str:
        """从日志行中提取失败原因"""
        if "连接超时" in log_line or "timeout" in log_line.lower():
            return "连接超时"
        elif "校验失败" in log_line or "checksum" in log_line.lower():
            return "固件校验失败"
        elif "存储空间不足" in log_line or "space" in log_line.lower():
            return "存储空间不足"
        elif "断电" in log_line or "power" in log_line.lower():
            return "设备断电"
        elif "网络" in log_line or "network" in log_line.lower():
            return "网络异常"
        else:
            return "其他错误"

    @classmethod
    def generate_log_report(cls, task: GrayscaleTask) -> Dict[str, any]:
        """生成完整的日志聚合报告"""
        return {
            "total_devices": len(task.get_all_devices()),
            "failed_devices": len([
                d for d in task.get_all_devices()
                if d.processed_current_state == GrayscaleState.FAILED
            ]),
            "rollback_devices": len([
                d for d in task.get_all_devices()
                if d.processed_current_state in [
                    GrayscaleState.ROLLED_BACK,
                    GrayscaleState.ROLLBACK,
                    GrayscaleState.ROLLBACK_FAILED
                ]
            ]),
            "pending_confirm_count": len(cls.get_pending_confirm_devices(task)),
            "failure_summary": cls.get_failure_summary(task),
            "device_logs": {
                k: v.to_dict() for k, v in cls.aggregate_task_logs(task).items()
            }
        }
