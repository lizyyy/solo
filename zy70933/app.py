from flask import Flask, request, jsonify, Response
import json
import os
import csv
import io
from collections import defaultdict
from datetime import datetime, timedelta
from copy import deepcopy

app = Flask(__name__)

STATE_FILE = os.environ.get("STATE_FILE", ".acceptance_state.json")
DATA_DIR = os.environ.get("DATA_DIR", "sample_data")


def load_state():
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {"effective_batches": [], "history": []}
    return {"effective_batches": [], "history": []}


def save_state(state):
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


def parse_csv_text(text):
    reader = csv.DictReader(io.StringIO(text))
    return [dict(row) for row in reader]


def read_payload(key):
    if request.is_json and request.json and key in request.json:
        raw = request.json[key]
        if isinstance(raw, list):
            return raw
        if isinstance(raw, str):
            return raw
    f = request.files.get(key)
    if f:
        return f.read().decode("utf-8")
    path = request.args.get(key) or request.form.get(key)
    if path:
        p = path if os.path.isabs(path) else os.path.join(DATA_DIR, path)
        with open(p, "r", encoding="utf-8") as fh:
            return fh.read()
    return None


def load_inputs():
    csv_text = read_payload("nodes_csv")
    photo_text = read_payload("photos_json")
    rect_text = read_payload("rectifications")

    if csv_text is None or photo_text is None:
        raise ValueError("缺少必要输入：nodes_csv / photos_json")

    raw_nodes = parse_csv_text(csv_text) if isinstance(csv_text, str) else csv_text
    if isinstance(photo_text, str):
        photos = json.loads(photo_text)
    else:
        photos = photo_text

    rectifications = []
    if rect_text is not None:
        if isinstance(rect_text, str):
            rectifications = json.loads(rect_text)
        else:
            rectifications = rect_text

    nodes = _normalize_nodes(raw_nodes)
    return nodes, photos, rectifications


def _normalize_nodes(rows):
    if isinstance(rows, list) and rows and "items" in rows[0]:
        return rows
    grouped = defaultdict(list)
    order = []
    for row in rows:
        batch_id = row.get("batch_id") or row.get("id")
        key = (batch_id, row.get("stage"), row.get("node_id"))
        if key not in grouped:
            order.append(key)
        grouped[key].append(row)
    out = []
    for key in order:
        batch_id, stage, node_id = key
        first = grouped[key][0]
        out.append({
            "batch_id": batch_id,
            "stage": stage,
            "node_id": node_id,
            "node_name": first.get("node_name") or first.get("name"),
            "items": [
                {
                    "item_id": r.get("item_id") or r.get("id"),
                    "name": r.get("item_name") or r.get("item") or r.get("name"),
                    "status": r.get("status"),
                }
                for r in grouped[key]
            ],
        })
    return out


def index_photos(photos):
    idx = defaultdict(list)
    for p in photos:
        idx[(p.get("stage"), p.get("node_id"), p.get("item_id"))].append(p)
    return idx


def index_rectifications(rectifications):
    by_item = defaultdict(list)
    by_batch = defaultdict(list)
    for r in rectifications:
        by_item[(r.get("stage"), r.get("node_id"), r.get("item_id"))].append(r)
        if r.get("rectification_batch_id"):
            by_batch[r["rectification_batch_id"]].append(r)
    return by_item, by_batch


def photo_requirement(stage, item):
    base = {"总览": 1, "关键节点": 2}
    extra = {
        "水电": {"管线排布": 3, "点位标高": 2, "隐蔽工程": 2, "试压记录": 1},
        "泥木": {"基层找平": 2, "墙地砖空鼓": 2, "木作收口": 2},
        "油漆": {"基层打磨": 1, "面漆流平": 2, "阴阳角": 2},
    }
    return extra.get(stage, {}).get(item, 1)


def now_dt():
    return datetime.now()


def parse_dt(s):
    if not s:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%Y/%m/%d", "%Y%m%d"):
        try:
            return datetime.strptime(s, fmt)
        except Exception:
            continue
    return None


def rule_missing_photo(node, item, photos_of_item):
    item_name = item.get("name") or item.get("item")
    required = photo_requirement(node.get("stage"), item_name)
    actual = len(photos_of_item)
    if actual < required:
        return {
            "rule": "缺照片",
            "ok": False,
            "message": f"{node.get('stage')}｜{node.get('node_name')}｜{item_name} 应有 {required} 张照片，实有 {actual} 张",
            "suggestion": "补齐节点照片后重新提交本批次，或附监理书面说明作为例外放行依据",
        }
    return {"rule": "缺照片", "ok": True}


def rule_rework_recheck(node, item, rectifications_of_item):
    failed = [r for r in rectifications_of_item if r.get("result") == "失败" or r.get("status") == "返工"]
    if not failed:
        return {"rule": "返工复验", "ok": True}
    latest = max(failed, key=lambda r: r.get("submitted_at") or "")
    rechecks = [r for r in rectifications_of_item if r.get("rectification_batch_id") == latest.get("rectification_batch_id") and r.get("result") == "通过"]
    if not rechecks:
        return {
            "rule": "返工复验",
            "ok": False,
            "message": f"{node.get('stage')}｜{node.get('node_name')}｜{item.get('name') or item.get('item')} 上次验收失败（批次 {latest.get('rectification_batch_id')}），未找到同批次复验通过记录",
            "suggestion": "对该失败批次发起复验，整改后上传整改单，结果为“通过”方可放行",
        }
    return {"rule": "返工复验", "ok": True}


