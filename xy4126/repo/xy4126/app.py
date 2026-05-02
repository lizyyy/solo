import os
from datetime import datetime
from flask import (
    Flask,
    render_template,
    request,
    redirect,
    url_for,
    jsonify,
    send_file,
    flash,
    session,
    g,
)
from werkzeug.utils import secure_filename
from io import StringIO, BytesIO
import csv
import json

from config import (
    SECRET_KEY,
    UPLOAD_FOLDER,
    SESSION_FOLDER,
    SAMPLE_DATA_FOLDER,
    ALLOWED_EXTENSIONS,
    create_directories,
)
from models import (
    Session,
    CollectionItem,
    Box,
    Seal,
    EnvironmentRecord,
    Photo,
    SignRecord,
    ValidationIssue,
    ReviewNote,
    HandoverChain,
    IssueSeverity,
    IssueType,
    ReviewStatus,
)
from parsers import (
    CollectionListParser,
    BoxSealParser,
    SignRecordParser,
    EnvironmentRecordParser,
    PhotoListParser,
    CSVParseError,
    JSONParseError,
)
from validators import ValidationEngine
from storage import SessionStore, SessionStorageError
from reports import (
    MarkdownReportGenerator,
    CSVReportGenerator,
    JSONReportGenerator,
)

create_directories()

app = Flask(__name__)
app.config['SECRET_KEY'] = SECRET_KEY
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024

session_store = SessionStore(SESSION_FOLDER)
validation_engine = ValidationEngine()


def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.before_request
def before_request():
    g.current_session_id = session.get('current_session_id')


@app.route('/')
def index():
    sessions = session_store.list_sessions()
    return render_template('index.html', sessions=sessions)


@app.route('/session/create', methods=['GET', 'POST'])
def create_session():
    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        description = request.form.get('description', '').strip()
        
        if not name:
            flash('请输入会话名称', 'error')
            return redirect(url_for('create_session'))
        
        try:
            new_session = session_store.create_session(name, description)
            session['current_session_id'] = new_session.session_id
            flash('会话创建成功', 'success')
            return redirect(url_for('session_detail', session_id=new_session.session_id))
        except SessionStorageError as e:
            flash(f'创建会话失败: {str(e)}', 'error')
            return redirect(url_for('create_session'))
    
    return render_template('create_session.html')


@app.route('/session/<session_id>')
def session_detail(session_id):
    try:
        current_session = session_store.load_session(session_id)
        if not current_session:
            flash('会话不存在', 'error')
            return redirect(url_for('index'))
        
        session['current_session_id'] = session_id
        
        issues_by_severity = {
            'critical': [],
            'warning': [],
            'info': [],
        }
        
        for issue in current_session.issues.values():
            sev = issue.severity.value if issue.severity else 'info'
            issues_by_severity[sev].append(issue)
        
        stats = {
            'item_count': len(current_session.items),
            'box_count': len(current_session.boxes),
            'seal_count': len(current_session.seals),
            'env_record_count': len(current_session.env_records),
            'photo_count': len(current_session.photos),
            'sign_count': len(current_session.sign_records),
            'critical_issues': len(issues_by_severity['critical']),
            'warning_issues': len(issues_by_severity['warning']),
            'info_issues': len(issues_by_severity['info']),
        }
        
        return render_template(
            'session_detail.html',
            session=current_session,
            stats=stats,
            issues_by_severity=issues_by_severity,
        )
    except SessionStorageError as e:
        flash(f'加载会话失败: {str(e)}', 'error')
        return redirect(url_for('index'))


@app.route('/session/<session_id>/delete', methods=['POST'])
def delete_session(session_id):
    try:
        if session_store.delete_session(session_id):
            if session.get('current_session_id') == session_id:
                session.pop('current_session_id', None)
            flash('会话已删除', 'success')
        else:
            flash('会话不存在', 'error')
    except SessionStorageError as e:
        flash(f'删除会话失败: {str(e)}', 'error')
    
    return redirect(url_for('index'))


