from flask import Flask, render_template, request, jsonify, redirect, url_for, Response
import json as json_module
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from src.data_manager import DataManager
from src.workflow import WorkflowEngine
from src.boundary_rules import BoundaryRuleEngine
from src.heatmap_utils import (
    generate_heatmap_grid,
    heatmap_grid_to_html,
    detect_anomaly_from_grid,
    get_next_steps_for_low_sampling,
)
from src.models import ProcessingStatus, HeatmapIssue

app = Flask(__name__)
app.config["SECRET_KEY"] = "history-district-signage-2024"

dm = DataManager()
workflow = WorkflowEngine(dm)
rule_engine = BoundaryRuleEngine()


@app.template_filter("datetime_format")
def datetime_format(value, format="%Y-%m-%d %H:%M:%S"):
    if value:
        return value.strftime(format)
    return ""


@app.route("/")
def index():
    photos = dm.get_all_photos()
    stats = dm.get_statistics()
    return render_template("index.html", photos=photos, stats=stats)


@app.route("/photo/<photo_id>")
def photo_detail(photo_id):
    photo = dm.get_photo(photo_id)
    if not photo:
        return "未找到记录", 404
    
    history = dm.get_photo_history(photo_id)
    
    heatmap_html = ""
    anomaly_info = ("", "")
    next_steps = []
    
    if photo.heatmap_data and "hourly_samples" in photo.heatmap_data:
        grid = generate_heatmap_grid(photo.heatmap_data["hourly_samples"])
        heatmap_html = heatmap_grid_to_html(grid, f"{photo.intersection_name} 热力图")
        has_anomaly, anomaly_msg = detect_anomaly_from_grid(grid)
        anomaly_info = (has_anomaly, anomaly_msg)
        if has_anomaly:
            next_steps = get_next_steps_for_low_sampling()
    
    return render_template(
        "photo_detail.html",
        photo=photo,
        history=history,
        heatmap_html=heatmap_html,
        anomaly_info=anomaly_info,
        next_steps=next_steps,
    )


@app.route("/photo/<photo_id>/add_bus_hours", methods=["POST"])
def api_add_bus_hours(photo_id):
    data = request.json
    bus_hours = data.get("bus_hours", [])
    operator = data.get("operator", "未知用户")
    reason = data.get("reason", "")
    
    result = workflow.step2_add_bus_card_hours(photo_id, bus_hours, operator, reason)
    return jsonify(result)


@app.route("/photo/<photo_id>/generate_heatmap", methods=["POST"])
def api_generate_heatmap(photo_id):
    data = request.json
    heatmap_data = data.get("heatmap_data")
    operator = data.get("operator", "未知用户")
    
    result = workflow.step3_generate_heatmap(photo_id, heatmap_data, operator)
    return jsonify(result)


@app.route("/photo/<photo_id>/review", methods=["POST"])
def api_review(photo_id):
    data = request.json
    is_normal = data.get("is_normal", True)
    review_note = data.get("review_note", "")
    operator = data.get("operator", "未知用户")
    
    result = workflow.review_heatmap(photo_id, is_normal, review_note, operator)
    return jsonify(result)


@app.route("/photo/<photo_id>/rollback", methods=["POST"])
def api_rollback(photo_id):
    data = request.json
    operator = data.get("operator", "未知用户")
    reason = data.get("reason", "")
    
    result = workflow.rollback(photo_id, operator, reason)
    return jsonify(result)


@app.route("/photo/<photo_id>/update_remark", methods=["POST"])
def api_update_remark(photo_id):
    data = request.json
    new_remark = data.get("remark", "")
    operator = data.get("operator", "未知用户")
    reason = data.get("reason", "修改备注")
    
    result = dm.update_field(photo_id, "remark", new_remark, operator, reason)
    if result:
        return jsonify({"success": True, "remark": result.remark})
    return jsonify({"success": False, "error": "更新失败"})


@app.route("/import", methods=["GET", "POST"])
def import_photos():
    if request.method == "POST":
        data = request.json
        rows = data.get("rows", [])
        source_file = data.get("source_file", "web_import.csv")
        operator = data.get("operator", "未知用户")
        
        result = workflow.step1_import_photos(rows, source_file, operator)
        return jsonify(result)
    
    return render_template("import.html")


@app.route("/rules")
def rules():
    all_rules = rule_engine.get_all_rules()
    return render_template("rules.html", rules=all_rules)


@app.route("/history")
def all_history():
    history = dm.get_all_history()
    return render_template("history.html", history=history)


@app.route("/report")
def report():
    report_data = workflow.export_report()
    return render_template("report.html", report=report_data)


@app.route("/report/export_json")
def export_json():
    report_data = workflow.export_report()
    json_str = json_module.dumps(report_data, ensure_ascii=False, indent=2)
    return Response(
        json_str,
        mimetype="application/json",
        headers={"Content-Disposition": "attachment; filename=history_district_report.json"},
    )


@app.route("/demo")
def run_demo():
    sample_data = [
        {
            "路口名称": "中山路与人民路交叉口",
            "拍摄时间": "2024-01-15",
            "公交刷卡时段": ["07:00-09:00", "17:00-19:00"],
            "heatmap_data": {
                "hourly_samples": {
                    "0": 5, "1": 3, "2": 2, "3": 2, "4": 3, "5": 8, "6": 15,
                    "7": 100, "8": 120, "9": 90, "10": 70, "11": 75, "12": 80,
                    "13": 75, "14": 70, "15": 75, "16": 85, "17": 110, "18": 105,
                    "19": 60, "20": 40, "21": 30, "22": 8, "23": 6,
                }
            },
        },
        {
            "路口名称": "历史街区南口",
            "拍摄时间": "2024-01-15",
            "公交刷卡时段": ["07:30-09:30", "16:30-18:30"],
            "heatmap_data": {
                "hourly_samples": {
                    "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "5": 1, "6": 3,
                    "7": 90, "8": 110, "9": 85, "10": 75, "11": 70, "12": 72,
                    "13": 68, "14": 70, "15": 72, "16": 80, "17": 95, "18": 90,
                    "19": 30, "20": 2, "21": 1, "22": 0, "23": 0,
                }
            },
        },
    ]
    
    results = workflow.run_full_demo(sample_data, "demo_import.csv")
    return jsonify({"demo_completed": True, "steps": results})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
