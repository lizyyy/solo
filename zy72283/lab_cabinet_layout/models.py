"""数据模型定义"""
from dataclasses import dataclass, field
from typing import List, Optional, Tuple, Dict
from datetime import datetime
from enum import Enum


class IssueType(str, Enum):
    """问题类型"""
    ROUTE_NOT_RECALCULATED = "补录路线未重新计算长度"
    WRONG_CALIBER = "错口径"
    MISSING_MATERIAL = "缺材料"
    COORDINATE_OFFSET = "坐标偏移"


class IssueStatus(str, Enum):
    """问题状态"""
    DETECTED = "已检测"
    PENDING_REVIEW = "待展陈客户复核"
    MANUAL_FIXED = "已人工修正"
    RERUN = "已重跑"
    RESOLVED = "已解决"


class Handler(str, Enum):
    """处理人角色"""
    PARK_OPS_XT = "园区运维小陶"
    EXHIBITION_CLIENT = "展陈客户"
    SYSTEM = "系统"


@dataclass
class SafetyRadius:
    """安全半径表记录"""
    cabinet_id: str
    cabinet_name: str
    position: Tuple[float, float]
    safety_radius: float
    chemical_type: str
    hazard_level: str = "中等"


@dataclass
class CoordinateOrigin:
    """坐标原点说明"""
    origin_point: Tuple[float, float]
    description: str
    calibration_date: str
    calibrated_by: str
    version: int = 1
    notes: str = ""


@dataclass
class RouteRecord:
    """路线记录"""
    route_id: str
    route_name: str
    start_point: Tuple[float, float]
    end_point: Tuple[float, float]
    via_points: List[Tuple[float, float]] = field(default_factory=list)
    calculated_length: Optional[float] = None
    manual_input_length: Optional[float] = None
    is_supplementary: bool = False
    length_matched: Optional[bool] = None
    last_calculated_at: Optional[datetime] = None
    last_updated_at: Optional[datetime] = None


@dataclass
class IssueRecord:
    """问题记录"""
    issue_id: str
    issue_type: IssueType
    route_id: str
    description: str
    status: IssueStatus = IssueStatus.DETECTED
    detected_at: datetime = field(default_factory=datetime.now)
    current_handler: Handler = Handler.PARK_OPS_XT
    missing_materials: List[str] = field(default_factory=list)
    filled_materials: List[str] = field(default_factory=list)
    material_fill_notes: Dict[str, str] = field(default_factory=dict)
    fix_notes: str = ""
    review_notes: str = ""
    resolved_note: str = ""
    resolved_at: Optional[datetime] = None

    def fill_material(self, material_name: str, fill_note: str = "", operator: Handler = Handler.PARK_OPS_XT):
        """补齐某项材料"""
        if material_name not in self.filled_materials:
            self.filled_materials.append(material_name)
        self.material_fill_notes[material_name] = f"[{operator.value}] {fill_note}"

    def required_materials(self) -> List[str]:
        """根据当前状态计算应需要的材料清单（基准列表）"""
        base = []
        if self.issue_type == IssueType.ROUTE_NOT_RECALCULATED:
            if self.status == IssueStatus.DETECTED:
                base = ["坐标原点说明确认", "路线长度校验记录"]
            elif self.status == IssueStatus.PENDING_REVIEW:
                base = ["重新计算后的路线长度确认凭证", "坐标原点校准记录"]
            elif self.status == IssueStatus.MANUAL_FIXED:
                base = ["系统重跑计算结果", "展陈客户复核确认"]
            elif self.status == IssueStatus.RERUN:
                base = ["展陈客户对补录差异的复核确认"]
            elif self.status == IssueStatus.RESOLVED:
                base = []
            else:
                base = ["重新计算后的路线长度确认凭证", "坐标原点校准记录"]
        elif self.missing_materials:
            base = list(self.missing_materials)
        for m in self.missing_materials:
            if m not in base:
                base.append(m)
        return base

    def pending_materials(self) -> List[str]:
        """当前还没补齐的材料列表"""
        required = self.required_materials()
        return [m for m in required if m not in self.filled_materials]

    def why_kept(self) -> str:
        """说明这条为什么被留下——跟当前状态走，不只看 issue_type"""
        if self.status == IssueStatus.RESOLVED:
            if self.resolved_note:
                return f"已解决：{self.resolved_note}"
            return "已解决"
        if self.issue_type == IssueType.ROUTE_NOT_RECALCULATED:
            if self.status == IssueStatus.PENDING_REVIEW:
                return "补录后系统未自动触发路线长度重算，需展陈客户确认录入值是否准确"
            if self.status == IssueStatus.MANUAL_FIXED:
                return "园区运维小陶已确认人工录入值，待系统重跑后交展陈客户复核"
            if self.status == IssueStatus.RERUN:
                return "系统已重跑路线长度计算，出现补录差异，需展陈客户复核确认"
            if self.status == IssueStatus.DETECTED:
                return "补录路线存在异常，需园区运维小陶检查坐标原点说明后确认处理方式"
            return "补录路线长度存疑，待进一步核实"
        elif self.issue_type == IssueType.WRONG_CALIBER:
            return "测量口径与标准规范不一致，需重新核对测量标准"
        elif self.issue_type == IssueType.MISSING_MATERIAL:
            return "缺少必要的安全评估材料，需补充后继续"
        return "待进一步核实"

    def next_step(self) -> str:
        """下一步该找谁——严格与 current_handler 对齐"""
        if self.status == IssueStatus.RESOLVED:
            return "流程已完成"
        if self.current_handler == Handler.EXHIBITION_CLIENT:
            return f"联系 {Handler.EXHIBITION_CLIENT.value} 复核数据准确性"
        if self.current_handler == Handler.PARK_OPS_XT:
            return f"由 {Handler.PARK_OPS_XT.value} 检查坐标原点说明并确认处理方式"
        if self.status == IssueStatus.MANUAL_FIXED:
            return "等待系统重跑验证，重跑后自动流转至展陈客户复核"
        return f"由 {Handler.PARK_OPS_XT.value} 检查坐标原点说明并确认处理方式"

    def missing_info(self) -> str:
        """还缺什么材料——只列还没补齐的，已解决直接返回无"""
        if self.status == IssueStatus.RESOLVED:
            return "无"
        pending = self.pending_materials()
        if not pending:
            return "无"
        return "、".join(pending)

    def filled_info(self) -> str:
        """已补齐的材料及说明"""
        if not self.filled_materials:
            return "无"
        items = []
        for m in self.filled_materials:
            note = self.material_fill_notes.get(m, "")
            if note:
                items.append(f"{m}（{note}）")
            else:
                items.append(m)
        return "、".join(items)


@dataclass
class OperationLog:
    """操作日志"""
    timestamp: datetime
    operator: Handler
    action: str
    details: str


@dataclass
class LayoutProject:
    """布局项目 - 聚合根"""
    project_id: str
    project_name: str = "实验室危化品柜布局"
    safety_radii: List[SafetyRadius] = field(default_factory=list)
    coordinate_origin: Optional[CoordinateOrigin] = None
    routes: List[RouteRecord] = field(default_factory=list)
    issues: List[IssueRecord] = field(default_factory=list)
    operation_logs: List[OperationLog] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    version: int = 1

    def add_log(self, operator: Handler, action: str, details: str):
        self.operation_logs.append(OperationLog(
            timestamp=datetime.now(),
            operator=operator,
            action=action,
            details=details
        ))
