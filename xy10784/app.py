from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
import json
import os
from datetime import datetime
import pandas as pd
from io import BytesIO

app = Flask(__name__)
CORS(app)

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
os.makedirs(DATA_DIR, exist_ok=True)

from modules.data_manager import DataManager
from modules.recommendation_engine import RecommendationEngine

dm = DataManager(DATA_DIR)
re = RecommendationEngine(dm)

@app.route('/')
def index():
    return send_file('static/index.html')

@app.route('/api/errors', methods=['GET'])
def get_errors():
    page = int(request.args.get('page', 1))
    page_size = int(request.args.get('page_size', 20))
    status = request.args.get('status', None)
    errors = dm.get_errors(page, page_size, status)
    return jsonify(errors)

@app.route('/api/errors/<error_id>', methods=['GET'])
def get_error_detail(error_id):
    error = dm.get_error_by_id(error_id)
    if error:
        return jsonify(error)
    return jsonify({'error': 'Not found'}), 404

@app.route('/api/errors/<error_id>/rollback', methods=['POST'])
def rollback_error(error_id):
    result = dm.rollback_error(error_id)
    return jsonify(result)

@app.route('/api/errors/<error_id>/fix', methods=['POST'])
def fix_error(error_id):
    data = request.json
    result = dm.fix_error(error_id, data)
    return jsonify(result)

@app.route('/api/batch/import', methods=['POST'])
def batch_import():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    file = request.files['file']
    result = dm.batch_import(file)
    return jsonify(result)

@app.route('/api/batch/compensate', methods=['POST'])
def batch_compensate():
    data = request.json
    error_ids = data.get('error_ids', [])
    result = dm.batch_compensate(error_ids)
    return jsonify(result)

@app.route('/api/export', methods=['GET'])
def export_data():
    format_type = request.args.get('format', 'excel')
    data = dm.get_export_data()
    
    if format_type == 'excel':
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            for sheet_name, df in data.items():
                df.to_excel(writer, sheet_name=sheet_name, index=False)
        output.seek(0)
        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=f'recommendation_debug_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
        )
    return jsonify(data)

@app.route('/api/user-profiles', methods=['GET'])
def get_user_profiles():
    user_id = request.args.get('user_id', None)
    profiles = dm.get_user_profiles(user_id)
    return jsonify(profiles)

@app.route('/api/candidates', methods=['GET'])
def get_candidates():
    error_id = request.args.get('error_id', None)
    candidates = dm.get_candidates(error_id)
    return jsonify(candidates)

@app.route('/api/recommendation-explanations', methods=['GET'])
def get_recommendation_explanations():
    error_id = request.args.get('error_id', None)
    explanations = dm.get_recommendation_explanations(error_id)
    return jsonify(explanations)

@app.route('/api/stats', methods=['GET'])
def get_stats():
    stats = dm.get_statistics()
    return jsonify(stats)

@app.route('/api/generate-sample', methods=['POST'])
def generate_sample():
    try:
        re.generate_sample_data(20)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
