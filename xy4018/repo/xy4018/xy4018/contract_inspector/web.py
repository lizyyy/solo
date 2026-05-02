"""
Web界面模块
"""

import os
import json
from pathlib import Path
from datetime import datetime
from werkzeug.utils import secure_filename
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, send_file

from contract_inspector.config import ensure_data_dirs
from contract_inspector.parser import ContractParser
from contract_inspector.diff import ContractDiffer
from contract_inspector.rules import RuleEngine, load_rules
from contract_inspector.storage import TaskStorage
from contract_inspector.exporter import MarkdownExporter, CSVExporter


app = Flask(__name__)
app.secret_key = 'contract-inspector-secret-key-2024'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

ALLOWED_EXTENSIONS = {'txt', 'md', 'yaml', 'yml', 'json'}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/')
def index():
    """首页"""
    storage = TaskStorage()
    recent_tasks = storage.list_tasks(limit=10)
    
    demo_dir = Path(__file__).parent.parent / "demo"
    has_demo = demo_dir.exists()
    
    return render_template('index.html', 
                         recent_tasks=recent_tasks,
                         has_demo=has_demo)


@app.route('/inspect', methods=['GET', 'POST'])
def inspect():
    """合同巡检页面"""
    if request.method == 'POST':
        client = request.form.get('client', '').strip()
        contract_name = request.form.get('contract_name', '').strip()
        
        if not client:
            flash('请输入客户名称', 'error')
            return redirect(url_for('inspect'))
        if not contract_name:
            flash('请输入合同名称', 'error')
            return redirect(url_for('inspect'))
        
        if 'old_file' not in request.files or 'new_file' not in request.files:
            flash('请上传两个合同文件', 'error')
            return redirect(url_for('inspect'))
        
        old_file = request.files['old_file']
        new_file = request.files['new_file']
        rules_file = request.files.get('rules_file')
        
        if old_file.filename == '' or new_file.filename == '':
            flash('请选择有效的合同文件', 'error')
            return redirect(url_for('inspect'))
        
        if not allowed_file(old_file.filename) or not allowed_file(new_file.filename):
            flash('不支持的文件格式，请上传 .txt 或 .md 文件', 'error')
            return redirect(url_for('inspect'))
        
        if rules_file and rules_file.filename and not allowed_file(rules_file.filename):
            flash('规则文件格式不支持，请上传 .yaml, .yml 或 .json 文件', 'error')
            return redirect(url_for('inspect'))
        
        ensure_data_dirs()
        
        from contract_inspector.config import DEFAULT_UPLOADS_DIR
        upload_dir = DEFAULT_UPLOADS_DIR
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        old_filename = secure_filename(f"{timestamp}_old_{old_file.filename}")
        old_path = upload_dir / old_filename
        old_file.save(str(old_path))
        
        new_filename = secure_filename(f"{timestamp}_new_{new_file.filename}")
        new_path = upload_dir / new_filename
        new_file.save(str(new_path))
        
        rules_path = None
        if rules_file and rules_file.filename:
            rules_filename = secure_filename(f"{timestamp}_rules_{rules_file.filename}")
            rules_path = upload_dir / rules_filename
            rules_file.save(str(rules_path))
        
        try:
            old_content = old_path.read_text(encoding='utf-8')
            new_content = new_path.read_text(encoding='utf-8')
            
            parser = ContractParser()
            old_doc = parser.parse(old_content)
            new_doc = parser.parse(new_content)
            
            differ = ContractDiffer()
            diff_result = differ.compare(old_doc, new_doc)
            
            risk_results = None
            if rules_path:
                rule_engine = RuleEngine()
                rules_data = load_rules(rules_path)
                rule_engine.load_rules(rules_data)
                risk_results = rule_engine.scan(old_content, new_content, diff_result)
            
            storage = TaskStorage()
            task = storage.save_task(
                client=client,
                contract_name=contract_name,
                old_file=str(old_path),
                new_file=str(new_path),
                old_content=old_content,
                new_content=new_content,
                old_doc=old_doc,
                new_doc=new_doc,
                diff_result=diff_result,
                risk_results=risk_results
            )
            
            flash('巡检完成！', 'success')
            return redirect(url_for('result', task_id=task['id']))
            
        except Exception as e:
            flash(f'巡检过程中出错: {str(e)}', 'error')
            return redirect(url_for('inspect'))
    
    return render_template('inspect.html')


