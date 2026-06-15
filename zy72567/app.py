"""
Web服务入口
页面展示 + API接口 都走同一个数据层（database.py），保证数据一致
"""
import os
import json
from datetime import datetime
from flask import Flask, render_template, jsonify, request, Response

from models import SampleStatus, AnomalyType
from database import Database
from workflow import WorkflowManager
from exporter import Exporter
from self_check import SelfChecker
from yaml_importer import YAMLImporter


def create_app(db_path: str = "boundary_samples.db"):
    app = Flask(__name__, template_folder="templates", static_folder="static")
    
    db = Database(db_path)
    workflow = WorkflowManager(db)
    exporter = Exporter(db)
    checker = SelfChecker(db)
    importer = YAMLImporter(db)
    
    # ============== 工具函数 ==============
    
    def status_label(status_val: str) -> str:
        labels = {
            "imported": "已导入",
            "slice_viewed": "已看切片",
            "feature_updated": "已更特征",
            "pending_review": "待产品复核",
            "normal": "确认正常",
            "abnormal": "确认异常"
        }
        return labels.get(status_val, status_val)
    
    def anomaly_label(anomaly_val: str) -> str:
        labels = {
            "duplicate_import": "重复导入",
            "duplicate_train": "重复训练",
            "supplement_recalc": "补录待重算",
            "export_inconsistent": "导出不一致"
        }
        return labels.get(anomaly_val, anomaly_val)
    
    def sample_to_dict(sample, include_related=False):
        d = {
            "id": sample.id,
            "sample_key": sample.sample_key,
            "batch_id": sample.batch_id,
            "text_content": sample.text_content,
            "predicted_category": sample.predicted_category,
            "actual_category": sample.actual_category,
            "status": sample.status.value,
            "status_label": status_label(sample.status.value),
            "anomaly_types": [t.value for t in sample.anomaly_types],
            "anomaly_labels": [anomaly_label(t.value) for t in sample.anomaly_types],
            "is_abnormal": sample.is_abnormal,
            "yaml_version_id": sample.yaml_version_id,
            "yaml_line_number": sample.yaml_line_number,
            "created_at": sample.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "updated_at": sample.updated_at.strftime("%Y-%m-%d %H:%M:%S"),
            "last_updated_by": sample.last_updated_by
        }
        if include_related:
            d["yaml_lines"] = [
                {
                    "id": l.id,
                    "line_number": l.line_number,
                    "original_content": l.original_content,
                    "current_content": l.current_content,
                    "is_modified": l.is_modified,
                    "modified_by": l.modified_by,
                    "modified_at": l.modified_at.strftime("%Y-%m-%d %H:%M:%S") if l.modified_at else "",
                    "remark": l.remark
                }
                for l in sample.yaml_lines
            ]
            d["slices"] = [
                {
                    "id": s.id,
                    "slice_data": s.slice_data,
                    "viewed_by": s.viewed_by,
                    "viewed_at": s.viewed_at.strftime("%Y-%m-%d %H:%M:%S") if s.viewed_at else "",
                    "viewer_remark": s.viewer_remark
                }
                for s in sample.slices
            ]
            d["feature_versions"] = [
                {
                    "id": f.id,
                    "feature_version": f.feature_version,
                    "updated_by": f.updated_by,
                    "updated_at": f.updated_at.strftime("%Y-%m-%d %H:%M:%S"),
                    "update_remark": f.update_remark
                }
                for f in sample.feature_versions
            ]
        return d
    
    # ============== 页面路由 ==============
    
    @app.route("/")
    def index():
        """样本列表页 - 导出明细主页面"""
        return render_template("index.html")
    
    @app.route("/sample/<int:sample_id>")
    def sample_detail(sample_id):
        """样本详情页 - 看历史留痕、状态变化、证据链"""
        return render_template("sample_detail.html", sample_id=sample_id)
    
    # ============== API接口 ==============
    
    @app.route("/api/samples")
    def api_samples():
        """
        样本列表API
        页面列表、导出功能、外部调用都走这个接口
        保证数据一致
        """
        status = request.args.get("status")
        batch_id = request.args.get("batch_id")
        has_anomaly_str = request.args.get("has_anomaly")
        page = int(request.args.get("page", 1))
        page_size = int(request.args.get("page_size", 50))
        
        status_enum = SampleStatus(status) if status else None
        has_anomaly = None
        if has_anomaly_str == "true":
            has_anomaly = True
        elif has_anomaly_str == "false":
            has_anomaly = False
        
        samples, total = db.list_samples(
            status=status_enum,
            batch_id=batch_id,
            has_anomaly=has_anomaly,
            page=page,
            page_size=page_size
        )
        
        return jsonify({
            "code": 0,
            "data": [sample_to_dict(s) for s in samples],
            "total": total,
            "page": page,
            "page_size": page_size
        })
    
    @app.route("/api/samples/<int:sample_id>")
    def api_sample_detail(sample_id):
        """样本详情API - 含关联数据"""
        sample = db.get_sample(sample_id, include_related=True)
        if not sample:
            return jsonify({"code": 1, "msg": "样本不存在"}), 404
        
        evidence = workflow.get_sample_evidence(sample_id)
        audit_logs = db.get_audit_logs(sample_id)
        
        return jsonify({
            "code": 0,
            "data": sample_to_dict(sample, include_related=True),
            "evidence": evidence,
            "audit_logs": audit_logs
        })
    
    @app.route("/api/export/csv")
    def api_export_csv():
        """
        CSV导出API
        和页面列表用同一份查询逻辑，保证导出数据和页面展示完全一致
        """
        status = request.args.get("status")
        batch_id = request.args.get("batch_id")
        has_anomaly_str = request.args.get("has_anomaly")
        
        status_enum = SampleStatus(status) if status else None
        has_anomaly = None
        if has_anomaly_str == "true":
            has_anomaly = True
        elif has_anomaly_str == "false":
            has_anomaly = False
        
        csv_data = exporter.export_to_csv(
            status=status_enum,
            batch_id=batch_id,
            has_anomaly=has_anomaly
        )
        
        return Response(
            csv_data,
            mimetype="text/csv; charset=utf-8",
            headers={"Content-disposition": "attachment; filename=boundary_samples.csv"}
        )
    
    @app.route("/api/export/json")
    def api_export_json():
        """JSON导出API"""
        status = request.args.get("status")
        batch_id = request.args.get("batch_id")
        has_anomaly_str = request.args.get("has_anomaly")
        
        status_enum = SampleStatus(status) if status else None
        has_anomaly = None
        if has_anomaly_str == "true":
            has_anomaly = True
        elif has_anomaly_str == "false":
            has_anomaly = False
        
        json_data = exporter.export_to_json(
            status=status_enum,
            batch_id=batch_id,
            has_anomaly=has_anomaly
        )
        
        return Response(
            json_data,
            mimetype="application/json; charset=utf-8",
            headers={"Content-disposition": "attachment; filename=boundary_samples.json"}
        )
    
    @app.route("/api/self-check")
    def api_self_check():
        """运行自检"""
        results = checker.run_all_checks()
        return jsonify({
            "code": 0,
            "data": [
                {
                    "check_name": r.check_name,
                    "passed": r.passed,
                    "summary": r.summary,
                    "problem_count": len(r.problem_samples),
                    "problem_samples": r.problem_samples
                }
                for r in results
            ]
        })
    
    @app.route("/api/stats")
    def api_stats():
        """统计数据 - 页面顶部概览用"""
        all_samples, total = db.list_samples(page_size=10000)
        
        status_counts = {}
        anomaly_count = 0
        batch_ids = set()
        
        for s in all_samples:
            status_counts[s.status.value] = status_counts.get(s.status.value, 0) + 1
            if s.is_abnormal:
                anomaly_count += 1
            batch_ids.add(s.batch_id)
        
        return jsonify({
            "code": 0,
            "data": {
                "total": total,
                "abnormal_count": anomaly_count,
                "batch_count": len(batch_ids),
                "status_counts": {k: v for k, v in status_counts.items()},
                "status_labels": {k: status_label(k) for k in status_counts.keys()}
            }
        })
    
    @app.route("/api/yaml/versions")
    def api_yaml_versions():
        """YAML版本列表"""
        # 简单实现，直接查数据库
        with db.get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM yaml_versions ORDER BY id DESC")
            rows = cursor.fetchall()
            versions = []
            for r in rows:
                versions.append({
                    "id": r["id"],
                    "version_name": r["version_name"],
                    "import_time": r["import_time"],
                    "imported_by": r["imported_by"],
                    "file_name": r["file_name"],
                    "line_count": r["line_count"],
                    "is_active": r["is_active"] == 1
                })
        return jsonify({"code": 0, "data": versions})
    
    @app.route("/api/yaml/versions/<int:version_id>/diff")
    def api_yaml_diff(version_id):
        """YAML改动历史"""
        diffs = importer.get_version_diff(version_id)
        return jsonify({"code": 0, "data": diffs})
    
    # ============== 工作流API ==============
    
    @app.route("/api/workflow/import", methods=["POST"])
    def api_import_yaml():
        """第一步：导入YAML"""
        data = request.get_json()
        content = data.get("content", "")
        file_name = data.get("file_name", "boundary_samples.yaml")
        imported_by = data.get("imported_by", "老唐")
        
        result = workflow.step1_import_yaml(content, file_name, imported_by)
        return jsonify({"code": 0, "data": result})
    
    @app.route("/api/workflow/view-slice", methods=["POST"])
    def api_view_slice():
        """第二步：老唐看评测切片"""
        data = request.get_json()
        sample_id = data.get("sample_id")
        slice_data = data.get("slice_data", "")
        viewed_by = data.get("viewed_by", "老唐")
        remark = data.get("remark", "")
        
        result = workflow.step2_view_slice(sample_id, slice_data, viewed_by, remark)
        return jsonify({"code": 0, "data": result})
    
    @app.route("/api/workflow/update-feature", methods=["POST"])
    def api_update_feature():
        """第三步：更新特征版本表"""
        data = request.get_json()
        sample_id = data.get("sample_id")
        feature_version = data.get("feature_version", "")
        updated_by = data.get("updated_by", "老唐")
        remark = data.get("remark", "")
        
        result = workflow.step3_update_feature(sample_id, feature_version, updated_by, remark)
        return jsonify({"code": 0, "data": result})
    
    @app.route("/api/workflow/product-review", methods=["POST"])
    def api_product_review():
        """策略产品复核"""
        data = request.get_json()
        sample_id = data.get("sample_id")
        is_normal = data.get("is_normal", True)
        reviewed_by = data.get("reviewed_by", "策略产品")
        remark = data.get("remark", "")
        
        result = workflow.product_review(sample_id, is_normal, reviewed_by, remark)
        return jsonify({"code": 0, "data": result})
    
    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=False, host="0.0.0.0", port=5060)
