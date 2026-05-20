from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
from datetime import datetime
from models import Database, WashingRecord, RecoveryRecord, RoomConfig, RecordStatus, ReviewAction
from data_import import DataImporter
from reconciliation import ReconciliationEngine
from review_and_report import ReviewManager, ReportGenerator

app = Flask(__name__)
CORS(app)

DB_PATH = 'linen_reconciliation.db'

def get_db():
    return Database(DB_PATH)

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'timestamp': datetime.now().isoformat()})

@app.route('/api/config', methods=['POST'])
def add_config():
    data = request.json
    db = get_db()
    config = RoomConfig(db)
    config_id = config.add_config(
        room_type=data['room_type'],
        linen_type=data['linen_type'],
        quantity=data['quantity'],
        unit_price=data['unit_price']
    )
    return jsonify({'success': True, 'config_id': config_id})

@app.route('/api/config', methods=['GET'])
def get_configs():
    db = get_db()
    config = RoomConfig(db)
    configs = config.get_all_configs()
    return jsonify(configs)

@app.route('/api/washing', methods=['POST'])
def add_washing():
    data = request.json
    db = get_db()
    washing = WashingRecord(db)
    record_id = washing.add_record(
        batch_no=data['batch_no'],
        send_date=data['send_date'],
        linen_type=data['linen_type'],
        quantity=data['quantity'],
        unit_price=data['unit_price'],
        hotel_remark=data.get('hotel_remark', ''),
        factory_remark=data.get('factory_remark', '')
    )
    return jsonify({'success': True, 'record_id': record_id})

@app.route('/api/washing', methods=['GET'])
def get_washing():
    start_date = request.args.get('start_date', '2024-01-01')
    end_date = request.args.get('end_date', '2024-12-31')
    db = get_db()
    washing = WashingRecord(db)
    records = washing.get_records_by_date_range(start_date, end_date)
    return jsonify(records)

@app.route('/api/recovery', methods=['POST'])
def add_recovery():
    data = request.json
    db = get_db()
    recovery = RecoveryRecord(db)
    record_id = recovery.add_record(
        recovery_no=data['recovery_no'],
        recovery_date=data['recovery_date'],
        linen_type=data['linen_type'],
        clean_quantity=data['clean_quantity'],
        damaged_quantity=data.get('damaged_quantity', 0),
        lost_quantity=data.get('lost_quantity', 0),
        damage_reason=data.get('damage_reason', '')
    )
    return jsonify({'success': True, 'record_id': record_id})

@app.route('/api/recovery', methods=['GET'])
def get_recovery():
    start_date = request.args.get('start_date', '2024-01-01')
    end_date = request.args.get('end_date', '2024-12-31')
    db = get_db()
    recovery = RecoveryRecord(db)
    records = recovery.get_records_by_date_range(start_date, end_date)
    return jsonify(records)

@app.route('/api/import/washing', methods=['POST'])
def import_washing_csv():
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': '没有上传文件'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'message': '文件名为空'}), 400
    filepath = os.path.join('temp', file.filename)
    os.makedirs('temp', exist_ok=True)
    file.save(filepath)
    db = get_db()
    importer = DataImporter(db)
    success, failed, errors = importer.import_washing_csv(filepath)
    os.remove(filepath)
    return jsonify({
        'success': True,
        'imported_count': success,
        'failed_count': failed,
        'errors': errors
    })

@app.route('/api/import/recovery', methods=['POST'])
def import_recovery_json():
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': '没有上传文件'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'message': '文件名为空'}), 400
    filepath = os.path.join('temp', file.filename)
    os.makedirs('temp', exist_ok=True)
    file.save(filepath)
    db = get_db()
    importer = DataImporter(db)
    success, failed, errors = importer.import_recovery_json(filepath)
    os.remove(filepath)
    return jsonify({
        'success': True,
        'imported_count': success,
        'failed_count': failed,
        'errors': errors
    })

@app.route('/api/reconciliation/batch', methods=['POST'])
def create_batch():
    data = request.json
    db = get_db()
    engine = ReconciliationEngine(db)
    batch_id = engine.create_reconciliation_batch(
        period_start=data['period_start'],
        period_end=data['period_end']
    )
    return jsonify({'success': True, 'batch_id': batch_id})

