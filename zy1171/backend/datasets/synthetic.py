import numpy as np
from typing import Dict, List, Tuple, Any, Optional, Callable
from .dataset import Dataset

class SyntheticDataset(Dataset):
    def __init__(self, name: str = "SyntheticDataset", seed: Optional[int] = None, 
                 dataset_type: str = "linear_regression", size: int = 100, 
                 feature_dim: int = 2, noise: float = 0.1):
        super().__init__(name=name, seed=seed)
        self.dataset_type = dataset_type
        self.size = size
        self.feature_dim = feature_dim
        self.noise = noise
        self.true_parameters = None
        self.loss_surface_function = None
    
    def load(self) -> Tuple[np.ndarray, np.ndarray]:
        if self.dataset_type == "linear_regression":
            self._create_linear_regression_data()
        elif self.dataset_type == "nonlinear_regression":
            self._create_nonlinear_regression_data()
        elif self.dataset_type == "classification":
            self._create_classification_data()
        elif self.dataset_type == "loss_surface_2d":
            self._create_2d_loss_surface_data()
        elif self.dataset_type == "custom":
            if self.loss_surface_function is None:
                raise ValueError("自定义数据集需要先设置 loss_surface_function")
            self._create_custom_data()
        else:
            raise ValueError(f"不支持的数据集类型: {self.dataset_type}")
        
        self._initialized = True
        return self.X, self.y
    
    def _create_linear_regression_data(self):
        self.X = np.random.randn(self.size, self.feature_dim)
        self.true_parameters = np.random.randn(self.feature_dim)
        noise = np.random.randn(self.size) * self.noise
        self.y = np.dot(self.X, self.true_parameters) + noise
    
    def _create_nonlinear_regression_data(self):
        self.X = np.random.randn(self.size, self.feature_dim)
        self.true_parameters = np.random.randn(self.feature_dim)
        noise = np.random.randn(self.size) * self.noise
        
        z = np.dot(self.X, self.true_parameters)
        self.y = np.sin(z) + 0.5 * z + noise
    
    def _create_classification_data(self):
        self.X = np.random.randn(self.size, self.feature_dim)
        self.true_parameters = np.random.randn(self.feature_dim)
        noise = np.random.randn(self.size) * self.noise
        
        z = np.dot(self.X, self.true_parameters) + noise
        self.y = (z > 0).astype(int)
    
    def _create_2d_loss_surface_data(self):
        x1 = np.linspace(-5, 5, 100)
        x2 = np.linspace(-5, 5, 100)
        X1, X2 = np.meshgrid(x1, x2)
        
        self.loss_surface_data = {
            'X1': X1,
            'X2': X2,
            'x1': x1,
            'x2': x2
        }
        
        self.X = np.column_stack([X1.flatten(), X2.flatten()])
        self.y = self._compute_2d_loss(self.X[:, 0], self.X[:, 1])
    
    def _compute_2d_loss(self, x1, x2):
        return (x1 ** 2 + x2 ** 2) + 0.5 * np.sin(5 * x1) + 0.5 * np.sin(5 * x2)
    
    def _create_custom_data(self):
        if self.loss_surface_function is None:
            raise ValueError("loss_surface_function 未设置")
        
        x1 = np.linspace(-5, 5, 100)
        x2 = np.linspace(-5, 5, 100)
        X1, X2 = np.meshgrid(x1, x2)
        
        self.loss_surface_data = {
            'X1': X1,
            'X2': X2,
            'x1': x1,
            'x2': x2
        }
        
        self.X = np.column_stack([X1.flatten(), X2.flatten()])
        self.y = self.loss_surface_function(self.X[:, 0], self.X[:, 1])
    
    def set_custom_loss_surface(self, function: Callable[[np.ndarray, np.ndarray], np.ndarray]):
        self.loss_surface_function = function
        self.dataset_type = "custom"
    
    def get_loss_surface(self) -> Optional[Dict[str, Any]]:
        if hasattr(self, 'loss_surface_data') and self.loss_surface_data is not None:
            if self.dataset_type == "loss_surface_2d" or self.dataset_type == "custom":
                loss = self._compute_2d_loss(
                    self.loss_surface_data['X1'], 
                    self.loss_surface_data['X2']
                ) if self.dataset_type == "loss_surface_2d" else self.loss_surface_function(
                    self.loss_surface_data['X1'], 
                    self.loss_surface_data['X2']
                )
                return {
                    'X1': self.loss_surface_data['X1'].tolist(),
                    'X2': self.loss_surface_data['X2'].tolist(),
                    'loss': loss.tolist(),
                    'x1': self.loss_surface_data['x1'].tolist(),
                    'x2': self.loss_surface_data['x2'].tolist()
                }
        return None
    
    def get_true_parameters(self) -> Optional[np.ndarray]:
        return self.true_parameters.copy() if self.true_parameters is not None else None
    
    def get_state(self) -> Dict[str, Any]:
        state = super().get_state()
        state.update({
            'dataset_type': self.dataset_type,
            'size': self.size,
            'feature_dim': self.feature_dim,
            'noise': self.noise,
            'true_parameters': self.true_parameters.tolist() if self.true_parameters is not None else None
        })
        if hasattr(self, 'loss_surface_data') and self.loss_surface_data is not None:
            state['loss_surface'] = self.get_loss_surface()
        return state
    
    @classmethod
    def get_available_types(cls) -> List[str]:
        return ["linear_regression", "nonlinear_regression", "classification", "loss_surface_2d", "custom"]
    
    def __str__(self):
        if self._initialized:
            return f"SyntheticDataset(type={self.dataset_type}, size={self.size}, feature_dim={self.feature_dim})"
        return f"SyntheticDataset(type={self.dataset_type}, size={self.size}, feature_dim={self.feature_dim}, not initialized)"
