import json
import sys
import time
from typing import Dict, Any
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError


BASE = "http://127.0.0.1:8000"


def _req(method: str, path: str, payload: Dict[str, Any] = None) -> Dict[str, Any]:
    url = f"{BASE}{path}"
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    req = Request(url, data=data, method=method, headers=headers)
    try:
        with urlopen(req, timeout=5) as resp:
            body = resp.read().decode("utf-8")
            return {"status": resp.status, "json": json.loads(body) if body else None}
    except HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            j = json.loads(body)
        except Exception:
            j = {"raw": body}
        return {"status": e.code, "json": j}
    except URLError as e:
        print(f"  ✗ 连不上 {BASE}：{e}")
        print("  请先执行：uvicorn app:app --host 127.0.0.1 --port 8000")
        sys.exit(1)


def _section(title):
    bar = "=" * 78
    print(f"\n{bar}\n  {title}\n{bar}")


def _sub(title):
    bar = "-" * 60
    print(f"\n{bar}\n  >>> {title}\n{bar}")


def wait_for_service(timeout: int = 15):
    print(f"等待服务 {BASE}/health 就绪（最多 {timeout}s）...")
    for _ in range(timeout * 2):
        try:
            r = _req("GET", "/health")
            if r["status"] == 200:
                print("  ✓ 服务已就绪")
                return
        except Exception:
            pass
        time.sleep(0.5)
    print("  ✗ 等待服务超时")
    sys.exit(1)


