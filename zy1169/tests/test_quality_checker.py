import os
import pytest
import pandas as pd
import numpy as np


class TestDataQualityChecker:
    def test_detect_missing_values(self, good_data_path, bad_data_path):
        from core.quality_checker import DataQualityChecker
        
        good_data = pd.read_csv(os.path.join(good_data_path, 'raw-data.csv'))
        checker = DataQualityChecker(good_data)
        issues = checker.check_all()
        
        missing_issues = [i for i in issues if i['type'] == 'missing_values']
        for issue in missing_issues:
            assert issue['severity'] == 'low' or issue['percentage'] < 0.1
        
        bad_data = pd.read_csv(os.path.join(bad_data_path, 'bad_data_missing_values.csv'))
        checker2 = DataQualityChecker(bad_data)
        issues2 = checker2.check_all()
        
        missing_issues2 = [i for i in issues2 if i['type'] == 'missing_values']
        assert len(missing_issues2) > 0
        for issue in missing_issues2:
            if issue['percentage'] > 0.1:
                assert issue['severity'] in ['medium', 'high']
    
    def test_detect_duplicates(self, good_data_path, bad_data_path):
        from core.quality_checker import DataQualityChecker
        
        good_data = pd.read_csv(os.path.join(good_data_path, 'raw-data.csv'))
        checker = DataQualityChecker(good_data)
        issues = checker.check_all()
        
        dup_issues = [i for i in issues if i['type'] == 'duplicates']
        for issue in dup_issues:
            assert issue['percentage'] < 0.01
        
        bad_data = pd.read_csv(os.path.join(bad_data_path, 'bad_data_duplicates.csv'))
        checker2 = DataQualityChecker(bad_data)
        issues2 = checker2.check_all()
        
        dup_issues2 = [i for i in issues2 if i['type'] == 'duplicates']
        assert len(dup_issues2) > 0
        high_dup = [i for i in dup_issues2 if i['percentage'] > 0.05]
        assert len(high_dup) > 0
    
    def test_detect_outliers(self, good_data_path, bad_data_path):
        from core.quality_checker import DataQualityChecker
        
        good_data = pd.read_csv(os.path.join(good_data_path, 'raw-data.csv'))
        checker = DataQualityChecker(good_data)
        issues = checker.check_all()
        
        outlier_issues = [i for i in issues if i['type'] == 'outliers']
        for issue in outlier_issues:
            if issue['column'] == 'age':
                assert issue['count'] == 0
        
        bad_data = pd.read_csv(os.path.join(bad_data_path, 'bad_data_outliers.csv'))
        checker2 = DataQualityChecker(bad_data)
        issues2 = checker2.check_all()
        
        outlier_issues2 = [i for i in issues2 if i['type'] == 'outliers']
        age_outliers = [i for i in outlier_issues2 if i['column'] == 'age']
        assert len(age_outliers) > 0
        assert age_outliers[0]['count'] > 0
    
    def test_quality_summary(self, good_data_path):
        from core.quality_checker import DataQualityChecker, get_quality_summary
        
        good_data = pd.read_csv(os.path.join(good_data_path, 'raw-data.csv'))
        checker = DataQualityChecker(good_data)
        summary = get_quality_summary(checker)
        
        assert 'overall_score' in summary
        assert 'issues_by_severity' in summary
        assert summary['overall_score'] >= 0.8
    
    def test_zero_variance_detection(self):
        from core.quality_checker import DataQualityChecker
        
        data = pd.DataFrame({
            'id': [1, 2, 3, 4, 5],
            'constant': [1, 1, 1, 1, 1],
            'varying': [1, 2, 3, 4, 5],
            'target': [0, 1, 0, 1, 0]
        })
        
        checker = DataQualityChecker(data)
        issues = checker.check_all()
        
        constant_issues = [i for i in issues if i['type'] == 'zero_variance']
        assert len(constant_issues) > 0
        assert 'constant' in [i['column'] for i in constant_issues]
