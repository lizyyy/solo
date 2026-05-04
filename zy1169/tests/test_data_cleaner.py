import os
import pytest
import pandas as pd
import numpy as np
import yaml


class TestDataCleaner:
    def test_drop_duplicates(self):
        from core.data_cleaner import DataCleaner
        
        data = pd.DataFrame({
            'id': [1, 2, 1, 3, 2],
            'value': ['a', 'b', 'a', 'c', 'b']
        })
        
        rules = [{'name': 'drop_duplicates', 'action': 'drop_duplicates'}]
        cleaner = DataCleaner(rules)
        result, logs = cleaner.clean(data)
        
        assert len(result) == 3
        assert len(logs) > 0
    
    def test_fill_missing_values(self):
        from core.data_cleaner import DataCleaner
        
        data = pd.DataFrame({
            'id': [1, 2, 3, 4, 5],
            'age': [25, np.nan, 30, np.nan, 35],
            'income': [50000, 60000, np.nan, 70000, np.nan]
        })
        
        rules = [
            {
                'name': 'fill_age',
                'action': 'fill_missing',
                'column': 'age',
                'method': 'median'
            },
            {
                'name': 'fill_income',
                'action': 'fill_missing',
                'column': 'income',
                'method': 'mean'
            }
        ]
        
        cleaner = DataCleaner(rules)
        result, logs = cleaner.clean(data)
        
        assert result['age'].isnull().sum() == 0
        assert result['income'].isnull().sum() == 0
    
    def test_filter_rows(self):
        from core.data_cleaner import DataCleaner
        
        data = pd.DataFrame({
            'id': [1, 2, 3, 4, 5],
            'age': [15, 25, 35, 120, 45]
        })
        
        rules = [
            {
                'name': 'filter_age',
                'action': 'filter',
                'condition': 'age >= 18 and age <= 100'
            }
        ]
        
        cleaner = DataCleaner(rules)
        result, logs = cleaner.clean(data)
        
        assert len(result) == 3
        assert list(result['id']) == [2, 3, 5]
    
    def test_convert_type(self):
        from core.data_cleaner import DataCleaner
        
        data = pd.DataFrame({
            'id': [1, 2, 3],
            'flag': ['1', '0', '1']
        })
        
        rules = [
            {
                'name': 'convert_flag',
                'action': 'convert_type',
                'columns': ['flag'],
                'dtype': 'int'
            }
        ]
        
        cleaner = DataCleaner(rules)
        result, logs = cleaner.clean(data)
        
        assert result['flag'].dtype == 'int64'
        assert list(result['flag']) == [1, 0, 1]
    
    def test_drop_columns(self):
        from core.data_cleaner import DataCleaner
        
        data = pd.DataFrame({
            'id': [1, 2, 3],
            'keep_me': ['a', 'b', 'c'],
            'drop_me': [1, 2, 3]
        })
        
        rules = [
            {
                'name': 'drop_cols',
                'action': 'drop_column',
                'columns': ['drop_me']
            }
        ]
        
        cleaner = DataCleaner(rules)
        result, logs = cleaner.clean(data)
        
        assert 'drop_me' not in result.columns
        assert 'keep_me' in result.columns
    
    def test_rename_columns(self):
        from core.data_cleaner import DataCleaner
        
        data = pd.DataFrame({
            'old_name': [1, 2, 3]
        })
        
        rules = [
            {
                'name': 'rename',
                'action': 'rename_column',
                'columns': {'old_name': 'new_name'}
            }
        ]
        
        cleaner = DataCleaner(rules)
        result, logs = cleaner.clean(data)
        
        assert 'new_name' in result.columns
        assert 'old_name' not in result.columns
    
    def test_load_cleaning_rules_yaml(self, good_data_path):
        from core.data_cleaner import DataCleaner
        
        rules_path = os.path.join(good_data_path, 'cleaning-rules.yaml')
        with open(rules_path, 'r') as f:
            rules = yaml.safe_load(f)
        
        assert 'rules' in rules
        assert len(rules['rules']) > 0
        
        cleaner = DataCleaner(rules['rules'])
        assert len(cleaner.rules) == len(rules['rules'])
    
    def test_invalid_rule_handling(self):
        from core.data_cleaner import DataCleaner
        
        data = pd.DataFrame({'col': [1, 2, 3]})
        
        rules = [
            {'name': 'invalid', 'action': 'nonexistent_action'}
        ]
        
        cleaner = DataCleaner(rules)
        result, logs = cleaner.clean(data)
        
        assert len(logs) > 0
        error_logs = [l for l in logs if 'error' in l.get('level', '').lower()]
        assert len(error_logs) > 0
