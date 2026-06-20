import sys
import urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from flask import Flask, render_template, request, Response, jsonify
from src.error_analysis import ErrorAnalysisPipeline

app = Flask(__name__)


def build_pipeline_from_request(req) -> ErrorAnalysisPipeline:
    """从请求参数构造管线并应用筛选、复算——保证页面内所有结果同口径。"""
    pipe = ErrorAnalysisPipeline()
    filters = {
        "subject": req.args.get("subject"),
        "error_type": req.args.get("error_type"),
        "error_source": req.args.get("error_source"),
        "review_round": req.args.get("review_round"),
        "manual_confirmed": req.args.get("manual_confirmed"),
        "has_duplicates": req.args.get("has_duplicates"),
        "has_supplementary": req.args.get("has_supplementary"),
        "min_error_magnitude": req.args.get("min_error_magnitude"),
    }
    pipe.apply_filters(**filters)
    formula = req.args.get("formula", "rss")
    pipe.recalculate_propagated_error(formula=formula)
    return pipe


@app.route("/")
def index():
    pipe = build_pipeline_from_request(request)
    result = pipe.get_unified_result()
    return render_template("index.html", result=result, req_args=request.args.to_dict())


@app.route("/detail/<sample_id>")
def detail(sample_id):
    pipe = build_pipeline_from_request(request)
    detail_data = pipe.get_sample_detail(sample_id)
    return render_template("detail.html", detail=detail_data, sample_id=sample_id,
                           req_args=request.args.to_dict())


@app.route("/export.csv")
def export_csv():
    pipe = build_pipeline_from_request(request)
    csv_content = pipe.export_csv()
    filename_parts = ["error_analysis"]
    for k, v in pipe.active_filters.items():
        filename_parts.append(f"{k}_{v}")
    filename = "-".join(filename_parts) + ".csv"
    encoded = urllib.parse.quote(filename)
    return Response(
        csv_content,
        mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded}"},
    )


@app.route("/api/result")
def api_result():
    pipe = build_pipeline_from_request(request)
    return jsonify(pipe.get_unified_result())


@app.route("/api/confirm_diffs")
def api_confirm_diffs():
    """第二天复盘用：查看所有人工确认前/后有差别的记录。"""
    pipe = build_pipeline_from_request(request)
    diffs = pipe.get_confirm_diffs()
    return jsonify({
        "count": len(diffs),
        "records": pipe._df_to_safe_records(diffs),
        "filters": pipe.active_filters,
    })


@app.route("/api/duplicates")
def api_duplicates():
    pipe = build_pipeline_from_request(request)
    dups = pipe.detect_duplicates()
    return jsonify({
        "count": len(dups),
        "records": pipe._df_to_safe_records(dups),
        "filters": pipe.active_filters,
    })


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
