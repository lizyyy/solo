import os
import json
from datetime import datetime
from flask import Flask, request, jsonify, render_template, send_file, make_response
import sqlite3
import hashlib

from database import get_db, init_db, reset_db
from csv_importer import CSVImporter
from rules_engine import RulesEngine

app = Flask(__name__)
app.config['SECRET_KEY'] = 'mold-guardian-secret-key-2024'

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/import/csv', methods=['POST'])
def import_csv():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    file_type = request.form.get('type', '').lower()
    
    filepath = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(filepath)
    
    importer = CSVImporter()
    
    try:
        if '砂型工单' in file.filename or file_type == 'sand_mold_orders':
            result = importer.import_sand_mold_orders(filepath)
        elif '烘干炉温度' in file.filename or file_type == 'oven_temperature':
            result = importer.import_oven_temperature_logs(filepath)
        elif '水分抽检' in file.filename or file_type == 'moisture':
            result = importer.import_moisture_inspections(filepath)
        elif '浇注排程' in file.filename or file_type == 'pouring':
            result = importer.import_pouring_schedules(filepath)
        elif '质检备注' in file.filename or file_type == 'quality':
            result = importer.import_quality_notes(filepath)
        else:
            return jsonify({'error': 'Unknown file type. Please specify type or include keyword in filename.'}), 400
        
        return jsonify({'success': True, 'result': result})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/import/all', methods=['POST'])
def import_all():
    directory = request.form.get('directory', UPLOAD_FOLDER)
    
    if not os.path.exists(directory):
        return jsonify({'error': f'Directory not found: {directory}'}), 400
    
    importer = CSVImporter()
    results = importer.import_all(directory)
    
    return jsonify({'success': True, 'results': results})

@app.route('/api/rules/run', methods=['POST'])
def run_rules():
    engine = RulesEngine()
    violations = engine.run_all_rules()
    result = engine.save_results(violations)
    
    return jsonify({
        'success': True,
        'total_violations': result['total_violations'],
        'by_rule_type': result['by_rule_type']
    })

@app.route('/api/results', methods=['GET'])
def get_results():
    conn = get_db()
    cursor = conn.cursor()
    
    mold_no = request.args.get('mold_no')
    rule_type = request.args.get('rule_type')
    severity = request.args.get('severity')
    
    query = '''
        SELECT r.id, r.mold_no, r.rule_type, r.rule_name, r.is_violation, 
               r.severity, r.description, r.check_time,
               rv.review_note, rv.new_verdict, rv.reviewer, rv.review_time
        FROM rule_results r
        LEFT JOIN review_records rv ON r.id = rv.result_id
        WHERE 1=1
    '''
    params = []
    
    if mold_no:
        query += ' AND r.mold_no = ?'
        params.append(mold_no)
    if rule_type:
        query += ' AND r.rule_type = ?'
        params.append(rule_type)
    if severity:
        query += ' AND r.severity = ?'
        params.append(severity)
    
    query += ' ORDER BY r.severity DESC, r.check_time DESC'
    
    cursor.execute(query, params)
    
    results = []
    for row in cursor.fetchall():
        results.append({
            'id': row[0],
            'mold_no': row[1],
            'rule_type': row[2],
            'rule_name': row[3],
            'is_violation': row[4],
            'severity': row[5],
            'description': row[6],
            'check_time': row[7],
            'review_note': row[8],
            'new_verdict': row[9],
            'reviewer': row[10],
            'review_time': row[11]
        })
    
    conn.close()
    return jsonify({'success': True, 'results': results, 'count': len(results)})

@app.route('/api/review', methods=['POST'])
def submit_review():
    data = request.get_json()
    
    result_id = data.get('result_id')
    mold_no = data.get('mold_no')
    original_verdict = data.get('original_verdict', 'violation')
    new_verdict = data.get('new_verdict')
    review_note = data.get('review_note', '')
    reviewer = data.get('reviewer', '班长')
    
    if not result_id or not new_verdict:
        return jsonify({'error': 'Missing required fields'}), 400
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO review_records 
        (result_id, mold_no, original_verdict, new_verdict, review_note, reviewer)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (result_id, mold_no, original_verdict, new_verdict, review_note, reviewer))
    
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'message': 'Review saved'})

