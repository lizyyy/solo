from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from uuid import uuid4


def _gen_id() -> str:
    return uuid4().hex[:8]


class JudgmentStatus(str, Enum):
    STABLE = "稳定"
    UNSTABLE = "不稳定"
    PENDING = "待确认(挂起)"
    OVERRIDDEN_STABLE = "人工改判-稳定"
    OVERRIDDEN_UNSTABLE = "人工改判-不稳定"

    def is_human_overridden(self) -> bool:
        return self in (JudgmentStatus.OVERRIDDEN_STABLE, JudgmentStatus.OVERRIDDEN_UNSTABLE)

    def base_status(self) -> str:
        if self == JudgmentStatus.OVERRIDDEN_STABLE:
            return JudgmentStatus.STABLE.value
        if self == JudgmentStatus.OVERRIDDEN_UNSTABLE:
            return JudgmentStatus.UNSTABLE.value
        return self.value


class OpinionSource(str, Enum):
    MEETING_MINUTE = "会议纪要"
    SITE_REVIEW = "现场复核"
    DESIGN_CHANGE = "设计变更"
    PREVIOUS_REVIEW = "历史交底"


class ExceptionType(str, Enum):
    MATERIAL_MISSING = "材料批次缺失"
    OPINION_CONFLICT = "新旧意见冲突"
    HUMAN_OVERRIDE = "人工改判"
    CALCULATION_ERROR = "计算偏差"
    STANDARD_MISMATCH = "规范不符"


class HandleStatus(str, Enum):
    OPEN = "待处理"
    IN_PROGRESS = "处理中"
    CONFIRMED_SITE = "现场已确认"
    CONFIRMED_DESIGN = "设计已确认"
    RESOLVED = "已闭环"
    HUNG = "已挂起"


class SceneLabel(str, Enum):
    STEEL_CONNECTION = "钢龙骨连接节点"
    GLASS_EMBED = "玻璃嵌固节点"
    SEALANT_JOINT = "耐候胶缝节点"
    BURRIED_PART = "预埋件节点"
    CORNER_DETAIL = "转角收边节点"
    DRAINAGE_DETAIL = "排水组织节点"


SIDE_NOTE_MAP: Dict[SceneLabel, str] = {
    SceneLabel.STEEL_CONNECTION: "核查螺栓规格、焊缝高度、防腐措施是否满足计算书要求",
    SceneLabel.GLASS_EMBED: "核查玻璃厚度、嵌固深度、垫块布置是否满足风压变形要求",
    SceneLabel.SEALANT_JOINT: "核查胶缝宽度、深度、衬垫材料是否满足位移能力要求",
    SceneLabel.BURRIED_PART: "核查埋板尺寸、锚栓间距、混凝土强度是否满足抗拔要求",
    SceneLabel.CORNER_DETAIL: "核查转角型材接口、密封连续性、排水坡度是否完整",
    SceneLabel.DRAINAGE_DETAIL: "核查排水孔位置、数量、坡度是否满足最大降雨量排水要求",
}

EXCEPTION_NOTE_MAP: Dict[ExceptionType, str] = {
    ExceptionType.MATERIAL_MISSING: "材料批次证明缺失，已挂起等待现场提供入库单/质量证明文件后再判定",
    ExceptionType.OPINION_CONFLICT: "本次会议纪要与历史交底意见存在冲突，需追溯原意见形成背景后统一结论",
    ExceptionType.HUMAN_OVERRIDE: "原系统自动判定与人工判断不一致，已记录改判理由并标记改判链路",
    ExceptionType.CALCULATION_ERROR: "计算参数取值与设计说明不一致，需设计方重新复核计算结果",
    ExceptionType.STANDARD_MISMATCH: "节点做法与现行规范条文冲突，需设计出具规范适用性说明",
}


@dataclass
class OpinionRecord:
    opinion_id: str = field(default_factory=_gen_id)
    source: OpinionSource = OpinionSource.MEETING_MINUTE
    source_ref: str = ""
    meeting_date: Optional[str] = None
    meeting_round: Optional[int] = None
    content: str = ""
    proposer: str = ""
    is_resolved: bool = False
    resolved_at: Optional[str] = None
    linked_opinion_ids: List[str] = field(default_factory=list)
    trace_note: str = ""

    def to_audit_row(self) -> Dict[str, str]:
        return {
            "意见编号": self.opinion_id,
            "来源": self.source.value,
            "来源引用": self.source_ref,
            "会议日期": self.meeting_date or "-",
            "会议轮次": f"第{self.meeting_round}轮" if self.meeting_round else "-",
            "意见内容": self.content,
            "提出人": self.proposer,
            "是否闭环": "已闭环" if self.is_resolved else "未闭环",
            "闭环日期": self.resolved_at or "-",
            "关联意见号": ",".join(self.linked_opinion_ids) or "-",
            "追溯说明": self.trace_note,
        }