@app.route('/api/reconciliation/run/<int:batch_id>', methods=['POST'])
def run_reconciliation(batch_id):
    db = get_db()
    engine = ReconciliationEngine(db)
    result = engine.run_reconciliation(batch_id)
    return jsonify(result)

@app.route('/api/reconciliation/details/<int:batch_id>', methods=['GET'])
def get_reconciliation_details(batch_id):
    db = get_db()
    engine = ReconciliationEngine(db)
    details = engine.get_reconciliation_details(batch_id)
    return jsonify(details)

@app.route('/api/reconciliation/summary/<int:batch_id>', methods=['GET'])
def get_reconciliation_summary(batch_id):
    db = get_db()
    engine = ReconciliationEngine(db)
    summary = engine.get_reconciliation_summary(batch_id)
    return jsonify(summary)

@app.route('/api/review/<int:detail_id>', methods=['POST'])
def review_detail(detail_id):
    data = request.json
    db = get_db()
    review_manager = ReviewManager(db)
    result = review_manager.review_detail(
        detail_id=detail_id,
        action=data['action'],
        note=data.get('note', ''),
        operator=data.get('operator', 'system')
    )
    return jsonify(result)

@app.route('/api/review/revise/<int:detail_id>', methods=['POST'])
def revise_detail(detail_id):
    data = request.json
    db = get_db()
    review_manager = ReviewManager(db)
    result = review_manager.revise_detail(
        detail_id=detail_id,
        washing_quantity=data.get('washing_quantity'),
        recovery_quantity=data.get('recovery_quantity'),
        damage_quantity=data.get('damage_quantity'),
        shortage_quantity=data.get('shortage_quantity'),
        note=data.get('note', ''),
        operator=data.get('operator', 'system')
    )
    return jsonify(result)

@app.route('/api/review/batch-approve/<int:batch_id>', methods=['POST'])
def batch_approve(batch_id):
    data = request.json or {}
    db = get_db()
    review_manager = ReviewManager(db)
    result = review_manager.batch_approve(
        batch_id=batch_id,
        operator=data.get('operator', 'system')
    )
    return jsonify(result)

@app.route('/api/report/<int:batch_id>', methods=['GET'])
def get_report(batch_id):
    db = get_db()
    report_generator = ReportGenerator(db)
    report = report_generator.generate_detail_report(batch_id)
    return jsonify(report)

@app.route('/api/report/export/csv/<int:batch_id>', methods=['GET'])
def export_csv(batch_id):
    db = get_db()
    report_generator = ReportGenerator(db)
    filename = f'reconciliation_report_{batch_id}.csv'
    filepath = os.path.join('exports', filename)
    os.makedirs('exports', exist_ok=True)
    success = report_generator.export_csv(batch_id, filepath)
    if success:
        return send_file(filepath, as_attachment=True, download_name=filename)
    return jsonify({'success': False, 'message': '导出失败'}), 400

@app.route('/api/report/export/json/<int:batch_id>', methods=['GET'])
def export_json(batch_id):
    db = get_db()
    report_generator = ReportGenerator(db)
    filename = f'reconciliation_report_{batch_id}.json'
    filepath = os.path.join('exports', filename)
    os.makedirs('exports', exist_ok=True)
    success = report_generator.export_json(batch_id, filepath)
    if success:
        return send_file(filepath, as_attachment=True, download_name=filename)
    return jsonify({'success': False, 'message': '导出失败'}), 400

@app.route('/api/report/summary/<int:batch_id>', methods=['GET'])
def get_review_summary(batch_id):
    db = get_db()
    report_generator = ReportGenerator(db)
    summary = report_generator.get_review_summary(batch_id)
    return jsonify(summary)

@app.route('/api/batches', methods=['GET'])
def get_all_batches():
    db = get_db()
    conn = db.get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM reconciliation_batches ORDER BY created_at DESC')
    batches = cursor.fetchall()
    conn.close()
    return jsonify([dict(b) for b in batches])

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
