from flask import Flask, render_template, jsonify, request
from noise_buffer.processor import NoiseProcessor
from noise_buffer.demo_data import create_demo_data
import os

app = Flask(__name__)

DATA_FILE = "project_data.json"


def get_processor():
    if os.path.exists(DATA_FILE):
        from noise_buffer.models import ProjectData
        data = ProjectData.load(DATA_FILE)
    else:
        data = create_demo_data()
    return NoiseProcessor(data)


def save_processor(processor):
    processor.data.save(DATA_FILE)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/summary")
def api_summary():
    processor = get_processor()
    return jsonify({
        "summary": processor.get_sample_summary(),
        "warnings": processor.get_warnings()
    })


@app.route("/api/samples")
def api_samples():
    processor = get_processor()
    return jsonify({
        "samples": [s.__dict__ for s in processor.data.samples],
        "complaints": [c.__dict__ for c in processor.data.complaints]
    })


@app.route("/api/heatmap")
def api_heatmap():
    processor = get_processor()
    heatmap = processor.recompute_heatmap()
    return jsonify({
        "cells": [h.__dict__ for h in heatmap],
        "warnings": processor.get_warnings()
    })


@app.route("/api/samples/import", methods=["POST"])
def api_import_samples():
    processor = get_processor()
    data = request.json
    samples = processor.import_samples(data.get("samples", []))
    save_processor(processor)
    return jsonify({
        "status": "ok",
        "imported": len(samples),
        "samples": [s.__dict__ for s in samples]
    })


@app.route("/api/complaints/link", methods=["POST"])
def api_link_complaint():
    processor = get_processor()
    data = request.json
    correction = processor.link_complaint_to_sample(
        sample_id=data["sample_id"],
        complaint_no=data["complaint_no"],
        operator=data.get("operator", "阿宁")
    )
    if correction:
        save_processor(processor)
        return jsonify({
            "status": "ok",
            "correction": correction.__dict__,
            "heatmap": [h.__dict__ for h in processor.recompute_heatmap()]
        })
    return jsonify({"status": "error", "message": "采样点或投诉编号未找到"}), 404


@app.route("/api/samples/correct", methods=["POST"])
def api_correct_sample():
    processor = get_processor()
    data = request.json
    correction = processor.manual_correct(
        sample_id=data["sample_id"],
        new_noise_level=float(data["new_noise_level"]),
        reason=data["reason"],
        operator=data.get("operator", "阿宁")
    )
    if correction:
        save_processor(processor)
        return jsonify({
            "status": "ok",
            "correction": correction.__dict__,
            "heatmap": [h.__dict__ for h in processor.recompute_heatmap()]
        })
    return jsonify({"status": "error", "message": "采样点未找到"}), 404


@app.route("/api/corrections")
def api_corrections():
    processor = get_processor()
    return jsonify({
        "corrections": [c.__dict__ for c in processor.data.corrections]
    })


@app.route("/api/reset", methods=["POST"])
def api_reset():
    if os.path.exists(DATA_FILE):
        os.remove(DATA_FILE)
    return jsonify({"status": "ok", "message": "已重置为演示数据"})


if __name__ == "__main__":
    app.run(debug=True, port=5100)
