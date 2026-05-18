from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from datetime import datetime
import os
import pandas as pd
from io import BytesIO
from models import db, RepairRecord
from services import RepairService

app = Flask(__name__)
CORS(app)

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///repair_records.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

with app.app_context():
    db.create_all()

service = RepairService()


@app.route('/api/repair', methods=['POST'])
def create_single_repair():
    data = request.get_json()
    result = service.create_single_record(data)
    return jsonify(result), 201 if result.get('success') else 400


@app.route('/api/repair/batch', methods=['POST'])
def create_batch_repair():
    data = request.get_json()
    records = data.get('records', [])
    result = service.create_batch_records(records)
    return jsonify(result), 201 if result.get('success') else 400


@app.route('/api/repair/<int:record_id>', methods=['GET'])
def get_repair(record_id):
    result = service.get_record(record_id)
    return jsonify(result), 200 if result.get('success') else 404


@app.route('/api/repair/<int:record_id>', methods=['PUT'])
def update_repair(record_id):
    data = request.get_json()
    result = service.update_record(record_id, data)
    return jsonify(result), 200 if result.get('success') else 400


@app.route('/api/repair', methods=['GET'])
def list_repairs():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    result = service.list_records(page, per_page)
    return jsonify(result), 200


@app.route('/api/repair/validate/<int:record_id>', methods=['POST'])
def validate_repair(record_id):
    result = service.validate_and_suggest_materials(record_id)
    return jsonify(result), 200


@app.route('/api/repair/export', methods=['GET'])
def export_repairs():
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    output = service.export_records(start_date, end_date)
    
    return send_file(
        output,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name=f'皮具护理返修记录_{datetime.now().strftime("%Y%m%d")}.xlsx'
    )


@app.route('/api/repair/stats', methods=['GET'])
def get_stats():
    result = service.get_statistics()
    return jsonify(result), 200


if __name__ == '__main__':
    app.run(debug=True, port=5001)