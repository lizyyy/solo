import numpy as np
from typing import Dict, List, Tuple, Any, Optional
from .base import Optimizer

class Adam(Optimizer):
    def __init__(self, learning_rate: float = 0.001, beta1: float = 0.9, beta2: float = 0.999, 
                 epsilon: float = 1e-8, seed: Optional[int] = None):
        super().__init__(learning_rate=learning_rate, seed=seed)
        self.beta1 = beta1
        self.beta2 = beta2
        self.epsilon = epsilon
        self.m = None
        self.v = None
        self.t = 0
    
    def initialize(self, parameters: np.ndarray):
        super().initialize(parameters)
        self.m = np.zeros_like(parameters)
        self.v = np.zeros_like(parameters)
        self.t = 0
    
    def step(self, gradients: np.ndarray, loss: float) -> np.ndarray:
        if not self._initialized:
            raise RuntimeError("优化器未初始化，请先调用 initialize() 方法")
        
        self.gradients = gradients.copy()
        self.history['gradients'].append(self.gradients.copy())
        self.history['loss'].append(loss)
        
        self.t += 1
        self.m = self.beta1 * self.m + (1 - self.beta1) * self.gradients
        self.v = self.beta2 * self.v + (1 - self.beta2) * self.gradients ** 2
        
        m_hat = self.m / (1 - self.beta1 ** self.t)
        v_hat = self.v / (1 - self.beta2 ** self.t)
        
        self.parameters = self.parameters - self.learning_rate * m_hat / (np.sqrt(v_hat) + self.epsilon)
        self.history['parameters'].append(self.parameters.copy())
        
        return self.parameters.copy()
    
    def get_state(self) -> Dict[str, Any]:
        state = super().get_state()
        state['beta1'] = self.beta1
        state['beta2'] = self.beta2
        state['epsilon'] = self.epsilon
        state['m'] = self.m.tolist() if self.m is not None else None
        state['v'] = self.v.tolist() if self.v is not None else None
        state['t'] = self.t
        return state
    
    def set_state(self, state: Dict[str, Any]):
        super().set_state(state)
        self.beta1 = state.get('beta1', 0.9)
        self.beta2 = state.get('beta2', 0.999)
        self.epsilon = state.get('epsilon', 1e-8)
        if state.get('m') is not None:
            self.m = np.array(state['m'])
        if state.get('v') is not None:
            self.v = np.array(state['v'])
        self.t = state.get('t', 0)
    
    def validate_parameters(self) -> List[Tuple[str, str]]:
        warnings = super().validate_parameters()
        if self.beta1 < 0 or self.beta1 >= 1:
            warnings.append(('beta1', 'beta1 参数应在 [0, 1) 范围内'))
        if self.beta2 < 0 or self.beta2 >= 1:
            warnings.append(('beta2', 'beta2 参数应在 [0, 1) 范围内'))
        if self.epsilon <= 0:
            warnings.append(('epsilon', 'epsilon 必须大于0'))
        elif self.epsilon > 1e-6:
            warnings.append(('epsilon', 'epsilon 过大，可能影响数值稳定性'))
        return warnings
    
    def __str__(self):
        return f"Adam(learning_rate={self.learning_rate}, beta1={self.beta1}, beta2={self.beta2}, epsilon={self.epsilon}, seed={self.seed})"
    
    def __repr__(self):
        return self.__str__()
