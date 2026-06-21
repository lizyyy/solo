from __future__ import annotations

import os
import sys
import tempfile
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from typing import Dict, Any

from models import BatchProcessResult, generate_id
from pipeline import run_full_pipeline
from api_serializer import batch_to_api_response, annotation_to_station_record, delta_to_report
from handoff_verifier import run_handoff_verification

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

app = Flask(__name__)
CORS(app, supports_credentials=True)
app.config["JSON_AS_ASCII"] = False
app.config["JSONIFY_PRETTYPRINT_REGULAR"] = True


BATCH_STORE: Dict[str, BatchProcessResult] = {}
BASE_OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web_output")
os.makedirs(BASE_OUTPUT_DIR, exist_ok=True)


SAMPLE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sample_buoy_logs.txt")


def _store_batch(batch: BatchProcessResult) -> None:
    BATCH_STORE[batch.batch_id] = batch


def _get_batch(batch_id: str):
    return BATCH_STORE.get(batch_id)


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "stored_batches": list(BATCH_STORE.keys())})


@app.route("/api/load-sample", methods=["GET"])
def load_sample():
    try:
        output_dir = os.path.join(BASE_OUTPUT_DIR, generate_id("web"))
        os.makedirs(output_dir, exist_ok=True)
        batch = run_full_pipeline([SAMPLE_PATH], output_dir)
        _store_batch(batch)
        return jsonify(batch_to_api_response(batch))
    except Exception as e:
        return jsonify({"error": str(e), "type": "load-sample-failed"}), 500


@app.route("/api/parse-logs", methods=["POST"])
def parse_logs():
    try:
        payload = request.get_json(force=True)
        logs_text = payload.get("logs_text", "")
        if not logs_text.strip():
            return jsonify({"error": "logs_text is empty"}), 400

        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".txt", delete=False, encoding="utf-8"
        ) as tf:
            tf.write(logs_text)
            tmp_path = tf.name

        try:
            output_dir = os.path.join(BASE_OUTPUT_DIR, generate_id("web"))
            os.makedirs(output_dir, exist_ok=True)
            batch = run_full_pipeline([tmp_path], output_dir)
            _store_batch(batch)
            return jsonify(batch_to_api_response(batch))
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
    except Exception as e:
        return jsonify({"error": str(e), "type": "parse-logs-failed"}), 500


@app.route("/api/remark-reprocess", methods=["POST"])
def remark_reprocess():
    try:
        payload = request.get_json(force=True)
        batch_id = payload.get("batch_id")
        remarks_input = payload.get("remarks", [])

        batch = _get_batch(batch_id)
        if batch is None:
            return jsonify({"error": f"batch {batch_id} not found"}), 404

        extra_remarks: Dict[str, str] = {}
        for r in remarks_input:
            remark_text = r.get("remark_text", "")
            if not remark_text:
                continue
            key = r.get("station_name") or r.get("log_id") or r.get("annotation_id")
            if key:
                extra_remarks[key] = remark_text

        # 若没有指定站，则备注应用到所有
        if not extra_remarks and remarks_input:
            default = remarks_input[-1].get("remark_text", "")
            for ann in batch.annotations:
                extra_remarks[ann.station_name] = default

        # 对现有源文件重跑（保持 pipeline 原样），并把 extra_remarks 传入
        output_dir = os.path.join(BASE_OUTPUT_DIR, generate_id("re"))
        os.makedirs(output_dir, exist_ok=True)
        new_batch = run_full_pipeline(batch.source_files, output_dir, extra_remarks=extra_remarks)
        _store_batch(new_batch)

        resp = batch_to_api_response(new_batch)
        resp["original_batch_id"] = batch_id
        return jsonify(resp)
    except Exception as e:
        return jsonify({"error": str(e), "type": "remark-reprocess-failed"}), 500


@app.route("/api/export-csv", methods=["GET"])
def export_csv():
    batch_id = request.args.get("batch_id")
    version = request.args.get("version", "1")
    batch = _get_batch(batch_id)
    if batch is None:
        return jsonify({"error": f"batch {batch_id} not found"}), 404

    prefix = "v2_" if version == "2" else "v1_"
    target = None
    for exp in batch.exports:
        if exp.export_type == "csv" and os.path.basename(exp.export_path).startswith(prefix):
            target = exp.export_path
            break
    if target is None:
        for exp in batch.exports:
            if exp.export_type == "csv":
                target = exp.export_path
                break

    if target is None or not os.path.exists(target):
        return jsonify({"error": "CSV not generated yet"}), 404

    return send_file(
        target,
        as_attachment=True,
        download_name=os.path.basename(target),
        mimetype="text/csv; charset=utf-8"
    )


@app.route("/api/handoff-verify", methods=["POST"])
def handoff_verify():
    try:
        payload = request.get_json(force=True)
        batch_id = payload.get("batch_id")
        version = int(payload.get("version", 2))
        batch = _get_batch(batch_id)
        if batch is None:
            return jsonify({"error": f"batch {batch_id} not found"}), 404

        # 找输出目录
        output_dir = None
        if batch.exports:
            output_dir = os.path.dirname(batch.exports[0].export_path)

        if output_dir is None or not os.path.exists(output_dir):
            return jsonify({"error": "output dir not found"}), 404

        result = run_handoff_verification(output_dir, batch_id)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e), "type": "verify-failed"}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5001"))
    print(f"潮汐能站空间标注 API 服务启动: http://localhost:{port}")
    print(f"示例日志: {SAMPLE_PATH}")
    app.run(host="0.0.0.0", port=port, debug=False)
