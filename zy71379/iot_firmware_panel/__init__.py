"""IoT设备固件灰度面板 - 核心包

主要模块：
- models: 数据模型（原始信息 vs 处理结果 明确区分）
- state_machine: 灰度状态机（设备级+批次级）
- batch_control: 批次控制与安全检测
- rollback_engine: 回滚引擎与日志聚合
- report_exporter: 报告导出（终端/JSON/Markdown一致）
- history_manager: 历史管理与复盘入口
- sample_data: 样例数据包
- main: 主入口类 GrayscalePanel

快速使用：
    from iot_firmware_panel import GrayscalePanel
    panel = GrayscalePanel()
    devices = GrayscalePanel.create_sample_devices()
    result = panel.run_full_workflow(devices, "2.0.0")
    print(result["reports"]["terminal"])
"""

__version__ = "1.0.0"

from .models import (
    Device, Batch, GrayscaleTask, RollbackRecord, AggregatedLog,
    DeviceStatus, GrayscaleState, BatchState, ConfirmReason
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
from .history_manager import HistoryManager, HistoryRecord
from .main import GrayscalePanel
from .sample_data import (
    create_sample_devices, create_sample_task,
    create_mock_upgrade_fn, create_mock_rollback_fn
)

__all__ = [
    # Models
    "Device", "Batch", "GrayscaleTask", "RollbackRecord", "AggregatedLog",
    "DeviceStatus", "GrayscaleState", "BatchState", "ConfirmReason",
    # State Machine
    "GrayscaleStateMachine", "BatchStateMachine", "TaskStateManager",
    "StateTransitionError",
    # Batch Control
    "BatchController", "SecurityChecker", "SecurityCheckResult",
    "MAX_FAILURE_THRESHOLD",
    # Rollback & Logs
    "RollbackEngine", "LogAggregator",
    # Reports
    "ReportExporter",
    # History
    "HistoryManager", "HistoryRecord",
    # Main
    "GrayscalePanel",
    # Sample Data
    "create_sample_devices", "create_sample_task",
    "create_mock_upgrade_fn", "create_mock_rollback_fn",
]
