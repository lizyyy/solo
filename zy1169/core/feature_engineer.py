import os
import pandas as pd
import numpy as np
from datetime import datetime
from sklearn.preprocessing import LabelEncoder, OneHotEncoder, StandardScaler, MinMaxScaler
from sklearn.model_selection import train_test_split
from models import db, FeatureVersion, FeatureCheck

class FeatureEngineer:
    def __init__(self, feature_spec):
        self.feature_spec = feature_spec
        self.checks = []
    
    def transform(self, df):
        self.checks = []
        df_transformed = df.copy()
        
        label_encoders = {}
        feature_names = []
        
        for feature in self.feature_spec.get('features', []):
            name = feature.get('name')
            source_columns = feature.get('source_columns', [name])
            transform_type = feature.get('transform')
            is_target = feature.get('is_target', False)
            
            if transform_type == 'label_encode':
                df_transformed, encoder = self._label_encode(df_transformed, source_columns[0])
                label_encoders[source_columns[0]] = encoder
                feature_names.append(name)
            
            elif transform_type == 'one_hot':
                drop_first = feature.get('drop_first', False)
                df_transformed = self._one_hot_encode(df_transformed, source_columns[0], drop_first)
                encoded_cols = [col for col in df_transformed.columns if col.startswith(f"{source_columns[0]}_")]
                feature_names.extend(encoded_cols)
            
            elif transform_type == 'normalize':
                method = feature.get('method', 'standard')
                df_transformed = self._normalize(df_transformed, source_columns[0], method)
                feature_names.append(name)
            
            elif transform_type == 'bin':
                bins = feature.get('bins', 5)
                labels = feature.get('labels')
                df_transformed = self._bin(df_transformed, source_columns[0], bins, labels)
                feature_names.append(name)
            
            elif transform_type == 'log_transform':
                df_transformed = self._log_transform(df_transformed, source_columns[0])
                feature_names.append(name)
            
            elif transform_type == 'extract_datetime':
                components = feature.get('components', ['year', 'month', 'day'])
                df_transformed = self._extract_datetime(df_transformed, source_columns[0], components)
                for comp in components:
                    feature_names.append(f"{source_columns[0]}_{comp}")
            
            elif transform_type == 'interaction':
                df_transformed = self._create_interaction(df_transformed, source_columns, name)
                feature_names.append(name)
            
            elif transform_type == 'polynomial':
                degree = feature.get('degree', 2)
                df_transformed = self._polynomial_features(df_transformed, source_columns[0], degree)
                for d in range(2, degree + 1):
                    feature_names.append(f"{source_columns[0]}_pow{d}")
            
            elif transform_type == 'pass_through':
                feature_names.append(name)
            
            if not is_target:
                self._check_feature(df_transformed, name if transform_type != 'one_hot' else source_columns[0])
        
        target_col = self.feature_spec.get('target_column')
        if target_col and target_col not in feature_names:
            feature_names.append(target_col)
        
        return df_transformed, feature_names, label_encoders
    
    def _label_encode(self, df, column):
        le = LabelEncoder()
        df[column + '_encoded'] = le.fit_transform(df[column].astype(str))
        return df, le
    
    def _one_hot_encode(self, df, column, drop_first=False):
        df = pd.get_dummies(df, columns=[column], drop_first=drop_first)
        return df
    
    def _normalize(self, df, column, method):
        if method == 'standard':
            scaler = StandardScaler()
            df[column + '_scaled'] = scaler.fit_transform(df[[column]])
        elif method == 'minmax':
            scaler = MinMaxScaler()
            df[column + '_scaled'] = scaler.fit_transform(df[[column]])
        return df
    
    def _bin(self, df, column, bins, labels=None):
        df[column + '_binned'] = pd.cut(df[column], bins=bins, labels=labels)
        return df
    
    def _log_transform(self, df, column):
        df[column + '_log'] = np.log1p(df[column])
        return df
    
    def _extract_datetime(self, df, column, components):
        df[column] = pd.to_datetime(df[column])
        for comp in components:
            if comp == 'year':
                df[f"{column}_year"] = df[column].dt.year
            elif comp == 'month':
                df[f"{column}_month"] = df[column].dt.month
            elif comp == 'day':
                df[f"{column}_day"] = df[column].dt.day
            elif comp == 'hour':
                df[f"{column}_hour"] = df[column].dt.hour
            elif comp == 'weekday':
                df[f"{column}_weekday"] = df[column].dt.weekday
        return df
    
    def _create_interaction(self, df, columns, name):
        df[name] = df[columns[0]] * df[columns[1]]
        return df
    
    def _polynomial_features(self, df, column, degree):
        for d in range(2, degree + 1):
            df[f"{column}_pow{d}"] = df[column] ** d
        return df
    
    def _check_feature(self, df, column):
        if column not in df.columns:
            return
        
        missing_ratio = df[column].isna().sum() / len(df)
        if missing_ratio > 0.1:
            self.checks.append({
                'check_type': 'missing_values',
                'feature_name': column,
                'status': 'warning',
                'message': f"High missing value ratio: {missing_ratio:.2%}",
                'value': missing_ratio
            })
        
        if df[column].dtype in ['int64', 'float64']:
            zero_ratio = (df[column] == 0).sum() / len(df)
            if zero_ratio > 0.9:
                self.checks.append({
                    'check_type': 'constant_feature',
                    'feature_name': column,
                    'status': 'warning',
                    'message': f"Most values are zero: {zero_ratio:.2%}",
                    'value': zero_ratio
                })
            
            unique_ratio = df[column].nunique() / len(df)
            if unique_ratio > 0.95:
                self.checks.append({
                    'check_type': 'id_like_feature',
                    'feature_name': column,
                    'status': 'warning',
                    'message': f"Feature looks like an ID (high cardinality)",
                    'value': unique_ratio
                })


