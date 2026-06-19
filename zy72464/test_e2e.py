#!/usr/bin/env python3
"""
公园夜跑路线安全 - 端到端测试脚本

覆盖流程：启动→导入→重复导入→补录→复核→导出→核对CSV/GeoJSON
重点确认：CSV不再保留旧空值
"""
import csv as csv_mod
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from park_night_run.database import init_db
from park_night_run.importer import (
    import_sampling_points, update_complaint_codes,
    get_all_points, lookup_point_with_history
)
from park_night_run.boundary_rules import (
    get_pending_boundary_points, confirm_boundary_point
)
from park_night_run.exporter import export_all, generate_summary_report

PASS_COUNT = 0
FAIL_COUNT = 0


def assert_eq(actual, expected, label=""):
    global PASS_COUNT, FAIL_COUNT
    if actual == expected:
        PASS_COUNT += 1
    else:
        FAIL_COUNT += 1
        print("FAIL %s: expected=%s actual=%s" % (label, expected, actual))


def assert_true(condition, label=""):
    global PASS_COUNT, FAIL_COUNT
    if condition:
        PASS_COUNT += 1
    else:
        FAIL_COUNT += 1
        print("FAIL %s" % label)


def test_full_flow():
    tmp = tempfile.mkdtemp()
    db_path = os.path.join(tmp, "test.db")

    import park_night_run.database as db_mod
    db_mod.DB_PATH = db_path

    if os.path.exists(db_path):
        os.remove(db_path)
    init_db()

    # ---- Step 1: First import ----
    r1 = import_sampling_points("data/sampling_points_demo.csv", operator="阿宁")
    assert_eq(r1["inserted"], 8, "Step1: inserted=8")
    assert_eq(r1["updated"], 0, "Step1: updated=0")
    assert_eq(len(r1["new_codes"]), 8, "Step1: new_codes=8")

    pts = get_all_points()
    assert_eq(len(pts), 8, "Step1: total=8")

    empty_streets = [p for p in pts if not p["street_name"]]
    assert_eq(len(empty_streets), 0, "Step1: no empty streets in DB")

    non_boundary = [p for p in pts if p["is_boundary"] == 0]
    assert_true(all(p["boundary_review_status"] == "confirmed" for p in non_boundary),
                "Step1: non-boundary all confirmed")

    wjgk = [p for p in pts if "望京公园正门" in (p["remark"] or "")]
    assert_eq(len(wjgk), 1, "Step1: found 望京公园正门")
    assert_eq(wjgk[0]["street_name"], "望京街道", "Step1: 望京公园正门 street=望京街道")

    dhjs = [p for p in pts if "东湖街道健身区" in (p["remark"] or "")]
    assert_eq(len(dhjs), 1, "Step1: found 东湖街道健身区")
    assert_eq(dhjs[0]["street_name"], "东湖街道", "Step1: 东湖街道健身区 street=东湖街道")

    # ---- Step 2: Re-import same file ----
    r2 = import_sampling_points("data/sampling_points_demo.csv", operator="阿宁")
    assert_true(r2["skipped"], "Step2: skipped=True")
    assert_eq(len(r2["reused_codes"]), 8, "Step2: 8 reused")
    assert_eq(len(r2["new_codes"]), 0, "Step2: 0 new")
    assert_eq(len(get_all_points()), 8, "Step2: total still 8")

    # ---- Step 3: Import modified CSV ----
    mod_csv = os.path.join(tmp, "modified.csv")
    with open(mod_csv, 'w', encoding='utf-8-sig') as f:
        f.write("longitude,latitude,lighting,safety_level,remark,投诉编号\n")
        f.write("116.4700,39.9900,良好,high,望京公园正门(已安装路灯),\n")
        f.write("116.4785,39.9925,昏暗,medium,望京东湖交界路口,\n")
        f.write("116.4850,39.9950,良好,low,东湖街道健身区,\n")
        f.write("116.4650,39.9850,昏暗,medium,花家地北门口,\n")
        f.write("116.4600,39.9800,无灯,high,花家地地下通道入口,\n")
        f.write("116.4750,39.9875,良好,low,望京花家地边界拐角处,\n")
        f.write("116.4200,40.0000,良好,medium,大屯街道北园,\n")
        f.write("116.4450,39.9950,昏暗,high,大屯望京交界桥底,\n")

    r3 = import_sampling_points(mod_csv, operator="阿宁")
    assert_true(not r3["skipped"], "Step3: not skipped")
    assert_eq(len(r3["reused_codes"]), 8, "Step3: 8 reused")
    assert_eq(len(r3["new_codes"]), 0, "Step3: 0 new")

    lookup = lookup_point_with_history("望京公园正门")
    assert_true(len(lookup) > 0, "Step3: found 望京公园正门")
    if lookup:
        assert_eq(lookup[0]["point"]["street_name"], "望京街道",
                  "Step3: street still 望京街道 after modified import")
        remark_hist = [h for h in lookup[0]["history"] if h["field_name"] == "remark"]
        assert_true(len(remark_hist) > 0, "Step3: remark history exists")
        if remark_hist:
            assert_true("原话" in (remark_hist[0]["change_reason"] or ""),
                        "Step3: history preserves original text")

    # ---- Step 4: Add complaints ----
    for p in get_all_points():
        update_complaint_codes(p["id"], "TS-2026-%03d" % p["id"], operator="阿宁")

    wjgk_after = [p for p in get_all_points() if "望京公园正门" in (p["remark"] or "")]
    if wjgk_after:
        assert_true(wjgk_after[0]["process_status"] in ("complaint_added", "boundary_review"),
                    "Step4: 望京公园正门 process after complaint")

    # ---- Step 5: Confirm boundary ----
    pending = get_pending_boundary_points()
    for p in pending:
        confirm_boundary_point(p["id"], p["street_name"], operator="阿宁")

    summary = generate_summary_report()
    assert_eq(summary["empty_street_count"], 0, "Step5: empty_street_count=0 after confirm")

    # ---- Step 6: Export all ----
    geojson_path = os.path.join(tmp, "output.geojson")
    csv_path = os.path.join(tmp, "output.csv")

    exp = export_all(geojson_path, csv_path, include_pending_boundary=True, operator="阿宁")

    assert_eq(exp["total_exported"], 8, "Step6: exported 8")
    assert_eq(exp["geojson_empty_streets"], 0, "Step6: GeoJSON 0 empty")
    assert_eq(exp["csv_empty_streets"], 0, "Step6: CSV 0 empty")

    # ---- Step 7: Read CSV file and verify ----
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv_mod.DictReader(f)
        csv_rows = list(reader)

    assert_eq(len(csv_rows), 8, "Step7: CSV 8 rows")

    csv_empty = [r for r in csv_rows if not r.get("street_name")]
    assert_eq(len(csv_empty), 0, "Step7: CSV 0 empty street_name (KEY CHECK)")

    csv_wjgk = [r for r in csv_rows if "望京公园正门" in r.get("remark", "")]
    assert_eq(len(csv_wjgk), 1, "Step7: CSV found 望京公园正门")
    if csv_wjgk:
        assert_eq(csv_wjgk[0]["street_name"], "望京街道",
                  "Step7: CSV 望京公园正门 street=望京街道")

    csv_dhjs = [r for r in csv_rows if "东湖街道健身区" in r.get("remark", "")]
    assert_eq(len(csv_dhjs), 1, "Step7: CSV found 东湖街道健身区")
    if csv_dhjs:
        assert_eq(csv_dhjs[0]["street_name"], "东湖街道",
                  "Step7: CSV 东湖街道健身区 street=东湖街道")

    # ---- Step 8: Verify GeoJSON ----
    with open(geojson_path, 'r', encoding='utf-8') as f:
        gj = json.load(f)

    gj_empty = [f for f in gj["features"] if not f["properties"]["street_name"]]
    assert_eq(len(gj_empty), 0, "Step8: GeoJSON 0 empty street_name")

    gj_wjgk = [f for f in gj["features"] if "望京公园正门" in f["properties"].get("remark", "")]
    assert_eq(len(gj_wjgk), 1, "Step8: GeoJSON found 望京公园正门")
    if gj_wjgk:
        assert_eq(gj_wjgk[0]["properties"]["street_name"], "望京街道",
                  "Step8: GeoJSON 望京公园正门 street=望京街道")

    gj_dhjs = [f for f in gj["features"] if "东湖街道健身区" in f["properties"].get("remark", "")]
    assert_eq(len(gj_dhjs), 1, "Step8: GeoJSON found 东湖街道健身区")
    if gj_dhjs:
        assert_eq(gj_dhjs[0]["properties"]["street_name"], "东湖街道",
                  "Step8: GeoJSON 东湖街道健身区 street=东湖街道")

    # ---- Step 9: Verify DB final state ----
    final_pts = get_all_points()
    assert_true(all(p["street_name"] for p in final_pts), "Step9: DB all streets non-empty")
    nb = [p for p in final_pts if p["is_boundary"] == 0]
    assert_true(all(p["boundary_review_status"] == "confirmed" for p in nb),
                "Step9: non-boundary all confirmed")

    # ---- Step 10: Lookup with history ----
    for kw in ["望京公园正门", "东湖街道健身区"]:
        items = lookup_point_with_history(kw)
        assert_true(len(items) > 0, "Step10: lookup %s found" % kw)
        if items:
            p = items[0]["point"]
            assert_true(p["street_name"] is not None and p["street_name"] != "",
                        "Step10: %s street non-empty in DB" % kw)

    # Cleanup
    import shutil
    shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    test_full_flow()
    print("\n%d passed, %d failed" % (PASS_COUNT, FAIL_COUNT))
    if FAIL_COUNT > 0:
        sys.exit(1)
    else:
        print("ALL ASSERTIONS PASSED")
        sys.exit(0)
