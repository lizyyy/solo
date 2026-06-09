from __future__ import annotations
from typing import List, Dict, Any

from .models import (
    CurtainWallNode,
    MaterialBatch,
    OpinionRecord,
    OpinionSource,
    HumanOverride,
    JudgmentStatus,
    SceneLabel,
)


def build_sample_nodes() -> List[CurtainWallNode]:
    n1 = CurtainWallNode(
        code="MQ-01",
        name="西立面主龙骨与埋板连接节点",
        scene=SceneLabel.STEEL_CONNECTION,
        floor_range="F3-F28",
        drawing_ref="JD-ST-003 / 大样2-2",
    )
    n1.materials = [
        MaterialBatch(
            material_name="不锈钢螺栓",
            spec="M12×80 8.8级",
            supplier="标五",
            batch_no="",
            quality_cert_no="",
            inspection_result="",
            missing=True,
        ),
        MaterialBatch(
            material_name="角码Q345B",
            spec="t=8mm",
            supplier="鸿路钢构",
            batch_no="HL-2026-0518-07",
            quality_cert_no="QC-26051888",
            inspection_result="合格",
            missing=False,
        ),
    ]
    n1.opinions = [
        OpinionRecord(
            source=OpinionSource.PREVIOUS_REVIEW,
            source_ref="2026-04-20 第2轮交底纪要 P7",
            meeting_date="2026-04-20",
            meeting_round=2,
            content="核查螺栓复试报告，焊缝高度由6mm加大至8mm",
            proposer="老叶",
            is_resolved=True,
            resolved_at="2026-05-02",
            trace_note="历史交底，已在设计变更S-08中闭环",
        ),
        OpinionRecord(
            source=OpinionSource.PREVIOUS_REVIEW,
            source_ref="2026-05-16 第4轮交底纪要 P12",
            meeting_date="2026-05-16",
            meeting_round=4,
            content="螺栓M10不满足抗剪要求，更换为M12并重新计算",
            proposer="老叶",
            is_resolved=False,
            trace_note="第4轮提出的核心修改意见",
        ),
    ]

    n2 = CurtainWallNode(
        code="MQ-02",
        name="东立面LOW-E中空玻璃嵌固节点",
        scene=SceneLabel.GLASS_EMBED,
        floor_range="F1-F32",
        drawing_ref="JD-GL-011 / 大样1-1",
    )
    n2.materials = [
        MaterialBatch(
            material_name="钢化中空玻璃",
            spec="10Low-E+12A+10",
            supplier="南玻",
            batch_no="NB-26050122",
            quality_cert_no="G-26051231",
            inspection_result="合格",
            missing=False,
        ),
        MaterialBatch(
            material_name="结构硅酮胶",
            spec="SS621 中性",
            supplier="白云",
            batch_no="BY-260510-A3",
            quality_cert_no="GJ-26051700",
            inspection_result="合格",
            missing=False,
        ),
    ]
    n2.opinions = [
        OpinionRecord(
            source=OpinionSource.PREVIOUS_REVIEW,
            source_ref="2026-03-28 第1轮交底纪要 P5",
            meeting_date="2026-03-28",
            meeting_round=1,
            content="玻璃嵌固深度≥15mm，玻璃维持单片（不做夹胶）",
            proposer="老王",
            is_resolved=True,
            resolved_at="2026-04-10",
            trace_note="首轮交底已闭环",
        ),
    ]

    n3 = CurtainWallNode(
        code="MQ-03",
        name="南立面单元板块耐候胶缝节点",
        scene=SceneLabel.SEALANT_JOINT,
        floor_range="F2-F32",
        drawing_ref="JD-SJ-007",
    )
    n3.materials = [
        MaterialBatch(
            material_name="耐候硅酮胶",
            spec="SJ168 灰色",
            supplier="道康宁",
            batch_no="DC-260428-11",
            quality_cert_no="QC-DC260428",
            inspection_result="合格",
            missing=False,
        ),
    ]
    n3.opinions = [
        OpinionRecord(
            source=OpinionSource.PREVIOUS_REVIEW,
            source_ref="2026-05-02 第3轮交底纪要 P8",
            meeting_date="2026-05-02",
            meeting_round=3,
            content="胶缝宽度维持15mm，不需扩至20mm",
            proposer="老叶",
            is_resolved=False,
            trace_note="第3轮核心意见",
        ),
    ]

    n4 = CurtainWallNode(
        code="MQ-04",
        name="北立面标准层预埋件节点",
        scene=SceneLabel.BURRIED_PART,
        floor_range="F2-F28",
        drawing_ref="JD-BP-002 / 大样4-4",
    )
    n4.materials = [
        MaterialBatch(
            material_name="热镀锌埋板",
            spec="300×200×10mm",
            supplier="中建钢构",
            batch_no="ZJ-260506-22",
            quality_cert_no="QC-ZJ260520",
            inspection_result="合格",
            missing=False,
        ),
        MaterialBatch(
            material_name="化学锚栓",
            spec="M16×190",
            supplier="喜利得",
            batch_no="HLD-260511-09",
            quality_cert_no="QC-H26051115",
            inspection_result="合格",
            missing=False,
        ),
    ]
    n4.opinions = [
        OpinionRecord(
            source=OpinionSource.PREVIOUS_REVIEW,
            source_ref="2026-05-02 第3轮交底纪要 P10",
            meeting_date="2026-05-02",
            meeting_round=3,
            content="埋板间距复核并提供抗拔试验报告",
            proposer="老叶",
            is_resolved=True,
            resolved_at="2026-05-20",
            trace_note="已补充试验报告编号KB-2026-0518，结论合格",
        ),
    ]

    n5 = CurtainWallNode(
        code="MQ-05",
        name="东南转角立柱横梁交接收边节点",
        scene=SceneLabel.CORNER_DETAIL,
        floor_range="F8标准转角",
        drawing_ref="JD-ZJ-005 / 大样A",
    )
    n5.materials = [
        MaterialBatch(
            material_name="铝合金转角型材",
            spec="6063-T5 t=3mm",
            supplier="兴发铝业",
            batch_no="XF-260520-14",
            quality_cert_no="QC-XF260520A",
            inspection_result="合格",
            missing=False,
        ),
    ]
    n5.opinions = []

    return [n1, n2, n3, n4, n5]


