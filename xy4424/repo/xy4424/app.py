from datetime import datetime
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import io
import json

from config import Config
from models import (
    Release, ReleaseStatus, ReviewComment, ValidationIssue,
    ValidationSeverity, generate_id
)
from parsers import CSVParser, JSONParser
from validators import ReleaseValidator
from exporters import MarkdownExporter, JSONAuditExporter
from storage import release_store, audit_store

app = Flask(__name__)
app.config.from_object(Config)
CORS(app)

Config.ensure_directories()


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    })


@app.route('/api/releases', methods=['GET'])
def list_releases():
    releases = release_store.load_all_releases()
    return jsonify({
        "releases": [
            {
                "release_id": r.release_id,
                "release_name": r.release_name,
                "created_at": r.created_at.isoformat(),
                "created_by": r.created_by,
                "status": r.status.value,
                "device_count": len(r.devices),
                "schedule_count": len(r.schedules),
                "issue_count": len(r.validation_issues)
            }
            for r in releases
        ]
    })


@app.route('/api/releases', methods=['POST'])
def create_release():
    data = request.get_json() or {}
    release_name = data.get('release_name', f'发布批次_{datetime.now().strftime("%Y%m%d_%H%M%S")}')
    created_by = data.get('created_by', '系统管理员')
    
    release = release_store.create_release(
        release_name=release_name,
        created_by=created_by
    )
    
    return jsonify({
        "message": "发布批次创建成功",
        "release_id": release.release_id,
        "release": release.to_dict()
    }), 201


@app.route('/api/releases/<release_id>', methods=['GET'])
def get_release(release_id):
    release = release_store.load_release(release_id)
    if not release:
        return jsonify({"error": "发布批次不存在"}), 404
    
    return jsonify(release.to_dict())


@app.route('/api/releases/<release_id>', methods=['DELETE'])
def delete_release(release_id):
    success = release_store.delete_release(release_id)
    if not success:
        return jsonify({"error": "发布批次不存在"}), 404
    
    return jsonify({"message": "发布批次已删除"})


@app.route('/api/releases/<release_id>/import/devices', methods=['POST'])
def import_devices(release_id):
    release = release_store.load_release(release_id)
    if not release:
        return jsonify({"error": "发布批次不存在"}), 404
    
    if 'file' not in request.files:
        return jsonify({"error": "未上传文件"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "未选择文件"}), 400
    
    content = file.read().decode('utf-8')
    devices = CSVParser.parse_devices(content)
    
    release.devices = devices
    release_store.save_release(release)
    
    return jsonify({
        "message": f"成功导入 {len(devices)} 台设备",
        "count": len(devices),
        "devices": [d.to_dict() for d in devices]
    })


@app.route('/api/releases/<release_id>/import/schedules', methods=['POST'])
def import_schedules(release_id):
    release = release_store.load_release(release_id)
    if not release:
        return jsonify({"error": "发布批次不存在"}), 404
    
    if 'file' not in request.files:
        return jsonify({"error": "未上传文件"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "未选择文件"}), 400
    
    content = file.read().decode('utf-8')
    schedules = CSVParser.parse_schedules(content)
    
    release.schedules = schedules
    release_store.save_release(release)
    
    return jsonify({
        "message": f"成功导入 {len(schedules)} 条时刻表",
        "count": len(schedules),
        "schedules": [s.to_dict() for s in schedules]
    })


@app.route('/api/releases/<release_id>/import/detours', methods=['POST'])
def import_detours(release_id):
    release = release_store.load_release(release_id)
    if not release:
        return jsonify({"error": "发布批次不存在"}), 404
    
    if 'file' not in request.files:
        return jsonify({"error": "未上传文件"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "未选择文件"}), 400
    
    content = file.read().decode('utf-8')
    detours = JSONParser.parse_detours(content)
    
    release.detours = detours
    release_store.save_release(release)
    
    return jsonify({
        "message": f"成功导入 {len(detours)} 条临时绕行",
        "count": len(detours),
        "detours": [d.to_dict() for d in detours]
    })


@app.route('/api/releases/<release_id>/import/templates', methods=['POST'])
def import_templates(release_id):
    release = release_store.load_release(release_id)
    if not release:
        return jsonify({"error": "发布批次不存在"}), 404
    
    if 'file' not in request.files:
        return jsonify({"error": "未上传文件"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "未选择文件"}), 400
    
    content = file.read().decode('utf-8')
    templates, metadata = JSONParser.parse_template_package(content)
    
    release.templates = templates
    release_store.save_release(release)
    
    return jsonify({
        "message": f"成功导入 {len(templates)} 个模板",
        "count": len(templates),
        "metadata": metadata,
        "templates": [t.to_dict() for t in templates]
    })


@app.route('/api/releases/<release_id>/batch-import', methods=['POST'])
def batch_import(release_id):
    release = release_store.load_release(release_id)
    if not release:
        return jsonify({"error": "发布批次不存在"}), 404
    
    results = {
        "devices": 0,
        "schedules": 0,
        "detours": 0,
        "templates": 0,
        "errors": []
    }
    
    if 'devices_file' in request.files:
        try:
            file = request.files['devices_file']
            if file.filename:
                content = file.read().decode('utf-8')
                devices = CSVParser.parse_devices(content)
                release.devices = devices
                results["devices"] = len(devices)
        except Exception as e:
            results["errors"].append(f"设备导入失败: {str(e)}")
    
    if 'schedules_file' in request.files:
        try:
            file = request.files['schedules_file']
            if file.filename:
                content = file.read().decode('utf-8')
                schedules = CSVParser.parse_schedules(content)
                release.schedules = schedules
                results["schedules"] = len(schedules)
        except Exception as e:
            results["errors"].append(f"时刻表导入失败: {str(e)}")
    
    if 'detours_file' in request.files:
        try:
            file = request.files['detours_file']
            if file.filename:
                content = file.read().decode('utf-8')
                detours = JSONParser.parse_detours(content)
                release.detours = detours
                results["detours"] = len(detours)
        except Exception as e:
            results["errors"].append(f"绕行导入失败: {str(e)}")
    
    if 'templates_file' in request.files:
        try:
            file = request.files['templates_file']
            if file.filename:
                content = file.read().decode('utf-8')
                templates, _ = JSONParser.parse_template_package(content)
                release.templates = templates
                results["templates"] = len(templates)
        except Exception as e:
            results["errors"].append(f"模板导入失败: {str(e)}")
    
    release_store.save_release(release)
    
    return jsonify({
        "message": "批量导入完成",
        "results": results
    })