@app.route('/session/<session_id>/upload', methods=['GET', 'POST'])
def upload_files(session_id):
    try:
        current_session = session_store.load_session(session_id)
        if not current_session:
            flash('会话不存在', 'error')
            return redirect(url_for('index'))
        
        if request.method == 'POST':
            file_type = request.form.get('file_type')
            uploaded_file = request.files.get('file')
            
            if not uploaded_file or uploaded_file.filename == '':
                flash('请选择文件', 'error')
                return redirect(url_for('upload_files', session_id=session_id))
            
            if not allowed_file(uploaded_file.filename):
                flash(f'不支持的文件格式，支持: {", ".join(ALLOWED_EXTENSIONS)}', 'error')
                return redirect(url_for('upload_files', session_id=session_id))
            
            try:
                content = uploaded_file.read().decode('utf-8')
            except UnicodeDecodeError:
                try:
                    content = uploaded_file.read().decode('gbk')
                except:
                    flash('文件编码错误，请使用 UTF-8 或 GBK 编码', 'error')
                    return redirect(url_for('upload_files', session_id=session_id))
            
            try:
                if file_type == 'collection_list':
                    parser = CollectionListParser()
                    items = parser.parse(content)
                    for item in items:
                        current_session.items[item.item_id] = item
                    flash(f'成功导入 {len(items)} 条藏品记录', 'success')
                
                elif file_type == 'box_seal':
                    parser = BoxSealParser()
                    result = parser.parse(content)
                    for box_id, box in result['boxes'].items():
                        current_session.boxes[box_id] = box
                    for seal_id, seal in result['seals'].items():
                        current_session.seals[seal_id] = seal
                    flash(f'成功导入 {len(result["boxes"])} 个箱子，{len(result["seals"])} 个封签', 'success')
                
                elif file_type == 'env_records':
                    parser = EnvironmentRecordParser()
                    records = parser.parse(content)
                    for record in records:
                        current_session.env_records[record.record_id] = record
                    flash(f'成功导入 {len(records)} 条环境记录', 'success')
                
                elif file_type == 'photos':
                    parser = PhotoListParser()
                    photos = parser.parse(content)
                    for photo in photos:
                        current_session.photos[photo.photo_id] = photo
                    flash(f'成功导入 {len(photos)} 条照片记录', 'success')
                
                elif file_type == 'sign_records':
                    parser = SignRecordParser()
                    records = parser.parse(content)
                    for record in records:
                        current_session.sign_records[record.sign_id] = record
                    flash(f'成功导入 {len(records)} 条签收记录', 'success')
                
                else:
                    flash('未知的文件类型', 'error')
                    return redirect(url_for('upload_files', session_id=session_id))
                
                session_store.save_session(current_session)
                return redirect(url_for('session_detail', session_id=session_id))
            
            except (CSVParseError, JSONParseError) as e:
                flash(f'解析文件失败: {str(e)}', 'error')
                return redirect(url_for('upload_files', session_id=session_id))
        
        return render_template('upload.html', session=current_session)
    
    except SessionStorageError as e:
        flash(f'加载会话失败: {str(e)}', 'error')
        return redirect(url_for('index'))


@app.route('/session/<session_id>/validate', methods=['POST'])
def validate_session(session_id):
    try:
        current_session = session_store.load_session(session_id)
        if not current_session:
            flash('会话不存在', 'error')
            return redirect(url_for('index'))
        
        current_session.issues = {}
        
        issues = validation_engine.validate_all(
            items=current_session.items,
            boxes=current_session.boxes,
            seals=current_session.seals,
            env_records=current_session.env_records,
            photos=current_session.photos,
            sign_records=current_session.sign_records,
        )
        
        for issue in issues:
            current_session.issues[issue.issue_id] = issue
        
        current_session.handover_chains = {}
        for item_id, item in current_session.items.items():
            if item.box_id and item.box_id in current_session.boxes:
                chain_id = f"chain_{item_id}"
                
                box = current_session.boxes[item.box_id]
                
                seal_chain = []
                for seal_id in box.seal_ids:
                    if seal_id in current_session.seals:
                        seal_chain.append(current_session.seals[seal_id])
                
                env_records = []
                for record in current_session.env_records.values():
                    if record.box_id == item.box_id:
                        env_records.append(record)
                
                photos = []
                for photo in current_session.photos.values():
                    if photo.item_id == item_id or photo.box_id == item.box_id:
                        photos.append(photo)
                
                sign_records = []
                for sign in current_session.sign_records.values():
                    if sign.item_id == item_id or sign.box_id == item.box_id:
                        sign_records.append(sign)
                
                related_issues = []
                for issue in current_session.issues.values():
                    if item_id in issue.affected_items or item.box_id in issue.affected_boxes:
                        related_issues.append(issue)
                
                chain = HandoverChain(
                    chain_id=chain_id,
                    item_id=item_id,
                    item_name=item.name,
                    box_id=item.box_id,
                    seal_chain=seal_chain,
                    env_records=env_records,
                    photos=photos,
                    sign_records=sign_records,
                    issues=related_issues,
                )
                current_session.handover_chains[chain_id] = chain
        
        session_store.save_session(current_session)
        
        critical_count = sum(1 for i in issues if i.severity == IssueSeverity.CRITICAL)
        warning_count = sum(1 for i in issues if i.severity == IssueSeverity.WARNING)
        info_count = sum(1 for i in issues if i.severity == IssueSeverity.INFO)
        
        flash(f'校验完成: 发现 {critical_count} 个严重问题，{warning_count} 个警告，{info_count} 个提示', 
              'success' if critical_count == 0 else 'warning')
        
        return redirect(url_for('session_detail', session_id=session_id))
    
    except SessionStorageError as e:
        flash(f'处理会话失败: {str(e)}', 'error')
        return redirect(url_for('index'))


