from flask import Flask, request, jsonify, send_file, render_template
from flask_cors import CORS
import json
import os
from datetime import datetime
import pandas as pd
from io import BytesIO

app = Flask(__name__, template_folder='templates', static_folder='static')
CORS(app)

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')

def load_data(filename):
    filepath = os.path.join(DATA_DIR, filename)
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

def save_data(filename, data):
    filepath = os.path.join(DATA_DIR, filename)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def init_data():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
    
    samples = load_data('intent_samples.json')
    if not samples:
        samples = [
            {
                "id": 1,
                "intent": "查询余额",
                "text": "我想查一下我卡里有多少钱",
                "entities": [{"type": "银行卡", "value": "储蓄卡"}],
                "version": "v1.0",
                "status": "approved",
                "created_at": "2024-01-15 10:30:00",
                "created_by": "张三",
                "approved_at": "2024-01-16 14:20:00",
                "approved_by": "李四"
            },
            {
                "id": 2,
                "intent": "转账",
                "text": "帮我转500块到朋友账户",
                "entities": [{"type": "金额", "value": "500"}, {"type": "账户", "value": "朋友"}],
                "version": "v1.0",
                "status": "pending",
                "created_at": "2024-01-17 09:15:00",
                "created_by": "王五"
            },
            {
                "id": 3,
                "intent": "密码重置",
                "text": "我的密码忘了怎么办",
                "entities": [],
                "version": "v1.1",
                "status": "confused",
                "created_at": "2024-01-18 16:45:00",
                "created_by": "赵六",
                "confuse_reason": "与'修改密码'意图混淆，置信度只有0.52",
                "handled_at": "2024-01-19 11:00:00",
                "handled_by": "钱七",
                "handle_note": "已添加负样本，提升区分度"
            }
        ]
        save_data('intent_samples.json', samples)
    
    versions = load_data('training_versions.json')
    if not versions:
        versions = [
            {
                "version": "v1.0",
                "status": "online",
                "created_at": "2024-01-10 08:00:00",
                "created_by": "李四",
                "sample_count": 150,
                "accuracy": 0.89
            },
            {
                "version": "v1.1",
                "status": "training",
                "created_at": "2024-01-20 10:00:00",
                "created_by": "李四",
                "sample_count": 180,
                "accuracy": None
            }
        ]
        save_data('training_versions.json', versions)
    
    reports = load_data('hit_reports.json')
    if not reports:
        reports = [
            {
                "id": 1,
                "intent": "查询余额",
                "text": "查余额",
                "predicted_intent": "查询余额",
                "confidence": 0.95,
                "is_correct": True,
                "hit_time": "2024-01-20 14:30:00",
                "version": "v1.0",
                "handler": "系统"
            },
            {
                "id": 2,
                "intent": "转账",
                "text": "转钱",
                "predicted_intent": "查询余额",
                "confidence": 0.55,
                "is_correct": False,
                "hit_time": "2024-01-20 15:20:00",
                "version": "v1.0",
                "handler": "张三"
            }
        ]
        save_data('hit_reports.json', reports)
    
    approvals = load_data('approvals.json')
    if not approvals:
        approvals = [
            {
                "id": 1,
                "version": "v1.0",
                "status": "approved",
                "requested_at": "2024-01-09 10:00:00",
                "requested_by": "张三",
                "approved_at": "2024-01-10 08:00:00",
                "approved_by": "李四",
                "comment": "测试通过，可以上线"
            }
        ]
        save_data('approvals.json', approvals)

init_data()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/samples', methods=['GET'])
def get_samples():
    samples = load_data('intent_samples.json')
    search = request.args.get('search', '')
    status = request.args.get('status', '')
    
    filtered = samples
    if search:
        filtered = [s for s in filtered if search.lower() in s['text'].lower() or search.lower() in s['intent'].lower()]
    if status:
        filtered = [s for s in filtered if s['status'] == status]
    
    return jsonify(filtered)

@app.route('/api/samples/<int:sample_id>', methods=['GET'])
def get_sample_detail(sample_id):
    samples = load_data('intent_samples.json')
    sample = next((s for s in samples if s['id'] == sample_id), None)
    if sample:
        return jsonify(sample)
    return jsonify({"error": "Sample not found"}), 404

