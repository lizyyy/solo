#!/usr/bin/env python3
import os
import sys
from flask import Flask, render_template, jsonify, request, redirect, url_for

# 添加 src 目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backup_checker.models import Database
from backup_checker.checker import BackupChecker
from backup_checker.exporter import Exporter

app = Flask(__name__)
app.config['DB_PATH'] = 'backup_check.db'


def get_db():
    return Database(app.config['DB_PATH'])


def get_checker():
    return BackupChecker(get_db())


def get_exporter():
    return Exporter(get_db())


@app.route('/')
def index():
    """首页 - 任务列表"""
    db = get_db()
    tasks = db.get_all_tasks()
    
    # 统计每个任务的检查结果
    for task in tasks:
        check_results = db.get_check_results(task['id'])
        task['passed'] = sum(1 for r in check_results if r['status'] == 'pass')
        task['failed'] = sum(1 for r in check_results if r['status'] == 'fail')
        task['warnings'] = sum(1 for r in check_results if r['status'] == 'warn')
        task['reviewed'] = sum(1 for r in check_results if r['reviewed'])
        task['total_checks'] = len(check_results)
    
    return render_template('index.html', tasks=tasks)


@app.route('/task/<int:task_id>')
def task_detail(task_id):
    """任务详情页"""
    db = get_db()
    task_data = db.get_full_task_data(task_id)
    
    if not task_data:
        return "任务不存在", 404
    
    # 统计检查结果
    check_results = task_data['check_results']
    stats = {
        'passed': sum(1 for r in check_results if r['status'] == 'pass'),
        'failed': sum(1 for r in check_results if r['status'] == 'fail'),
        'warnings': sum(1 for r in check_results if r['status'] == 'warn'),
        'reviewed': sum(1 for r in check_results if r['reviewed']),
        'total': len(check_results)
    }
    
    # 按风险等级分组
    risk_groups = {}
    for result in check_results:
        risk = result['risk_level']
        if risk not in risk_groups:
            risk_groups[risk] = []
        risk_groups[risk].append(result)
    
    return render_template('task_detail.html', 
                          task=task_data['task'],
                          task_data=task_data,
                          stats=stats,
                          risk_groups=risk_groups)


@app.route('/api/tasks', methods=['GET'])
def api_list_tasks():
    """API: 获取任务列表"""
    db = get_db()
    tasks = db.get_all_tasks()
    
    for task in tasks:
        check_results = db.get_check_results(task['id'])
        task['passed'] = sum(1 for r in check_results if r['status'] == 'pass')
        task['failed'] = sum(1 for r in check_results if r['status'] == 'fail')
        task['warnings'] = sum(1 for r in check_results if r['status'] == 'warn')
        task['reviewed'] = sum(1 for r in check_results if r['reviewed'])
        task['total_checks'] = len(check_results)
    
    return jsonify({'tasks': tasks})


@app.route('/api/tasks/<int:task_id>', methods=['GET'])
def api_get_task(task_id):
    """API: 获取任务详情"""
    db = get_db()
    task_data = db.get_full_task_data(task_id)
    
    if not task_data:
        return jsonify({'error': '任务不存在'}), 404
    
    return jsonify(task_data)


@app.route('/api/tasks', methods=['POST'])
def api_create_task():
    """API: 创建任务"""
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify({'error': '缺少任务名称'}), 400
    
    db = get_db()
    task_id = db.create_task(data['name'])
    
    return jsonify({'task_id': task_id, 'name': data['name']}), 201


@app.route('/api/checks/<int:check_id>/review', methods=['POST'])
def api_review_check(check_id):
    """API: 复核检查结果"""
    data = request.get_json() or {}
    
    reviewed = data.get('reviewed', True)
    review_note = data.get('review_note', '')
    
    db = get_db()
    db.update_check_result_review(check_id, reviewed, review_note)
    
    return jsonify({'success': True, 'check_id': check_id})


@app.route('/api/tasks/<int:task_id>/notes', methods=['POST'])
def api_add_note(task_id):
    """API: 添加值班备注"""
    data = request.get_json()
    if not data or 'note' not in data:
        return jsonify({'error': '缺少备注内容'}), 400
    
    db = get_db()
    note_id = db.add_duty_note(
        task_id, 
        data['note'], 
        data.get('created_by', 'web')
    )
    
    return jsonify({'success': True, 'note_id': note_id}), 201


@app.route('/api/tasks/<int:task_id>/run-check', methods=['POST'])
def api_run_check(task_id):
    """API: 执行检查"""
    db = get_db()
    checker = BackupChecker(db)
    
    task = db.get_task(task_id)
    if not task:
        return jsonify({'error': '任务不存在'}), 404
    
    results = checker.run_all_checks(task_id)
    
    passed = sum(1 for r in results if r['status'] == 'pass')
    failed = sum(1 for r in results if r['status'] == 'fail')
    warnings = sum(1 for r in results if r['status'] == 'warn')
    
    return jsonify({
        'success': True,
        'total': len(results),
        'passed': passed,
        'failed': failed,
        'warnings': warnings,
        'results': results
    })


@app.route('/api/tasks/<int:task_id>/export/markdown', methods=['GET'])
def api_export_markdown(task_id):
    """API: 导出 Markdown"""
    exporter = get_exporter()
    md_content = exporter.export_to_markdown(task_id)
    
    return jsonify({'content': md_content})


@app.route('/api/tasks/<int:task_id>/export/json', methods=['GET'])
def api_export_json(task_id):
    """API: 导出 JSON 审计包"""
    exporter = get_exporter()
    json_content = exporter.export_to_json(task_id)
    
    return jsonify({'content': json_content})


@app.route('/task/<int:task_id>/review/<int:check_id>', methods=['POST'])
def review_check(task_id, check_id):
    """复核检查结果（表单提交）"""
    reviewed = request.form.get('reviewed') == 'on'
    review_note = request.form.get('review_note', '')
    
    db = get_db()
    db.update_check_result_review(check_id, reviewed, review_note)
    
    return redirect(url_for('task_detail', task_id=task_id))


@app.route('/task/<int:task_id>/add-note', methods=['POST'])
def add_note(task_id):
    """添加值班备注（表单提交）"""
    note = request.form.get('note', '')
    created_by = request.form.get('created_by', 'web')
    
    if note:
        db = get_db()
        db.add_duty_note(task_id, note, created_by)
    
    return redirect(url_for('task_detail', task_id=task_id))


@app.route('/task/<int:task_id>/run-check', methods=['POST'])
def run_check(task_id):
    """执行检查（表单提交）"""
    db = get_db()
    checker = BackupChecker(db)
    
    checker.run_all_checks(task_id)
    
    return redirect(url_for('task_detail', task_id=task_id))


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='备份演练核对工具 - Web 服务')
    parser.add_argument('--db', default='backup_check.db', help='SQLite 数据库文件路径 (默认: backup_check.db)')
    parser.add_argument('--host', default='127.0.0.1', help='绑定地址 (默认: 127.0.0.1)')
    parser.add_argument('--port', type=int, default=5000, help='端口 (默认: 5000)')
    parser.add_argument('--debug', action='store_true', help='调试模式')
    
    args = parser.parse_args()
    
    app.config['DB_PATH'] = args.db
    
    print(f"备份演练核对工具 - Web 服务")
    print(f"数据库: {args.db}")
    print(f"服务地址: http://{args.host}:{args.port}")
    print("-" * 50)
    
    app.run(host=args.host, port=args.port, debug=args.debug)
