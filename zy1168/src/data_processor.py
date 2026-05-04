import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.impute import SimpleImputer
import warnings
warnings.filterwarnings('ignore')


class DataProcessor:
    def __init__(self):
        self.scaler = StandardScaler()
        self.label_encoder = LabelEncoder()
    
    def process(self, df, target_column, feature_columns, task_type, test_size=0.2, random_state=42):
        df_copy = df.copy()
        
        preprocessor_info = {
            'missing_values_handling': {},
            'encoding': {},
            'scaling': 'StandardScaler applied to numeric features'
        }
        
        X = df_copy[feature_columns].copy()
        y = df_copy[target_column].copy()
        
        numeric_cols = X.select_dtypes(include=['int64', 'float64']).columns.tolist()
        categorical_cols = X.select_dtypes(include=['object', 'category']).columns.tolist()
        
        for col in X.columns:
            missing_count = X[col].isna().sum()
            if missing_count > 0:
                if col in numeric_cols:
                    imputer = SimpleImputer(strategy='median')
                    X[col] = imputer.fit_transform(X[[col]]).flatten()
                    preprocessor_info['missing_values_handling'][col] = {
                        'type': 'numeric',
                        'strategy': 'median',
                        'missing_count': int(missing_count)
                    }
                else:
                    X[col] = X[col].fillna('Missing')
                    preprocessor_info['missing_values_handling'][col] = {
                        'type': 'categorical',
                        'strategy': 'constant_Missing',
                        'missing_count': int(missing_count)
                    }
        
        for col in categorical_cols:
            if col in X.columns:
                X = pd.get_dummies(X, columns=[col], prefix=col, drop_first=True)
                preprocessor_info['encoding'][col] = 'one_hot_encoding'
        
        if len(numeric_cols) > 0:
            existing_numeric_cols = [col for col in numeric_cols if col in X.columns]
            if existing_numeric_cols:
                X[existing_numeric_cols] = self.scaler.fit_transform(X[existing_numeric_cols])
        
        if task_type == 'classification':
            if y.dtype == 'object' or y.dtype.name == 'category':
                y = self.label_encoder.fit_transform(y)
                preprocessor_info['encoding']['target'] = {
                    'type': 'label_encoding',
                    'classes': self.label_encoder.classes_.tolist()
                }
        
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state,
            stratify=y if task_type == 'classification' else None
        )
        
        preprocessor_info['train_size'] = len(X_train)
        preprocessor_info['test_size'] = len(X_test)
        preprocessor_info['feature_count'] = X_train.shape[1]
        
        return X_train, X_test, y_train, y_test, preprocessor_info
    
    def handle_missing_values(self, df, strategy_dict=None):
        if strategy_dict is None:
            strategy_dict = {}
        
        df_copy = df.copy()
        
        for col in df_copy.columns:
            if df_copy[col].isna().sum() > 0:
                if col in strategy_dict:
                    strategy = strategy_dict[col]
                else:
                    if df_copy[col].dtype in ['int64', 'float64']:
                        strategy = 'median'
                    else:
                        strategy = 'most_frequent'
                
                if strategy == 'median':
                    df_copy[col] = df_copy[col].fillna(df_copy[col].median())
                elif strategy == 'mean':
                    df_copy[col] = df_copy[col].fillna(df_copy[col].mean())
                elif strategy == 'most_frequent':
                    df_copy[col] = df_copy[col].fillna(df_copy[col].mode()[0] if not df_copy[col].mode().empty else 'Missing')
                elif strategy == 'drop':
                    df_copy = df_copy.dropna(subset=[col])
                else:
                    df_copy[col] = df_copy[col].fillna(strategy)
        
        return df_copy
    
    def encode_categorical(self, df, columns=None, method='onehot'):
        df_copy = df.copy()
        
        if columns is None:
            columns = df_copy.select_dtypes(include=['object', 'category']).columns.tolist()
        
        for col in columns:
            if col in df_copy.columns:
                if method == 'onehot':
                    df_copy = pd.get_dummies(df_copy, columns=[col], prefix=col, drop_first=True)
                elif method == 'label':
                    le = LabelEncoder()
                    df_copy[col] = le.fit_transform(df_copy[col].astype(str))
        
        return df_copy
    
    def scale_features(self, df, columns=None, method='standard'):
        df_copy = df.copy()
        
        if columns is None:
            columns = df_copy.select_dtypes(include=['int64', 'float64']).columns.tolist()
        
        if method == 'standard':
            scaler = StandardScaler()
            df_copy[columns] = scaler.fit_transform(df_copy[columns])
        
        return df_copy
