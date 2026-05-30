import os
import json
import csv
from datetime import datetime
from flask import Flask, request, jsonify
from config import Config
from models import db, init_db, Athlete, Run, TrackPoint, HeartRateRecord, Segment, Anomaly, AnalysisReport
from analysis import RunAnalyzer

app = Flask(__name__)
app.config.from_object(Config)
db.init_app(app)

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['REPORT_FOLDER'], exist_ok=True)
os.makedirs(app.config['CHART_FOLDER'], exist_ok=True)

with app.app_context():
    init_db(app)

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'ok',
        'timestamp': datetime.utcnow().isoformat(),
        'database': 'connected'
    })

@app.route('/api/athletes', methods=['GET'])
def get_athletes():
    athletes = Athlete.query.all()
    return jsonify([a.to_dict() for a in athletes])

@app.route('/api/athletes', methods=['POST'])
def create_athlete():
    data = request.get_json()
    athlete = Athlete(
        name=data.get('name'),
        gender=data.get('gender'),
        age=data.get('age'),
        weight=data.get('weight'),
        max_hr=data.get('max_hr'),
        threshold_pace=data.get('threshold_pace')
    )
    db.session.add(athlete)
    db.session.commit()
    return jsonify(athlete.to_dict()), 201

@app.route('/api/athletes/<int:athlete_id>', methods=['GET'])
def get_athlete(athlete_id):
    athlete = Athlete.query.get_or_404(athlete_id)
    return jsonify(athlete.to_dict())

@app.route('/api/athletes/<int:athlete_id>/runs', methods=['GET'])
def get_athlete_runs(athlete_id):
    athlete = Athlete.query.get_or_404(athlete_id)
    return jsonify([r.to_dict() for r in athlete.runs])

@app.route('/api/runs', methods=['GET'])
def get_runs():
    runs = Run.query.order_by(Run.start_time.desc()).all()
    return jsonify([r.to_dict() for r in runs])

@app.route('/api/runs/<int:run_id>', methods=['GET'])
def get_run(run_id):
    run = Run.query.get_or_404(run_id)
    return jsonify(run.to_dict(include_related=True))

@app.route('/api/runs/<int:run_id>/segments', methods=['GET'])
def get_run_segments(run_id):
    run = Run.query.get_or_404(run_id)
    return jsonify([s.to_dict() for s in run.segments])

@app.route('/api/runs/<int:run_id>/anomalies', methods=['GET'])
def get_run_anomalies(run_id):
    run = Run.query.get_or_404(run_id)
    return jsonify([a.to_dict() for a in run.anomalies])

@app.route('/api/runs/<int:run_id>/report', methods=['GET'])
def get_run_report(run_id):
    report = AnalysisReport.query.filter_by(run_id=run_id).first()
    if report:
        return jsonify(report.to_dict())
    return jsonify({'error': 'Report not found'}), 404

@app.route('/api/runs/import', methods=['POST'])
def import_run():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    athlete_id = request.form.get('athlete_id', type=int)
    if athlete_id:
        athlete = Athlete.query.get(athlete_id)
    else:
        athlete_name = request.form.get('athlete_name', 'Unknown')
        athlete = Athlete.query.filter_by(name=athlete_name).first()
        if not athlete:
            athlete = Athlete(name=athlete_name)
            db.session.add(athlete)
            db.session.flush()

    title = request.form.get('title', f'Imported Run - {datetime.utcnow().strftime("%Y-%m-%d")}')

    content = file.read().decode('utf-8')

    run = Run(
        athlete_id=athlete.id,
        title=title,
        start_time=datetime.utcnow(),
        status='imported',
        source_file=file.filename
    )
    db.session.add(run)
    db.session.flush()

    track_points = []
    hr_records = []
    
    try:
        lines = content.strip().split('\n')
        reader = csv.DictReader(lines)
        
        for row in reader:
            try:
                try:
                    timestamp_str = row.get('timestamp')
                    if timestamp_str:
                        timestamp = datetime.fromisoformat(timestamp_str)
                    else:
                        timestamp = datetime.utcnow()
                except:
                    timestamp = datetime.utcnow()

                distance = float(row.get('distance', 0)) if row.get('distance') else 0.0
                altitude = float(row.get('altitude', 0)) if row.get('altitude') else 0.0
                grade = float(row.get('grade', 0)) if row.get('grade') else 0.0
                speed = float(row.get('speed', 0)) if row.get('speed') else 0.0
                
                heart_rate = None
                if row.get('heart_rate'):
                    try:
                        heart_rate = int(float(row['heart_rate']))
                    except:
                        pass
                
                cadence = None
                if row.get('cadence'):
                    try:
                        cadence = int(float(row['cadence']))
                    except:
                        pass

                tp = TrackPoint(
                    run_id=run.id,
                    timestamp=timestamp,
                    distance=distance,
                    altitude=altitude,
                    grade=grade,
                    speed=speed,
                    heart_rate=heart_rate,
                    cadence=cadence
                )
                track_points.append(tp)

                if heart_rate:
                    hr = HeartRateRecord(
                        run_id=run.id,
                        timestamp=timestamp,
                        heart_rate=heart_rate,
                        source='gps'
                    )
                    hr_records.append(hr)
            
            except Exception as e:
                continue

    except Exception as e:
        return jsonify({'error': f'Error parsing file: {str(e)}'}), 400

    db.session.bulk_save_objects(track_points)
    db.session.bulk_save_objects(hr_records)

    if track_points:
        run.total_distance = max(tp.distance for tp in track_points)
        run.start_time = track_points[0].timestamp
        run.end_time = track_points[-1].timestamp
        run.total_duration = (run.end_time - run.start_time).total_seconds()

    db.session.commit()

    return jsonify({
        'run_id': run.id,
        'athlete_id': athlete.id,
        'track_points_count': len(track_points),
        'hr_records_count': len(hr_records),
        'status': 'imported'
    }), 201

