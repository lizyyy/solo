from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import numpy as np
import json
import os
import sys
from datetime import datetime
import random

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import Config
from neural_network import (
    NeuralNetwork, 
    ExperimentManager, 
    ParameterValidator, 
    ReportGenerator
)

Config.init_dirs()

app = Flask(__name__)
app.config.from_object(Config)
CORS(app)

experiment_manager = ExperimentManager(Config.EXPERIMENTS_DIR)

SEED_DATASETS = {
    'xor': {
        'name': 'XOR 问题',
        'description': '经典的异或问题，测试神经网络的非线性拟合能力',
        'X': [[0, 0], [0, 1], [1, 0], [1, 1]],
        'y': [[0], [1], [1], [0]]
    },
    'and': {
        'name': 'AND 逻辑',
        'description': '简单的与运算，线性可分问题',
        'X': [[0, 0], [0, 1], [1, 0], [1, 1]],
        'y': [[0], [0], [0], [1]]
    },
    'or': {
        'name': 'OR 逻辑',
        'description': '或运算，线性可分问题',
        'X': [[0, 0], [0, 1], [1, 0], [1, 1]],
        'y': [[0], [1], [1], [1]]
    },
    'sin_curve': {
        'name': '正弦曲线拟合',
        'description': '拟合正弦函数，测试回归能力',
        'X': None,
        'y': None,
        'generator': lambda: generate_sin_data()
    },
    'circle': {
        'name': '圆形分类',
        'description': '非线性分类问题，内圆外圆分类',
        'X': None,
        'y': None,
        'generator': lambda: generate_circle_data()
    }
}

BAD_SAMPLES = {
    'zero_initialization': {
        'name': '全零初始化陷阱',
        'description': '演示全零初始化导致所有神经元学习相同特征的问题',
        'config': {
            'initialization': 'zeros',
            'hidden_layers': [4, 4],
            'learning_rate': 0.1,
            'epochs': 100
        },
        'expected_issue': '所有权重更新相同，网络无法学习非线性模式'
    },
    'learning_rate_too_high': {
        'name': '学习率过大',
        'description': '演示学习率过大导致loss震荡或发散',
        'config': {
            'learning_rate': 10.0,
            'epochs': 50
        },
        'expected_issue': 'Loss可能震荡或爆炸上升'
    },
    'learning_rate_too_low': {
        'name': '学习率过小',
        'description': '演示学习率过小导致收敛极慢',
        'config': {
            'learning_rate': 0.00001,
            'epochs': 100
        },
        'expected_issue': 'Loss下降非常缓慢，几乎看不到变化'
    },
    'sigmoid_deep_network': {
        'name': '深层Sigmoid梯度消失',
        'description': '演示深层网络中Sigmoid激活函数导致的梯度消失问题',
        'config': {
            'activation': 'sigmoid',
            'hidden_layers': [8, 8, 8, 8, 8],
            'learning_rate': 0.1,
            'epochs': 200
        },
        'expected_issue': '梯度在反向传播中逐渐消失，深层权重几乎不更新'
    },
    'no_hidden_layer': {
        'name': '无隐藏层(感知机)',
        'description': '演示没有隐藏层无法解决XOR等非线性问题',
        'config': {
            'hidden_layers': [],
            'epochs': 200
        },
        'expected_issue': '无法学习非线性决策边界，XOR问题无法解决'
    }
}

def generate_sin_data(n_samples: int = 100):
    np.random.seed(42)
    X = np.linspace(-np.pi, np.pi, n_samples).reshape(-1, 1)
    y = np.sin(X)
    return X.tolist(), y.tolist()

def generate_circle_data(n_samples: int = 200):
    np.random.seed(42)
    n_inner = n_samples // 2
    n_outer = n_samples - n_inner
    
    theta = np.random.uniform(0, 2 * np.pi, n_inner)
    r = np.random.uniform(0, 0.5, n_inner)
    X_inner = np.column_stack([r * np.cos(theta), r * np.sin(theta)])
    y_inner = np.zeros((n_inner, 1))
    
    theta = np.random.uniform(0, 2 * np.pi, n_outer)
    r = np.random.uniform(0.7, 1.0, n_outer)
    X_outer = np.column_stack([r * np.cos(theta), r * np.sin(theta)])
    y_outer = np.ones((n_outer, 1))
    
    X = np.vstack([X_inner, X_outer])
    y = np.vstack([y_inner, y_outer])
    
    indices = np.random.permutation(n_samples)
    X = X[indices]
    y = y[indices]
    
    return X.tolist(), y.tolist()

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'timestamp': datetime.now().isoformat()})

