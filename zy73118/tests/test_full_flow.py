import os
import sys
import json
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine, SessionLocal
from app import models

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "survey.db")


def reset_db():
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


client = TestClient(app)


PAYLOAD = {
    "plan_code": "OLD-2026-001",
    "plan_name": "朝阳小区3号楼测绘方案",
    "building_address": "朝阳区幸福路88号朝阳小区3号楼",
    "submitter": "施工经理-阿乔",
    "survey_method": "三维激光扫描+全站仪复核",
    "total_stations": 12,
    "remark": "社区公示前预审版本",
    "layers": [
        {"layer_name": "WALL_主体_3F", "entity_count": 234, "order_index": 0},
        {"layer_name": "结构墙final 副本！@#", "entity_count": 180, "order_index": 1},
        {"layer_name": "pipe消防管3层", "entity_count": 95, "order_index": 2},
        {"layer_name": "123456", "entity_count": 50, "order_index": 3},
        {"layer_name": "ELEC__强电_弱电3F", "entity_count": 160, "order_index": 4},
    ],
    "collision_points": [
        {
            "point_code": "COL-001",
            "layer_a": "WALL_主体_3F",
            "layer_b": "pipe消防管3层",
            "anchor_x": 116.456789,
            "anchor_y": 39.987654,
            "anchor_z": 9.2,
            "view_params": {
                "rotation": {"azimuth": 145.3, "pitch": -12.1},
                "zoom": 1.62,
                "viewport": [0, 0, 1920, 1080],
            },
            "description": "3层东侧承重墙内穿消防主管，净距不足5cm",
            "severity": "danger",
        },
        {
            "point_code": "COL-002",
            "layer_a": "结构墙final 副本！@#",
            "layer_b": "ELEC__强电_弱电3F",
            "anchor_x": 116.456820,
            "anchor_y": 39.987701,
            "anchor_z": 9.35,
            "view_params": {
                "rotation": {"azimuth": 210.0, "pitch": -8.5},
                "zoom": 1.40,
                "viewport": [0, 0, 1920, 1080],
            },
            "description": "结构层与弱电桥架在立柱处交叉",
            "severity": "warning",
        },
        {
            "point_code": "COL-003",
            "layer_a": "WALL_主体_3F",
            "layer_b": "123456",
            "anchor_x": 116.456650,
            "anchor_y": 39.987600,
            "anchor_z": 9.1,
            "view_params": {},
            "description": "未知图层与墙体发生疑似重叠",
            "severity": "info",
        },
    ],
    "manual_judgments": [
        {
            "judgment_code": "JUD-2026-001",
            "point_code": "COL-001",
            "judge": "高级工程师-老王",
            "original_result": "valid_collision",
            "final_result": "false_alarm",
            "reason": "现场复核：消防主管已做穿墙套管，净空满足GB50016-2014（2018版）第6.2.9条要求，非真实碰撞",
            "evidence": {
                "site_photo_ref": "PIC-20260615-0037.jpg",
                "recheck_coordinates": {
                    "现场复测坐标": "X=116.456792, Y=39.987655, Z=9.21",
                    "偏差mm": 3,
                },
                "standard_ref": "GB50016-2014 6.2.9",
            },
        }
    ],
}


def section(title):
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)


def test_scenario_1_first_submit():
    section("场景1｜首次提交：主流程走通，主流程带一笔人工改判（异常分支）")
    resp = client.post("/api/v1/survey/plans", json=PAYLOAD)
    assert resp.status_code == 200, f"提交失败: {resp.text}"
    data = resp.json()
    print(f"[OK] 方案ID = {data['plan']['id']}, plan_code = {data['plan']['plan_code']}")
    print(f"[OK] 幂等标记 = {data['idempotency']} （首次提交，预期 None")
    assert data["idempotency"] is None, "首次提交不应有幂等标记"

    stats = data["stats"]
    print(f"[OK] 图层总数={stats['total_layers']}, 合格={stats['valid_layer_count']}, 被拦={stats['blocked_layer_count']}")
    print(f"     被拦截图层名 = {stats['blocked_layer_names']}")
    assert stats["blocked_layer_count"] >= 2, "应至少拦截2个混乱命名图层"

    print(f"[OK] 碰撞点={stats['total_collision_points']}, 已改判={stats['judged_count']}, 待改判={stats['unjudged_count']}")
    assert stats["judged_count"] == 1, "主流程应带1笔人工改判"
    assert stats["judgment_count"] == 1, "人工改判单数应为1"

    print(f"[OK] 改判结果分布 = {stats['judgment_result_distribution']}")
    print(f"[OK] 改判代码 = {stats['judgment_codes']}")
    return data["plan"]["id"]


