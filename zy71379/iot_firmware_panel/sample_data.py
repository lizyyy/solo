"""样例数据包 - 包含各种场景的测试数据

样例数据设计原则：
1. 覆盖所有核心场景：成功、失败、离线、版本回退、多次失败
2. 数据真实可信，包含设备编号、固件版本、批次、在线状态、失败日志
3. 明确区分 original_*（原始信息）和 processed_*（处理结果）
"""

from typing import List
from datetime import datetime
import random

from .models import Device, DeviceStatus, GrayscaleTask, Batch, GrayscaleState


def create_sample_devices() -> List[Device]:
    """创建样例设备列表 - 覆盖各种场景

    场景设计：
    - 批次A: 8台在线设备，目标版本2.0.0，预期：大部分成功，1台失败，1台离线
    - 批次B: 6台设备，包含版本回退场景（目标版本1.2.0 < 当前1.5.0）
    - 批次C: 5台设备，包含多次失败场景（已有失败记录）
    """
    devices = []

    # ===== 批次A: 正常升级场景 =====
    batch_a_devices = [
        ("DEV-A001", "1.8.0", "batch_a", DeviceStatus.ONLINE, None),
        ("DEV-A002", "1.8.0", "batch_a", DeviceStatus.ONLINE, None),
        ("DEV-A003", "1.8.0", "batch_a", DeviceStatus.ONLINE, None),
        ("DEV-A004", "1.8.0", "batch_a", DeviceStatus.ONLINE, None),
        ("DEV-A005", "1.8.0", "batch_a", DeviceStatus.ONLINE, None),
        ("DEV-A006", "1.8.0", "batch_a", DeviceStatus.OFFLINE, None),  # 离线设备
        ("DEV-A007", "1.8.0", "batch_a", DeviceStatus.ONLINE, None),
        ("DEV-A008", "1.8.0", "batch_a", DeviceStatus.ONLINE, "上次升级超时，重试成功"),  # 已有失败日志
    ]

    for dev_id, version, batch, status, fail_log in batch_a_devices:
        devices.append(Device(
            original_device_id=dev_id,
            original_firmware_version=version,
            original_batch=batch,
            original_online_status=status,
            original_failure_log=fail_log,
        ))

    # ===== 批次B: 版本回退场景 =====
    batch_b_devices = [
        ("DEV-B001", "1.5.0", "batch_b", DeviceStatus.ONLINE, None),  # 版本回退风险
        ("DEV-B002", "1.5.0", "batch_b", DeviceStatus.ONLINE, None),  # 版本回退风险
        ("DEV-B003", "1.5.0", "batch_b", DeviceStatus.ONLINE, None),  # 版本回退风险
        ("DEV-B004", "1.0.0", "batch_b", DeviceStatus.ONLINE, None),  # 正常升级
        ("DEV-B005", "1.0.0", "batch_b", DeviceStatus.ONLINE, None),  # 正常升级
        ("DEV-B006", "1.0.0", "batch_b", DeviceStatus.OFFLINE, None),  # 离线 + 正常升级
    ]

    for dev_id, version, batch, status, fail_log in batch_b_devices:
        devices.append(Device(
            original_device_id=dev_id,
            original_firmware_version=version,
            original_batch=batch,
            original_online_status=status,
            original_failure_log=fail_log,
        ))

    # ===== 批次C: 多次失败场景 =====
    batch_c_devices = [
        ("DEV-C001", "1.2.0", "batch_c", DeviceStatus.ONLINE, None),
        ("DEV-C002", "1.2.0", "batch_c", DeviceStatus.ONLINE, None),
        ("DEV-C003", "1.2.0", "batch_c", DeviceStatus.ONLINE, None),
        ("DEV-C004", "1.2.0", "batch_c", DeviceStatus.ONLINE, None),
        ("DEV-C005", "1.2.0", "batch_c", DeviceStatus.ONLINE, None),
    ]

    for i, (dev_id, version, batch, status, fail_log) in enumerate(batch_c_devices):
        dev = Device(
            original_device_id=dev_id,
            original_firmware_version=version,
            original_batch=batch,
            original_online_status=status,
            original_failure_log=fail_log,
        )
        # 为DEV-C001模拟已有的2次失败记录
        if i == 0:
            dev.processed_failure_count = 2
            dev.processed_last_failure_time = datetime.now()
            dev.processed_upgrade_log = (
                "\n[失败 1] 2026-05-28T10:30:00: 连接超时，设备无响应"
                "\n[失败 2] 2026-05-28T14:15:00: 固件校验失败，MD5不匹配"
            )
        devices.append(dev)

    return devices


def create_mock_upgrade_fn(success_rate: float = 0.8):
    """创建模拟升级函数

    模拟真实升级场景：
    - 大部分成功
    - 小部分失败（连接超时、校验失败、存储空间不足等）
    - 特定设备固定失败（用于测试回滚）
    """
    failure_reasons = [
        "连接超时，设备无响应",
        "固件校验失败，MD5不匹配",
        "存储空间不足，无法写入固件",
        "设备断电，升级中断",
        "网络异常，数据包丢失",
        "升级脚本执行错误，返回码1",
    ]

    always_fail = {"DEV-A003", "DEV-C002", "DEV-C003"}
    always_timeout = {"DEV-A005", "DEV-B005"}

    def mock_upgrade(device: Device):
        dev_id = device.original_device_id

        if dev_id in always_fail:
            reason = random.choice(failure_reasons)
            return False, reason

        if dev_id in always_timeout:
            return False, "连接超时，设备无响应"

        if random.random() < (1 - success_rate):
            reason = random.choice(failure_reasons)
            return False, reason

        return True, f"升级成功，固件版本已更新为 {device.processed_target_version}"

    return mock_upgrade


def create_mock_rollback_fn(success_rate: float = 0.9):
    """创建模拟回滚函数"""
    def mock_rollback(device: Device):
        if random.random() < (1 - success_rate):
            return False, "回滚失败：固件分区损坏，无法恢复旧版本"

        return True, f"回滚成功，已恢复到版本 {device.original_firmware_version}"

    return mock_rollback


def create_sample_task(task_id: str = "TASK-2026-001",
                       task_name: str = "IoT设备固件v2.0.0灰度发布",
                       target_version: str = "2.0.0") -> GrayscaleTask:
    """创建样例灰度任务"""
    devices = create_sample_devices()

    task = GrayscaleTask(
        original_task_id=task_id,
        original_task_name=task_name,
        original_target_version=target_version,
        original_description="按批次灰度发布固件v2.0.0，包含安全检测和自动回滚机制",
    )

    return task, devices
