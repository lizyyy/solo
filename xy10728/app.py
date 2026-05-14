from flask import Flask, request, jsonify, send_file, render_template
from flask_cors import CORS
import pandas as pd
import uuid
import json
import os
from datetime import datetime
from rule_engine import RuleEngine, FieldMapper, DataValidator
from exporter import ReportExporter

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = 'uploads'
BATCHES_FOLDER = 'batches'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(BATCHES_FOLDER, exist_ok=True)

batches = {}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': '没有上传文件'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '未选择文件'}), 400
    
    batch_id = str(uuid.uuid4())
    timestamp = datetime.now().isoformat()
    
    file_path = os.path.join(UPLOAD_FOLDER, f"{batch_id}_{file.filename}")
    file.save(file_path)
    
    try:
        if file.filename.endswith('.csv'):
            df = pd.read_csv(file_path, encoding='utf-8')
        elif file.filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(file_path)
        else:
            return jsonify({'error': '不支持的文件格式，请上传 CSV 或 Excel'}), 400
        
        field_mapper = FieldMapper()
        mapped_fields = field_mapper.map_fields(df.columns.tolist())
        
        validator = DataValidator()
        validation_result = validator.validate_dataframe(df, mapped_fields)
        
        batch = {
            'batch_id': batch_id,
            'filename': file.filename,
            'upload_time': timestamp,
            'status': 'uploaded',
            'total_rows': len(df),
            'mapped_fields': mapped_fields,
            'validation_result': validation_result,
            'raw_data': df.to_dict('records'),
            'imported_data': None,
            'owner': request.form.get('owner', '未指定')
        }
        
        batches[batch_id] = batch
        
        return jsonify({
            'batch_id': batch_id,
            'filename': file.filename,
            'upload_time': timestamp,
            'total_rows': len(df),
            'mapped_fields': mapped_fields,
            'validation': validation_result
        })
    
    except Exception as e:
        return jsonify({'error': f'文件处理失败: {str(e)}'}), 500

@app.route('/api/batch/<batch_id>/validate', methods=['POST'])
def validate_batch(batch_id):
    if batch_id not in batches:
        return jsonify({'error': '批次不存在'}), 404
    
    batch = batches[batch_id]
    df = pd.DataFrame(batch['raw_data'])
    
    field_mapper = FieldMapper()
    mapped_fields = field_mapper.map_fields(df.columns.tolist())
    
    validator = DataValidator()
    validation_result = validator.validate_dataframe(df, mapped_fields)
    
    batch['validation_result'] = validation_result
    batch['status'] = 'validated'
    
    return jsonify({
        'batch_id': batch_id,
        'status': 'validated',
        'validation': validation_result
    })

@app.route('/api/batch/<batch_id>/import', methods=['POST'])
def import_batch(batch_id):
    if batch_id not in batches:
        return jsonify({'error': '批次不存在'}), 404
    
    batch = batches[batch_id]
    
    if batch['status'] != 'validated':
        return jsonify({'error': '请先完成校验'}), 400
    
    validation = batch['validation_result']
    
    clean_data = []
    for i, row in enumerate(batch['raw_data']):
        if i not in validation['dirty_row_indices']:
            clean_data.append(row)
    
    batch['imported_data'] = clean_data
    batch['status'] = 'imported'
    batch['import_time'] = datetime.now().isoformat()
    
    return jsonify({
        'batch_id': batch_id,
        'status': 'imported',
        'imported_count': len(clean_data),
        'skipped_count': len(validation['dirty_row_indices'])
    })

@app.route('/api/batches', methods=['GET'])
def list_batches():
    search = request.args.get('search', '')
    
    result = []
    for batch_id, batch in batches.items():
        if search.lower() in batch['filename'].lower() or \
           search.lower() in batch['owner'].lower() or \
           search.lower() in batch_id.lower():
            result.append({
                'batch_id': batch['batch_id'],
                'filename': batch['filename'],
                'upload_time': batch['upload_time'],
                'status': batch['status'],
                'owner': batch['owner'],
                'total_rows': batch['total_rows'],
                'imported_count': len(batch['imported_data']) if batch['imported_data'] else 0
            })
    
    return jsonify({'batches': result})

@app.route('/api/batch/<batch_id>', methods=['GET'])
def get_batch(batch_id):
    if batch_id not in batches:
        return jsonify({'error': '批次不存在'}), 404
    
    batch = batches[batch_id]
    return jsonify({
        'batch_id': batch['batch_id'],
        'filename': batch['filename'],
        'upload_time': batch['upload_time'],
        'status': batch['status'],
        'owner': batch['owner'],
        'total_rows': batch['total_rows'],
        'mapped_fields': batch['mapped_fields'],
        'validation': batch['validation_result'],
        'imported_count': len(batch['imported_data']) if batch['imported_data'] else 0
    })

@app.route('/api/batch/<batch_id>/export', methods=['GET'])
def export_batch(batch_id):
    if batch_id not in batches:
        return jsonify({'error': '批次不存在'}), 404
    
    batch = batches[batch_id]
    exporter = ReportExporter()
    
    output_path = os.path.join(BATCHES_FOLDER, f"{batch_id}_report.xlsx")
    exporter.generate_report(batch, output_path)
    
    return send_file(output_path, as_attachment=True, 
                     download_name=f"导入批次报告_{batch['filename']}_{datetime.now().strftime('%Y%m%d')}.xlsx")

@app.route('/api/batch/<batch_id>/fix', methods=['POST'])
def apply_fix(batch_id):
    if batch_id not in batches:
        return jsonify({'error': '批次不存在'}), 404
    
    data = request.json
    row_index = data.get('row_index')
    fixes = data.get('fixes', {})
    
    batch = batches[batch_id]
    
    if row_index is None or row_index >= len(batch['raw_data']):
        return jsonify({'error': '行索引无效'}), 400
    
    for field, value in fixes.items():
        batch['raw_data'][row_index][field] = value
    
    df = pd.DataFrame(batch['raw_data'])
    field_mapper = FieldMapper()
    mapped_fields = field_mapper.map_fields(df.columns.tolist())
    validator = DataValidator()
    validation_result = validator.validate_dataframe(df, mapped_fields)
    batch['validation_result'] = validation_result
    
    return jsonify({
        'success': True,
        'validation': validation_result
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
