from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import json
import uuid
import pandas as pd
import numpy as np
from datetime import datetime
import joblib
import io

from src.data_processor import DataProcessor
from src.model_trainer import ModelTrainer
from src.evaluator import Evaluator
from src.experiment_manager import ExperimentManager
from src.report_generator import ReportGenerator

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = 'uploads'
EXPERIMENTS_FOLDER = 'experiments'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(EXPERIMENTS_FOLDER, exist_ok=True)

experiment_manager = ExperimentManager(EXPERIMENTS_FOLDER)


@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': '没有选择文件'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400
    
    if file and file.filename.endswith('.csv'):
        filename = str(uuid.uuid4()) + '.csv'
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)
        
        try:
            df = pd.read_csv(filepath)
            columns = df.columns.tolist()
            dtypes = df.dtypes.astype(str).to_dict()
            sample = df.head(5).to_dict('records')
            
            return jsonify({
                'file_id': filename,
                'columns': columns,
                'dtypes': dtypes,
                'shape': {'rows': len(df), 'columns': len(columns)},
                'sample': sample
            })
        except Exception as e:
            os.remove(filepath)
            return jsonify({'error': f'文件读取失败: {str(e)}'}), 400
    
    return jsonify({'error': '请上传CSV格式文件'}), 400


@app.route('/api/train', methods=['POST'])
def train_model():
    data = request.json
    file_id = data.get('file_id')
    target_column = data.get('target_column')
    feature_columns = data.get('feature_columns', [])
    task_type = data.get('task_type')
    model_types = data.get('model_types', [])
    test_size = data.get('test_size', 0.2)
    random_state = data.get('random_state', 42)
    
    if not all([file_id, target_column, task_type, model_types]):
        return jsonify({'error': '缺少必要参数'}), 400
    
    if task_type not in ['regression', 'classification']:
        return jsonify({'error': '任务类型必须是 regression 或 classification'}), 400
    
    valid_models = {
        'regression': ['linear_regression', 'decision_tree', 'random_forest', 'xgboost'],
        'classification': ['logistic_regression', 'decision_tree', 'random_forest', 'xgboost']
    }
    
    for model_type in model_types:
        if model_type not in valid_models[task_type]:
            return jsonify({'error': f'模型 {model_type} 不适用于 {task_type} 任务'}), 400
    
    filepath = os.path.join(UPLOAD_FOLDER, file_id)
    if not os.path.exists(filepath):
        return jsonify({'error': '文件不存在'}), 404
    
    try:
        df = pd.read_csv(filepath)
        
        if target_column not in df.columns:
            return jsonify({'error': f'目标列 {target_column} 不存在'}), 400
        
        for col in feature_columns:
            if col not in df.columns:
                return jsonify({'error': f'特征列 {col} 不存在'}), 400
        
        if not feature_columns:
            feature_columns = [c for c in df.columns if c != target_column]
        
        experiment_id = str(uuid.uuid4())[:8]
        experiment_folder = os.path.join(EXPERIMENTS_FOLDER, experiment_id)
        os.makedirs(experiment_folder, exist_ok=True)
        
        data_processor = DataProcessor()
        model_trainer = ModelTrainer()
        evaluator = Evaluator()
        
        X_train, X_test, y_train, y_test, preprocessor_info = data_processor.process(
            df, target_column, feature_columns, task_type, test_size, random_state
        )
        
        experiment = {
            'experiment_id': experiment_id,
            'created_at': datetime.now().isoformat(),
            'file_id': file_id,
            'target_column': target_column,
            'feature_columns': feature_columns,
            'task_type': task_type,
            'model_types': model_types,
            'test_size': test_size,
            'random_state': random_state,
            'data_shape': {'train': len(X_train), 'test': len(X_test)},
            'preprocessor_info': preprocessor_info,
            'models': {}
        }
        
        for model_type in model_types:
            model, model_params = model_trainer.train(
                X_train, y_train, model_type, task_type, random_state
            )
            
            y_train_pred = model.predict(X_train)
            y_test_pred = model.predict(X_test)
            
            y_test_proba = None
            if task_type == 'classification' and hasattr(model, 'predict_proba'):
                y_test_proba = model.predict_proba(X_test)
            
            metrics = evaluator.evaluate(
                y_test, y_test_pred, y_test_proba, task_type
            )
            
            feature_importance = evaluator.get_feature_importance(
                model, feature_columns, model_type
            )
            
            residuals = evaluator.get_residuals(y_test, y_test_pred) if task_type == 'regression' else None
            
            confusion_matrix_data = evaluator.get_confusion_matrix(
                y_test, y_test_pred
            ) if task_type == 'classification' else None
            
            model_path = os.path.join(experiment_folder, f'{model_type}_model.pkl')
            joblib.dump(model, model_path)
            
            experiment['models'][model_type] = {
                'model_params': model_params,
                'metrics': metrics,
                'feature_importance': feature_importance,
                'residuals': residuals,
                'confusion_matrix': confusion_matrix_data,
                'train_predictions': y_train_pred.tolist()[:100] if len(y_train_pred) > 100 else y_train_pred.tolist(),
                'test_predictions': y_test_pred.tolist()[:100] if len(y_test_pred) > 100 else y_test_pred.tolist(),
                'y_test': y_test.tolist()[:100] if len(y_test) > 100 else y_test.tolist()
            }
        
        experiment_manager.save_experiment(experiment)
        
        return jsonify({
            'experiment_id': experiment_id,
            'status': 'success',
            'experiment': experiment
        })
        
    except Exception as e:
        return jsonify({'error': f'训练失败: {str(e)}'}), 500