@dataclass
class HumanOverride:
    override_id: str = field(default_factory=_gen_id)
    node_id: str = ""
    original_status: JudgmentStatus = JudgmentStatus.UNSTABLE
    overridden_status: JudgmentStatus = JudgmentStatus.OVERRIDDEN_STABLE
    reason: str = ""
    operator: str = ""
    operated_at: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M"))
    affected_fields: List[str] = field(default_factory=list)

    def impact_summary(self) -> str:
        return (
            f"【改判{self.override_id}】原判定「{self.original_status.value}」→ 改判为「{self.overridden_status.value}」，"
            f"操作人:{self.operator}，时间:{self.operated_at}，理由:{self.reason}"
        )


@dataclass
class MaterialBatch:
    material_name: str = ""
    batch_no: str = ""
    spec: str = ""
    supplier: str = ""
    quality_cert_no: str = ""
    inspection_result: str = ""
    missing: bool = True

    def display(self) -> str:
        if self.missing:
            return f"{self.material_name}({self.spec}) 批次号缺失 / 无质量证明 ——【挂起风险】"
        return (
            f"{self.material_name}({self.spec}) 批次:{self.batch_no} 供应商:{self.supplier} "
            f"质保书号:{self.quality_cert_no} 检测:{self.inspection_result}"
        )


@dataclass
class ExceptionRecord:
    exc_id: str = field(default_factory=_gen_id)
    node_id: str = ""
    exc_type: ExceptionType = ExceptionType.MATERIAL_MISSING
    scene: SceneLabel = SceneLabel.STEEL_CONNECTION
    description: str = ""
    unified_side_note: str = ""
    unified_scene_label: str = ""
    unified_queue_note: str = ""
    handle_status: HandleStatus = HandleStatus.OPEN
    linked_override_id: Optional[str] = None
    linked_opinion_ids: List[str] = field(default_factory=list)
    pulls_summary: bool = False
    confirmed_by: str = ""
    confirmed_at: Optional[str] = None
    closed_note: str = ""

    def ensure_unified_notes(self) -> None:
        self.unified_scene_label = self.scene.value
        self.unified_side_note = SIDE_NOTE_MAP.get(self.scene, "")
        self.unified_queue_note = EXCEPTION_NOTE_MAP.get(self.exc_type, self.description)

    def to_queue_row(self) -> Dict[str, str]:
        self.ensure_unified_notes()
        return {
            "异常编号": self.exc_id,
            "关联节点": self.node_id,
            "异常类型": self.exc_type.value,
            "场景标注(统一)": self.unified_scene_label,
            "侧边说明(统一)": self.unified_side_note,
            "异常描述": self.description,
            "队列说明(统一)": self.unified_queue_note,
            "处理状态": self.handle_status.value,
            "是否拉动汇总": "是" if self.pulls_summary else "否",
            "关联改判号": self.linked_override_id or "-",
            "关联意见号": ",".join(self.linked_opinion_ids) or "-",
            "确认人": self.confirmed_by or "-",
            "确认时间": self.confirmed_at or "-",
            "闭环说明": self.closed_note or "-",
        }


