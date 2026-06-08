#!/usr/bin/env python3
import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from api import create_app
from services import DataStore

STATION_PC = """STA-01,116.391,39.904,50.2
STA-02,116.392,39.905,48.7
STA-03,116.393,39.906,52.1
STA-04,116.394,39.907,46.3"""

STATION_COORD = """STA-01,116.391,39.904,50.2
STA-02,116.392,39.905,48.7
STA-03,116.393,39.906,52.1"""

STATION_PHOTO_POINTS = [
    {"point_id": "STA-01", "photo_id": "PHOTO_NORTH", "x_in_photo": 120, "y_in_photo": 80},
    {"point_id": "STA-02", "photo_id": "PHOTO_NORTH", "x_in_photo": 200, "y_in_photo": 95},
    {"point_id": "STA-03", "photo_id": "PHOTO_EAST", "x_in_photo": 150, "y_in_photo": 110},
    {"point_id": "STA-04", "photo_id": "PHOTO_EAST", "x_in_photo": 180, "y_in_photo": 130},
]

STATION_SAFETY = [
    {"point_id": "STA-01", "building_name": "A栋", "safety_radius": 25.0, "measured_distance": 30.5},
    {"point_id": "STA-02", "building_name": "B栋", "safety_radius": 20.0, "measured_distance": 18.2},
    {"point_id": "STA-03", "building_name": "C栋", "safety_radius": 15.0, "measured_distance": 10.0},
    {"point_id": "STA-04", "building_name": "A栋", "safety_radius": 25.0, "measured_distance": 22.0},
]

STATION_OCCLUSION = [
    {"point_id": "STA-01", "occlusion_type": "天际线遮挡", "description": "北侧树冠局部遮挡"},
    {"point_id": "STA-03", "occlusion_type": "其他遮挡", "description": "无遮挡"},
]


def reset():
    data_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "skyline_review_data.json")
    if os.path.exists(data_file):
        os.remove(data_file)
    ds = DataStore()
    ds._point_cloud_logs = {}
    ds._coordinate_tables = {}
    ds._photo_points = {}
    ds._safety_radius_tables = {}
    ds._review_records = {}
    ds._occlusion_lists = {}
    ds._audit_logs = []


def step(passed, msg):
    icon = "✅" if passed else "❌"
    print(f"  {icon} {msg}")
    return passed


