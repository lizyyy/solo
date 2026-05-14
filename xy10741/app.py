from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import json
import os
import time
import uuid
from datetime import datetime
from collections import defaultdict

app = Flask(__name__)
CORS(app)

DATA_DIR = 'data'
os.makedirs(DATA_DIR, exist_ok=True)

def load_json(filename, default):
    path = os.path.join(DATA_DIR, filename)
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return default

def save_json(filename, data):
    path = os.path.join(DATA_DIR, filename)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def generate_id():
    return str(uuid.uuid4())[:8]

def now():
    return datetime.now().isoformat()

models = load_json('models.json', {})
test_samples = load_json('test_samples.json', {})
evaluations = load_json('evaluations.json', {})
timeline = load_json('timeline.json', [])
corrections = load_json('corrections.json', {})

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)

@app.route('/api/models', methods=['GET'])
def get_models():
    return jsonify(list(models.values()))

@app.route('/api/models', methods=['POST'])
def create_model():
    data = request.json
    model_id = generate_id()
    model = {
        'id': model_id,
        'name': data['name'],
        'version': data['version'],
        'description': data.get('description', ''),
        'status': 'pending',
        'created_at': now(),
        'metrics': {}
    }
    models[model_id] = model
    save_json('models.json', models)
    add_timeline('model_created', f'创建模型: {model["name"]} v{model["version"]}')
    return jsonify(model), 201

@app.route('/api/models/<model_id>', methods=['PUT'])
def update_model(model_id):
    if model_id not in models:
        return jsonify({'error': 'Model not found'}), 404
    data = request.json
    models[model_id].update(data)
    save_json('models.json', models)
    return jsonify(models[model_id])

@app.route('/api/test-samples', methods=['GET'])
def get_test_samples():
    return jsonify(list(test_samples.values()))

@app.route('/api/test-samples', methods=['POST'])
def create_test_sample():
    data = request.json
    sample_id = generate_id()
    sample = {
        'id': sample_id,
        'input': data['input'],
        'expected_output': data['expected_output'],
        'category': data.get('category', 'general'),
        'created_at': now()
    }
    test_samples[sample_id] = sample
    save_json('test_samples.json', test_samples)
    add_timeline('sample_created', f'创建测试样本: {sample["input"][:30]}...')
    return jsonify(sample), 201

@app.route('/api/evaluate', methods=['POST'])
def evaluate():
    data = request.json
    model_id = data['model_id']
    sample_id = data['sample_id']
    
    if model_id not in models or sample_id not in test_samples:
        return jsonify({'error': 'Model or sample not found'}), 404
    
    model = models[model_id]
    sample = test_samples[sample_id]
    
    start_time = time.time()
    time.sleep(0.1 + (hash(model_id + sample_id) % 10) * 0.05)
    latency = (time.time() - start_time) * 1000
    
    output = f"模拟响应: {sample['input']} - {model['name']}"
    error_type = None
    is_correct = True
    
    if hash(sample_id) % 5 == 0:
        error_type = 'classification_error'
        is_correct = False
        output = f"错误分类: {sample['input']}"
    
    eval_id = generate_id()
    evaluation = {
        'id': eval_id,
        'model_id': model_id,
        'sample_id': sample_id,
        'input': sample['input'],
        'expected_output': sample['expected_output'],
        'actual_output': output,
        'latency_ms': round(latency, 2),
        'is_correct': is_correct,
        'error_type': error_type,
        'status': 'completed' if is_correct else 'needs_review',
        'created_at': now(),
        'human_label': None,
        'label_reason': None
    }
    
    evaluations[eval_id] = evaluation
    update_model_metrics(model_id)
    save_json('evaluations.json', evaluations)
    
    add_timeline('evaluation', f'评测完成: {model["name"]} - 延迟{round(latency)}ms' + (' - 需要人工审核' if error_type else ''))
    
    return jsonify(evaluation)

@app.route('/api/evaluations', methods=['GET'])
def get_evaluations():
    model_id = request.args.get('model_id')
    result = list(evaluations.values())
    if model_id:
        result = [e for e in result if e['model_id'] == model_id]
    return jsonify(result)

@app.route('/api/evaluations/<eval_id>/label', methods=['POST'])
def human_label(eval_id):
    if eval_id not in evaluations:
        return jsonify({'error': 'Evaluation not found'}), 404
    
    data = request.json
    eval_item = evaluations[eval_id]
    
    if data.get('blocked'):
        return jsonify({'error': '此操作被规则阻挡: 不允许标记已通过的评测'}), 403
    
    eval_item['human_label'] = data['label']
    eval_item['label_reason'] = data['reason']
    eval_item['status'] = 'human_labeled'
    eval_item['labeled_at'] = now()
    eval_item['labeled_by'] = data.get('labeler', 'quality_owner')
    
    save_json('evaluations.json', evaluations)
    update_model_metrics(eval_item['model_id'])
    
    model = models[eval_item['model_id']]
    add_timeline('human_labeled', f'人工标注完成: {model["name"]} - {data["label"]}')
    
    if eval_item['error_type'] == 'classification_error':
        corr_id = generate_id()
        corrections[corr_id] = {
            'id': corr_id,
            'evaluation_id': eval_id,
            'original_error': eval_item['error_type'],
            'correction_label': data['label'],
            'reason': data['reason'],
            'created_at': now()
        }
        save_json('corrections.json', corrections)
    
    return jsonify(eval_item)

