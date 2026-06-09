from flask import Flask, render_template, request, jsonify, send_file, abort
from dataclasses import asdict
from datetime import datetime
import io
import sys
import os

sys.path.insert(0, '.')

from config import Config
from storage import DataStore
from core import (
    DuplicateDetector, WeightUpdater, asdict_safe,
    StudentAnswer, WeightTable,
)

app = Flask(__name__)
app.config.from_object(Config)


def get_store():
    return DataStore()


def build_summary(store: DataStore):
    answers = store.get_all_answers()
    weights = store.get_all_weights()
    errors = store.get_all_error_logs()
    boundary = store.get_boundary_alerts()
    duplicates = store.get_duplicates_pending()
    status_counts = {}
    for a in answers:
        status_counts[a.status] = status_counts.get(a.status, 0) + 1
    rerun_total = sum(1 for a in answers if a.rerun_count > 0)
    revision_total = sum(len(a.revision_history or []) for a in answers)
    return {
        "total_answers": len(answers),
        "total_weights": len(weights),
        "total_errors": len(errors),
        "boundary_alerts": len(boundary),
        "duplicates_pending": len(duplicates),
        "rerun_done": rerun_total,
        "revision_total": revision_total,
        "status_counts": status_counts,
    }


def enrich_answer(a, store: DataStore):
    d = asdict_safe(a)
    d["status_label"] = Config.STATUS_TYPES.get(a.status, a.status)
    d["status_color"] = Config.STATUS_COLORS.get(a.status, "#666")
    d["error_logs"] = [asdict_safe(e) for e in store.get_error_logs_by_answer(a.id)]
    d["same_group"] = [
        {
            "id": o.id,
            "version": o.version,
            "score": o.score,
            "submitted_at": o.submitted_at,
            "status_label": Config.STATUS_TYPES.get(o.status, o.status),
        }
        for o in store.get_answers_by_student_question(a.student_id, a.question_id)
    ]
    if a.boundary_notes:
        for b in a.boundary_notes:
            b["type_label"] = Config.BOUNDARY_TYPES.get(b.get("boundary_type", ""), b.get("boundary_type", ""))
    return d


@app.route('/')
def index():
    store = get_store()
    answers = store.get_all_answers()
    weights = store.get_all_weights()
    errors = store.get_all_error_logs()
    summary = build_summary(store)
    enriched = [enrich_answer(a, store) for a in answers]
    enriched_weights = [asdict_safe(w) for w in weights]
    enriched_errors = [asdict_safe(e) for e in errors]
    return render_template(
        'index.html',
        answers=enriched,
        weights=enriched_weights,
        errors=enriched_errors,
        summary=summary,
        status_types=Config.STATUS_TYPES,
        status_colors=Config.STATUS_COLORS,
        boundary_types=Config.BOUNDARY_TYPES,
        now=datetime.now().isoformat(),
    )


@app.route('/detail/<answer_id>')
def detail_page(answer_id):
    store = get_store()
    a = store.get_answer_by_id(answer_id)
    if not a:
        abort(404)
    summary = build_summary(store)
    enriched = enrich_answer(a, store)
    return render_template(
        'detail.html',
        answer=enriched,
        summary=summary,
        status_types=Config.STATUS_TYPES,
        status_colors=Config.STATUS_COLORS,
        boundary_types=Config.BOUNDARY_TYPES,
    )


# ==================== API ====================
@app.route('/api/summary')
def api_summary():
    store = get_store()
    return jsonify(build_summary(store))


@app.route('/api/answers', methods=['GET'])
def api_get_answers():
    store = get_store()
    enriched = [enrich_answer(a, store) for a in store.get_all_answers()]
    return jsonify(enriched)


@app.route('/api/answers/<answer_id>', methods=['GET'])
def api_get_answer(answer_id):
    store = get_store()
    a = store.get_answer_by_id(answer_id)
    if not a:
        return jsonify({"error": "not found"}), 404
    return jsonify(enrich_answer(a, store))


@app.route('/api/answers', methods=['POST'])
def api_import_answers():
    data = request.json
    store = get_store()
    new_answers = []
    batch = data.get('batch', f"BATCH_{datetime.now().strftime('%Y%m%d%H%M%S')}")
    for item in data.get('answers', []):
        answer = StudentAnswer(**item)
        answer.import_batch = batch
        new_answers.append(answer)
    store._answers.extend(new_answers)
    all_answers = store.get_all_answers()
    all_answers = DuplicateDetector.mark_duplicates(all_answers)
    store._save_all()
    return jsonify({
        'status': 'success',
        'imported': len(new_answers),
        'duplicates_found': len([a for a in new_answers if a.status == 'DUPLICATE_PENDING']),
        'boundary_found': len([a for a in new_answers if a.boundary_notes]),
    })


@app.route('/api/weights', methods=['GET'])
def api_get_weights():
    store = get_store()
    weights = store.get_all_weights()
    return jsonify([asdict_safe(w) for w in weights])


@app.route('/api/weights', methods=['POST'])
def api_import_weights():
    data = request.json
    store = get_store()
    new_weights = []
    for item in data.get('weights', []):
        weight = WeightTable(**item)
        new_weights.append(weight)
    store._weights.extend(new_weights)
    store._save_all()
    return jsonify({'status': 'success', 'imported': len(new_weights)})