@app.route('/api/datasets', methods=['GET'])
def get_datasets():
    datasets_info = []
    for key, dataset in SEED_DATASETS.items():
        datasets_info.append({
            'id': key,
            'name': dataset['name'],
            'description': dataset['description'],
            'has_static_data': dataset['X'] is not None
        })
    return jsonify({'datasets': datasets_info})

@app.route('/api/datasets/<dataset_id>', methods=['GET'])
def get_dataset(dataset_id):
    if dataset_id not in SEED_DATASETS:
        return jsonify({'error': 'Dataset not found'}), 404
    
    dataset = SEED_DATASETS[dataset_id]
    if dataset['X'] is not None:
        return jsonify({
            'id': dataset_id,
            'name': dataset['name'],
            'description': dataset['description'],
            'X': dataset['X'],
            'y': dataset['y']
        })
    else:
        X, y = dataset['generator']()
        return jsonify({
            'id': dataset_id,
            'name': dataset['name'],
            'description': dataset['description'],
            'X': X,
            'y': y
        })

@app.route('/api/bad-samples', methods=['GET'])
def get_bad_samples():
    bad_samples_info = []
    for key, sample in BAD_SAMPLES.items():
        bad_samples_info.append({
            'id': key,
            'name': sample['name'],
            'description': sample['description'],
            'expected_issue': sample['expected_issue']
        })
    return jsonify({'bad_samples': bad_samples_info})

@app.route('/api/bad-samples/<sample_id>', methods=['GET'])
def get_bad_sample(sample_id):
    if sample_id not in BAD_SAMPLES:
        return jsonify({'error': 'Bad sample not found'}), 404
    
    sample = BAD_SAMPLES[sample_id]
    return jsonify({
        'id': sample_id,
        'name': sample['name'],
        'description': sample['description'],
        'config': sample['config'],
        'expected_issue': sample['expected_issue']
    })

@app.route('/api/validate', methods=['POST'])
def validate_parameters():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    validation = ParameterValidator.validate(data)
    return jsonify(validation)

@app.route('/api/experiments', methods=['GET'])
def list_experiments():
    limit = request.args.get('limit', 100, type=int)
    experiments = experiment_manager.list_experiments(limit)
    return jsonify({
        'count': len(experiments),
        'experiments': experiments
    })

@app.route('/api/experiments', methods=['POST'])
def create_experiment():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    validation = ParameterValidator.validate(data)
    if not validation['valid']:
        return jsonify({
            'error': 'Invalid parameters',
            'errors': validation['errors'],
            'warnings': validation['warnings']
        }), 400
    
    seed = data.get('seed', random.randint(1, 999999))
    experiment = experiment_manager.create_experiment(data, seed)
    
    return jsonify({
        'message': 'Experiment created',
        'experiment': experiment,
        'warnings': validation['warnings']
    }), 201

@app.route('/api/experiments/<experiment_id>', methods=['GET'])
def get_experiment(experiment_id):
    experiment = experiment_manager.get_experiment(experiment_id)
    if not experiment:
        return jsonify({'error': 'Experiment not found'}), 404
    return jsonify(experiment)

@app.route('/api/experiments/<experiment_id>', methods=['DELETE'])
def delete_experiment(experiment_id):
    success = experiment_manager.delete_experiment(experiment_id)
    if not success:
        return jsonify({'error': 'Experiment not found'}), 404
    return jsonify({'message': 'Experiment deleted'})

