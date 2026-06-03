import json
import os
from flask import Flask, jsonify, request, render_template
from flask_cors import CORS

from .workflow import GaugeInspectionWorkflow
from .models import PointCloudLog, SafetyRadiusTable, CoordinateIssue, SiteNote
from .coord_detector import CoordinateDetector

template_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "src", "web", "templates")
static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "src", "web", "static")

app = Flask(__name__, template_folder=template_dir, static_folder=static_dir)
CORS(app)

wf = GaugeInspectionWorkflow()

def _serialize(obj):
    if hasattr(obj, '__dict__'):
        return {k: v for k, v in obj.__dict__.items() if not k.startswith('_')}
    return obj

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/workflow/status', methods=['GET'])
def get_workflow_status():
    status = wf.get_workflow_status()
    return jsonify({"success": True, "data": status})

@app.route('/api/workflow/step1', methods=['POST'])
def api_step1():
    data = request.get_json()
    if not data or 'log_no' not in data or 'items' not in data:
        return jsonify({"success": False, "error": "缺少必要参数: log_no, items"}), 400
    
    try:
        log, issues = wf.step1_import_point_cloud_log(
            data['log_no'],
            data['items'],
            data.get('imported_by', 'api')
        )
        
        result = {
            "log": _serialize(log),
            "items": [],
            "issues": []
        }
        for item_data in issues:
            result["issues"].append({
                "issue": _serialize(item_data["issue"]),
                "detection": _serialize(item_data["detection"]),
                "site_note": _serialize(item_data["site_note"])
            })
        return jsonify({"success": True, "data": result})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/workflow/step2', methods=['POST'])
def api_step2():
    data = request.get_json()
    if not data or 'table_no' not in data or 'items' not in data:
        return jsonify({"success": False, "error": "缺少必要参数: table_no, items"}), 400
    
    try:
        table, updated = wf.step2_review_safety_radius_table(
            data['table_no'],
            data['items'],
            data.get('reviewed_by', 'ajing')
        )
        
        result = {
            "table": _serialize(table),
            "updated": []
        }
        for item_data in updated:
            entry = {
                "issue": _serialize(item_data["issue"]),
                "site_note": _serialize(item_data["site_note"])
            }
            if item_data.get("detection"):
                entry["detection"] = _serialize(item_data["detection"])
            if item_data.get("safety_item"):
                entry["safety_item"] = item_data["safety_item"]
            if item_data.get("warning"):
                entry["warning"] = item_data["warning"]
            result["updated"].append(entry)
        return jsonify({"success": True, "data": result})
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/workflow/step3', methods=['POST'])
def api_step3():
    data = request.get_json() or {}
    try:
        finalized = wf.step3_finalize_for_site_team(data.get('inspector', '巡检组'))
        result = []
        for item_data in finalized:
            result.append({
                "issue": _serialize(item_data["issue"]),
                "site_note": _serialize(item_data["site_note"]),
                "action_required": item_data.get("action_required", True),
                "note": item_data.get("note", "")
            })
        return jsonify({"success": True, "data": result})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/issues', methods=['GET'])
def get_issues():
    issue_id = request.args.get('id', type=int)
    if issue_id:
        issue = CoordinateIssue.get_by_id(issue_id)
        if not issue:
            return jsonify({"success": False, "error": "找不到该问题"}), 404
        note = SiteNote.get_by_issue_id(issue_id)
        result = [{
            "issue": _serialize(issue),
            "site_note": _serialize(note) if note else None
        }]
    else:
        data = wf.get_all_issues_with_notes()
        result = []
        for item in data:
            result.append({
                "issue": _serialize(item["issue"]),
                "site_note": _serialize(item["site_note"])
            })
    return jsonify({"success": True, "data": result})

@app.route('/api/detect', methods=['POST'])
def api_detect():
    data = request.get_json()
    if not data or 'x' not in data or 'y' not in data:
        return jsonify({"success": False, "error": "缺少必要参数: x, y"}), 400
    
    result = CoordinateDetector.detect(str(data['x']), str(data['y']), data.get('z'))
    explanation = CoordinateDetector.explain_detection(result)
    
    return jsonify({
        "success": True,
        "data": _serialize(result),
        "explanation": explanation
    })

@app.route('/api/point-cloud-logs', methods=['GET'])
def get_point_cloud_logs():
    logs = PointCloudLog.get_latest()
    if logs:
        return jsonify({"success": True, "data": _serialize(logs)})
    else:
        return jsonify({"success": True, "data": None})

@app.route('/api/safety-radius-tables', methods=['GET'])
def get_safety_radius_tables():
    tables = SafetyRadiusTable.get_latest()
    if tables:
        return jsonify({"success": True, "data": _serialize(tables)})
    else:
        return jsonify({"success": True, "data": None})

@app.route('/api/sample/point-cloud', methods=['GET'])
def get_sample_point_cloud():
    sample_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        "data", "samples", "point_cloud_log_001.json"
    )
    with open(sample_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return jsonify({"success": True, "data": data})

@app.route('/api/sample/safety-radius', methods=['GET'])
def get_sample_safety_radius():
    sample_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        "data", "samples", "safety_radius_table_001.json"
    )
    with open(sample_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return jsonify({"success": True, "data": data})

def run_server(port=5000):
    print(f"🚄 轨道交通限界检查系统 - API服务启动中...")
    print(f"📋 Web看板: http://localhost:{port}/")
    print(f"🔌 API文档:")
    print(f"   GET  /api/workflow/status")
    print(f"   POST /api/workflow/step1")
    print(f"   POST /api/workflow/step2")
    print(f"   POST /api/workflow/step3")
    print(f"   GET  /api/issues")
    print(f"   POST /api/detect")
    print()
    app.run(host='0.0.0.0', port=port, debug=False, use_reloader=False)

if __name__ == "__main__":
    run_server()
