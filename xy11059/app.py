from flask import Flask, request, jsonify
from models import db, ReplaceRecord
from services.import_service import ImportService
import os

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///smart_lock.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = 'uploads'

db.init_app(app)

with app.app_context():
    db.create_all()

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

@app.route('/api/import/replace', methods=['POST'])
def import_replace_records():
    file = request.files.get('file')
    if not file:
        return jsonify({'error': '未上传文件'}), 400
    
    allow_manual_override = request.form.get('allow_manual_override', 'false').lower() == 'true'
    manual_notes = request.form.get('manual_notes', '')
    
    import_service = ImportService()
    result = import_service.process_import(file, allow_manual_override, manual_notes)
    
    return jsonify(result), 200

@app.route('/api/replace/records', methods=['GET'])
def get_replace_records():
    records = ReplaceRecord.query.all()
    return jsonify([r.to_dict() for r in records])

@app.route('/api/replace/record/<record_id>', methods=['GET'])
def get_replace_record(record_id):
    record = ReplaceRecord.query.filter_by(record_id=record_id).first()
    if not record:
        return jsonify({'error': '记录不存在'}), 404
    return jsonify(record.to_dict())

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
