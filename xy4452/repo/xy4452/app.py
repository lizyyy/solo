from flask import Flask, render_template, jsonify, request, send_file
from werkzeug.utils import secure_filename
import os
import json
from datetime import datetime
from config import Config
from models import DataStore, FoundItem, LostReport, ClaimRecord
from matcher import ItemMatcher
from exporter import MarkdownExporter, JSONExporter

app = Flask(__name__)
app.config.from_object(Config)
Config.create_directories()

data_store = DataStore(app.config['DATA_DIR'])
matcher = ItemMatcher()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/items', methods=['GET'])
def get_all_items():
    items = data_store.get_all_found_items()
    return jsonify([item.to_dict() for item in items])

@app.route('/api/items/<item_id>', methods=['GET'])
def get_item(item_id):
    item = data_store.get_found_item(item_id)
    if item:
        return jsonify(item.to_dict())
    return jsonify({'error': 'Item not found'}), 404

@app.route('/api/items', methods=['POST'])
def add_item():
    data = request.json
    item = FoundItem(
        title=data.get('title'),
        description=data.get('description'),
        location=data.get('location'),
        found_date=data.get('found_date'),
        finder=data.get('finder'),
        image_paths=data.get('image_paths', []),
        tags=data.get('tags', [])
    )
    data_store.save_found_item(item)
    return jsonify(item.to_dict()), 201

@app.route('/api/items/<item_id>', methods=['PUT'])
def update_item(item_id):
    item = data_store.get_found_item(item_id)
    if not item:
        return jsonify({'error': 'Item not found'}), 404
    
    data = request.json
    for key, value in data.items():
        if hasattr(item, key):
            setattr(item, key, value)
    
    data_store.save_found_item(item)
    return jsonify(item.to_dict())

@app.route('/api/lost-reports', methods=['GET'])
def get_lost_reports():
    reports = data_store.get_all_lost_reports()
    return jsonify([report.to_dict() for report in reports])

@app.route('/api/lost-reports', methods=['POST'])
def add_lost_report():
    data = request.json
    report = LostReport(
        title=data.get('title'),
        description=data.get('description'),
        location=data.get('location'),
        lost_date=data.get('lost_date'),
        reporter=data.get('reporter'),
        contact=data.get('contact'),
        tags=data.get('tags', [])
    )
    data_store.save_lost_report(report)
    return jsonify(report.to_dict()), 201

@app.route('/api/lost-reports/<report_id>', methods=['PUT'])
def update_lost_report(report_id):
    reports = data_store.get_all_lost_reports()
    report = None
    for r in reports:
        if r.report_id == report_id:
            report = r
            break
    
    if not report:
        return jsonify({'error': 'Report not found'}), 404
    
    data = request.json
    for key, value in data.items():
        if hasattr(report, key):
            setattr(report, key, value)
    
    data_store.save_lost_report(report)
    return jsonify(report.to_dict())

@app.route('/api/claim-records', methods=['GET'])
def get_claim_records():
    records = data_store.get_all_claim_records()
    return jsonify([record.to_dict() for record in records])

@app.route('/api/claim-records', methods=['POST'])
def add_claim_record():
    data = request.json
    record = ClaimRecord(
        item_id=data.get('item_id'),
        report_id=data.get('report_id'),
        claimant=data.get('claimant'),
        claimant_contact=data.get('claimant_contact'),
        claim_date=data.get('claim_date'),
        status=data.get('status', 'pending'),
        notes=data.get('notes', '')
    )
    data_store.save_claim_record(record)
    return jsonify(record.to_dict()), 201

@app.route('/api/claim-records/<claim_id>', methods=['PUT'])
def update_claim_record(claim_id):
    records = data_store.get_all_claim_records()
    record = None
    for r in records:
        if r.claim_id == claim_id:
            record = r
            break
    
    if not record:
        return jsonify({'error': 'Claim record not found'}), 404
    
    data = request.json
    for key, value in data.items():
        if hasattr(record, key):
            setattr(record, key, value)
    
    data_store.save_claim_record(record)
    return jsonify(record.to_dict())

