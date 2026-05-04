import numpy as np
from typing import List, Dict, Any, Tuple, Optional
import json
import os
from datetime import datetime

class ActivationFunctions:
    @staticmethod
    def sigmoid(z: np.ndarray) -> np.ndarray:
        return 1.0 / (1.0 + np.exp(-z))
    
    @staticmethod
    def sigmoid_derivative(z: np.ndarray) -> np.ndarray:
        s = ActivationFunctions.sigmoid(z)
        return s * (1 - s)
    
    @staticmethod
    def relu(z: np.ndarray) -> np.ndarray:
        return np.maximum(0, z)
    
    @staticmethod
    def relu_derivative(z: np.ndarray) -> np.ndarray:
        return (z > 0).astype(float)
    
    @staticmethod
    def tanh(z: np.ndarray) -> np.ndarray:
        return np.tanh(z)
    
    @staticmethod
    def tanh_derivative(z: np.ndarray) -> np.ndarray:
        return 1 - np.square(np.tanh(z))
    
    @staticmethod
    def leaky_relu(z: np.ndarray, alpha: float = 0.01) -> np.ndarray:
        return np.where(z > 0, z, alpha * z)
    
    @staticmethod
    def leaky_relu_derivative(z: np.ndarray, alpha: float = 0.01) -> np.ndarray:
        return np.where(z > 0, 1.0, alpha)
    
    @staticmethod
    def softmax(z: np.ndarray) -> np.ndarray:
        z_shifted = z - np.max(z, axis=1, keepdims=True)
        exp_z = np.exp(z_shifted)
        return exp_z / np.sum(exp_z, axis=1, keepdims=True)
    
    @staticmethod
    def linear(z: np.ndarray) -> np.ndarray:
        return z
    
    @staticmethod
    def linear_derivative(z: np.ndarray) -> np.ndarray:
        return np.ones_like(z)


class LossFunctions:
    @staticmethod
    def mean_squared_error(y_pred: np.ndarray, y_true: np.ndarray) -> float:
        return np.mean(np.square(y_pred - y_true))
    
    @staticmethod
    def mean_squared_error_derivative(y_pred: np.ndarray, y_true: np.ndarray) -> np.ndarray:
        return 2 * (y_pred - y_true) / y_true.shape[0]
    
    @staticmethod
    def binary_cross_entropy(y_pred: np.ndarray, y_true: np.ndarray, epsilon: float = 1e-15) -> float:
        y_pred = np.clip(y_pred, epsilon, 1 - epsilon)
        return -np.mean(y_true * np.log(y_pred) + (1 - y_true) * np.log(1 - y_pred))
    
    @staticmethod
    def binary_cross_entropy_derivative(y_pred: np.ndarray, y_true: np.ndarray, epsilon: float = 1e-15) -> np.ndarray:
        y_pred = np.clip(y_pred, epsilon, 1 - epsilon)
        return (-(y_true / y_pred) + (1 - y_true) / (1 - y_pred)) / y_true.shape[0]
    
    @staticmethod
    def categorical_cross_entropy(y_pred: np.ndarray, y_true: np.ndarray, epsilon: float = 1e-15) -> float:
        y_pred = np.clip(y_pred, epsilon, 1 - epsilon)
        return -np.mean(np.sum(y_true * np.log(y_pred), axis=1))


