"""
完整流程测试.

验证三步流程：
第一步：安全半径表第一次导入
第二步：设备工程师许工补看坐标原点说明
第三步：路径回放更新

验证三种处理结果：
1. 顺利记录（REC-001）
2. Z轴方向按旧习惯写反（REC-002）- 不归正，留给现场班组复核
3. 补录旧口径后更新（REC-003）
"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from quay_crane.app import create_app
from quay_crane.models import db, SafetyRadius, OriginNote, OperationRecord, PlaybackPath
from quay_crane.services.radius_import import RadiusImportService
from quay_crane.services.origin_note import OriginNoteService
from quay_crane.services.playback import PlaybackService


def test_z_axis_detection():
    """测试Z轴方向检测逻辑."""
    print("\n=== 测试1: Z轴方向检测 ===")

    is_rev, note = RadiusImportService.detect_z_reversed(5.0, "up")
    assert not is_rev, "Z=5.0 方向up 不应判定为写反"
    print(f"  Z=5.0, dir=up → is_reversed={is_rev} ✓")

    is_rev, note = RadiusImportService.detect_z_reversed(-3.0, "up")
    assert is_rev, "Z=-3.0 方向up 应判定为写反"
    print(f"  Z=-3.0, dir=up → is_reversed={is_rev}, note='{note}' ✓")

    is_rev, note = RadiusImportService.detect_z_reversed(3.0, "down")
    assert is_rev, "Z=3.0 方向down 应判定为写反"
    print(f"  Z=3.0, dir=down → is_reversed={is_rev}, note='{note}' ✓")

    is_rev, note = RadiusImportService.detect_z_reversed(-5.0, "down")
    assert not is_rev, "Z=-5.0 方向down 不应判定为写反"
    print(f"  Z=-5.0, dir=down → is_reversed={is_rev} ✓")

    print("  Z轴方向检测全部通过 ✓")


def test_full_three_step_flow():
    """测试完整三步流程."""
    print("\n=== 测试2: 完整三步流程 ===")

    db_fd, db_path = tempfile.mkstemp(suffix=".db")
    os.close(db_fd)

    class TestConfig:
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{db_path}"
        SQLALCHEMY_TRACK_MODIFICATIONS = False
        SECRET_KEY = "test"

    app = create_app(TestConfig)

    try:
        with app.app_context():

            # ---- 第一步：安全半径表第一次导入 ----
            print("\n  第一步：安全半径表第一次导入")

            records = [
                {
                    "record_no": "REC-001",
                    "crane_no": "QC-01",
                    "operation_date": "2026-06-01",
                    "x": 10.0, "y": 20.0, "z": 5.0,
                    "radius": 30.0,
                    "z_axis_direction": "up"
                },
                {
                    "record_no": "REC-002",
                    "crane_no": "QC-01",
                    "operation_date": "2026-06-01",
                    "x": 15.0, "y": 25.0, "z": -3.0,
                    "radius": 35.0,
                    "z_axis_direction": "up"
                },
                {
                    "record_no": "REC-003",
                    "crane_no": "QC-02",
                    "operation_date": "2026-06-02",
                    "x": 12.0, "y": 18.0, "z": 4.0,
                    "radius": 28.0,
                    "z_axis_direction": "up"
                }
            ]

            op_import, results = RadiusImportService.import_from_records(
                records, operator="班组A", description="安全半径表第一次导入"
            )

            assert op_import.affected_count == 3, f"应导入3条，实际{op_import.affected_count}"
            print(f"    导入 {op_import.affected_count} 条记录 ✓")

            # 验证三种处理结果
            rec001 = SafetyRadius.query.filter_by(record_no="REC-001").first()
            rec002 = SafetyRadius.query.filter_by(record_no="REC-002").first()
            rec003 = SafetyRadius.query.filter_by(record_no="REC-003").first()

            assert rec001.status == "normal", f"REC-001应为normal，实际{rec001.status}"
            assert not rec001.is_z_reversed, "REC-001不应被标记为Z轴写反"
            print(f"    REC-001: status={rec001.status}, is_z_reversed={rec001.is_z_reversed} ✓ (顺利)")

            assert rec002.status == "z_reversed", f"REC-002应为z_reversed，实际{rec002.status}"
            assert rec002.is_z_reversed, "REC-002应被标记为Z轴写反"
            print(f"    REC-002: status={rec002.status}, is_z_reversed={rec002.is_z_reversed} ✓ (Z轴写反，不归正)")

            assert rec003.status == "normal", f"REC-003应为normal，实际{rec003.status}"
            print(f"    REC-003: status={rec003.status}, is_z_reversed={rec003.is_z_reversed} ✓ (后续补录)")

            # 第一次回放（导入后，未应用原点）
            op_rerun1, playbacks1 = PlaybackService.generate_playback(
                safety_radius_id=None, operator="系统",
                apply_origin=False, description="第一次回放"
            )
            assert len(playbacks1) == 3, f"第一次回放应有3条，实际{len(playbacks1)}"
            print(f"    第一次回放: {len(playbacks1)} 条路径 ✓")

            for pp in playbacks1:
                assert not pp.is_origin_applied, "第一次回放不应应用原点"
            print(f"    第一次回放原点均未应用 ✓")

            # ---- 第二步：设备工程师许工补看坐标原点说明 ----
            print("\n  第二步：设备工程师许工补看坐标原点说明")

            op_origin = OriginNoteService.create_origin_operation(
                operator="许工", description="补看坐标原点说明"
            )

            note = OriginNoteService.add_note(
                note_no="NOTE-001",
                crane_no="QC-02",
                record_no="REC-003",
                origin_x=2.0, origin_y=3.0, origin_z=1.5,
                old_caliber="2020版旧口径：岸桥QC-02原点以码头基准面下1.5米为零点",
                z_direction_note="按旧习惯向下为正，新系统已修正为向上为正",
                operator="许工",
                operation_record_id=op_origin.id
            )

            assert note is not None, "原点说明应创建成功"
            assert not note.is_applied, "原点说明初始应为未应用"
            print(f"    补录原点说明: {note.note_no}, 原点({note.origin_x},{note.origin_y},{note.origin_z}) ✓")

            rec003_after = SafetyRadius.query.filter_by(record_no="REC-003").first()
            assert rec003_after.status == "updated", f"REC-003补录后应为updated，实际{rec003_after.status}"
            assert rec003_after.source == "origin", f"REC-003来源应为origin，实际{rec003_after.source}"
            print(f"    REC-003补录后: status={rec003_after.status}, source={rec003_after.source} ✓")

            # 验证REC-002仍为z_reversed（不归正）
            rec002_after = SafetyRadius.query.filter_by(record_no="REC-002").first()
            assert rec002_after.status == "z_reversed", "REC-002应保持z_reversed，不归正"
            print(f"    REC-002仍为: status={rec002_after.status} (不归正，留待复核) ✓")

            # ---- 第三步：路径回放更新 ----
            print("\n  第三步：补录坐标原点说明后路径回放更新")

            op_rerun2, playbacks2 = PlaybackService.rerun_with_origin(
                operator="许工", description="补录后重跑"
            )

            assert len(playbacks2) == 3, f"重跑应有3条，实际{len(playbacks2)}"
            print(f"    重跑回放: {len(playbacks2)} 条路径 ✓")

            # 验证REC-003的回放应用了原点
            rec003_playbacks = [pp for pp in playbacks2 if pp.record_no == "REC-003"]
            assert len(rec003_playbacks) == 1
            pp003 = rec003_playbacks[0]
            assert pp003.is_origin_applied, "REC-003回放应应用原点"
            assert pp003.origin_x == 2.0, f"原点X应为2.0，实际{pp003.origin_x}"
            assert pp003.origin_y == 3.0, f"原点Y应为3.0，实际{pp003.origin_y}"
            assert pp003.origin_z == 1.5, f"原点Z应为1.5，实际{pp003.origin_z}"
            print(f"    REC-003回放V{pp003.version}: 原点已应用({pp003.origin_x},{pp003.origin_y},{pp003.origin_z}) ✓")

            # 验证REC-002的回放Z轴方向
            rec002_playbacks = [pp for pp in playbacks2 if pp.record_no == "REC-002"]
            assert len(rec002_playbacks) == 1
            pp002 = rec002_playbacks[0]
            assert pp002.z_axis_applied == "down", f"REC-002回放Z轴应为down，实际{pp002.z_axis_applied}"
            print(f"    REC-002回放V{pp002.version}: Z轴应用={pp002.z_axis_applied} ✓")

            # 验证原点说明已标记为已应用
            note_after = OriginNote.query.filter_by(note_no="NOTE-001").first()
            assert note_after.is_applied, "原点说明应已标记为已应用"
            print(f"    原点说明NOTE-001: is_applied={note_after.is_applied} ✓")

            # ---- 验证三种处理结果不同 ----
            print("\n  验证三种处理结果不同")

            all_playbacks = PlaybackPath.query.order_by(PlaybackPath.record_no, PlaybackPath.version).all()
            print(f"    共 {len(all_playbacks)} 条路径回放记录")

            # REC-001: 正常
            pp001 = PlaybackPath.query.filter_by(record_no="REC-001").order_by(PlaybackPath.version.desc()).first()
            print(f"    REC-001: Z轴={pp001.z_axis_applied}, 原点应用={pp001.is_origin_applied} → 正常")

            # REC-002: Z轴写反（待复核）
            pp002_all = PlaybackPath.query.filter_by(record_no="REC-002").order_by(PlaybackPath.version).all()
            for pp in pp002_all:
                print(f"    REC-002: V{pp.version} Z轴={pp.z_axis_applied}, 原点应用={pp.is_origin_applied} → Z轴写反")

            # REC-003: 补录旧口径后
            pp003_all = PlaybackPath.query.filter_by(record_no="REC-003").order_by(PlaybackPath.version).all()
            for pp in pp003_all:
                origin = f"({pp.origin_x},{pp.origin_y},{pp.origin_z})" if pp.is_origin_applied else "(0,0,0)"
                print(f"    REC-003: V{pp.version} Z轴={pp.z_axis_applied}, 原点应用={pp.is_origin_applied}, 原点={origin} → {'补录后' if pp.is_origin_applied else '初始'}")

            # 对比结果
            comparison = PlaybackService.compare_results("REC-003")
            assert len(comparison["playback_versions"]) >= 2, "REC-003应至少有2个回放版本"
            print(f"\n    REC-003对比: {len(comparison['playback_versions'])} 个版本 ✓")

            # 人工修正测试
            print("\n  测试人工修正（REC-002）")
            op_correct, sr_corrected = RadiusImportService.manual_correct(
                record_id=rec002.id,
                correct_z=3.0,
                correct_direction="down",
                operator="许工"
            )
            assert sr_corrected.status == "normal", f"修正后应为normal，实际{sr_corrected.status}"
            assert sr_corrected.z == 3.0, f"修正后Z应为3.0，实际{sr_corrected.z}"
            print(f"    REC-002修正后: status={sr_corrected.status}, Z={sr_corrected.z} ✓")

            # 待复核列表
            pending = RadiusImportService.get_pending_review()
            print(f"\n    当前待复核记录数: {len(pending)}")

            # 操作记录统计
            total_ops = OperationRecord.query.count()
            print(f"    总操作记录: {total_ops}")

        print("\n=== 完整三步流程测试全部通过 ✓ ===")

    finally:
        if os.path.exists(db_path):
            os.unlink(db_path)


def test_api_endpoints():
    """测试API接口."""
    print("\n=== 测试3: API接口 ===")

    db_fd, db_path = tempfile.mkstemp(suffix=".db")
    os.close(db_fd)

    class TestConfig:
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{db_path}"
        SQLALCHEMY_TRACK_MODIFICATIONS = False
        SECRET_KEY = "test"

    app = create_app(TestConfig)

    try:
        client = app.test_client()

        # 导入安全半径
        resp = client.post("/api/safety-radius", json={
            "records": [
                {
                    "record_no": "REC-API-001",
                    "crane_no": "QC-03",
                    "operation_date": "2026-06-03",
                    "x": 8.0, "y": 12.0, "z": 6.0,
                    "radius": 25.0,
                    "z_axis_direction": "up"
                }
            ],
            "operator": "API测试",
            "description": "API导入测试"
        })
        assert resp.status_code == 201, f"导入应返回201，实际{resp.status_code}"
        data = resp.get_json()
        assert data["affected_count"] == 1
        print(f"  API导入: {resp.status_code}, affected={data['affected_count']} ✓")

        # 列表查询
        resp = client.get("/api/safety-radius")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["count"] >= 1
        print(f"  API列表: {data['count']} 条 ✓")

        # 待复核
        resp = client.get("/api/safety-radius/pending-review")
        assert resp.status_code == 200
        print(f"  API待复核: {resp.status_code} ✓")

        # 补录原点
        resp = client.post("/api/origin-notes", json={
            "note_no": "NOTE-API-001",
            "crane_no": "QC-03",
            "record_no": "REC-API-001",
            "origin_x": 1.0,
            "origin_y": 2.0,
            "origin_z": 0.5,
            "old_caliber": "旧口径说明",
            "operator": "许工"
        })
        assert resp.status_code == 201
        print(f"  API补录原点: {resp.status_code} ✓")

        # 生成回放
        resp = client.post("/api/playback/generate", json={
            "operator": "许工",
            "apply_origin": True,
            "description": "API回放测试"
        })
        assert resp.status_code == 201
        data = resp.get_json()
        print(f"  API生成回放: {resp.status_code}, {data['affected_count']} 条 ✓")

        # 看板汇总
        resp = client.get("/api/dashboard/summary")
        assert resp.status_code == 200
        data = resp.get_json()
        print(f"  API看板汇总: 安全半径{data['safety_radius']['total']}条, 原点{data['origin_notes']['total']}条 ✓")

        # 操作记录
        resp = client.get("/api/operations")
        assert resp.status_code == 200
        data = resp.get_json()
        print(f"  API操作记录: {data['count']} 条 ✓")

        print("\n=== API接口测试全部通过 ✓ ===")

    finally:
        if os.path.exists(db_path):
            os.unlink(db_path)


if __name__ == "__main__":
    print("=" * 60)
    print("码头岸桥作业半径 - 完整流程测试")
    print("=" * 60)

    test_z_axis_detection()
    test_full_three_step_flow()
    test_api_endpoints()

    print("\n" + "=" * 60)
    print("全部测试通过 ✓")
    print("=" * 60)
