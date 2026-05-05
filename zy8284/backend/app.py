import os
import json
import csv
from datetime import datetime
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename
from io import StringIO, BytesIO

from .database import (
    init_database, insert_uploaded_file, insert_cleaning_rules,
    get_latest_rules_version, get_latest_rules, get_all_cleaned_records,
    get_lineage_for_record, get_all_conflicts, resolve_conflict,
    insert_manual_override, clear_all_data, insert_lineage
)
from .cleaning_engine import CleaningEngine

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), '..', 'uploads')
ALLOWED_EXTENSIONS = {'csv', 'yaml', 'yml'}

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/api/init', methods=['POST'])
def init_db():
    init_database()
    return jsonify({'status': 'success', 'message': 'Database initialized'})

@app.route('/api/upload', methods=['POST'])
def upload_files():
    if 'csv_file' not in request.files and 'rules_file' not in request.files:
        return jsonify({'status': 'error', 'message': 'No files provided'}), 400
    
    csv_file = request.files.get('csv_file')
    rules_file = request.files.get('rules_file')
    
    if csv_file and csv_file.filename == '':
        return jsonify({'status': 'error', 'message': 'No CSV file selected'}), 400
    
    if rules_file and rules_file.filename == '':
        return jsonify({'status': 'error', 'message': 'No rules file selected'}), 400
    
    rules_content = None
    rules_version = 0
    
    if rules_file and allowed_file(rules_file.filename):
        filename = secure_filename(rules_file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        rules_file.save(filepath)
        
        with open(filepath, 'r', encoding='utf-8') as f:
            rules_content = f.read()
        
        rules_version = get_latest_rules_version() + 1
        insert_cleaning_rules(rules_version, rules_content)
        insert_uploaded_file(filename, 'rules', rules_version)
    
    if csv_file and allowed_file(csv_file.filename):
        filename = secure_filename(csv_file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        csv_file.save(filepath)
        
        file_id = insert_uploaded_file(filename, 'csv')
        
        with open(filepath, 'r', encoding='utf-8') as f:
            csv_content = f.read()
        
        if not rules_content:
            latest_rules = get_latest_rules()
            if latest_rules:
                rules_content = latest_rules['rules_content']
                rules_version = latest_rules['version']
        
        engine = CleaningEngine()
        if rules_content:
            engine.load_rules(rules_content, rules_version)
        
        cleaned_records = engine.clean_csv(csv_content, file_id)
        
        return jsonify({
            'status': 'success',
            'message': 'Files processed successfully',
            'cleaned_records_count': len(cleaned_records),
            'rules_version': rules_version
        })
    
    return jsonify({'status': 'error', 'message': 'Invalid file type'}), 400

@app.route('/api/records', methods=['GET'])
def get_records():
    records = get_all_cleaned_records()
    return jsonify({'status': 'success', 'data': records})

@app.route('/api/lineage/<int:record_id>', methods=['GET'])
def get_lineage(record_id):
    lineage = get_lineage_for_record(record_id)
    return jsonify({'status': 'success', 'data': lineage})

@app.route('/api/conflicts', methods=['GET'])
def get_conflicts():
    conflicts = get_all_conflicts()
    return jsonify({'status': 'success', 'data': conflicts})

@app.route('/api/conflicts/<int:conflict_id>/resolve', methods=['POST'])
def resolve_conflict_endpoint(conflict_id):
    data = request.get_json()
    resolved_value = data.get('resolved_value')
    
    if not resolved_value:
        return jsonify({'status': 'error', 'message': 'Resolved value is required'}), 400
    
    resolve_conflict(conflict_id, resolved_value)
    return jsonify({'status': 'success', 'message': 'Conflict resolved'})

@app.route('/api/override', methods=['POST'])
def manual_override():
    data = request.get_json()
    
    cleaned_record_id = data.get('cleaned_record_id')
    column_name = data.get('column_name')
    original_cleaned_value = data.get('original_cleaned_value')
    new_value = data.get('new_value')
    reason = data.get('reason', 'Manual override')
    
    if not all([cleaned_record_id, column_name, new_value]):
        return jsonify({'status': 'error', 'message': 'Missing required fields'}), 400
    
    latest_rules = get_latest_rules()
    rules_version = latest_rules['version'] if latest_rules else 0
    
    insert_manual_override(
        cleaned_record_id,
        column_name,
        original_cleaned_value,
        new_value,
        reason
    )
    
    insert_lineage(
        cleaned_record_id,
        column_name,
        original_cleaned_value,
        new_value,
        'manual_override',
        rules_version,
        1
    )
    
    return jsonify({'status': 'success', 'message': 'Override applied'})

@app.route('/api/export/cleaned', methods=['GET'])
def export_cleaned():
    records = get_all_cleaned_records()
    
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=['line_number', 'customer_id', 'order_date', 'order_amount', 'status', 'has_manual_override'])
    writer.writeheader()
    
    for record in records:
        writer.writerow({
            'line_number': record['line_number'],
            'customer_id': record['customer_id'],
            'order_date': record['order_date'],
            'order_amount': record['order_amount'],
            'status': record['status'],
            'has_manual_override': record['has_manual_override']
        })
    
    output.seek(0)
    return send_file(
        BytesIO(output.getvalue().encode('utf-8')),
        mimetype='text/csv',
        as_attachment=True,
        download_name='cleaned.csv'
    )

@app.route('/api/export/lineage', methods=['GET'])
def export_lineage():
    records = get_all_cleaned_records()
    lineage_data = []
    
    for record in records:
        lineages = get_lineage_for_record(record['id'])
        lineage_data.append({
            'cleaned_record_id': record['id'],
            'line_number': record['line_number'],
            'original_raw_data': record['raw_data'],
            'cleaned_values': {
                'customer_id': record['customer_id'],
                'order_date': record['order_date'],
                'order_amount': record['order_amount'],
                'status': record['status']
            },
            'transformations': [
                {
                    'column': l['column_name'],
                    'original': l['original_value'],
                    'cleaned': l['cleaned_value'],
                    'rule': l['rule_applied'],
                    'is_manual_override': bool(l['is_manual_override'])
                }
                for l in lineages
            ]
        })
    
    output = json.dumps(lineage_data, indent=2, default=str)
    return send_file(
        BytesIO(output.encode('utf-8')),
        mimetype='application/json',
        as_attachment=True,
        download_name='lineage.json'
    )

@app.route('/api/export/audit', methods=['GET'])
def export_audit():
    records = get_all_cleaned_records()
    conflicts = get_all_conflicts()
    
    output = StringIO()
    output.write('# Data Cleaning Audit Report\n\n')
    output.write(f'**Generated:** {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}\n\n')
    
    output.write('## Summary\n\n')
    output.write(f'- Total records processed: {len(records)}\n')
    output.write(f'- Total conflicts detected: {len(conflicts)}\n')
    output.write(f'- Resolved conflicts: {sum(1 for c in conflicts if c["resolved"])}\n')
    output.write(f'- Records with manual overrides: {sum(1 for r in records if r["has_manual_override"])}\n\n')
    
    output.write('## Cleaned Records\n\n')
    output.write('| Line # | Customer ID | Order Date | Amount | Status | Manual Override |\n')
    output.write('|--------|-------------|------------|--------|--------|-----------------|\n')
    
    for record in records:
        output.write(f'| {record["line_number"]} | {record["customer_id"] or "-"} | {record["order_date"] or "-"} | {record["order_amount"] or "-"} | {record["status"] or "-"} | {"Yes" if record["has_manual_override"] else "No"} |\n')
    
    output.write('\n## Conflicts\n\n')
    if conflicts:
        for conflict in conflicts:
            output.write(f'### Conflict ID: {conflict["id"]}\n\n')
            output.write(f'- **Type:** {conflict["conflict_type"]}\n')
            output.write(f'- **Customer ID:** {conflict["customer_id"]}\n')
            output.write(f'- **Field:** {conflict["field_name"]}\n')
            output.write(f'- **Value 1 (Line {conflict["source_line1"]}):** {conflict["value1"]}\n')
            output.write(f'- **Value 2 (Line {conflict["source_line2"]}):** {conflict["value2"]}\n')
            output.write(f'- **Status:** {"Resolved" if conflict["resolved"] else "Unresolved"}\n')
            if conflict["resolved"]:
                output.write(f'- **Resolved Value:** {conflict["resolved_value"]}\n')
            output.write('\n')
    else:
        output.write('No conflicts detected.\n\n')
    
    output.write('## Lineage Details\n\n')
    for record in records:
        lineages = get_lineage_for_record(record['id'])
        if lineages:
            output.write(f'### Record at Line {record["line_number"]}\n\n')
            output.write(f'- **Original Raw Data:** {record["raw_data"]}\n\n')
            output.write('**Transformations:**\n\n')
            for lineage in lineages:
                override_text = ' (Manual Override)' if lineage['is_manual_override'] else ''
                output.write(f'- **{lineage["column_name"]}:** `{lineage["original_value"]}` → `{lineage["cleaned_value"]}` (Rule: {lineage["rule_applied"]}){override_text}\n')
            output.write('\n')
    
    output.seek(0)
    return send_file(
        BytesIO(output.getvalue().encode('utf-8')),
        mimetype='text/markdown',
        as_attachment=True,
        download_name='audit.md'
    )

@app.route('/api/clear', methods=['POST'])
def clear_data():
    clear_all_data()
    return jsonify({'status': 'success', 'message': 'All data cleared'})

@app.route('/')
def index():
    frontend_path = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'index.html')
    if os.path.exists(frontend_path):
        with open(frontend_path, 'r', encoding='utf-8') as f:
            return f.read()
    return 'Data Cleaning Workbench API'

if __name__ == '__main__':
    init_database()
    app.run(debug=True, host='0.0.0.0', port=5001)