class WeightInitialization:
    @staticmethod
    def random(layer_size: int, prev_layer_size: int, seed: Optional[int] = None) -> np.ndarray:
        if seed is not None:
            np.random.seed(seed)
        return np.random.randn(prev_layer_size, layer_size) * 0.01
    
    @staticmethod
    def xavier(layer_size: int, prev_layer_size: int, seed: Optional[int] = None) -> np.ndarray:
        if seed is not None:
            np.random.seed(seed)
        limit = np.sqrt(6 / (prev_layer_size + layer_size))
        return np.random.uniform(-limit, limit, (prev_layer_size, layer_size))
    
    @staticmethod
    def he(layer_size: int, prev_layer_size: int, seed: Optional[int] = None) -> np.ndarray:
        if seed is not None:
            np.random.seed(seed)
        std = np.sqrt(2 / prev_layer_size)
        return np.random.randn(prev_layer_size, layer_size) * std
    
    @staticmethod
    def zeros(layer_size: int, prev_layer_size: int, seed: Optional[int] = None) -> np.ndarray:
        return np.zeros((prev_layer_size, layer_size))
    
    @staticmethod
    def ones(layer_size: int, prev_layer_size: int, seed: Optional[int] = None) -> np.ndarray:
        return np.ones((prev_layer_size, layer_size))


