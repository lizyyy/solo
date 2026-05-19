from flask import Flask, request, jsonify, send_file
from datetime import datetime
from service import WarehouseService
from models import AuditInfo, Database
import os

app = Flask(__name__)
service = WarehouseService()

def _get_audit_info(request_data: dict) -> AuditInfo:
    return AuditInfo(
        operator_id=request_data.get('operator_id', 'unknown'),
        operator_name=request_data.get('operator_name', 'unknown'),
        role=request_data.get('role', 'unknown'),
        operation_time=datetime.now()
    )

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok", "message": "家电售后仓管理系统运行正常"})

@app.route('/api/receive', methods=['POST'])
def receive_parts():
    data = request.get_json()
    audit = _get_audit_info(data)
    result = service.receive_parts(
        operation_id=data['operation_id'],
        parts=data['parts'],
        audit=audit
    )
    return jsonify(result)

@app.route('/api/install', methods=['POST'])
def install_parts():
    data = request.get_json()
    audit = _get_audit_info(data)
    result = service.install_parts(
        operation_id=data['operation_id'],
        receive_operation_id=data['receive_operation_id'],
        parts=data['parts'],
        audit=audit
    )
    return jsonify(result)

@app.route('/api/return', methods=['POST'])
def return_parts():
    data = request.get_json()
    audit = _get_audit_info(data)
    result = service.return_parts(
        operation_id=data['operation_id'],
        install_operation_id=data['install_operation_id'],
        parts=data['parts'],
        audit=audit
    )
    return jsonify(result)

@app.route('/api/claim', methods=['POST'])
def claim_parts():
    data = request.get_json()
    audit = _get_audit_info(data)
    result = service.claim_parts(
        operation_id=data['operation_id'],
        return_operation_id=data['return_operation_id'],
        parts=data['parts'],
        audit=audit
    )
    return jsonify(result)

@app.route('/api/write-off', methods=['POST'])
def write_off_parts():
    data = request.get_json()
    audit = _get_audit_info(data)
    result = service.write_off_parts(
        operation_id=data['operation_id'],
        claim_operation_id=data['claim_operation_id'],
        parts=data['parts'],
        audit=audit
    )
    return jsonify(result)

@app.route('/api/batch', methods=['POST'])
def batch_operation():
    data = request.get_json()
    audit = _get_audit_info(data)
    result = service.batch_operation(
        operations=data['operations'],
        audit=audit
    )
    return jsonify(result)

@app.route('/api/operations', methods=['GET'])
def query_operations():
    operator_id = request.args.get('operator_id')
    start_time = request.args.get('start_time')
    end_time = request.args.get('end_time')
    status = request.args.get('status')
    operation_type = request.args.get('operation_type')
    error_type = request.args.get('error_type')
    page = int(request.args.get('page', 1))
    page_size = int(request.args.get('page_size', 100))
    
    result = service.query_operations(
        operator_id=operator_id,
        start_time=start_time,
        end_time=end_time,
        status=status,
        operation_type=operation_type,
        error_type=error_type,
        page=page,
        page_size=page_size
    )
    return jsonify(result)

@app.route('/api/export', methods=['GET'])
def export_report():
    operator_id = request.args.get('operator_id')
    start_time = request.args.get('start_time')
    end_time = request.args.get('end_time')
    status = request.args.get('status')
    operation_type = request.args.get('operation_type')
    error_type = request.args.get('error_type')
    
    report_file = service.export_report(
        operator_id=operator_id,
        start_time=start_time,
        end_time=end_time,
        status=status,
        operation_type=operation_type,
        error_type=error_type
    )
    
    return send_file(
        report_file,
        as_attachment=True,
        download_name=os.path.basename(report_file),
        mimetype='text/plain'
    )

@app.route('/api/part/<part_code>/trace', methods=['GET'])
def get_part_trace(part_code):
    result = service.get_part_trace(part_code)
    return jsonify(result)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