def rule_overdue_deduction(node, item, rectifications_of_item):
    deduct = []
    for r in rectifications_of_item:
        if r.get("status") != "整改中":
            continue
        deadline = parse_dt(r.get("deadline"))
        submitted = parse_dt(r.get("submitted_at")) or parse_dt(r.get("created_at")) or now_dt()
        if deadline and submitted > deadline:
            days = (submitted - deadline).days
            deduct.append({
                "rectification_batch_id": r.get("rectification_batch_id"),
                "overdue_days": days,
                "message": f"整改单 {r.get('rectification_batch_id')} 截止 {deadline.strftime('%Y-%m-%d')}，实际提交 {submitted.strftime('%Y-%m-%d')}，逾期 {days} 天",
                "suggestion": "按合同约定按日扣款；扣款完成前不得标记为已完工",
            })
    if deduct:
        return {
            "rule": "逾期扣款",
            "ok": False,
            "message": "；".join(d["message"] for d in deduct),
            "suggestion": deduct[0]["suggestion"],
        }
    return {"rule": "逾期扣款", "ok": True}


def evaluate(node, photos_idx, rect_idx):
    items = node.get("items")
    if not items:
        items = [{"name": node.get("node_name"), "status": node.get("status")}]
    normal, pending, failed = [], [], []
    stage = node.get("stage")
    node_id = node.get("node_id") or node.get("id")
    node_name = node.get("node_name") or node.get("name")

    for item in items:
        item_id = item.get("item_id") or item.get("id") or item.get("name")
        key = (stage, node_id, item_id)
        photos_of_item = photos_idx.get(key, [])
        rectifications_of_item = rect_idx.get(key, [])

        checks = [
            rule_missing_photo(node, item, photos_of_item),
            rule_rework_recheck(node, item, rectifications_of_item),
            rule_overdue_deduction(node, item, rectifications_of_item),
        ]
        failed_checks = [c for c in checks if not c["ok"]]
        photo_check = checks[0]
        original_fields = {
            "node": deepcopy(node),
            "item": deepcopy(item),
            "photos": deepcopy(photos_of_item),
            "rectifications": deepcopy(rectifications_of_item),
        }

        if failed_checks:
            bucket = "待确认" if photo_check["ok"] else "失败"
            record = {
                "stage": stage,
                "node_id": node_id,
                "node_name": node_name,
                "item_id": item.get("item_id") or item.get("name"),
                "item_name": item.get("name") or item.get("item"),
                "failed_rules": [c["rule"] for c in failed_checks],
                "details": failed_checks,
                "original": original_fields,
            }
            if bucket == "待确认":
                pending.append(record)
            else:
                failed.append(record)
        else:
            normal.append({
                "stage": stage,
                "node_id": node_id,
                "node_name": node_name,
                "item_id": item.get("item_id") or item.get("name"),
                "item_name": item.get("name") or item.get("item"),
                "photo_count": len(photos_of_item),
                "note": "所有规则通过，准予放行",
            })
    return normal, pending, failed


def dedupe_batches(nodes, effective_batches):
    kept, skipped = [], []
    for n in nodes:
        batch_id = n.get("batch_id")
        material_batch = n.get("material_batch") or n.get("batch_id")
        if batch_id in effective_batches:
            skipped.append({
                "batch_id": batch_id,
                "node": n.get("node_name") or n.get("name"),
                "stage": n.get("stage"),
                "reason": "批次已在历史提交中生效，本次不重复生效",
            })
            continue
        if material_batch and material_batch != batch_id and material_batch in effective_batches:
            skipped.append({
                "batch_id": batch_id,
                "material_batch": material_batch,
                "node": n.get("node_name") or n.get("name"),
                "stage": n.get("stage"),
                "reason": "同材料批次已在历史提交中生效，本次不重复生效",
            })
            continue
        kept.append(n)
    return kept, skipped


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/audit", methods=["POST"])
def audit():
    try:
        nodes, photos, rectifications = load_inputs()
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    state = load_state()
    photos_idx = index_photos(photos)
    rect_idx, _ = index_rectifications(rectifications)

    effective_nodes, skipped = dedupe_batches(nodes, state.get("effective_batches", []))

    normal, pending, failed = [], [], []
    for node in effective_nodes:
        n, p, f = evaluate(node, photos_idx, rect_idx)
        normal.extend(n)
        pending.extend(p)
        failed.extend(f)

    newly_effective = []
    for node in effective_nodes:
        if all(
            item.get("name") in [r["item_name"] for r in normal + pending]
            or item.get("item") in [r["item_name"] for r in normal + pending]
            for item in (node.get("items") or [{}])
        ):
            batch_id = node.get("batch_id")
            if batch_id and batch_id not in state.get("effective_batches", []):
                newly_effective.append(batch_id)

    state.setdefault("effective_batches", []).extend(newly_effective)
    state.setdefault("history", []).append({
        "time": now_dt().isoformat(),
        "batches": newly_effective,
        "normal_count": len(normal),
        "pending_count": len(pending),
        "failed_count": len(failed),
    })
    save_state(state)

    payload = {
        "summary": {
            "正常": len(normal),
            "待确认": len(pending),
            "失败": len(failed),
            "已跳过重复批次": len(skipped),
            "新生效批次": len(newly_effective),
        },
        "正常": normal,
        "待确认": pending,
        "失败": failed,
        "已跳过重复批次": skipped,
        "新生效批次": newly_effective,
    }
    return Response(json.dumps(payload, ensure_ascii=False, indent=2), mimetype="application/json")


@app.route("/state/reset", methods=["POST"])
def reset_state():
    save_state({"effective_batches": [], "history": []})
    return jsonify({"ok": True})


if __name__ == "__main__":
    os.makedirs(DATA_DIR, exist_ok=True)
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5001)), debug=False)
