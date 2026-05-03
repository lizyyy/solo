import os
import json
from flask import Flask, render_template, request, jsonify, send_file
from werkzeug.utils import secure_filename
from datetime import datetime

from backend.config import Config
from backend.database import init_db, get_db, rows_to_dict_list
from backend.importer import DataImporter
from backend.services import MealMatcher, CabinCapacityChecker, IssueManager, TimelineGenerator
from backend.exporter import IssueExporter, ManifestReporter

app = Flask(
    __name__,
    template_folder=os.path.join(os.path.dirname(__file__), '..', 'templates'),
    static_folder=os.path.join(os.path.dirname(__file__), '..', 'static')
)

app.config.from_object(Config)

Config.ensure_dirs()
init_db()


def allowed_file(filename):
    allowed_extensions = {'csv', 'yaml', 'yml', 'jsonl', 'json'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions


def get_file_type(filename):
    ext = filename.rsplit('.', 1)[1].lower()
    type_map = {
        'csv': 'flight_orders',
        'yaml': 'seat_rules',
        'yml': 'seat_rules',
        'jsonl': 'kitchen_scans',
        'json': 'loading_confirms'
    }
    return type_map.get(ext, 'unknown')


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/flights', methods=['GET'])
def get_flights():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT f.*, 
                   (SELECT COUNT(*) FROM meal_orders mo WHERE mo.flight_id = f.id) as order_count,
                   (SELECT COUNT(*) FROM issues i WHERE i.flight_id = f.id AND i.is_resolved = 0) as open_issues
            FROM flights f
            ORDER BY f.created_at DESC
        ''')
        flights = rows_to_dict_list(cursor.fetchall())
    return jsonify({'flights': flights})


@app.route('/api/flights/<flight_number>', methods=['GET'])
def get_flight_detail(flight_number):
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM flights WHERE flight_number = ?', (flight_number,))
        flight = cursor.fetchone()
        
        if not flight:
            return jsonify({'error': 'Flight not found'}), 404
        
        flight_id = flight['id']
        
        cursor.execute('''
            SELECT cabin_class, COUNT(*) as count, SUM(quantity) as total_meals
            FROM meal_orders WHERE flight_id = ?
            GROUP BY cabin_class
        ''', (flight_id,))
        orders_by_cabin = rows_to_dict_list(cursor.fetchall())
        
        cursor.execute('''
            SELECT COUNT(*) as count FROM issues 
            WHERE flight_id = ? AND is_resolved = 0
        ''', (flight_id,))
        open_issues = cursor.fetchone()['count']
        
        match_result = MealMatcher.match_meals_for_flight(flight_number)
        aircraft_change = CabinCapacityChecker.check_aircraft_change(flight_number)
        timeline = TimelineGenerator.get_flight_timeline(flight_number)
        issues = IssueManager.get_flight_issues(flight_number)
        notes = IssueManager.get_flight_notes(flight_number)
        
        result = {
            'flight': row_to_dict(flight),
            'orders_by_cabin': orders_by_cabin,
            'open_issues': open_issues,
            'match_result': match_result,
            'aircraft_change': aircraft_change,
            'timeline': timeline,
            'issues': issues,
            'notes': notes
        }
        
        return jsonify(result)


@app.route('/api/import', methods=['POST'])
def import_data():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'File type not allowed'}), 400
    
    file_type = get_file_type(file.filename)
    flight_number = request.form.get('flight_number')
    
    filename = secure_filename(file.filename)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    saved_filename = f"{timestamp}_{filename}"
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], saved_filename)
    file.save(file_path)
    
    result = {}
    
    try:
        if file_type == 'flight_orders':
            result = DataImporter.import_flight_orders_csv(file_path, flight_number)
        elif file_type == 'seat_rules':
            result = DataImporter.import_seat_rules_yaml(file_path)
        elif file_type == 'kitchen_scans':
            result = DataImporter.import_kitchen_scans_jsonl(file_path)
        elif file_type == 'loading_confirms':
            result = DataImporter.import_loading_confirms_json(file_path)
        else:
            result = {'success': False, 'error': 'Unknown file type'}
    except Exception as e:
        result = {'success': False, 'error': str(e)}
    
    result['file_type'] = file_type
    result['saved_filename'] = saved_filename
    
    return jsonify(result)


@app.route('/api/import/samples', methods=['POST'])
def import_samples():
    result = DataImporter.import_all_samples()
    return jsonify(result)


@app.route('/api/flights/<flight_number>/match', methods=['POST'])
def run_matching(flight_number):
    result = MealMatcher.match_meals_for_flight(flight_number)
    return jsonify(result)


@app.route('/api/flights/<flight_number>/check-aircraft', methods=['GET'])
def check_aircraft_change(flight_number):
    result = CabinCapacityChecker.check_aircraft_change(flight_number)
    return jsonify(result)


@app.route('/api/flights/<flight_number>/aircraft-config', methods=['POST'])
def add_aircraft_config(flight_number):
    data = request.get_json()
    
    result = CabinCapacityChecker.add_cabin_config(
        flight_number=flight_number,
        aircraft_registration=data.get('aircraft_registration', ''),
        aircraft_type=data.get('aircraft_type', ''),
        cabin_configs=data.get('cabin_configs', []),
        is_original=data.get('is_original', False),
        change_reason=data.get('change_reason')
    )
    
    return jsonify(result)


@app.route('/api/flights/<flight_number>/timeline', methods=['GET'])
def get_timeline(flight_number):
    timeline = TimelineGenerator.get_flight_timeline(flight_number)
    return jsonify({'timeline': timeline})


@app.route('/api/issues', methods=['POST'])
def create_issue():
    data = request.get_json()
    
    result = IssueManager.create_issue(
        flight_number=data.get('flight_number'),
        issue_type=data.get('issue_type'),
        description=data.get('description'),
        severity=data.get('severity', 'medium'),
        related_order_id=data.get('related_order_id'),
        related_scan_id=data.get('related_scan_id'),
        related_confirm_id=data.get('related_confirm_id')
    )
    
    return jsonify(result)


@app.route('/api/issues/<int:issue_id>/resolve', methods=['POST'])
def resolve_issue(issue_id):
    data = request.get_json()
    
    result = IssueManager.resolve_issue(
        issue_id=issue_id,
        resolution_note=data.get('resolution_note'),
        resolved_by=data.get('resolved_by')
    )
    
    return jsonify(result)


@app.route('/api/flights/<flight_number>/notes', methods=['POST'])
def add_note(flight_number):
    data = request.get_json()
    
    result = IssueManager.add_note(
        flight_number=flight_number,
        note_type=data.get('note_type', 'general'),
        content=data.get('content'),
        related_entity_type=data.get('related_entity_type'),
        related_entity_id=data.get('related_entity_id'),
        created_by=data.get('created_by')
    )
    
    return jsonify(result)


@app.route('/api/export/issues', methods=['GET'])
def export_issues():
    flight_numbers = request.args.getlist('flight_number')
    
    if not flight_numbers:
        flight_numbers = None
    
    output_path = IssueExporter.export_issues_csv(flight_numbers)
    
    return send_file(
        output_path,
        mimetype='text/csv',
        as_attachment=True,
        download_name=os.path.basename(output_path)
    )


@app.route('/api/export/manifest/<flight_number>', methods=['GET'])
def export_manifest(flight_number):
    output_path = ManifestReporter.export_manifest_report(flight_number)
    
    return send_file(
        output_path,
        mimetype='text/markdown',
        as_attachment=True,
        download_name=os.path.basename(output_path)
    )


@app.route('/api/flights/<flight_number>/special-meals', methods=['GET'])
def get_special_meals(flight_number):
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM meal_orders 
            WHERE flight_number = ? AND is_special = 1
            ORDER BY seat_number
        ''', (flight_number,))
        
        special_meals = rows_to_dict_list(cursor.fetchall())
        
        cursor.execute('''
            SELECT * FROM seat_rules 
            WHERE special_meal_allowed IS NOT NULL
        ''')
        rules = rows_to_dict_list(cursor.fetchall())
        
        mismatches = []
        for meal in special_meals:
            seat = meal['seat_number']
            cabin = meal['cabin_class']
            code = meal['special_meal_code']
            
            for rule in rules:
                if rule['cabin_class'] == cabin and rule['special_meal_allowed']:
                    allowed = rule['special_meal_allowed'].split(',')
                    if code and code not in allowed:
                        mismatches.append({
                            'meal': meal,
                            'rule': rule,
                            'issue': f'座位 {seat} 的 {code} 餐食在 {cabin} 舱位不被允许'
                        })
        
        return jsonify({
            'special_meals': special_meals,
            'rules': rules,
            'mismatches': mismatches
        })


def row_to_dict(row):
    if row is None:
        return None
    return {key: row[key] for key in row.keys()}


if __name__ == '__main__':
    app.run(debug=True, port=8080, host='0.0.0.0')