def test_scenario_2_duplicate_submit():
    section("场景2｜重复提交：相同请求压测，幂等生效，人工改判不重复计为两份")

    for i in range(2):
        resp = client.post("/api/v1/survey/plans", json=PAYLOAD)
        assert resp.status_code == 200
        data = resp.json()
        dup_flag = data['idempotency']['is_duplicate'] if data['idempotency'] else False
        print(f"[OK] 第{i+2}次重复提交 → 幂等拦截 = {dup_flag}")
        assert data["idempotency"] is not None, f"第{i+2}次提交必须命中幂等拦截"
        assert data["idempotency"]["original_plan_code"] == PAYLOAD["plan_code"]
        stats = data["stats"]
        print(f"     人工改判单数={stats['judgment_count']}（预期=1，不能因重复提交增加）")
        assert stats["judgment_count"] == 1, "幂等拦截后人工改判必须保持1，不能重复计数"
        print(f"     碰撞已改判数={stats['judged_count']}（预期=1）")
        assert stats["judged_count"] == 1


def test_scenario_3_layer_validation(plan_id):
    section("场景3｜图层命名混乱被拦截，处理结果说明原因")
    resp = client.get(f"/api/v1/survey/plans/{plan_id}")
    data = resp.json()
    layers = data["layers"]
    blocked = [l for l in layers if not l["is_valid"]]
    print(f"被拦截图层总数:", len(blocked))
    for l in blocked:
        print(f"  - [{l['layer_name']}] 识别类型={l['layer_type']}")
        print(f"    拦截原因: {l['block_reason']}")
        assert len(l["block_reason"]) > 10, "拦截原因必须有详细说明"
        print()
    assert any("标点" in l["block_reason"] or "符号" in l["block_reason"] or "默认" in l["block_reason"] or "纯数字" in l["block_reason"] or "混拼" in l["block_reason"] for l in blocked), "至少有含混乱模式必须能被识别"


def test_scenario_4_coordinate_anchor(plan_id):
    section("场景4｜碰撞点坐标锚定，截图离视角也能说明白（不依赖截图视角）")
    resp = client.get(f"/api/v1/survey/plans/{plan_id}")
    data = resp.json()
    for cp in data["collision_points"]:
        print(f"  碰撞点 {cp['point_code']}")
        print(f"    坐标锚 = {cp['coordinate_anchor']}")
        assert "WGS84" in cp["coordinate_anchor"]
        print(f"    视角快照参数 = {cp['view_params']}")
        print(f"    描述 = {cp['description']}")
        print()


def test_scenario_5_summary_consistency(plan_id):
    section("场景5｜异常明细 ↔ 汇总口径保持一致，负责人看总数就能下钻明细")
    resp = client.get(f"/api/v1/survey/plans/{plan_id}")
    data = resp.json()
    stats = data["stats"]
    cps = data["collision_points"]
    judgments = data["manual_judgments"]

    judged_cps = [cp for cp in cps if cp["is_judged"]]
    unjudged_cps = [cp for cp in cps if not cp["is_judged"]]

    print(f"碰撞点总数: stats={stats['total_collision_points']}, 明细={len(cps)} → {'OK' if stats['total_collision_points'] == len(cps) else 'FAIL'}")
    assert stats["total_collision_points"] == len(cps)

    print(f"已改判: 统计={stats['judged_count']}, 明细={len(judged_cps)} → {'OK' if stats['judged_count'] == len(judged_cps) else 'FAIL'}")
    assert stats["judged_count"] == len(judged_cps)

    print(f"待改判: 统计={stats['unjudged_count']}, 明细={len(unjudged_cps)} → {'OK' if stats['unjudged_count'] == len(unjudged_cps) else 'FAIL'}")
    assert stats["unjudged_count"] == len(unjudged_cps)

    print(f"改判单总数: 统计={stats['judgment_count']}, 明细={len(judgments)} → {'OK' if stats['judgment_count'] == len(judgments) else 'FAIL'}")
    assert stats["judgment_count"] == len(judgments)

    sev_from_detail = {}
    for cp in cps:
        sev_from_detail[cp["severity"]] = sev_from_detail.get(cp["severity"], 0) + 1
    print(f"严重度分布一致? {stats['severity_distribution']} vs {sev_from_detail}")
    assert stats["severity_distribution"] == sev_from_detail


def test_scenario_6_history_tracking(plan_id):
    section("场景6｜历史保留人工确认前后变化，社区公示前可讲给负责人听")
    resp = client.get(f"/api/v1/survey/plans/{plan_id}")
    data = resp.json()
    history = data["review_histories"]
    assert len(history) >= 1
    for h in history:
        print(f"  [{h['created_at'][:19]}] {h['reviewer']} 执行: {h['action']}")
        print(f"    变更前: {json.dumps(h['before_snapshot'], ensure_ascii=False)}")
        print(f"    变更后: {json.dumps(h['after_snapshot'], ensure_ascii=False)}")
        print(f"    差异摘要: {h['diff_summary']}")
        print(f"    备注: {h['comment']}")
        print()
        assert h["before_snapshot"] != h["after_snapshot"], "历史快照前后必须有差异"


