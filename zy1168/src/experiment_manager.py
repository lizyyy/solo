import os
import json
import shutil
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')


class ExperimentManager:
    def __init__(self, experiments_dir):
        self.experiments_dir = experiments_dir
        os.makedirs(experiments_dir, exist_ok=True)
    
    def save_experiment(self, experiment):
        experiment_id = experiment['experiment_id']
        experiment_path = os.path.join(self.experiments_dir, experiment_id)
        
        os.makedirs(experiment_path, exist_ok=True)
        
        metadata_path = os.path.join(experiment_path, 'metadata.json')
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(experiment, f, ensure_ascii=False, indent=2, default=str)
        
        return experiment_id
    
    def load_experiment(self, experiment_id):
        experiment_path = os.path.join(self.experiments_dir, experiment_id)
        metadata_path = os.path.join(experiment_path, 'metadata.json')
        
        if not os.path.exists(metadata_path):
            return None
        
        with open(metadata_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def list_experiments(self):
        experiments = []
        
        if not os.path.exists(self.experiments_dir):
            return experiments
        
        for exp_id in os.listdir(self.experiments_dir):
            exp_path = os.path.join(self.experiments_dir, exp_id)
            metadata_path = os.path.join(exp_path, 'metadata.json')
            
            if os.path.isdir(exp_path) and os.path.exists(metadata_path):
                try:
                    with open(metadata_path, 'r', encoding='utf-8') as f:
                        metadata = json.load(f)
                    
                    experiments.append({
                        'experiment_id': exp_id,
                        'created_at': metadata.get('created_at', ''),
                        'task_type': metadata.get('task_type', ''),
                        'target_column': metadata.get('target_column', ''),
                        'model_types': metadata.get('model_types', []),
                        'data_shape': metadata.get('data_shape', {}),
                        'model_count': len(metadata.get('models', {}))
                    })
                except:
                    continue
        
        experiments.sort(key=lambda x: x['created_at'], reverse=True)
        return experiments
    
    def delete_experiment(self, experiment_id):
        experiment_path = os.path.join(self.experiments_dir, experiment_id)
        
        if not os.path.exists(experiment_path):
            return False
        
        try:
            shutil.rmtree(experiment_path)
            return True
        except:
            return False
    
    def compare_experiments(self, experiments):
        if len(experiments) < 2:
            return None
        
        comparison = {
            'summary': {
                'experiment_count': len(experiments),
                'experiment_ids': [exp['experiment_id'] for exp in experiments]
            },
            'experiments_info': [],
            'metrics_comparison': {},
            'model_comparison': {}
        }
        
        for exp in experiments:
            comparison['experiments_info'].append({
                'experiment_id': exp['experiment_id'],
                'created_at': exp.get('created_at', ''),
                'task_type': exp.get('task_type', ''),
                'target_column': exp.get('target_column', ''),
                'feature_columns': exp.get('feature_columns', []),
                'model_types': exp.get('model_types', []),
                'train_size': exp.get('data_shape', {}).get('train', 0),
                'test_size': exp.get('data_shape', {}).get('test', 0)
            })
        
        all_metrics = set()
        all_models = set()
        
        for exp in experiments:
            for model_name, model_data in exp.get('models', {}).items():
                all_models.add(model_name)
                for metric_name in model_data.get('metrics', {}).keys():
                    all_metrics.add(metric_name)
        
        for metric in all_metrics:
            comparison['metrics_comparison'][metric] = []
            for exp in experiments:
                exp_metrics = {}
                for model_name, model_data in exp.get('models', {}).items():
                    metric_value = model_data.get('metrics', {}).get(metric)
                    exp_metrics[model_name] = metric_value
                comparison['metrics_comparison'][metric].append({
                    'experiment_id': exp['experiment_id'],
                    'values': exp_metrics
                })
        
        for model in all_models:
            comparison['model_comparison'][model] = []
            for exp in experiments:
                model_data = exp.get('models', {}).get(model)
                if model_data:
                    comparison['model_comparison'][model].append({
                        'experiment_id': exp['experiment_id'],
                        'metrics': model_data.get('metrics', {}),
                        'feature_importance': model_data.get('feature_importance')
                    })
        
        return comparison
    
    def get_best_model(self, experiments, metric, task_type, higher_is_better=True):
        best_value = None
        best_info = None
        
        for exp in experiments:
            for model_name, model_data in exp.get('models', {}).items():
                value = model_data.get('metrics', {}).get(metric)
                
                if value is None:
                    continue
                
                if best_value is None:
                    best_value = value
                    best_info = {
                        'experiment_id': exp['experiment_id'],
                        'model_name': model_name,
                        'metric': metric,
                        'value': value,
                        'metrics': model_data.get('metrics', {}),
                        'model_params': model_data.get('model_params', {})
                    }
                else:
                    if higher_is_better:
                        if value > best_value:
                            best_value = value
                            best_info = {
                                'experiment_id': exp['experiment_id'],
                                'model_name': model_name,
                                'metric': metric,
                                'value': value,
                                'metrics': model_data.get('metrics', {}),
                                'model_params': model_data.get('model_params', {})
                            }
                    else:
                        if value < best_value:
                            best_value = value
                            best_info = {
                                'experiment_id': exp['experiment_id'],
                                'model_name': model_name,
                                'metric': metric,
                                'value': value,
                                'metrics': model_data.get('metrics', {}),
                                'model_params': model_data.get('model_params', {})
                            }
        
        return best_info
