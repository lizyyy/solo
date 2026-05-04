import numpy as np
import json
import uuid
from datetime import datetime
from typing import Dict, List, Tuple, Any, Optional, Callable
from ..optimizers import Optimizer, SGD, Momentum, Adagrad, RMSProp, Adam
from ..datasets import Dataset, LossFunction, MeanSquaredError, TwoDLossSurface
from ..datasets.synthetic import SyntheticDataset

class Experiment:
    def __init__(self, name: str = "Experiment", optimizer: Optional[Optimizer] = None,
                 dataset: Optional[Dataset] = None, loss_function: Optional[LossFunction] = None,
                 batch_size: int = 32, epochs: int = 100, seed: Optional[int] = None):
        self.id = str(uuid.uuid4())
        self.name = name
        self.optimizer = optimizer
        self.dataset = dataset
        self.loss_function = loss_function if loss_function else MeanSquaredError()
        self.batch_size = batch_size
        self.epochs = epochs
        self.seed = seed
        self.parameters = None
        self.current_epoch = 0
        self.is_running = False
        self.is_completed = False
        self.created_at = datetime.now().isoformat()
        self.updated_at = self.created_at
        self.metadata = {}
        
        if seed is not None:
            np.random.seed(seed)
    
    def initialize(self, initial_parameters: Optional[np.ndarray] = None):
        if self.dataset is None:
            raise ValueError("数据集未设置")
        
        if not self.dataset._initialized:
            self.dataset.load()
        
        feature_dim = self.dataset.feature_dim()
        
        if initial_parameters is None:
            initial_parameters = np.random.randn(feature_dim)
        
        self.parameters = initial_parameters.copy()
        
        if self.optimizer is not None:
            self.optimizer.initialize(self.parameters)
        
        self.current_epoch = 0
    
    def step(self) -> Dict[str, Any]:
        if self.optimizer is None:
            raise ValueError("优化器未设置")
        
        if self.dataset is None:
            raise ValueError("数据集未设置")
        
        if self.parameters is None:
            self.initialize()
        
        X_batch, y_batch = self.dataset.get_batch(self.batch_size)
        
        if isinstance(self.loss_function, TwoDLossSurface):
            loss = self.loss_function.compute(None, None, self.parameters)
            gradients = self.loss_function.gradient(None, None, None, self.parameters)
        else:
            y_pred = np.dot(X_batch, self.parameters)
            loss = self.loss_function.compute(y_pred, y_batch, self.parameters)
            gradients = self.loss_function.gradient(X_batch, y_pred, y_batch, self.parameters)
        
        self.parameters = self.optimizer.step(gradients, loss)
        self.current_epoch += 1
        self.updated_at = datetime.now().isoformat()
        
        return {
            'epoch': self.current_epoch,
            'loss': loss,
            'parameters': self.parameters.copy(),
            'gradients': gradients.copy()
        }
    
    def run(self, epochs: Optional[int] = None) -> Dict[str, Any]:
        epochs = epochs if epochs else self.epochs
        self.is_running = True
        
        history = {
            'epochs': [],
            'losses': [],
            'parameters': [],
            'gradients': []
        }
        
        try:
            for _ in range(epochs):
                result = self.step()
                history['epochs'].append(result['epoch'])
                history['losses'].append(result['loss'])
                history['parameters'].append(result['parameters'].copy())
                history['gradients'].append(result['gradients'].copy())
                
                if np.isnan(result['loss']) or np.isinf(result['loss']):
                    self.metadata['error'] = f"检测到异常损失值: {result['loss']}"
                    break
                    
        except Exception as e:
            self.metadata['error'] = str(e)
        finally:
            self.is_running = False
            self.is_completed = True
            self.updated_at = datetime.now().isoformat()
        
        return history
    
    def get_history(self) -> Dict[str, Any]:
        if self.optimizer is None:
            return {}
        
        history = self.optimizer.get_history()
        return {
            'parameters': [p.tolist() for p in history.get('parameters', [])],
            'gradients': [g.tolist() if g is not None else None for g in history.get('gradients', [])],
            'loss': history.get('loss', []),
            'timestamp': history.get('timestamp', [])
        }
    
    def analyze_behavior(self, threshold: float = 1e-5) -> Dict[str, Any]:
        if self.optimizer is None:
            return {'status': 'error', 'message': '优化器未设置'}
        
        return self.optimizer.analyze_behavior(threshold)
    
    def validate_configuration(self) -> List[Tuple[str, str]]:
        warnings = []
        
        if self.optimizer is None:
            warnings.append(('optimizer', '优化器未设置'))
        else:
            optimizer_warnings = self.optimizer.validate_parameters()
            warnings.extend(optimizer_warnings)
        
        if self.dataset is None:
            warnings.append(('dataset', '数据集未设置'))
        else:
            dataset_warnings = self.dataset.validate()
            warnings.extend(dataset_warnings)
        
        if self.batch_size <= 0:
            warnings.append(('batch_size', 'batch_size 必须大于0'))
        elif self.batch_size > 1024:
            warnings.append(('batch_size', 'batch_size 过大，可能导致内存问题'))
        
        if self.epochs <= 0:
            warnings.append(('epochs', 'epochs 必须大于0'))
        elif self.epochs > 10000:
            warnings.append(('epochs', 'epochs 过大，训练时间可能很长'))
        
        return warnings
    
    def get_state(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'name': self.name,
            'optimizer': self.optimizer.get_state() if self.optimizer else None,
            'optimizer_type': self.optimizer.__class__.__name__ if self.optimizer else None,
            'dataset': self.dataset.get_state() if self.dataset else None,
            'loss_function': self.loss_function.get_state() if self.loss_function else None,
            'parameters': self.parameters.tolist() if self.parameters is not None else None,
            'batch_size': self.batch_size,
            'epochs': self.epochs,
            'current_epoch': self.current_epoch,
            'seed': self.seed,
            'is_running': self.is_running,
            'is_completed': self.is_completed,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'metadata': self.metadata,
            'history': self.get_history()
        }
    
    def set_state(self, state: Dict[str, Any]):
        self.id = state.get('id', str(uuid.uuid4()))
        self.name = state.get('name', 'Experiment')
        self.batch_size = state.get('batch_size', 32)
        self.epochs = state.get('epochs', 100)
        self.current_epoch = state.get('current_epoch', 0)
        self.seed = state.get('seed')
        self.is_running = state.get('is_running', False)
        self.is_completed = state.get('is_completed', False)
        self.created_at = state.get('created_at', datetime.now().isoformat())
        self.updated_at = state.get('updated_at', datetime.now().isoformat())
        self.metadata = state.get('metadata', {})
        
        if state.get('parameters') is not None:
            self.parameters = np.array(state['parameters'])
        
        if state.get('optimizer_type') and state.get('optimizer'):
            optimizer_type = state['optimizer_type']
            optimizer_state = state['optimizer']
            
            if optimizer_type == 'SGD':
                self.optimizer = SGD()
            elif optimizer_type == 'Momentum':
                self.optimizer = Momentum()
            elif optimizer_type == 'Adagrad':
                self.optimizer = Adagrad()
            elif optimizer_type == 'RMSProp':
                self.optimizer = RMSProp()
            elif optimizer_type == 'Adam':
                self.optimizer = Adam()
            else:
                self.optimizer = None
            
            if self.optimizer:
                self.optimizer.set_state(optimizer_state)
    
    def __str__(self):
        return f"Experiment(id={self.id[:8]}, name={self.name}, optimizer={self.optimizer.__class__.__name__ if self.optimizer else 'None'})"
    
    def __repr__(self):
        return self.__str__()