@app.route('/api/apply-weights', methods=['POST'])
def api_apply_weights():
    store = get_store()
    operator = request.json.get('operator', '运营规划阿岚') if request.is_json else '运营规划阿岚'
    weights = store.get_all_weights()
    answers = [a for a in store.get_all_answers() if a.status in ("NORMAL", "BOUNDARY_ALERT")]
    error_logs = WeightUpdater.apply_old_standard_update(answers, weights, rerun=False, operator=operator)
    store.add_error_logs(error_logs)
    store._save_all()
    return jsonify({'status': 'success', 'errors_generated': len(error_logs)})


@app.route('/api/rerun', methods=['POST'])
def api_rerun():
    store = get_store()
    payload = request.get_json(silent=True) or {}
    result = store.rerun_weight_application(
        operator=payload.get('operator', '运营规划阿岚'),
        comment=payload.get('comment', ''),
    )
    return jsonify(result)


@app.route('/api/review/<answer_id>', methods=['POST'])
def api_review(answer_id):
    data = request.get_json(silent=True) or {}
    store = get_store()
    result = store.review_duplicate(
        answer_id=answer_id,
        reviewer=data.get('reviewer', '业务运营'),
        keep=bool(data.get('keep', True)),
        reviewed_score=data.get('reviewed_score'),
        review_opinion=data.get('review_opinion', ''),
        correction_reason=data.get('correction_reason', ''),
        next_step=data.get('next_step', ''),
        next_contact=data.get('next_contact', ''),
        corrected_value=data.get('corrected_value', ''),
    )
    return jsonify(result)


@app.route('/api/correct/<answer_id>', methods=['POST'])
def api_correct(answer_id):
    data = request.get_json(silent=True) or {}
    store = get_store()
    a = store.get_answer_by_id(answer_id)
    if not a:
        return jsonify({"success": False, "message": "not found"}), 404
    old_value = getattr(a, data['field_name'], None)
    ok = store.manual_correct_answer(
        answer_id=answer_id,
        operator=data.get('operator', '运营规划阿岚'),
        field_name=data.get('field_name'),
        old_value=str(old_value),
        new_value=data.get('new_value'),
        reason=data.get('reason', ''),
        next_step=data.get('next_step', ''),
        next_contact=data.get('next_contact', ''),
    )
    return jsonify({"success": ok, "message": "done" if ok else "failed"})


@app.route('/api/errors', methods=['GET'])
def api_get_errors():
    store = get_store()
    errors = store.get_all_error_logs()
    return jsonify([asdict_safe(e) for e in errors])


@app.route('/api/export', methods=['GET', 'POST'])
def api_export():
    store = get_store()
    path = store.export_report()
    filename = os.path.basename(path)
    return send_file(path, as_attachment=True, download_name=filename,
                     mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')


@app.route('/api/run-demo', methods=['POST'])
def api_run_demo():
    import os
    demo_answers = "./data/demo_answers.xlsx"
    demo_weights = "./data/demo_weights.xlsx"
    if not os.path.exists(demo_answers):
        return jsonify({"success": False, "message": "先初始化演示数据"})
    store = DataStore()
    store.clear_all()
    batch = f"BATCH_{datetime.now().strftime('%Y%m%d%H%M%S')}"
    store.import_answers_from_excel(demo_answers, batch)
    all_answers = store.get_all_answers()
    DuplicateDetector.mark_duplicates(all_answers)
    store._save_all()
    weights = store.import_weights_from_excel(demo_weights)
    normals = [a for a in store.get_all_answers() if a.status == "NORMAL" or a.status == "BOUNDARY_ALERT"]
    errors = WeightUpdater.apply_old_standard_update(normals, weights, rerun=False, operator='运营规划阿岚')
    store.add_error_logs(errors)
    pending = store.get_duplicates_pending()
    reviewed_ids = []
    for idx, dup in enumerate(pending, 1):
        keep = idx == 2
        r = store.review_duplicate(
            answer_id=dup.id, reviewer="业务运营小张", keep=keep,
            reviewed_score=90.0 if keep else None,
            review_opinion="比对两版内容，第二版补充了关键论述更完整" if keep else "作为历史参考存档",
            correction_reason="系统检测到同一学生重复提交两版，人工比对后选更完整版" if keep else "冗余版本归档",
            next_step="记录复核结论并同步给学生" if keep else "无需后续",
            next_contact="业务运营小张",
            corrected_value=f"{'确认保留' if keep else '标记不保留'}第{dup.version}版",
        )
        if r.get("success"):
            reviewed_ids.append(dup.id)
    for ba in store.get_boundary_alerts():
        if ba.score == 100.0:
            store.manual_correct_answer(
                answer_id=ba.id, operator="运营规划阿岚",
                field_name="notes", old_value=str(ba.notes or ""),
                new_value=f"{ba.notes} 【运营规划阿岚人工修正】满分答案确认为真实高分，内容虽短但要点全部覆盖，给分合理，解除给分溢出嫌疑。",
                reason="人工复核确认满分合理，补充备注说明解除边界值疑虑",
                next_step="归档记录，如学生申诉可提供此备注作为依据",
                next_contact="运营规划阿岚",
            )
    rr = store.rerun_weight_application(operator="运营规划阿岚", comment="补录权重表后统一重跑")
    report_path = store.export_report()
    return jsonify({
        "success": True,
        "answers": len(store.get_all_answers()),
        "errors": len(store.get_all_error_logs()),
        "reviewed": reviewed_ids,
        "rerun": rr,
        "report": report_path,
    })


if __name__ == '__main__':
    Config.ensure_data_dir()
    app.run(host=Config.HOST, port=Config.PORT, debug=Config.DEBUG)
