import json
import os
import sys
import time
import subprocess
import urllib.parse
import urllib.request
import signal

BASE = "http://127.0.0.1:5001"
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
VENV_PY = os.path.join(PROJECT_DIR, "venv", "bin", "python")

_server_proc = None


def _ensure_server_running():
    """启动 Flask 服务（如果没在跑），脚本结束时自动清理。"""
    global _server_proc
    try:
        with urllib.request.urlopen(BASE + "/api/silt/sources", timeout=2) as r:
            if r.status == 200:
                print("[自检] 服务已在运行")
                return
    except Exception:
        pass

    print("[自检] 服务未启动，正在启动...")
    env = os.environ.copy()
    env["FLASK_APP"] = os.path.join(PROJECT_DIR, "app.py")
    env["FLASK_DEBUG"] = "0"
    _server_proc = subprocess.Popen(
        [VENV_PY, "-m", "flask", "run", "--host=127.0.0.1", "--port=5001"],
        cwd=PROJECT_DIR,
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    for _ in range(30):
        time.sleep(0.5)
        try:
            with urllib.request.urlopen(BASE + "/api/silt/sources", timeout=2) as r:
                if r.status == 200:
                    print("[自检] 服务启动成功")
                    return
        except Exception:
            pass
    raise RuntimeError("服务启动超时")


def _cleanup_server():
    global _server_proc
    if _server_proc and _server_proc.poll() is None:
        _server_proc.terminate()
        try:
            _server_proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            _server_proc.kill()


def _on_exit(signum, frame):
    _cleanup_server()
    sys.exit(0)


signal.signal(signal.SIGINT, _on_exit)
signal.signal(signal.SIGTERM, _on_exit)


def _build_query(params):
    return urllib.parse.urlencode(params, doseq=True)


def get(path, params=None):
    url = BASE + path
    if params:
        qs = _build_query(params)
        url = url + ("&" if "?" in url else "?") + qs
    with urllib.request.urlopen(url, timeout=10) as r:
        assert r.status == 200, f"GET {url} 返回 {r.status}"
        return json.loads(r.read())


def post(path, data=None):
    body = json.dumps(data or {}).encode("utf-8")
    req = urllib.request.Request(
        BASE + path,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        assert r.status == 200, f"POST {path} 返回 {r.status}"
        return json.loads(r.read())


def _assert(cond, msg):
    if not cond:
        raise AssertionError(f"❌ {msg}")


def test_1_clean_main():
    print("=" * 60)
    print("测试1：主清洗接口 —— 结果结构、异常识别、影响汇总")
    print("=" * 60)
    d = get("/api/silt/clean")
    s = d["summary"]

    _assert("filter_criteria" in d, "返回必须包含 filter_criteria 字段")
    _assert(isinstance(d["filter_criteria"], dict), "filter_criteria 必须是 dict")
    _assert("records" in d, "返回必须包含 records 列表")
    _assert("anomaly_details" in d, "返回必须包含 anomaly_details 异常明细")

    _assert(s["total_records"] > 50, f"总记录数应大于50，实际 {s['total_records']}")
    _assert(s["valid_records"] < s["total_records"], "有效记录应少于总记录（存在异常）")
    _assert(s["anomaly_records"] >= 5, f"异常记录至少5条，实际 {s['anomaly_records']}")
    _assert(s["overall_avg_silt_depth"] > 0, "清洗后平均淤积深度应为正数")

    infl = s["influence_summary"]
    _assert(infl["lab_result_old"] >= 3, f"应检出旧版实验室数据，实际 {infl['lab_result_old']}")
    _assert(infl["manual_override"] >= 1, f"应检出人工改判，实际 {infl['manual_override']}")
    _assert(infl["verbal_note"] >= 1, f"应检出口头备注，实际 {infl['verbal_note']}")
    _assert(infl["sensor_drift"] >= 1, f"应检出传感器漂移，实际 {infl['sensor_drift']}")

    _assert(len(d["anomaly_details"]) == s["anomaly_records"],
            "anomaly_details 条数应与 summary.anomaly_records 一致")
    for a in d["anomaly_details"]:
        _assert("influence_tags" in a and a["influence_tags"],
                f"异常记录 {a.get('id')} 应带 influence_tags")
        _assert("source_label" in a, "异常记录必须有 source_label 便于直接沟通")

    print(f"  总/有效/异常: {s['total_records']}/{s['valid_records']}/{s['anomaly_records']}")
    print(f"  清洗后均值: {s['overall_avg_silt_depth']}米")
    print(f"  拉动值: {s['pull_up_amount']}米")
    print("  ✅ 主清洗接口通过")
    return d


def test_2_filter_consistency(clean_data):
    print()
    print("=" * 60)
    print("测试2：筛选口径回显 & 屏幕与导出口径一致")
    print("=" * 60)

    params = {"station": "北防波堤", "exclude_old": "true"}
    f = get("/api/silt/clean", params=params)

    _assert(f["filter_criteria"]["station"] == "北防波堤",
            "返回的筛选口径必须包含站点参数")
    _assert(f["filter_criteria"]["exclude_old"] == "true",
            "返回的筛选口径必须包含 exclude_old 参数")
    _assert(f["filter_criteria"] == params,
            "筛选口径回显必须与请求参数完全一致（导出与屏幕不分家）")

    for r in f["records"]:
        if r["source"] == "lab_result_old":
            _assert(False, f"exclude_old=true 时结果中不应出现 lab_result_old，实际在 {r['id']} 出现")

    stations_in_result = set(r["station"] for r in f["records"])
    _assert(stations_in_result == {"北防波堤"},
            f"筛选后所有记录都应属于北防波堤，实际 {stations_in_result}")

    print(f"  请求参数: {params}")
    print(f"  返回口径: {f['filter_criteria']}")
    print(f"  筛选后记录数: {f['summary']['total_records']}")
    print(f"  筛选后均值: {f['summary']['overall_avg_silt_depth']}米")
    print("  ✅ 筛选口径一致性通过")


def test_3_export_consistency(clean_data):
    print()
    print("=" * 60)
    print("测试3：导出一致性 —— records 与 summary 可互相对上")
    print("=" * 60)

    records = clean_data["records"]
    s = clean_data["summary"]

    normal_records = [
        r for r in records
        if not r["is_drift"] and not r["is_outlier"]
        and r["source"] not in ("lab_result_old", "verbal_note")
    ]
    avg_from_records = round(sum(r["silt_depth"] for r in normal_records) / len(normal_records), 3)

    _assert(len(normal_records) == s["valid_records"],
            f"有效记录数对不上: records里{len(normal_records)} vs summary里{s['valid_records']}")
    _assert(abs(avg_from_records - s["overall_avg_silt_depth"]) < 0.001,
            f"均值对不上: records算得{avg_from_records} vs summary里{s['overall_avg_silt_depth']}")
    _assert(len(records) == s["total_records"],
            f"总记录数对不上: records里{len(records)} vs summary里{s['total_records']}")

    for st, st_stat in s["station_stats"].items():
        st_normal = [r for r in normal_records if r["station"] == st]
        _assert(len(st_normal) == st_stat["count"],
                f"{st} 的记录数对不上")

    print(f"  records 有效数: {len(normal_records)} == summary.valid_records: {s['valid_records']}")
    print(f"  records 重算均值: {avg_from_records} == summary.avg: {s['overall_avg_silt_depth']}")
    print("  ✅ 导出一致性通过")


def test_4_anomaly_explains_summary(clean_data):
    print()
    print("=" * 60)
    print("测试4：异常明细能解释汇总变化")
    print("=" * 60)

    s = clean_data["summary"]
    anomalies = clean_data["anomaly_details"]

    anomaly_ids = {a["id"] for a in anomalies}
    drift_count = sum(1 for a in anomalies if a["is_drift"])
    override_count = sum(1 for a in anomalies if a["is_override"])
    old_count = sum(1 for a in anomalies if a["source"] == "lab_result_old")

    _assert(drift_count == s["influence_summary"]["sensor_drift"],
            "漂移记录数与 influence_summary 对不上")
    _assert(override_count == s["influence_summary"]["manual_override"],
            "人工改判数与 influence_summary 对不上")
    _assert(old_count == s["influence_summary"]["lab_result_old"],
            "旧版数据数与 influence_summary 对不上")

    anomaly_id = anomalies[0]["id"]
    detail = get(f"/api/silt/records/{anomaly_id}")

    _assert("impact_analysis" in detail, "下钻记录必须含 impact_analysis")
    _assert(isinstance(detail["impact_analysis"]["contribution_to_pull_up"], (int, float)),
            "contribution_to_pull_up 必须是数字")
    _assert("influence_tags" in detail and len(detail["influence_tags"]) > 0,
            "下钻记录必须有 influence_tags 说明来源")

    manual_records = [a for a in anomalies if a["is_override"]]
    if manual_records:
        mr = manual_records[0]
        _assert(mr.get("raw_value") is not None, "人工改判记录必须保留 raw_value 原值")
        _assert(mr.get("override_note"), "人工改判记录必须带 override_note 说明原因")
        print(f"  人工改判样例: {mr['station']} 原值{mr['raw_value']} -> 改判{mr['silt_depth']}")

    print(f"  异常记录 {len(anomalies)} 条，覆盖漂移{drift_count}/改判{override_count}/旧版{old_count}")
    print(f"  下钻样例 {anomaly_id}: 拉动贡献 {detail['impact_analysis']['contribution_to_pull_up']}")
    print("  ✅ 异常明细解释汇总通过")


def test_5_snapshot_history():
    print()
    print("=" * 60)
    print("测试5：快照、人工确认、前后对比历史")
    print("=" * 60)

    snap_store = os.path.join(PROJECT_DIR, "data_store", "snapshots.json")
    if os.path.exists(snap_store):
        os.remove(snap_store)

    s1 = post("/api/silt/snapshots", {
        "name": "初版（全量数据）",
        "filter_criteria": {},
    })
    _assert(s1["confirmed"] is False, "新创建的快照应为未确认")
    _assert(s1["snapshot_id"].startswith("snap_"), "快照ID格式不对")
    _assert("filter_criteria" in s1, "快照必须留存当时的筛选口径")

    s2 = post("/api/silt/snapshots", {
        "name": "修正版（排除旧版+口头）",
        "filter_criteria": {"exclude_old": "true", "exclude_verbal": "true"},
    })
    _assert(s2["delta_vs_previous"] is not None, "第二个快照必须含与上一版差异")
    _assert("avg_diff" in s2["delta_vs_previous"], "差异中必须含均值变化")

    confirmed = post(f"/api/silt/snapshots/{s2['snapshot_id']}/confirm", {"operator": "老何"})
    _assert(confirmed["confirmed"] is True, "确认后 confirmed 应为 True")
    _assert(confirmed["confirmed_by"] == "老何", "确认人应为老何")
    _assert(confirmed["confirmed_at"] is not None, "确认时间必须记录")

    cmp = get("/api/silt/snapshots/compare", params={"from": s1["snapshot_id"], "to": s2["snapshot_id"]})
    _assert(cmp["snapshot_1"] == s1["snapshot_id"], "对比 from 不对")
    _assert(cmp["snapshot_2"] == s2["snapshot_id"], "对比 to 不对")
    _assert("summary_diff" in cmp, "对比结果必须有 summary_diff")
    _assert(len(cmp["changed_records"]) > 0, "排除旧版+口头后应存在被移除的变动记录")

    removed = [r for r in cmp["changed_records"] if r.get("change_type") == "removed"]
    for r in removed:
        _assert(r["after"] is None, "removed 类型记录的 after 应为 None")

    snaps = get("/api/silt/snapshots")["snapshots"]
    _assert(len(snaps) >= 2, f"快照列表应至少有2条，实际 {len(snaps)}")
    confirmed_snaps = get("/api/silt/snapshots", params={"confirmed_only": "true"})["snapshots"]
    _assert(len(confirmed_snaps) >= 1 and all(s["confirmed"] for s in confirmed_snaps),
            "confirmed_only 过滤应只返回已确认快照")

    print(f"  快照1: {s1['snapshot_name']} -> 均值{s1['summary']['overall_avg_silt_depth']}米")
    print(f"  快照2: {s2['snapshot_name']} -> 均值{s2['summary']['overall_avg_silt_depth']}米")
    print(f"  均值差异: {s2['delta_vs_previous']['avg_diff']}米")
    print(f"  确认人: {confirmed['confirmed_by']} @ {confirmed['confirmed_at'][:19]}")
    print(f"  变动记录数: {len(cmp['changed_records'])}")
    print("  ✅ 快照与对比历史通过")


def test_6_meeting_interface():
    print()
    print("=" * 60)
    print("测试6：早会接口 —— 返回可直接沟通的结论")
    print("=" * 60)

    m = get("/api/silt/summary/for_meeting")

    required_top = ["report_title", "conclusion", "pull_up_analysis",
                    "source_influence", "key_anomalies", "filter_criteria"]
    for k in required_top:
        _assert(k in m, f"早会接口必须包含字段 {k}")

    _assert(isinstance(m["report_title"], str) and len(m["report_title"]) > 0,
            "report_title 必须是非空字符串")
    _assert(m["conclusion"]["unit"] == "米", "结论必须带单位")
    _assert(m["conclusion"]["overall_avg_silt_depth"] > 0, "结论均值必须为正")

    _assert("description" in m["pull_up_analysis"],
            "拉动分析必须带描述文字（直接给人读）")
    _assert(len(m["pull_up_analysis"]["description"]) > 10,
            "拉动分析描述长度应足以沟通")

    _assert("description_lines" in m["source_influence"],
            "影响来源必须有 description_lines 文字说明")
    _assert(len(m["source_influence"]["description_lines"]) >= 3,
            "至少3条影响说明，足够早会逐条汇报")
    for line in m["source_influence"]["description_lines"]:
        _assert(isinstance(line, str) and len(line) > 5,
                "每条影响说明应是有意义的字符串")

    _assert(len(m["key_anomalies"]) >= 3, "至少列出 Top3 异常")
    for a in m["key_anomalies"]:
        _assert("station" in a and "silt_depth" in a and "influence_tags" in a,
                "每条异常需有站点、数值、影响标签，便于沟通")

    print(f"  标题: {m['report_title']}")
    print(f"  结论: 平均{m['conclusion']['overall_avg_silt_depth']}{m['conclusion']['unit']} "
          f"({m['conclusion']['valid_record_count']}/{m['conclusion']['total_record_count']}条有效)")
    print(f"  拉动分析: {m['pull_up_analysis']['description']}")
    print(f"  影响说明 {len(m['source_influence']['description_lines'])} 条; "
          f"Top异常 {len(m['key_anomalies'])} 条")
    print("  ✅ 早会沟通接口通过")


def main():
    print("港湾淤积数据清洗 —— 交付验证脚本")
    print(f"项目目录: {PROJECT_DIR}")
    _ensure_server_running()

    passed = 0
    failed = 0

    try:
        clean_data = test_1_clean_main()
        passed += 1
    except AssertionError as e:
        failed += 1
        print(f"  ❌ 测试1失败: {e}")
        clean_data = None

    if clean_data:
        test_cases = [
            (test_2_filter_consistency, "测试2", True),
            (test_3_export_consistency, "测试3", True),
            (test_4_anomaly_explains_summary, "测试4", True),
            (test_5_snapshot_history, "测试5", False),
            (test_6_meeting_interface, "测试6", False),
        ]
        for fn, name, needs_clean_data in test_cases:
            try:
                fn(clean_data) if needs_clean_data else fn()
                passed += 1
            except AssertionError as e:
                failed += 1
                print(f"  ❌ {name}失败: {e}")
            except Exception as e:
                failed += 1
                print(f"  ❌ {name}异常: {type(e).__name__}: {e}")
    else:
        failed += 5
        print("  ❌ 主清洗失败，后续测试跳过")

    print()
    print("=" * 60)
    print(f"结果: 通过 {passed} / {passed + failed}")
    print("=" * 60)

    _cleanup_server()

    if failed > 0:
        print(f"\n❌ 共 {failed} 项失败")
        sys.exit(1)
    else:
        print("\n✅ 所有验证项通过，可直接交付")
        sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    finally:
        _cleanup_server()
