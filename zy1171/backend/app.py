import os
import sys
import json
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.experiments import Experiment, ExperimentManager
from backend.reports import ReportGenerator

app = Flask(__name__, static_folder='../frontend')
CORS(app)

experiment_manager = ExperimentManager()
report_generator = ReportGenerator()

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory(app.static_folder, path)

@app.route('/api/experiments', methods=['GET'])
def list_experiments():
    try:
        experiments = experiment_manager.list_experiments()
        return jsonify(experiments)
    except Exception as e:
        return jsonify({'error': True, 'message': str(e)}), 500

@app.route('/api/experiments', methods=['POST'])
def create_experiment():
    try:
        data = request.get_json()
        name = data.get('name', 'Experiment')
        optimizer_config = data.get('optimizer_config', {'type': 'SGD', 'params': {}})
        dataset_config = data.get('dataset_config', {'type': 'linear_regression', 'params': {}})
        batch_size = data.get('batch_size', 32)
        epochs = data.get('epochs', 100)
        seed = data.get('seed')
        
        experiment = experiment_manager.create_experiment(
            name=name,
            optimizer_config=optimizer_config,
            dataset_config=dataset_config,
            batch_size=batch_size,
            epochs=epochs,
            seed=seed
        )
        
        warnings = experiment.validate_configuration()
        
        return jsonify({
            'id': experiment.id,
            'name': experiment.name,
            'warnings': warnings
        })
    except Exception as e:
        return jsonify({'error': True, 'message': str(e)}), 500

@app.route('/api/experiments/<experiment_id>', methods=['GET'])
def get_experiment(experiment_id):
    try:
        experiment = experiment_manager.get_experiment(experiment_id)
        if experiment is None:
            return jsonify({'error': True, 'message': '实验不存在'}), 404
        
        state = experiment.get_state()
        return jsonify(state)
    except Exception as e:
        return jsonify({'error': True, 'message': str(e)}), 500

@app.route('/api/experiments/<experiment_id>/run', methods=['POST'])
def run_experiment(experiment_id):
    try:
        data = request.get_json() or {}
        epochs = data.get('epochs')
        
        result = experiment_manager.run_experiment(experiment_id, epochs)
        
        return jsonify({
            'status': 'success',
            'epochs_completed': len(result.get('losses', [])),
            'final_loss': result.get('losses', [])[-1] if result.get('losses') else None
        })
    except Exception as e:
        return jsonify({'error': True, 'message': str(e)}), 500

@app.route('/api/experiments/<experiment_id>/step', methods=['POST'])
def step_experiment(experiment_id):
    try:
        result = experiment_manager.step_experiment(experiment_id)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': True, 'message': str(e)}), 500

@app.route('/api/experiments/<experiment_id>/analyze', methods=['GET'])
def analyze_experiment(experiment_id):
    try:
        experiment = experiment_manager.get_experiment(experiment_id)
        if experiment is None:
            return jsonify({'error': True, 'message': '实验不存在'}), 404
        
        analysis = experiment.analyze_behavior()
        return jsonify(analysis)
    except Exception as e:
        return jsonify({'error': True, 'message': str(e)}), 500

@app.route('/api/experiments/<experiment_id>/validate', methods=['GET'])
def validate_experiment(experiment_id):
    try:
        experiment = experiment_manager.get_experiment(experiment_id)
        if experiment is None:
            return jsonify({'error': True, 'message': '实验不存在'}), 404
        
        warnings = experiment.validate_configuration()
        return jsonify({'warnings': warnings})
    except Exception as e:
        return jsonify({'error': True, 'message': str(e)}), 500

@app.route('/api/experiments/<experiment_id>/loss_surface', methods=['GET'])
def get_loss_surface(experiment_id):
    try:
        experiment = experiment_manager.get_experiment(experiment_id)
        if experiment is None:
            return jsonify({'error': True, 'message': '实验不存在'}), 404
        
        if experiment.dataset is None:
            return jsonify({'error': True, 'message': '数据集未设置'}), 400
        
        from backend.datasets.synthetic import SyntheticDataset
        if isinstance(experiment.dataset, SyntheticDataset):
            surface = experiment.dataset.get_loss_surface()
            if surface:
                return jsonify(surface)
        
        return jsonify({'error': True, 'message': '该数据集不支持损失面可视化'}), 400
    except Exception as e:
        return jsonify({'error': True, 'message': str(e)}), 500

