import numpy as np
from typing import Dict, List, Tuple, Any, Optional, Callable
from abc import ABC, abstractmethod

class LossFunction(ABC):
    def __init__(self, name: str = "LossFunction"):
        self.name = name
    
    @abstractmethod
    def compute(self, y_pred: np.ndarray, y_true: np.ndarray, parameters: Optional[np.ndarray] = None) -> float:
        pass
    
    @abstractmethod
    def gradient(self, X: np.ndarray, y_pred: np.ndarray, y_true: np.ndarray, 
                 parameters: Optional[np.ndarray] = None) -> np.ndarray:
        pass
    
    def __call__(self, y_pred: np.ndarray, y_true: np.ndarray, parameters: Optional[np.ndarray] = None) -> float:
        return self.compute(y_pred, y_true, parameters)
    
    def get_state(self) -> Dict[str, Any]:
        return {'name': self.name}
    
    def set_state(self, state: Dict[str, Any]):
        self.name = state.get('name', 'LossFunction')
    
    def __str__(self):
        return f"LossFunction(name={self.name})"
    
    def __repr__(self):
        return self.__str__()

class MeanSquaredError(LossFunction):
    def __init__(self):
        super().__init__(name="MeanSquaredError")
    
    def compute(self, y_pred: np.ndarray, y_true: np.ndarray, parameters: Optional[np.ndarray] = None) -> float:
        return np.mean((y_pred - y_true) ** 2) / 2
    
    def gradient(self, X: np.ndarray, y_pred: np.ndarray, y_true: np.ndarray, 
                 parameters: Optional[np.ndarray] = None) -> np.ndarray:
        n_samples = len(y_true)
        return np.dot(X.T, (y_pred - y_true)) / n_samples
    
    def __str__(self):
        return f"MeanSquaredError()"

class CrossEntropy(LossFunction):
    def __init__(self, epsilon: float = 1e-15):
        super().__init__(name="CrossEntropy")
        self.epsilon = epsilon
    
    def compute(self, y_pred: np.ndarray, y_true: np.ndarray, parameters: Optional[np.ndarray] = None) -> float:
        y_pred = np.clip(y_pred, self.epsilon, 1 - self.epsilon)
        return -np.mean(y_true * np.log(y_pred) + (1 - y_true) * np.log(1 - y_pred))
    
    def gradient(self, X: np.ndarray, y_pred: np.ndarray, y_true: np.ndarray, 
                 parameters: Optional[np.ndarray] = None) -> np.ndarray:
        n_samples = len(y_true)
        y_pred = np.clip(y_pred, self.epsilon, 1 - self.epsilon)
        return np.dot(X.T, (y_pred - y_true)) / n_samples
    
    def get_state(self) -> Dict[str, Any]:
        state = super().get_state()
        state['epsilon'] = self.epsilon
        return state
    
    def set_state(self, state: Dict[str, Any]):
        super().set_state(state)
        self.epsilon = state.get('epsilon', 1e-15)
    
    def __str__(self):
        return f"CrossEntropy(epsilon={self.epsilon})"

class CustomLoss(LossFunction):
    def __init__(self, loss_function: Callable[[np.ndarray, np.ndarray, Optional[np.ndarray]], float],
                 gradient_function: Callable[[np.ndarray, np.ndarray, np.ndarray, Optional[np.ndarray]], np.ndarray],
                 name: str = "CustomLoss"):
        super().__init__(name=name)
        self.loss_function = loss_function
        self.gradient_function = gradient_function
    
    def compute(self, y_pred: np.ndarray, y_true: np.ndarray, parameters: Optional[np.ndarray] = None) -> float:
        return self.loss_function(y_pred, y_true, parameters)
    
    def gradient(self, X: np.ndarray, y_pred: np.ndarray, y_true: np.ndarray, 
                 parameters: Optional[np.ndarray] = None) -> np.ndarray:
        return self.gradient_function(X, y_pred, y_true, parameters)
    
    def __str__(self):
        return f"CustomLoss(name={self.name})"

class TwoDLossSurface(LossFunction):
    def __init__(self, loss_surface_fn: Callable[[np.ndarray, np.ndarray], np.ndarray]):
        super().__init__(name="TwoDLossSurface")
        self.loss_surface_fn = loss_surface_fn
    
    def compute(self, y_pred: np.ndarray, y_true: np.ndarray, parameters: Optional[np.ndarray] = None) -> float:
        if parameters is None:
            raise ValueError("TwoDLossSurface 需要 parameters 参数")
        if len(parameters) != 2:
            raise ValueError("TwoDLossSurface 仅支持 2 维参数")
        return float(self.loss_surface_fn(np.array([parameters[0]]), np.array([parameters[1]]))[0])
    
    def gradient(self, X: np.ndarray, y_pred: np.ndarray, y_true: np.ndarray, 
                 parameters: Optional[np.ndarray] = None) -> np.ndarray:
        if parameters is None:
            raise ValueError("TwoDLossSurface 需要 parameters 参数")
        if len(parameters) != 2:
            raise ValueError("TwoDLossSurface 仅支持 2 维参数")
        
        eps = 1e-8
        x, y = parameters[0], parameters[1]
        
        dx = (self.loss_surface_fn(np.array([x + eps]), np.array([y]))[0] - 
              self.loss_surface_fn(np.array([x - eps]), np.array([y]))[0]) / (2 * eps)
        dy = (self.loss_surface_fn(np.array([x]), np.array([y + eps]))[0] - 
              self.loss_surface_fn(np.array([x]), np.array([y - eps]))[0]) / (2 * eps)
        
        return np.array([dx, dy])
    
    def __str__(self):
        return f"TwoDLossSurface()"