@dataclass
class CurtainWallNode:
    node_id: str = field(default_factory=_gen_id)
    code: str = ""
    name: str = ""
    scene: SceneLabel = SceneLabel.STEEL_CONNECTION
    floor_range: str = ""
    drawing_ref: str = ""
    materials: List[MaterialBatch] = field(default_factory=list)
    opinions: List[OpinionRecord] = field(default_factory=list)
    auto_judgment: JudgmentStatus = JudgmentStatus.STABLE
    final_judgment: JudgmentStatus = JudgmentStatus.STABLE
    overrides: List[HumanOverride] = field(default_factory=list)
    exceptions: List[ExceptionRecord] = field(default_factory=list)
    judgment_reason_chain: List[str] = field(default_factory=list)
    side_note: str = ""
    _scene_label_synced: str = ""
    _side_note_synced: str = ""

    def sync_unified_labels(self) -> None:
        self._scene_label_synced = self.scene.value
        self._side_note_synced = SIDE_NOTE_MAP.get(self.scene, "")
        self.side_note = self._side_note_synced
        for exc in self.exceptions:
            exc.scene = self.scene
            exc.ensure_unified_notes()

    def material_missing(self) -> bool:
        return any(m.missing for m in self.materials)

    def unresolved_opinions(self) -> List[OpinionRecord]:
        return [o for o in self.opinions if not o.is_resolved]

    def apply_auto_judgment(self) -> None:
        reasons = []
        missing = self.material_missing()
        unresolved = self.unresolved_opinions()

        if missing:
            self.auto_judgment = JudgmentStatus.PENDING
            reasons.append("材料批次缺失→触发挂起机制")
        elif unresolved:
            self.auto_judgment = JudgmentStatus.UNSTABLE
            reasons.append(f"存在{len(unresolved)}条未闭环交底意见")
        else:
            self.auto_judgment = JudgmentStatus.STABLE
            reasons.append("材料批次齐全、交底意见全部闭环→自动判定稳定")

        self.judgment_reason_chain = reasons
        if not self.overrides:
            self.final_judgment = self.auto_judgment

    def register_override(self, override: HumanOverride) -> None:
        override.node_id = self.node_id
        self.overrides.append(override)
        self.final_judgment = override.overridden_status
        exc = ExceptionRecord(
            node_id=self.node_id,
            exc_type=ExceptionType.HUMAN_OVERRIDE,
            scene=self.scene,
            description=f"人工改判影响最终判断:{override.impact_summary()}",
            handle_status=HandleStatus.OPEN,
            linked_override_id=override.override_id,
            linked_opinion_ids=[o.opinion_id for o in self.opinions],
            pulls_summary=True,
        )
        exc.ensure_unified_notes()
        self.exceptions.append(exc)
        self.judgment_reason_chain.append(
            f"人工改判介入:原{override.original_status.value}→最终{override.overridden_status.value}，"
            f"改判号{override.override_id}"
        )

    def register_material_pending(self) -> None:
        if not self.material_missing():
            return
        exc = ExceptionRecord(
            node_id=self.node_id,
            exc_type=ExceptionType.MATERIAL_MISSING,
            scene=self.scene,
            description="节点涉及材料缺少批次号/质量证明文件，按照规则挂起等待现场确认，不给出假稳定结论",
            handle_status=HandleStatus.HUNG,
            linked_opinion_ids=[o.opinion_id for o in self.opinions],
            pulls_summary=True,
        )
        exc.ensure_unified_notes()
        self.exceptions.append(exc)

    def register_opinion_conflict(self, new_op: OpinionRecord, old_op: OpinionRecord) -> None:
        exc = ExceptionRecord(
            node_id=self.node_id,
            exc_type=ExceptionType.OPINION_CONFLICT,
            scene=self.scene,
            description=f"新意见[{new_op.opinion_id}]与历史意见[{old_op.opinion_id}]内容指向存在冲突，需统一澄清",
            handle_status=HandleStatus.OPEN,
            linked_opinion_ids=[new_op.opinion_id, old_op.opinion_id],
            pulls_summary=True,
        )
        exc.ensure_unified_notes()
        self.exceptions.append(exc)

    def get_pulling_exceptions(self) -> List[ExceptionRecord]:
        return [e for e in self.exceptions if e.pulls_summary]

    def to_summary_row(self) -> Dict[str, str]:
        self.sync_unified_labels()
        pulling = self.get_pulling_exceptions()
        return {
            "节点编号": self.code,
            "节点名称": self.name,
            "场景标注": self._scene_label_synced,
            "楼层范围": self.floor_range,
            "图纸索引": self.drawing_ref,
            "材料批次状态": "有缺失(已挂起)" if self.material_missing() else "齐全",
            "交底意见数": f"{len(self.opinions)}(未闭环{len(self.unresolved_opinions())})",
            "系统自动判定": self.auto_judgment.value,
            "人工改判次数": str(len(self.overrides)),
            "最终判定": self.final_judgment.value,
            "拉动汇总的异常数": str(len(pulling)),
            "拉动异常编号": ",".join(e.exc_id for e in pulling) or "-",
            "判定链路": " | ".join(self.judgment_reason_chain),
        }
