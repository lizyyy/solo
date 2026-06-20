import os
import uuid
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from .database import engine, Base, SessionLocal
from .models import CollisionRecord, CollisionHistory


IMG_BASE = "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image"


def img_url(prompt, size="landscape_4_3"):
    import urllib.parse
    return f"{IMG_BASE}?prompt={urllib.parse.quote(prompt)}&image_size={size}"


MAIN_VIEW_PROMPTS = [
    "BIM architectural curtain wall node collision detail, structural steel beam intersecting with aluminum panel frame, isometric engineering view, professional technical drawing style, subtle shadows",
    "Curtain wall embedded part deviation detail, steel anchoring bracket misaligned with concrete slab edge, CAD-style 3D visualization, technical annotation highlights, cool blue tone",
    "Weld conflict at curtain wall connection node, two steel members overlapping at joint, BIM model clash detection view, red highlighted interference zone, engineering render",
    "Glass curtain wall mullion collision with floor slab edge, structural cross-section view, detailed architectural joint, professional construction document style rendering",
    "Curtain wall support bracket collision with HVAC duct, 3D BIM coordination view, multiple building systems visible, clash detection markers, technical illustration",
    "Unitized curtain wall panel misalignment, adjacent panels offset vertically, installation quality view, close-up detail, architectural technical photography style",
    "Seismic joint detail curtain wall node, expansion gap insufficient size, structural movement analysis view, cross-section technical render, engineering documentation quality",
    "Fire rated curtain wall penetration, sealant gap inadequate around steel member, firestop detail view, BIM model with fire safety annotation, professional render",
    "Curtain wall pressure plate fastener spacing violation, too few bolts visible along mullion, quality audit detail view, technical close-up with dimension lines",
    "Double skin facade inner layer collision, ventilation cavity obstruction, BIM section view, layered construction visualization, engineering technical style",
    "Stone curtain wall anchor point overload condition, multiple brackets concentrated, structural analysis visualization, stress heat map overlay on 3D model",
    "Aluminum curtain wall extrusion die mismatch, profile joint gap exceeding tolerance, quality inspection detail view, industrial technical photography lighting",
]

AUX_VIEW_PROMPTS = [
    "BIM model top plan view of curtain wall collision zone, floor plan perspective, column grid visible, engineering technical style",
    "Curtain wall node side elevation view, structural profile cross section, dimension annotation lines, CAD drafting style",
    "3D isometric exploded view of curtain wall connection node, components separated, callout labels, assembly drawing style",
    "Close-up detail of structural steel to curtain wall bracket connection, welding seam detail, technical documentation quality",
    "Horizontal section through curtain wall mullion, glass panel and aluminum frame visible, architectural drawing convention",
    "Axonometric view of floor slab edge with curtain wall anchor points, embed plates visible, structural BIM style",
]

PROJECTS = ["国贸中心T3塔楼", "滨江金融广场A座", "科创园总部大厦"]
FLOORS = ["F08", "F12", "F15", "F22"]
TYPES = ["构件干涉", "预埋件偏差", "焊缝冲突", "净距不足"]
PERSONS = ["老叶", "张工", "李工", "王工"]
ELEMENTS_A = ["幕墙竖梃ML-12A", "预埋件EP-220", "钢牛腿SC-07", "转接件AJ-15"]
ELEMENTS_B = ["结构边梁KL-8", "混凝土楼板SL-15", "机电风管KD-400", "消防主管XF-200"]

