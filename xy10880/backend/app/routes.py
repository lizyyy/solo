from flask import Blueprint, request, jsonify, Response
from .services import (
    DeviceModelService, FirmwareService, GrayBatchService,
    UpgradeReceiptService, ReportService
)
import csv
from io import StringIO

api_bp = Blueprint('api', __name__, url_prefix='/api')

@api_bp.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"})

@api_bp.route('/device-models', methods=['GET'])
def get_device_models():
    models = DeviceModelService.get_all()
    return jsonify(models)

@api_bp.route('/device-models', methods=['POST'])
def create_device_model():
    data = request.json
    model = DeviceModelService.create(
        model_name=data['model_name'],
        model_code=data['model_code'],
        description=data.get('description', '')
    )
    return jsonify(model), 201

@api_bp.route('/firmware', methods=['GET'])
def get_firmware():
    firmware_list = FirmwareService.get_all()
    return jsonify(firmware_list)

@api_bp.route('/firmware', methods=['POST'])
def create_firmware():
    data = request.json
    firmware = FirmwareService.create(
        model_id=data['model_id'],
        version=data['version'],
        file_path=data.get('file_path', ''),
        md5=data.get('md5', ''),
        size=data.get('size', 0),
        release_notes=data.get('release_notes', '')
    )
    return jsonify(firmware), 201

@api_bp.route('/batches', methods=['GET'])
def get_batches():
    filters = {}
    if request.args.get('status'):
        filters['status'] = request.args.get('status')
    if request.args.get('model_id'):
        filters['model_id'] = int(request.args.get('model_id'))
    
    batches = GrayBatchService.get_all(filters)
    return jsonify(batches)

@api_bp.route('/batches', methods=['POST'])
def create_batch():
    data = request.json
    batch = GrayBatchService.create(
        name=data['name'],
        model_id=data['model_id'],
        firmware_id=data['firmware_id'],
        pause_threshold=data.get('pause_threshold', 0.1),
        rollback_strategy=data.get('rollback_strategy', 'manual')
    )
    return jsonify(batch), 201

@api_bp.route('/batches/<int:batch_id>', methods=['GET'])
def get_batch(batch_id):
    batch = GrayBatchService.get_by_id(batch_id)
    if not batch:
        return jsonify({"error": "批次不存在"}), 404
    return jsonify(batch)

@api_bp.route('/batches/<int:batch_id>/start', methods=['POST'])
def start_batch(batch_id):
    success, message = GrayBatchService.start_batch(batch_id)
    if not success:
        return jsonify({"error": message}), 400
    return jsonify({"message": message})

@api_bp.route('/batches/<int:batch_id>/pause', methods=['POST'])
def pause_batch(batch_id):
    data = request.json or {}
    success, message = GrayBatchService.pause_batch(batch_id, data.get('reason', '手动暂停'))
    if not success:
        return jsonify({"error": message}), 400
    return jsonify({"message": message})

@api_bp.route('/batches/<int:batch_id>/resume', methods=['POST'])
def resume_batch(batch_id):
    success, message = GrayBatchService.resume_batch(batch_id)
    if not success:
        return jsonify({"error": message}), 400
    return jsonify({"message": message})

@api_bp.route('/batches/<int:batch_id>/rollback', methods=['POST'])
def rollback_batch(batch_id):
    success, message = GrayBatchService.rollback_batch(batch_id)
    if not success:
        return jsonify({"error": message}), 400
    return jsonify({"message": message})

@api_bp.route('/batches/<int:batch_id>/complete', methods=['POST'])
def complete_batch(batch_id):
    success, message = GrayBatchService.complete_batch(batch_id)
    if not success:
        return jsonify({"error": message}), 400
    return jsonify({"message": message})

@api_bp.route('/batches/<int:batch_id>/receipts', methods=['GET'])
def get_batch_receipts(batch_id):
    receipts = UpgradeReceiptService.get_by_batch(batch_id)
    return jsonify(receipts)

@api_bp.route('/batches/<int:batch_id>/timeline', methods=['GET'])
def get_batch_timeline(batch_id):
    timeline = UpgradeReceiptService.get_timeline(batch_id)
    return jsonify(timeline)

@api_bp.route('/batches/<int:batch_id>/report', methods=['GET'])
def get_batch_report(batch_id):
    report = ReportService.generate_batch_report(batch_id)
    if not report:
        return jsonify({"error": "批次不存在"}), 404
    return jsonify(report)

@api_bp.route('/batches/<int:batch_id>/report/download', methods=['GET'])
def download_batch_report(batch_id):
    report = ReportService.generate_batch_report(batch_id)
    if not report:
        return jsonify({"error": "批次不存在"}), 404
    
    output = StringIO()
    writer = csv.writer(output)
    
    writer.writerow(['批次名称', report['batch']['name']])
    writer.writerow(['设备型号', report['batch']['model_name']])
    writer.writerow(['固件版本', report['batch']['firmware_version']])
    writer.writerow(['状态', report['batch']['status']])
    writer.writerow([])
    writer.writerow(['统计摘要'])
    writer.writerow(['总数', report['summary']['total']])
    writer.writerow(['成功', report['summary']['success']])
    writer.writerow(['失败', report['summary']['failed']])
    writer.writerow(['成功率', f"{report['summary']['success_rate']:.2%}"])
    writer.writerow([])
    writer.writerow(['升级详情'])
    writer.writerow(['设备序列号', '状态', '错误码', '错误信息', '创建时间', '完成时间'])
    
    for r in report['receipts']:
        writer.writerow([
            r['device_sn'],
            r['status'],
            r.get('error_code', ''),
            r.get('error_message', ''),
            r['created_at'],
            r.get('completed_at', '')
        ])
    
    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype='text/csv',
        headers={'Content-Disposition': f'attachment; filename=batch_{batch_id}_report.csv'}
    )

@api_bp.route('/receipts', methods=['POST'])
def create_receipt():
    data = request.json
    receipt = UpgradeReceiptService.create(
        batch_id=data['batch_id'],
        device_sn=data['device_sn']
    )
    return jsonify(receipt), 201

@api_bp.route('/receipts/bulk', methods=['POST'])
def bulk_import_receipts():
    data = request.json
    result = UpgradeReceiptService.bulk_import(
        batch_id=data['batch_id'],
        device_sns=data['device_sns']
    )
    return jsonify(result)

@api_bp.route('/receipts/<int:receipt_id>/start', methods=['POST'])
def start_upgrade(receipt_id):
    success, message = UpgradeReceiptService.start_upgrade(receipt_id)
    if not success:
        return jsonify({"error": message}), 400
    return jsonify({"message": message})

@api_bp.route('/receipts/<int:receipt_id>/complete', methods=['POST'])
def complete_upgrade(receipt_id):
    data = request.json
    success, message = UpgradeReceiptService.complete_upgrade(
        receipt_id,
        success=data['success'],
        error_code=data.get('error_code'),
        error_message=data.get('error_message')
    )
    if not success:
        return jsonify({"error": message}), 400
    return jsonify({"message": message})