@app.route('/api/experiments/compare', methods=['POST'])
def compare_experiments():
    try:
        data = request.get_json()
        experiment_ids = data.get('experiment_ids', [])
        
        if len(experiment_ids) < 2:
            return jsonify({'error': True, 'message': '至少需要选择2个实验进行对比'}), 400
        
        comparison = experiment_manager.compare_experiments(experiment_ids)
        return jsonify(comparison)
    except Exception as e:
        return jsonify({'error': True, 'message': str(e)}), 500

@app.route('/api/experiments/save_all', methods=['POST'])
def save_all_experiments():
    try:
        saved_files = experiment_manager.save_all()
        return jsonify({
            'status': 'success',
            'saved': len(saved_files),
            'files': saved_files
        })
    except Exception as e:
        return jsonify({'error': True, 'message': str(e)}), 500

@app.route('/api/experiments/load_all', methods=['POST'])
def load_all_experiments():
    try:
        loaded = experiment_manager.load_all()
        return jsonify({
            'status': 'success',
            'loaded': len(loaded)
        })
    except Exception as e:
        return jsonify({'error': True, 'message': str(e)}), 500

@app.route('/api/experiments/<experiment_id>/report', methods=['POST'])
def generate_report(experiment_id):
    try:
        data = request.get_json() or {}
        format = data.get('format', 'markdown')
        include_history = data.get('include_history', True)
        include_analysis = data.get('include_analysis', True)
        
        experiment = experiment_manager.get_experiment(experiment_id)
        if experiment is None:
            return jsonify({'error': True, 'message': '实验不存在'}), 404
        
        if format == 'json':
            report = experiment.get_state()
            filepath = report_generator.save_report(
                json.dumps(report, indent=2, ensure_ascii=False),
                f"report_{experiment.name}",
                'json'
            )
        else:
            report = report_generator.generate_markdown_report(
                experiment,
                include_history=include_history,
                include_analysis=include_analysis
            )
            filepath = report_generator.save_report(
                report,
                f"report_{experiment.name}",
                'markdown'
            )
        
        return jsonify({
            'status': 'success',
            'format': format,
            'filepath': filepath,
            'report': report
        })
    except Exception as e:
        return jsonify({'error': True, 'message': str(e)}), 500

@app.route('/api/experiments/compare_report', methods=['POST'])
def generate_comparison_report():
    try:
        data = request.get_json() or {}
        experiment_ids = data.get('experiment_ids', [])
        format = data.get('format', 'markdown')
        
        if len(experiment_ids) < 2:
            return jsonify({'error': True, 'message': '至少需要选择2个实验进行对比'}), 400
        
        report = report_generator.generate_comparison_report(
            experiment_manager,
            experiment_ids,
            format
        )
        
        filepath = report_generator.save_report(
            report,
            f"comparison_report_{'_'.join([eid[:8] for eid in experiment_ids])}",
            format
        )
        
        return jsonify({
            'status': 'success',
            'format': format,
            'filepath': filepath,
            'report': report
        })
    except Exception as e:
        return jsonify({'error': True, 'message': str(e)}), 500

@app.route('/api/optimizers', methods=['GET'])
def list_optimizers():
    return jsonify([
        {'type': 'SGD', 'description': '随机梯度下降', 'params': ['learning_rate']},
        {'type': 'Momentum', 'description': '带动量的SGD', 'params': ['learning_rate', 'momentum']},
        {'type': 'Adagrad', 'description': 'Adaptive Gradient', 'params': ['learning_rate', 'epsilon']},
        {'type': 'RMSProp', 'description': 'Root Mean Square Propagation', 'params': ['learning_rate', 'beta', 'epsilon']},
        {'type': 'Adam', 'description': 'Adaptive Moment Estimation', 'params': ['learning_rate', 'beta1', 'beta2', 'epsilon']}
    ])

@app.route('/api/datasets', methods=['GET'])
def list_datasets():
    from backend.datasets.synthetic import SyntheticDataset
    return jsonify([
        {'type': 'linear_regression', 'description': '线性回归数据集'},
        {'type': 'nonlinear_regression', 'description': '非线性回归数据集'},
        {'type': 'classification', 'description': '分类数据集'},
        {'type': 'loss_surface_2d', 'description': '2D损失面可视化数据集'}
    ])

if __name__ == '__main__':
    print("=" * 60)
    print("优化算法实验台服务器启动中...")
    print("=" * 60)
    print(f"服务器地址: http://localhost:5000")
    print(f"API地址: http://localhost:5000/api")
    print("=" * 60)
    app.run(host='0.0.0.0', port=5000, debug=True)
