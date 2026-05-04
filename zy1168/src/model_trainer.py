import numpy as np
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.tree import DecisionTreeRegressor, DecisionTreeClassifier
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
import xgboost as xgb
import warnings
warnings.filterwarnings('ignore')


class ModelTrainer:
    def __init__(self):
        self.model_configs = {
            'regression': {
                'linear_regression': {
                    'class': LinearRegression,
                    'default_params': {'fit_intercept': True}
                },
                'decision_tree': {
                    'class': DecisionTreeRegressor,
                    'default_params': {'max_depth': 10, 'min_samples_split': 2, 'random_state': 42}
                },
                'random_forest': {
                    'class': RandomForestRegressor,
                    'default_params': {'n_estimators': 100, 'max_depth': 10, 'random_state': 42, 'n_jobs': -1}
                },
                'xgboost': {
                    'class': xgb.XGBRegressor,
                    'default_params': {'n_estimators': 100, 'max_depth': 6, 'learning_rate': 0.1, 'random_state': 42, 'n_jobs': -1}
                }
            },
            'classification': {
                'logistic_regression': {
                    'class': LogisticRegression,
                    'default_params': {'max_iter': 1000, 'random_state': 42, 'n_jobs': -1}
                },
                'decision_tree': {
                    'class': DecisionTreeClassifier,
                    'default_params': {'max_depth': 10, 'min_samples_split': 2, 'random_state': 42}
                },
                'random_forest': {
                    'class': RandomForestClassifier,
                    'default_params': {'n_estimators': 100, 'max_depth': 10, 'random_state': 42, 'n_jobs': -1}
                },
                'xgboost': {
                    'class': xgb.XGBClassifier,
                    'default_params': {'n_estimators': 100, 'max_depth': 6, 'learning_rate': 0.1, 'random_state': 42, 'n_jobs': -1, 'use_label_encoder': False, 'eval_metric': 'logloss'}
                }
            }
        }
    
    def train(self, X_train, y_train, model_type, task_type, random_state=42, custom_params=None):
        if task_type not in self.model_configs:
            raise ValueError(f"不支持的任务类型: {task_type}")
        
        if model_type not in self.model_configs[task_type]:
            raise ValueError(f"不支持的模型类型: {model_type} 用于 {task_type} 任务")
        
        model_config = self.model_configs[task_type][model_type]
        model_class = model_config['class']
        
        params = model_config['default_params'].copy()
        if custom_params:
            params.update(custom_params)
        
        params['random_state'] = random_state
        
        model = model_class(**params)
        model.fit(X_train, y_train)
        
        model_params = self._get_model_params(model, model_type, task_type)
        
        return model, model_params
    
    def _get_model_params(self, model, model_type, task_type):
        params = {}
        
        if model_type == 'linear_regression':
            params = {
                'fit_intercept': model.fit_intercept,
                'coef_': model.coef_.tolist() if hasattr(model, 'coef_') else None,
                'intercept_': float(model.intercept_) if hasattr(model, 'intercept_') else None
            }
        elif model_type == 'logistic_regression':
            params = {
                'max_iter': model.max_iter,
                'C': model.C,
                'coef_': model.coef_.tolist() if hasattr(model, 'coef_') else None,
                'intercept_': model.intercept_.tolist() if hasattr(model, 'intercept_') else None
            }
        elif model_type == 'decision_tree':
            params = {
                'max_depth': model.max_depth,
                'min_samples_split': model.min_samples_split,
                'min_samples_leaf': model.min_samples_leaf,
                'max_features': model.max_features,
                'max_leaf_nodes': model.max_leaf_nodes,
                'n_features_in_': model.n_features_in_
            }
        elif model_type == 'random_forest':
            params = {
                'n_estimators': model.n_estimators,
                'max_depth': model.max_depth,
                'min_samples_split': model.min_samples_split,
                'min_samples_leaf': model.min_samples_leaf,
                'max_features': model.max_features,
                'bootstrap': model.bootstrap,
                'n_features_in_': model.n_features_in_
            }
        elif model_type == 'xgboost':
            params = {
                'n_estimators': model.n_estimators,
                'max_depth': model.max_depth,
                'learning_rate': model.learning_rate,
                'subsample': model.subsample,
                'colsample_bytree': model.colsample_bytree,
                'gamma': model.gamma,
                'reg_alpha': model.reg_alpha,
                'reg_lambda': model.reg_lambda,
                'min_child_weight': model.min_child_weight
            }
        
        return params
    
    def get_available_models(self, task_type):
        if task_type not in self.model_configs:
            raise ValueError(f"不支持的任务类型: {task_type}")
        return list(self.model_configs[task_type].keys())
    
    def predict(self, model, X):
        return model.predict(X)
    
    def predict_proba(self, model, X):
        if hasattr(model, 'predict_proba'):
            return model.predict_proba(X)
        else:
            raise ValueError("该模型不支持概率预测")
