import numpy as np
from typing import Dict, List, Tuple, Any, Optional
from .base import Optimizer

class SGD(Optimizer):
    def __init__(self, learning_rate: float = 0.01, seed: Optional[int] = None):
        super().__init__(learning_rate=learning_rate, seed=seed)
    
    def step(self, gradients: np.ndarray, loss: float) -> np.ndarray:
        if not self._initialized:
            raise RuntimeError("优化器未初始化，请先调用 initialize() 方法")
        
        self.gradients = gradients.copy()
        self.history['gradients'].append(self.gradients.copy())
        self.history['loss'].append(loss)
        
        self.parameters = self.parameters - self.learning_rate * self.gradients
        self.history['parameters'].append(self.parameters.copy())
        
        return self.parameters.copy()
    
    def get_state(self) -> Dict[str, Any]:
        state = super().get_state()
        return state
    
    def set_state(self, state: Dict[str, Any]):
        super().set_state(state)
    
    def validate_parameters(self) -> List[Tuple[str, str]]:
        warnings = super().validate_parameters()
        return warnings
    
    def __str__(self):
        return f"SGD(learning_rate={self.learning_rate}, seed={self.seed})"
    
    def __repr__(self):
        return self.__str__()