@app.route('/api/experiments', methods=['GET'])
def list_experiments():
    experiments = experiment_manager.list_experiments()
    return jsonify({'experiments': experiments})


@app.route('/api/experiments/<experiment_id>', methods=['GET'])
def get_experiment(experiment_id):
    experiment = experiment_manager.load_experiment(experiment_id)
    if not experiment:
        return jsonify({'error': '实验不存在'}), 404
    return jsonify(experiment)


@app.route('/api/compare', methods=['POST'])
def compare_experiments():
    data = request.json
    experiment_ids = data.get('experiment_ids', [])
    
    if len(experiment_ids) < 2:
        return jsonify({'error': '至少需要选择2个实验进行对比'}), 400
    
    experiments = []
    for exp_id in experiment_ids:
        exp = experiment_manager.load_experiment(exp_id)
        if exp:
            experiments.append(exp)
    
    if len(experiments) < 2:
        return jsonify({'error': '未能加载足够的实验数据'}), 400
    
    comparison = experiment_manager.compare_experiments(experiments)
    return jsonify({'comparison': comparison})


@app.route('/api/export/<experiment_id>/<format_type>', methods=['GET'])
def export_report(experiment_id, format_type):
    experiment = experiment_manager.load_experiment(experiment_id)
    if not experiment:
        return jsonify({'error': '实验不存在'}), 404
    
    report_generator = ReportGenerator()
    
    if format_type == 'markdown':
        markdown_content = report_generator.generate_markdown(experiment)
        output = io.BytesIO(markdown_content.encode('utf-8'))
        return send_file(
            output,
            mimetype='text/markdown',
            as_attachment=True,
            download_name=f'experiment_{experiment_id}_report.md'
        )
    elif format_type == 'json':
        json_content = json.dumps(experiment, indent=2, ensure_ascii=False)
        output = io.BytesIO(json_content.encode('utf-8'))
        return send_file(
            output,
            mimetype='application/json',
            as_attachment=True,
            download_name=f'experiment_{experiment_id}_report.json'
        )
    else:
        return jsonify({'error': '不支持的导出格式'}), 400


@app.route('/api/delete/<experiment_id>', methods=['DELETE'])
def delete_experiment(experiment_id):
    success = experiment_manager.delete_experiment(experiment_id)
    if success:
        return jsonify({'status': 'success', 'message': '实验已删除'})
    else:
        return jsonify({'error': '实验不存在'}), 404


@app.route('/')
def index():
    return send_file('static/index.html')


if __name__ == '__main__':
    os.makedirs('src', exist_ok=True)
    app.run(debug=True, host='0.0.0.0', port=5000)
