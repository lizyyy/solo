import numpy as np
import unittest
import sys
import os
import tempfile
import shutil

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.experiments import Experiment, ExperimentManager
from backend.reports import ReportGenerator
from backend.optimizers import SGD, Adam, Momentum
from backend.datasets import SyntheticDataset, MeanSquaredError

class TestExperiment(unittest.TestCase):
    def setUp(self):
        np.random.seed(42)
        self.temp_dir = tempfile.mkdtemp()
    
    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_experiment_creation(self):
        optimizer = SGD(learning_rate=0.1, seed=42)
        dataset = SyntheticDataset(dataset_type='linear_regression', size=100, feature_dim=2, seed=42)
        loss_function = MeanSquaredError()
        
        experiment = Experiment(
            name='Test Experiment',
            optimizer=optimizer,
            dataset=dataset,
            loss_function=loss_function,
            batch_size=32,
            epochs=10,
            seed=42
        )
        
        self.assertEqual(experiment.name, 'Test Experiment')
        self.assertEqual(experiment.batch_size, 32)
        self.assertEqual(experiment.epochs, 10)
        self.assertFalse(experiment.is_completed)
        self.assertFalse(experiment.is_running)
    
    def test_experiment_initialize(self):
        optimizer = SGD(learning_rate=0.1, seed=42)
        dataset = SyntheticDataset(dataset_type='linear_regression', size=100, feature_dim=2, seed=42)
        
        experiment = Experiment(
            name='Test',
            optimizer=optimizer,
            dataset=dataset,
            batch_size=32,
            epochs=10
        )
        
        self.assertIsNone(experiment.parameters)
        
        experiment.initialize()
        
        self.assertIsNotNone(experiment.parameters)
        self.assertEqual(len(experiment.parameters), 2)
    
    def test_experiment_step(self):
        optimizer = SGD(learning_rate=0.01, seed=42)
        dataset = SyntheticDataset(dataset_type='linear_regression', size=100, feature_dim=2, seed=42)
        
        experiment = Experiment(
            name='Test',
            optimizer=optimizer,
            dataset=dataset,
            batch_size=32,
            epochs=10
        )
        
        experiment.initialize()
        initial_params = experiment.parameters.copy()
        
        result = experiment.step()
        
        self.assertEqual(result['epoch'], 1)
        self.assertIsNotNone(result['loss'])
        self.assertIsNotNone(result['parameters'])
        self.assertIsNotNone(result['gradients'])
        
        self.assertFalse(np.array_equal(initial_params, result['parameters']))
    
    def test_experiment_run(self):
        optimizer = SGD(learning_rate=0.01, seed=42)
        dataset = SyntheticDataset(dataset_type='linear_regression', size=100, feature_dim=2, seed=42)
        
        experiment = Experiment(
            name='Test',
            optimizer=optimizer,
            dataset=dataset,
            batch_size=32,
            epochs=5
        )
        
        experiment.initialize()
        
        history = experiment.run()
        
        self.assertEqual(len(history['losses']), 5)
        self.assertEqual(len(history['parameters']), 5)
        self.assertTrue(experiment.is_completed)
        self.assertEqual(experiment.current_epoch, 5)
    
    def test_experiment_validate(self):
        optimizer = SGD(learning_rate=10.0, seed=42)
        dataset = SyntheticDataset(dataset_type='linear_regression', size=100, feature_dim=2, seed=42)
        
        experiment = Experiment(
            name='Test',
            optimizer=optimizer,
            dataset=dataset,
            batch_size=-1,
            epochs=-10
        )
        
        warnings = experiment.validate_configuration()
        
        self.assertTrue(len(warnings) > 0)
        self.assertTrue(any('learning_rate' in w[0] for w in warnings))
        self.assertTrue(any('batch_size' in w[0] for w in warnings))
        self.assertTrue(any('epochs' in w[0] for w in warnings))
    
    def test_experiment_get_history(self):
        optimizer = SGD(learning_rate=0.01, seed=42)
        dataset = SyntheticDataset(dataset_type='linear_regression', size=100, feature_dim=2, seed=42)
        
        experiment = Experiment(
            name='Test',
            optimizer=optimizer,
            dataset=dataset,
            batch_size=32,
            epochs=3
        )
        
        experiment.initialize()
        experiment.run()
        
        history = experiment.get_history()
        
        self.assertIn('loss', history)
        self.assertIn('parameters', history)
        self.assertIn('gradients', history)
        self.assertEqual(len(history['loss']), 3)