@app.route('/api/runs/<int:run_id>/analyze', methods=['POST'])
def analyze_run(run_id):
    run = Run.query.get_or_404(run_id)
    
    analyzer = RunAnalyzer(run_id)
    if not analyzer.load_data():
        return jsonify({'error': 'No track points found'}), 400
    
    analyzer.calculate_segments()
    analyzer.detect_anomalies()
    result = analyzer.save_all()
    
    return jsonify({
        'run_id': run_id,
        **result
    })

@app.route('/api/runs/<int:run_id>/coach-notes', methods=['PUT'])
def update_coach_notes(run_id):
    run = Run.query.get_or_404(run_id)
    data = request.get_json()
    run.coach_notes = data.get('notes')
    db.session.commit()
    return jsonify({'status': 'ok', 'coach_notes': run.coach_notes})

@app.route('/api/anomalies/<int:anomaly_id>/confirm', methods=['POST'])
def confirm_anomaly(anomaly_id):
    anomaly = Anomaly.query.get_or_404(anomaly_id)
    data = request.get_json() or {}
    anomaly.is_confirmed = True
    anomaly.confirmed_by = data.get('confirmed_by', 'coach')
    anomaly.confirmed_at = datetime.utcnow()
    db.session.commit()
    return jsonify(anomaly.to_dict())

@app.route('/api/runs/<int:run_id>/export', methods=['GET'])
def export_run(run_id):
    run = Run.query.get_or_404(run_id)

    segments = Segment.query.filter_by(run_id=run_id).order_by(Segment.segment_number).all()
    anomalies = Anomaly.query.filter_by(run_id=run_id).all()
    report = AnalysisReport.query.filter_by(run_id=run_id).first()

    export_data = {
        'run': run.to_dict(),
        'segments': [s.to_dict() for s in segments],
        'anomalies': [a.to_dict() for a in anomalies],
        'report': report.to_dict() if report else None
    }

    response = jsonify(export_data)
    response.headers['Content-Disposition'] = f'attachment; filename="run_{run_id}_analysis.json'
    return response

@app.route('/api/anomalies', methods=['GET'])
def get_all_anomalies():
    anomaly_type = request.args.get('type')
    severity = request.args.get('severity')
    confirmed = request.args.get('confirmed')
    
    query = Anomaly.query
    
    if anomaly_type:
        query = query.filter_by(anomaly_type=anomaly_type)
    if severity:
        query = query.filter_by(severity=severity)
    if confirmed is not None:
        query = query.filter_by(is_confirmed=(confirmed.lower() == 'true'))
    
    anomalies = query.order_by(Anomaly.created_at.desc()).all()
    return jsonify([a.to_dict() for a in anomalies])

@app.route('/api/reports', methods=['GET'])
def get_reports():
    reports = AnalysisReport.query.order_by(AnalysisReport.generated_at.desc()).all()
    return jsonify([r.to_dict() for r in reports])

@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def server_error(e):
    return jsonify({'error': 'Server error', 'message': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