@app.route('/api/export/markdown', methods=['GET'])
def export_markdown():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT r.id, r.mold_no, r.rule_type, r.rule_name, r.severity, 
               r.description, r.check_time,
               rv.review_note, rv.new_verdict, rv.reviewer, rv.review_time
        FROM rule_results r
        LEFT JOIN review_records rv ON r.id = rv.result_id
        ORDER BY r.severity DESC, r.mold_no
    ''')
    
    results = cursor.fetchall()
    
    md_content = '# 砂型开浇守门员 - 交班单\n\n'
    md_content += f'**生成时间**: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}\n\n'
    md_content += '---\n\n'
    
    severity_count = {'high': 0, 'medium': 0, 'low': 0}
    by_rule = {}
    
    for row in results:
        severity = row[4]
        rule_type = row[2]
        severity_count[severity] = severity_count.get(severity, 0) + 1
        by_rule[rule_type] = by_rule.get(rule_type, 0) + 1
    
    md_content += '## 统计概览\n\n'
    md_content += f'- **高优先级**: {severity_count["high"]} 项\n'
    md_content += f'- **中优先级**: {severity_count["medium"]} 项\n'
    md_content += f'- **低优先级**: {severity_count.get("low", 0)} 项\n\n'
    md_content += '---\n\n'
    
    for severity_name, severity_key in [('高优先级问题', 'high'), ('中优先级问题', 'medium'), ('低优先级问题', 'low')]:
        severity_results = [r for r in results if r[4] == severity_key]
        if severity_results:
            md_content += f'## {severity_name}\n\n'
            
            for row in severity_results:
                mold_no = row[1]
                rule_name = row[3]
                description = row[5]
                check_time = row[6]
                review_note = row[7]
                new_verdict = row[8]
                reviewer = row[9]
                review_time = row[10]
                
                md_content += f'### 砂型编号: {mold_no}\n\n'
                md_content += f'- **规则名称**: {rule_name}\n'
                md_content += f'- **问题描述**: {description}\n'
                md_content += f'- **检测时间**: {check_time}\n'
                
                if new_verdict:
                    md_content += f'\n**复核记录**:\n'
                    md_content += f'- **改判结果**: {new_verdict}\n'
                    md_content += f'- **复核人**: {reviewer}\n'
                    md_content += f'- **复核备注**: {review_note}\n'
                    md_content += f'- **复核时间**: {review_time}\n'
                
                md_content += '\n---\n\n'
    
    conn.close()
    
    content_hash = hashlib.md5(md_content.encode()).hexdigest()
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f'交班单_{timestamp}.md'
    
    response = make_response(md_content)
    response.headers['Content-Type'] = 'text/markdown; charset=utf-8'
    response.headers['Content-Disposition'] = f'attachment; filename={filename}'
    
    return response

@app.route('/api/export/json', methods=['GET'])
def export_json():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT r.id, r.mold_no, r.rule_type, r.rule_name, r.is_violation,
               r.severity, r.description, r.raw_data, r.check_time,
               rv.review_note, rv.new_verdict, rv.reviewer, rv.review_time
        FROM rule_results r
        LEFT JOIN review_records rv ON r.id = rv.result_id
        ORDER BY r.severity DESC, r.mold_no
    ''')
    
    columns = [desc[0] for desc in cursor.description]
    results = []
    for row in cursor.fetchall():
        item = dict(zip(columns, row))
        if item.get('raw_data'):
            try:
                item['raw_data'] = json.loads(item['raw_data'])
            except:
                pass
        results.append(item)
    
    conn.close()
    
    export_data = {
        'export_time': datetime.now().isoformat(),
        'version': '1.0',
        'total_count': len(results),
        'results': results
    }
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f'规则检测明细_{timestamp}.json'
    
    response = make_response(json.dumps(export_data, ensure_ascii=False, indent=2))
    response.headers['Content-Type'] = 'application/json; charset=utf-8'
    response.headers['Content-Disposition'] = f'attachment; filename={filename}'
    
    return response

@app.route('/api/stats', methods=['GET'])
def get_stats():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT COUNT(*) FROM sand_mold_orders')
    mold_count = cursor.fetchone()[0]
    
    cursor.execute('SELECT COUNT(*) FROM rule_results WHERE is_violation = 1')
    violation_count = cursor.fetchone()[0]
    
    cursor.execute('SELECT COUNT(*) FROM review_records')
    review_count = cursor.fetchone()[0]
    
    cursor.execute('''
        SELECT rule_type, COUNT(*) 
        FROM rule_results 
        WHERE is_violation = 1 
        GROUP BY rule_type
    ''')
    by_rule = dict(cursor.fetchall())
    
    cursor.execute('''
        SELECT severity, COUNT(*) 
        FROM rule_results 
        WHERE is_violation = 1 
        GROUP BY severity
    ''')
    by_severity = dict(cursor.fetchall())
    
    conn.close()
    
    return jsonify({
        'success': True,
        'stats': {
            'total_molds': mold_count,
            'total_violations': violation_count,
            'total_reviews': review_count,
            'by_rule_type': by_rule,
            'by_severity': by_severity
        }
    })

@app.route('/api/import/sample', methods=['POST'])
def import_sample():
    sample_dir = os.path.join(os.path.dirname(__file__), 'samples')
    
    if not os.path.exists(sample_dir):
        return jsonify({'error': 'Sample directory not found'}), 400
    
    reset_db()
    init_db()
    
    importer = CSVImporter()
    results = importer.import_all(sample_dir)
    
    engine = RulesEngine()
    violations = engine.run_all_rules()
    rule_result = engine.save_results(violations)
    
    return jsonify({
        'success': True,
        'import_results': results,
        'rule_results': rule_result
    })

if __name__ == '__main__':
    init_db()
    app.run(debug=True, host='0.0.0.0', port=5000)
