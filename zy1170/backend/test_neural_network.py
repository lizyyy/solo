import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
import pytest
from neural_network import (
    NeuralNetwork,
    ActivationFunctions,
    LossFunctions,
    WeightInitialization,
    ParameterValidator,
    ExperimentManager,
    ReportGenerator
)


class TestActivationFunctions:
    def test_sigmoid(self):
        z = np.array([0, 2, -2])
        result = ActivationFunctions.sigmoid(z)
        assert result.shape == z.shape
        assert 0.49 < result[0] < 0.51
        assert result[1] > 0.8
        assert result[2] < 0.2
    
    def test_relu(self):
        z = np.array([-2, 0, 2])
        result = ActivationFunctions.relu(z)
        expected = np.array([0, 0, 2])
        np.testing.assert_array_almost_equal(result, expected)
    
    def test_tanh(self):
        z = np.array([0])
        result = ActivationFunctions.tanh(z)
        assert abs(result[0]) < 1e-10
    
    def test_softmax(self):
        z = np.array([[1, 2, 3]])
        result = ActivationFunctions.softmax(z)
        assert result.shape == (1, 3)
        assert abs(np.sum(result) - 1.0) < 1e-10
        assert result[0, 2] > result[0, 1] > result[0, 0]


class TestLossFunctions:
    def test_mean_squared_error(self):
        y_pred = np.array([[0.5], [0.8]])
        y_true = np.array([[0.0], [1.0]])
        loss = LossFunctions.mean_squared_error(y_pred, y_true)
        expected = (0.25 + 0.04) / 2
        assert abs(loss - expected) < 1e-10
    
    def test_binary_cross_entropy(self):
        y_pred = np.array([[0.9], [0.1]])
        y_true = np.array([[1.0], [0.0]])
        loss = LossFunctions.binary_cross_entropy(y_pred, y_true)
        assert loss > 0


class TestWeightInitialization:
    def test_xavier_shape(self):
        prev_size, layer_size = 10, 5
        W = WeightInitialization.xavier(layer_size, prev_size)
        assert W.shape == (prev_size, layer_size)
    
    def test_he_shape(self):
        prev_size, layer_size = 10, 5
        W = WeightInitialization.he(layer_size, prev_size)
        assert W.shape == (prev_size, layer_size)
    
    def test_seed_consistency(self):
        W1 = WeightInitialization.xavier(5, 10, seed=42)
        W2 = WeightInitialization.xavier(5, 10, seed=42)
        np.testing.assert_array_equal(W1, W2)


class TestNeuralNetwork:
    def test_initialize(self):
        nn = NeuralNetwork(
            input_size=2,
            hidden_layers=[4, 3],
            output_size=1
        )
        assert len(nn.weights) == 3
        assert nn.weights[0].shape == (2, 4)
        assert nn.weights[1].shape == (4, 3)
        assert nn.weights[2].shape == (3, 1)
    
    def test_forward_shape(self):
        nn = NeuralNetwork(
            input_size=2,
            hidden_layers=[4],
            output_size=1
        )
        X = np.array([[0, 0], [0, 1], [1, 0], [1, 1]])
        output, layer_outputs = nn.forward(X)
        assert output.shape == (4, 1)
        assert len(layer_outputs) == 2
    
    def test_train_step(self):
        nn = NeuralNetwork(
            input_size=2,
            hidden_layers=[4],
            output_size=1,
            learning_rate=0.1,
            seed=42
        )
        X = np.array([[0, 0], [0, 1], [1, 0], [1, 1]])
        y = np.array([[0], [1], [1], [0]])
        
        initial_weights = [W.copy() for W in nn.weights]
        result = nn.train_step(X, y)
        
        assert 'loss' in result
        assert result['loss'] > 0
        
        weights_changed = any(not np.array_equal(w_old, w_new) 
                               for w_old, w_new in zip(initial_weights, nn.weights))
        assert weights_changed
    
    def test_full_training(self):
        nn = NeuralNetwork(
            input_size=2,
            hidden_layers=[4],
            output_size=1,
            activation='relu',
            learning_rate=0.1,
            seed=42
        )
        X = np.array([[0, 0], [0, 1], [1, 0], [1, 1]])
        y = np.array([[0], [1], [1], [0]])
        
        result = nn.train(X, y, epochs=100, verbose=False)
        
        assert 'final_loss' in result
        assert 'training_history' in result
        assert len(result['training_history']['loss']) == 100
        
        final_loss = result['final_loss']
        assert final_loss < 0.5


