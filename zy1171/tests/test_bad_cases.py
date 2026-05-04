import numpy as np
import unittest
import sys
import os
import tempfile
import shutil

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.optimizers import SGD, Momentum, Adagrad, RMSProp, Adam
from backend.datasets import SyntheticDataset, MeanSquaredError, TwoDLossSurface
from backend.experiments import Experiment, ExperimentManager

class TestBadOptimizerParameters(unittest.TestCase):
    def setUp(self):
        np.random.seed(42)
        self.initial_params = np.array([1.0, 2.0])
        self.gradient = np.array([0.5, 0.3])
        self.loss = 1.5
    
    def test_negative_learning_rate(self):
        sgd = SGD(learning_rate=-0.01)
        
        warnings = sgd.validate_parameters()
        
        self.assertTrue(len(warnings) > 0)
        self.assertTrue(any('大于0' in w[1] for w in warnings))
    
    def test_zero_learning_rate(self):
        sgd = SGD(learning_rate=0.0)
        
        warnings = sgd.validate_parameters()
        
        self.assertTrue(len(warnings) > 0)
        self.assertTrue(any('大于0' in w[1] for w in warnings))
    
    def test_too_large_learning_rate(self):
        sgd = SGD(learning_rate=10.0)
        
        warnings = sgd.validate_parameters()
        
        self.assertTrue(len(warnings) > 0)
        self.assertTrue(any('过大' in w[1] for w in warnings))
    
    def test_too_small_learning_rate(self):
        sgd = SGD(learning_rate=1e-10)
        
        warnings = sgd.validate_parameters()
        
        self.assertTrue(len(warnings) > 0)
        self.assertTrue(any('过小' in w[1] for w in warnings))
    
    def test_invalid_momentum_high(self):
        momentum = Momentum(momentum=2.0)
        
        warnings = momentum.validate_parameters()
        
        self.assertTrue(len(warnings) > 0)
        self.assertTrue(any('[0, 1)' in w[1] for w in warnings))
    
    def test_invalid_momentum_low(self):
        momentum = Momentum(momentum=-0.5)
        
        warnings = momentum.validate_parameters()
        
        self.assertTrue(len(warnings) > 0)
        self.assertTrue(any('[0, 1)' in w[1] for w in warnings))
    
    def test_invalid_momentum_too_high(self):
        momentum = Momentum(momentum=0.9999)
        
        warnings = momentum.validate_parameters()
        
        self.assertTrue(len(warnings) > 0)
        self.assertTrue(any('过大' in w[1] for w in warnings))
    
    def test_invalid_beta_rmsprop(self):
        rmsprop = RMSProp(beta=2.0)
        
        warnings = rmsprop.validate_parameters()
        
        self.assertTrue(len(warnings) > 0)
        self.assertTrue(any('beta' in w[0] for w in warnings))
    
    def test_invalid_epsilon(self):
        adagrad = Adagrad(epsilon=-1e-8)
        
        warnings = adagrad.validate_parameters()
        
        self.assertTrue(len(warnings) > 0)
        self.assertTrue(any('epsilon' in w[0] for w in warnings))
    
    def test_invalid_epsilon_too_large(self):
        adagrad = Adagrad(epsilon=1e-3)
        
        warnings = adagrad.validate_parameters()
        
        self.assertTrue(len(warnings) > 0)
        self.assertTrue(any('过大' in w[1] for w in warnings))
    
    def test_invalid_beta1_adam(self):
        adam = Adam(beta1=2.0, beta2=0.999)
        
        warnings = adam.validate_parameters()
        
        self.assertTrue(any('beta1' in w[0] for w in warnings))
    
    def test_invalid_beta2_adam(self):
        adam = Adam(beta1=0.9, beta2=2.0)
        
        warnings = adam.validate_parameters()
        
        self.assertTrue(any('beta2' in w[0] for w in warnings))
    
    def test_optimizer_not_initialized(self):
        sgd = SGD(learning_rate=0.01)
        
        with self.assertRaises(RuntimeError) as context:
            sgd.step(self.gradient, self.loss)
        
        self.assertIn('初始化', str(context.exception))

class TestBadDatasetParameters(unittest.TestCase):
    def setUp(self):
        np.random.seed(42)
    
    def test_empty_dataset(self):
        dataset = SyntheticDataset(dataset_type='linear_regression', size=0)
        
        with self.assertRaises(Exception):
            dataset.load()
    
    def test_negative_batch_size(self):
        dataset = SyntheticDataset(dataset_type='linear_regression', size=100, feature_dim=2)
        dataset.load()
        
        with self.assertRaises(ValueError) as context:
            dataset.get_batch(batch_size=-1)
        
        self.assertIn('batch_size', str(context.exception))
    
    def test_zero_batch_size(self):
        dataset = SyntheticDataset(dataset_type='linear_regression', size=100, feature_dim=2)
        dataset.load()
        
        with self.assertRaises(ValueError) as context:
            dataset.get_batch(batch_size=0)
        
        self.assertIn('batch_size', str(context.exception))
    
    def test_dataset_not_loaded(self):
        dataset = SyntheticDataset(dataset_type='linear_regression', size=100, feature_dim=2)
        
        with self.assertRaises(RuntimeError) as context:
            dataset.get_batch(batch_size=32)
        
        self.assertIn('未加载', str(context.exception))
    
    def test_unsupported_dataset_type(self):
        with self.assertRaises(ValueError) as context:
            dataset = SyntheticDataset(dataset_type='invalid_type', size=100)
            dataset.load()
        
        self.assertIn('不支持', str(context.exception))
    
    def test_invalid_loss_surface_parameters(self):
        def loss_fn(x, y):
            return x ** 2 + y ** 2
        
        loss_surface = TwoDLossSurface(loss_fn)
        
        with self.assertRaises(ValueError) as context:
            loss_surface.compute(None, None, None)
        
        self.assertIn('parameters', str(context.exception))
    
    def test_invalid_parameter_dimension(self):
        def loss_fn(x, y):
            return x ** 2 + y ** 2
        
        loss_surface = TwoDLossSurface(loss_fn)
        
        with self.assertRaises(ValueError) as context:
            loss_surface.compute(None, None, np.array([1.0]))
        
        self.assertIn('2 维', str(context.exception))

