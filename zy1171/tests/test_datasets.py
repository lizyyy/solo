import numpy as np
import unittest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.datasets import Dataset, SyntheticDataset, MeanSquaredError, CrossEntropy, TwoDLossSurface

class TestDatasets(unittest.TestCase):
    def setUp(self):
        np.random.seed(42)
    
    def test_synthetic_linear_regression(self):
        dataset = SyntheticDataset(dataset_type='linear_regression', size=100, feature_dim=2, seed=42)
        X, y = dataset.load()
        
        self.assertEqual(len(X), 100)
        self.assertEqual(X.shape[1], 2)
        self.assertEqual(len(y), 100)
        self.assertTrue(dataset._initialized)
    
    def test_synthetic_nonlinear_regression(self):
        dataset = SyntheticDataset(dataset_type='nonlinear_regression', size=50, feature_dim=3, seed=42)
        X, y = dataset.load()
        
        self.assertEqual(len(X), 50)
        self.assertEqual(X.shape[1], 3)
    
    def test_synthetic_classification(self):
        dataset = SyntheticDataset(dataset_type='classification', size=200, feature_dim=4, seed=42)
        X, y = dataset.load()
        
        self.assertEqual(len(X), 200)
        self.assertTrue(all(yi in [0, 1] for yi in y))
    
    def test_synthetic_loss_surface_2d(self):
        dataset = SyntheticDataset(dataset_type='loss_surface_2d', seed=42)
        X, y = dataset.load()
        
        self.assertEqual(X.shape[1], 2)
        self.assertIsNotNone(dataset.get_loss_surface())
    
    def test_dataset_batch(self):
        dataset = SyntheticDataset(dataset_type='linear_regression', size=100, feature_dim=2, seed=42)
        dataset.load()
        
        X_batch, y_batch = dataset.get_batch(batch_size=32)
        
        self.assertEqual(len(X_batch), 32)
        self.assertEqual(len(y_batch), 32)
    
    def test_dataset_validation(self):
        dataset = SyntheticDataset(dataset_type='linear_regression', size=100, feature_dim=2, seed=42)
        
        warnings = dataset.validate()
        self.assertTrue(any('未加载' in w[1] for w in warnings))
        
        dataset.load()
        warnings_after = dataset.validate()
        self.assertEqual(len(warnings_after), 0)
    
    def test_dataset_size_and_dim(self):
        dataset = SyntheticDataset(dataset_type='linear_regression', size=150, feature_dim=5, seed=42)
        dataset.load()
        
        self.assertEqual(dataset.size(), 150)
        self.assertEqual(dataset.feature_dim(), 5)
    
    def test_dataset_get_all(self):
        dataset = SyntheticDataset(dataset_type='linear_regression', size=100, feature_dim=2, seed=42)
        X_load, y_load = dataset.load()
        
        X_get, y_get = dataset.get_all()
        
        np.testing.assert_array_equal(X_load, X_get)
        np.testing.assert_array_equal(y_load, y_get)

class TestLossFunctions(unittest.TestCase):
    def setUp(self):
        np.random.seed(42)
        self.y_true = np.array([1.0, 2.0, 3.0, 4.0])
        self.y_pred = np.array([1.2, 1.8, 3.5, 3.8])
        self.X = np.array([[1, 2], [2, 3], [3, 4], [4, 5]])
        self.parameters = np.array([0.5, 0.5])
    
    def test_mse_compute(self):
        mse = MeanSquaredError()
        loss = mse.compute(self.y_pred, self.y_true)
        
        expected = np.mean((self.y_pred - self.y_true) ** 2) / 2
        self.assertAlmostEqual(loss, expected)
    
    def test_mse_gradient(self):
        mse = MeanSquaredError()
        gradient = mse.gradient(self.X, self.y_pred, self.y_true, self.parameters)
        
        expected = np.dot(self.X.T, (self.y_pred - self.y_true)) / len(self.y_true)
        np.testing.assert_array_almost_equal(gradient, expected)
    
    def test_cross_entropy(self):
        ce = CrossEntropy()
        
        y_true = np.array([1, 0, 1, 0])
        y_pred = np.array([0.9, 0.1, 0.8, 0.3])
        
        loss = ce.compute(y_pred, y_true)
        self.assertGreater(loss, 0)
        
        gradient = ce.gradient(self.X, y_pred, y_true, self.parameters)
        self.assertEqual(len(gradient), self.X.shape[1])
    
    def test_2d_loss_surface(self):
        def loss_fn(x, y):
            return x ** 2 + y ** 2
        
        loss = TwoDLossSurface(loss_fn)
        
        params = np.array([3.0, 4.0])
        loss_val = loss.compute(None, None, params)
        
        self.assertAlmostEqual(loss_val, 25.0)
        
        gradient = loss.gradient(None, None, None, params)
        
        expected_x = 6.0
        expected_y = 8.0
        self.assertAlmostEqual(gradient[0], expected_x, delta=0.01)
        self.assertAlmostEqual(gradient[1], expected_y, delta=0.01)

if __name__ == '__main__':
    unittest.main()
