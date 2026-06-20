"""数据模型定义
所有核心业务对象都在这里声明，使用 dataclasses 保持轻量。
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum


class LineStatus(str, Enum):
    """单行回放处理状态"""
    PROCESSED = "已处理"      # 正常入回放
    SKIPPED = "跳过行"        # 因条件不满足跳过
    BAD = "坏行"              # 数据格式/校验不通过
    PENDING_MATERIAL = "待补材料"  # 有采样断档等需补录
    MANUAL_JUDGED = "人工改判"    # 由人工改判结论


class WorkOrderConclusion(str, Enum):
    """工单最终结论"""
    PASS = "合格"
    FAIL = "不合格"
    PENDING = "待判定"
    REJUDGED = "已改判"


class Shift(str, Enum):
    """班组枚举"""
    MORNING = "早班"   # 08:00-16:00
    AFTERNOON = "中班"  # 16:00-24:00
    NIGHT = "晚班"     # 00:00-08:00


@dataclass
class Remark:
    """备注项（班组交接后补备注、复核备注等）"""
    remark_id: str
    author: str
    shift: str                          # 所属班组
    created_at: str                     # ISO 时间
    content: str                        # 备注正文
    attached_to_line_no: Optional[int] = None  # 绑定到具体行（用于后补备注嵌入结果旁）
    remark_type: str = "通用"           # 交接备注/复核备注/改判备注


@dataclass
class ReplayLine:
    """单条回放记录行"""
    line_no: int                        # 原始文件行号
    work_order_id: str                  # 工单号
    pipeline_id: str                    # 管线号
    sample_point: str                   # 采样点
    sample_time: str                    # 采样时间
    material_value: Optional[str]       # 采样材料值（断档时为 None）
    original_conclusion: str            # 原始结论
    current_conclusion: str             # 当前结论
    status: str                         # LineStatus
    status_reason: str = ""             # 状态原因（跳过/坏行说明）
    # --- 采样断档字段（原始信息永不改变） ---
    has_gap: bool = False               # 当前是否断档未补（待补材料筛选用）
    gap_detail: str = ""                # 当前断档说明（补录后可说明"已补"）
    original_has_gap: bool = False      # 原始回放时是否断档（永不改变，用于溯源）
    original_gap_detail: str = ""       # 原始断档说明（永不改变）
    # --- 补录状态字段（表达后续处理，不动原始信息） ---
    is_material_filled: bool = False    # 是否已执行补录
    filled_material: Optional[str] = None  # 补录值
    filled_by: str = ""                 # 补录操作人
    filled_at: str = ""                 # 补录时间
    filled_reason: str = ""             # 补录原因（与改判原因同步）
    # --- 改判 & 留痕 ---
    is_manual_judged: bool = False      # 是否人工改判
    manual_judge_reason: str = ""       # 改判原因
    remarks: List[Dict[str, Any]] = field(default_factory=list)  # 嵌入的备注
    history_snapshots: List[Dict[str, Any]] = field(default_factory=list)  # 改判快照


@dataclass
class HandoverRecord:
    """班组交接记录"""
    handover_id: str
    date: str                           # YYYY-MM-DD
    from_shift: str                     # Shift
    from_operator: str
    to_shift: str
    to_operator: str
    handover_time: str
    summary: str                        # 交接摘要
    changed_line_nos: List[int] = field(default_factory=list)  # 本班改动的行号
    remarks: List[Dict[str, Any]] = field(default_factory=list)  # 交接后补备注


@dataclass
class RejudgeHistory:
    """补录改判历史快照（留痕用）"""
    history_id: str
    work_order_id: str
    line_no: int
    rejudge_time: str
    operator: str
    old_material: Optional[str]         # 旧材料
    new_material: Optional[str]         # 新材料
    old_conclusion: str                 # 旧结论
    new_conclusion: str                 # 新结论
    reason: str                         # 改判原因
    new_remark: str = ""                # 新备注


@dataclass
class ReplaySession:
    """一次回放会话（对应一次 CLI 执行或一次复核任务）"""
    session_id: str
    started_at: str
    ended_at: str = ""
    source_file: str = ""
    operator: str = ""
    shift: str = ""
    lines: List[ReplayLine] = field(default_factory=list)
    handover: Optional[HandoverRecord] = None
    rejudge_histories: List[RejudgeHistory] = field(default_factory=list)

    def counters(self) -> Dict[str, int]:
        """分类统计：坏行/跳过行/已处理行/待补材料/人工改判 + 断档追踪"""
        c = {"已处理": 0, "跳过行": 0, "坏行": 0, "待补材料": 0, "人工改判": 0,
             "原始断档_未补": 0, "原始断档_已补": 0}
        for ln in self.lines:
            if ln.status == LineStatus.PROCESSED.value:
                c["已处理"] += 1
            elif ln.status == LineStatus.SKIPPED.value:
                c["跳过行"] += 1
            elif ln.status == LineStatus.BAD.value:
                c["坏行"] += 1
            elif ln.status == LineStatus.PENDING_MATERIAL.value:
                c["待补材料"] += 1
            if ln.is_manual_judged:
                c["人工改判"] += 1
            if getattr(ln, "original_has_gap", False):
                if ln.is_material_filled:
                    c["原始断档_已补"] += 1
                else:
                    c["原始断档_未补"] += 1
        return c


def to_dict(obj: Any) -> Dict[str, Any]:
    """统一序列化方法"""
    return asdict(obj)
