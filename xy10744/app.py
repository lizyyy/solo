from flask import Flask, render_template, jsonify, request, send_file
from flask_cors import CORS
from models import db, ExecutionLog, init_db
import json
from datetime import datetime
import pandas as pd
import io
from sqlalchemy import or_, and_

app = Flask(__name__)
CORS(app)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///sandbox.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/logs', methods=['GET'])
def get_logs():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    status = request.args.get('status', None)
    language = request.args.get('language', None)
    search = request.args.get('search', None)
    
    query = ExecutionLog.query
    
    if status:
        query = query.filter(ExecutionLog.status == status)
    if language:
        query = query.filter(ExecutionLog.language == language)
    if search:
        query = query.filter(or_(
            ExecutionLog.code_snippet.contains(search),
            ExecutionLog.error_message.contains(search)
        ))
    
    query = query.order_by(ExecutionLog.created_at.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    logs = []
    for log in pagination.items:
        logs.append({
            'id': log.id,
            'language': log.language,
            'language_version': log.language_version,
            'code_snippet': log.code_snippet,
            'input_params': json.loads(log.input_params) if log.input_params else {},
            'result': json.loads(log.result) if log.result else None,
            'status': log.status,
            'error_message': log.error_message,
            'execution_time': log.execution_time,
            'timeout_seconds': log.timeout_seconds,
            'was_timeout': log.was_timeout,
            'was_intercepted': log.was_intercepted,
            'intercept_reason': log.intercept_reason,
            'created_at': log.created_at.isoformat(),
            'rollback_from': log.rollback_from,
            'rollback_to': log.rollback_to
        })
    
    return jsonify({
        'logs': logs,
        'total': pagination.total,
        'pages': pagination.pages,
        'current_page': page
    })

@app.route('/api/logs/<int:log_id>', methods=['GET'])
def get_log_detail(log_id):
    log = ExecutionLog.query.get_or_404(log_id)
    return jsonify({
        'id': log.id,
        'language': log.language,
        'language_version': log.language_version,
        'code_snippet': log.code_snippet,
        'input_params': json.loads(log.input_params) if log.input_params else {},
        'result': json.loads(log.result) if log.result else None,
        'processed_result': json.loads(log.processed_result) if log.processed_result else None,
        'status': log.status,
        'error_message': log.error_message,
        'execution_time': log.execution_time,
        'timeout_seconds': log.timeout_seconds,
        'was_timeout': log.was_timeout,
        'was_intercepted': log.was_intercepted,
        'intercept_reason': log.intercept_reason,
        'created_at': log.created_at.isoformat(),
        'rollback_from': log.rollback_from,
        'rollback_to': log.rollback_to
    })

@app.route('/api/logs/<int:log_id>/retry', methods=['POST'])
def retry_execution(log_id):
    log = ExecutionLog.query.get_or_404(log_id)
    
    new_log = ExecutionLog(
        language=log.language,
        language_version=log.language_version,
        code_snippet=log.code_snippet,
        input_params=log.input_params,
        status='pending',
        timeout_seconds=log.timeout_seconds,
        rollback_from=log_id
    )
    
    db.session.add(new_log)
    db.session.commit()
    
    return jsonify({'message': '重试任务已创建', 'new_log_id': new_log.id})

@app.route('/api/logs/<int:log_id>/rollback', methods=['POST'])
def rollback_execution(log_id):
    data = request.get_json()
    target_version = data.get('target_version')
    
    log = ExecutionLog.query.get_or_404(log_id)
    
    if target_version and target_version < log.language_version:
        log.rollback_to = target_version
        log.status = 'rolled_back'
        db.session.commit()
        return jsonify({'message': f'已回滚到版本 {target_version}', 'log_id': log_id})
    
    return jsonify({'error': '无效的回滚版本'}), 400

@app.route('/api/reconcile', methods=['GET'])
def reconcile_logs():
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    query = ExecutionLog.query
    
    if start_date:
        query = query.filter(ExecutionLog.created_at >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.filter(ExecutionLog.created_at <= datetime.fromisoformat(end_date))
    
    logs = query.all()
    
    stats = {
        'total': len(logs),
        'success': sum(1 for l in logs if l.status == 'success'),
        'failed': sum(1 for l in logs if l.status == 'failed'),
        'timeout': sum(1 for l in logs if l.was_timeout),
        'intercepted': sum(1 for l in logs if l.was_intercepted),
        'rolled_back': sum(1 for l in logs if l.status == 'rolled_back'),
        'avg_execution_time': sum(l.execution_time or 0 for l in logs) / len(logs) if logs else 0
    }
    
    discrepancies = []
    for log in logs:
        if log.result and log.processed_result:
            result_json = json.loads(log.result) if isinstance(log.result, str) else log.result
            processed_json = json.loads(log.processed_result) if isinstance(log.processed_result, str) else log.processed_result
            if result_json != processed_json:
                discrepancies.append({
                    'log_id': log.id,
                    'issue': '结果与处理后结果不一致',
                    'language': log.language
                })
        
        if log.execution_time and log.execution_time > log.timeout_seconds * 1000 and not log.was_timeout:
            discrepancies.append({
                'log_id': log.id,
                'issue': '执行超时但未标记为超时',
                'language': log.language
            })
    
    return jsonify({
        'statistics': stats,
        'discrepancies': discrepancies
    })

@app.route('/api/export', methods=['GET'])
def export_logs():
    format_type = request.args.get('format', 'excel')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    query = ExecutionLog.query
    
    if start_date:
        query = query.filter(ExecutionLog.created_at >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.filter(ExecutionLog.created_at <= datetime.fromisoformat(end_date))
    
    logs = query.order_by(ExecutionLog.created_at.desc()).all()
    
    export_data = []
    for log in logs:
        status_text = {
            'success': '成功',
            'failed': '失败',
            'pending': '等待中',
            'rolled_back': '已回滚',
            'timeout': '超时'
        }.get(log.status, log.status)
        
        input_params = json.loads(log.input_params) if log.input_params else {}
        result = json.loads(log.result) if log.result else {}
        
        export_data.append({
            '执行时间': log.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            '编程语言': log.language,
            '语言版本': log.language_version,
            '执行状态': status_text,
            '是否超时': '是' if log.was_timeout else '否',
            '是否被拦截': '是' if log.was_intercepted else '否',
            '拦截原因': log.intercept_reason or '',
            '执行耗时(ms)': log.execution_time or 0,
            '超时设置(秒)': log.timeout_seconds,
            '输入参数': str(input_params),
            '执行结果': str(result),
            '错误信息': log.error_message or '',
            '回滚来源ID': log.rollback_from or '',
            '回滚到版本': log.rollback_to or ''
        })
    
    df = pd.DataFrame(export_data)
    
    if format_type == 'excel':
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='执行日志')
        
        output.seek(0)
        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=f'sandbox_logs_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
        )
    else:
        return jsonify(export_data)

@app.route('/api/languages', methods=['GET'])
def get_languages():
    languages = db.session.query(
        ExecutionLog.language,
        ExecutionLog.language_version
    ).distinct().all()
    
    result = {}
    for lang, version in languages:
        if lang not in result:
            result[lang] = []
        result[lang].append(version)
    
    return jsonify(result)

if __name__ == '__main__':
    with app.app_context():
        init_db()
    app.run(debug=True, port=5000)