#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
推荐召回候选去重 - 小看板Web界面
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, render_template, jsonify, request
from src import DedupEngine, SliceManager, FeatureVersionManager

app = Flask(__name__)

fv_manager = FeatureVersionManager()
dedup_engine = DedupEngine()
slice_manager = SliceManager(feature_version_manager=fv_manager)

data_dir = os.path.join(os.path.dirname(__file__), "data", "demo")


def load_demo_data():
    fv_versions = fv_manager.load_versions_yaml(
        os.path.join(data_dir, "feature_versions.yaml")
    )
    fv_manager.batch_import(fv_versions)
    
    records = dedup_engine.load_params_yaml(
        os.path.join(data_dir, "params.yaml")
    )
    dedup_engine.batch_import(records)
    
    slices = slice_manager.load_eval_slices(
        os.path.join(data_dir, "eval_slices.yaml")
    )
    slice_manager.batch_import(slices)


load_demo_data()


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/status')
def api_status():
    records = dedup_engine.get_all_records()
    slices = slice_manager.get_all_slices()
    fv_count = len(fv_manager.get_all_versions())
    pending = len(dedup_engine.get_pending_review())
    backfill = len(slice_manager.get_backfill_slices())
    
    status_counts = {}
    for r in records:
        status_counts[r.dedup_status] = status_counts.get(r.dedup_status, 0) + 1
    
    return jsonify({
        "records_count": len(records),
        "slices_count": len(slices),
        "feature_versions_count": fv_count,
        "pending_review": pending,
        "backfill_slices": backfill,
        "status_counts": status_counts
    })


@app.route('/api/records')
def api_records():
    records = dedup_engine.get_all_records()
    result = []
    for r in records:
        result.append({
            "record_id": r.record_id,
            "experiment_name": r.experiment_name,
            "data_batch_id": r.data_batch_id,
            "feature_version": r.feature_version,
            "model_version": r.model_version,
            "training_date": r.training_date,
            "dedup_status": r.dedup_status,
            "duplicate_of": r.duplicate_of,
            "review_required": r.review_required,
            "reviewer": r.reviewer,
            "review_comment": r.review_comment,
            "notes": r.notes,
            "params": r.params
        })
    return jsonify(result)


@app.route('/api/slices')
def api_slices():
    slices = slice_manager.get_all_slices()
    result = []
    for s in slices:
        result.append({
            "slice_id": s.slice_id,
            "slice_name": s.slice_name,
            "data_batch_id": s.data_batch_id,
            "eval_date": s.eval_date,
            "metrics": s.metrics,
            "feature_version": s.feature_version,
            "is_backfill": s.is_backfill,
            "source": s.source,
            "notes": s.notes
        })
    return jsonify(result)


@app.route('/api/feature-versions')
def api_feature_versions():
    versions = fv_manager.get_all_versions()
    result = []
    for fv in versions:
        result.append({
            "version_id": fv.version_id,
            "version_name": fv.version_name,
            "feature_list": fv.feature_list,
            "data_source": fv.data_source,
            "effective_date": fv.effective_date,
            "is_active": fv.is_active,
            "created_by": fv.created_by,
            "notes": fv.notes
        })
    return jsonify(result)


@app.route('/api/duplicate-groups')
def api_duplicate_groups():
    groups = dedup_engine.get_duplicate_groups()
    result = []
    for g in groups:
        result.append({
            "signature": g["signature"],
            "count": g["count"],
            "records": [r.record_id for r in g["records"]]
        })
    return jsonify(result)


@app.route('/api/review', methods=['POST'])
def api_review():
    data = request.json
    result = dedup_engine.review_duplicate(
        record_id=data['record_id'],
        reviewer=data['reviewer'],
        decision=data['decision'],
        comment=data.get('comment', '')
    )
    if result:
        return jsonify({"success": True, "record_id": result.record_id})
    return jsonify({"success": False, "error": "Record not found"}), 404


@app.route('/api/history')
def api_history():
    history = fv_manager.get_update_history()
    return jsonify(history)


if __name__ == '__main__':
    app.run(debug=True, port=5000, host='0.0.0.0')