STATUSES = [
    {"s": "PASSED", "c": "构件间隙经调整满足30mm要求，放行", "sample": True, "rejudge": 0},
    {"s": "PASSED", "c": "预埋件偏差在调整件补偿范围内，放行", "rejudge": 0},
    {"s": "PENDING_EVIDENCE", "c": "需补充现场焊缝超声波检测报告后再判定", "rejudge": 0},
    {"s": "PASSED", "c": "经设计复核，局部加强后可放行", "rejudge": 1},
    {"s": "MANUAL_REJUDGED", "c": "碰撞属模型导出误差，人工改判放行；坐标整体偏移+23mm", "offset": True,
     "offset_note": "从Navisworks导出时坐标系原点未对齐结构±0.000，Z轴整体偏移+23.4mm，实际碰撞需减去该值再判",
     "sample": True, "rejudge": 3},
    {"s": "PENDING_EVIDENCE", "c": "待补充设计单位出具的节点变更单", "rejudge": 1},
    {"s": "REJECTED", "c": "净距严重不足，必须重新拆分幕墙单元", "rejudge": 2},
    {"s": "PASSED", "c": "角度微调后通过，已更新节点图", "rejudge": 0},
    {"s": "MANUAL_REJUDGED", "c": "坐标系换算错误，人工改判后实际无碰撞；坐标偏移-17mm", "offset": True,
     "offset_note": "土建模型采用城市坐标系而幕墙采用局部坐标系，X方向存在-17.1mm换算差，修正后节点合格",
     "rejudge": 2},
    {"s": "PENDING_EVIDENCE", "c": "需提供厂家型材实际截面尺寸复核", "rejudge": 0},
    {"s": "REJECTED", "c": "结构梁下翼缘与竖梃冲突，需修改竖梃分段", "offset": True,
     "offset_note": "实测结构梁施工偏差达+31mm，与原模型不符，需按实际位置重新排布",
     "rejudge": 3},
    {"s": "PASSED", "c": "与机电协调后风管上翻200mm，冲突解除", "rejudge": 1},
]


def make_screenshots(idx):
    main = MAIN_VIEW_PROMPTS[idx % len(MAIN_VIEW_PROMPTS)]
    aux1 = AUX_VIEW_PROMPTS[(idx * 2) % len(AUX_VIEW_PROMPTS)]
    aux2 = AUX_VIEW_PROMPTS[(idx * 2 + 1) % len(AUX_VIEW_PROMPTS)]
    aux3 = AUX_VIEW_PROMPTS[(idx * 3 + 1) % len(AUX_VIEW_PROMPTS)]
    base_cam = [
        {"x": 12.5 + idx * 0.3, "y": 8.2, "z": 15.7},
        {"x": 0, "y": 18.4, "z": 10.1},
        {"x": 18.2, "y": 2.1, "z": 8.6},
        {"x": -10.5, "y": 6.8, "z": 4.3},
    ]
    base_tgt = [
        {"x": 5.2, "y": 3.1, "z": 6.4},
        {"x": 5.2, "y": 0, "z": 6.4},
        {"x": 5.2, "y": 3.1, "z": 6.4},
        {"x": 5.2, "y": 3.1, "z": 6.4},
    ]
    return [
        {"id": f"ss-{idx}-main", "url": img_url(main, "landscape_4_3"), "label": "主视图",
         "cameraPosition": base_cam[0], "targetPosition": base_tgt[0]},
        {"id": f"ss-{idx}-aux1", "url": img_url(aux1, "square"), "label": "俯视图",
         "cameraPosition": base_cam[1], "targetPosition": base_tgt[1]},
        {"id": f"ss-{idx}-aux2", "url": img_url(aux2, "square"), "label": "左视图",
         "cameraPosition": base_cam[2], "targetPosition": base_tgt[2]},
        {"id": f"ss-{idx}-aux3", "url": img_url(aux3, "square"), "label": "右视图",
         "cameraPosition": base_cam[3], "targetPosition": base_tgt[3]},
    ]


