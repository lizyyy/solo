import numpy as np
from typing import Dict, List, Tuple, Any, Optional
from .base import Optimizer

class Momentum(Optimizer):
    def __init__(self, learning_rate: float = 0.01, momentum: float = 0.9, seed: Optional[int] = None):
        super().__init__(learning_rate=learning_rate, seed=seed)
        self.momentum = momentum
        self.velocity = None
    
    def initialize(self, parameters: np.ndarray):
        super().initialize(parameters)
        self.velocity = np.zeros_like(parameters)
    
    def step(self, gradients: np.ndarray, loss: float) -> np.ndarray:
        if not self._initialized:
            raise RuntimeError("优化器未初始化，请先调用 initialize() 方法")
        
        self.gradients = gradients.copy()
        self.history['gradients'].append(self.gradients.copy())
        self.history['loss'].append(loss)
        
        self.velocity = self.momentum * self.velocity - self.learning_rate * self.gradients
        self.parameters = self.parameters + self.velocity
        self.history['parameters'].append(self.parameters.copy())
        
        return self.parameters.copy()
    
    def get_state(self) -> Dict[str, Any]:
        state = super().get_state()
        state['momentum'] = self.momentum
        state['velocity'] = self.velocity.tolist() if self.velocity is not None else None
        return state
    
    def set_state(self, state: Dict[str, Any]):
        super().set_state(state)
        self.momentum = state.get('momentum', 0.9)
        if state.get('velocity') is not None:
            self.velocity = np.array(state['velocity'])
    
    def validate_parameters(self) -> List[Tuple[str, str]]:
        warnings = super().validate_parameters()
        if self.momentum < 0 or self.momentum >= 1:
            warnings.append(('momentum', '动量参数应在 [0, 1) 范围内'))
        elif self.momentum > 0.99:
            warnings.append(('momentum', '动量过大，可能导致不稳定'))
        return warnings
    
    def __str__(self):
        return f"Momentum(learning_rate={self.learning_rate}, momentum={self.momentum}, seed={self.seed})"
    
    def __repr__(self):
        return self.__str__()
