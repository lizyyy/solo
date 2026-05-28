"""Web应用模块
提供简单直观的Web界面，方便新人操作。
"""

import os
import json
from flask import Flask, render_template, request, jsonify, send_from_directory, abort
from werkzeug.utils import secure_filename
from typing import Dict, Any

from .controller import AudioClusteringController
from .models import OperationType


UPLOAD_FOLDER = "./uploads"
ALLOWED_EXTENSIONS = {'wav', 'mp3', 'flac', 'ogg'}


def create_app(
    data_dir: str = "./data",
    output_dir: str = "./output"
) -> Flask:
    """创建Flask应用"""
    app = Flask(__name__, template_folder='templates', static_folder='static')
    app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
    app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB

    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    os.makedirs(data_dir, exist_ok=True)
    os.makedirs(output_dir, exist_ok=True)

    controller = AudioClusteringController(
        data_dir=data_dir,
        output_dir=output_dir
    )

    def get_b64(filepath: str) -> str:
        """将图片文件转换为base64字符串"""
        try:
            import base64
            if filepath and os.path.exists(filepath):
                with open(filepath, 'rb') as f:
                    return base64.b64encode(f.read()).decode('utf-8')
        except Exception as e:
            print(f"转换base64失败: {e}")
        return ''

    app.jinja_env.globals.update(get_b64=get_b64)

    def allowed_file(filename: str) -> bool:
        return '.' in filename and \
               filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

    @app.route('/')
    def index():
        """主页"""
        summary = controller.get_summary()
        segments = controller.list_segments()
        history = controller.get_history()
        return render_template(
            'index.html',
            summary=summary,
            segments=segments,
            history=history,
            operation_types=[e.value for e in OperationType]
        )

    @app.route('/api/summary')
    def api_summary():
        """获取状态摘要"""
        return jsonify(controller.get_summary())

    @app.route('/api/segments')
    def api_segments():
        """获取所有片段列表"""
        return jsonify(controller.list_segments())

    @app.route('/api/segment/<segment_id>')
    def api_segment_detail(segment_id: str):
        """获取片段详细信息"""
        try:
            return jsonify(controller.explain_segment(segment_id))
        except ValueError as e:
            return jsonify({"error": str(e)}), 404

    @app.route('/api/history')
    def api_history():
        """获取历史记录"""
        return jsonify(controller.get_history())

    @app.route('/api/compare')
    def api_compare():
        """比较两个片段"""
        seg1 = request.args.get('seg1')
        seg2 = request.args.get('seg2')
        if not seg1 or not seg2:
            return jsonify({"error": "需要两个片段ID"}), 400
        try:
            return jsonify(controller.compare_segments(seg1, seg2))
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

    @app.route('/api/refresh', methods=['POST'])
    def api_refresh():
        """重新计算聚类"""
        result = controller.refresh_all()
        return jsonify(result)

    @app.route('/api/export', methods=['POST'])
    def api_export():
        """导出数据"""
        try:
            files = controller.export_data()
            return jsonify({
                "success": True,
                "files": files
            })
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

    @app.route('/api/upload', methods=['POST'])
    def api_upload():
        """上传音频文件进行处理"""
        if 'files' not in request.files:
            return jsonify({"error": "没有选择文件"}), 400

        files = request.files.getlist('files')
        operation_type_str = request.form.get(
            'operation_type', OperationType.NORMAL.value)
        operator = request.form.get('operator', '')
        description = request.form.get('description', '')

        try:
            operation_type = OperationType(operation_type_str)
        except ValueError:
            return jsonify({"error": "无效的操作类型"}), 400

        file_paths = []
        instrument_tags: Dict[str, list] = {}

        for file in files:
            if file.filename == '':
                continue
            if file and allowed_file(file.filename):
                filename = secure_filename(file.filename)
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(filepath)
                file_paths.append(filepath)

                tags = request.form.get(f'tags_{filename}', '')
                if tags:
                    instrument_tags[filepath] = [
                        t.strip() for t in tags.split(',') if t.strip()]

        if not file_paths:
            return jsonify({"error": "没有有效的音频文件"}), 400

        result = controller.process_files(
            file_paths=file_paths,
            operation_type=operation_type,
            instrument_tags=instrument_tags,
            operator=operator,
            description=description
        )

        return jsonify(result)

    @app.route('/api/process_directory', methods=['POST'])
    def api_process_directory():
        """处理目录下的音频文件"""
        data = request.get_json()
        directory = data.get('directory')
        if not directory or not os.path.isdir(directory):
            return jsonify({"error": "无效的目录路径"}), 400

        operation_type_str = data.get(
            'operation_type', OperationType.NORMAL.value)
        try:
            operation_type = OperationType(operation_type_str)
        except ValueError:
            return jsonify({"error": "无效的操作类型"}), 400

        result = controller.process_directory(
            directory=directory,
            operation_type=operation_type,
            operator=data.get('operator'),
            description=data.get('description')
        )

        return jsonify(result)

    @app.route('/api/withdraw', methods=['POST'])
    def api_withdraw():
        """撤回片段"""
        data = request.get_json()
        segment_ids = data.get('segment_ids', [])
        operator = data.get('operator', '')
        description = data.get('description', '')

        if not segment_ids:
            return jsonify({"error": "没有指定要撤回的片段"}), 400

        result = controller.withdraw_segments(
            segment_ids=segment_ids,
            operator=operator,
            description=description
        )

        return jsonify(result)

    @app.route('/output/<path:filename>')
    def download_output(filename: str):
        """下载输出文件"""
        return send_from_directory(
            os.path.abspath(output_dir),
            filename,
            as_attachment=True
        )

    @app.route('/api/cluster/<cluster_id>')
    def api_cluster_detail(cluster_id: str):
        """获取聚类详细信息"""
        if not controller.report:
            return jsonify({"error": "请先进行聚类"}), 400

        try:
            cluster_id_int = int(cluster_id)
            detail = controller.clusterer.explain_cluster(
                cluster_id_int,
                controller.report,
                list(controller.segments.values()),
                list(controller.features.values())
            )
            return jsonify(detail)
        except (ValueError, IndexError) as e:
            return jsonify({"error": str(e)}), 404

    @app.route('/api/charts')
    def api_charts():
        """获取图表文件列表"""
        return jsonify(controller.charts)

    return app