@app.route('/api/releases/<release_id>/validate', methods=['POST'])
def validate_release(release_id):
    release = release_store.load_release(release_id)
    if not release:
        return jsonify({"error": "发布批次不存在"}), 404
    
    issues = ReleaseValidator.validate_all(release)
    release.validation_issues = issues
    
    release_store.save_release(release)
    
    summary = ReleaseValidator.get_issue_summary(issues)
    
    return jsonify({
        "message": "校验完成",
        "summary": summary,
        "issues": [i.to_dict() for i in issues],
        "release_items": [r.to_dict() for r in release.release_items]
    })


@app.route('/api/releases/<release_id>/issues', methods=['GET'])
def get_issues(release_id):
    release = release_store.load_release(release_id)
    if not release:
        return jsonify({"error": "发布批次不存在"}), 404
    
    return jsonify({
        "summary": ReleaseValidator.get_issue_summary(release.validation_issues),
        "issues": [i.to_dict() for i in release.validation_issues]
    })


@app.route('/api/releases/<release_id>/review', methods=['POST'])
def add_review_comment(release_id):
    release = release_store.load_release(release_id)
    if not release:
        return jsonify({"error": "发布批次不存在"}), 404
    
    data = request.get_json() or {}
    reviewer = data.get('reviewer', '未知用户')
    comment_text = data.get('comment', '')
    issue_id = data.get('issue_id')
    
    if not comment_text:
        return jsonify({"error": "评论内容不能为空"}), 400
    
    comment = ReviewComment(
        comment_id=generate_id(),
        reviewer=reviewer,
        comment=comment_text,
        timestamp=datetime.now(),
        issue_id=issue_id
    )
    
    release.review_comments.append(comment)
    release_store.save_release(release)
    
    return jsonify({
        "message": "评论已添加",
        "comment": comment.to_dict()
    }), 201


@app.route('/api/releases/<release_id>/approve', methods=['POST'])
def approve_release(release_id):
    release = release_store.load_release(release_id)
    if not release:
        return jsonify({"error": "发布批次不存在"}), 404
    
    errors = [i for i in release.validation_issues if i.severity == ValidationSeverity.ERROR]
    if errors:
        return jsonify({
            "error": "存在未解决的错误，无法审批通过",
            "error_count": len(errors)
        }), 400
    
    data = request.get_json() or {}
    approved_by = data.get('approved_by', '审批员')
    
    release.status = ReleaseStatus.APPROVED
    release.approved_by = approved_by
    release.approved_at = datetime.now()
    
    release_store.save_release(release)
    
    return jsonify({
        "message": "发布批次已审批通过",
        "release": {
            "release_id": release.release_id,
            "status": release.status.value,
            "approved_by": release.approved_by,
            "approved_at": release.approved_at.isoformat()
        }
    })


@app.route('/api/releases/<release_id>/regenerate-items', methods=['POST'])
def regenerate_release_items(release_id):
    release = release_store.load_release(release_id)
    if not release:
        return jsonify({"error": "发布批次不存在"}), 404
    
    release.release_items = ReleaseValidator.generate_release_items(
        release.devices,
        release.schedules,
        release.detours
    )
    
    release_store.save_release(release)
    
    return jsonify({
        "message": f"成功重新生成 {len(release.release_items)} 条发布清单",
        "count": len(release.release_items),
        "release_items": [r.to_dict() for r in release.release_items]
    })


@app.route('/api/releases/<release_id>/export/markdown', methods=['GET'])
def export_markdown(release_id):
    release = release_store.load_release(release_id)
    if not release:
        return jsonify({"error": "发布批次不存在"}), 404
    
    markdown_content = MarkdownExporter.export_handover_note(release)
    
    output = io.BytesIO()
    output.write(markdown_content.encode('utf-8'))
    output.seek(0)
    
    filename = f"handover_{release.release_id}.md"
    
    return send_file(
        output,
        as_attachment=True,
        download_name=filename,
        mimetype='text/markdown'
    )


@app.route('/api/releases/<release_id>/export/audit', methods=['GET'])
def export_audit(release_id):
    release = release_store.load_release(release_id)
    if not release:
        return jsonify({"error": "发布批次不存在"}), 404
    
    audit_package = JSONAuditExporter.export_audit_package(release)
    
    filename = audit_store.save_audit(release_id, audit_package)
    
    output = io.BytesIO()
    output.write(json.dumps(audit_package, ensure_ascii=False, indent=2).encode('utf-8'))
    output.seek(0)
    
    return send_file(
        output,
        as_attachment=True,
        download_name=filename,
        mimetype='application/json'
    )


@app.route('/api/releases/<release_id>/items', methods=['GET'])
def get_release_items(release_id):
    release = release_store.load_release(release_id)
    if not release:
        return jsonify({"error": "发布批次不存在"}), 404
    
    return jsonify({
        "count": len(release.release_items),
        "items": [r.to_dict() for r in release.release_items]
    })


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
