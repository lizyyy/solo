import numpy as np
import pandas as pd
from sklearn.metrics import (
    mean_absolute_error, mean_squared_error, r2_score,
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, confusion_matrix, roc_curve
)
import warnings
warnings.filterwarnings('ignore')


class Evaluator:
    def __init__(self):
        pass
    
    def evaluate(self, y_true, y_pred, y_proba=None, task_type='regression'):
        if task_type == 'regression':
            return self._evaluate_regression(y_true, y_pred)
        elif task_type == 'classification':
            return self._evaluate_classification(y_true, y_pred, y_proba)
        else:
            raise ValueError(f"不支持的任务类型: {task_type}")
    
    def _evaluate_regression(self, y_true, y_pred):
        y_true = np.array(y_true)
        y_pred = np.array(y_pred)
        
        mae = mean_absolute_error(y_true, y_pred)
        mse = mean_squared_error(y_true, y_pred)
        rmse = np.sqrt(mse)
        r2 = r2_score(y_true, y_pred)
        
        mape = np.mean(np.abs((y_true - y_pred) / (np.abs(y_true) + 1e-8))) * 100
        
        return {
            'MAE': float(mae),
            'MSE': float(mse),
            'RMSE': float(rmse),
            'R2': float(r2),
            'MAPE': float(mape)
        }
    
    def _evaluate_classification(self, y_true, y_pred, y_proba=None):
        y_true = np.array(y_true)
        y_pred = np.array(y_pred)
        
        accuracy = accuracy_score(y_true, y_pred)
        
        is_multiclass = len(np.unique(y_true)) > 2
        
        if is_multiclass:
            precision = precision_score(y_true, y_pred, average='weighted', zero_division=0)
            recall = recall_score(y_true, y_pred, average='weighted', zero_division=0)
            f1 = f1_score(y_true, y_pred, average='weighted', zero_division=0)
        else:
            precision = precision_score(y_true, y_pred, average='binary', zero_division=0)
            recall = recall_score(y_true, y_pred, average='binary', zero_division=0)
            f1 = f1_score(y_true, y_pred, average='binary', zero_division=0)
        
        auc = None
        if y_proba is not None:
            try:
                if is_multiclass:
                    auc = roc_auc_score(y_true, y_proba, multi_class='ovr', average='weighted')
                else:
                    auc = roc_auc_score(y_true, y_proba[:, 1] if y_proba.ndim > 1 else y_proba)
            except:
                auc = None
        
        return {
            'Accuracy': float(accuracy),
            'Precision': float(precision),
            'Recall': float(recall),
            'F1': float(f1),
            'AUC': float(auc) if auc is not None else None
        }
    
    def get_confusion_matrix(self, y_true, y_pred):
        y_true = np.array(y_true)
        y_pred = np.array(y_pred)
        
        cm = confusion_matrix(y_true, y_pred)
        
        labels = sorted(np.unique(np.concatenate([y_true, y_pred])))
        
        return {
            'matrix': cm.tolist(),
            'labels': [int(l) if isinstance(l, np.integer) else str(l) for l in labels],
            'shape': cm.shape
        }
    
    def get_residuals(self, y_true, y_pred):
        y_true = np.array(y_true)
        y_pred = np.array(y_pred)
        
        residuals = y_true - y_pred
        
        return {
            'values': residuals.tolist()[:500] if len(residuals) > 500 else residuals.tolist(),
            'mean': float(np.mean(residuals)),
            'std': float(np.std(residuals)),
            'min': float(np.min(residuals)),
            'max': float(np.max(residuals)),
            'y_true': y_true.tolist()[:500] if len(y_true) > 500 else y_true.tolist(),
            'y_pred': y_pred.tolist()[:500] if len(y_pred) > 500 else y_pred.tolist()
        }
    
    def get_feature_importance(self, model, feature_names, model_type):
        importance = None
        
        if hasattr(model, 'feature_importances_'):
            importance = model.feature_importances_
        elif hasattr(model, 'coef_'):
            importance = np.abs(model.coef_).flatten()
        
        if importance is None:
            return None
        
        if len(importance) != len(feature_names):
            return {
                'features': [f'feature_{i}' for i in range(len(importance))],
                'importance': importance.tolist(),
                'note': '特征数量与原始特征列数不匹配，可能经过了独热编码'
            }
        
        sorted_indices = np.argsort(importance)[::-1]
        
        return {
            'features': [feature_names[i] for i in sorted_indices],
            'importance': importance[sorted_indices].tolist(),
            'sorted_by_importance': True
        }
    
    def get_roc_curve_data(self, y_true, y_proba, pos_label=1):
        if y_proba is None:
            return None
        
        y_true = np.array(y_true)
        y_proba = np.array(y_proba)
        
        if y_proba.ndim > 1:
            y_proba = y_proba[:, pos_label]
        
        try:
            fpr, tpr, thresholds = roc_curve(y_true, y_proba, pos_label=pos_label)
            return {
                'fpr': fpr.tolist(),
                'tpr': tpr.tolist(),
                'thresholds': thresholds.tolist()
            }
        except:
            return None
    
    def compare_models(self, results_dict, task_type):
        comparison = {}
        
        metrics_list = []
        for model_name, result in results_dict.items():
            metrics = result.get('metrics', {})
            metrics['model'] = model_name
            metrics_list.append(metrics)
        
        comparison['metrics_comparison'] = metrics_list
        
        for model_name, result in results_dict.items():
            if result.get('feature_importance'):
                comparison[f'{model_name}_feature_importance'] = result['feature_importance']
        
        return comparison
