"""API 路由"""
import json

from flask import Blueprint, Response, jsonify, request

from models import (
    Classification,
    RecheckRecord,
    Sample,
    Task,
    db,
)
from services import (
    ClassificationEngine,
    ExportService,
    StatsService,
    TaskService,
)

bp = Blueprint("api", __name__, url_prefix="/api")


# ── 1. 接样：提交送样材料 ──────────────────────────────────

@bp.route("/samples", methods=["POST"])
def ingest_sample():
    """
    接样员提交送样材料。系统自动分类并创建任务。
    Body (JSON):
      - sample_batch, cooperative, product_name, product_type, origin,
        sample_weight, send_date, receiver, testing_items (list|str), remark
    """
    data = request.get_json(force=True, silent=True) or {}
    operator = data.get("operator") or data.get("receiver") or "unknown"

    # 入参校验：仅关键字段不可缺失，其余交由分类引擎判定
    errors = []
    for f in ["sample_batch", "cooperative", "receiver"]:
        if not data.get(f):
            errors.append(f"缺少必填字段: {f}")
    if errors:
        return jsonify({"success": False, "errors": errors}), 400

    # 检测项目统一为 JSON 字符串
    testing_items = data.get("testing_items") or []
    if isinstance(testing_items, list):
        testing_items_json = json.dumps(testing_items, ensure_ascii=False)
    else:
        testing_items_json = str(testing_items)

    sample = Sample(
        sample_batch=data["sample_batch"],
        cooperative=data["cooperative"],
        product_name=data.get("product_name") or "待补充",
        product_type=data.get("product_type"),
        origin=data.get("origin"),
        sample_weight=data.get("sample_weight"),
        send_date=data.get("send_date"),
        receiver=data["receiver"],
        testing_items=testing_items_json,
        remark=data.get("remark"),
    )
    db.session.add(sample)
    db.session.flush()

    # 分类
    classify_input = dict(data)
    classify_input["testing_items"] = testing_items_json
    category, reason, action = ClassificationEngine.classify(classify_input)

    cls_obj = Classification(
        sample_id=sample.id, category=category, reason=reason, action=action
    )
    db.session.add(cls_obj)

    # 创建任务
    try:
        task = TaskService.create_task(sample.id, operator=operator)
        if category == Classification.CATEGORY_BLOCKED:
            TaskService.transition(
                task.id,
                Task.STATUS_MANUAL,
                operator=operator,
                detail="检测到高风险项目，转人工确认",
            )
        elif category == Classification.CATEGORY_SUPPLEMENT:
            TaskService.transition(
                task.id,
                Task.STATUS_MANUAL,
                operator=operator,
                detail="材料待补充，需人工跟进",
            )
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        # 回滚后记录失败状态
        db.session.add(sample)
        db.session.add(cls_obj)
        db.session.flush()
        task = TaskService.create_task(sample.id, operator=operator)
        TaskService.transition(
            task.id,
            Task.STATUS_FAILED,
            operator=operator,
            detail="任务创建失败",
            error_message=str(exc),
        )
        db.session.commit()
        return jsonify({
            "success": False,
            "sample_id": sample.id,
            "task": task.to_dict(),
            "classification": cls_obj.to_dict(),
            "error": str(exc),
        }), 500

    return jsonify({
        "success": True,
        "sample_id": sample.id,
        "task": task.to_dict(),
        "classification": cls_obj.to_dict(),
    }), 201


# ── 2. 查询 ─────────────────────────────────────────────────

@bp.route("/samples", methods=["GET"])
def list_samples():
    """列表查询，支持按分类/任务状态筛选"""
    category = request.args.get("category")
    status = request.args.get("status")
    query = Sample.query
    if category:
        query = query.join(Classification).filter(Classification.category == category)
    if status:
        query = query.join(Task).filter(Task.status == status)
    samples = query.order_by(Sample.created_at.desc()).all()
    return jsonify({
        "samples": [s.to_dict() for s in samples],
        "stats": StatsService.overall(),
    })


@bp.route("/samples/<int:sid>", methods=["GET"])
def get_sample(sid):
    """单条详情（含分类、任务、复检、审计）"""
    detail = StatsService.detail(sid)
    if not detail:
        return jsonify({"success": False, "error": "记录不存在"}), 404
    return jsonify(detail)