class TestBadExperimentParameters(unittest.TestCase):
    def setUp(self):
        np.random.seed(42)
        self.temp_dir = tempfile.mkdtemp()
    
    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_negative_batch_size(self):
        optimizer = SGD(learning_rate=0.01)
        dataset = SyntheticDataset(dataset_type='linear_regression', size=100, feature_dim=2)
        
        experiment = Experiment(
            name='Test',
            optimizer=optimizer,
            dataset=dataset,
            batch_size=-1,
            epochs=10
        )
        
        warnings = experiment.validate_configuration()
        
        self.assertTrue(any('batch_size' in w[0] for w in warnings))
    
    def test_negative_epochs(self):
        optimizer = SGD(learning_rate=0.01)
        dataset = SyntheticDataset(dataset_type='linear_regression', size=100, feature_dim=2)
        
        experiment = Experiment(
            name='Test',
            optimizer=optimizer,
            dataset=dataset,
            batch_size=32,
            epochs=-10
        )
        
        warnings = experiment.validate_configuration()
        
        self.assertTrue(any('epochs' in w[0] for w in warnings))
    
    def test_too_large_batch_size(self):
        optimizer = SGD(learning_rate=0.01)
        dataset = SyntheticDataset(dataset_type='linear_regression', size=100, feature_dim=2)
        
        experiment = Experiment(
            name='Test',
            optimizer=optimizer,
            dataset=dataset,
            batch_size=5000,
            epochs=10
        )
        
        warnings = experiment.validate_configuration()
        
        self.assertTrue(any('过大' in w[1] for w in warnings))
    
    def test_too_large_epochs(self):
        optimizer = SGD(learning_rate=0.01)
        dataset = SyntheticDataset(dataset_type='linear_regression', size=100, feature_dim=2)
        
        experiment = Experiment(
            name='Test',
            optimizer=optimizer,
            dataset=dataset,
            batch_size=32,
            epochs=50000
        )
        
        warnings = experiment.validate_configuration()
        
        self.assertTrue(any('epochs' in w[0] for w in warnings))
    
    def test_no_optimizer(self):
        dataset = SyntheticDataset(dataset_type='linear_regression', size=100, feature_dim=2)
        
        experiment = Experiment(
            name='Test',
            optimizer=None,
            dataset=dataset,
            batch_size=32,
            epochs=10
        )
        
        warnings = experiment.validate_configuration()
        
        self.assertTrue(any('optimizer' in w[0] for w in warnings))
    
    def test_no_dataset(self):
        optimizer = SGD(learning_rate=0.01)
        
        experiment = Experiment(
            name='Test',
            optimizer=optimizer,
            dataset=None,
            batch_size=32,
            epochs=10
        )
        
        warnings = experiment.validate_configuration()
        
        self.assertTrue(any('dataset' in w[0] for w in warnings))
    
    def test_nonexistent_experiment(self):
        manager = ExperimentManager(storage_dir=self.temp_dir)
        
        with self.assertRaises(ValueError) as context:
            manager.run_experiment('nonexistent_id')
        
        self.assertIn('不存在', str(context.exception))
    
    def test_compare_single_experiment(self):
        manager = ExperimentManager(storage_dir=self.temp_dir)
        
        comparison = manager.compare_experiments(['single_id'])
        
        self.assertIn('error', comparison)

class TestNumericalInstabilityCases(unittest.TestCase):
    def setUp(self):
        np.random.seed(42)
    
    def test_very_large_gradient(self):
        sgd = SGD(learning_rate=0.1)
        sgd.initialize(np.array([1.0, 2.0]))
        
        very_large_gradient = np.array([1e10, 1e10])
        result = sgd.step(very_large_gradient, 1e20)
        
        self.assertTrue(np.isfinite(result).all() or np.any(np.isinf(result)))
    
    def test_nan_loss(self):
        sgd = SGD(learning_rate=0.1)
        sgd.initialize(np.array([1.0, 2.0]))
        
        result = sgd.step(np.array([0.5, 0.3]), np.nan)
        
        history = sgd.get_history()
        self.assertTrue(np.isnan(history['loss'][-1]))
    
    def test_inf_gradient(self):
        sgd = SGD(learning_rate=0.1)
        sgd.initialize(np.array([1.0, 2.0]))
        
        inf_gradient = np.array([np.inf, -np.inf])
        result = sgd.step(inf_gradient, 1.0)
        
        self.assertTrue(np.any(np.isinf(result)) or np.any(np.isnan(result)))
    
    def test_zero_gradient(self):
        sgd = SGD(learning_rate=0.1)
        initial_params = np.array([1.0, 2.0])
        sgd.initialize(initial_params)
        
        result = sgd.step(np.array([0.0, 0.0]), 1.0)
        
        np.testing.assert_array_equal(result, initial_params)

if __name__ == '__main__':
    unittest.main()