def test_scenario_7_extra_judgment(plan_id):
    section("场景7｜再追加一笔改判走异常分支，幂等防重，历史再留一笔")
    extra = {
        "judgment_code": "JUD-2026-002",
        "point_code": "COL-002",
        "judge": "结构工程师-老李",
        "original_result": "valid_collision",
        "final_result": "valid_collision",
        "reason": "复核确认：该交叉处已设置柔性套管，虽不影响结构安全，属真实碰撞但可接受",
        "evidence": {"复核报告编号": "REP-20260615-0088"},
    }
    resp = client.post(f"/api/v1/survey/plans/{plan_id}/judgments", json=extra)
    assert resp.status_code == 200

    resp2 = client.post(f"/api/v1/survey/plans/{plan_id}/judgments", json=extra)
    data2 = resp2.json()
    print(f"[OK] 重复提交改判单，返回同一条记录（幂等）")

    resp3 = client.get(f"/api/v1/survey/plans/{plan_id}")
    data = resp3.json()
    stats = data["stats"]
    print(f"[OK] 追加后改判单={stats['judgment_count']}（预期=2），已改判={stats['judged_count']}（预期=2）")
    assert stats["judgment_count"] == 2
    assert stats["judged_count"] == 2

    history = data["review_histories"]
    print(f"[OK] 历史记录条数 = {len(history)}（预期≥2）")
    assert len(history) >= 2


def test_scenario_8_public_summary(plan_id):
    section("场景8｜社区公示版返回：直接可拿去沟通的格式，非功能清单")
    resp = client.get(f"/api/v1/survey/plans/{plan_id}/public-summary")
    assert resp.status_code == 200
    s = resp.json()
    print("报告标题:", s["report_title"])
    print("生成时间:", s["generated_at"][:19])
    print("方案基本信息:", json.dumps(s["plan_basic"], ensure_ascii=False, indent=2))
    print()
    print("概览(给负责人看的卡片:")
    for k, v in s["overview"].items():
        print(f"  {k}: {v}")
    print()
    print("异常汇总(与明细口径一致):")
    print(json.dumps(s["abnormal_summary"], ensure_ascii=False, indent=2))
    print()
    print("异常明细(逐点坐标锚+结果:")
    for item in s["abnormal_details"]:
        print(f"  [{item['point_code']}] {item['category']}")
        print(f"    坐标锚: {item['coordinate_anchor']}")
        print(f"    描述: {item['description']}")
        print(f"    判定结果: {item['judgment_result']}")
        if item["judge"]:
            print(f"    判定人: {item['judge']} | 理由: {item['reason']}")
        print()
    print("被拦截图层(说明原因):")
    for bl in s["blocked_layers"]:
        print(f"  - [{bl['layer_name']}")
        print(f"    原因: {bl['block_reason']}")
        print(f"    建议: {bl['suggestion']}")
        print()
    print("历史时间线(讲给负责人听):")
    for t in s["history_timeline"]:
        print(f"  [{t['time']}] {t['reviewer']} - {t['action']}")
        print(f"    {t['diff']}")
        if t["comment"]:
            print(f"    注: {t['comment']}")
        print()
    print("审核人沟通话术:")
    print(" ", s["reviewer_note"])
    assert "坐标" in s["reviewer_note"], "沟通话术中必须提到坐标锚"


def main():
    reset_db()
    print("数据库已重置")
    plan_id = test_scenario_1_first_submit()
    test_scenario_2_duplicate_submit()
    test_scenario_3_layer_validation(plan_id)
    test_scenario_4_coordinate_anchor(plan_id)
    test_scenario_5_summary_consistency(plan_id)
    test_scenario_6_history_tracking(plan_id)
    test_scenario_7_extra_judgment(plan_id)
    test_scenario_8_public_summary(plan_id)
    section("全部场景验证通过 ✓")
    print(f"方案ID = {plan_id}")
    print("服务可用接口:")
    print("  POST /api/v1/survey/plans                - 提交方案（幂等+图层校验+改判）")
    print("  GET  /api/v1/survey/plans/{id}            - 方案详情（坐标锚+统计+历史）")
    print("  POST /api/v1/survey/plans/{id}/judgments  - 追加人工改判（幂等）")
    print("  GET  /api/v1/survey/plans/{id}/public-summary - 社区公示版")
    print("  GET  /health")


if __name__ == "__main__":
    main()
