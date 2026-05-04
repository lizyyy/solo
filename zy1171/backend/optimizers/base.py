import numpy as np
from typing import Dict, List, Tuple, Any, Optional
from abc import ABC, abstractmethod

class Optimizer(ABC):
    def __init__(self, learning_rate: float = 0.01, seed: Optional[int] = None):
        self.learning_rate = learning_rate
        self.seed = seed
        self.parameters = None
        self.gradients = None
        self.history = {
            'parameters': [],
            'gradients': [],
            'loss': [],
            'timestamp': []
        }
        self._initialized = False
        
        if seed is not None:
            np.random.seed(seed)
    
    def initialize(self, parameters: np.ndarray):
        self.parameters = parameters.copy()
        self.history['parameters'].append(self.parameters.copy())
        self._initialized = True
    
    @abstractmethod
    def step(self, gradients: np.ndarray, loss: float) -> np.ndarray:
        pass
    
    def get_history(self) -> Dict[str, List]:
        return self.history
    
    def get_state(self) -> Dict[str, Any]:
        return {
            'learning_rate': self.learning_rate,
            'seed': self.seed,
            'parameters': self.parameters.tolist() if self.parameters is not None else None,
            'history': self._serialize_history(),
            'optimizer_type': self.__class__.__name__
        }
    
    def _serialize_history(self) -> Dict[str, List]:
        serialized = {}
        for key, values in self.history.items():
            if key == 'parameters':
                serialized[key] = [p.tolist() for p in values]
            elif key == 'gradients':
                serialized[key] = [g.tolist() if g is not None else None for g in values]
            else:
                serialized[key] = values
        return serialized
    
    def set_state(self, state: Dict[str, Any]):
        self.learning_rate = state.get('learning_rate', 0.01)
        self.seed = state.get('seed')
        if state.get('parameters') is not None:
            self.parameters = np.array(state['parameters'])
            self._initialized = True
        
        if 'history' in state:
            h = state['history']
            for key in ['parameters', 'gradients', 'loss', 'timestamp']:
                if key in h:
                    if key == 'parameters':
                        self.history[key] = [np.array(p) for p in h[key]]
                    elif key == 'gradients':
                        self.history[key] = [np.array(g) if g is not None else None for g in h[key]]
                    else:
                        self.history[key] = h[key]
    
    def validate_parameters(self) -> List[Tuple[str, str]]:
        warnings = []
        if self.learning_rate <= 0:
            warnings.append(('learning_rate', '学习率必须大于0'))
        elif self.learning_rate > 1.0:
            warnings.append(('learning_rate', '学习率过大，可能导致不稳定'))
        elif self.learning_rate < 1e-6:
            warnings.append(('learning_rate', '学习率过小，可能导致收敛过慢'))
        return warnings
    
    def analyze_behavior(self, threshold: float = 1e-5) -> Dict[str, Any]:
        if len(self.history['loss']) < 2:
            return {'status': 'insufficient_data', 'message': '数据不足，无法分析'}
        
        losses = self.history['loss']
        loss_diff = np.diff(losses)
        
        oscillating = np.sum(loss_diff > 0) / len(loss_diff) > 0.3
        
        convergence_ratio = np.abs(loss_diff[-1] / (loss_diff[0] if loss_diff[0] != 0 else 1e-10))
        converging = convergence_ratio < 0.1 and losses[-1] < threshold
        
        stagnant = np.std(losses[-10:]) < 1e-8 and len(losses) > 10
        
        return {
            'oscillating': oscillating,
            'converging': converging,
            'stagnant': stagnant,
            'final_loss': losses[-1],
            'loss_trend': 'decreasing' if loss_diff[-1] < 0 else 'increasing' if loss_diff[-1] > 0 else 'stable',
            'analysis': self._generate_analysis(oscillating, converging, stagnant)
        }
    
    def _generate_analysis(self, oscillating: bool, converging: bool, stagnant: bool) -> List[str]:
        analysis = []
        if converging:
            analysis.append('✓ 优化器正在收敛，损失函数持续下降')
        if oscillating:
            analysis.append('⚠ 优化器出现震荡，可能需要调整学习率或使用动量')
        if stagnant:
            analysis.append('✗ 优化器停滞不前，可能需要调整学习率或检查梯度计算')
        if not oscillating and not converging and not stagnant:
            analysis.append('优化器正在正常工作，继续观察')
        return analysis