@app.route('/session/<session_id>/issue/<issue_id>/review', methods=['GET', 'POST'])
def review_issue(session_id, issue_id):
    try:
        current_session = session_store.load_session(session_id)
        if not current_session:
            flash('会话不存在', 'error')
            return redirect(url_for('index'))
        
        if issue_id not in current_session.issues:
            flash('问题不存在', 'error')
            return redirect(url_for('session_detail', session_id=session_id))
        
        issue = current_session.issues[issue_id]
        
        if request.method == 'POST':
            note_content = request.form.get('note', '').strip()
            new_status = request.form.get('status')
            
            if not note_content and not new_status:
                flash('请输入备注或选择状态', 'error')
                return redirect(url_for('review_issue', session_id=session_id, issue_id=issue_id))
            
            status_change = None
            if new_status:
                try:
                    status_change = ReviewStatus(new_status)
                    issue.review_status = status_change
                except ValueError:
                    flash('无效的状态值', 'error')
                    return redirect(url_for('review_issue', session_id=session_id, issue_id=issue_id))
            
            if note_content:
                from uuid import uuid4
                note = ReviewNote(
                    note_id=f"note_{uuid4().hex[:8]}",
                    issue_id=issue_id,
                    author=request.form.get('author', '管理员').strip(),
                    content=note_content,
                    status_change=status_change,
                )
                current_session.review_notes[note.note_id] = note
                issue.review_notes.append(note)
            
            session_store.save_session(current_session)
            flash('复核记录已保存', 'success')
            return redirect(url_for('session_detail', session_id=session_id))
        
        return render_template('review_issue.html', session=current_session, issue=issue)
    
    except SessionStorageError as e:
        flash(f'处理会话失败: {str(e)}', 'error')
        return redirect(url_for('index'))


@app.route('/session/<session_id>/export/<format_type>')
def export_report(session_id, format_type):
    try:
        current_session = session_store.load_session(session_id)
        if not current_session:
            flash('会话不存在', 'error')
            return redirect(url_for('index'))
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"交接核对报告_{current_session.name}_{timestamp}"
        
        if format_type == 'markdown':
            generator = MarkdownReportGenerator()
            content = generator.generate(current_session)
            output = BytesIO(content.encode('utf-8'))
            return send_file(
                output,
                mimetype='text/markdown',
                as_attachment=True,
                download_name=f'{filename}.md'
            )
        
        elif format_type == 'csv':
            generator = CSVReportGenerator()
            content = generator.generate(current_session)
            output = BytesIO(content.encode('utf-8-sig'))
            return send_file(
                output,
                mimetype='text/csv',
                as_attachment=True,
                download_name=f'{filename}.csv'
            )
        
        elif format_type == 'json':
            generator = JSONReportGenerator()
            content = generator.generate(current_session)
            output = BytesIO(content.encode('utf-8'))
            return send_file(
                output,
                mimetype='application/json',
                as_attachment=True,
                download_name=f'{filename}.json'
            )
        
        else:
            flash('不支持的导出格式', 'error')
            return redirect(url_for('session_detail', session_id=session_id))
    
    except SessionStorageError as e:
        flash(f'处理会话失败: {str(e)}', 'error')
        return redirect(url_for('index'))


@app.route('/api/session/<session_id>')
def api_session_detail(session_id):
    try:
        current_session = session_store.load_session(session_id)
        if not current_session:
            return jsonify({'error': '会话不存在'}), 404
        
        from storage.session_store import SessionSerializer
        data = SessionSerializer.session_to_dict(current_session)
        return jsonify(data)
    
    except SessionStorageError as e:
        return jsonify({'error': str(e)}), 500


@app.route('/sample-data')
def sample_data():
    samples = []
    
    if os.path.exists(SAMPLE_DATA_FOLDER):
        for filename in os.listdir(SAMPLE_DATA_FOLDER):
            if filename.endswith(('.csv', '.json')):
                filepath = os.path.join(SAMPLE_DATA_FOLDER, filename)
                samples.append({
                    'filename': filename,
                    'size': os.path.getsize(filepath),
                    'modified': datetime.fromtimestamp(os.path.getmtime(filepath)).strftime('%Y-%m-%d %H:%M:%S')
                })
    
    return render_template('sample_data.html', samples=samples)


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