class NeuralNetwork:
    def __init__(
        self,
        input_size: int,
        hidden_layers: List[int],
        output_size: int,
        activation: str = 'relu',
        output_activation: str = 'sigmoid',
        initialization: str = 'xavier',
        learning_rate: float = 0.01,
        loss_function: str = 'binary_cross_entropy',
        seed: Optional[int] = None
    ):
        self.input_size = input_size
        self.hidden_layers = hidden_layers
        self.output_size = output_size
        self.activation = activation
        self.output_activation = output_activation
        self.initialization = initialization
        self.learning_rate = learning_rate
        self.loss_function = loss_function
        self.seed = seed
        
        self.weights = []
        self.biases = []
        self._initialize_weights()
        
        self.training_history = {
            'loss': [],
            'epoch': [],
            'weights_history': [],
            'gradients_history': [],
            'layer_outputs': []
        }
        
        self.step_by_step_data = {
            'forward_steps': [],
            'backward_steps': [],
            'update_steps': []
        }
    
    def _initialize_weights(self):
        init_func = getattr(WeightInitialization, self.initialization, WeightInitialization.xavier)
        
        layer_sizes = [self.input_size] + self.hidden_layers + [self.output_size]
        
        for i in range(len(layer_sizes) - 1):
            seed_val = self.seed + i if self.seed is not None else None
            W = init_func(layer_sizes[i + 1], layer_sizes[i], seed_val)
            b = np.zeros((1, layer_sizes[i + 1]))
            self.weights.append(W)
            self.biases.append(b)
    
    def _get_activation(self, activation_name: str):
        activation_map = {
            'sigmoid': (ActivationFunctions.sigmoid, ActivationFunctions.sigmoid_derivative),
            'relu': (ActivationFunctions.relu, ActivationFunctions.relu_derivative),
            'tanh': (ActivationFunctions.tanh, ActivationFunctions.tanh_derivative),
            'leaky_relu': (ActivationFunctions.leaky_relu, ActivationFunctions.leaky_relu_derivative),
            'softmax': (ActivationFunctions.softmax, None),
            'linear': (ActivationFunctions.linear, ActivationFunctions.linear_derivative)
        }
        return activation_map.get(activation_name, (ActivationFunctions.relu, ActivationFunctions.relu_derivative))
    
    def _get_loss(self, loss_name: str):
        loss_map = {
            'mean_squared_error': (LossFunctions.mean_squared_error, LossFunctions.mean_squared_error_derivative),
            'binary_cross_entropy': (LossFunctions.binary_cross_entropy, LossFunctions.binary_cross_entropy_derivative),
            'categorical_cross_entropy': (LossFunctions.categorical_cross_entropy, None)
        }
        return loss_map.get(loss_name, (LossFunctions.binary_cross_entropy, LossFunctions.binary_cross_entropy_derivative))
    
    def forward(self, X: np.ndarray, record_step: bool = False) -> Tuple[np.ndarray, List[Dict]]:
        activation, _ = self._get_activation(self.activation)
        output_activation, _ = self._get_activation(self.output_activation)
        
        layer_outputs = []
        current_input = X
        
        for i, (W, b) in enumerate(zip(self.weights, self.biases)):
            z = np.dot(current_input, W) + b
            
            if i == len(self.weights) - 1:
                a = output_activation(z)
            else:
                a = activation(z)
            
            layer_info = {
                'layer': i,
                'type': 'hidden' if i < len(self.weights) - 1 else 'output',
                'input': current_input.tolist(),
                'weights': W.tolist(),
                'biases': b.tolist(),
                'z': z.tolist(),
                'activation': self.output_activation if i == len(self.weights) - 1 else self.activation,
                'output': a.tolist()
            }
            layer_outputs.append(layer_info)
            
            if record_step:
                self.step_by_step_data['forward_steps'].append(layer_info.copy())
            
            current_input = a
        
        return current_input, layer_outputs
    
    def backward(self, X: np.ndarray, y: np.ndarray, output: np.ndarray, 
                 layer_outputs: List[Dict], record_step: bool = False) -> Tuple[List[np.ndarray], List[np.ndarray]]:
        loss_func, loss_derivative = self._get_loss(self.loss_function)
        _, activation_derivative = self._get_activation(self.activation)
        _, output_activation_derivative = self._get_activation(self.output_activation)
        
        m = X.shape[0]
        dW_list = []
        db_list = []
        
        if self.loss_function == 'categorical_cross_entropy' and self.output_activation == 'softmax':
            delta = output - y
        else:
            delta = loss_derivative(output, y)
            if output_activation_derivative:
                z_output = np.array(layer_outputs[-1]['z'])
                delta = delta * output_activation_derivative(z_output)
        
        for i in reversed(range(len(self.weights))):
            if i == len(self.weights) - 1:
                prev_a = np.array(layer_outputs[i - 1]['output']) if i > 0 else X
            else:
                prev_a = np.array(layer_outputs[i - 1]['output']) if i > 0 else X
            
            dW = np.dot(prev_a.T, delta) / m
            db = np.sum(delta, axis=0, keepdims=True) / m
            
            dW_list.insert(0, dW)
            db_list.insert(0, db)
            
            if record_step:
                backward_info = {
                    'layer': i,
                    'delta': delta.tolist(),
                    'dW': dW.tolist(),
                    'db': db.tolist(),
                    'prev_a': prev_a.tolist()
                }
                self.step_by_step_data['backward_steps'].append(backward_info.copy())
            
            if i > 0:
                z_prev = np.array(layer_outputs[i - 1]['z'])
                if i == len(self.weights) - 1 and self.output_activation == 'softmax':
                    pass
                else:
                    delta = np.dot(delta, self.weights[i].T) * activation_derivative(z_prev)
        
        return dW_list, db_list
    
    def update_weights(self, dW_list: List[np.ndarray], db_list: List[np.ndarray], 
                       record_step: bool = False) -> Dict:
        update_info = {
            'learning_rate': self.learning_rate,
            'updates': []
        }
        
        for i, (W, b, dW, db) in enumerate(zip(self.weights, self.biases, dW_list, db_list)):
            old_W = W.copy()
            old_b = b.copy()
            
            self.weights[i] = W - self.learning_rate * dW
            self.biases[i] = b - self.learning_rate * db
            
            layer_update = {
                'layer': i,
                'old_weights': old_W.tolist(),
                'new_weights': self.weights[i].tolist(),
                'weights_change': (self.weights[i] - old_W).tolist(),
                'old_biases': old_b.tolist(),
                'new_biases': self.biases[i].tolist(),
                'biases_change': (self.biases[i] - old_b).tolist(),
                'gradient': dW.tolist(),
                'bias_gradient': db.tolist()
            }
            update_info['updates'].append(layer_update)
            
            if record_step:
                self.step_by_step_data['update_steps'].append(layer_update.copy())
        
        return update_info
    
    def train_step(self, X: np.ndarray, y: np.ndarray, record_step: bool = False) -> Dict:
        output, layer_outputs = self.forward(X, record_step=record_step)
        loss_func, _ = self._get_loss(self.loss_function)
        loss = loss_func(output, y)
        dW_list, db_list = self.backward(X, y, output, layer_outputs, record_step=record_step)
        update_info = self.update_weights(dW_list, db_list, record_step=record_step)
        
        return {
            'loss': loss,
            'output': output.tolist(),
            'layer_outputs': layer_outputs,
            'gradients': [dW.tolist() for dW in dW_list],
            'bias_gradients': [db.tolist() for db in db_list],
            'updates': update_info
        }
    
    def train(self, X: np.ndarray, y: np.ndarray, epochs: int, 
              verbose: bool = True, record_history: bool = True) -> Dict:
        self.step_by_step_data = {
            'forward_steps': [],
            'backward_steps': [],
            'update_steps': []
        }
        
        for epoch in range(epochs):
            step_result = self.train_step(X, y, record_step=True)
            loss = step_result['loss']
            
            if record_history:
                self.training_history['loss'].append(loss)
                self.training_history['epoch'].append(epoch)
                
                weights_snapshot = [W.tolist() for W in self.weights]
                self.training_history['weights_history'].append(weights_snapshot)
            
            if verbose and (epoch % max(1, epochs // 10) == 0 or epoch == epochs - 1):
                print(f"Epoch {epoch + 1}/{epochs}, Loss: {loss:.6f}")
        
        final_output, _ = self.forward(X)
        
        return {
            'final_loss': loss,
            'final_output': final_output.tolist(),
            'training_history': self.training_history,
            'step_by_step': self.step_by_step_data
        }
    
    def predict(self, X: np.ndarray) -> np.ndarray:
        output, _ = self.forward(X)
        return output
    
    def get_weights(self) -> List[List[List[float]]]:
        return [W.tolist() for W in self.weights]
    
    def get_biases(self) -> List[List[List[float]]]:
        return [b.tolist() for b in self.biases]
    
    def set_weights(self, weights: List[List[List[float]]]):
        self.weights = [np.array(W) for W in weights]
    
    def set_biases(self, biases: List[List[List[float]]]):
        self.biases = [np.array(b) for b in biases]


class ExperimentManager:
    def __init__(self, experiments_dir: str):
        self.experiments_dir = experiments_dir
        self.experiments: List[Dict] = []
        self._load_experiments()
    
    def _load_experiments(self):
        if not os.path.exists(self.experiments_dir):
            return
        
        for filename in os.listdir(self.experiments_dir):
            if filename.endswith('.json'):
                filepath = os.path.join(self.experiments_dir, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        experiment = json.load(f)
                        self.experiments.append(experiment)
                except:
                    pass
    
    def create_experiment(self, config: Dict, seed: int) -> Dict:
        experiment_id = f"exp_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{seed}"
        experiment = {
            'id': experiment_id,
            'created_at': datetime.now().isoformat(),
            'config': config,
            'seed': seed,
            'status': 'created',
            'data': {}
        }
        self.experiments.append(experiment)
        self._save_experiment(experiment)
        return experiment
    
    def _save_experiment(self, experiment: Dict):
        filepath = os.path.join(self.experiments_dir, f"{experiment['id']}.json")
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(experiment, f, indent=2, ensure_ascii=False)
    
    def update_experiment(self, experiment_id: str, data: Dict) -> Optional[Dict]:
        for exp in self.experiments:
            if exp['id'] == experiment_id:
                exp['data'].update(data)
                exp['status'] = data.get('status', exp['status'])
                self._save_experiment(exp)
                return exp
        return None
    
    def get_experiment(self, experiment_id: str) -> Optional[Dict]:
        for exp in self.experiments:
            if exp['id'] == experiment_id:
                return exp
        return None
    
    def list_experiments(self, limit: int = 100) -> List[Dict]:
        sorted_exps = sorted(self.experiments, key=lambda x: x['created_at'], reverse=True)
        return sorted_exps[:limit]
    
    def delete_experiment(self, experiment_id: str) -> bool:
        for i, exp in enumerate(self.experiments):
            if exp['id'] == experiment_id:
                self.experiments.pop(i)
                filepath = os.path.join(self.experiments_dir, f"{experiment_id}.json")
                if os.path.exists(filepath):
                    os.remove(filepath)
                return True
        return False


class ParameterValidator:
    @staticmethod
    def validate(config: Dict) -> Dict:
        errors = []
        warnings = []
        
        input_size = config.get('input_size', 0)
        if input_size <= 0:
            errors.append({'field': 'input_size', 'message': '输入特征数量必须大于0'})
        
        hidden_layers = config.get('hidden_layers', [])
        for i, size in enumerate(hidden_layers):
            if size <= 0:
                errors.append({'field': f'hidden_layers[{i}]', 'message': f'隐藏层第{i+1}层大小必须大于0'})
            if size > 1000:
                warnings.append({'field': f'hidden_layers[{i}]', 'message': f'隐藏层第{i+1}层大小({size})可能过大，训练会很慢'})
        
        output_size = config.get('output_size', 0)
        if output_size <= 0:
            errors.append({'field': 'output_size', 'message': '输出层大小必须大于0'})
        
        learning_rate = config.get('learning_rate', 0.01)
        if learning_rate <= 0:
            errors.append({'field': 'learning_rate', 'message': '学习率必须大于0'})
        if learning_rate > 1:
            warnings.append({'field': 'learning_rate', 'message': f'学习率({learning_rate})过大，可能导致不收敛'})
        if learning_rate < 1e-6:
            warnings.append({'field': 'learning_rate', 'message': f'学习率({learning_rate})过小，训练会非常慢'})
        
        epochs = config.get('epochs', 100)
        if epochs <= 0:
            errors.append({'field': 'epochs', 'message': '训练轮次必须大于0'})
        if epochs > 10000:
            warnings.append({'field': 'epochs', 'message': f'训练轮次({epochs})过多，可能需要很长时间'})
        
        valid_activations = ['sigmoid', 'relu', 'tanh', 'leaky_relu', 'softmax', 'linear']
        activation = config.get('activation', 'relu')
        if activation not in valid_activations:
            errors.append({'field': 'activation', 'message': f'激活函数必须是: {", ".join(valid_activations)}'})
        
        valid_initializations = ['random', 'xavier', 'he', 'zeros', 'ones']
        initialization = config.get('initialization', 'xavier')
        if initialization not in valid_initializations:
            errors.append({'field': 'initialization', 'message': f'初始化方式必须是: {", ".join(valid_initializations)}'})
        
        valid_losses = ['mean_squared_error', 'binary_cross_entropy', 'categorical_cross_entropy']
        loss_function = config.get('loss_function', 'binary_cross_entropy')
        if loss_function not in valid_losses:
            errors.append({'field': 'loss_function', 'message': f'损失函数必须是: {", ".join(valid_losses)}'})
        
        if initialization == 'zeros' and len(hidden_layers) > 0:
            warnings.append({
                'field': 'initialization', 
                'message': '使用全零初始化可能导致所有神经元学习相同的特征，建议使用xavier或he初始化'
            })
        
        if activation == 'sigmoid' and len(hidden_layers) > 2:
            warnings.append({
                'field': 'activation',
                'message': '深层网络中sigmoid容易导致梯度消失，建议使用relu'
            })
        
        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings
        }


class ReportGenerator:
    @staticmethod
    def generate_markdown(experiment: Dict) -> str:
        config = experiment.get('config', {})
        data = experiment.get('data', {})
        training_result = data.get('training_result', {})
        history = training_result.get('training_history', {})
        
        md = f"""# 神经网络训练实验报告

## 实验基本信息
- **实验ID**: {experiment.get('id', 'N/A')}
- **创建时间**: {experiment.get('created_at', 'N/A')}
- **随机种子**: {experiment.get('seed', 'N/A')}
- **状态**: {experiment.get('status', 'N/A')}

## 网络配置
| 参数 | 值 |
|------|-----|
| 输入层大小 | {config.get('input_size', 'N/A')} |
| 隐藏层结构 | {config.get('hidden_layers', 'N/A')} |
| 输出层大小 | {config.get('output_size', 'N/A')} |
| 隐藏层激活函数 | {config.get('activation', 'N/A')} |
| 输出层激活函数 | {config.get('output_activation', 'N/A')} |
| 损失函数 | {config.get('loss_function', 'N/A')} |
| 学习率 | {config.get('learning_rate', 'N/A')} |
| 训练轮次 | {config.get('epochs', 'N/A')} |
| 权重初始化方式 | {config.get('initialization', 'N/A')} |

## 训练结果
- **最终Loss**: {training_result.get('final_loss', 'N/A'):.6f}

### Loss变化趋势
"""
        
        losses = history.get('loss', [])
        if losses:
            md += f"""
| Epoch | Loss |
|-------|------|
"""
            step = max(1, len(losses) // 20)
            for i in range(0, len(losses), step):
                md += f"| {history.get('epoch', [])[i]} | {losses[i]:.6f} |\n"
            if len(losses) > 1:
                md += f"| {history.get('epoch', [])[-1]} | {losses[-1]:.6f} |\n"
        
        md += """
## 前向传播过程示例
前向传播计算每个神经元的加权和(z = W·X + b)，然后应用激活函数。

### 计算步骤
1. **输入层** → 隐藏层: z₁ = W₁·X + b₁, a₁ = σ(z₁)
2. **隐藏层** → 隐藏层: z₂ = W₂·a₁ + b₂, a₂ = σ(z₂)
3. **隐藏层** → 输出层: z₃ = W₃·a₂ + b₃, a₃ = σ(z₃)

## 反向传播过程示例
反向传播使用链式法则计算梯度，从输出层向输入层传播。

### 计算步骤
1. **计算输出层误差**: δ³ = ∂L/∂a³ ⊙ σ'(z³)
2. **计算隐藏层误差**: δ² = (W³)ᵀ·δ³ ⊙ σ'(z²)
3. **计算权重梯度**: ∂L/∂W² = (a¹)ᵀ·δ² / m
4. **更新权重**: W = W - α·∂L/∂W

## 训练数据
"""
        
        X = config.get('X', [])
        y = config.get('y', [])
        if X and y:
            md += "### 输入样本\n```\n"
            for i, (x, label) in enumerate(zip(X[:10], y[:10])):
                md += f"样本{i+1}: X={x}, y={label}\n"
            if len(X) > 10:
                md += f"... 共{len(X)}个样本\n"
            md += "```\n"
        
        predictions = training_result.get('final_output', [])
        if predictions and y:
            md += "\n### 预测结果对比\n"
            md += "| 样本 | 真实值 | 预测值 |\n|------|--------|--------|\n"
            for i, (true, pred) in enumerate(zip(y[:20], predictions[:20])):
                pred_val = [f"{p:.4f}" for p in pred] if isinstance(pred, list) else f"{pred:.4f}"
                md += f"| {i+1} | {true} | {pred_val} |\n"
        
        md += f"""
## 实验说明
本实验使用纯NumPy实现的神经网络，可用于教学目的理解深度学习的基本原理。

### 关键公式
- **前向传播**: z^l = W^l · a^(l-1) + b^l, a^l = σ(z^l)
- **损失函数(MSE)**: L = (1/2m)Σ||y_pred - y_true||²
- **反向传播(δ)**: δ^L = ∂L/∂a^L ⊙ σ'(z^L), δ^l = (W^(l+1))ᵀ·δ^(l+1) ⊙ σ'(z^l)
- **梯度下降**: W^l = W^l - α·∂L/∂W^l, b^l = b^l - α·∂L/∂b^l
"""
        
        return md
    
    @staticmethod
    def generate_json(experiment: Dict) -> str:
        return json.dumps(experiment, indent=2, ensure_ascii=False)
