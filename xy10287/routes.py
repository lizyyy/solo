from flask import request, jsonify, render_template, send_file
import os
from werkzeug.utils import secure_filename

from app import app

service = None
def get_service():
    global service
    if service is None:
        from data_service import DataProcessingService
        service = DataProcessingService()
    return service

ALLOWED_EXTENSIONS = {'xlsx', 'xls', 'csv'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/stats', methods=['GET'])
def get_stats():
    try:
        stats = get_service().get_dashboard_stats()
        return jsonify({'success': True, 'data': stats})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/records', methods=['GET'])
def get_records():
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 20))
        status = request.args.get('status')
        level = request.args.get('level')
        batch_id = request.args.get('batch_id')
        
        result = get_service().get_records_list(page, per_page, status, level, batch_id)
        return jsonify({'success': True, 'data': result})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/records/<record_id>', methods=['GET'])
def get_record(record_id):
    try:
        detail = get_service().get_record_detail(record_id)
        if detail:
            return jsonify({'success': True, 'data': detail})
        return jsonify({'success': False, 'message': '记录不存在'}), 404
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/records/<record_id>/review', methods=['POST'])
def review_record(record_id):
    try:
        data = request.get_json()
        result = get_service().review_record(
            record_id=record_id,
            reviewer=data.get('reviewer', ''),
            comment=data.get('comment', ''),
            final_type=data.get('final_type', ''),
            final_level=data.get('final_level', 'normal')
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/import', methods=['POST'])
def import_data():
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'message': '没有上传文件'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'success': False, 'message': '没有选择文件'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'success': False, 'message': '不支持的文件格式'}), 400
        
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)
        
        result = get_service().process_file(file_path)
        
        if os.path.exists(file_path):
            os.remove(file_path)
        
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/export', methods=['GET'])
def export_data():
    try:
        batch_id = request.args.get('batch_id')
        file_path = get_service().export_results(batch_id)
        
        return send_file(
            file_path,
            as_attachment=True,
            download_name=os.path.basename(file_path),
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/rules', methods=['GET'])
def get_rules():
    try:
        rules = [
            {
                'id': 'R001',
                'name': '高RMS值规则',
                'condition': 'RMS值 > 0.12',
                'anomaly_type': '潜在机械故障',
                'anomaly_level': 'warning',
                'confidence_base': 0.6,
                'explanation': 'RMS能量值超过正常阈值(0.12)，表明存在机械振动异常'
            },
            {
                'id': 'R002',
                'name': '高频峰值规则',
                'condition': '峰值频率 > 3000Hz',
                'anomaly_type': '高频异响',
                'anomaly_level': 'warning',
                'confidence_base': 0.55,
                'explanation': '峰值频率超过3kHz，可能由气蚀或轴承故障引起'
            },
            {
                'id': 'R003',
                'name': '低谐波比规则',
                'condition': '谐波比 < 0.5',
                'anomaly_type': '非稳态噪音',
                'anomaly_level': 'alert',
                'confidence_base': 0.7,
                'explanation': '谐波比过低(<0.5)，信号非线性成分显著增加'
            },
            {
                'id': 'R004',
                'name': '中频共振规则',
                'condition': '500Hz ≤ 峰值频率 ≤ 2000Hz 且 RMS > 0.08',
                'anomaly_type': '结构共振',
                'anomaly_level': 'warning',
                'confidence_base': 0.65,
                'explanation': '中频范围(500-2000Hz)出现能量集中，可能存在管道或基座共振'
            },
            {
                'id': 'R005',
                'name': '关键词匹配-轴承',
                'condition': '文本包含: 轴承、磨损、疲劳、剥落',
                'anomaly_type': '轴承故障',
                'anomaly_level': 'alert',
                'confidence_base': 0.85,
                'explanation': '巡检记录包含轴承相关异常描述关键词'
            },
            {
                'id': 'R006',
                'name': '关键词匹配-气蚀',
                'condition': '文本包含: 气蚀、气泡、空化、嘶嘶',
                'anomaly_type': '气蚀现象',
                'anomaly_level': 'warning',
                'confidence_base': 0.8,
                'explanation': '巡检记录包含气蚀相关描述关键词'
            },
            {
                'id': 'R007',
                'name': '关键词匹配-叶轮',
                'condition': '文本包含: 叶轮、失衡、震动、抖动',
                'anomaly_type': '叶轮失衡',
                'anomaly_level': 'warning',
                'confidence_base': 0.75,
                'explanation': '巡检记录包含叶轮失衡相关描述关键词'
            },
            {
                'id': 'R008',
                'name': '关键词匹配-正常',
                'condition': '文本包含: 正常、平稳、无异响、良好',
                'anomaly_type': '正常运行',
                'anomaly_level': 'normal',
                'confidence_base': 0.9,
                'explanation': '巡检记录明确标注设备运行正常'
            },
            {
                'id': 'R009',
                'name': '严重异常组合',
                'condition': 'RMS > 0.2 且 谐波比 < 0.4',
                'anomaly_type': '严重机械故障',
                'anomaly_level': 'critical',
                'confidence_base': 0.9,
                'explanation': '高能量配合极低谐波比，存在严重机械故障风险'
            }
        ]
        return jsonify({'success': True, 'data': rules})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
