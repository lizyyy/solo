import os
import sys
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory, render_template
from flask_cors import CORS

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from models import DataStore, GrayBatch, GrayRecord, AnnotationMessage
from core import AlertProcessor
from exporter import ExportManager
from demo import DemoDataLoader

app = Flask(__name__,
            template_folder=os.path.join(os.path.dirname(__file__), 'templates'),
            static_folder=os.path.join(os.path.dirname(__file__), 'static'))
CORS(app)

store = DataStore()
processor = AlertProcessor()
exporter = ExportManager()


def result_to_dict(r):
    return {
        "result_id": r.result_id,
        "batch_id": r.batch_id,
        "session_id": r.session_id,
        "knowledge_id": r.knowledge_id,
        "original_question": r.original_question,
        "current_answer": r.current_answer,
        "annotation_remark": r.annotation_remark,
        "on_site_statement": r.on_site_statement,
        "alert_status": r.alert_status.value,
        "desensitization_status": r.desensitization_status.value,
        "evidence_source": r.evidence_source.value,
        "processed_by": r.processed_by,
        "processed_at": r.processed_at,
        "version": r.version,
        "history": r.history,
        "raw_phone_found": r.raw_phone_found,
        "created_at": r.created_at
    }


@app.route('/')
def index():
    return render_template('dashboard.html')


@app.route('/api/health')
def health():
    return jsonify({"status": "ok", "time": datetime.now().isoformat()})


@app.route('/api/demo/load', methods=['POST'])
def load_demo():
    loader = DemoDataLoader()
    batch_id = loader.load_full_demo()
    return jsonify({"status": "ok", "batch_id": batch_id})


@app.route('/api/batches', methods=['GET'])
def list_batches():
    batches = store.get_all_batches()
    data = []
    for b in batches:
        data.append({
            "batch_id": b.batch_id,
            "name": b.name,
            "record_count": len(b.records),
            "processed": b.processed,
            "created_by": b.created_by,
            "created_at": b.created_at
        })
    return jsonify(data)


@app.route('/api/batches', methods=['POST'])
def create_batch():
    data = request.json
    batch = GrayBatch(
        batch_id=data.get('batch_id', f'GRAY_{datetime.now().strftime("%Y%m%d_%H%M%S")}'),
        name=data.get('name', '未命名批次'),
        created_by=data.get('created_by', 'api')
    )
    for rec in data.get('records', []):
        batch.add_record(GrayRecord(
            session_id=rec['session_id'],
            knowledge_id=rec['knowledge_id'],
            original_question=rec['original_question'],
            current_answer=rec['current_answer'],
            raw_text=rec.get('raw_text', '')
        ))
    store.save_batch(batch)
    return jsonify({"status": "ok", "batch_id": batch.batch_id})


@app.route('/api/batches/<batch_id>/process', methods=['POST'])
def process_batch(batch_id):
    operator = request.json.get('operator', 'api') if request.json else 'api'
    batch = store.get_batch(batch_id)
    if not batch:
        return jsonify({"error": "批次不存在"}), 404
    results = processor.process_batch(batch, operator=operator)
    return jsonify({"status": "ok", "count": len(results), "results": [result_to_dict(r) for r in results]})


@app.route('/api/batches/<batch_id>/rerun', methods=['POST'])
def rerun_batch(batch_id):
    operator = request.json.get('operator', 'api') if request.json else 'api'
    try:
        results = processor.rerun_batch(batch_id, operator=operator)
        return jsonify({"status": "ok", "count": len(results), "results": [result_to_dict(r) for r in results]})
    except ValueError as e:
        return jsonify({"error": str(e)}), 404


@app.route('/api/results', methods=['GET'])
def list_results():
    batch_id = request.args.get('batch_id')
    if batch_id:
        results = store.get_results_by_batch(batch_id)
    else:
        results = store.get_all_results()
    return jsonify([result_to_dict(r) for r in results])


@app.route('/api/results/<result_id>', methods=['GET'])
def get_result(result_id):
    r = store.get_result(result_id)
    if not r:
        return jsonify({"error": "结果不存在"}), 404
    return jsonify(result_to_dict(r))