def build_sample_meeting_minutes_round5() -> List[Dict[str, Any]]:
    return [
        {
            "node_code": "MQ-01",
            "meeting_date": "2026-06-08",
            "meeting_round": 5,
            "source": "会议纪要",
            "source_ref": "幕墙专题交底2026-06-08 P3",
            "opinion": "螺栓M12 8.8级的复试报告现场仍未提供，请尽快补齐批次证明",
            "proposer": "老叶",
        },
        {
            "node_code": "MQ-01",
            "meeting_date": "2026-06-08",
            "meeting_round": 5,
            "source": "会议纪要",
            "source_ref": "幕墙专题交底2026-06-08 P4",
            "opinion": "焊缝高度按6mm施工即可，不需加大至8mm",
            "proposer": "设计-小李",
        },
        {
            "node_code": "MQ-02",
            "meeting_date": "2026-06-08",
            "meeting_round": 5,
            "source": "会议纪要",
            "source_ref": "幕墙专题交底2026-06-08 P6",
            "opinion": "玻璃改为夹胶配置应对台风区要求，原单片方案不满足",
            "proposer": "老叶",
        },
        {
            "node_code": "MQ-03",
            "meeting_date": "2026-06-08",
            "meeting_round": 5,
            "source": "会议纪要",
            "source_ref": "幕墙专题交底2026-06-08 P9",
            "opinion": "胶缝宽度从15mm加大至20mm，以满足层间位移要求",
            "proposer": "老叶",
        },
        {
            "node_code": "MQ-04",
            "meeting_date": "2026-06-08",
            "meeting_round": 5,
            "source": "会议纪要",
            "source_ref": "幕墙专题交底2026-06-08 P11",
            "opinion": "锚栓数量不变，维持原设计4颗/埋板",
            "proposer": "设计-小李",
        },
        {
            "node_code": "MQ-05",
            "meeting_date": "2026-06-08",
            "meeting_round": 5,
            "source": "会议纪要",
            "source_ref": "幕墙专题交底2026-06-08 P13",
            "opinion": "转角密封构造与排水坡度符合要求，无异议",
            "proposer": "老叶",
        },
    ]


def build_sample_overrides() -> List[Dict[str, str]]:
    return [
        {
            "node_code": "MQ-04",
            "original_status": JudgmentStatus.STABLE.value,
            "overridden_status": JudgmentStatus.OVERRIDDEN_UNSTABLE.value,
            "reason": "现场抽样发现埋板镀锌层厚度不满足85μm要求，虽报告齐全仍判定不稳定，要求补测",
            "operator": "老叶",
        },
    ]