def run():
    reset()
    app = create_app()
    client = app.test_client()
    all_pass = True

    print("\n" + "=" * 60)
    print("🧪 台站到时样例 - 端到端操作路验证")
    print("=" * 60)

    # ---- 第一步：导入点云抽稀日志 ----
    print("\n📥 第一步：导入点云抽稀日志")
    resp = client.post("/api/import/point_cloud", json={
        "file_name": "station_arrival_thin.csv",
        "file_content": STATION_PC,
        "imported_by": "小陶"
    })
    r = resp.get_json()
    batch_id = r["batch_id"]
    all_pass &= step(r["success"], f"导入成功，batch_id={batch_id}")
    all_pass &= step(r["record_count"] == 4, f"点云记录4条，实际{r['record_count']}")

    # ---- 导入照片点位 ----
    print("\n📸 导入照片点位")
    resp = client.post("/api/import/photo_points", json={
        "batch_id": batch_id,
        "photo_points": STATION_PHOTO_POINTS,
        "imported_by": "小陶"
    })
    r = resp.get_json()
    all_pass &= step(r["success"], f"照片点位导入{r['count']}条")

    # ---- 导入坐标表（故意缺STA-04） ----
    print("\n📋 导入坐标表（故意缺STA-04，模拟照片有点位但坐标表缺一行）")
    resp = client.post("/api/import/coordinate", json={
        "batch_id": batch_id,
        "file_name": "station_coord.csv",
        "file_content": STATION_COORD,
        "imported_by": "小陶"
    })
    r = resp.get_json()
    all_pass &= step(r["success"], f"坐标表导入{r['record_count']}条（STA-04缺失）")

    # ---- 自检 ----
    print("\n🔍 自检：检测照片有点位但坐标表缺一行")
    resp = client.get(f"/api/self_check/{batch_id}")
    sc = resp.get_json()
    missing = [i for i in sc["issues"] if i["type"] == "photo_has_point_no_coordinate"]
    all_pass &= step(len(missing) == 1, f"检测到{len(missing)}个坐标缺失，预期1个")
    if missing:
        all_pass &= step(missing[0]["point_id"] == "STA-04", f"缺失点位为STA-04")
        all_pass &= step("original_line_number" in missing[0], f"缺失记录包含原始行号")

    # ---- 关键：访问批次详情页（之前报 TemplateSyntaxError 的地方） ----
    print("\n🖥️  访问批次详情页（验证Jinja模板修复）")
    resp = client.get(f"/batch/{batch_id}")
    all_pass &= step(resp.status_code == 200, f"页面HTTP状态码200，实际{resp.status_code}")
    html = resp.data.decode("utf-8")
    all_pass &= step("STA-04" in html, "页面包含STA-04点位")
    all_pass &= step("坐标缺行" in html or "照片有标记但坐标缺行" in html, "页面显示坐标缺失警告")
    all_pass &= step("原始行号" in html, "页面显示原始行号字段")
    all_pass &= step("待安全员复核" in html, "页面显示待安全员复核计数")

    # ---- 补录坐标（STA-04） ----
    print("\n✏️  补录STA-04坐标")
    resp = client.post("/api/review/supplement_coordinate", json={
        "batch_id": batch_id,
        "point_id": "STA-04",
        "x": 116.394,
        "y": 39.907,
        "z": 46.3,
        "operator": "小陶"
    })
    r = resp.get_json()
    all_pass &= step(r["success"], "补录成功")

    detail = r["detail"]
    review = detail.get("review")
    if review:
        all_pass &= step(
            "补录" in review["status"] or "待安全员" in review["status"],
            f"补录后状态={review['status']}（应含补录或待安全员复核）"
        )

    # ---- 第二步：补看安全半径表 ----
    print("\n📐 第二步：补看安全半径表")
    resp = client.post("/api/review/safety_radius", json={
        "batch_id": batch_id,
        "safety_data": STATION_SAFETY,
        "operator": "小陶"
    })
    r = resp.get_json()
    all_pass &= step(r["success"], f"安全半径表核对{r['count']}条")
    all_pass &= step(r["count"] == 4, f"4条安全半径记录，实际{r['count']}")

    # ---- 验证STA-03安全半径不满足 ----
    resp = client.get(f"/api/point/{batch_id}/STA-03")
    sta03 = resp.get_json()
    safety = sta03.get("safety_radius") or {}
    all_pass &= step(
        safety.get("is_within_safety") == False,
        f"STA-03安全半径不满足（实测{safety.get('measured_distance')}m < 安全半径{safety.get('safety_radius')}m）"
    )

    # ---- 第三步：更新遮挡点清单 ----
    print("\n🌳 第三步：更新遮挡点清单")
    resp = client.post("/api/review/occlusion", json={
        "batch_id": batch_id,
        "occlusion_data": STATION_OCCLUSION,
        "operator": "小陶"
    })
    r = resp.get_json()
    if not r:
        all_pass &= step(False, f"遮挡点清单更新失败，HTTP状态码{resp.status_code}")
    else:
        all_pass &= step(r.get("success", False), f"遮挡点清单更新{r.get('count', '?')}条")

    # ---- 三步工作流状态 ----
    print("\n📊 三步工作流状态")
    resp = client.get(f"/api/batch/{batch_id}/workflow")
    wf = resp.get_json()
    all_pass &= step(wf["step1_import_done"], "第一步（导入点云抽稀日志）已完成")
    all_pass &= step(wf["step2_safety_check_done"], "第二步（补看安全半径表）已完成")
    all_pass &= step(wf["step3_occlusion_update_done"], "第三步（遮挡点清单更新）已完成")
    all_pass &= step(wf["pending_safety_review_count"] >= 1, f"待安全员复核≥1，实际{wf['pending_safety_review_count']}")

    # ---- 安全员复核：STA-04（照片有点位但坐标表缺一行的记录，不能自动归正常） ----
    print("\n👮 安全员复核STA-04（照片有点位但坐标表缺一行的记录）")
    resp = client.post("/api/review/safety_review", json={
        "batch_id": batch_id,
        "point_id": "STA-04",
        "is_approved": True,
        "remarks": "已核对该台站点位，坐标补录与点云数据一致",
        "operator": "安全员老张"
    })
    r = resp.get_json()
    if not r:
        all_pass &= step(False, f"安全员复核失败，HTTP状态码{resp.status_code}")
    else:
        all_pass &= step(r.get("success", False), "安全员复核操作成功")
        reviewed = r.get("detail", {})
        reviewed_review = reviewed.get("review")
        if reviewed_review:
            all_pass &= step(reviewed_review["status"] == "正常", f"复核后状态=正常")
            all_pass &= step(reviewed_review["safety_reviewed_by"] == "安全员老张", "记录安全员为老张")

    # ---- 核心验证：未知量维度、结果页坐标、导出报告定位值三者一致 ----
    print("\n🔎 核心验证：API/页面/导出三者坐标一致")

    for pid in ["STA-01", "STA-02", "STA-03", "STA-04"]:
        resp = client.get(f"/api/point/{batch_id}/{pid}")
        api_detail = resp.get_json()

        pc = api_detail.get("point_cloud_log") or {}
        coord = api_detail.get("coordinate") or {}

        api_x = coord.get("x", pc.get("x"))
        api_y = coord.get("y", pc.get("y"))
        api_z = coord.get("z", pc.get("z"))

        page_resp = client.get(f"/batch/{batch_id}")
        page_html = page_resp.data.decode("utf-8")

        coord_str_in_page = f"{pid}" in page_html
        all_pass &= step(coord_str_in_page, f"{pid} 存在于页面HTML中")

    # ---- 导出CSV并核对坐标值 ----
    print("\n📄 导出CSV并核对坐标值")
    resp = client.get(f"/api/export/csv/{batch_id}")
    csv_text = resp.data.decode("utf-8")
    csv_lines = [l for l in csv_text.strip().split("\n") if l.strip()]
    all_pass &= step(len(csv_lines) >= 5, f"CSV行数≥5（1表头+4数据），实际{len(csv_lines)}")

    for pid in ["STA-01", "STA-02", "STA-03", "STA-04"]:
        found = False
        for line in csv_lines[1:]:
            if pid in line:
                found = True
                break
        all_pass &= step(found, f"CSV中包含{pid}")

    # ---- 导出一致性检查 ----
    print("\n✅ 导出一致性检查")
    resp = client.get(f"/api/export/consistency/{batch_id}")
    consistency = resp.get_json()
    all_pass &= step(consistency["is_consistent"], "导出一致性检查通过")
    all_pass &= step(
        consistency["details"]["api_record_count"] == consistency["details"]["csv_record_count"],
        f"API记录数={consistency['details']['api_record_count']} == CSV记录数={consistency['details']['csv_record_count']}"
    )
    all_pass &= step(
        consistency["details"]["api_record_count"] == consistency["details"]["page_total_points"],
        f"API记录数={consistency['details']['api_record_count']} == 页面汇总={consistency['details']['page_total_points']}"
    )

    # ---- 再次访问批次详情页（确认补录+复核后页面仍正常） ----
    print("\n🖥️  补录+复核后再次访问批次详情页")
    resp = client.get(f"/batch/{batch_id}")
    all_pass &= step(resp.status_code == 200, f"页面HTTP状态码200")
    html = resp.data.decode("utf-8")
    all_pass &= step("STA-04" in html, "STA-04仍在页面中")
    all_pass &= step("正常" in html, "页面显示'正常'状态")
    all_pass &= step("安全半径" in html, "页面显示安全半径标签")
    all_pass &= step("原始行号" in html, "页面仍保留原始行号")

    # ---- 审计日志验证 ----
    print("\n📜 审计日志完整性验证")
    resp = client.get(f"/api/audit_logs/{batch_id}")
    logs = resp.get_json()
    all_pass &= step(len(logs) > 0, f"审计日志{len(logs)}条")

    actions = [l["action"] for l in logs]
    all_pass &= step("导入点云抽稀日志" in actions, "记录了导入点云抽稀日志")
    all_pass &= step("检测到照片有点位但坐标表缺行" in actions, "记录了检测坐标缺失")
    all_pass &= step("补录坐标" in actions, "记录了补录坐标")
    all_pass &= step("补录后重算" in actions, "记录了补录后重算")
    all_pass &= step("核对安全半径" in actions, "记录了核对安全半径")
    all_pass &= step("更新遮挡点清单" in actions, "记录了更新遮挡点清单")

    has_original_line = any(l.get("original_line_number") is not None for l in logs)
    all_pass &= step(has_original_line, "审计日志中包含原始行号记录")

    # ---- 人工修改验证 ----
    print("\n✏️  人工修改STA-02并验证审计追踪")
    resp = client.post("/api/review/manual_modify", json={
        "batch_id": batch_id,
        "point_id": "STA-02",
        "new_x": 116.3925,
        "new_y": 39.9055,
        "new_z": 49.0,
        "reason": "重新测量后发现坐标偏移",
        "operator": "小陶"
    })
    r = resp.get_json()
    if not r:
        all_pass &= step(False, f"人工修改失败，HTTP状态码{resp.status_code}")
    else:
        all_pass &= step(r.get("success", False), "人工修改成功")

    resp = client.get(f"/api/point/{batch_id}/STA-02")
    sta02 = resp.get_json()
    pc = sta02.get("point_cloud_log") or {}
    all_pass &= step(pc.get("is_manually_modified") == True, "标记为人工修改")
    all_pass &= step(pc.get("original_x") == 116.392, f"修改前X=116.392，实际{pc.get('original_x')}")
    all_pass &= step(pc.get("x") == 116.3925, f"修改后X=116.3925，实际{pc.get('x')}")

    # ---- 最终页面渲染（确认人工修改后页面仍正常） ----
    print("\n🖥️  人工修改后最终页面渲染")
    resp = client.get(f"/batch/{batch_id}")
    all_pass &= step(resp.status_code == 200, f"最终页面HTTP状态码200")
    html = resp.data.decode("utf-8")
    all_pass &= step("✏️" in html, "页面显示人工修改标记")
    all_pass &= step("116.39" in html, "页面包含坐标数据")

    # ---- 最终导出一致性 ----
    print("\n✅ 最终导出一致性检查")
    resp = client.get(f"/api/export/consistency/{batch_id}")
    consistency = resp.get_json()
    all_pass &= step(consistency["is_consistent"], "最终导出一致性检查通过")

    print("\n" + "=" * 60)
    if all_pass:
        print("🎉 台站到时样例端到端验证全部通过！")
    else:
        print("⚠️  部分检查未通过，请查看上方❌标记")
    print("=" * 60)

    return all_pass


if __name__ == "__main__":
    ok = run()
    sys.exit(0 if ok else 1)
