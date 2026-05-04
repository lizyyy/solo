import numpy as np
from typing import Dict, List, Tuple, Any, Optional, Callable
from abc import ABC, abstractmethod

class Dataset(ABC):
    def __init__(self, name: str = "Dataset", seed: Optional[int] = None):
        self.name = name
        self.seed = seed
        self.X = None
        self.y = None
        self._initialized = False
        
        if seed is not None:
            np.random.seed(seed)
    
    @abstractmethod
    def load(self) -> Tuple[np.ndarray, np.ndarray]:
        pass
    
    def get_batch(self, batch_size: int) -> Tuple[np.ndarray, np.ndarray]:
        if not self._initialized:
            raise RuntimeError("数据集未加载，请先调用 load() 方法")
        
        if batch_size <= 0:
            raise ValueError("batch_size 必须大于0")
        
        indices = np.random.choice(len(self.X), size=min(batch_size, len(self.X)), replace=False)
        return self.X[indices], self.y[indices]
    
    def get_all(self) -> Tuple[np.ndarray, np.ndarray]:
        if not self._initialized:
            raise RuntimeError("数据集未加载，请先调用 load() 方法")
        return self.X, self.y
    
    def size(self) -> int:
        if not self._initialized:
            raise RuntimeError("数据集未加载，请先调用 load() 方法")
        return len(self.X)
    
    def feature_dim(self) -> int:
        if not self._initialized:
            raise RuntimeError("数据集未加载，请先调用 load() 方法")
        return self.X.shape[1] if len(self.X.shape) > 1 else 1
    
    def get_state(self) -> Dict[str, Any]:
        return {
            'name': self.name,
            'seed': self.seed,
            'X': self.X.tolist() if self.X is not None else None,
            'y': self.y.tolist() if self.y is not None else None,
            'initialized': self._initialized
        }
    
    def set_state(self, state: Dict[str, Any]):
        self.name = state.get('name', 'Dataset')
        self.seed = state.get('seed')
        if state.get('X') is not None:
            self.X = np.array(state['X'])
        if state.get('y') is not None:
            self.y = np.array(state['y'])
        self._initialized = state.get('initialized', False)
    
    def validate(self) -> List[Tuple[str, str]]:
        warnings = []
        if not self._initialized:
            warnings.append(('dataset', '数据集未加载'))
            return warnings
        
        if len(self.X) == 0:
            warnings.append(('dataset', '数据集为空'))
        if len(self.X) != len(self.y):
            warnings.append(('dataset', 'X 和 y 的样本数量不一致'))
        if np.isnan(self.X).any():
            warnings.append(('dataset', 'X 包含 NaN 值'))
        if np.isnan(self.y).any():
            warnings.append(('dataset', 'y 包含 NaN 值'))
        if np.isinf(self.X).any():
            warnings.append(('dataset', 'X 包含无穷大值'))
        if np.isinf(self.y).any():
            warnings.append(('dataset', 'y 包含无穷大值'))
        
        return warnings
    
    def __str__(self):
        if self._initialized:
            return f"Dataset(name={self.name}, size={self.size()}, feature_dim={self.feature_dim()})"
        return f"Dataset(name={self.name}, seed={self.seed}, not initialized)"
    
    def __repr__(self):
        return self.__str__()