class TestParameterValidator:
    def test_valid_config(self):
        config = {
            'input_size': 2,
            'hidden_layers': [4],
            'output_size': 1,
            'learning_rate': 0.01,
            'epochs': 100,
            'activation': 'relu',
            'initialization': 'xavier',
            'loss_function': 'binary_cross_entropy'
        }
        result = ParameterValidator.validate(config)
        assert result['valid'] == True
        assert len(result['errors']) == 0
    
    def test_invalid_learning_rate(self):
        config = {
            'input_size': 2,
            'hidden_layers': [4],
            'output_size': 1,
            'learning_rate': -0.01,
            'epochs': 100,
            'activation': 'relu',
            'initialization': 'xavier',
            'loss_function': 'binary_cross_entropy'
        }
        result = ParameterValidator.validate(config)
        assert result['valid'] == False
        assert any('learning_rate' in e['field'] for e in result['errors'])
    
    def test_zero_initialization_warning(self):
        config = {
            'input_size': 2,
            'hidden_layers': [4, 4],
            'output_size': 1,
            'learning_rate': 0.01,
            'epochs': 100,
            'activation': 'relu',
            'initialization': 'zeros',
            'loss_function': 'binary_cross_entropy'
        }
        result = ParameterValidator.validate(config)
        assert len(result['warnings']) > 0
        assert any('initialization' in w['field'] for w in result['warnings'])


class TestExperimentManager:
    def test_create_experiment(self, tmp_path):
        manager = ExperimentManager(str(tmp_path))
        config = {'input_size': 2, 'hidden_layers': [4]}
        seed = 42
        
        experiment = manager.create_experiment(config, seed)
        
        assert 'id' in experiment
        assert experiment['config'] == config
        assert experiment['seed'] == seed
        assert experiment['status'] == 'created'
    
    def test_update_experiment(self, tmp_path):
        manager = ExperimentManager(str(tmp_path))
        config = {'input_size': 2, 'hidden_layers': [4]}
        experiment = manager.create_experiment(config, 42)
        
        updated = manager.update_experiment(experiment['id'], {
            'status': 'completed',
            'training_result': {'final_loss': 0.1}
        })
        
        assert updated['status'] == 'completed'
        assert updated['data']['training_result']['final_loss'] == 0.1


class TestReportGenerator:
    def test_generate_markdown(self):
        experiment = {
            'id': 'exp_test_001',
            'created_at': '2024-01-01T00:00:00',
            'seed': 42,
            'status': 'completed',
            'config': {
                'input_size': 2,
                'hidden_layers': [4],
                'output_size': 1,
                'activation': 'relu',
                'learning_rate': 0.1,
                'epochs': 100,
                'initialization': 'xavier',
                'loss_function': 'binary_cross_entropy',
                'X': [[0, 0], [0, 1], [1, 0], [1, 1]],
                'y': [[0], [1], [1], [0]]
            },
            'data': {
                'training_result': {
                    'final_loss': 0.01,
                    'final_output': [[0.01], [0.99], [0.99], [0.01]],
                    'training_history': {
                        'epoch': [0, 1, 2],
                        'loss': [0.5, 0.3, 0.01]
                    }
                }
            }
        }
        
        markdown = ReportGenerator.generate_markdown(experiment)
        
        assert '神经网络训练实验报告' in markdown
        assert 'exp_test_001' in markdown
        assert '42' in markdown
        assert '0.010000' in markdown


class TestXORProblem:
    def test_xor_learnable(self):
        nn = NeuralNetwork(
            input_size=2,
            hidden_layers=[8],
            output_size=1,
            activation='relu',
            output_activation='sigmoid',
            learning_rate=0.1,
            loss_function='binary_cross_entropy',
            seed=42
        )
        
        X = np.array([[0, 0], [0, 1], [1, 0], [1, 1]])
        y = np.array([[0], [1], [1], [0]])
        
        result = nn.train(X, y, epochs=2000, verbose=False)
        
        predictions = nn.predict(X)
        
        assert predictions[0][0] < 0.3
        assert predictions[1][0] > 0.7
        assert predictions[2][0] > 0.7
        assert predictions[3][0] < 0.3


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