@app.route('/api/corrections', methods=['GET'])
def get_corrections():
    return jsonify(list(corrections.values()))

@app.route('/api/timeline', methods=['GET'])
def get_timeline():
    return jsonify(timeline)

@app.route('/api/dashboard', methods=['GET'])
def get_dashboard():
    by_model = defaultdict(lambda: {'total': 0, 'correct': 0, 'avg_latency': 0, 'needs_review': 0})
    
    for eval_item in evaluations.values():
        m = by_model[eval_item['model_id']]
        m['total'] += 1
        m['correct'] += 1 if eval_item['is_correct'] else 0
        m['avg_latency'] += eval_item['latency_ms']
        if eval_item['status'] == 'needs_review':
            m['needs_review'] += 1
    
    for m in by_model.values():
        if m['total'] > 0:
            m['avg_latency'] = round(m['avg_latency'] / m['total'], 2)
            m['accuracy'] = round(m['correct'] / m['total'] * 100, 1)
    
    return jsonify({
        'total_evaluations': len(evaluations),
        'total_models': len(models),
        'total_samples': len(test_samples),
        'by_model': dict(by_model)
    })

@app.route('/api/init', methods=['POST'])
def init_data():
    global models, test_samples, evaluations, timeline, corrections
    
    models = {}
    test_samples = {}
    evaluations = {}
    timeline = []
    corrections = {}
    
    sample_models = [
        {'name': 'GPT-3.5', 'version': 'turbo-0613', 'description': '基础大语言模型'},
        {'name': 'Claude-2', 'version': '2.1', 'description': 'Anthropic Claude模型'},
        {'name': 'Qwen', 'version': '7B-chat', 'description': '通义千问开源版'}
    ]
    for m in sample_models:
        model_id = generate_id()
        models[model_id] = {
            'id': model_id,
            'name': m['name'],
            'version': m['version'],
            'description': m['description'],
            'status': 'pending',
            'created_at': now(),
            'metrics': {}
        }
    
    sample_inputs = [
        ('什么是机器学习？', '机器学习是人工智能的一个分支...', 'technical'),
        ('推荐一本好看的小说', '《百年孤独》是一部经典...', 'recommendation'),
        ('1+1等于几？', '1+1等于2', 'math'),
        ('如何学习编程？', '学习编程需要持续练习...', 'educational'),
        ('北京今天天气如何？', '北京今天晴，气温15-25度', 'weather')
    ]
    for inp, exp, cat in sample_inputs:
        sample_id = generate_id()
        test_samples[sample_id] = {
            'id': sample_id,
            'input': inp,
            'expected_output': exp,
            'category': cat,
            'created_at': now()
        }
    
    save_json('models.json', models)
    save_json('test_samples.json', test_samples)
    save_json('evaluations.json', evaluations)
    save_json('timeline.json', timeline)
    save_json('corrections.json', corrections)
    
    add_timeline('init', '系统初始化完成，加载示例数据')
    
    return jsonify({'message': '初始化完成', 'models': len(models), 'samples': len(test_samples)})

def update_model_metrics(model_id):
    model_evals = [e for e in evaluations.values() if e['model_id'] == model_id]
    if not model_evals:
        return
    
    total = len(model_evals)
    correct = sum(1 for e in model_evals if e['is_correct'])
    avg_latency = sum(e['latency_ms'] for e in model_evals) / total
    
    models[model_id]['metrics'] = {
        'total_evaluations': total,
        'accuracy': round(correct / total * 100, 1),
        'avg_latency_ms': round(avg_latency, 2),
        'needs_review': sum(1 for e in model_evals if e['status'] == 'needs_review')
    }
    
    if avg_latency < 200 and (correct / total) > 0.8:
        models[model_id]['status'] = 'approved'
    elif avg_latency > 500:
        models[model_id]['status'] = 'rejected'
    else:
        models[model_id]['status'] = 'pending'
    
    save_json('models.json', models)

def add_timeline(event_type, message):
    timeline.insert(0, {
        'id': generate_id(),
        'type': event_type,
        'message': message,
        'timestamp': now()
    })
    save_json('timeline.json', timeline)

if __name__ == '__main__':
    print("\n=" * 60)
    print("模型推理API评测系统")
    print("=" * 60)
    print("\n访问地址: http://localhost:5000")
    print("\n常用接口:")
    print("  POST /api/init          - 初始化数据")
    print("  GET  /api/models        - 获取模型列表")
    print("  POST /api/models        - 创建模型")
    print("  GET  /api/test-samples  - 获取测试样本")
    print("  POST /api/evaluate      - 执行评测")
    print("  GET  /api/dashboard     - 看板数据")
    print("  GET  /api/timeline      - 时间线")
    print("\n会被规则挡住的操作: 尝试标记已通过评测时会返回403错误")
    print("=" * 60 + "\n")
    app.run(debug=True, port=5000)