@app.route('/api/results/<result_id>/apply-annotation', methods=['POST'])
def apply_annotation(result_id):
    data = request.json
    annotation = AnnotationMessage(
        annotation_id=data.get('annotation_id', f'ANN_{datetime.now().strftime("%Y%m%d%H%M%S")}'),
        session_id=data['session_id'],
        knowledge_id=data['knowledge_id'],
        annotator=data.get('annotator', 'unknown'),
        on_site_statement=data['on_site_statement'],
        old_answer=data.get('old_answer'),
        remark=data.get('remark', '')
    )
    operator = data.get('operator', 'api')
    try:
        result = processor.apply_annotation(result_id, annotation, operator)
        return jsonify({"status": "ok", "result": result_to_dict(result)})
    except ValueError as e:
        return jsonify({"error": str(e)}), 404


@app.route('/api/results/<result_id>/fix-masking', methods=['POST'])
def fix_masking(result_id):
    data = request.json
    operator = data.get('operator', 'api')
    masked_answer = data['masked_answer']
    try:
        result = processor.fix_masking(result_id, masked_answer, operator)
        return jsonify({"status": "ok", "result": result_to_dict(result)})
    except ValueError as e:
        return jsonify({"error": str(e)}), 404


@app.route('/api/results/<result_id>/update-knowledge', methods=['POST'])
def update_knowledge(result_id):
    data = request.json
    operator = data.get('operator', 'api')
    new_answer = data['new_answer']
    try:
        result = processor.update_knowledge(result_id, new_answer, operator)
        return jsonify({"status": "ok", "result": result_to_dict(result)})
    except ValueError as e:
        return jsonify({"error": str(e)}), 404


@app.route('/api/results/<result_id>/rework', methods=['POST'])
def rework_result(result_id):
    data = request.json
    operator = data.get('operator', 'api')
    new_answer = data['new_answer']
    annotation = AnnotationMessage(
        annotation_id=data.get('annotation_id', f'ANN_{datetime.now().strftime("%Y%m%d%H%M%S")}'),
        session_id=data['session_id'],
        knowledge_id=data['knowledge_id'],
        annotator=data.get('annotator', 'unknown'),
        on_site_statement=data['on_site_statement'],
        old_answer=data.get('old_answer'),
        remark=data.get('remark', '')
    )
    try:
        result = processor.rework_record(result_id, new_answer, annotation, operator)
        return jsonify({"status": "ok", "result": result_to_dict(result)})
    except ValueError as e:
        return jsonify({"error": str(e)}), 404


@app.route('/api/annotations', methods=['GET'])
def list_annotations():
    anns = store.get_all_annotations()
    data = []
    for a in anns:
        data.append({
            "annotation_id": a.annotation_id,
            "session_id": a.session_id,
            "knowledge_id": a.knowledge_id,
            "annotator": a.annotator,
            "on_site_statement": a.on_site_statement,
            "old_answer": a.old_answer,
            "remark": a.remark,
            "created_at": a.created_at,
            "reviewed_by": a.reviewed_by,
            "reviewed_at": a.reviewed_at
        })
    return jsonify(data)


@app.route('/api/export', methods=['GET'])
def export_results():
    batch_id = request.args.get('batch_id')
    if batch_id:
        results = store.get_results_by_batch(batch_id)
    else:
        results = store.get_all_results()
    path = exporter.export_results_to_excel(results, batch_id=batch_id or "")
    filename = os.path.basename(path)
    return send_from_directory(os.path.dirname(path), filename, as_attachment=True)


@app.route('/api/stats', methods=['GET'])
def get_stats():
    results = store.get_all_results()
    alert_counts = {}
    desens_counts = {}
    source_counts = {}
    for r in results:
        a = r.alert_status.value
        d = r.desensitization_status.value
        s = r.evidence_source.value
        alert_counts[a] = alert_counts.get(a, 0) + 1
        desens_counts[d] = desens_counts.get(d, 0) + 1
        source_counts[s] = source_counts.get(s, 0) + 1
    return jsonify({
        "total": len(results),
        "alert_status": alert_counts,
        "desensitization_status": desens_counts,
        "evidence_source": source_counts
    })


if __name__ == '__main__':
    print("🚀 客服知识片段过期预警系统启动中...")
    print("📊 小看板地址: http://localhost:5001")
    print("🔧 API 文档:   http://localhost:5001/api/health")
    app.run(host='0.0.0.0', port=5001, debug=True)
