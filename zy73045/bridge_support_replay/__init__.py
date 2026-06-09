"""桥梁支座工单回放系统。

面向值班脚本和接手同事：
  - replay_workorder()       回放单个工单（稳定返回参数字典）
  - list_workorders()        按状态列出工单（已处理/待补证据/卡壳）
  - supplement_evidence()    补录证据并写入历史
  - load_workorder()         读工单（含原始来源、清洗痕迹）

典型用法::

    from bridge_support_replay import replay_workorder
    result = replay_workorder("WO-2025-001")
    # result["status"]          "handled" / "pending_evidence" / "stuck"
    # result["failure_reason"]  可解析的失败原因（None=成功）
    # result["timeline"]        时间线事件列表
    # result["raw_snapshot"]    原始来源数据快照（绝不修改原始字段）
"""

from .models import (
    WorkOrderStatus,
    PhotoMismatchAction,
    WorkOrder,
    SparePart,
    PhotoRecord,
    TimelineEvent,
    ReplayResult,
    FailureReason,
)
from .storage import load_workorder, save_workorder, load_all_workorders
from .replay_engine import replay_workorder
from .timeline import build_timeline, record_supplement
from .validators import validate_photo_timeline, PhotoMismatchInfo
from .classifier import list_workorders, classify_workorder
from .supplement import supplement_evidence, reverse_decision

__all__ = [
    "WorkOrderStatus",
    "PhotoMismatchAction",
    "WorkOrder",
    "SparePart",
    "PhotoRecord",
    "TimelineEvent",
    "ReplayResult",
    "FailureReason",
    "PhotoMismatchInfo",
    "replay_workorder",
    "list_workorders",
    "supplement_evidence",
    "reverse_decision",
    "load_workorder",
    "save_workorder",
    "load_all_workorders",
    "build_timeline",
    "record_supplement",
    "validate_photo_timeline",
    "classify_workorder",
]