@app.route('/api/train/step-by-step', methods=['POST'])
def train_step_by_step():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    try:
        X = np.array(data.get('X', []))
        y = np.array(data.get('y', []))
        
        if X.size == 0 or y.size == 0:
            return jsonify({'error': 'Training data is required'}), 400
        
        input_size = X.shape[1] if len(X.shape) > 1 else 1
        output_size = y.shape[1] if len(y.shape) > 1 else 1
        hidden_layers = data.get('hidden_layers', [4])
        
        nn = NeuralNetwork(
            input_size=input_size,
            hidden_layers=hidden_layers,
            output_size=output_size,
            activation=data.get('activation', 'relu'),
            output_activation=data.get('output_activation', 'sigmoid'),
            initialization=data.get('initialization', 'xavier'),
            learning_rate=data.get('learning_rate', 0.01),
            loss_function=data.get('loss_function', 'binary_cross_entropy'),
            seed=data.get('seed', None)
        )
        
        epochs = data.get('epochs', 100)
        
        training_result = nn.train(X, y, epochs, verbose=False)
        
        experiment_id = data.get('experiment_id')
        if experiment_id:
            experiment_manager.update_experiment(experiment_id, {
                'status': 'completed',
                'training_result': training_result,
                'final_weights': nn.get_weights(),
                'final_biases': nn.get_biases()
            })
        
        return jsonify({
            'message': 'Training completed',
            'result': training_result,
            'final_weights': nn.get_weights(),
            'final_biases': nn.get_biases()
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/train/single-step', methods=['POST'])
def train_single_step():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    try:
        X = np.array(data.get('X', []))
        y = np.array(data.get('y', []))
        
        if X.size == 0 or y.size == 0:
            return jsonify({'error': 'Training data is required'}), 400
        
        weights = data.get('weights')
        biases = data.get('biases')
        
        input_size = X.shape[1] if len(X.shape) > 1 else 1
        output_size = y.shape[1] if len(y.shape) > 1 else 1
        hidden_layers = data.get('hidden_layers', [4])
        
        nn = NeuralNetwork(
            input_size=input_size,
            hidden_layers=hidden_layers,
            output_size=output_size,
            activation=data.get('activation', 'relu'),
            output_activation=data.get('output_activation', 'sigmoid'),
            initialization=data.get('initialization', 'xavier'),
            learning_rate=data.get('learning_rate', 0.01),
            loss_function=data.get('loss_function', 'binary_cross_entropy'),
            seed=data.get('seed', None)
        )
        
        if weights and biases:
            nn.set_weights(weights)
            nn.set_biases(biases)
        
        step_result = nn.train_step(X, y, record_step=True)
        
        return jsonify({
            'message': 'Single training step completed',
            'step_result': step_result,
            'updated_weights': nn.get_weights(),
            'updated_biases': nn.get_biases()
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/forward', methods=['POST'])
def forward_pass():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    try:
        X = np.array(data.get('X', []))
        
        if X.size == 0:
            return jsonify({'error': 'Input data is required'}), 400
        
        weights = data.get('weights')
        biases = data.get('biases')
        hidden_layers = data.get('hidden_layers', [4])
        
        if not weights or not biases:
            return jsonify({'error': 'Weights and biases are required'}), 400
        
        input_size = X.shape[1] if len(X.shape) > 1 else 1
        output_size = len(weights[-1][0])
        
        nn = NeuralNetwork(
            input_size=input_size,
            hidden_layers=hidden_layers,
            output_size=output_size,
            activation=data.get('activation', 'relu'),
            output_activation=data.get('output_activation', 'sigmoid')
        )
        
        nn.set_weights(weights)
        nn.set_biases(biases)
        
        output, layer_outputs = nn.forward(X, record_step=True)
        
        return jsonify({
            'output': output.tolist(),
            'layer_outputs': layer_outputs
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/reports/<experiment_id>/markdown', methods=['GET'])
def generate_markdown_report(experiment_id):
    experiment = experiment_manager.get_experiment(experiment_id)
    if not experiment:
        return jsonify({'error': 'Experiment not found'}), 404
    
    markdown = ReportGenerator.generate_markdown(experiment)
    
    return jsonify({
        'experiment_id': experiment_id,
        'format': 'markdown',
        'content': markdown
    })

@app.route('/api/reports/<experiment_id>/json', methods=['GET'])
def generate_json_report(experiment_id):
    experiment = experiment_manager.get_experiment(experiment_id)
    if not experiment:
        return jsonify({'error': 'Experiment not found'}), 404
    
    return jsonify({
        'experiment_id': experiment_id,
        'format': 'json',
        'content': json.loads(ReportGenerator.generate_json(experiment))
    })

@app.route('/api/reports/<experiment_id>/download/markdown', methods=['GET'])
def download_markdown_report(experiment_id):
    experiment = experiment_manager.get_experiment(experiment_id)
    if not experiment:
        return jsonify({'error': 'Experiment not found'}), 404
    
    markdown = ReportGenerator.generate_markdown(experiment)
    
    report_path = os.path.join(Config.REPORTS_DIR, f"{experiment_id}.md")
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(markdown)
    
    return send_file(
        report_path,
        mimetype='text/markdown',
        as_attachment=True,
        download_name=f'{experiment_id}_report.md'
    )

@app.route('/api/reports/<experiment_id>/download/json', methods=['GET'])
def download_json_report(experiment_id):
    experiment = experiment_manager.get_experiment(experiment_id)
    if not experiment:
        return jsonify({'error': 'Experiment not found'}), 404
    
    json_content = ReportGenerator.generate_json(experiment)
    
    report_path = os.path.join(Config.REPORTS_DIR, f"{experiment_id}.json")
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(json_content)
    
    return send_file(
        report_path,
        mimetype='application/json',
        as_attachment=True,
        download_name=f'{experiment_id}_report.json'
    )

@app.route('/api/compare', methods=['POST'])
def compare_experiments():
    data = request.get_json()
    if not data or 'experiment_ids' not in data:
        return jsonify({'error': 'Experiment IDs are required'}), 400
    
    experiment_ids = data['experiment_ids']
    experiments = []
    
    for exp_id in experiment_ids:
        exp = experiment_manager.get_experiment(exp_id)
        if exp:
            experiments.append(exp)
    
    if len(experiments) < 2:
        return jsonify({'error': 'Need at least 2 experiments to compare'}), 400
    
    comparison = {
        'experiments': experiments,
        'metrics': {
            'final_loss': [],
            'epochs': [],
            'learning_rate': [],
            'hidden_layers': [],
            'activation': []
        },
        'loss_curves': []
    }
    
    for exp in experiments:
        config = exp.get('config', {})
        training_result = exp.get('data', {}).get('training_result', {})
        history = training_result.get('training_history', {})
        
        comparison['metrics']['final_loss'].append({
            'experiment_id': exp['id'],
            'value': training_result.get('final_loss')
        })
        comparison['metrics']['epochs'].append({
            'experiment_id': exp['id'],
            'value': config.get('epochs')
        })
        comparison['metrics']['learning_rate'].append({
            'experiment_id': exp['id'],
            'value': config.get('learning_rate')
        })
        comparison['metrics']['hidden_layers'].append({
            'experiment_id': exp['id'],
            'value': config.get('hidden_layers')
        })
        comparison['metrics']['activation'].append({
            'experiment_id': exp['id'],
            'value': config.get('activation')
        })
        
        comparison['loss_curves'].append({
            'experiment_id': exp['id'],
            'epochs': history.get('epoch', []),
            'loss': history.get('loss', [])
        })
    
    return jsonify(comparison)

if __name__ == '__main__':
    print("=" * 60)
    print("🧠 深度学习基础实验台 - 后端服务")
    print("=" * 60)
    print(f"数据目录: {Config.DATA_DIR}")
    print(f"实验目录: {Config.EXPERIMENTS_DIR}")
    print(f"报告目录: {Config.REPORTS_DIR}")
    print("=" * 60)
    print("启动服务: http://localhost:5000")
    print("API文档:")
    print("  - GET  /api/health          健康检查")
    print("  - GET  /api/datasets        获取可用数据集")
    print("  - GET  /api/bad-samples     获取坏样例配置")
    print("  - POST /api/validate        参数验证")
    print("  - POST /api/train/step-by-step  完整训练")
    print("  - POST /api/train/single-step    单步训练")
    print("  - GET  /api/experiments     实验列表")
    print("  - POST /api/experiments     创建实验")
    print("  - GET  /api/reports/<id>/markdown 生成Markdown报告")
    print("  - POST /api/compare         实验对比")
    print("=" * 60)
    
    app.run(host='0.0.0.0', port=5000, debug=True)
