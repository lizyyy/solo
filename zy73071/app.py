"""
配电柜温升阈值预警 - Flask API 服务
启动方式：
    pip install flask
    python app.py            # 默认端口 5099
    CABINET_WARNING_DB=/path/x.db python app.py
"""
import os
import re
from datetime import datetime
from flask import Flask, request, jsonify

from cabinet_warning_system import (
    WarningAppService, canonical_name,
)
from persistence import SqliteWarningRepository, init_db


app = Flask(__name__)
app.config["JSON_AS_ASCII"] = False

SERVICE: WarningAppService = None  # type: ignore


def _get_service() -> WarningAppService:
    global SERVICE
    if SERVICE is None:
        init_db()
        SERVICE = WarningAppService(repo=SqliteWarningRepository())
    return SERVICE


def _extract_date(fallback_required: bool = True) -> str:
    """从请求字段 submit_date 或 sensor_logs/材料标题里提取日期，都没有则用今日"""
    body = request.get_json(silent=True) or {}
    if body.get("submit_date"):
        return str(body["submit_date"])
    # 尝试从材料里扫
    date_pat = re.compile(r"(20\d{2}[-_./]\d{1,2}[-_./]\d{1,2})")
    for m in body.get("materials", []) or []:
        for val in (m.get("title", ""), m.get("detail", "")):
            hit = date_pat.search(val)
            if hit:
                return hit.group(1).replace("_", "-").replace("/", "-").replace(".", "-")
    if fallback_required:
        return datetime.now().strftime("%Y-%m-%d")
    return datetime.now().strftime("%Y-%m-%d")


# ============================================================
# 接口 1：POST /api/warning/import   材料导入（自动去重合并）
# ============================================================
@app.route("/api/warning/import", methods=["POST"])
def api_import():
    body = request.get_json(silent=True) or {}

    object_name = (body.get("object_name") or body.get("cabinet_name")
                   or body.get("target") or "").strip()
    if not object_name:
        return jsonify({"error": "缺少对象名称 object_name"}), 400

    submit_date = _extract_date()
    materials = body.get("materials") or []
    if not materials:
        return jsonify({"error": "至少需要一条材料 materials"}), 400

    initial_conclusion = body.get("initial_conclusion", "pending")
    operator = body.get("operator", "api_client")

    result = _get_service().import_warning(
        object_name=object_name,
        submit_date=submit_date,
        materials=materials,
        initial_conclusion=initial_conclusion,
        operator=operator,
    )
    # 负责人视图同屏返回，调用方无需二次请求
    manager_hint = _get_service().query_for_manager(result["record_id"])
    result["manager_view"] = manager_hint["records"][0] if manager_hint["records"] else None
    return jsonify(result), 200 if result.get("action") else 500


# ============================================================
# 接口 2：POST /api/warning/supplement   补录说明 + 可选改判
# ============================================================
@app.route("/api/warning/supplement", methods=["POST"])
def api_supplement():
    body = request.get_json(silent=True) or {}

    record_id = (body.get("record_id") or "").strip()
    if not record_id:
        return jsonify({"error": "缺少 record_id"}), 400

    materials = body.get("materials") or []
    new_conclusion = body.get("new_conclusion")
    change_reason = body.get("change_reason", "")
    operator = body.get("operator", "安全员")

    result = _get_service().supplement_material(
        record_id=record_id,
        materials=materials,
        new_conclusion=new_conclusion,
        change_reason=change_reason,
        operator=operator,
    )
    if "error" in result:
        return jsonify(result), 404
    # 同步给负责人视图
    manager_hint = _get_service().query_for_manager(record_id)
    result["manager_view"] = manager_hint["records"][0] if manager_hint["records"] else None
    return jsonify(result), 200


# ============================================================
# 接口 3：GET /api/warning/manager   负责人汇总视图（全量或按对象过滤）
# ============================================================
@app.route("/api/warning/manager", methods=["GET"])
def api_manager():
    record_id = request.args.get("record_id")
    result = _get_service().query_for_manager(record_id or None)
    # 再加几个验收辅助标记
    for rec in result["records"]:
        flags = rec.get("结论标记", [])
        rec["_验收辅助"] = {
            "补录次数统计": sum(1 for h in rec["历史追溯摘要"] if "补录" in h.get("备注/原因", "")),
            "别名合并次数": sum(1 for h in rec["历史追溯摘要"] if "重复提交合并" in h.get("备注/原因", "")),
            "疑点状态": (
                "仍卡点" if rec["卡点状态"].startswith("⛔") and "已解除" not in rec["卡点状态"]
                else "卡点已解除" if "已解除" in rec["卡点状态"]
                else "无卡点"
            ),
        }
    return jsonify(result), 200


# ============================================================
# 接口 4：GET /api/warning/history/<record_id>   单条历史（旧材料/新备注/原结论/新结论）
# ============================================================
@app.route("/api/warning/history/<record_id>", methods=["GET"])
def api_history(record_id: str):
    repo = _get_service().repo
    record = repo.get(record_id)
    if not record:
        return jsonify({"error": f"记录不存在: {record_id}"}), 404

    mat_map = {m.material_id: {
        "material_type": m.material_type,
        "title": m.title,
        "detail": m.detail,
        "mismatch_flag": m.mismatch_flag,
        "mismatch_detail": m.mismatch_detail,
    } for m in record.materials}

    entries = []
    for h in record.history:
        entries.append({
            "version": h.version,
            "timestamp": h.timestamp,
            "event": h.event,
            "旧结论": h.conclusion_before,
            "新结论": h.conclusion_after,
            "结论是否变化": h.conclusion_before != h.conclusion_after,
            "旧材料ID列表": h.materials_before,
            "新材料ID列表": h.materials_after,
            "新增材料详情": [
                {"material_id": mid, **mat_map[mid]}
                for mid in h.materials_after
                if mid not in h.materials_before and mid in mat_map
            ],
            "改判/操作原因": h.remark,
            "操作人": h.operator,
        })

    return jsonify({
        "record_id": record_id,
        "对象标准名": record.canonical_object,
        "提交名": record.display_name,
        "当前结论": record.conclusion,
        "是否补录过": record.is_supplemented,
        "是否改判过": record.is_judgment_changed,
        "历史总条数": len(entries),
        "历史条目": entries,
    }), 200


# ============================================================
# 接口 5：GET /api/warning/records/<record_id>   完整单条详情
# ============================================================
@app.route("/api/warning/records/<record_id>", methods=["GET"])
def api_detail(record_id: str):
    record = _get_service().repo.get(record_id)
    if not record:
        return jsonify({"error": f"记录不存在: {record_id}"}), 404
    return jsonify(record.to_dict()), 200


# ============================================================
# 接口 6：GET /health
# ============================================================
@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "service": "cabinet-warning-api",
        "db": os.environ.get("CABINET_WARNING_DB", "cabinet_warning.db"),
        "record_count": len(_get_service().repo.all()),
    }), 200


if __name__ == "__main__":
    port = int(os.environ.get("CABINET_WARNING_PORT", "5099"))
    print(f"[cabinet-warning] 启动 API 服务 端口={port}  DB={os.environ.get('CABINET_WARNING_DB', 'cabinet_warning.db')}")
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
