import numpy as np
from typing import Dict, List, Tuple, Any, Optional
from .base import Optimizer

class RMSProp(Optimizer):
    def __init__(self, learning_rate: float = 0.001, beta: float = 0.9, epsilon: float = 1e-8, seed: Optional[int] = None):
        super().__init__(learning_rate=learning_rate, seed=seed)
        self.beta = beta
        self.epsilon = epsilon
        self.cache = None
    
    def initialize(self, parameters: np.ndarray):
        super().initialize(parameters)
        self.cache = np.zeros_like(parameters)
    
    def step(self, gradients: np.ndarray, loss: float) -> np.ndarray:
        if not self._initialized:
            raise RuntimeError("优化器未初始化，请先调用 initialize() 方法")
        
        self.gradients = gradients.copy()
        self.history['gradients'].append(self.gradients.copy())
        self.history['loss'].append(loss)
        
        self.cache = self.beta * self.cache + (1 - self.beta) * self.gradients ** 2
        self.parameters = self.parameters - self.learning_rate * self.gradients / (np.sqrt(self.cache) + self.epsilon)
        self.history['parameters'].append(self.parameters.copy())
        
        return self.parameters.copy()
    
    def get_state(self) -> Dict[str, Any]:
        state = super().get_state()
        state['beta'] = self.beta
        state['epsilon'] = self.epsilon
        state['cache'] = self.cache.tolist() if self.cache is not None else None
        return state
    
    def set_state(self, state: Dict[str, Any]):
        super().set_state(state)
        self.beta = state.get('beta', 0.9)
        self.epsilon = state.get('epsilon', 1e-8)
        if state.get('cache') is not None:
            self.cache = np.array(state['cache'])
    
    def validate_parameters(self) -> List[Tuple[str, str]]:
        warnings = super().validate_parameters()
        if self.beta < 0 or self.beta >= 1:
            warnings.append(('beta', 'beta 参数应在 [0, 1) 范围内'))
        elif self.beta > 0.999:
            warnings.append(('beta', 'beta 过大，可能导致数值不稳定'))
        if self.epsilon <= 0:
            warnings.append(('epsilon', 'epsilon 必须大于0'))
        elif self.epsilon > 1e-6:
            warnings.append(('epsilon', 'epsilon 过大，可能影响数值稳定性'))
        return warnings
    
    def __str__(self):
        return f"RMSProp(learning_rate={self.learning_rate}, beta={self.beta}, epsilon={self.epsilon}, seed={self.seed})"
    
    def __repr__(self):
        return self.__str__()