@app.route('/result/<task_id>')
def result(task_id):
    """巡检结果页面"""
    storage = TaskStorage()
    task = storage.get_task(task_id)
    
    if not task:
        flash('任务不存在', 'error')
        return redirect(url_for('index'))
    
    diff_result = task.get('diff_result', {})
    risk_results = task.get('risk_results', {})
    
    risk_stats = {'high': 0, 'medium': 0, 'low': 0}
    if risk_results:
        for risks in risk_results.values():
            for risk in risks:
                level = risk.get('level', 'medium')
                if level in risk_stats:
                    risk_stats[level] += 1
    
    return render_template('result.html',
                         task=task,
                         diff_result=diff_result,
                         risk_results=risk_results,
                         risk_stats=risk_stats)


@app.route('/tasks')
def tasks():
    """任务列表页面"""
    client = request.args.get('client', '')
    contract_name = request.args.get('contract_name', '')
    
    storage = TaskStorage()
    
    if client or contract_name:
        task_list = storage.list_tasks(client=client, contract_name=contract_name, limit=100)
    else:
        task_list = storage.list_tasks(limit=100)
    
    return render_template('tasks.html',
                         tasks=task_list,
                         current_client=client,
                         current_contract=contract_name)


@app.route('/export/<task_id>')
def export(task_id):
    """导出报告"""
    storage = TaskStorage()
    task = storage.get_task(task_id)
    
    if not task:
        flash('任务不存在', 'error')
        return redirect(url_for('index'))
    
    format_type = request.args.get('format', 'markdown')
    
    try:
        if format_type == 'csv':
            exporter = CSVExporter()
            output_path = exporter.export(task)
        else:
            exporter = MarkdownExporter()
            output_path = exporter.export(task)
        
        return send_file(
            str(output_path),
            as_attachment=True,
            download_name=output_path.name
        )
    except Exception as e:
        flash(f'导出失败: {str(e)}', 'error')
        return redirect(url_for('result', task_id=task_id))


@app.route('/api/quick-demo', methods=['POST'])
def quick_demo():
    """快速演示API"""
    ensure_data_dirs()
    
    demo_dir = Path(__file__).parent.parent / "demo"
    old_file = demo_dir / "contract_v1.md"
    new_file = demo_dir / "contract_v2.md"
    rules_file = demo_dir / "rules.yaml"
    
    if not old_file.exists() or not new_file.exists():
        return jsonify({'error': '演示文件不存在'}), 400
    
    try:
        old_content = old_file.read_text(encoding='utf-8')
        new_content = new_file.read_text(encoding='utf-8')
        
        parser = ContractParser()
        old_doc = parser.parse(old_content)
        new_doc = parser.parse(new_content)
        
        differ = ContractDiffer()
        diff_result = differ.compare(old_doc, new_doc)
        
        risk_results = None
        if rules_file.exists():
            rule_engine = RuleEngine()
            rules_data = load_rules(rules_file)
            rule_engine.load_rules(rules_data)
            risk_results = rule_engine.scan(old_content, new_content, diff_result)
        
        storage = TaskStorage()
        task = storage.save_task(
            client="Web演示客户",
            contract_name="Web演示合同",
            old_file=str(old_file),
            new_file=str(new_file),
            old_content=old_content,
            new_content=new_content,
            old_doc=old_doc,
            new_doc=new_doc,
            diff_result=diff_result,
            risk_results=risk_results
        )
        
        return jsonify({
            'success': True,
            'task_id': task['id'],
            'redirect': url_for('result', task_id=task['id'])
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.template_filter('datetime_format')
def datetime_format(value, format='%Y-%m-%d %H:%M:%S'):
    """模板过滤器：格式化日期时间"""
    if isinstance(value, str):
        try:
            dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
            return dt.strftime(format)
        except:
            return value
    return value


def run_server(host='127.0.0.1', port=5000, debug=False):
    """启动Web服务器"""
    ensure_data_dirs()
    print(f"🚀 合同改稿巡检器Web服务启动中...")
    print(f"📍 访问地址: http://{host}:{port}")
    print(f"📖 按 Ctrl+C 停止服务")
    print("-" * 50)
    app.run(host=host, port=port, debug=debug)


if __name__ == '__main__':
    run_server(debug=True)
