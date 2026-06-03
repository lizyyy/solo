from flask import Flask, render_template, request, jsonify, send_from_directory
import csv
import io
from models import Database, RecordStatus

app = Flask(__name__)
db = Database()


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/records', methods=['GET'])
def get_records():
    status = request.args.get('status')
    status_enum = RecordStatus(status) if status else None
    records = db.get_records(status=status_enum)
    return jsonify(records)


@app.route('/api/records/<int:record_id>', methods=['GET'])
def get_record(record_id):
    record = db.get_record(record_id)
    if not record:
        return jsonify({"error": "Record not found"}), 404
    history = db.get_history(record_id)
    return jsonify({"record": record, "history": history})


@app.route('/api/records/<int:record_id>/history', methods=['GET'])
def get_history(record_id):
    history = db.get_history(record_id)
    return jsonify(history)


@app.route('/api/import', methods=['POST'])
def import_records():
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files['file']
    source_file = file.filename or "unknown.csv"
    imported_by = request.form.get('imported_by', 'system')

    if file.filename.endswith('.csv'):
        stream = io.StringIO(file.stream.read().decode("UTF8"), newline=None)
        reader = csv.DictReader(stream)
        records = []
        for row in reader:
            rec = {
                "photo_number": row.get('photo_number', '').strip(),
                "latitude": float(row['latitude']) if row.get('latitude') else None,
                "longitude": float(row['longitude']) if row.get('longitude') else None,
                "metric_x": float(row['metric_x']) if row.get('metric_x') else None,
                "metric_y": float(row['metric_y']) if row.get('metric_y') else None,
                "cad_layer_name": row.get('cad_layer_name', '').strip() or None,
                "bracket_number": row.get('bracket_number', '').strip() or None,
                "field_note": row.get('field_note', '').strip()
            }
            records.append(rec)
    else:
        return jsonify({"error": "Only CSV files supported"}), 400

    results = db.import_records(records, source_file, imported_by)
    return jsonify(results)


@app.route('/api/records/<int:record_id>/cad', methods=['PUT'])
def update_cad(record_id):
    data = request.json
    cad_layer_name = data.get('cad_layer_name', '')
    updated_by = data.get('updated_by', 'anonymous')
    reason = data.get('reason', 'cad_review')

    success = db.update_cad_layer(record_id, cad_layer_name, updated_by, reason)
    return jsonify({"success": success})


@app.route('/api/records/<int:record_id>/note', methods=['PUT'])
def update_note(record_id):
    data = request.json
    field_note = data.get('field_note', '')
    updated_by = data.get('updated_by', 'anonymous')
    reason = data.get('reason', 'note_update')

    success = db.update_field_note(record_id, field_note, updated_by, reason)
    return jsonify({"success": success})


@app.route('/api/records/<int:record_id>/confirm', methods=['PUT'])
def confirm_record(record_id):
    data = request.json
    confirmed_by = data.get('confirmed_by', 'anonymous')
    success = db.confirm_record(record_id, confirmed_by)
    return jsonify({"success": success})


@app.route('/api/records/<int:record_id>/rollback', methods=['PUT'])
def rollback_record(record_id):
    data = request.json
    target_status = data.get('target_status')
    rolled_by = data.get('rolled_by', 'anonymous')
    reason = data.get('reason', 'manual_rollback')

    try:
        status_enum = RecordStatus(target_status)
    except ValueError:
        return jsonify({"error": "Invalid status"}), 400

    success = db.rollback_status(record_id, status_enum, rolled_by, reason)
    return jsonify({"success": success})


@app.route('/api/summary', methods=['GET'])
def get_summary():
    summary = db.get_field_summary()
    return jsonify(summary)


@app.route('/api/field-view', methods=['GET'])
def get_field_view():
    data = db.get_field_team_view()
    return jsonify(data)


if __name__ == '__main__':
    app.run(debug=True, port=5000)
