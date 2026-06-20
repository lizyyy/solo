"""diff.py — 人工确认前后差异。

复盘时排班同事最怕"只剩结论"。本模块：
1. 没有确认记录时，按计算结果生成一份待确认模板（status=pending）；
2. 排班同事填好确认记录后，本模块计算"计算值→确认值"的前后差异，
   让"人工确认前后到底改了什么"一目了然。
"""

import json
import os


def load_confirmation(path):
    """读取确认记录；不存在返回 None。"""
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def generate_template(results, out_path):
    """按计算结果生成待确认模板，写入 out_path。"""
    entries = []
    for r in results:
        entries.append({
            "question_id": r["question_id"],
            "version": r["version"],
            "title": r["title"],
            "status": "pending",
            "computed_value": r["result_value"],
            "computed_uncertainty": r["result_uncertainty"],
            "confirmed_value": r["result_value"],
            "confirmed_uncertainty": r["result_uncertainty"],
            "确认说明": "",
        })
    tpl = {
        "说明": "人工确认记录。请排班同事逐条核对：status 填 confirmed(无误)/adjusted(已改)；如改了值，填 confirmed_value/confirmed_uncertainty 与确认说明。留 pending 表示未确认。",
        "确认人": "",
        "确认时间": "",
        "条目": entries,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(tpl, f, ensure_ascii=False, indent=2)
    return tpl


def _key(qid, version):
    return "%s@%s" % (qid, version)


def compute_diff(results, confirmation):
    """计算 计算值 与 确认值 的前后差异，返回 diff 条目列表。"""
    if not confirmation:
        return [], False
    by_key = {}
    for e in confirmation.get("条目", []):
        by_key[_key(e["question_id"], e["version"])] = e
    diffs = []
    any_confirmed = False
    for r in results:
        e = by_key.get(_key(r["question_id"], r["version"]))
        if not e:
            continue
        status = e.get("status", "pending")
        if status == "pending":
            continue
        any_confirmed = True
        before_v = r["result_value"]
        before_u = r["result_uncertainty"]
        after_v = e.get("confirmed_value", before_v)
        after_u = e.get("confirmed_uncertainty", before_u)
        v_delta = _delta(before_v, after_v)
        u_delta = _delta(before_u, after_u)
        diffs.append({
            "question_id": r["question_id"],
            "version": r["version"],
            "title": r["title"],
            "status": status,
            "before_value": before_v,
            "after_value": after_v,
            "value_delta": v_delta,
            "before_uncertainty": before_u,
            "after_uncertainty": after_u,
            "uncertainty_delta": u_delta,
            "确认说明": e.get("确认说明", ""),
            "确认人": confirmation.get("确认人", ""),
            "changed": (v_delta is not None and abs(v_delta) > 1e-12) or
                       (u_delta is not None and abs(u_delta) > 1e-12) or
                       (status == "adjusted"),
        })
    return diffs, any_confirmed


def _delta(before, after):
    if before is None and after is None:
        return 0.0
    if before is None or after is None:
        return None
    return after - before
