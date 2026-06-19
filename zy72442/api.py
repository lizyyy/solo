from flask import Flask, jsonify, request, send_from_directory
from app import services
from config import STATUS_LABELS, NEXT_OWNER
import os

app = Flask(__name__, static_folder='static', static_url_path='')

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/api/checklists', methods=['GET'])
def api_list_checklists():
    checklists = services.get_all_checklists()
    for cl in checklists:
        cl['status_label'] = STATUS_LABELS.get(cl['status'], cl['status'])
        cl['next_owner_label'] = NEXT_OWNER.get(cl['next_owner'], cl['next_owner'])
    return jsonify(checklists)

@app.route('/api/checklists/<int:audio_note_id>', methods=['GET'])
def api_get_checklist(audio_note_id):
    note = services.get_audio_note(audio_note_id)
    checklist = services.get_checklist(audio_note_id)
    auth = services.get_authorization_page(audio_note_id)
    records = services.get_rework_records(audio_note_id)
    history = services.get_checklist_history(audio_note_id)
    
    if checklist:
        checklist['status_label'] = STATUS_LABELS.get(checklist['status'], checklist['status'])
        checklist['next_owner_label'] = NEXT_OWNER.get(checklist['next_owner'], checklist['next_owner'])
    
    return jsonify({
        'audio_note': note,
        'checklist': checklist,
        'authorization': auth,
        'rework_records': records,
        'checklist_history': history
    })

@app.route('/api/import', methods=['POST'])
def api_import():
    data = request.json
    note_id = services.import_audio_note(
        data['track_name'],
        data.get('file_path', ''),
        data.get('duration', 0),
        data.get('has_leave_hours', False),
        data.get('leave_hours_count', 0),
        data.get('original_note', ''),
        data['imported_by']
    )
    return jsonify({'audio_note_id': note_id, 'status': 'ok'})

@app.route('/api/auth', methods=['POST'])
def api_add_auth():
    data = request.json
    services.add_authorization_page(
        data['audio_note_id'],
        data['auth_number'],
        data['valid_from'],
        data['valid_to'],
        data.get('page_content', ''),
        data['uploaded_by']
    )
    return jsonify({'status': 'ok'})

@app.route('/api/correct', methods=['POST'])
def api_correct():
    data = request.json
    services.manual_correction(
        data['audio_note_id'],
        data['field'],
        data['old_value'],
        data['new_value'],
        data['reason'],
        data['operator_id']
    )
    return jsonify({'status': 'ok'})

@app.route('/api/rerun', methods=['POST'])
def api_rerun():
    data = request.json
    checklist_id = services.rerun_process(
        data['audio_note_id'],
        data['reason'],
        data['operator_id']
    )
    return jsonify({'checklist_id': checklist_id, 'status': 'ok'})

@app.route('/api/review-complete', methods=['POST'])
def api_review_complete():
    data = request.json
    services.review_complete(
        data['audio_note_id'],
        data['operator_id']
    )
    return jsonify({'status': 'ok'})

@app.route('/api/rework-records', methods=['GET'])
def api_rework_records():
    audio_note_id = request.args.get('audio_note_id', type=int)
    records = services.get_rework_records(audio_note_id)
    return jsonify(records)

@app.route('/api/report', methods=['GET'])
def api_report():
    from flask import make_response
    audio_note_id = request.args.get('audio_note_id', type=int)
    fmt = request.args.get('format', 'text')
    download = request.args.get('download', '0') == '1'
    
    report_content = services.generate_report(audio_note_id, fmt)
    
    if fmt == 'json':
        resp = make_response(report_content)
        resp.headers['Content-Type'] = 'application/json; charset=utf-8'
        if download:
            resp.headers['Content-Disposition'] = 'attachment; filename="rework_report.json"'
        return resp
    else:
        resp = make_response(report_content)
        resp.headers['Content-Type'] = 'text/plain; charset=utf-8'
        if download:
            resp.headers['Content-Disposition'] = 'attachment; filename="rework_report.txt"'
        return resp

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
