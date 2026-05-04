from flask import Flask, jsonify, request, make_response
from flask_cors import CORS
from datetime import datetime
from typing import Optional, Dict, Any

from database import Database
from monitor import FridgeMonitor
from importer import DataImporter
from reporter import ReportGenerator


def create_app(db: Database, monitor: FridgeMonitor, 
               importer: DataImporter, reporter: ReportGenerator,
               config: Dict[str, Any]) -> Flask:
    app = Flask(__name__)
    CORS(app)
    
    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({
            'status': 'ok',
            'timestamp': datetime.now().isoformat()
        })

    @app.route('/api/status', methods=['GET'])
    def get_status():
        fridge_id = request.args.get('fridge_id')
        statuses = monitor.get_current_status()
        
        if fridge_id:
            statuses = [s for s in statuses if s['fridge_id'] == fridge_id]
        
        return jsonify({
            'success': True,
            'data': statuses,
            'count': len(statuses),
            'timestamp': datetime.now().isoformat()
        })

    @app.route('/api/fridges', methods=['GET'])
    def get_fridges():
        fridges = monitor.get_all_fridges()
        return jsonify({
            'success': True,
            'data': fridges,
            'count': len(fridges)
        })

    @app.route('/api/anomalies', methods=['GET'])
    def get_anomalies():
        fridge_id = request.args.get('fridge_id')
        confirmed_str = request.args.get('confirmed')
        limit = request.args.get('limit', 100, type=int)
        
        confirmed = None
        if confirmed_str is not None:
            confirmed = confirmed_str.lower() in ('true', '1', 'yes')
        
        anomalies = monitor.get_recent_anomalies(
            fridge_id=fridge_id,
            confirmed=confirmed,
            limit=limit
        )
        
        return jsonify({
            'success': True,
            'data': anomalies,
            'count': len(anomalies)
        })

    @app.route('/api/anomalies/<int:anomaly_id>/confirm', methods=['POST'])
    def confirm_anomaly(anomaly_id: int):
        data = request.get_json(silent=True) or {}
        confirmed_by = data.get('confirmed_by', 'unknown')
        notes = data.get('notes', '')
        
        if not confirmed_by or confirmed_by.strip() == '':
            return jsonify({
                'success': False,
                'error': 'confirmed_by is required'
            }), 400
        
        success = monitor.confirm_anomaly(
            anomaly_id=anomaly_id,
            confirmed_by=confirmed_by.strip(),
            notes=notes
        )
        
        if success:
            return jsonify({
                'success': True,
                'message': f'Anomaly {anomaly_id} confirmed'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to confirm anomaly'
            }), 500

    @app.route('/api/anomalies/open', methods=['GET'])
    def get_open_anomalies():
        fridge_id = request.args.get('fridge_id')
        anomalies = db.get_open_anomalies(fridge_id)
        
        for anomaly in anomalies:
            if anomaly['sensor_id'] in monitor.fridges:
                fridge = monitor.fridges[anomaly['sensor_id']]
                anomaly['fridge_name'] = fridge.get('name', anomaly['fridge_id'])
                anomaly['location'] = fridge.get('location', '')
        
        return jsonify({
            'success': True,
            'data': anomalies,
            'count': len(anomalies)
        })

    @app.route('/api/import', methods=['POST'])
    def trigger_import():
        results = importer.import_all()
        
        anomaly_results = monitor.check_and_update_anomalies()
        
        return jsonify({
            'success': True,
            'import': results,
            'anomaly_check': anomaly_results,
            'timestamp': datetime.now().isoformat()
        })

    @app.route('/api/import/status', methods=['GET'])
    def get_import_status():
        last_import = db.get_import_state('last_import_time', '')
        files = db.get_files_to_import() if hasattr(importer, 'get_files_to_import') else []
        
        pending_count = 0
        for f in files:
            if not db.is_file_imported(f):
                pending_count += 1
        
        return jsonify({
            'success': True,
            'last_import_time': last_import,
            'pending_files': pending_count,
            'total_files_in_dir': len(files)
        })

    @app.route('/api/report', methods=['GET'])
    def get_report():
        shift_name = request.args.get('shift', '白班')
        operator = request.args.get('operator', '')
        
        markdown = reporter.generate_report(
            shift_name=shift_name,
            operator=operator
        )
        
        accept_header = request.headers.get('Accept', '')
        
        if 'text/markdown' in accept_header or 'text/plain' in accept_header:
            response = make_response(markdown)
            response.headers['Content-Type'] = 'text/markdown; charset=utf-8'
            response.headers['Content-Disposition'] = f'attachment; filename="交接报告_{datetime.now().strftime("%Y%m%d")}.md"'
            return response
        
        return jsonify({
            'success': True,
            'report': markdown,
            'generated_at': datetime.now().isoformat()
        })

    @app.route('/api/recent/<sensor_id>', methods=['GET'])
    def get_recent_records(sensor_id: str):
        hours = request.args.get('hours', 24, type=int)
        limit = request.args.get('limit', 1000, type=int)
        
        from datetime import timedelta
        
        now = datetime.now()
        start_time = (now - timedelta(hours=hours)).isoformat()
        end_time = now.isoformat()
        
        records = db.get_records_by_time(sensor_id, start_time, end_time)
        
        if len(records) > limit:
            records = records[-limit:]
        
        return jsonify({
            'success': True,
            'sensor_id': sensor_id,
            'data': records,
            'count': len(records),
            'time_range_hours': hours
        })

    @app.route('/api/offline', methods=['GET'])
    def get_offline_sensors():
        offline = monitor.get_offline_sensors()
        return jsonify({
            'success': True,
            'data': offline,
            'count': len(offline)
        })

    @app.route('/api/stats', methods=['GET'])
    def get_stats():
        statuses = monitor.get_current_status()
        
        stats = {
            'total': len(statuses),
            'normal': 0,
            'too_hot': 0,
            'too_cold': 0,
            'offline': 0,
            'no_data': 0,
            'unknown': 0
        }
        
        for s in statuses:
            key = s['status']
            if key in stats:
                stats[key] += 1
            else:
                stats['unknown'] += 1
        
        open_anomalies = db.get_open_anomalies()
        
        return jsonify({
            'success': True,
            'status_summary': stats,
            'open_anomalies_count': len(open_anomalies),
            'timestamp': datetime.now().isoformat()
        })

    return app
