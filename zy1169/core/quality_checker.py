import pandas as pd
import numpy as np
from datetime import datetime
from models import db, DataQualityCheck, DatasetVersion

class DataQualityChecker:
    def __init__(self):
        self.checks = []
    
    def run_all_checks(self, df):
        self.checks = []
        
        self.check_missing_values(df)
        self.check_duplicates(df)
        self.check_outliers(df)
        self.check_data_types(df)
        self.check_constant_columns(df)
        self.check_id_columns(df)
        
        return self.checks
    
    def check_missing_values(self, df):
        total_rows = len(df)
        for col in df.columns:
            missing_count = df[col].isna().sum()
            missing_ratio = missing_count / total_rows
            
            if missing_ratio > 0.05:
                status = 'warning' if missing_ratio <= 0.2 else 'danger'
                self.checks.append({
                    'check_type': 'missing_values',
                    'column_name': col,
                    'status': status,
                    'message': f"Missing values: {missing_count} ({missing_ratio:.2%})",
                    'value': missing_ratio,
                    'threshold': 0.05
                })
    
    def check_duplicates(self, df):
        duplicate_count = df.duplicated().sum()
        duplicate_ratio = duplicate_count / len(df)
        
        if duplicate_count > 0:
            status = 'warning' if duplicate_ratio <= 0.1 else 'danger'
            self.checks.append({
                'check_type': 'duplicate_rows',
                'column_name': None,
                'status': status,
                'message': f"Duplicate rows: {duplicate_count} ({duplicate_ratio:.2%})",
                'value': duplicate_ratio,
                'threshold': 0.0
            })
    
    def check_outliers(self, df):
        for col in df.select_dtypes(include=['number']).columns:
            q1 = df[col].quantile(0.25)
            q3 = df[col].quantile(0.75)
            iqr = q3 - q1
            
            if iqr == 0:
                continue
            
            lower_bound = q1 - 1.5 * iqr
            upper_bound = q3 + 1.5 * iqr
            
            outlier_count = ((df[col] < lower_bound) | (df[col] > upper_bound)).sum()
            outlier_ratio = outlier_count / len(df)
            
            if outlier_ratio > 0.05:
                status = 'warning' if outlier_ratio <= 0.15 else 'danger'
                self.checks.append({
                    'check_type': 'outliers',
                    'column_name': col,
                    'status': status,
                    'message': f"Outliers detected: {outlier_count} ({outlier_ratio:.2%})",
                    'value': outlier_ratio,
                    'threshold': 0.05
                })
    
    def check_data_types(self, df):
        for col in df.columns:
            inferred_type = df[col].dtype
            mixed_types = False
            
            if df[col].dtype == 'object':
                try:
                    pd.to_numeric(df[col], errors='raise')
                    mixed_types = True
                except:
                    pass
                
                try:
                    pd.to_datetime(df[col], errors='raise')
                    mixed_types = True
                except:
                    pass
            
            if mixed_types:
                self.checks.append({
                    'check_type': 'mixed_data_types',
                    'column_name': col,
                    'status': 'warning',
                    'message': f"Column may contain mixed data types (inferred: {inferred_type})",
                    'value': None,
                    'threshold': None
                })
    
    def check_constant_columns(self, df):
        for col in df.columns:
            unique_count = df[col].nunique()
            
            if unique_count == 1:
                self.checks.append({
                    'check_type': 'constant_column',
                    'column_name': col,
                    'status': 'warning',
                    'message': f"Column has only one unique value: {df[col].iloc[0]}",
                    'value': unique_count,
                    'threshold': 2
                })
            elif unique_count == 2 and df[col].dtype in ['object', 'bool']:
                pass
    
    def check_id_columns(self, df):
        for col in df.columns:
            unique_ratio = df[col].nunique() / len(df)
            
            if unique_ratio > 0.99 and unique_ratio <= 1.0:
                self.checks.append({
                    'check_type': 'potential_id_column',
                    'column_name': col,
                    'status': 'info',
                    'message': f"Column appears to be an ID column (unique ratio: {unique_ratio:.2%})",
                    'value': unique_ratio,
                    'threshold': 0.99
                })


def run_data_quality_check(dataset_version_id):
    dataset = DatasetVersion.query.get(dataset_version_id)
    if not dataset:
        return False, "Dataset not found"
    
    try:
        df = pd.read_csv(dataset.file_path)
        
        checker = DataQualityChecker()
        checks = checker.run_all_checks(df)
        
        for check in checks:
            quality_check = DataQualityCheck(
                dataset_id=dataset.id,
                check_type=check['check_type'],
                column_name=check.get('column_name'),
                status=check['status'],
                message=check.get('message'),
                value=check.get('value'),
                threshold=check.get('threshold')
            )
            db.session.add(quality_check)
        
        db.session.commit()
        return True, f"Quality check completed. Found {len(checks)} issues."
    
    except Exception as e:
        return False, str(e)


def get_quality_summary(dataset_version_id):
    checks = DataQualityCheck.query.filter_by(dataset_id=dataset_version_id).all()
    
    summary = {
        'total': len(checks),
        'danger': 0,
        'warning': 0,
        'info': 0,
        'by_type': {}
    }
    
    for check in checks:
        if check.status == 'danger':
            summary['danger'] += 1
        elif check.status == 'warning':
            summary['warning'] += 1
        elif check.status == 'info':
            summary['info'] += 1
        
        if check.check_type not in summary['by_type']:
            summary['by_type'][check.check_type] = 0
        summary['by_type'][check.check_type] += 1
    
    return summary