@app.route('/api/samples', methods=['POST'])
def create_sample():
    samples = load_data('intent_samples.json')
    data = request.json
    new_id = max([s['id'] for s in samples], default=0) + 1
    new_sample = {
        "id": new_id,
        "intent": data['intent'],
        "text": data['text'],
        "entities": data.get('entities', []),
        "version": data.get('version', 'v1.0'),
        "status": "pending",
        "created_at": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        "created_by": data.get('created_by', '当前用户')
    }
    samples.append(new_sample)
    save_data('intent_samples.json', samples)
    return jsonify(new_sample)

@app.route('/api/samples/<int:sample_id>/handle', methods=['POST'])
def handle_sample(sample_id):
    samples = load_data('intent_samples.json')
    sample = next((s for s in samples if s['id'] == sample_id), None)
    if not sample:
        return jsonify({"error": "Sample not found"}), 404
    
    data = request.json
    sample['handled_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    sample['handled_by'] = data.get('handled_by', '当前用户')
    sample['handle_note'] = data.get('handle_note', '')
    sample['status'] = data.get('status', 'approved')
    save_data('intent_samples.json', samples)
    return jsonify(sample)

@app.route('/api/versions', methods=['GET'])
def get_versions():
    versions = load_data('training_versions.json')
    return jsonify(versions)

@app.route('/api/versions', methods=['POST'])
def create_version():
    versions = load_data('training_versions.json')
    data = request.json
    new_version = {
        "version": data['version'],
        "status": "training",
        "created_at": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        "created_by": data.get('created_by', '当前用户'),
        "sample_count": data.get('sample_count', 0),
        "accuracy": None
    }
    versions.append(new_version)
    save_data('training_versions.json', versions)
    return jsonify(new_version)

@app.route('/api/confused', methods=['GET'])
def get_confused_samples():
    samples = load_data('intent_samples.json')
    confused = [s for s in samples if s['status'] == 'confused']
    return jsonify(confused)

@app.route('/api/reports', methods=['GET'])
def get_reports():
    reports = load_data('hit_reports.json')
    return jsonify(reports)

@app.route('/api/reports/export', methods=['GET'])
def export_reports():
    reports = load_data('hit_reports.json')
    df = pd.DataFrame(reports)
    
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='命中明细', index=False)
        
        pivot_handler = df.pivot_table(index=['handler', 'hit_time', 'version'], values='id', aggfunc='count').reset_index()
        pivot_handler.columns = ['负责人', '命中时间', '训练版本', '命中次数']
        pivot_handler.to_excel(writer, sheet_name='按负责人分组', index=False)
        
        pivot_version = df.pivot_table(index='version', values=['is_correct'], aggfunc=['count', 'mean']).reset_index()
        pivot_version.columns = ['训练版本', '总命中数', '正确率']
        pivot_version.to_excel(writer, sheet_name='按版本分组', index=False)
    
    output.seek(0)
    return send_file(output, mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', as_attachment=True, download_name='命中报表.xlsx')

@app.route('/api/approvals', methods=['GET'])
def get_approvals():
    approvals = load_data('approvals.json')
    return jsonify(approvals)

@app.route('/api/approvals', methods=['POST'])
def create_approval():
    approvals = load_data('approvals.json')
    data = request.json
    new_id = max([a['id'] for a in approvals], default=0) + 1
    new_approval = {
        "id": new_id,
        "version": data['version'],
        "status": "pending",
        "requested_at": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        "requested_by": data.get('requested_by', '当前用户'),
        "comment": data.get('comment', '')
    }
    approvals.append(new_approval)
    save_data('approvals.json', approvals)
    return jsonify(new_approval)

@app.route('/api/approvals/<int:approval_id>/approve', methods=['POST'])
def approve_approval(approval_id):
    approvals = load_data('approvals.json')
    approval = next((a for a in approvals if a['id'] == approval_id), None)
    if not approval:
        return jsonify({"error": "Approval not found"}), 404
    
    data = request.json
    approval['status'] = 'approved'
    approval['approved_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    approval['approved_by'] = data.get('approved_by', '当前用户')
    save_data('approvals.json', approvals)
    
    versions = load_data('training_versions.json')
    for v in versions:
        if v['version'] == approval['version']:
            v['status'] = 'online'
    save_data('training_versions.json', versions)
    
    return jsonify(approval)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