def check_feature_leakage(df, target_col, feature_cols):
    leakage_checks = []
    
    for col in feature_cols:
        if col == target_col:
            continue
        
        if col in df.columns and target_col in df.columns:
            if df[col].dtype in ['int64', 'float64']:
                corr = df[[col, target_col]].corr().iloc[0, 1]
                if abs(corr) > 0.95:
                    leakage_checks.append({
                        'feature_name': col,
                        'check_type': 'high_correlation_leakage',
                        'status': 'danger',
                        'message': f"Very high correlation with target: {corr:.4f}",
                        'value': corr
                    })
            
            if df[col].dtype == 'object':
                cross_tab = pd.crosstab(df[col], df[target_col])
                if (cross_tab > 0).all().all() and len(df[col].unique()) == len(df[target_col].unique()):
                    leakage_checks.append({
                        'feature_name': col,
                        'check_type': 'perfect_prediction',
                        'status': 'danger',
                        'message': "Feature appears to perfectly predict target",
                        'value': 1.0
                    })
    
    return leakage_checks


def run_feature_engineering(feature_version_id, data_folder):
    feature_version = FeatureVersion.query.get(feature_version_id)
    if not feature_version:
        return False, "Feature version not found"
    
    from core.data_uploader import load_yaml_file
    
    try:
        feature_version.status = 'running'
        feature_version.started_at = datetime.utcnow()
        db.session.commit()
        
        cleaning_task = feature_version.cleaning_task
        df = pd.read_csv(cleaning_task.output_file_path)
        
        spec = load_yaml_file(feature_version.spec_file_path)
        
        engineer = FeatureEngineer(spec)
        df_transformed, feature_names, encoders = engineer.transform(df)
        
        target_col = spec.get('target_column')
        leakage_checks = check_feature_leakage(
            df_transformed, 
            target_col, 
            [f for f in feature_names if f != target_col]
        )
        
        all_checks = engineer.checks + leakage_checks
        
        output_filename = f"features_{feature_version.version}.csv"
        output_path = os.path.join(data_folder, 'features', output_filename)
        df_transformed.to_csv(output_path, index=False)
        
        feature_version.output_file_path = output_path
        feature_version.feature_names = ','.join(feature_names)
        feature_version.feature_count = len(feature_names)
        feature_version.row_count = len(df_transformed)
        feature_version.status = 'completed'
        feature_version.completed_at = datetime.utcnow()
        
        for check in all_checks:
            feature_check = FeatureCheck(
                feature_version_id=feature_version.id,
                check_type=check['check_type'],
                feature_name=check.get('feature_name'),
                status=check['status'],
                message=check.get('message'),
                value=check.get('value')
            )
            db.session.add(feature_check)
        
        db.session.commit()
        return True, "Feature engineering completed successfully"
    
    except Exception as e:
        feature_version.status = 'failed'
        feature_version.error_message = str(e)
        db.session.commit()
        return False, str(e)
