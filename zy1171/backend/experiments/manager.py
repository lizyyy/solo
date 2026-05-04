import os
import json
import numpy as np
from datetime import datetime
from typing import Dict, List, Tuple, Any, Optional
from .experiment import Experiment

class ExperimentManager:
    def __init__(self, storage_dir: str = "./experiments"):
        self.storage_dir = storage_dir
        self.experiments: Dict[str, Experiment] = {}
        
        if not os.path.exists(self.storage_dir):
            os.makedirs(self.storage_dir, exist_ok=True)
    
    def create_experiment(self, name: str, optimizer_config: Dict[str, Any],
                          dataset_config: Dict[str, Any], batch_size: int = 32,
                          epochs: int = 100, seed: Optional[int] = None) -> Experiment:
        from ..optimizers import SGD, Momentum, Adagrad, RMSProp, Adam
        from ..datasets import SyntheticDataset, MeanSquaredError, TwoDLossSurface
        
        optimizer_type = optimizer_config.get('type', 'SGD')
        optimizer_params = optimizer_config.get('params', {})
        
        if optimizer_type == 'SGD':
            optimizer = SGD(**optimizer_params)
        elif optimizer_type == 'Momentum':
            optimizer = Momentum(**optimizer_params)
        elif optimizer_type == 'Adagrad':
            optimizer = Adagrad(**optimizer_params)
        elif optimizer_type == 'RMSProp':
            optimizer = RMSProp(**optimizer_params)
        elif optimizer_type == 'Adam':
            optimizer = Adam(**optimizer_params)
        else:
            raise ValueError(f"不支持的优化器类型: {optimizer_type}")
        
        dataset_type = dataset_config.get('type', 'linear_regression')
        dataset_params = dataset_config.get('params', {})
        dataset = SyntheticDataset(dataset_type=dataset_type, **dataset_params)
        
        loss_function = MeanSquaredError()
        if dataset_type == 'loss_surface_2d' or dataset_type == 'custom':
            from ..datasets.synthetic import SyntheticDataset
            if dataset_type == 'loss_surface_2d':
                def loss_fn(x, y):
                    return (x ** 2 + y ** 2) + 0.5 * np.sin(5 * x) + 0.5 * np.sin(5 * y)
                loss_function = TwoDLossSurface(loss_fn)
            elif 'loss_surface_fn' in dataset_params:
                loss_function = TwoDLossSurface(dataset_params['loss_surface_fn'])
        
        experiment = Experiment(
            name=name,
            optimizer=optimizer,
            dataset=dataset,
            loss_function=loss_function,
            batch_size=batch_size,
            epochs=epochs,
            seed=seed
        )
        
        self.experiments[experiment.id] = experiment
        return experiment
    
    def get_experiment(self, experiment_id: str) -> Optional[Experiment]:
        return self.experiments.get(experiment_id)
    
    def list_experiments(self) -> List[Dict[str, Any]]:
        return [
            {
                'id': exp.id,
                'name': exp.name,
                'optimizer_type': exp.optimizer.__class__.__name__ if exp.optimizer else None,
                'is_completed': exp.is_completed,
                'is_running': exp.is_running,
                'current_epoch': exp.current_epoch,
                'created_at': exp.created_at,
                'updated_at': exp.updated_at
            }
            for exp in self.experiments.values()
        ]
    
    def run_experiment(self, experiment_id: str, epochs: Optional[int] = None) -> Dict[str, Any]:
        experiment = self.get_experiment(experiment_id)
        if experiment is None:
            raise ValueError(f"实验不存在: {experiment_id}")
        
        return experiment.run(epochs)
    
    def step_experiment(self, experiment_id: str) -> Dict[str, Any]:
        experiment = self.get_experiment(experiment_id)
        if experiment is None:
            raise ValueError(f"实验不存在: {experiment_id}")
        
        return experiment.step()
    
    def compare_experiments(self, experiment_ids: List[str]) -> Dict[str, Any]:
        experiments = [self.get_experiment(eid) for eid in experiment_ids]
        experiments = [exp for exp in experiments if exp is not None]
        
        if not experiments:
            return {'error': '没有找到有效的实验'}
        
        comparison = {
            'experiment_ids': [exp.id for exp in experiments],
            'experiment_names': [exp.name for exp in experiments],
            'optimizer_types': [exp.optimizer.__class__.__name__ if exp.optimizer else 'None' for exp in experiments],
            'metrics': [],
            'loss_comparison': {},
            'behavior_analysis': {}
        }
        
        min_epochs = min(len(exp.get_history().get('loss', [])) for exp in experiments)
        
        for i, exp in enumerate(experiments):
            history = exp.get_history()
            losses = history.get('loss', [])[:min_epochs]
            params = history.get('parameters', [])[:min_epochs]
            
            if losses:
                comparison['loss_comparison'][exp.id] = {
                    'name': exp.name,
                    'optimizer': exp.optimizer.__class__.__name__ if exp.optimizer else 'None',
                    'initial_loss': losses[0],
                    'final_loss': losses[-1],
                    'min_loss': min(losses),
                    'loss_reduction': losses[0] - losses[-1] if losses else 0,
                    'losses': losses
                }
                
                behavior = exp.analyze_behavior()
                comparison['behavior_analysis'][exp.id] = {
                    'name': exp.name,
                    'analysis': behavior
                }
        
        comparison['metrics'] = self._calculate_comparison_metrics(experiments)
        
        return comparison
    
    def _calculate_comparison_metrics(self, experiments: List[Experiment]) -> List[Dict[str, Any]]:
        metrics = []
        
        for exp in experiments:
            history = exp.get_history()
            losses = history.get('loss', [])
            
            if not losses:
                continue
            
            final_loss = losses[-1]
            initial_loss = losses[0]
            loss_reduction = initial_loss - final_loss
            loss_reduction_ratio = loss_reduction / initial_loss if initial_loss > 0 else 0
            
            if len(losses) > 1:
                loss_diff = np.diff(losses)
                oscillation_count = np.sum(loss_diff > 0)
                oscillation_ratio = oscillation_count / len(loss_diff)
            else:
                oscillation_ratio = 0
            
            metrics.append({
                'experiment_id': exp.id,
                'experiment_name': exp.name,
                'optimizer_type': exp.optimizer.__class__.__name__ if exp.optimizer else 'None',
                'final_loss': final_loss,
                'initial_loss': initial_loss,
                'loss_reduction': loss_reduction,
                'loss_reduction_ratio': loss_reduction_ratio,
                'oscillation_ratio': oscillation_ratio,
                'epochs_completed': exp.current_epoch
            })
        
        return sorted(metrics, key=lambda x: x['final_loss'])
    
    def save_experiment(self, experiment_id: str, filename: Optional[str] = None) -> str:
        experiment = self.get_experiment(experiment_id)
        if experiment is None:
            raise ValueError(f"实验不存在: {experiment_id}")
        
        if filename is None:
            filename = f"{experiment.name}_{experiment.id[:8]}.json"
        
        filepath = os.path.join(self.storage_dir, filename)
        
        state = experiment.get_state()
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(state, f, indent=2, ensure_ascii=False)
        
        return filepath
    
    def load_experiment(self, filepath: str) -> Experiment:
        if not os.path.exists(filepath):
            raise ValueError(f"文件不存在: {filepath}")
        
        with open(filepath, 'r', encoding='utf-8') as f:
            state = json.load(f)
        
        experiment = Experiment(name=state.get('name', 'LoadedExperiment'))
        experiment.set_state(state)
        
        self.experiments[experiment.id] = experiment
        return experiment
    
    def save_all(self) -> List[str]:
        saved_files = []
        for exp_id in self.experiments:
            try:
                filepath = self.save_experiment(exp_id)
                saved_files.append(filepath)
            except Exception as e:
                print(f"保存实验 {exp_id} 失败: {e}")
        return saved_files
    
    def load_all(self) -> List[Experiment]:
        loaded_experiments = []
        for filename in os.listdir(self.storage_dir):
            if filename.endswith('.json'):
                filepath = os.path.join(self.storage_dir, filename)
                try:
                    experiment = self.load_experiment(filepath)
                    loaded_experiments.append(experiment)
                except Exception as e:
                    print(f"加载实验 {filename} 失败: {e}")
        return loaded_experiments
    
    def delete_experiment(self, experiment_id: str) -> bool:
        if experiment_id in self.experiments:
            del self.experiments[experiment_id]
            return True
        return False
    
    def __str__(self):
        return f"ExperimentManager(storage_dir={self.storage_dir}, experiments={len(self.experiments)})"
    
    def __repr__(self):
        return self.__str__()
