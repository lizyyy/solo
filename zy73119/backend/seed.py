import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, Base, engine
from app import models
from datetime import datetime, timedelta


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    if db.query(models.SurveyChecklist).count() > 0:
        print("已有数据，跳过初始化")
        db.close()
        return

    items = [
        {
            "item_no": "OLD-BLDG-001",
            "location": "1号楼3层西侧走廊",
            "description": "走廊西侧墙体实测与模型偏差",
            "model_ref": "X:1200.500,Y:850.300,Z:3000.000",
            "has_anomaly": True,
            "anomaly_level": "高",
            "anomaly_note": "墙体位置偏移68mm，超过容差50mm",
            "status": "处理中",
            "coordinator": "小岑",
            "operator": "算法值班人A",
        },
        {
            "item_no": "OLD-BLDG-002",
            "location": "2号楼1层大堂",
            "description": "大堂柱子截面尺寸复核",
            "model_ref": "X:3500.000,Y:2200.000,Z:0.000",
            "has_anomaly": False,
            "anomaly_level": "",
            "anomaly_note": "",
            "status": "已闭环",
            "coordinator": "小岑",
            "operator": "算法值班人B",
        },
        {
            "item_no": "OLD-BLDG-003",
            "location": "3号楼B1设备层",
            "description": "设备基础标高复核",
            "model_ref": "X:5800.000,Y:1200.000,Z:-3500.000",
            "has_anomaly": True,
            "anomaly_level": "中",
            "anomaly_note": "标高偏差32mm，需确认是否影响设备安装",
            "status": "待处理",
            "coordinator": "小岑",
            "operator": "算法值班人A",
        },
        {
            "item_no": "OLD-BLDG-004",
            "location": "1号楼2层东侧会议室",
            "description": "会议室门洞尺寸复核",
            "model_ref": "X:2100.000,Y:6300.000,Z:2000.000",
            "has_anomaly": False,
            "status": "已闭环",
            "coordinator": "小岑",
            "operator": "算法值班人B",
        },
        {
            "item_no": "OLD-BLDG-005",
            "location": "2号楼屋面",
            "description": "屋面防水卷材搭接边",
            "model_ref": "X:4200.000,Y:3800.000,Z:6000.000",
            "has_anomaly": True,
            "anomaly_level": "低",
            "anomaly_note": "现场做法与模型标注略有差异，不影响使用",
            "status": "处理中",
            "coordinator": "小岑",
            "operator": "算法值班人A",
        },
    ]

    created_items = []
    for it in items:
        row = models.SurveyChecklist(**it)
        db.add(row)
        db.flush()
        created_items.append(row)
    db.commit()

    anomalies = [
        {
            "checklist_id": created_items[0].id,
            "anomaly_type": "坐标偏移超限",
            "detail": "墙体X方向偏移+68mm，超出±50mm容差",
            "source": "现场实测 vs 模型",
            "operator": "算法值班人A",
            "root_cause": "旧楼墙体原始施工偏差未在翻新时校准",
            "action": "BIM协调员复核现场控制点并回写模型",
        },
        {
            "checklist_id": created_items[2].id,
            "anomaly_type": "标高偏差",
            "detail": "设备基础标高-32mm",
            "source": "现场实测",
            "operator": "算法值班人A",
            "root_cause": "待查，需与设计确认",
            "action": "请设计复核设备安装净空要求",
        },
        {
            "checklist_id": created_items[4].id,
            "anomaly_type": "材料做法差异",
            "detail": "防水卷材搭接边现场做法为100mm，模型标注80mm",
            "source": "材料送审表",
            "operator": "算法值班人A",
            "root_cause": "施工单位采用更保守做法",
            "action": "同步更新模型标注即可",
        },
    ]
    created_anomalies = []
    for a in anomalies:
        row = models.AnomalyRecord(**a)
        db.add(row)
        db.flush()
        created_anomalies.append(row)
    db.commit()

    traces = [
        [
            {"step": 1, "from_node": "现场实测", "to_node": "算法汇总", "reason": "点云与模型比对偏差超限", "operator": "算法值班人A"},
            {"step": 2, "from_node": "算法汇总", "to_node": "BIM协调员", "reason": "异常清单推送，需复核控制点", "operator": "系统"},
            {"step": 3, "from_node": "BIM协调员", "to_node": "现场工程师", "reason": "小岑确认需现场重新布控", "operator": "小岑"},
        ],
        [
            {"step": 1, "from_node": "现场实测", "to_node": "算法汇总", "reason": "标高偏差超过30mm阈值", "operator": "算法值班人A"},
            {"step": 2, "from_node": "算法汇总", "to_node": "设计复核", "reason": "需设计确认净空是否满足", "operator": "系统"},
        ],
        [
            {"step": 1, "from_node": "材料送审表", "to_node": "算法汇总", "reason": "送审表v2备注搭接边调整为100mm", "operator": "算法值班人A"},
        ],
    ]
    for ai, trace_list in enumerate(traces):
        for t in trace_list:
            db.add(models.AnomalyTrace(anomaly_id=created_anomalies[ai].id, **t))
    db.commit()

    materials = [
        {
            "checklist_id": created_items[4].id,
            "material_name": "SBS改性沥青防水卷材",
            "version": 1,
            "current_value": "4mm厚，搭接边80mm",
            "remark": "初版送审",
            "screenshot_path": "/screenshots/material_v1_old_bldg_005.png",
            "submitted_by": "施工单位李工",
            "is_current": False,
        },
        {
            "checklist_id": created_items[4].id,
            "material_name": "SBS改性沥青防水卷材",
            "version": 2,
            "current_value": "4mm厚，搭接边100mm",
            "remark": "现场按更保守做法施工，搭接边调整为100mm，附现场照片见截图",
            "screenshot_path": "/screenshots/material_v2_old_bldg_005.png",
            "submitted_by": "施工单位李工",
            "is_current": True,
        },
        {
            "checklist_id": created_items[0].id,
            "material_name": "加气混凝土砌块",
            "version": 1,
            "current_value": "600x200x200mm，强度A5.0",
            "remark": "原模型标注",
            "screenshot_path": "",
            "submitted_by": "BIM协调员小岑",
            "is_current": True,
        },
        {
            "checklist_id": created_items[2].id,
            "material_name": "设备基础混凝土",
            "version": 1,
            "current_value": "C30混凝土",
            "remark": "",
            "screenshot_path": "",
            "submitted_by": "施工单位李工",
            "is_current": True,
        },
    ]
    for m in materials:
        db.add(models.MaterialSubmission(**m))
    db.commit()

    offsets = [
        {
            "checklist_id": created_items[0].id,
            "offset_x": 68.5,
            "offset_y": 12.3,
            "offset_z": -3.2,
            "threshold": 50.0,
            "exceeds": True,
            "action_owner": "BIM协调员小岑",
            "action_item": "模型坐标偏移超限(Δ=69.7mm)，请小岑复核1号楼3层西侧走廊现场控制点并回写模型，处理完成后通知算法值班人A重新跑批",
            "action_status": "处理中",
        },
        {
            "checklist_id": created_items[2].id,
            "offset_x": 5.0,
            "offset_y": -8.0,
            "offset_z": 32.0,
            "threshold": 50.0,
            "exceeds": False,
            "action_owner": "",
            "action_item": "",
            "action_status": "待指派",
        },
    ]
    for o in offsets:
        db.add(models.CoordinateOffset(**o))
    db.commit()

    for idx, it in enumerate(created_items):
        db.add(models.ChangeHistory(
            checklist_id=it.id,
            field_name="status",
            old_value="待处理",
            new_value=it.status,
            remark=f"初始化状态为{it.status}",
            changed_by="系统初始化",
        ))
    db.commit()

    print(f"初始化完成：{len(created_items)} 条清单，{len(anomalies)} 条异常，{len(materials)} 条材料送审，{len(offsets)} 条偏移记录")
    db.close()


if __name__ == "__main__":
    seed()
