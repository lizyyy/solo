import numpy as np
import unittest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.optimizers import SGD, Momentum, Adagrad, RMSProp, Adam, Optimizer

class TestOptimizerBase(unittest.TestCase):
    def setUp(self):
        self.initial_params = np.array([1.0, 2.0])
        self.gradient = np.array([0.5, 0.3])
        self.loss = 1.5
    
    def test_optimizer_initialization(self):
        sgd = SGD(learning_rate=0.01, seed=42)
        self.assertEqual(sgd.learning_rate, 0.01)
        self.assertEqual(sgd.seed, 42)
    
    def test_sgd_step(self):
        sgd = SGD(learning_rate=0.1)
        sgd.initialize(self.initial_params)
        
        new_params = sgd.step(self.gradient, self.loss)
        
        expected = self.initial_params - 0.1 * self.gradient
        np.testing.assert_array_almost_equal(new_params, expected)
    
    def test_momentum_step(self):
        momentum = Momentum(learning_rate=0.1, momentum=0.9)
        momentum.initialize(self.initial_params)
        
        first_step = momentum.step(self.gradient, self.loss)
        
        expected_velocity = -0.1 * self.gradient
        expected_params = self.initial_params + expected_velocity
        
        np.testing.assert_array_almost_equal(first_step, expected_params)
        
        second_gradient = np.array([0.2, 0.4])
        second_step = momentum.step(second_gradient, self.loss)
        
        expected_velocity_2 = 0.9 * expected_velocity - 0.1 * second_gradient
        expected_params_2 = expected_params + expected_velocity_2
        
        np.testing.assert_array_almost_equal(second_step, expected_params_2)
    
    def test_adagrad_step(self):
        adagrad = Adagrad(learning_rate=0.1, epsilon=1e-8)
        adagrad.initialize(self.initial_params)
        
        new_params = adagrad.step(self.gradient, self.loss)
        
        cache = self.gradient ** 2
        expected = self.initial_params - 0.1 * self.gradient / (np.sqrt(cache) + 1e-8)
        
        np.testing.assert_array_almost_equal(new_params, expected)
    
    def test_rmsprop_step(self):
        rmsprop = RMSProp(learning_rate=0.001, beta=0.9, epsilon=1e-8)
        rmsprop.initialize(self.initial_params)
        
        new_params = rmsprop.step(self.gradient, self.loss)
        
        cache = 0.9 * np.zeros(2) + 0.1 * self.gradient ** 2
        expected = self.initial_params - 0.001 * self.gradient / (np.sqrt(cache) + 1e-8)
        
        np.testing.assert_array_almost_equal(new_params, expected)
    
    def test_adam_step(self):
        adam = Adam(learning_rate=0.001, beta1=0.9, beta2=0.999, epsilon=1e-8)
        adam.initialize(self.initial_params)
        
        new_params = adam.step(self.gradient, self.loss)
        
        m = (1 - 0.9) * self.gradient
        v = (1 - 0.999) * self.gradient ** 2
        
        m_hat = m / (1 - 0.9 ** 1)
        v_hat = v / (1 - 0.999 ** 1)
        
        expected = self.initial_params - 0.001 * m_hat / (np.sqrt(v_hat) + 1e-8)
        
        np.testing.assert_array_almost_equal(new_params, expected)
    
    def test_optimizer_history(self):
        sgd = SGD(learning_rate=0.1)
        sgd.initialize(self.initial_params)
        
        sgd.step(self.gradient, self.loss)
        sgd.step(np.array([0.1, 0.2]), 1.0)
        
        history = sgd.get_history()
        
        self.assertEqual(len(history['parameters']), 3)
        self.assertEqual(len(history['loss']), 2)
        self.assertEqual(len(history['gradients']), 2)
    
    def test_optimizer_validation(self):
        good_sgd = SGD(learning_rate=0.01)
        warnings = good_sgd.validate_parameters()
        self.assertEqual(len(warnings), 0)
        
        bad_sgd_high = SGD(learning_rate=2.0)
        warnings_high = bad_sgd_high.validate_parameters()
        self.assertTrue(any('过大' in w[1] for w in warnings_high))
        
        bad_sgd_low = SGD(learning_rate=1e-7)
        warnings_low = bad_sgd_low.validate_parameters()
        self.assertTrue(any('过小' in w[1] for w in warnings_low))
        
        bad_sgd_neg = SGD(learning_rate=-0.01)
        warnings_neg = bad_sgd_neg.validate_parameters()
        self.assertTrue(any('大于0' in w[1] for w in warnings_neg))
    
    def test_optimizer_state_save_load(self):
        sgd = SGD(learning_rate=0.1, seed=42)
        sgd.initialize(self.initial_params)
        sgd.step(self.gradient, self.loss)
        
        state = sgd.get_state()
        
        sgd2 = SGD()
        sgd2.set_state(state)
        
        self.assertEqual(sgd2.learning_rate, 0.1)
        self.assertEqual(sgd2.seed, 42)
        np.testing.assert_array_almost_equal(sgd2.parameters, sgd.parameters)
    
    def test_momentum_validation(self):
        bad_momentum = Momentum(momentum=1.5)
        warnings = bad_momentum.validate_parameters()
        self.assertTrue(any('[0, 1)' in w[1] for w in warnings))
        
        bad_momentum2 = Momentum(momentum=-0.5)
        warnings2 = bad_momentum2.validate_parameters()
        self.assertTrue(any('[0, 1)' in w[1] for w in warnings2))
    
    def test_adam_validation(self):
        bad_adam = Adam(beta1=1.5, beta2=2.0)
        warnings = bad_adam.validate_parameters()
        
        self.assertTrue(any('beta1' in w[0] for w in warnings))
        self.assertTrue(any('beta2' in w[0] for w in warnings))

if __name__ == '__main__':
    unittest.main()