@app.route('/api/match', methods=['GET'])
def find_matches():
    found_items = data_store.get_all_found_items()
    lost_reports = data_store.get_all_lost_reports()
    
    matches = []
    for item in found_items:
        for report in lost_reports:
            score = matcher.calculate_match_score(item, report)
            if score > 0.1:
                matches.append({
                    'found_item': item.to_dict(),
                    'lost_report': report.to_dict(),
                    'match_score': score,
                    'risk_factors': matcher.detect_risks(item, report, data_store)
                })
    
    matches.sort(key=lambda x: x['match_score'], reverse=True)
    return jsonify(matches)

@app.route('/api/import/csv', methods=['POST'])
def import_csv():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    import_type = request.form.get('type', 'found_items')
    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config['UPLOAD_DIR'], filename)
    file.save(filepath)
    
    try:
        if import_type == 'found_items':
            from importer import CSVImporter
            items = CSVImporter.import_found_items(filepath)
            for item in items:
                data_store.save_found_item(item)
            return jsonify({'message': f'Successfully imported {len(items)} found items', 'count': len(items)})
        elif import_type == 'lost_reports':
            from importer import CSVImporter
            reports = CSVImporter.import_lost_reports(filepath)
            for report in reports:
                data_store.save_lost_report(report)
            return jsonify({'message': f'Successfully imported {len(reports)} lost reports', 'count': len(reports)})
        elif import_type == 'claim_records':
            from importer import CSVImporter
            records = CSVImporter.import_claim_records(filepath)
            for record in records:
                data_store.save_claim_record(record)
            return jsonify({'message': f'Successfully imported {len(records)} claim records', 'count': len(records)})
        else:
            return jsonify({'error': 'Unknown import type'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/export/markdown', methods=['GET'])
def export_markdown():
    found_items = data_store.get_all_found_items()
    lost_reports = data_store.get_all_lost_reports()
    claim_records = data_store.get_all_claim_records()
    
    exporter = MarkdownExporter()
    content = exporter.export(found_items, lost_reports, claim_records)
    
    filepath = os.path.join(app.config['EXPORT_DIR'], f'lost_found_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.md')
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    return send_file(filepath, as_attachment=True, download_name=os.path.basename(filepath))

@app.route('/api/export/json', methods=['GET'])
def export_json():
    found_items = data_store.get_all_found_items()
    lost_reports = data_store.get_all_lost_reports()
    claim_records = data_store.get_all_claim_records()
    
    exporter = JSONExporter()
    content = exporter.export(found_items, lost_reports, claim_records)
    
    filepath = os.path.join(app.config['EXPORT_DIR'], f'lost_found_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json')
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    return send_file(filepath, as_attachment=True, download_name=os.path.basename(filepath))

@app.route('/api/stats', methods=['GET'])
def get_stats():
    found_count = len(data_store.get_all_found_items())
    lost_count = len(data_store.get_all_lost_reports())
    claim_count = len(data_store.get_all_claim_records())
    
    claimed_statuses = ['claimed', 'returned', 'confirmed']
    claimed_count = sum(1 for r in data_store.get_all_claim_records() if r.status in claimed_statuses)
    pending_count = sum(1 for r in data_store.get_all_claim_records() if r.status == 'pending')
    
    unclaimed_items = data_store.get_all_found_items()
    for claim in data_store.get_all_claim_records():
        if claim.status in claimed_statuses and claim.item_id:
            unclaimed_items = [i for i in unclaimed_items if i.item_id != claim.item_id]
    
    return jsonify({
        'found_items_count': found_count,
        'lost_reports_count': lost_count,
        'claim_records_count': claim_count,
        'claimed_count': claimed_count,
        'pending_count': pending_count,
        'unclaimed_count': len(unclaimed_items)
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