class TestExperimentManager(unittest.TestCase):
    def setUp(self):
        np.random.seed(42)
        self.temp_dir = tempfile.mkdtemp()
        self.manager = ExperimentManager(storage_dir=self.temp_dir)
    
    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_create_experiment(self):
        optimizer_config = {'type': 'SGD', 'params': {'learning_rate': 0.01}}
        dataset_config = {'type': 'linear_regression', 'params': {'size': 100, 'feature_dim': 2}}
        
        experiment = self.manager.create_experiment(
            name='Test Exp',
            optimizer_config=optimizer_config,
            dataset_config=dataset_config,
            batch_size=32,
            epochs=10,
            seed=42
        )
        
        self.assertEqual(experiment.name, 'Test Exp')
        self.assertEqual(len(self.manager.experiments), 1)
    
    def test_list_experiments(self):
        optimizer_config = {'type': 'SGD', 'params': {'learning_rate': 0.01}}
        dataset_config = {'type': 'linear_regression', 'params': {'size': 100, 'feature_dim': 2}}
        
        self.manager.create_experiment('Exp1', optimizer_config, dataset_config)
        self.manager.create_experiment('Exp2', optimizer_config, dataset_config)
        
        experiments = self.manager.list_experiments()
        
        self.assertEqual(len(experiments), 2)
        self.assertTrue(any(e['name'] == 'Exp1' for e in experiments))
        self.assertTrue(any(e['name'] == 'Exp2' for e in experiments))
    
    def test_get_experiment(self):
        optimizer_config = {'type': 'SGD', 'params': {'learning_rate': 0.01}}
        dataset_config = {'type': 'linear_regression', 'params': {'size': 100, 'feature_dim': 2}}
        
        exp = self.manager.create_experiment('Test', optimizer_config, dataset_config)
        
        retrieved = self.manager.get_experiment(exp.id)
        
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved.id, exp.id)
    
    def test_run_experiment(self):
        optimizer_config = {'type': 'SGD', 'params': {'learning_rate': 0.01}}
        dataset_config = {'type': 'linear_regression', 'params': {'size': 100, 'feature_dim': 2}}
        
        exp = self.manager.create_experiment('Test', optimizer_config, dataset_config, epochs=5)
        
        result = self.manager.run_experiment(exp.id)
        
        self.assertEqual(result['epochs_completed'], 5)
    
    def test_compare_experiments(self):
        optimizer_config1 = {'type': 'SGD', 'params': {'learning_rate': 0.01}}
        optimizer_config2 = {'type': 'Adam', 'params': {'learning_rate': 0.001}}
        dataset_config = {'type': 'linear_regression', 'params': {'size': 100, 'feature_dim': 2}}
        
        exp1 = self.manager.create_experiment('SGD Test', optimizer_config1, dataset_config, epochs=10)
        exp2 = self.manager.create_experiment('Adam Test', optimizer_config2, dataset_config, epochs=10)
        
        self.manager.run_experiment(exp1.id)
        self.manager.run_experiment(exp2.id)
        
        comparison = self.manager.compare_experiments([exp1.id, exp2.id])
        
        self.assertIn('metrics', comparison)
        self.assertIn('loss_comparison', comparison)
        self.assertEqual(len(comparison['metrics']), 2)
    
    def test_save_and_load_experiment(self):
        optimizer_config = {'type': 'SGD', 'params': {'learning_rate': 0.01}}
        dataset_config = {'type': 'linear_regression', 'params': {'size': 100, 'feature_dim': 2}}
        
        exp = self.manager.create_experiment('Save Test', optimizer_config, dataset_config, epochs=3)
        self.manager.run_experiment(exp.id)
        
        saved_path = self.manager.save_experiment(exp.id)
        self.assertTrue(os.path.exists(saved_path))
        
        self.manager.experiments = {}
        
        loaded_exp = self.manager.load_experiment(saved_path)
        
        self.assertEqual(loaded_exp.name, 'Save Test')
        self.assertEqual(loaded_exp.current_epoch, 3)

class TestReportGenerator(unittest.TestCase):
    def setUp(self):
        np.random.seed(42)
        self.temp_dir = tempfile.mkdtemp()
        self.report_dir = os.path.join(self.temp_dir, 'reports')
        self.experiments_dir = os.path.join(self.temp_dir, 'experiments')
        
        os.makedirs(self.report_dir, exist_ok=True)
        os.makedirs(self.experiments_dir, exist_ok=True)
        
        self.manager = ExperimentManager(storage_dir=self.experiments_dir)
        self.generator = ReportGenerator(output_dir=self.report_dir)
    
    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_generate_markdown_report(self):
        optimizer_config = {'type': 'SGD', 'params': {'learning_rate': 0.01}}
        dataset_config = {'type': 'linear_regression', 'params': {'size': 100, 'feature_dim': 2}}
        
        exp = self.manager.create_experiment('Report Test', optimizer_config, dataset_config, epochs=3)
        self.manager.run_experiment(exp.id)
        
        report = self.generator.generate_markdown_report(exp)
        
        self.assertIn('# 优化器实验报告', report)
        self.assertIn('Report Test', report)
        self.assertIn('SGD', report)
    
    def test_save_report(self):
        optimizer_config = {'type': 'SGD', 'params': {'learning_rate': 0.01}}
        dataset_config = {'type': 'linear_regression', 'params': {'size': 100, 'feature_dim': 2}}
        
        exp = self.manager.create_experiment('Save Report', optimizer_config, dataset_config, epochs=3)
        self.manager.run_experiment(exp.id)
        
        filepath = self.generator.generate_and_save_report(exp, 'test_report', 'markdown')
        
        self.assertTrue(os.path.exists(filepath))
        self.assertTrue(filepath.endswith('.md'))
    
    def test_comparison_report(self):
        optimizer_config1 = {'type': 'SGD', 'params': {'learning_rate': 0.01}}
        optimizer_config2 = {'type': 'Adam', 'params': {'learning_rate': 0.001}}
        dataset_config = {'type': 'linear_regression', 'params': {'size': 100, 'feature_dim': 2}}
        
        exp1 = self.manager.create_experiment('SGD Test', optimizer_config1, dataset_config, epochs=5)
        exp2 = self.manager.create_experiment('Adam Test', optimizer_config2, dataset_config, epochs=5)
        
        self.manager.run_experiment(exp1.id)
        self.manager.run_experiment(exp2.id)
        
        report = self.generator.generate_comparison_report(self.manager, [exp1.id, exp2.id], 'markdown')
        
        self.assertIn('# 优化器对比实验报告', report)
        self.assertIn('SGD', report)
        self.assertIn('Adam', report)

if __name__ == '__main__':
    unittest.main()