def main():
    wait_for_service()

    _section("工厂管线异常归因 —— 接口级端到端验证（安全员老唐接班路径）")

    # ---------- 1. 备件清单 ----------
    _sub("Step 1. 查看预置备件清单")
    r = _req("GET", "/parts")
    assert r["status"] == 200
    parts = r["json"]["items"]
    print(f"  共 {len(parts)} 条备件")
    for p in parts:
        print(f"    - {p['part_no']} | {p['part_name']} | 实际={p['part_model']} | 期望={p['expected_model']} | {p['status']}")
    part_map = {p["part_no"]: p for p in parts}
    assert "SP-API-0001" in part_map and part_map["SP-API-0001"]["status"] == "正常"
    assert "SP-API-0002" in part_map and part_map["SP-API-0002"]["part_model"] != part_map["SP-API-0002"]["expected_model"]
    print("  ✓ 备件清单：含一条正常记录 + 一条型号替换（异常分支样本）")

    # ---------- 2. 报警 ----------
    _sub("Step 2. 查看预置报警")
    r = _req("GET", "/alarms")
    assert r["status"] == 200
    alarms = r["json"]["items"]
    print(f"  共 {len(alarms)} 条报警")
    for a in alarms:
        print(f"    - {a['alarm_no']} | {a['alarm_type']} | {a['alarm_desc'][:30]} | 备件={a['related_part_no']}")
    alarm_map = {a["related_part_no"]: a for a in alarms if a["related_part_no"]}

    # ---------- 3. 人工备注 ----------
    _sub("Step 3. 查看预置人工备注（重启后应仍存在）")
    r = _req("GET", "/notes")
    assert r["status"] == 200
    notes = r["json"]["items"]
    print(f"  共 {len(notes)} 条备注")
    for n in notes:
        print(f"    - {n['note_no']} | 管线={n['pipeline_id']} | 人={n['operator']} | {n['content'][:36]}")
    # 找一条"关联不匹配"备注用于异常分支
    note_mismatch = next((n for n in notes if n["pipeline_id"] == "PL-A99"), None)
    note_normal = next((n for n in notes if n["pipeline_id"] == "PL-A01"), None)
    note_replace = next((n for n in notes if n["pipeline_id"] == "PL-A02"), None)
    assert note_normal and note_replace and note_mismatch
    print("  ✓ 人工备注已落库，历史记录存在")

    # ---------- 4. 归因主流程 ----------
    _sub("Step 4. 跑归因主流程（正常分支）—— SP-API-0001 + 对应报警 + 对应备注")
    r = _req("POST", "/attributions/run", {
        "part_no": "SP-API-0001",
        "operator": "老唐",
        "alarm_no": alarm_map["SP-API-0001"]["alarm_no"],
        "note_no": note_normal["note_no"],
        "attribution_reason": "工艺调整引起，设备与备件均正常",
    })
    assert r["status"] == 200, r
    attr_normal = r["json"]
    print(f"  attr_no={attr_normal['attr_no']} status={attr_normal['status']} status_for_export={attr_normal['status_for_export']}")
    assert attr_normal["status"] == "正常", f"正常分支应该出『正常』，实际={attr_normal['status']}"
    assert attr_normal["status_for_export"] == "正常"
    assert attr_normal["is_model_replace"] is False
    print("  ✓ 正常分支：状态=正常，接口字段 status_for_export 与 status 一致")

    _sub("Step 5. 跑归因主流程（型号替换分支）—— SP-API-0002")
    r = _req("POST", "/attributions/run", {
        "part_no": "SP-API-0002",
        "operator": "老唐",
        "alarm_no": alarm_map["SP-API-0002"]["alarm_no"],
        "note_no": note_replace["note_no"],
    })
    assert r["status"] == 200, r
    attr_replace = r["json"]
    print(f"  attr_no={attr_replace['attr_no']} status={attr_replace['status']}")
    print(f"  pending_reason={attr_replace['pending_reason']}")
    print(f"  affected_records={attr_replace['affected_records']}")
    assert attr_replace["status"] == "待确认", f"型号替换不能直接归为正常，实际={attr_replace['status']}"
    assert attr_replace["status_for_export"] == "待确认"
    assert attr_replace["is_model_replace"] is True
    assert attr_replace["pending_reason"] and "期望" in attr_replace["pending_reason"]
    assert attr_replace["affected_records"] and "SP-API-0002" in attr_replace["affected_records"]
    print("  ✓ 型号替换：状态=待确认（未被归为正常），待确认理由与受影响记录单独列出")

    _sub("Step 6. 跑归因主流程（关联不匹配分支）—— SP-API-0003 + 管线号写错的备注")
    r = _req("POST", "/attributions/run", {
        "part_no": "SP-API-0003",
        "operator": "老唐",
        "alarm_no": alarm_map["SP-API-0003"]["alarm_no"],
        "note_no": note_mismatch["note_no"],
    })
    assert r["status"] == 200, r
    attr_mismatch = r["json"]
    print(f"  attr_no={attr_mismatch['attr_no']} status={attr_mismatch['status']}")
    print(f"  pending_reason={attr_mismatch['pending_reason']}")
    assert attr_mismatch["status"] == "待确认"
    assert "不符" in attr_mismatch["pending_reason"]
    print("  ✓ 报警/备注对不上：关系被留在 pending_reason 里，状态=待确认")

    # ---------- 6. 型号替换待确认清单 ----------
    _sub("Step 7. 调 /attributions/model-replace-pending：单列型号替换待确认")
    r = _req("GET", "/attributions/model-replace-pending")
    assert r["status"] == 200
    pending_replace = r["json"]["items"]
    print(f"  共 {len(pending_replace)} 条")
    for x in pending_replace:
        print(f"    - {x['attr_no']} | {x['part_no']} | 待确认：{x['pending_reason']} | 受影响：{x['affected_records']}")
    nos = {x["attr_no"] for x in pending_replace}
    assert attr_replace["attr_no"] in nos
    print("  ✓ 型号替换待确认单独列出，理由和受影响记录都有")

    # ---------- 7. 月底复核分流 ----------
    _sub("Step 8. 月底复核：把 3 条归因分流到 已确认 / 待补件 / 退回")
    r = _req("POST", "/attributions/confirm", {
        "attr_no": attr_normal["attr_no"],
        "operator": "老唐",
        "final_status": "已确认",
        "confirm_reason": "月底复核：工艺调整确认无误，归档为已确认",
    })
    assert r["status"] == 200
    assert r["json"]["status"] == "已确认"
    assert r["json"]["status_for_export"] == "已确认"
    print(f"  {attr_normal['attr_no']} → 已确认")

    r = _req("POST", "/attributions/confirm", {
        "attr_no": attr_replace["attr_no"],
        "operator": "老唐",
        "final_status": "待补件",
        "confirm_reason": "月底复核：替换型号满足功能，但原厂型号缺货待补",
    })
    assert r["status"] == 200
    assert r["json"]["status"] == "待补件"
    assert r["json"]["status_for_export"] == "待补件"
    print(f"  {attr_replace['attr_no']} → 待补件")

    r = _req("POST", "/attributions/confirm", {
        "attr_no": attr_mismatch["attr_no"],
        "operator": "老唐",
        "final_status": "退回",
        "confirm_reason": "月底复核：备注管线号填写错误+备件缺失，退回现场重新核查补录",
    })
    assert r["status"] == 200
    assert r["json"]["status"] == "退回"
    assert r["json"]["status_for_export"] == "退回"
    print(f"  {attr_mismatch['attr_no']} → 退回")
    print("  ✓ 月底分流完成，每条的 status / status_for_export 都一致")

    # ---------- 8. 查明细 ----------
    _sub("Step 9. 查归因明细 /attributions/details")
    r = _req("GET", "/attributions/details")
    assert r["status"] == 200
    details = r["json"]["items"]
    print(f"  共 {len(details)} 条明细")
    for d in details:
        print(f"    - {d['attr_no']} | status={d['status']} | status_for_export={d['status_for_export']} | {d['attribution_reason'][:32]}")
    assert len(details) >= 3
    detail_map = {d["attr_no"]: d for d in details}
    assert detail_map[attr_normal["attr_no"]]["status"] == "已确认"
    assert detail_map[attr_replace["attr_no"]]["status"] == "待补件"
    assert detail_map[attr_mismatch["attr_no"]]["status"] == "退回"
    print("  ✓ 明细状态正确")

    # ---------- 9. 导出异常队列，和明细做一致性断言 ----------
    _sub("Step 10. 导出异常队列 /attributions/queue-export，和明细对比状态")
    r = _req("GET", "/attributions/queue-export")
    assert r["status"] == 200
    queue = r["json"]["items"]
    print(f"  共 {len(queue)} 条导出")
    queue_map = {q["归因编号"]: q for q in queue}
    for d in details:
        q = queue_map.get(d["attr_no"])
        assert q is not None, f"明细 {d['attr_no']} 在导出队列里不存在"
        assert q["状态"] == d["status_for_export"], (
            f"{d['attr_no']}: 队列状态={q['状态']} vs 明细 status_for_export={d['status_for_export']}"
        )
        print(f"    ✓ {d['attr_no']}  队列状态={q['状态']}  ==  明细 status_for_export={d['status_for_export']}")
    print("  ✓ 运营主管从接口查明细 ↔ 导出异常队列 状态完全一致")

    # ---------- 10. 月底复核分组 ----------
    _sub("Step 11. 月底复核分组 /attributions/monthly-review")
    r = _req("GET", "/attributions/monthly-review")
    assert r["status"] == 200
    review = r["json"]
    for grp in ["已确认", "待补件", "退回"]:
        cnt = review.get(grp, {}).get("count", 0)
        print(f"  【{grp}】：{cnt} 条")
        for x in review.get(grp, {}).get("items", []):
            print(f"    - {x['attr_no']} | {x['attribution_reason'][:40]}")
    assert review.get("已确认", {}).get("count", 0) >= 1
    assert review.get("待补件", {}).get("count", 0) >= 1
    assert review.get("退回", {}).get("count", 0) >= 1
    print("  ✓ 月底复核：已确认 / 待补件 / 退回 三类清晰分离")

    # ---------- 11. 一致性校验接口 ----------
    _sub("Step 12. /consistency：自动校验状态+持久化一致性")
    r = _req("GET", "/consistency")
    assert r["status"] == 200
    j = r["json"]
    print(f"  状态一致性：ok={j['status_consistency']['ok']}  errors={j['status_consistency']['errors']}")
    print(f"  持久化一致性：ok={j['persistence_consistency']['ok']}  errors={j['persistence_consistency']['errors']}")
    print(f"  映射表={j['status_consistency']['mapping_table']}")
    assert j["status_consistency"]["ok"] is True
    assert j["persistence_consistency"]["ok"] is True
    print("  ✓ 一致性校验通过")

    # ---------- 12. 接班流程叙事 ----------
    _section("Step 13. 老唐按接班流程给老李讲一遍（从备件追到异常队列）")
    for d in details:
        q = queue_map[d["attr_no"]]
        print(f"""
  老唐讲 {d['attr_no']}：
    · 管线 {d['pipeline_id']}  最终状态 {d['status']}（异常队列导出={q['状态']}）
    · 备件 {d['part_no']} {d['part_name']}  实际型号 {d['part_model']} / 期望 {d['expected_model']}
    · 报警 {d['alarm_no']} {d['alarm_type']}：{d['alarm_desc'][:30]}
    · 备注 {d['note_no']} 由 [{d['note_operator']}] 记录：{d['note_content'][:36]}
    · 归因：{d['attribution_reason']}""")
        if d["pending_reason"]:
            print(f"    · 待确认理由：{d['pending_reason']}  受影响：{d['affected_records']}")
    print("\n  ✓ 老唐从备件清单追到异常队列，每条都能讲清结果")

    _section("接口级全流程验证全部通过 ✅")
    print("下一步（验收重启持久化）：停掉 uvicorn → 再启动 → 再跑一次本脚本，")
    print("            或直接打开 /notes、/attributions/monthly-review 观察数据仍在。")


if __name__ == "__main__":
    main()
