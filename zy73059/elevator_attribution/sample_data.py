from typing import List

from .models import (
    FaultRecord, SensorLog, AuditLog, AttributionChain,
    FaultStatus, ChangeType
)
from .processor import AttributionProcessor, _short_id


def build_sample_dataset() -> AttributionProcessor:
    """
    样例数据（故意不全是标准行）：
      1) FAULT_001 —— 标准正常归因，含多条传感器日志
      2) FAULT_002 —— 传感器日志里夹着一条撤回记录（已填撤回说明，可正常归因）
      3) FAULT_003 —— 采样断档场景，会被 BLOCK 拦住
      4) FAULT_004 —— 撤回记录未填撤回说明，会被 BLOCK 拦住
      5) FAULT_005 —— 待归因（PENDING）
    """
    proc = AttributionProcessor()

    # ===== FAULT_001：标准行，正常归因 =====
    f1 = FaultRecord(
        fault_id="FAULT_001",
        elevator_id="EL-A-01",
        occurred_at="2026-06-08 08:31:12",
        fault_code="E102",
        fault_desc="门机运行超时",
        status=FaultStatus.PENDING,
    )
    f1.sensor_logs = [
        SensorLog("L00101", "FAULT_001", "2026-06-08 08:31:05", "door_motor_current", 3.2),
        SensorLog("L00102", "FAULT_001", "2026-06-08 08:31:08", "door_motor_current", 4.1),
        SensorLog("L00103", "FAULT_001", "2026-06-08 08:31:11", "door_position", 0.45),
        SensorLog("L00104", "FAULT_001", "2026-06-08 08:31:14", "door_position", 0.50),
    ]
    proc.add_record(f1)
    proc.run_attribution("FAULT_001", root_cause="门导轨异物卡滞",
                         operator="algo_zhang", confidence=0.92)

    # ===== FAULT_002：夹带撤回记录的传感器日志 =====
    f2 = FaultRecord(
        fault_id="FAULT_002",
        elevator_id="EL-B-03",
        occurred_at="2026-06-08 09:45:50",
        fault_code="E205",
        fault_desc="轿厢意外移动",
        status=FaultStatus.PENDING,
    )
    f2.sensor_logs = [
        SensorLog("L00201", "FAULT_002", "2026-06-08 09:45:40", "brake_pressure", 8.5),
        SensorLog("L00202", "FAULT_002", "2026-06-08 09:45:43", "speed_feedback", 0.12),
        SensorLog("L00203", "FAULT_002", "2026-06-08 09:45:46", "speed_feedback", 0.08,
                  is_revoked=True,
                  revoke_note="传感器抖动误报，现场确认此条读数无效（老何 2026-06-08 14:20 复核）"),
        SensorLog("L00204", "FAULT_002", "2026-06-08 09:45:49", "brake_pressure", 3.2),
        SensorLog("L00205", "FAULT_002", "2026-06-08 09:45:52", "speed_feedback", 0.28),
    ]
    proc.add_record(f2)
    proc.run_attribution("FAULT_002", root_cause="制动闸片磨损导致制动力不足",
                         operator="algo_li", confidence=0.78)

    # ===== FAULT_003：采样断档（会被拦住）=====
    f3 = FaultRecord(
        fault_id="FAULT_003",
        elevator_id="EL-C-07",
        occurred_at="2026-06-08 11:20:33",
        fault_code="E301",
        fault_desc="平层精度超限",
        status=FaultStatus.PENDING,
    )
    f3.sensor_logs = [
        SensorLog("L00301", "FAULT_003", "2026-06-08 11:20:20", "cabin_position", 3.10),
        SensorLog("L00302", "FAULT_003", "2026-06-08 11:20:23", "cabin_position", 3.12),
        # 中间断档 5 分钟
        SensorLog("L00303", "FAULT_003", "2026-06-08 11:25:26", "cabin_position", 3.48),
        SensorLog("L00304", "FAULT_003", "2026-06-08 11:25:29", "cabin_position", 3.50),
    ]
    proc.add_record(f3)
    # 尝试归因 -> 会因采样断档被 BLOCKED
    proc.run_attribution("FAULT_003", root_cause="钢丝绳打滑",
                         operator="algo_wang", confidence=0.7)

    # ===== FAULT_004：撤回记录未填撤回说明（会被拦住）=====
    f4 = FaultRecord(
        fault_id="FAULT_004",
        elevator_id="EL-A-02",
        occurred_at="2026-06-08 14:10:05",
        fault_code="E102",
        fault_desc="门机运行超时",
        status=FaultStatus.PENDING,
    )
    f4.sensor_logs = [
        SensorLog("L00401", "FAULT_004", "2026-06-08 14:10:00", "door_motor_current", 2.9),
        SensorLog("L00402", "FAULT_004", "2026-06-08 14:10:03", "door_motor_current", 99.9,
                  is_revoked=True, revoke_note=""),  # 空的撤回说明
        SensorLog("L00403", "FAULT_004", "2026-06-08 14:10:06", "door_position", 0.22),
    ]
    proc.add_record(f4)
    proc.run_attribution("FAULT_004", root_cause="门机变频器故障",
                         operator="algo_zhang", confidence=0.65)

    # ===== FAULT_005：待归因 =====
    f5 = FaultRecord(
        fault_id="FAULT_005",
        elevator_id="EL-B-05",
        occurred_at="2026-06-09 07:05:18",
        fault_code="E404",
        fault_desc="称重信号异常",
        status=FaultStatus.PENDING,
    )
    f5.sensor_logs = [
        SensorLog("L00501", "FAULT_005", "2026-06-09 07:05:10", "load_cell", 1240),
        SensorLog("L00502", "FAULT_005", "2026-06-09 07:05:13", "load_cell", 960),
        SensorLog("L00503", "FAULT_005", "2026-06-09 07:05:16", "load_cell", 1280),
    ]
    proc.add_record(f5)

    return proc