def make_clue_chain(idx, ctype, conclusion):
    samples = [
        "从F12~F15层幕墙单元体批量抽取36个节点，检出率约11%",
        "针对北立面转角区域专项检查，共提取24个典型节点样本",
        "按每层10%抽样原则，从8个标准层中抽取40个检查点",
    ]
    judges = [
        f"初判{ctype}：构件最小净距仅12mm，低于规范30mm要求",
        f"初判{ctype}：预埋件中心偏差达48mm，超出允许值±25mm",
        f"初判{ctype}：双侧焊缝空间冲突，焊枪操作距离不足",
    ]
    reviews = [
        "复核人调取原模型坐标核对，确认BIM模型版本为V2.3发布版",
        "复核比对施工深化图JS-22-14节点，确认标注尺寸一致",
        "复核现场激光扫描点云数据，偏差值与模型吻合",
    ]
    return [
        {"id": f"clue-{idx}-1", "step": "SAMPLE", "title": "样本抽取记录",
         "description": samples[idx % len(samples)],
         "operator": "建模组-张工",
         "timestamp": f"2026-05-{10 + (idx % 15):02d}T09:12:00"},
        {"id": f"clue-{idx}-2", "step": "INITIAL_JUDGEMENT", "title": "自动碰撞检测",
         "description": judges[idx % len(judges)],
         "operator": "Navisworks自动",
         "timestamp": f"2026-05-{12 + (idx % 12):02d}T14:30:00"},
        {"id": f"clue-{idx}-3", "step": "REVIEW", "title": "工程复核意见",
         "description": reviews[idx % len(reviews)],
         "operator": "结构组-老叶",
         "timestamp": f"2026-05-{14 + (idx % 10):02d}T11:08:00"},
        {"id": f"clue-{idx}-4", "step": "CONCLUSION", "title": "预审结论",
         "description": conclusion,
         "operator": "负责人-王总",
         "timestamp": f"2026-05-{16 + (idx % 8):02d}T16:45:00"},
    ]


def make_history(idx, count, final_status):
    if count == 0:
        return []
    flow = ["PENDING_EVIDENCE", "REJECTED", "MANUAL_REJUDGED", "PASSED"]
    reasons = [
        "补充提交节点大样图后重新提交",
        "现场实测数据与模型不符，驳回重算",
        "经设计确认改判，依据设计变更单DS-2026-042",
        "各方协调会达成一致，调整方案可行",
    ]
    records = []
    prev = "PENDING_EVIDENCE"
    for i in range(count):
        next_status = final_status if (i == count - 1) else flow[(i + 1) % len(flow)]
        ts = f"2026-05-{18 + i:02d}T{10 + i:02d}:0{i}:00"
        records.append({
            "id": f"hist-{idx}-{i}",
            "collision_id": f"CL2024-{idx + 1:03d}",
            "previous_status": prev,
            "new_status": next_status,
            "reason": reasons[i % len(reasons)],
            "operator": PERSONS[(idx + i) % len(PERSONS)],
            "evidence_urls": None,
            "created_at": datetime.fromisoformat(ts),
        })
        prev = next_status
    return records


def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(CollisionRecord).count() > 0:
            print("Database already seeded, skipping.")
            return

        for idx, cfg in enumerate(STATUSES):
            cid = f"CL2024-{idx + 1:03d}"
            project = PROJECTS[idx % len(PROJECTS)]
            floor = FLOORS[idx % len(FLOORS)]
            node_code = f"N-{floor[1:]}-{idx * 7 + 3:02d}"
            ctype = TYPES[idx % len(TYPES)]
            el_a = ELEMENTS_A[idx % len(ELEMENTS_A)]
            el_b = ELEMENTS_B[idx % len(ELEMENTS_B)]
            person = PERSONS[idx % len(PERSONS)]

            conclusion = cfg["c"]
            record = CollisionRecord(
                id=cid,
                project_name=project,
                floor=floor,
                node_code=node_code,
                collision_type=ctype,
                element_a=el_a,
                element_b=el_b,
                status=cfg["s"],
                initial_conclusion=conclusion,
                screenshots=make_screenshots(idx),
                clue_chain=make_clue_chain(idx, ctype, conclusion),
                is_coordinate_offset=cfg.get("offset", False),
                coordinate_offset_note=cfg.get("offset_note"),
                rejudge_count=cfg["rejudge"],
                responsible_person=person,
                is_sample=cfg.get("sample", False),
                created_at=datetime.fromisoformat(f"2026-05-{8 + (idx % 15):02d}T09:00:00"),
                updated_at=datetime.fromisoformat(f"2026-06-{1 + (idx % 9):02d}T{10 + (idx % 7):02d}:{15 + idx:02d}:00"),
            )
            db.add(record)

            history_list = make_history(idx, cfg["rejudge"], cfg["s"])
            for h in history_list:
                db.add(CollisionHistory(**h))

        db.commit()
        print(f"Seeded {len(STATUSES)} collision records successfully.")
    except Exception as e:
        db.rollback()
        print(f"Seed error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
