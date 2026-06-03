"""
演示数据初始化脚本.

演示场景：
1. REC-001：顺利记录 - 正常导入、正常回放
2. REC-002：Z轴方向按旧习惯写反 - 标记为待复核，不归正
3. REC-003：补录旧口径 - 先导入，后从坐标原点说明补录后回放更新

完整三步流程：
第一步：安全半径表第一次导入
第二步：设备工程师许工补看坐标原点说明
第三步：路径回放更新
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime
from quay_crane.models import db, SafetyRadius, OriginNote, OperationRecord, PlaybackPath
from quay_crane.services.radius_import import RadiusImportService
from quay_crane.services.origin_note import OriginNoteService
from quay_crane.services.playback import PlaybackService


DEMO_RECORDS = [
    {
        "record_no": "REC-001",
        "crane_no": "QC-01",
        "operation_date": "2026-06-01",
        "x": 10.0,
        "y": 20.0,
        "z": 5.0,
        "radius": 30.0,
        "z_axis_direction": "up",
        "description": "顺利记录：数据正常，Z轴方向正确"
    },
    {
        "record_no": "REC-002",
        "crane_no": "QC-01",
        "operation_date": "2026-06-01",
        "x": 15.0,
        "y": 25.0,
        "z": -3.0,
        "radius": 35.0,
        "z_axis_direction": "up",
        "description": "Z轴方向按旧习惯写反：Z值为负但标注up，按旧习惯可能写反，留待复核"
    },
    {
        "record_no": "REC-003",
        "crane_no": "QC-02",
        "operation_date": "2026-06-02",
        "x": 12.0,
        "y": 18.0,
        "z": 4.0,
        "radius": 28.0,
        "z_axis_direction": "up",
        "description": "补录旧口径：后续从坐标原点说明补录原点坐标"
    }
]


DEMO_ORIGIN_NOTES = [
    {
        "note_no": "NOTE-001",
        "crane_no": "QC-02",
        "record_no": "REC-003",
        "origin_x": 2.0,
        "origin_y": 3.0,
        "origin_z": 1.5,
        "old_caliber": "2020版旧口径：岸桥QC-02原点以码头基准面下1.5米为零点",
        "z_direction_note": "按旧习惯向下为正，新系统已修正为向上为正",
        "operator": "许工",
        "description": "从历史坐标原点说明中补录的旧口径数据"
    }
]


def init_demo_data(app):
    """初始化演示数据."""
    with app.app_context():
        print("=" * 60)
        print("码头岸桥作业半径 - 演示数据初始化")
        print("=" * 60)

        if SafetyRadius.query.count() > 0:
            print("检测到已有数据，跳过初始化。如需重新初始化请先删除data.db")
            return

        print("\n--- 第一步：安全半径表第一次导入 ---")
        records_data = [{k: v for k, v in r.items() if k != "description"} for r in DEMO_RECORDS]
        op_import, results = RadiusImportService.import_from_records(
            records_data,
            operator="班组A",
            description="安全半径表第一次导入"
        )
        print(f"导入操作记录：{op_import.id} - {op_import.description}")
        for res, demo in zip(results, DEMO_RECORDS):
            print(f"  {res['record_no']}: {res['status']} - {demo['description']}")
            if res.get("is_z_reversed"):
                print(f"    → {res['detect_note']}")
                print(f"    → 注意：不归正，留给现场班组复核")

        print("\n--- 第一次路径回放（导入后） ---")
        op_rerun1, playbacks1 = PlaybackService.generate_playback(
            safety_radius_id=None,
            operator="系统",
            apply_origin=False,
            description="第一次回放：导入后初始回放，未应用原点说明"
        )
        print(f"回放操作记录：{op_rerun1.id} - {op_rerun1.description}")
        for pp in playbacks1:
            print(f"  {pp.path_no}: 记录{pp.record_no}, Z轴应用{pp.z_axis_applied}, 原点({pp.origin_x},{pp.origin_y},{pp.origin_z})")

        print("\n--- 第二步：设备工程师许工补看坐标原点说明 ---")
        op_origin = OriginNoteService.create_origin_operation(
            operator="许工",
            description="设备工程师许工补看坐标原点说明，发现QC-02岸桥历史旧口径"
        )
        print(f"补录操作记录：{op_origin.id} - {op_origin.description}")

        for note_data in DEMO_ORIGIN_NOTES:
            note = OriginNoteService.add_note(
                note_no=note_data["note_no"],
                crane_no=note_data["crane_no"],
                record_no=note_data["record_no"],
                origin_x=note_data["origin_x"],
                origin_y=note_data["origin_y"],
                origin_z=note_data["origin_z"],
                old_caliber=note_data["old_caliber"],
                z_direction_note=note_data["z_direction_note"],
                operator=note_data["operator"],
                operation_record_id=op_origin.id
            )
            print(f"  补录{note.note_no}：关联{note.record_no}，旧口径：{note_data['description']}")
            op_origin.affected_count += 1
        db.session.commit()

        print("\n--- 一次人工修正（REC-002，Z轴写反记录，由现场班组复核） ---")
        sr_rec002 = SafetyRadius.query.filter_by(record_no="REC-002").first()
        if sr_rec002 and sr_rec002.is_z_reversed:
            print(f"  REC-002当前状态：{sr_rec002.status}，is_z_reversed={sr_rec002.is_z_reversed}")
            print(f"  注意：此处不归正，保留z_reversed状态留给现场班组复核")
            sr_rec002.status = "z_reversed"
            db.session.commit()

        print("\n--- 第三步：补录坐标原点说明后路径回放更新（一次重跑） ---")
        op_rerun2, playbacks2 = PlaybackService.rerun_with_origin(
            operator="许工",
            description="补录坐标原点说明后路径回放更新 - 应用原点补录数据"
        )
        print(f"重跑操作记录：{op_rerun2.id} - {op_rerun2.description}")
        for pp in playbacks2:
            origin_status = "已应用原点补录" if pp.is_origin_applied else "未应用原点"
            print(f"  {pp.path_no} V{pp.version}: 记录{pp.record_no}, Z轴{pp.z_axis_applied}, {origin_status}, 原点({pp.origin_x},{pp.origin_y},{pp.origin_z})")

        print("\n" + "=" * 60)
        print("演示数据初始化完成！")
        print("=" * 60)
        print("\n数据概览：")
        print(f"  安全半径记录：{SafetyRadius.query.count()} 条")
        print(f"  坐标原点说明：{OriginNote.query.count()} 条")
        print(f"  操作记录：{OperationRecord.query.count()} 条")
        print(f"  路径回放：{PlaybackPath.query.count()} 条")

        print("\n三种处理结果对比（REC-003）：")
        comparison = PlaybackService.compare_results("REC-003")
        for pv in comparison["playback_versions"]:
            origin_str = f"原点({pv['origin'][0]},{pv['origin'][1]},{pv['origin'][2]})" if pv["is_origin_applied"] else "原点(0,0,0)"
            print(f"  V{pv['version']}: Z轴{pv['z_axis_applied']}, {origin_str}")

        print("\n" + "=" * 60)
        print("演示流程说明：")
        print("  1. REC-001 顺利记录：数据正常，处理结果正常")
        print("  2. REC-002 Z轴写反：标记为z_reversed，留给现场班组复核，不归正")
        print("  3. REC-003 补录旧口径：先导入，后从坐标原点说明补录，回放路径随之更新")
        print("=" * 60)
