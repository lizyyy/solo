import os
import pytest
import pandas as pd
import numpy as np
import yaml


class TestFeatureEngineer:
    def test_normalize_minmax(self):
        from core.feature_engineer import FeatureEngineer
        
        data = pd.DataFrame({
            'value': [10, 20, 30, 40, 50]
        })
        
        fe = FeatureEngineer()
        result = fe.normalize(data['value'], method='minmax')
        
        assert result.min() == 0.0
        assert result.max() == 1.0
        assert result.iloc[0] == 0.0
        assert result.iloc[4] == 1.0
    
    def test_normalize_standard(self):
        from core.feature_engineer import FeatureEngineer
        
        data = pd.DataFrame({
            'value': [1, 2, 3, 4, 5]
        })
        
        fe = FeatureEngineer()
        result = fe.normalize(data['value'], method='standard')
        
        assert abs(result.mean()) < 0.01
    
    def test_label_encode(self):
        from core.feature_engineer import FeatureEngineer
        
        data = pd.DataFrame({
            'category': ['a', 'b', 'c', 'a', 'b']
        })
        
        fe = FeatureEngineer()
        result = fe.label_encode(data['category'])
        
        assert len(result) == 5
        assert result.nunique() == 3
    
    def test_one_hot_encode(self):
        from core.feature_engineer import FeatureEngineer
        
        data = pd.DataFrame({
            'category': ['a', 'b', 'c', 'a']
        })
        
        fe = FeatureEngineer()
        result = fe.one_hot_encode(data['category'])
        
        assert result.shape == (4, 3)
    
    def test_bin_features(self):
        from core.feature_engineer import FeatureEngineer
        
        data = pd.DataFrame({
            'age': [18, 25, 35, 45, 55, 65]
        })
        
        fe = FeatureEngineer()
        result = fe.bin(
            data['age'],
            bins=[0, 30, 50, 200],
            labels=['young', 'middle', 'senior']
        )
        
        assert list(result) == ['young', 'young', 'middle', 'middle', 'senior', 'senior']
    
    def test_log_transform(self):
        from core.feature_engineer import FeatureEngineer
        
        data = pd.DataFrame({
            'value': [1, 10, 100, 1000]
        })
        
        fe = FeatureEngineer()
        result = fe.log_transform(data['value'])
        
        assert result.iloc[0] == 0.0
        assert result.iloc[1] > 0
    
    def test_interaction_features(self):
        from core.feature_engineer import FeatureEngineer
        
        data = pd.DataFrame({
            'a': [1, 2, 3, 4],
            'b': [10, 20, 30, 40]
        })
        
        fe = FeatureEngineer()
        result = fe.interaction([data['a'], data['b']])
        
        assert list(result) == [10, 40, 90, 160]
    
    def test_polynomial_features(self):
        from core.feature_engineer import FeatureEngineer
        
        data = pd.DataFrame({
            'a': [1, 2, 3],
            'b': [4, 5, 6]
        })
        
        fe = FeatureEngineer()
        result = fe.polynomial(data[['a', 'b']], degree=2)
        
        assert result.shape[1] > 2
    
    def test_extract_datetime(self):
        from core.feature_engineer import FeatureEngineer
        
        data = pd.DataFrame({
            'date': pd.to_datetime(['2023-01-15', '2023-06-20', '2023-12-25'])
        })
        
        fe = FeatureEngineer()
        result = fe.extract_datetime(data['date'])
        
        assert 'year' in result.columns
        assert 'month' in result.columns
        assert 'day' in result.columns
        assert 'dayofweek' in result.columns
    
    def test_check_feature_leakage(self):
        from core.feature_engineer import check_feature_leakage
        
        data = pd.DataFrame({
            'feature1': [1, 2, 3, 4, 5],
            'feature2': [1, 1, 1, 1, 1],
            'target': [0, 1, 0, 1, 0]
        })
        
        issues = check_feature_leakage(data, target_column='target')
        
        assert isinstance(issues, list)
    
    def test_check_feature_leakage_with_perfect_correlation(self, bad_data_path):
        from core.feature_engineer import check_feature_leakage
        
        data = pd.read_csv(os.path.join(bad_data_path, 'bad_data_leakage.csv'))
        
        issues = check_feature_leakage(data, target_column='churned')
        
        assert len(issues) > 0
        leakage_features = [i['feature'] for i in issues if i['type'] == 'high_correlation']
        assert 'churned_perfect' in leakage_features
    
    def test_check_feature_leakage_with_constant_feature(self):
        from core.feature_engineer import check_feature_leakage
        
        data = pd.DataFrame({
            'normal': [1, 2, 3, 4, 5],
            'constant': [1, 1, 1, 1, 1],
            'target': [0, 1, 0, 1, 0]
        })
        
        issues = check_feature_leakage(data, target_column='target')
        
        constant_issues = [i for i in issues if i['type'] == 'zero_variance']
        assert len(constant_issues) > 0
        assert 'constant' in [i['feature'] for i in constant_issues]
    
    def test_load_feature_spec_yaml(self, good_data_path):
        from core.feature_engineer import FeatureEngineer
        
        spec_path = os.path.join(good_data_path, 'feature-spec.yaml')
        with open(spec_path, 'r') as f:
            spec = yaml.safe_load(f)
        
        assert 'features' in spec
        assert 'target_column' in spec
        assert len(spec['features']) > 0
