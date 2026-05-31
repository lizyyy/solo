import os
import hashlib
from flask import Flask, request, jsonify, send_from_directory, send_file
from werkzeug.utils import secure_filename
from app.db import init_db, get_db, log_modification, record_exists

app = Flask(__name__, template_folder='templates', static_folder='static')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_SCORES = os.path.join(BASE_DIR, 'uploads', 'scores')
UPLOAD_RECORDINGS = os.path.join(BASE_DIR, 'uploads', 'recordings')
EXPORTS_DIR = os.path.join(BASE_DIR, 'exports')

os.makedirs(UPLOAD_SCORES, exist_ok=True)
os.makedirs(UPLOAD_RECORDINGS, exist_ok=True)
os.makedirs(EXPORTS_DIR, exist_ok=True)

ALLOWED_PDF = {'pdf'}
ALLOWED_AUDIO = {'mp3', 'wav', 'ogg', 'm4a', 'flac'}


def allowed_file(filename, allowed):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed


def file_hash(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            h.update(chunk)
    return h.hexdigest()


@app.route('/')
def index():
    return send_file(os.path.join(BASE_DIR, 'templates', 'index.html'))


@app.route('/api/scores', methods=['GET'])
def list_scores():
    conn = get_db()
    rows = conn.execute(
        "SELECT id, title, voice_part, pdf_path, pdf_hash, uploaded_at, uploaded_by, is_active FROM scores ORDER BY uploaded_at DESC"
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route('/api/scores', methods=['POST'])
def upload_score():
    if 'file' not in request.files:
        return jsonify({'error': '未提供文件'}), 400
    file = request.files['file']
    if file.filename == '' or not allowed_file(file.filename, ALLOWED_PDF):
        return jsonify({'error': '仅支持 PDF 文件'}), 400

    title = request.form.get('title', '').strip()
    voice_part = request.form.get('voice_part', '').strip()
    uploaded_by = request.form.get('uploaded_by', '').strip()
    if not title or not voice_part:
        return jsonify({'error': '曲名和声部为必填'}), 400

    filename = secure_filename(file.filename)
    ts = __import__('time').strftime('%Y%m%d%H%M%S')
    saved_name = f"{ts}_{filename}"
    save_path = os.path.join(UPLOAD_SCORES, saved_name)
    file.save(save_path)
    fhash = file_hash(save_path)

    existing = get_db().execute(
        "SELECT id FROM scores WHERE pdf_hash = ? AND is_active = 1", (fhash,)
    ).fetchone()
    if existing:
        os.remove(save_path)
        return jsonify({'error': f'该PDF已存在（ID: {existing["id"]}），请勿重复上传'}), 409

    conn = get_db()
    cursor = conn.execute(
        "INSERT INTO scores (title, voice_part, pdf_path, pdf_hash, uploaded_by) VALUES (?, ?, ?, ?, ?)",
        (title, voice_part, saved_name, fhash, uploaded_by)
    )
    conn.commit()
    score_id = cursor.lastrowid
    conn.close()
    return jsonify({'id': score_id, 'message': '曲谱上传成功'}), 201


@app.route('/api/scores/<int:score_id>/pdf', methods=['GET'])
def get_score_pdf(score_id):
    conn = get_db()
    row = conn.execute("SELECT pdf_path FROM scores WHERE id = ?", (score_id,)).fetchone()
    conn.close()
    if not row:
        return jsonify({'error': '曲谱不存在'}), 404
    return send_from_directory(UPLOAD_SCORES, row['pdf_path'])


@app.route('/api/checkins', methods=['GET'])
def list_checkins():
    score_id = request.args.get('score_id', type=int)
    status = request.args.get('status', '')
    date = request.args.get('date', '')

    query = """
        SELECT c.*, s.title as score_title, s.pdf_path as score_pdf_path,
               s.voice_part as score_voice_part
        FROM checkins c
        JOIN scores s ON c.score_id = s.id
        WHERE 1=1
    """
    params = []
    if score_id:
        query += " AND c.score_id = ?"
        params.append(score_id)
    if status:
        query += " AND c.status = ?"
        params.append(status)
    if date:
        query += " AND c.checkin_date = ?"
        params.append(date)
    query += " ORDER BY c.checkin_date DESC, c.id DESC"

    conn = get_db()
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route('/api/checkins', methods=['POST'])
def create_checkin():
    data = request.get_json() if request.is_json else request.form.to_dict()
    required = ['score_id', 'student_name', 'voice_part', 'checkin_date']
    for field in required:
        if not data.get(field):
            return jsonify({'error': f'{field} 为必填'}), 400

    if not record_exists('scores', data['score_id']):
        return jsonify({'error': '曲谱不存在'}), 404

    recording_path = data.get('recording_path', '')
    recording_exists = 1 if recording_path and os.path.exists(os.path.join(UPLOAD_RECORDINGS, recording_path)) else 0

    conn = get_db()
    cursor = conn.execute(
        """INSERT INTO checkins (score_id, student_name, voice_part, checkin_date,
           recording_path, recording_exists, manual_confirmed, confirmed_by, confirmed_at,
           remark, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            data['score_id'], data['student_name'], data['voice_part'],
            data['checkin_date'], recording_path, recording_exists,
            int(data.get('manual_confirmed', 0)), data.get('confirmed_by', ''),
            data.get('confirmed_at', ''), data.get('remark', ''),
            data.get('status', 'pending')
        )
    )
    conn.commit()
    checkin_id = cursor.lastrowid
    conn.close()
    return jsonify({'id': checkin_id, 'message': '打卡记录创建成功'}), 201


@app.route('/api/checkins/<int:checkin_id>', methods=['PUT'])
def update_checkin(checkin_id):
    data = request.get_json() if request.is_json else request.form.to_dict()
    reason = data.pop('reason', '')
    operator = data.pop('operator', '')

    conn = get_db()
    old = conn.execute("SELECT * FROM checkins WHERE id = ?", (checkin_id,)).fetchone()
    if not old:
        conn.close()
        return jsonify({'error': '打卡记录不存在'}), 404

    old_dict = dict(old)
    updates = []
    values = []
    change_log = []
    track_fields = ['student_name', 'voice_part', 'checkin_date', 'recording_path',
                    'manual_confirmed', 'confirmed_by', 'confirmed_at', 'remark', 'status']

    for field in track_fields:
        if field in data:
            new_val = data[field]
            if field == 'manual_confirmed':
                new_val = int(new_val)
            old_val = old_dict[field]
            if str(new_val) != str(old_val):
                change_log.append((field, str(old_val), str(new_val)))
                updates.append(f"{field} = ?")
                values.append(new_val)

    if not updates:
        conn.close()
        return jsonify({'message': '无变更'}), 200

    updates.append("updated_at = datetime('now','localtime')")
    values.append(checkin_id)
    conn.execute(f"UPDATE checkins SET {', '.join(updates)} WHERE id = ?", values)
    conn.commit()
    conn.close()
    for field, old_val, new_val in change_log:
        log_modification('checkin', checkin_id, field, old_val, new_val, reason, operator)
    return jsonify({'message': '打卡记录已更新，变更已记录'})


@app.route('/api/checkins/<int:checkin_id>/confirm', methods=['POST'])
def confirm_checkin(checkin_id):
    data = request.get_json() if request.is_json else {}
    confirmed_by = data.get('confirmed_by', '').strip()
    if not confirmed_by:
        return jsonify({'error': '确认人不能为空'}), 400

    conn = get_db()
    old = conn.execute("SELECT manual_confirmed, confirmed_by, confirmed_at, status FROM checkins WHERE id = ?", (checkin_id,)).fetchone()
    if not old:
        conn.close()
        return jsonify({'error': '打卡记录不存在'}), 404

    now = __import__('time').strftime('%Y-%m-%d %H:%M:%S')
    conn.execute(
        "UPDATE checkins SET manual_confirmed = 1, confirmed_by = ?, confirmed_at = ?, status = 'confirmed', updated_at = datetime('now','localtime') WHERE id = ?",
        (confirmed_by, now, checkin_id)
    )
    conn.commit()
    conn.close()
    log_modification('checkin', checkin_id, 'manual_confirmed', str(old['manual_confirmed']), '1', '人工确认', confirmed_by)
    log_modification('checkin', checkin_id, 'status', old['status'], 'confirmed', '人工确认', confirmed_by)
    return jsonify({'message': f'{confirmed_by} 已确认打卡记录'})


@app.route('/api/checkins/<int:checkin_id>/evidence', methods=['GET'])
def get_evidence_chain(checkin_id):
    conn = get_db()
    checkin = conn.execute(
        """SELECT c.*, s.title as score_title, s.pdf_path as score_pdf_path,
                  s.voice_part as score_voice_part, s.pdf_hash
           FROM checkins c JOIN scores s ON c.score_id = s.id WHERE c.id = ?""",
        (checkin_id,)
    ).fetchone()
    if not checkin:
        conn.close()
        return jsonify({'error': '打卡记录不存在'}), 404

    modifications = conn.execute(
        "SELECT * FROM modification_log WHERE target_type = 'checkin' AND target_id = ? ORDER BY created_at",
        (checkin_id,)
    ).fetchall()

    summaries = conn.execute(
        "SELECT * FROM rehearsal_summaries WHERE score_id = ? ORDER BY summary_date DESC",
        (checkin['score_id'],)
    ).fetchall()
    conn.close()

    recording_actual_exists = False
    recording_url = None
    if checkin['recording_path']:
        full_path = os.path.join(UPLOAD_RECORDINGS, checkin['recording_path'])
        recording_actual_exists = os.path.exists(full_path)
        if recording_actual_exists:
            recording_url = f"/api/recordings/{checkin['recording_path']}"

    evidence = {
        'checkin': dict(checkin),
        'score_pdf_url': f"/api/scores/{checkin['score_id']}/pdf",
        'recording_url': recording_url,
        'recording_actual_exists': recording_actual_exists,
        'recording_declared_but_missing': bool(checkin['recording_path']) and not recording_actual_exists,
        'modifications': [dict(m) for m in modifications],
        'rehearsal_summaries': [dict(s) for s in summaries]
    }
    return jsonify(evidence)


@app.route('/api/recordings', methods=['POST'])
def upload_recording():
    if 'file' not in request.files:
        return jsonify({'error': '未提供文件'}), 400
    file = request.files['file']
    if file.filename == '' or not allowed_file(file.filename, ALLOWED_AUDIO):
        return jsonify({'error': '仅支持 mp3/wav/ogg/m4a/flac 格式'}), 400

    filename = secure_filename(file.filename)
    ts = __import__('time').strftime('%Y%m%d%H%M%S')
    saved_name = f"{ts}_{filename}"
    save_path = os.path.join(UPLOAD_RECORDINGS, saved_name)
    file.save(save_path)

    checkin_id = request.form.get('checkin_id', type=int)
    operator = request.form.get('operator', '')
    if checkin_id:
        conn = get_db()
        old = conn.execute("SELECT recording_path FROM checkins WHERE id = ?", (checkin_id,)).fetchone()
        if old:
            old_path = old['recording_path']
            conn.execute(
                "UPDATE checkins SET recording_path = ?, recording_exists = 1, updated_at = datetime('now','localtime') WHERE id = ?",
                (saved_name, checkin_id)
            )
            conn.commit()
            log_modification('checkin', checkin_id, 'recording_path', old_path or '', saved_name, '上传录音', operator)
        conn.close()

    return jsonify({'filename': saved_name, 'message': '录音上传成功'}), 201


@app.route('/api/recordings/<path:filename>', methods=['GET'])
def get_recording(filename):
    return send_from_directory(UPLOAD_RECORDINGS, filename)


@app.route('/api/rehearsal-summaries', methods=['POST'])
def create_rehearsal_summary():
    data = request.get_json() if request.is_json else request.form.to_dict()
    required = ['score_id', 'summary_date', 'content']
    for field in required:
        if not data.get(field):
            return jsonify({'error': f'{field} 为必填'}), 400

    if not record_exists('scores', data['score_id']):
        return jsonify({'error': '曲谱不存在'}), 404

    conn = get_db()
    cursor = conn.execute(
        "INSERT INTO rehearsal_summaries (score_id, summary_date, content, author) VALUES (?, ?, ?, ?)",
        (data['score_id'], data['summary_date'], data['content'], data.get('author', ''))
    )
    conn.commit()
    summary_id = cursor.lastrowid
    conn.close()
    return jsonify({'id': summary_id, 'message': '排练小结创建成功'}), 201


@app.route('/api/rehearsal-summaries', methods=['GET'])
def list_rehearsal_summaries():
    score_id = request.args.get('score_id', type=int)
    conn = get_db()
    if score_id:
        rows = conn.execute(
            "SELECT rs.*, s.title as score_title FROM rehearsal_summaries rs JOIN scores s ON rs.score_id = s.id WHERE rs.score_id = ? ORDER BY rs.summary_date DESC",
            (score_id,)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT rs.*, s.title as score_title FROM rehearsal_summaries rs JOIN scores s ON rs.score_id = s.id ORDER BY rs.summary_date DESC"
        ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route('/api/history', methods=['GET'])
def get_history():
    target_type = request.args.get('target_type', '')
    target_id = request.args.get('target_id', type=int)
    operator = request.args.get('operator', '')

    query = "SELECT * FROM modification_log WHERE 1=1"
    params = []
    if target_type:
        query += " AND target_type = ?"
        params.append(target_type)
    if target_id:
        query += " AND target_id = ?"
        params.append(target_id)
    if operator:
        query += " AND operator = ?"
        params.append(operator)
    query += " ORDER BY created_at DESC LIMIT 200"

    conn = get_db()
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route('/api/report', methods=['GET'])
def get_report():
    from app.engine import generate_report
    score_id = request.args.get('score_id', type=int)
    start_date = request.args.get('start_date', '')
    end_date = request.args.get('end_date', '')
    report = generate_report(score_id=score_id, start_date=start_date, end_date=end_date)
    return jsonify(report)


@app.route('/api/export', methods=['GET'])
def export_report():
    from app.engine import export_csv
    import tempfile
    score_id = request.args.get('score_id', type=int)
    start_date = request.args.get('start_date', '')
    end_date = request.args.get('end_date', '')
    csv_path = export_csv(score_id=score_id, start_date=start_date, end_date=end_date)
    if not csv_path:
        return jsonify({'error': '无数据可导出'}), 404
    return send_file(csv_path, as_attachment=True, download_name=os.path.basename(csv_path), mimetype='text/csv')