@bp.route("/stats", methods=["GET"])
def stats():
    """全局统计"""
    return jsonify(StatsService.overall())


# ── 3. 人工确认 / 修改复检记录 ──────────────────────────────

@bp.route("/tasks/<int:tid>/confirm", methods=["POST"])
def confirm_task(tid):
    """
    人工确认任务（将 manual_confirm 转为 processing 或其他状态）。
    Body: { "new_status": "processing"|"failed"|"exported", "operator": "张三", "detail": "..." }
    """
    data = request.get_json(force=True, silent=True) or {}
    operator = data.get("operator", "unknown")
    new_status = data.get("new_status", Task.STATUS_PROCESSING)
    detail = data.get("detail", "人工确认")

    task = Task.query.get(tid)
    if not task:
        return jsonify({"success": False, "error": "任务不存在"}), 404

    if new_status == Task.STATUS_EXPORTED:
        TaskService.mark_exported(tid, operator=operator)
    else:
        TaskService.transition(tid, new_status, operator=operator, detail=detail)
    db.session.commit()
    return jsonify({"success": True, "task": task.to_dict()})


@bp.route("/samples/<int:sid>/rechecks", methods=["POST"])
def add_recheck(sid):
    """新增或修改复检记录（反复改）"""
    sample = Sample.query.get(sid)
    if not sample:
        return jsonify({"success": False, "error": "记录不存在"}), 404

    data = request.get_json(force=True, silent=True) or {}
    item = data.get("item")
    if not item:
        return jsonify({"success": False, "error": "缺少复检项目 item"}), 400

    rec = RecheckRecord(
        sample_id=sid,
        item=item,
        original_result=data.get("original_result", ""),
        recheck_result=data.get("recheck_result", ""),
        final_result=data.get("final_result", data.get("recheck_result", "")),
        operator=data.get("operator", "unknown"),
    )
    db.session.add(rec)
    db.session.commit()
    return jsonify({"success": True, "recheck": rec.to_dict()}), 201


@bp.route("/rechecks/<int:rid>", methods=["PUT"])
def update_recheck(rid):
    """修改已有复检记录（反复改）"""
    rec = RecheckRecord.query.get(rid)
    if not rec:
        return jsonify({"success": False, "error": "记录不存在"}), 404

    data = request.get_json(force=True, silent=True) or {}
    for field in ["original_result", "recheck_result", "final_result", "operator"]:
        if field in data:
            setattr(rec, field, data[field])
    db.session.commit()
    return jsonify({"success": True, "recheck": rec.to_dict()})


# ── 4. 导出 ─────────────────────────────────────────────────

@bp.route("/export", methods=["GET"])
def export_csv():
    """
    导出 CSV，包含送样批次、合作社、检测项目、复检记录、最后处理人等。
    支持通过 ?sample_ids=1,2,3 筛选。
    """
    ids_param = request.args.get("sample_ids")
    sample_ids = None
    if ids_param:
        sample_ids = [int(x.strip()) for x in ids_param.split(",") if x.strip()]

    rows = ExportService.build_export_rows(sample_ids)
    csv_text = ExportService.to_csv(rows)

    # 将涉及的任务标记为已导出
    for row in rows:
        batch = row.get("送样批次")
        s = Sample.query.filter_by(sample_batch=batch).first()
        if s:
            task = Task.query.filter_by(sample_id=s.id).first()
            if task and task.status != Task.STATUS_EXPORTED:
                TaskService.mark_exported(task.id, operator=request.args.get("operator", "system"))
    db.session.commit()

    return Response(
        csv_text,
        mimetype="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": "attachment; filename=pesticide_residue_export.csv"},
    )


# ── 5. 导出 JSON 预览（用于与查询统计一致性核对） ────────

@bp.route("/export/preview", methods=["GET"])
def export_preview():
    ids_param = request.args.get("sample_ids")
    sample_ids = None
    if ids_param:
        sample_ids = [int(x.strip()) for x in ids_param.split(",") if x.strip()]
    rows = ExportService.build_export_rows(sample_ids)
    return jsonify({"rows": rows, "stats": StatsService.overall()})
